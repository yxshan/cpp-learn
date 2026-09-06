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
  readonly targetPaths: AuthoringTargetPaths;
  readonly affectedEntryIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AuthoringTargetPaths {
  readonly entry: string;
  readonly content: string;
  readonly examples: string;
  readonly catalog: "catalog.json";
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
  reserve(workspace: DraftWorkspace): Promise<{
    readonly created: boolean;
    readonly workspace: DraftWorkspace;
  }>;
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

interface AuthoringProfileDefinition {
  readonly factKinds: readonly AuthoringFactKind[];
  readonly headings: readonly string[];
  readonly examples: readonly ("minimal" | "realistic")[];
}

const PROFILE_DEFINITIONS: Readonly<
  Record<AuthoringProfile, AuthoringProfileDefinition>
> = {
  callable: {
    factKinds: [
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
    headings: [
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
    examples: ["minimal", "realistic"],
  },
  entity: {
    factKinds: [
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
    headings: [
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
    examples: ["minimal", "realistic"],
  },
  header: {
    factKinds: [
      "scope",
      "availability",
      "direct_include",
      "facility_map",
      "examples",
      "pitfalls",
    ],
    headings: [
      "快速信息",
      "何时直接包含",
      "设施地图",
      "标准版本边界",
      "示例",
      "常见误区",
      "相关条目",
      "来源",
    ],
    examples: ["minimal"],
  },
  navigation: {
    factKinds: ["scope", "selection", "availability", "pitfalls"],
    headings: ["适用范围", "如何选择", "核心条目", "常见误区", "来源"],
    examples: ["minimal"],
  },
};

function jsonFile(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function contentTemplate(title: string, profile: AuthoringProfile): string {
  return [
    `# ${title}`,
    "",
    "TODO：用一句话说明它解决的问题和不适用的场景。",
    ...PROFILE_DEFINITIONS[profile].headings.flatMap((heading) => [
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

function targetPaths(target: PrepareDraftTarget): AuthoringTargetPaths {
  const root = `entries/${target.entryId}`;
  return {
    entry: `${root}/entry.json`,
    content: `${root}/content.md`,
    examples: `${root}/examples`,
    catalog: "catalog.json",
  };
}

function createDraftManifest(
  target: PrepareDraftTarget,
  profile: AuthoringProfile,
  now: string,
): AuthoringDraftManifest {
  return {
    schemaVersion: 1,
    draftId: target.entryId,
    revision: 1,
    state: "draft",
    profile,
    target,
    targetPaths: targetPaths(target),
    affectedEntryIds: [target.entryId],
    createdAt: now,
    updatedAt: now,
  };
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
    content: { format: "markdown", path: targetPaths(target).content },
    examples: [],
    sources: [],
    verifiedAt: null,
  };
}

function createDraftWorkspace(draft: AuthoringDraftManifest): DraftWorkspace {
  const { profile, target } = draft;
  const facts: AuthoringFactSheet = {
    schemaVersion: 1,
    draftId: target.entryId,
    groups: PROFILE_DEFINITIONS[profile].factKinds.map((kind) => ({
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
  };
  for (const label of PROFILE_DEFINITIONS[profile].examples) {
    files[`examples/${label}.cpp`] = exampleTemplate(label);
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
    async reserve(workspace) {
      const draftId = workspace.draft.draftId;
      const existing = drafts.get(draftId);
      if (existing) {
        return { created: false, workspace: cloneWorkspace(existing) };
      }
      const reserved = cloneWorkspace(workspace);
      drafts.set(draftId, reserved);
      return { created: true, workspace: cloneWorkspace(reserved) };
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
      const draft = createDraftManifest(request.target, profile, now);
      const issues = validateAuthoringDraft(draft);
      if (issues.length > 0) {
        return { ok: false, code: "invalid_request", issues };
      }

      const workspace = createDraftWorkspace(draft);
      const reservation = await dependencies.drafts.reserve(workspace);
      if (!reservation.created) {
        if (!sameTarget(reservation.workspace.draft.target, request.target)) {
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
        return { ok: true, created: false, workspace: reservation.workspace };
      }
      return { ok: true, created: true, workspace: reservation.workspace };
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
