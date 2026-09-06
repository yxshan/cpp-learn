import Ajv2020, {
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import type { ReferenceEntryKind } from "@cpp-learn/contracts";

import authoringDraftSchema from "./authoring-draft.schema.json" with { type: "json" };
import authoringFactsSchema from "./authoring-facts.schema.json" with { type: "json" };
import authoringPublicationPlanSchema from "./authoring-publication-plan.schema.json" with { type: "json" };
import authoringReportSchema from "./authoring-report.schema.json" with { type: "json" };
import authoringSourcesSchema from "./authoring-sources.schema.json" with { type: "json" };

export const AUTHORING_FACT_KINDS = [
  "selection",
  "signature",
  "availability",
  "parameters",
  "return",
  "ownership",
  "errors",
  "complexity",
  "lifetime_invalidation",
  "thread_safety",
  "scope",
  "direct_include",
  "facility_map",
  "examples",
  "pitfalls",
  "js_comparison",
] as const;

export type AuthoringFactKind = (typeof AUTHORING_FACT_KINDS)[number];
export type AuthoringProfile = "callable" | "entity" | "header" | "navigation";

export interface AuthoringValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly keyword: string;
}

export interface PrepareDraftTarget {
  readonly entryId: string;
  readonly kind: ReferenceEntryKind;
  readonly slug: string;
  readonly title: string;
}

export interface PrepareDraftRequest {
  readonly target: PrepareDraftTarget;
}

