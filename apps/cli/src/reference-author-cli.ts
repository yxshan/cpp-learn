import {
  REFERENCE_ENTRY_KINDS,
  type ReferenceEntryKind,
} from "@cpp-learn/contracts";
import type { ReferenceAuthoring } from "@cpp-learn/reference-authoring";

export interface ReferenceAuthorCliDependencies {
  readonly argv: readonly string[];
  readonly authoring: ReferenceAuthoring;
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

const prepareUsage =
  "Usage: npm run reference:author -- prepare --id ID --kind KIND --slug SLUG --title TITLE [--json]\n";
const checkUsage =
  "Usage: npm run reference:author -- check --draft ID [--json]\n";

function flagValue(flags: readonly string[], name: string): string | undefined {
  const index = flags.indexOf(name);
  return index >= 0 ? flags[index + 1] : undefined;
}

function isReferenceEntryKind(value: string): value is ReferenceEntryKind {
  return REFERENCE_ENTRY_KINDS.some((kind) => kind === value);
}

export async function runReferenceAuthorCli(
  dependencies: ReferenceAuthorCliDependencies,
): Promise<number> {
  const [command, ...flags] = dependencies.argv;
  const json = flags.includes("--json");

  if (command === "prepare") {
    const entryId = flagValue(flags, "--id");
    const kind = flagValue(flags, "--kind");
    const slug = flagValue(flags, "--slug");
    const title = flagValue(flags, "--title");
    if (
      entryId === undefined ||
      kind === undefined ||
      !isReferenceEntryKind(kind) ||
      slug === undefined ||
      title === undefined
    ) {
      dependencies.stderr(prepareUsage);
      return 2;
    }
    const result = await dependencies.authoring.prepare({
      target: { entryId, kind, slug, title },
    });
    if (json) {
      dependencies.stdout(
        `${JSON.stringify(
          result.ok
            ? {
                ok: true,
                created: result.created,
                draft: result.workspace.draft,
              }
            : result,
        )}\n`,
      );
    } else if (result.ok) {
      dependencies.stdout(
        `${result.created ? "Created" : "Resumed"} draft ${result.workspace.draft.draftId} at revision ${result.workspace.draft.revision}\n`,
      );
    } else {
      dependencies.stderr(
        `${result.code}: ${result.issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}\n`,
      );
    }
    return result.ok ? 0 : 1;
  }

  if (command === "check") {
    const draftId = flagValue(flags, "--draft");
    if (draftId === undefined) {
      dependencies.stderr(checkUsage);
      return 2;
    }
    const result = await dependencies.authoring.check({ draftId });
    if (json) {
      dependencies.stdout(
        `${JSON.stringify(result.ok ? result.report : result)}\n`,
      );
    } else if (!result.ok) {
      dependencies.stderr(
        `${result.code}${result.issues.length === 0 ? "" : `: ${result.issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}`}\n`,
      );
    } else {
      dependencies.stdout(
        `${result.report.status.toUpperCase()} ${result.report.draftId} at revision ${result.report.draftRevision} (${result.report.findings.length} findings)\n`,
      );
      for (const finding of result.report.findings) {
        dependencies.stdout(
          `${finding.severity.toUpperCase()} ${finding.code} ${finding.path}: ${finding.message}\n`,
        );
      }
    }
    return result.ok && result.report.status === "ready" ? 0 : 1;
  }

  dependencies.stderr(`${prepareUsage}${checkUsage}`);
  return 2;
}
