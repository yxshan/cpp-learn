import {
  REFERENCE_ENTRY_KINDS,
  type ReferenceEntryKind,
} from "@cpp-learn/contracts";
import type {
  DraftWorkspace,
  ReferenceAuthoring,
} from "@cpp-learn/reference-authoring";

export interface ReferenceAuthorPreviewAdapter {
  render(workspace: DraftWorkspace): Promise<string>;
}

export interface ReferenceAuthorCliDependencies {
  readonly argv: readonly string[];
  readonly authoring: ReferenceAuthoring;
  readonly preview?: ReferenceAuthorPreviewAdapter;
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

const prepareUsage =
  "Usage: npm run reference:author -- prepare --id ID --kind KIND --slug SLUG --title TITLE [--json]\n";
const checkUsage =
  "Usage: npm run reference:author -- check --draft ID [--json]\n";
const previewUsage =
  "Usage: npm run reference:author -- preview --draft ID [--json]\n";
const publishUsage =
  "Usage: npm run reference:author -- publish --draft ID --revision NUMBER [--apply] [--json]\n";

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
      dependencies.stdout(`${JSON.stringify(result)}\n`);
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
      dependencies.stdout(`${JSON.stringify(result)}\n`);
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
          `${finding.severity.toUpperCase()} [${finding.risk.toUpperCase()}] ${finding.code} ${finding.path}: ${finding.message}\n`,
        );
      }
    }
    return result.ok ? 0 : 1;
  }

  if (command === "preview") {
    const draftId = flagValue(flags, "--draft");
    if (draftId === undefined || dependencies.preview === undefined) {
      dependencies.stderr(previewUsage);
      return 2;
    }
    const result = await dependencies.authoring.check({ draftId });
    if (!result.ok) {
      if (json) dependencies.stdout(`${JSON.stringify(result)}\n`);
      else dependencies.stderr(`${result.code}\n`);
      return 1;
    }
    try {
      const path = await dependencies.preview.render(result.workspace);
      if (json) {
        dependencies.stdout(
          `${JSON.stringify({ ok: true, draftId, path, report: result.report })}\n`,
        );
      } else {
        dependencies.stdout(`Preview written to ${path}\n`);
      }
      return 0;
    } catch (error) {
      dependencies.stderr(
        `preview_failed: ${error instanceof Error ? error.message : "unknown error"}\n`,
      );
      return 1;
    }
  }

  if (command === "publish") {
    const draftId = flagValue(flags, "--draft");
    const revisionText = flagValue(flags, "--revision");
    const expectedRevision = Number(revisionText);
    if (
      draftId === undefined ||
      revisionText === undefined ||
      !Number.isInteger(expectedRevision) ||
      expectedRevision < 1
    ) {
      dependencies.stderr(publishUsage);
      return 2;
    }
    const result = await dependencies.authoring.publish({
      draftId,
      expectedRevision,
      mode: flags.includes("--apply") ? "apply" : "dry_run",
    });
    if (json) {
      dependencies.stdout(`${JSON.stringify(result)}\n`);
    } else if (!result.ok) {
      dependencies.stderr(
        `${result.code}${result.issues.length === 0 ? "" : `: ${result.issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}`}\n`,
      );
    } else {
      dependencies.stdout(
        `${result.applied ? "PUBLISHED" : "DRY RUN"} ${result.plan.draftId} at revision ${result.plan.expectedRevision} (${result.plan.files.length} file changes)\n`,
      );
      for (const file of result.plan.files) {
        dependencies.stdout(
          `${file.operation.toUpperCase()} ${file.path} ${file.digest}${file.previousDigest === undefined ? "" : ` (was ${file.previousDigest})`}\n`,
        );
      }
    }
    return result.ok ? 0 : 1;
  }

  dependencies.stderr(
    `${prepareUsage}${checkUsage}${previewUsage}${publishUsage}`,
  );
  return 2;
}
