import type { ReferenceExampleManifest } from "@cpp-learn/reference";

import type {
  AuthoringValidationCache,
  AuthoringValidationCacheValue,
} from "../cache.ts";
import { authoringInputDigest } from "../digest.ts";
import { jsonFile } from "../draft.ts";
import {
  authoringGenerationKind,
  replaceMarkdownSection,
  validateAuthoringExampleGeneration,
  validateAuthoringSectionGeneration,
  validateAuthoringSummaryGeneration,
  type AuthoringGeneration,
  type AuthoringGenerationClaim,
} from "../generation.ts";
import { exampleTemplate, PROFILE_DEFINITIONS } from "../profiles.ts";
import {
  sameFactGroupAllowlist,
  type AuthoringGenerationOrchestration,
} from "../run.ts";
import {
  validateAuthoringContextPack,
  validateAuthoringGenerationBundleTemplate,
  validateAuthoringGenerationReceipt,
} from "../validation.ts";

import type {
  ApplyGeneratedContentFailure,
  ApplyGeneratedContentFailureCode,
  ApplyGeneratedContentSuccess,
  ApplyGeneratedExampleRequest,
  ApplyGeneratedExampleResult,
  ApplyGeneratedSectionRequest,
  ApplyGeneratedSectionResult,
  ApplyGeneratedSummaryRequest,
  ApplyGeneratedSummaryResult,
  ApplyGenerationBundleResult,
  AuthoringContextPack,
  AuthoringDraftManifest,
  AuthoringExampleValidator,
  AuthoringGenerationReceipt,
  AuthoringGenerationTemplateMetadata,
  AuthoringReport,
  AuthoringValidationIssue,
  DraftWorkspace,
  ReferenceDraftRepository,
  ReviewGeneratedClaimsRequest,
  ReviewGeneratedClaimsResult,
} from "../index.ts";

/**
 * Generation application.
 *
 * Applying accepted AI output is one workflow: review the declared claims
 * against a rebuilt context, re-check the draft revision, mutate one generated
 * artifact, write a Generation Receipt, and commit the whole snapshot. The four
 * operations are produced together because they share that pipeline — and its
 * failure modes — through `applyGeneratedContent`.
 */
type GeneratedContentMutationResult<Code extends string> =
  GeneratedContentMutation | ApplyGeneratedContentFailure<Code>;

function generatedRequestFailure(
  context: AuthoringContextPack,
  expectedRevision: number,
  generation: AuthoringGeneration,
  generationIssues: readonly AuthoringValidationIssue[],
): ApplyGeneratedContentFailure<"invalid_request"> | undefined {
  const contextIssues = validateAuthoringContextPack(context);
  if (contextIssues.length > 0) {
    return {
      ok: false,
      code: "invalid_request",
      issues: contextIssues.map((issue) => ({
        ...issue,
        path: `/context${issue.path === "/" ? "" : issue.path}`,
      })),
    };
  }
  if (generationIssues.length > 0) {
    return {
      ok: false,
      code: "invalid_request",
      issues: generationIssues.map((issue) => ({
        ...issue,
        path: `/generation${issue.path === "/" ? "" : issue.path}`,
      })),
    };
  }
  if (
    !Number.isInteger(expectedRevision) ||
    expectedRevision < 1 ||
    generation.draftId !== context.draftId ||
    generation.contextDigest !== context.digest
  ) {
    return {
      ok: false,
      code: "invalid_request",
      issues: [
        {
          path: "/generation",
          message:
            "Generation identity, context digest, and positive expected revision must match the supplied context",
          keyword: "request",
        },
      ],
    };
  }
  return undefined;
}

interface GeneratedContentMutation {
  readonly ok: true;
  readonly files: Readonly<Record<string, string>>;
}

export interface GenerationApplyContext {
  readonly drafts: ReferenceDraftRepository;
  readonly examples: AuthoringExampleValidator | undefined;
  readonly cache: AuthoringValidationCache | undefined;
  readonly clock: () => Date;
  /** Resolved lazily: `reviewGeneratedClaims` is a sibling facade operation. */
  readonly reviewGeneratedClaims: (
    request: ReviewGeneratedClaimsRequest,
  ) => Promise<ReviewGeneratedClaimsResult>;
}