export interface AuthoringDraftManifest {
  readonly schemaVersion: 1;
  readonly draftId: string;
  readonly revision: number;
  readonly state: "draft" | "ready_for_review" | "checked";
  readonly profile: AuthoringProfile;
  readonly target: PrepareDraftTarget;
  readonly affectedEntryIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AuthoringFactGroup {
  readonly id: string;
  readonly kind: AuthoringFactKind;
  readonly status: "unverified" | "verified" | "not_applicable";
  readonly summary: string;
  readonly sourceIds: readonly string[];
  readonly decision?: string;
}

export interface AuthoringFactSheet {
  readonly schemaVersion: 1;
  readonly draftId: string;
  readonly groups: readonly AuthoringFactGroup[];
}

export interface AuthoringSourceLedger {
  readonly schemaVersion: 1;
  readonly draftId: string;
  readonly sources: readonly {
    readonly id: string;
    readonly kind: "primary" | "secondary" | "vendor";
    readonly title: string;
    readonly url: string;
    readonly verifiedAt: string;
    readonly standardSection?: string;
    readonly notes?: string;
  }[];
}

export interface AuthoringReport {
  readonly schemaVersion: 1;
  readonly draftId: string;
  readonly draftRevision: number;
  readonly status: "not_checked" | "blocked" | "ready";
  readonly findings: readonly {
    readonly severity: "hard" | "warning";
    readonly risk: "high" | "medium" | "low";
    readonly code: string;
    readonly path: string;
    readonly message: string;
  }[];
  readonly cacheEvidence: readonly {
    readonly key: string;
    readonly status: "hit" | "miss" | "not_checked";
  }[];
}

export interface AuthoringPublicationPlan {
  readonly schemaVersion: 1;
  readonly draftId: string;
  readonly expectedRevision: number;
  readonly mode: "dry_run" | "apply";
  readonly files: readonly {
    readonly path: string;
    readonly digest: string;
  }[];
}

export interface DraftWorkspace {
  readonly draft: AuthoringDraftManifest;
  readonly facts: AuthoringFactSheet;
  readonly sources: AuthoringSourceLedger;
  readonly report: AuthoringReport;
  readonly files: Readonly<Record<string, string>>;
}

export type PrepareDraftResult =
  | {
      readonly ok: true;
      readonly created: boolean;
      readonly workspace: DraftWorkspace;
    }
  | {
      readonly ok: false;
      readonly code: "invalid_request" | "draft_conflict";
      readonly issues: readonly AuthoringValidationIssue[];
    };

export interface ReferenceAuthoring {
  prepare(request: PrepareDraftRequest): Promise<PrepareDraftResult>;
}

export interface ReferenceDraftRepository {
  get(draftId: string): Promise<DraftWorkspace | undefined>;
  save(workspace: DraftWorkspace): Promise<void>;
}

export interface ReferenceAuthoringDependencies {
  readonly drafts: ReferenceDraftRepository;
  readonly clock?: () => Date;
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateDraft = ajv.compile(authoringDraftSchema);
const validateFacts = ajv.compile(authoringFactsSchema);
const validateSources = ajv.compile(authoringSourcesSchema);
const validateReport = ajv.compile(authoringReportSchema);
const validatePublicationPlan = ajv.compile(authoringPublicationPlanSchema);

function issuePath(error: ErrorObject): string {
  if (error.keyword === "required") {
    return `${error.instancePath}/${String(error.params["missingProperty"])}`;
  }
  return error.instancePath || "/";
}

function validationIssues(
  validator: ValidateFunction,
  value: unknown,
): readonly AuthoringValidationIssue[] {
  if (validator(value)) return [];
  return (validator.errors ?? []).map((error) => ({
    path: issuePath(error),
    message: error.message ?? "invalid value",
    keyword: error.keyword,
  }));
}

export function validateAuthoringDraft(
  value: unknown,
): readonly AuthoringValidationIssue[] {
  return validationIssues(validateDraft, value);
}

export function validateAuthoringFactSheet(
  value: unknown,
): readonly AuthoringValidationIssue[] {
  return validationIssues(validateFacts, value);
}

export function validateAuthoringSourceLedger(
  value: unknown,
): readonly AuthoringValidationIssue[] {
  return validationIssues(validateSources, value);
}

export function validateAuthoringReport(
  value: unknown,
): readonly AuthoringValidationIssue[] {
  return validationIssues(validateReport, value);
}

export function validateAuthoringPublicationPlan(
  value: unknown,
): readonly AuthoringValidationIssue[] {
  return validationIssues(validatePublicationPlan, value);
}

const PROFILE_BY_KIND: Readonly<Record<ReferenceEntryKind, AuthoringProfile>> =
  {
    landing: "navigation",
    header: "header",
    type: "entity",
    object: "entity",
    function: "callable",
    member: "callable",
    concept: "entity",
    guide: "navigation",
  };

const FACT_KINDS_BY_PROFILE: Readonly<
  Record<AuthoringProfile, readonly AuthoringFactKind[]>
> = {
  callable: [
    "selection",
    "signature",
    "availability",
    "parameters",
    "return",
    "errors",
    "complexity",
    "lifetime_invalidation",
    "thread_safety",
    "examples",
    "pitfalls",
    "js_comparison",
  ],
  entity: [
    "selection",
    "signature",
    "availability",
    "ownership",
    "errors",
    "complexity",
    "lifetime_invalidation",
    "thread_safety",
    "examples",
    "pitfalls",
    "js_comparison",
  ],
  header: [
    "scope",
    "availability",
    "direct_include",
    "facility_map",
    "examples",
    "pitfalls",
  ],
  navigation: ["scope", "selection", "availability", "pitfalls"],
};

const HEADINGS_BY_PROFILE: Readonly<
  Record<AuthoringProfile, readonly string[]>
> = {
  callable: [
    "快速信息",
    "什么时候使用",
    "声明与重载",
    "参数与前置条件",
    "返回值",
    "复杂度",
    "异常与错误",
    "生命周期与失效",
    "线程安全",
    "示例",
    "常见误区",
    "与 JavaScript 对照",
    "相关条目",
    "来源",
  ],
  entity: [
    "快速信息",
    "什么时候使用",
    "类型与所有权",
    "复杂度",
    "异常与错误",
    "生命周期与失效",
    "线程安全",
    "示例",
    "常见误区",
    "与 JavaScript 对照",
    "相关条目",
    "来源",
  ],
  header: [
    "快速信息",
    "何时直接包含",
    "设施地图",
    "标准版本边界",
    "示例",
    "常见误区",
    "相关条目",
    "来源",
  ],
  navigation: ["适用范围", "如何选择", "核心条目", "常见误区", "来源"],
};

function jsonFile(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function contentTemplate(title: string, profile: AuthoringProfile): string {
  return [
    `# ${title}`,
    "",
    "TODO：用一句话说明它解决的问题和不适用的场景。",
    ...HEADINGS_BY_PROFILE[profile].flatMap((heading) => [
      "",
      `## ${heading}`,
      "",
      "TODO",
    ]),
    "",
  ].join("\n");
}

function exampleTemplate(label: "minimal" | "realistic"): string {
  return [
    "#include <iostream>",
    "",
    "int main() {",
    `  // TODO: ${label} deterministic example`,
    "  return 0;",
    "}",
    "",
  ].join("\n");
}

function candidateEntry(target: PrepareDraftTarget) {
  return {
    schemaVersion: 2,
    id: target.entryId,
    version: 1,
    slug: target.slug,
    kind: target.kind,
    title: target.title,
    summary: "TODO",
    aliases: [],
    categories: [],
    relatedEntryIds: [],
    content: {
      format: "markdown",
      path: `entries/${target.entryId}/content.md`,
    },
    examples: [],
    sources: [],
    verifiedAt: null,
  };
}

function createDraftWorkspace(
  target: PrepareDraftTarget,
  profile: AuthoringProfile,
  now: string,
): DraftWorkspace {
  const draft: AuthoringDraftManifest = {
    schemaVersion: 1,
    draftId: target.entryId,
    revision: 1,
    state: "draft",
    profile,
    target,
    affectedEntryIds: [target.entryId],
    createdAt: now,
    updatedAt: now,
  };
  const facts: AuthoringFactSheet = {
    schemaVersion: 1,
    draftId: target.entryId,
    groups: FACT_KINDS_BY_PROFILE[profile].map((kind) => ({
      id: kind.replaceAll("_", "-"),
      kind,
      status: "unverified",
      summary: "",
      sourceIds: [],
    })),
  };
  const sources: AuthoringSourceLedger = {
    schemaVersion: 1,
    draftId: target.entryId,
    sources: [],
  };
  const report: AuthoringReport = {
    schemaVersion: 1,
    draftId: target.entryId,
    draftRevision: 1,
    status: "not_checked",
    findings: [],
    cacheEvidence: [],
  };
  const files: Record<string, string> = {
    "draft.json": jsonFile(draft),
    "facts.json": jsonFile(facts),
    "sources.json": jsonFile(sources),
    "report.json": jsonFile(report),
    "entry.json": jsonFile(candidateEntry(target)),
    "content.md": contentTemplate(target.title, profile),
    "examples/minimal.cpp": exampleTemplate("minimal"),
  };
  if (profile === "callable" || profile === "entity") {
    files["examples/realistic.cpp"] = exampleTemplate("realistic");
  }
  return { draft, facts, sources, report, files };
}

function cloneWorkspace(workspace: DraftWorkspace): DraftWorkspace {
  return structuredClone(workspace);
}

export function createInMemoryReferenceDraftRepository(
  initial: readonly DraftWorkspace[] = [],
): ReferenceDraftRepository {
  const drafts = new Map(
    initial.map((workspace) => [
      workspace.draft.draftId,
      cloneWorkspace(workspace),
    ]),
  );
  return {
    async get(draftId) {
      const workspace = drafts.get(draftId);
      return workspace ? cloneWorkspace(workspace) : undefined;
    },
    async save(workspace) {
      drafts.set(workspace.draft.draftId, cloneWorkspace(workspace));
    },
  };
}

function sameTarget(left: PrepareDraftTarget, right: PrepareDraftTarget) {
  return (
    left.entryId === right.entryId &&
    left.kind === right.kind &&
    left.slug === right.slug &&
    left.title === right.title
  );
}

export function createReferenceAuthoring(
  dependencies: ReferenceAuthoringDependencies,
): ReferenceAuthoring {
  const clock = dependencies.clock ?? (() => new Date());
  return {
    async prepare(request) {
      const profile = PROFILE_BY_KIND[request.target.kind];
      const now = clock().toISOString();
      const draftCandidate = {
        schemaVersion: 1,
        draftId: request.target.entryId,
        revision: 1,
        state: "draft",
        profile,
        target: request.target,
        affectedEntryIds: [request.target.entryId],
        createdAt: now,
        updatedAt: now,
      };
      const issues = validateAuthoringDraft(draftCandidate);
      if (issues.length > 0) {
        return { ok: false, code: "invalid_request", issues };
      }

      const existing = await dependencies.drafts.get(request.target.entryId);
      if (existing) {
        if (!sameTarget(existing.draft.target, request.target)) {
          return {
            ok: false,
            code: "draft_conflict",
            issues: [
              {
                path: "/target",
                message:
                  "Draft identity is already reserved for another target",
                keyword: "conflict",
              },
            ],
          };
        }
        return { ok: true, created: false, workspace: existing };
      }

      const workspace = createDraftWorkspace(request.target, profile, now);
      await dependencies.drafts.save(workspace);
      return { ok: true, created: true, workspace: cloneWorkspace(workspace) };
    },
  };
}

export {
  authoringDraftSchema,
  authoringFactsSchema,
  authoringPublicationPlanSchema,
  authoringReportSchema,
  authoringSourcesSchema,
};
