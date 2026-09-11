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

/**
 * Accept either a generation bundle or the `template` command's own JSON result.
 *
 * `template --json` follows the CLI-wide `{ ok, ... }` result envelope and puts the
 * bundle under `template`, so the documented round trip — write the template to a
 * file, then apply it — would otherwise need the file hand-edited first. The
 * discriminator is the nested bundle fields, not the field name alone: a bundle
 * may legitimately carry its own `template` metadata.
 */
export function unwrapGenerationBundle(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const candidate = input as Record<string, unknown>;
  if (candidate["ok"] !== true) return input;
  const nested = candidate["template"];
  if (typeof nested !== "object" || nested === null) return input;
  const bundle = nested as Record<string, unknown>;
  return "context" in bundle && "generation" in bundle ? bundle : input;
}

const prepareUsage =
  "Usage: npm run reference:author -- prepare --id ID --kind KIND --slug SLUG --title TITLE [--reuse-from ID --reuse-facts ID[,ID...]] [--json]\n";
const contextUsage =
  "Usage: npm run reference:author -- context --draft ID --facts ID[,ID...] [--json]\n";
const templateUsage =
  "Usage: npm run reference:author -- template --draft ID --facts ID[,ID...] --kind section|summary|example [--heading HEADING | --example-id ID [--example-kind compile|run|expected-compile-failure] [--standard STANDARD]] [--json]\n";
const batchUsage =
  "Usage: npm run reference:author -- batch --input AUTHORING_BATCH.json [--json]\n";
const researchUsage =
  "Usage: npm run reference:author -- research --input AUTHORING_RESEARCH.json [--json]\n";
const repairPlanUsage =
  "Usage: npm run reference:author -- repair-plan --draft ID --id REPAIR_ID [--json]\n";
const repairUsage =
  "Usage: npm run reference:author -- repair --input AUTHORING_REPAIR.json [--json]\n";
const runUsage =
  "Usage: npm run reference:author -- run --input AUTHORING_RUN.json [--json]\n";
const applyGenerationUsage =
  "Usage: npm run reference:author -- apply-generation --input FILE [--json]  (FILE is a generation bundle, or a `template --json` result)\n";
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

async function readJsonCommandInput(
  dependencies: ReferenceAuthorCliDependencies,
  flags: readonly string[],
  usage: string,
  artifactLabel: string,
): Promise<
  | { readonly ok: true; readonly input: unknown }
  | { readonly ok: false; readonly exitCode: 2 | 3 }
> {
  const inputPath = flagValue(flags, "--input");
  if (inputPath === undefined) {
    dependencies.stderr(usage);
    return { ok: false, exitCode: 2 };
  }
  if (dependencies.readTextFile === undefined) {
    dependencies.stderr(`${artifactLabel} file reader is unavailable\n`);
    return { ok: false, exitCode: 3 };
  }
  try {
    return {
      ok: true,
      input: JSON.parse(await dependencies.readTextFile(inputPath)),
    };
  } catch (error) {
    dependencies.stderr(
      `Unable to read ${artifactLabel.toLowerCase()} input: ${error instanceof Error ? error.message : "invalid JSON"}\n`,
    );
    return { ok: false, exitCode: 2 };
  }
}

interface CliCommandFailure {
  readonly ok: false;
  readonly code: string;
  readonly issues: readonly {
    readonly path: string;
    readonly message: string;
  }[];
}

type CliCommandResult = { readonly ok: true } | CliCommandFailure;

function presentCommandResult<Result extends CliCommandResult>(
  dependencies: ReferenceAuthorCliDependencies,
  json: boolean,
  result: Result,
  presentSuccess: (success: Extract<Result, { readonly ok: true }>) => void,
): 0 | 1 {
  if (json) {
    dependencies.stdout(`${JSON.stringify(result)}\n`);
  } else if (!result.ok) {
    dependencies.stderr(
      `${result.code}${result.issues.length === 0 ? "" : `: ${result.issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}`}\n`,
    );
  } else {
    presentSuccess(result as Extract<Result, { readonly ok: true }>);
  }
  return result.ok ? 0 : 1;
}

