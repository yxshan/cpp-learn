import {
  CPP_STANDARDS,
  REFERENCE_ENTRY_KINDS,
  type CppStandard,
  type ReferenceEntryKind,
} from "@cpp-learn/contracts";
import type {
  DraftWorkspace,
  ReferenceAuthoring,
} from "@cpp-learn/reference-authoring";
import { authoringGenerationKind } from "@cpp-learn/reference-authoring";

export interface ReferenceAuthorPreviewAdapter {
  render(workspace: DraftWorkspace): Promise<string>;
}

export interface ReferenceAuthorCliDependencies {
  readonly argv: readonly string[];
  readonly authoring: ReferenceAuthoring;
  readonly preview?: ReferenceAuthorPreviewAdapter;
  readonly readTextFile?: (path: string) => Promise<string>;
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

const prepareUsage =
  "Usage: npm run reference:author -- prepare --id ID --kind KIND --slug SLUG --title TITLE [--reuse-from ID --reuse-facts ID[,ID...]] [--json]\n";
const contextUsage =
  "Usage: npm run reference:author -- context --draft ID --facts ID[,ID...] [--json]\n";
const templateUsage =
  "Usage: npm run reference:author -- template --draft ID --facts ID[,ID...] --kind section|summary|example [--heading HEADING | --example-id ID [--example-kind compile|run|expected-compile-failure] [--standard STANDARD]] [--json]\n";
const applyGenerationUsage =
  "Usage: npm run reference:author -- apply-generation --input FILE [--json]\n";
const measureUsage =
  "Usage: npm run reference:author -- measure --batch ID --drafts ID[,ID...] --active-minutes N --machine-minutes N --gate-minutes N --baseline-active-minutes N --baseline-entries N --pre-factual-corrections N --pre-example-corrections N --post-factual-corrections N --post-example-corrections N --baseline-factual-corrections N --baseline-example-corrections N --high-risk-reviewed N [--flaky-reruns N] [--json]\n";
const checkUsage =
  "Usage: npm run reference:author -- check --draft ID [--json]\n";
const previewUsage =
  "Usage: npm run reference:author -- preview --draft ID [--json]\n";
const publishUsage =
  "Usage: npm run reference:author -- publish --draft ID [--revision NUMBER] [--dry-run | --apply] [--json]\n";

function flagValue(flags: readonly string[], name: string): string | undefined {
  const index = flags.indexOf(name);
  return index >= 0 ? flags[index + 1] : undefined;
}

function isReferenceEntryKind(value: string): value is ReferenceEntryKind {
  return REFERENCE_ENTRY_KINDS.some((kind) => kind === value);
}

function isCppStandard(value: string): value is CppStandard {
  return CPP_STANDARDS.some((standard) => standard === value);
}

export async function runReferenceAuthorCli(
  dependencies: ReferenceAuthorCliDependencies,
): Promise<number> {
  const [command, ...flags] = dependencies.argv;
  const json = flags.includes("--json");

  if (command === "template") {
    const draftId = flagValue(flags, "--draft");
    const factGroupIds = flagValue(flags, "--facts")
      ?.split(",")
      .filter((id) => id.length > 0);
    const kind = flagValue(flags, "--kind");
    const heading = flagValue(flags, "--heading");
    const exampleId = flagValue(flags, "--example-id");
    const exampleKind = flagValue(flags, "--example-kind");
    const standard = flagValue(flags, "--standard");
    if (
      draftId === undefined ||
      factGroupIds === undefined ||
      factGroupIds.length === 0 ||
      (kind !== "section" && kind !== "summary" && kind !== "example") ||
      (kind === "section" && heading === undefined) ||
      (kind === "example" && exampleId === undefined) ||
      (kind === "section" &&
        (exampleId !== undefined ||
          exampleKind !== undefined ||
          standard !== undefined)) ||
      (kind === "summary" &&
        (heading !== undefined ||
          exampleId !== undefined ||
          exampleKind !== undefined ||
          standard !== undefined)) ||
      (kind === "example" && heading !== undefined) ||
      (exampleKind !== undefined &&
        exampleKind !== "compile" &&
        exampleKind !== "run" &&
        exampleKind !== "expected-compile-failure") ||
      (standard !== undefined && !isCppStandard(standard))
    ) {
      dependencies.stderr(templateUsage);
      return 2;
    }
    const result =
      kind === "section" && heading !== undefined
        ? await dependencies.authoring.buildGenerationTemplate({
            draftId,
            factGroupIds,
            kind,
            heading,
          })
        : kind === "example" && exampleId !== undefined
          ? await dependencies.authoring.buildGenerationTemplate({
              draftId,
              factGroupIds,
              kind,
              exampleId,
              ...(exampleKind === undefined ? {} : { exampleKind }),
              ...(standard === undefined ? {} : { standard }),
            })
          : await dependencies.authoring.buildGenerationTemplate({
              draftId,
              factGroupIds,
              kind: "summary",
            });
    if (json) {
      dependencies.stdout(`${JSON.stringify(result)}\n`);
    } else if (!result.ok) {
      dependencies.stderr(
        `${result.code}${result.issues.length === 0 ? "" : `: ${result.issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}`}\n`,
      );
    } else {
      dependencies.stdout(`${JSON.stringify(result.template, null, 2)}\n`);
    }
    return result.ok ? 0 : 1;
  }

  if (command === "apply-generation") {
    const inputPath = flagValue(flags, "--input");
    if (inputPath === undefined) {
      dependencies.stderr(applyGenerationUsage);
      return 2;
    }
    if (dependencies.readTextFile === undefined) {
      dependencies.stderr("Generated-section file reader is unavailable\n");
      return 3;
    }
    let input: unknown;
    try {
      input = JSON.parse(await dependencies.readTextFile(inputPath));
    } catch (error) {
      dependencies.stderr(
        `Unable to read generated-section input: ${error instanceof Error ? error.message : "invalid JSON"}\n`,
      );
      return 2;
    }
    const result = await dependencies.authoring.applyGenerationBundle(input);
    const generationKind =
      input !== null && typeof input === "object" && "generation" in input
        ? authoringGenerationKind(input.generation)
        : "unknown";
    if (json) {
      dependencies.stdout(`${JSON.stringify(result)}\n`);
    } else if (!result.ok) {
      dependencies.stderr(
        `${result.code}${result.issues.length === 0 ? "" : `: ${result.issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}`}\n`,
      );
    } else {
      dependencies.stdout(
        `Applied generated ${generationKind === "unknown" ? "content" : generationKind} to ${result.workspace.draft.draftId} at revision ${result.workspace.draft.revision} (${result.receiptPath})\n`,
      );
    }
    return result.ok ? 0 : 1;
  }

  if (command === "context") {
    const draftId = flagValue(flags, "--draft");
    const factList = flagValue(flags, "--facts");
    const factGroupIds = factList?.split(",").filter((id) => id.length > 0);
    if (
      draftId === undefined ||
      factGroupIds === undefined ||
      factGroupIds.length === 0
    ) {
      dependencies.stderr(contextUsage);
      return 2;
    }
    const result = await dependencies.authoring.buildContext({
      draftId,
      factGroupIds,
    });
    if (json) {
      dependencies.stdout(`${JSON.stringify(result)}\n`);
    } else if (!result.ok) {
      dependencies.stderr(
        `${result.code}${result.issues.length === 0 ? "" : `: ${result.issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}`}\n`,
      );
    } else {
      dependencies.stdout(
        `CONTEXT ${result.pack.draftId} at revision ${result.pack.draftRevision} (${result.pack.factGroups.length} facts, ${result.pack.sources.length} sources) ${result.pack.digest}\n`,
      );
    }
    return result.ok ? 0 : 1;
  }

  if (command === "measure") {
    const batchId = flagValue(flags, "--batch");
    const draftIds = flagValue(flags, "--drafts")
      ?.split(",")
      .filter((id) => id.length > 0);
    const authorActiveMinutes = Number(flagValue(flags, "--active-minutes"));
    const machineMinutes = Number(flagValue(flags, "--machine-minutes"));
    const fullGateMinutes = Number(flagValue(flags, "--gate-minutes"));
    const baselineAuthorActiveMinutes = Number(
      flagValue(flags, "--baseline-active-minutes"),
    );
    const baselineEntries = Number(flagValue(flags, "--baseline-entries"));
    const preFactualCorrections = Number(
      flagValue(flags, "--pre-factual-corrections"),
    );
    const preExampleCorrections = Number(
      flagValue(flags, "--pre-example-corrections"),
    );
    const postFactualCorrections = Number(
      flagValue(flags, "--post-factual-corrections"),
    );
    const postExampleCorrections = Number(
      flagValue(flags, "--post-example-corrections"),
    );
    const baselineFactualCorrections = Number(
      flagValue(flags, "--baseline-factual-corrections"),
    );
    const baselineExampleCorrections = Number(
      flagValue(flags, "--baseline-example-corrections"),
    );
    const highRiskClaimsReviewed = Number(
      flagValue(flags, "--high-risk-reviewed"),
    );
    const flakyReruns = Number(flagValue(flags, "--flaky-reruns") ?? "0");
    const durations = [
      authorActiveMinutes,
      machineMinutes,
      fullGateMinutes,
      baselineAuthorActiveMinutes,
    ];
    const counters = [
      preFactualCorrections,
      preExampleCorrections,
      postFactualCorrections,
      postExampleCorrections,
      baselineFactualCorrections,
      baselineExampleCorrections,
      highRiskClaimsReviewed,
      flakyReruns,
    ];
    if (
      batchId === undefined ||
      draftIds === undefined ||
      draftIds.length === 0 ||
      durations.some((value) => !Number.isFinite(value) || value < 0) ||
      counters.some((value) => !Number.isInteger(value) || value < 0) ||
      !Number.isInteger(baselineEntries) ||
      baselineEntries < 1
    ) {
      dependencies.stderr(measureUsage);
      return 2;
    }
    const result = await dependencies.authoring.measureBatch({
      batchId,
      draftIds,
      timing: {
        authorActiveMinutes,
        machineMinutes,
        fullGateMinutes,
        baselineAuthorActiveMinutes,
        baselineEntries,
      },
      quality: {
        prePublicationCorrections: {
          factual: preFactualCorrections,
          example: preExampleCorrections,
        },
        postPublicationCorrections: {
          factual: postFactualCorrections,
          example: postExampleCorrections,
        },
        baselinePostPublicationCorrections: {
          factual: baselineFactualCorrections,
          example: baselineExampleCorrections,
        },
        highRiskClaimsReviewed,
        flakyReruns,
      },
    });
    if (json) {
      dependencies.stdout(`${JSON.stringify(result)}\n`);
    } else if (!result.ok) {
      dependencies.stderr(
        `${result.code}${result.issues.length === 0 ? "" : `: ${result.issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}`}\n`,
      );
    } else {
      dependencies.stdout(
        `${result.report.status.toUpperCase()} ${result.report.batchId}: ${result.report.readyEntries}/${result.report.entries} ready, ${result.report.timing.authorActiveMinutes} active minutes, ${(result.report.cache.hitRate * 100).toFixed(0)}% cache hits\n`,
      );
    }
    return result.ok ? 0 : 1;
  }

  if (command === "prepare") {
    const entryId = flagValue(flags, "--id");
    const kind = flagValue(flags, "--kind");
    const slug = flagValue(flags, "--slug");
    const title = flagValue(flags, "--title");
    const reuseFrom = flagValue(flags, "--reuse-from");
    const reuseFactList = flagValue(flags, "--reuse-facts");
    const reuseFactGroupIds = reuseFactList
      ?.split(",")
      .filter((id) => id.length > 0);
    if (
      entryId === undefined ||
      kind === undefined ||
      !isReferenceEntryKind(kind) ||
      slug === undefined ||
      title === undefined ||
      (reuseFrom === undefined) !== (reuseFactList === undefined) ||
      (reuseFactList !== undefined && reuseFactGroupIds?.length === 0)
    ) {
      dependencies.stderr(prepareUsage);
      return 2;
    }
    const result = await dependencies.authoring.prepare({
      target: { entryId, kind, slug, title },
      ...(reuseFrom === undefined || reuseFactGroupIds === undefined
        ? {}
        : {
            reuse: {
              draftId: reuseFrom,
              factGroupIds: reuseFactGroupIds,
            },
          }),
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
    const apply = flags.includes("--apply");
    const explicitDryRun = flags.includes("--dry-run");
    let expectedRevision = Number(revisionText);
    if (
      draftId === undefined ||
      (apply && explicitDryRun) ||
      (revisionText !== undefined &&
        (!Number.isInteger(expectedRevision) || expectedRevision < 1)) ||
      (apply && revisionText === undefined)
    ) {
      dependencies.stderr(publishUsage);
      return 2;
    }
    if (revisionText === undefined) {
      const checked = await dependencies.authoring.check({ draftId });
      if (!checked.ok || checked.report.status !== "ready") {
        if (json) dependencies.stdout(`${JSON.stringify(checked)}\n`);
        else
          dependencies.stderr(
            `${checked.ok ? "draft_not_ready" : checked.code}\n`,
          );
        return 1;
      }
      expectedRevision = checked.report.draftRevision;
    }
    const result = await dependencies.authoring.publish({
      draftId,
      expectedRevision,
      mode: apply ? "apply" : "dry_run",
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
          `${file.operation.toUpperCase()} ${file.path} ${file.digest ?? "<deleted>"}${file.previousDigest === undefined ? "" : ` (was ${file.previousDigest})`}\n`,
        );
      }
    }
    return result.ok ? 0 : 1;
  }

  dependencies.stderr(
    `${prepareUsage}${contextUsage}${templateUsage}${applyGenerationUsage}${measureUsage}${checkUsage}${previewUsage}${publishUsage}`,
  );
  return 2;
}
