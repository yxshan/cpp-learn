import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

import {
  MAX_SCANNED_BYTES,
  evaluateAudit,
  formatSecretFinding,
  looksBinary,
  parseExemptions,
  scanFiles,
  scanText,
  type SecretFinding,
} from "./security-checks.ts";

const run = promisify(execFile);
const exemptionsPath = resolve("security", "audit-exemptions.json");

async function git(args: readonly string[]): Promise<string> {
  try {
    const { stdout } = await run("git", [...args], {
      maxBuffer: 64 * 1024 * 1024,
    });
    return stdout;
  } catch (error) {
    const failure = error as { code?: number; stdout?: string };
    // `git grep` exits 1 for "no matches", which is a successful empty result.
    if (failure.code === 1 && typeof failure.stdout === "string") {
      return failure.stdout;
    }
    throw error;
  }
}

async function scanTrackedTree(): Promise<{
  findings: SecretFinding[];
  skipped: string[];
  fileCount: number;
}> {
  const listed = await git(["ls-files", "-z"]);
  const paths = listed.split("\u0000").filter((path) => path !== "");
  const files: { path: string; text: string }[] = [];
  const skipped: string[] = [];
  for (const path of paths) {
    try {
      const info = await stat(path);
      if (!info.isFile()) continue;
      if (info.size > MAX_SCANNED_BYTES) {
        skipped.push(`${path} (${info.size} bytes)`);
        continue;
      }
      const text = await readFile(path, "utf8");
      if (looksBinary(text)) {
        skipped.push(`${path} (binary)`);
        continue;
      }
      files.push({ path, text });
    } catch {
      skipped.push(`${path} (unreadable)`);
    }
  }
  const scan = scanFiles(files, skipped);
  return { ...scan, fileCount: files.length };
}

/**
 * Scan every line ever added, using the same patterns as the working-tree scan.
 *
 * `git grep -E` would need a second, POSIX dialect of every pattern; replaying
 * the added lines through `scanText` keeps one definition of "a secret".
 */
async function scanHistory(): Promise<SecretFinding[]> {
  const diff = await git([
    "log",
    "--all",
    "-p",
    "--no-color",
    "--unified=0",
    "--format=commit %H",
  ]);
  const findings: SecretFinding[] = [];
  let commit = "?";
  let path = "?";
  let lineNumber = 0;
  for (const raw of diff.split("\n")) {
    if (raw.startsWith("commit ")) {
      commit = raw.slice(7, 17);
      path = "?";
      continue;
    }
    if (raw.startsWith("+++ b/")) {
      path = raw.slice(6);
      continue;
    }
    if (raw.startsWith("@@")) {
      const match = /\+(\d+)/.exec(raw);
      lineNumber = match ? Number(match[1]) : 0;
      continue;
    }
    if (!raw.startsWith("+") || raw.startsWith("+++")) continue;
    const added = raw.slice(1);
    for (const finding of scanText(`${commit}:${path}`, added)) {
      findings.push({ ...finding, line: lineNumber });
    }
    lineNumber += 1;
  }
  return findings;
}

async function auditProductionDependencies(): Promise<number> {
  const exemptionsRaw = await readFile(exemptionsPath, "utf8");
  const exemptionsFile = parseExemptions(JSON.parse(exemptionsRaw));
  let raw: string;
  try {
    // npm exits non-zero when advisories exist, so read stdout either way.
    const result = await run("npm", ["audit", "--omit=dev", "--json"], {
      maxBuffer: 16 * 1024 * 1024,
    }).catch((error: { stdout?: string }) => ({
      stdout: error.stdout ?? "",
    }));
    raw = result.stdout;
  } catch (error) {
    console.error(`npm audit could not run: ${String(error)}`);
    return 1;
  }

  let report: unknown;
  try {
    report = JSON.parse(raw);
  } catch {
    console.error(
      "npm audit did not produce JSON; the check cannot be trusted",
    );
    return 1;
  }
  if (
    typeof report === "object" &&
    report !== null &&
    (report as Record<string, unknown>)["error"]
  ) {
    console.error(
      `npm audit reported an error: ${JSON.stringify((report as Record<string, unknown>)["error"])}`,
    );
    return 1;
  }

  const today = new Date().toISOString().slice(0, 10);
  const evaluation = evaluateAudit({
    report,
    exemptions: exemptionsFile.exemptions,
    today,
  });

  for (const { advisory, exemption } of evaluation.waived) {
    console.warn(
      `Exempted ${advisory.advisoryId} (${advisory.package}, ${advisory.severity}) until ${exemption.expiresOn}: ${exemption.reason} [${exemption.owner}]`,
    );
  }
  for (const exemption of evaluation.expired) {
    console.error(
      `Expired exemption ${exemption.advisoryId} (${exemption.package}) expired on ${exemption.expiresOn}; renew or fix it.`,
    );
  }
  for (const exemption of evaluation.stale) {
    console.error(
      `Stale exemption ${exemption.advisoryId} (${exemption.package}) matches no reported advisory; delete it.`,
    );
  }
  for (const advisory of evaluation.failures) {
    console.error(
      `Unwaived production advisory ${advisory.advisoryId} in ${advisory.package} (${advisory.severity}): ${advisory.title}`,
    );
  }

  const clean =
    evaluation.failures.length === 0 &&
    evaluation.expired.length === 0 &&
    evaluation.stale.length === 0;
  if (clean) {
    console.log(
      `Production dependency audit passed: ${evaluation.advisories.length} advisories reported, ${evaluation.waived.length} exempted.`,
    );
  }
  return clean ? 0 : 1;
}

const scanHistoryRequested = process.argv.includes("--history");

let exitCode = await auditProductionDependencies();

const tree = await scanTrackedTree();
if (tree.skipped.length > 0) {
  console.log(`Secret scan skipped ${tree.skipped.length} file(s):`);
  for (const skipped of tree.skipped) console.log(`  - ${skipped}`);
}
if (tree.findings.length > 0) {
  console.error(`Secret scan found ${tree.findings.length} finding(s):`);
  for (const finding of tree.findings) {
    console.error(`  - ${formatSecretFinding(finding)}`);
  }
  exitCode = 1;
} else {
  console.log(
    `Secret scan passed: ${tree.fileCount} tracked text file(s) scanned.`,
  );
}

if (scanHistoryRequested) {
  const historyFindings = await scanHistory();
  if (historyFindings.length > 0) {
    console.error(
      `Git history secret scan found ${historyFindings.length} finding(s):`,
    );
    for (const finding of historyFindings) {
      console.error(`  - ${formatSecretFinding(finding)}`);
    }
    exitCode = 1;
  } else {
    console.log("Git history secret scan passed: no matches in any revision.");
  }
}

process.exitCode = exitCode;