export async function runReferenceAuthorCli(
  dependencies: ReferenceAuthorCliDependencies,
): Promise<number> {
  const [command, ...flags] = dependencies.argv;
  const json = flags.includes("--json");

  if (command === "repair-plan") {
    const draftId = flagValue(flags, "--draft");
    const repairId = flagValue(flags, "--id");
    if (draftId === undefined || repairId === undefined) {
      dependencies.stderr(repairPlanUsage);
      return 2;
    }
    const result = await dependencies.authoring.buildRepairPlan({
      draftId,
      repairId,
    });
    return presentCommandResult(dependencies, json, result, (success) => {
      if (success.status === "no_repairs") {
        dependencies.stdout(
          `NO REPAIRS ${draftId}: ${success.ignoredFindingDigests.length} findings require manual or infrastructure work\n`,
        );
      } else {
        dependencies.stdout(`${JSON.stringify(success.plan, null, 2)}\n`);
      }
    });
  }

  if (command === "repair") {
    const parsed = await readJsonCommandInput(
      dependencies,
      flags,
      repairUsage,
      "Authoring-repair",
    );
    if (!parsed.ok) return parsed.exitCode;
    const result = await dependencies.authoring.advanceRepair(parsed.input);
    return presentCommandResult(dependencies, json, result, (success) => {
      if (success.progress.status === "exhausted") {
        dependencies.stdout(
          `EXHAUSTED ${success.progress.repairId}: ${success.progress.exhaustedTargetIds.length} targets reached the retry limit\n`,
        );
      } else {
        dependencies.stdout(
          `REPAIR ${success.progress.repairId}: ${success.progress.next!.targetId} attempt ${success.progress.next!.attempt}/${success.progress.next!.maxAttempts}\n${JSON.stringify(success.progress.next!.template, null, 2)}\n`,
        );
      }
    });
  }

  if (command === "research") {
    const parsed = await readJsonCommandInput(
      dependencies,
      flags,
      researchUsage,
      "Authoring-research",
    );
    if (!parsed.ok) {
      return parsed.exitCode;
    }
    const result = await dependencies.authoring.proposeSourceFacts(
      parsed.input,
    );
    return presentCommandResult(dependencies, json, result, (success) => {
      const reusableFacts = success.proposal.factGroups.reduce(
        (count, fact) => count + fact.reusableFacts.length,
        0,
      );
      dependencies.stdout(
        `PROPOSAL ${success.proposal.draftId} at revision ${success.proposal.draftRevision}: ${success.proposal.sourceRecords.length} sources, ${success.proposal.factGroups.length} unverified facts, ${reusableFacts} reuse suggestions\n`,
      );
    });
  }

  if (command === "batch") {
    const parsed = await readJsonCommandInput(
      dependencies,
      flags,
      batchUsage,
      "Authoring-batch",
    );
    if (!parsed.ok) {
      return parsed.exitCode;
    }
    const result = await dependencies.authoring.advanceBatch(parsed.input);
    return presentCommandResult(dependencies, json, result, (success) => {
      const counts = {
        complete: success.progress.members.filter(
          ({ status }) => status === "complete",
        ).length,
        ready: success.progress.members.filter(
          ({ status }) => status === "awaiting_generation",
        ).length,
        waiting: success.progress.members.filter(
          ({ status }) => status === "awaiting_dependency",
        ).length,
        blocked: success.progress.members.filter(
          ({ status }) => status === "blocked",
        ).length,
      };
      dependencies.stdout(
        `BATCH ${success.progress.batchId}: ${success.progress.status} (${counts.complete} complete, ${counts.ready} ready, ${counts.waiting} waiting, ${counts.blocked} blocked)\n`,
      );
    });
  }

  if (command === "run") {
    const parsed = await readJsonCommandInput(
      dependencies,
      flags,
      runUsage,
      "Authoring-run",
    );
    if (!parsed.ok) {
      return parsed.exitCode;
    }
    const result = await dependencies.authoring.advanceRun(parsed.input);
    return presentCommandResult(dependencies, json, result, (success) => {
      if (success.progress.status === "complete") {
        dependencies.stdout(
          `COMPLETE ${success.progress.runId}: ${success.progress.completedStepIds.length} generation steps at revision ${success.progress.currentRevision}\n`,
        );
      } else {
        dependencies.stdout(
          `NEXT ${success.progress.runId}: ${success.progress.next.stepId} at revision ${success.progress.currentRevision}\n`,
        );
      }
    });
  }

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
    const bundle = unwrapGenerationBundle(input);
    const result = await dependencies.authoring.applyGenerationBundle(bundle);
    const generationKind =
      bundle !== null && typeof bundle === "object" && "generation" in bundle
        ? authoringGenerationKind(bundle.generation)
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
        // The check result says `ok: true` because the check itself succeeded,
        // which would tell a JSON consumer that publication succeeded while the
        // exit code says it did not. Report the refusal instead.
        if (json) {
          dependencies.stdout(
            `${JSON.stringify(
              checked.ok
                ? {
                    ok: false,
                    code: "draft_not_ready",
                    report: checked.report,
                  }
                : { ok: false, code: checked.code, issues: checked.issues },
            )}\n`,
          );
        } else {
          dependencies.stderr(
            `${checked.ok ? "draft_not_ready" : checked.code}\n`,
          );
        }
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
    `${prepareUsage}${contextUsage}${templateUsage}${researchUsage}${repairPlanUsage}${repairUsage}${batchUsage}${runUsage}${applyGenerationUsage}${measureUsage}${checkUsage}${previewUsage}${publishUsage}`,
  );
  return 2;
}