export interface GenerationApplyOperations {
  readonly applyGenerationBundle: (
    request: unknown,
  ) => Promise<ApplyGenerationBundleResult>;
  readonly applyGeneratedExample: (
    request: ApplyGeneratedExampleRequest,
  ) => Promise<ApplyGeneratedExampleResult>;
  readonly applyGeneratedSummary: (
    request: ApplyGeneratedSummaryRequest,
  ) => Promise<ApplyGeneratedSummaryResult>;
  readonly applyGeneratedSection: (
    request: ApplyGeneratedSectionRequest,
  ) => Promise<ApplyGeneratedSectionResult>;
}

export function createGenerationApplyOperations(
  context: GenerationApplyContext,
): GenerationApplyOperations {
  async function applyGeneratedContent<Code extends string>(options: {
    readonly context: AuthoringContextPack;
    readonly expectedRevision: number;
    readonly generation: AuthoringGeneration;
    readonly orchestration?: AuthoringGenerationOrchestration;
    readonly claims: readonly AuthoringGenerationClaim[];
    readonly claimPath: string;
    readonly writeFailureMessage: string;
    readonly materialize: (
      workspace: DraftWorkspace,
    ) => Promise<GeneratedContentMutationResult<Code>>;
    readonly reportPatch?: (
      workspace: DraftWorkspace,
      receiptPath: string,
      nextRevision: number,
    ) => Partial<Pick<AuthoringReport, "generatedSections">>;
  }): Promise<
    | ApplyGeneratedContentSuccess
    | ApplyGeneratedContentFailure<ApplyGeneratedContentFailureCode | Code>
  > {
    if (
      options.orchestration !== undefined &&
      !sameFactGroupAllowlist(
        options.orchestration.factGroupIds,
        options.context.policy.allowedFactGroupIds,
      )
    ) {
      return {
        ok: false,
        code: "invalid_request",
        issues: [
          {
            path: "/orchestration/factGroupIds",
            message:
              "Run step fact allowlist must match the generation context",
            keyword: "fact-context-mismatch",
          },
        ],
      };
    }
    const reviewed = await context.reviewGeneratedClaims({
      context: options.context,
      claims: options.claims,
    });
    if (!reviewed.ok) {
      return {
        ok: false,
        code:
          reviewed.code === "draft_not_found"
            ? "draft_not_found"
            : "context_changed",
        issues: reviewed.issues,
      };
    }
    if (reviewed.review.status === "requires-review") {
      return {
        ok: false,
        code: "generation_blocked",
        issues: reviewed.review.reviewQueue.map((item, index) => ({
          path: `${options.claimPath}/${index}`,
          message: `Generated claim ${item.claimId} requires review: ${item.reason}`,
          keyword: item.reason,
        })),
        review: reviewed.review,
      };
    }
    let workspace: DraftWorkspace | undefined;
    try {
      workspace = await context.drafts.get(options.context.draftId);
    } catch (error) {
      return {
        ok: false,
        code: "draft_unreadable",
        issues: [
          {
            path: "/context/draftId",
            message:
              error instanceof Error ? error.message : "Draft is unreadable",
            keyword: "read",
          },
        ],
      };
    }
    if (workspace === undefined) {
      return { ok: false, code: "draft_not_found", issues: [] };
    }
    if (
      workspace.draft.revision !== options.expectedRevision ||
      options.context.draftRevision !== options.expectedRevision
    ) {
      return { ok: false, code: "revision_conflict", issues: [] };
    }
    if (authoringInputDigest(workspace.files) !== options.context.inputDigest) {
      return {
        ok: false,
        code: "context_changed",
        issues: [
          {
            path: "/context/inputDigest",
            message:
              "The draft authoring input changed after the context pack was reviewed",
            keyword: "digest",
          },
        ],
      };
    }
    const mutation = await options.materialize(workspace);
    if (!mutation.ok) return mutation;
    const nextRevision = workspace.draft.revision + 1;
    const draft: AuthoringDraftManifest = {
      ...workspace.draft,
      revision: nextRevision,
      state: "draft",
      updatedAt: context.clock().toISOString(),
    };
    const receiptPath = `generation/revision-${nextRevision}.json`;
    const receipt = {
      schemaVersion: 1,
      draftId: draft.draftId,
      appliedRevision: nextRevision,
      contextDigest: options.context.digest,
      ...(options.orchestration === undefined
        ? {}
        : { orchestration: options.orchestration }),
      generation: options.generation,
      review: reviewed.review,
      appliedAt: draft.updatedAt,
    } as AuthoringGenerationReceipt;
    const receiptIssues = validateAuthoringGenerationReceipt(receipt);
    if (receiptIssues.length > 0) {
      return {
        ok: false,
        code: "invalid_request",
        issues: receiptIssues.map((issue) => ({
          ...issue,
          path: `/receipt${issue.path === "/" ? "" : issue.path}`,
        })),
      };
    }
    const files = {
      ...workspace.files,
      ...mutation.files,
      "draft.json": jsonFile(draft),
      [receiptPath]: jsonFile(receipt),
    };
    const report: AuthoringReport = {
      ...workspace.report,
      draftRevision: nextRevision,
      inputDigest: authoringInputDigest(files),
      status: "not_checked",
      findings: [],
      reviewQueue: [],
      cacheEvidence: [],
      ...(options.reportPatch?.(workspace, receiptPath, nextRevision) ?? {}),
    };
    const nextWorkspace: DraftWorkspace = {
      ...workspace,
      draft,
      report,
      files: { ...files, "report.json": jsonFile(report) },
    };
    let committed: boolean;
    try {
      committed = await context.drafts.commitWorkspace({
        draftId: draft.draftId,
        expectedRevision: options.expectedRevision,
        expectedFiles: workspace.files,
        workspace: nextWorkspace,
      });
    } catch (error) {
      return {
        ok: false,
        code: "write_failed",
        issues: [
          {
            path: "/draft",
            message:
              error instanceof Error
                ? error.message
                : options.writeFailureMessage,
            keyword: "write",
          },
        ],
      };
    }
    if (!committed) {
      return { ok: false, code: "write_conflict", issues: [] };
    }
    return {
      ok: true,
      workspace: nextWorkspace,
      review: reviewed.review,
      receiptPath,
    };
  }

  async function applyGenerationBundle(
    request: unknown,
  ): Promise<ApplyGenerationBundleResult> {
    if (request === null || typeof request !== "object") {
      return {
        ok: false,
        code: "invalid_request",
        issues: [
          {
            path: "/",
            message:
              "Generation bundle requires context, expectedRevision, and generation",
            keyword: "required",
          },
        ],
      };
    }
    const unknownFields = Object.keys(request).filter(
      (field) =>
        field !== "template" &&
        field !== "orchestration" &&
        field !== "context" &&
        field !== "expectedRevision" &&
        field !== "generation",
    );
    if (unknownFields.length > 0) {
      return {
        ok: false,
        code: "invalid_request",
        issues: unknownFields.map((field) => ({
          path: `/${field}`,
          message: "Unknown generation bundle field",
          keyword: "additionalProperties",
        })),
      };
    }
    if (
      !("context" in request) ||
      !("expectedRevision" in request) ||
      !("generation" in request)
    ) {
      return {
        ok: false,
        code: "invalid_request",
        issues: [
          {
            path: "/",
            message:
              "Generation bundle requires context, expectedRevision, and generation",
            keyword: "required",
          },
        ],
      };
    }
    const bundle = request as {
      readonly template?: AuthoringGenerationTemplateMetadata;
      readonly orchestration?: AuthoringGenerationOrchestration;
      readonly context: AuthoringContextPack;
      readonly expectedRevision: number;
      readonly generation: AuthoringGeneration;
    };
    if (bundle.orchestration !== undefined && bundle.template === undefined) {
      return {
        ok: false,
        code: "invalid_request",
        issues: [
          {
            path: "/orchestration",
            message:
              "Orchestration metadata is accepted only on a generation template",
            keyword: "dependency",
          },
        ],
      };
    }
    if (bundle.template !== undefined) {
      const templateIssues = validateAuthoringGenerationBundleTemplate(bundle);
      if (templateIssues.length > 0) {
        return {
          ok: false,
          code: "invalid_request",
          issues: templateIssues,
        };
      }
      if (bundle.template.status !== "ready") {
        return {
          ok: false,
          code: "invalid_request",
          issues: [
            {
              path: "/template/status",
              message:
                "Generation template must be completed and marked ready before apply",
              keyword: "template-incomplete",
            },
          ],
        };
      }
    }
    const kind = authoringGenerationKind(bundle.generation);
    if (kind === "unknown") {
      return {
        ok: false,
        code: "invalid_request",
        issues: [
          {
            path: "/generation",
            message:
              "Generation must contain exactly one section, summary, or example member",
            keyword: "generation-kind",
          },
        ],
      };
    }
    const generationIssues =
      kind === "section"
        ? validateAuthoringSectionGeneration(bundle.generation)
        : kind === "summary"
          ? validateAuthoringSummaryGeneration(bundle.generation)
          : validateAuthoringExampleGeneration(bundle.generation);
    if (generationIssues.length > 0) {
      return {
        ok: false,
        code: "invalid_request",
        issues: generationIssues.map((issue) => ({
          ...issue,
          path: `/generation${issue.path === "/" ? "" : issue.path}`,
        })),
      };
    }
    return kind === "section"
      ? applyGeneratedSection(bundle as ApplyGeneratedSectionRequest)
      : kind === "summary"
        ? applyGeneratedSummary(bundle as ApplyGeneratedSummaryRequest)
        : applyGeneratedExample(bundle as ApplyGeneratedExampleRequest);
  }
  async function applyGeneratedExample(
    request: ApplyGeneratedExampleRequest,
  ): Promise<ApplyGeneratedExampleResult> {
    const requestFailure = generatedRequestFailure(
      request.context,
      request.expectedRevision,
      request.generation,
      validateAuthoringExampleGeneration(request.generation),
    );
    if (requestFailure !== undefined) return requestFailure;

    return applyGeneratedContent<
      | "invalid_request"
      | "draft_unreadable"
      | "example_validator_unavailable"
      | "example_validation_failed"
      | "example_invalid"
    >({
      context: request.context,
      expectedRevision: request.expectedRevision,
      generation: request.generation,
      ...(request.orchestration === undefined
        ? {}
        : { orchestration: request.orchestration }),
      claims: request.generation.example.claims,
      claimPath: "/generation/example/claims",
      writeFailureMessage: "Generated example could not be committed",
      async materialize(workspace) {
        const entrySource = workspace.files["entry.json"];
        let entry: Record<string, unknown>;
        try {
          const parsed = JSON.parse(entrySource ?? "null") as unknown;
          if (
            parsed === null ||
            typeof parsed !== "object" ||
            Array.isArray(parsed)
          ) {
            throw new Error("Candidate Entry must be a JSON object");
          }
          entry = parsed as Record<string, unknown>;
        } catch (error) {
          return {
            ok: false,
            code: "draft_unreadable",
            issues: [
              {
                path: "/entry.json",
                message:
                  error instanceof Error
                    ? error.message
                    : "Candidate Entry is unreadable",
                keyword: "parse",
              },
            ],
          };
        }
        const candidateExamples = entry["examples"];
        const readableExamples =
          Array.isArray(candidateExamples) &&
          candidateExamples.every(
            (candidate) =>
              candidate !== null &&
              typeof candidate === "object" &&
              typeof (candidate as Record<string, unknown>)["id"] ===
                "string" &&
              typeof (candidate as Record<string, unknown>)["path"] ===
                "string",
          ) &&
          new Set(
            candidateExamples.map(
              (candidate) =>
                (candidate as Record<string, unknown>)["id"] as string,
            ),
          ).size === candidateExamples.length;
        if (
          entry["schemaVersion"] !== 2 ||
          entry["id"] !== workspace.draft.target.entryId ||
          !readableExamples
        ) {
          return {
            ok: false,
            code: "draft_unreadable",
            issues: [
              {
                path: "/entry.json/examples",
                message:
                  "Candidate Entry schema, identity, and examples must match the Authoring Draft",
                keyword: "identity",
              },
            ],
          };
        }
        if (context.examples === undefined) {
          return {
            ok: false,
            code: "example_validator_unavailable",
            issues: [
              {
                path: "/generation/example/source",
                message: "No bounded Reference Example validator is configured",
                keyword: "validator",
              },
            ],
          };
        }
        const proposedExample = request.generation.example;
        const { source } = proposedExample;
        const examplePath = `${workspace.draft.targetPaths.examples}/${proposedExample.id}.cpp`;
        const localPath = `examples/${proposedExample.id}.cpp`;
        const example: ReferenceExampleManifest = {
          id: proposedExample.id,
          path: examplePath,
          kind: proposedExample.kind,
          standard: proposedExample.standard,
          ...(proposedExample.stdin === undefined
            ? {}
            : { stdin: proposedExample.stdin }),
          ...(proposedExample.expectedStdout === undefined
            ? {}
            : { expectedStdout: proposedExample.expectedStdout }),
          ...(proposedExample.expectedDiagnosticCategory === undefined
            ? {}
            : {
                expectedDiagnosticCategory:
                  proposedExample.expectedDiagnosticCategory,
              }),
        };
        const currentExamples = candidateExamples as ReferenceExampleManifest[];
        const existingIndex = currentExamples.findIndex(
          (candidate) => candidate.id === example.id,
        );
        const scaffoldLabel = PROFILE_DEFINITIONS[
          workspace.draft.profile
        ].examples.find((label) => label === example.id);
        const currentSource = workspace.files[localPath];
        const untouchedScaffold =
          scaffoldLabel !== undefined &&
          currentSource === exampleTemplate(scaffoldLabel);
        if (
          (existingIndex >= 0 &&
            currentExamples[existingIndex]!.path !== examplePath) ||
          (existingIndex < 0 &&
            currentSource !== undefined &&
            !untouchedScaffold)
        ) {
          return {
            ok: false,
            code: "invalid_request",
            issues: [
              {
                path: "/generation/example/id",
                message:
                  "Generated example would overwrite an unregistered or differently mapped source file",
                keyword: "file-conflict",
              },
            ],
          };
        }
        if (
          currentExamples.some(
            (candidate) =>
              candidate.path === examplePath && candidate.id !== example.id,
          )
        ) {
          return {
            ok: false,
            code: "invalid_request",
            issues: [
              {
                path: "/generation/example/id",
                message:
                  "Generated example path is already owned by another example",
                keyword: "unique",
              },
            ],
          };
        }
        const validationRequest = {
          entryId: workspace.draft.target.entryId,
          example,
          source,
        };
        let exampleIssues: readonly AuthoringValidationIssue[];
        try {
          let cacheKey: string | undefined;
          let cached: AuthoringValidationCacheValue | undefined;
          try {
            cacheKey =
              context.cache === undefined ||
              context.examples.cacheKey === undefined
                ? undefined
                : await context.examples.cacheKey(validationRequest);
            cached =
              cacheKey === undefined || context.cache === undefined
                ? undefined
                : await context.cache.get(cacheKey);
          } catch {
            cacheKey = undefined;
            cached = undefined;
          }
          if (cached !== undefined) {
            exampleIssues = cached.issues;
          } else {
            exampleIssues = await context.examples.validate(validationRequest);
            if (cacheKey !== undefined && context.cache !== undefined) {
              try {
                await context.cache.put(cacheKey, {
                  schemaVersion: 1,
                  issues: exampleIssues,
                });
              } catch {
                // Compiler cache is disposable; validation remains authoritative.
              }
            }
          }
        } catch (error) {
          return {
            ok: false,
            code: "example_validation_failed",
            issues: [
              {
                path: "/generation/example/source",
                message:
                  error instanceof Error
                    ? error.message
                    : "Generated example validation failed",
                keyword: "validator",
              },
            ],
          };
        }
        if (exampleIssues.length > 0) {
          return {
            ok: false,
            code: "example_invalid",
            issues: exampleIssues.map((issue) => ({
              ...issue,
              path: `/generation/example/source${issue.path === "/" ? "" : issue.path}`,
            })),
          };
        }
        const examples = [...currentExamples];
        if (existingIndex < 0) examples.push(example);
        else examples[existingIndex] = example;
        return {
          ok: true,
          files: {
            "entry.json": jsonFile({ ...entry, examples }),
            [localPath]: source,
          },
        };
      },
    });
  }
  async function applyGeneratedSummary(
    request: ApplyGeneratedSummaryRequest,
  ): Promise<ApplyGeneratedSummaryResult> {
    const requestFailure = generatedRequestFailure(
      request.context,
      request.expectedRevision,
      request.generation,
      validateAuthoringSummaryGeneration(request.generation),
    );
    if (requestFailure !== undefined) return requestFailure;

    return applyGeneratedContent<"draft_unreadable">({
      context: request.context,
      expectedRevision: request.expectedRevision,
      generation: request.generation,
      ...(request.orchestration === undefined
        ? {}
        : { orchestration: request.orchestration }),
      claims: request.generation.summary.claims,
      claimPath: "/generation/summary/claims",
      writeFailureMessage: "Generated summary could not be committed",
      async materialize(workspace) {
        const entrySource = workspace.files["entry.json"];
        let entry: Record<string, unknown>;
        try {
          const parsed = JSON.parse(entrySource ?? "null") as unknown;
          if (
            parsed === null ||
            typeof parsed !== "object" ||
            Array.isArray(parsed)
          ) {
            throw new Error("Candidate Entry must be a JSON object");
          }
          entry = parsed as Record<string, unknown>;
        } catch (error) {
          return {
            ok: false,
            code: "draft_unreadable",
            issues: [
              {
                path: "/entry.json",
                message:
                  error instanceof Error
                    ? error.message
                    : "Candidate Entry is unreadable",
                keyword: "parse",
              },
            ],
          };
        }
        if (
          entry["schemaVersion"] !== 2 ||
          entry["id"] !== workspace.draft.target.entryId
        ) {
          return {
            ok: false,
            code: "draft_unreadable",
            issues: [
              {
                path: "/entry.json/id",
                message:
                  "Candidate Entry schema and identity must match the Authoring Draft",
                keyword: "identity",
              },
            ],
          };
        }
        return {
          ok: true,
          files: {
            "entry.json": jsonFile({
              ...entry,
              summary: request.generation.summary.text,
            }),
          },
        };
      },
    });
  }
  async function applyGeneratedSection(
    request: ApplyGeneratedSectionRequest,
  ): Promise<ApplyGeneratedSectionResult> {
    const requestFailure = generatedRequestFailure(
      request.context,
      request.expectedRevision,
      request.generation,
      validateAuthoringSectionGeneration(request.generation),
    );
    if (requestFailure !== undefined) return requestFailure;

    return applyGeneratedContent<"invalid_request" | "draft_unreadable">({
      context: request.context,
      expectedRevision: request.expectedRevision,
      generation: request.generation,
      ...(request.orchestration === undefined
        ? {}
        : { orchestration: request.orchestration }),
      claims: request.generation.section.claims,
      claimPath: "/generation/section/claims",
      writeFailureMessage: "Generated section could not be committed",
      async materialize(workspace) {
        if (
          !PROFILE_DEFINITIONS[workspace.draft.profile].headings.includes(
            request.generation.section.heading,
          )
        ) {
          return {
            ok: false,
            code: "invalid_request",
            issues: [
              {
                path: "/generation/section/heading",
                message: `Heading is not part of the ${workspace.draft.profile} authoring profile`,
                keyword: "enum",
              },
            ],
          };
        }
        const currentContent = workspace.files["content.md"];
        if (currentContent === undefined) {
          return {
            ok: false,
            code: "draft_unreadable",
            issues: [
              {
                path: "/content.md",
                message: "Draft content is missing",
                keyword: "required",
              },
            ],
          };
        }
        const replacement = replaceMarkdownSection(
          currentContent,
          request.generation.section.heading,
          request.generation.section.markdown,
          PROFILE_DEFINITIONS[workspace.draft.profile].headings,
        );
        if (!replacement.ok) {
          return {
            ok: false,
            code: "invalid_request",
            issues: [
              {
                path: "/generation/section/markdown",
                message: replacement.message,
                keyword: "markdown-section",
              },
            ],
          };
        }
        return {
          ok: true,
          files: { "content.md": replacement.content },
        };
      },
      reportPatch(workspace, receiptPath, nextRevision) {
        return {
          generatedSections: [
            ...(workspace.report.generatedSections ?? []),
            {
              heading: request.generation.section.heading,
              receiptPath,
              contextDigest: request.context.digest,
              appliedRevision: nextRevision,
              reviewStatus: "human-review-required",
            },
          ],
        };
      },
    });
  }

  return {
    applyGenerationBundle,
    applyGeneratedExample,
    applyGeneratedSummary,
    applyGeneratedSection,
  };
}
