import Ajv2020, {
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import type { ReferenceEntryKind } from "@cpp-learn/contracts";
import type {
  ReferenceEntryManifest,
  ReferenceExampleManifest,
} from "@cpp-learn/reference";
import { validateReferenceEntryManifest } from "@cpp-learn/reference-schema";

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

export interface CheckDraftRequest {
  readonly draftId: string;
}

export type CheckDraftResult =
  | {
      readonly ok: true;
      readonly report: AuthoringReport;
      readonly workspace: DraftWorkspace;
    }
  | {
      readonly ok: false;
      readonly code:
        | "invalid_request"
        | "draft_not_found"
        | "draft_unreadable"
        | "revision_conflict";
      readonly issues: readonly AuthoringValidationIssue[];
    };

export interface AuthoringCatalogContext {
  readonly entryIds: readonly string[];
  readonly categoryIds: readonly string[];
  readonly slugsByEntryId: Readonly<Record<string, string>>;
}

export interface AuthoringCatalogContextAdapter {
  load(): Promise<AuthoringCatalogContext>;
}

export interface AuthoringExampleValidationRequest {
  readonly entryId: string;
  readonly example: ReferenceExampleManifest;
  readonly source: string;
}

export interface AuthoringExampleValidator {
  validate(
    request: AuthoringExampleValidationRequest,
  ): Promise<readonly AuthoringValidationIssue[]>;
}

export interface AuthoringContentQualityRequest {
  readonly entry: ReferenceEntryManifest;
  readonly content: string;
}

export interface AuthoringContentQualityValidator {
  validate(
    request: AuthoringContentQualityRequest,
  ): Promise<readonly AuthoringValidationIssue[]>;
}

export interface ReferenceAuthoring {
  prepare(request: PrepareDraftRequest): Promise<PrepareDraftResult>;
  check(request: CheckDraftRequest): Promise<CheckDraftResult>;
}

export interface ReferenceDraftRepository {
  get(draftId: string): Promise<DraftWorkspace | undefined>;
  reserve(workspace: DraftWorkspace): Promise<{
    readonly created: boolean;
    readonly workspace: DraftWorkspace;
  }>;
  commitCheck(input: {
    readonly draftId: string;
    readonly expectedRevision: number;
    readonly workspace: DraftWorkspace;
  }): Promise<boolean>;
}

export interface ReferenceAuthoringDependencies {
  readonly drafts: ReferenceDraftRepository;
  readonly catalog?: AuthoringCatalogContextAdapter;
  readonly examples?: AuthoringExampleValidator;
  readonly quality?: AuthoringContentQualityValidator;
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
    async commitCheck({ draftId, expectedRevision, workspace }) {
      const existing = drafts.get(draftId);
      if (
        existing === undefined ||
        existing.draft.revision !== expectedRevision
      ) {
        return false;
      }
      drafts.set(draftId, cloneWorkspace(workspace));
      return true;
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

type AuthoringFinding = AuthoringReport["findings"][number];

function hardFinding(
  code: string,
  path: string,
  message: string,
  risk: AuthoringFinding["risk"] = "high",
): AuthoringFinding {
  return { severity: "hard", risk, code, path, message };
}

function schemaFindings(
  code: string,
  artifactPath: string,
  issues: readonly AuthoringValidationIssue[],
): AuthoringFinding[] {
  return issues.map((issue) =>
    hardFinding(
      code,
      `${artifactPath}${issue.path === "/" ? "" : issue.path}`,
      issue.message,
    ),
  );
}

function parseCandidateEntry(
  source: string | undefined,
):
  | { readonly ok: true; readonly entry: ReferenceEntryManifest }
  | { readonly ok: false; readonly finding: AuthoringFinding } {
  if (source === undefined) {
    return {
      ok: false,
      finding: hardFinding(
        "entry-missing",
        "entry.json",
        "Candidate Entry manifest is missing",
      ),
    };
  }
  try {
    return {
      ok: true,
      entry: JSON.parse(source) as ReferenceEntryManifest,
    };
  } catch (error) {
    return {
      ok: false,
      finding: hardFinding(
        "entry-json",
        "entry.json",
        error instanceof Error ? error.message : "Entry JSON is invalid",
      ),
    };
  }
}

function validateFactCoverage(workspace: DraftWorkspace): AuthoringFinding[] {
  const findings: AuthoringFinding[] = [];
  const requiredKinds = PROFILE_DEFINITIONS[workspace.draft.profile].factKinds;
  const groupsByKind = new Map(
    workspace.facts.groups.map((group) => [group.kind, group]),
  );
  const sourceIds = new Set(
    workspace.sources.sources.map((source) => source.id),
  );
  if (sourceIds.size !== workspace.sources.sources.length) {
    findings.push(
      hardFinding(
        "source-id-duplicate",
        "sources.json/sources",
        "Source IDs must be unique",
      ),
    );
  }

  for (const kind of requiredKinds) {
    const group = groupsByKind.get(kind);
    if (group === undefined) {
      findings.push(
        hardFinding(
          "fact-missing",
          "facts.json/groups",
          `Required fact group ${kind} is missing`,
        ),
      );
      continue;
    }
    if (group.status === "unverified") {
      findings.push(
        hardFinding(
          "fact-unverified",
          `facts.json/groups/${group.id}`,
          `Fact group ${kind} has not been reviewed`,
        ),
      );
    }
    for (const sourceId of group.sourceIds) {
      if (!sourceIds.has(sourceId)) {
        findings.push(
          hardFinding(
            "fact-source-missing",
            `facts.json/groups/${group.id}/sourceIds`,
            `Fact group ${kind} references missing source ${sourceId}`,
          ),
        );
      }
    }
  }
  return findings;
}

function validateSourceAlignment(
  workspace: DraftWorkspace,
  entry: ReferenceEntryManifest,
  today: string,
): AuthoringFinding[] {
  const findings: AuthoringFinding[] = [];
  const usedSourceIds = new Set(
    workspace.facts.groups.flatMap((group) => [...group.sourceIds]),
  );
  const publishedSourceUrls = new Set(
    entry.sources.map((source) => source.url),
  );
  if (entry.verifiedAt > today) {
    findings.push(
      hardFinding(
        "entry-verification-future",
        "entry.json/verifiedAt",
        `Verification date cannot be later than ${today}`,
      ),
    );
  }
  for (const source of workspace.sources.sources) {
    if (!usedSourceIds.has(source.id)) continue;
    if (!publishedSourceUrls.has(source.url)) {
      findings.push(
        hardFinding(
          "source-not-published",
          `sources.json/sources/${source.id}`,
          `Used source ${source.id} is missing from entry.json sources`,
        ),
      );
    }
    if (source.verifiedAt > today) {
      findings.push(
        hardFinding(
          "source-verification-future",
          `sources.json/sources/${source.id}/verifiedAt`,
          `Verification date cannot be later than ${today}`,
        ),
      );
    }
    if (source.verifiedAt < entry.verifiedAt) {
      findings.push(
        hardFinding(
          "source-verification-stale",
          `sources.json/sources/${source.id}/verifiedAt`,
          `Source evidence predates Entry verification ${entry.verifiedAt}`,
        ),
      );
    }
  }
  return findings;
}

function validateContentProfile(workspace: DraftWorkspace): AuthoringFinding[] {
  const content = workspace.files["content.md"];
  if (content === undefined) {
    return [
      hardFinding(
        "content-missing",
        "content.md",
        "Candidate Markdown content is missing",
      ),
    ];
  }
  const findings: AuthoringFinding[] = [];
  if (/\bTODO\b/u.test(content)) {
    findings.push(
      hardFinding(
        "content-placeholder",
        "content.md",
        "Candidate Markdown still contains TODO placeholders",
        "medium",
      ),
    );
  }
  for (const heading of PROFILE_DEFINITIONS[workspace.draft.profile].headings) {
    if (!content.includes(`## ${heading}`)) {
      findings.push(
        hardFinding(
          "content-section-missing",
          "content.md",
          `Required section ${heading} is missing`,
          "medium",
        ),
      );
    }
  }
  return findings;
}

function validateEntryIdentity(
  workspace: DraftWorkspace,
  entry: ReferenceEntryManifest,
): AuthoringFinding[] {
  const findings: AuthoringFinding[] = [];
  const target = workspace.draft.target;
  for (const [field, actual, expected] of [
    ["id", entry.id, target.entryId],
    ["kind", entry.kind, target.kind],
    ["slug", entry.slug, target.slug],
    ["title", entry.title, target.title],
  ] as const) {
    if (actual !== expected) {
      findings.push(
        hardFinding(
          "entry-target-mismatch",
          `entry.json/${field}`,
          `Expected ${expected}, received ${actual}`,
        ),
      );
    }
  }
  if (entry.content.path !== workspace.draft.targetPaths.content) {
    findings.push(
      hardFinding(
        "entry-path-mismatch",
        "entry.json/content/path",
        `Expected ${workspace.draft.targetPaths.content}`,
      ),
    );
  }
  return findings;
}

function validateCatalogLinks(
  workspace: DraftWorkspace,
  entry: ReferenceEntryManifest,
  catalog: AuthoringCatalogContext,
): AuthoringFinding[] {
  const findings: AuthoringFinding[] = [];
  const entryIds = new Set(catalog.entryIds);
  const categoryIds = new Set(catalog.categoryIds);
  for (const relatedId of entry.relatedEntryIds) {
    if (!entryIds.has(relatedId)) {
      findings.push(
        hardFinding(
          "related-entry-missing",
          "entry.json/relatedEntryIds",
          `Related Entry ${relatedId} is not in the active catalog`,
          "medium",
        ),
      );
    }
  }
  for (const categoryId of entry.categories) {
    if (!categoryIds.has(categoryId)) {
      findings.push(
        hardFinding(
          "category-missing",
          "entry.json/categories",
          `Category ${categoryId} is not in the active catalog`,
          "medium",
        ),
      );
    }
  }
  for (const [entryId, slug] of Object.entries(catalog.slugsByEntryId)) {
    if (entryId !== workspace.draft.target.entryId && slug === entry.slug) {
      findings.push(
        hardFinding(
          "slug-conflict",
          "entry.json/slug",
          `Slug is already owned by ${entryId}`,
        ),
      );
    }
  }
  return findings;
}

async function validateExamples(
  workspace: DraftWorkspace,
  entry: ReferenceEntryManifest,
  validator: AuthoringExampleValidator | undefined,
): Promise<AuthoringFinding[]> {
  const findings: AuthoringFinding[] = [];
  const expectedCount =
    PROFILE_DEFINITIONS[workspace.draft.profile].examples.length;
  if (entry.examples.length < expectedCount) {
    findings.push(
      hardFinding(
        "examples-missing",
        "entry.json/examples",
        `Profile requires at least ${expectedCount} example(s)`,
        "medium",
      ),
    );
  }
  for (const example of entry.examples) {
    const prefix = `${workspace.draft.targetPaths.examples}/`;
    if (!example.path.startsWith(prefix)) {
      findings.push(
        hardFinding(
          "example-path-mismatch",
          `entry.json/examples/${example.id}/path`,
          `Example path must be under ${workspace.draft.targetPaths.examples}`,
        ),
      );
      continue;
    }
    const localPath = `examples/${example.path.slice(prefix.length)}`;
    const source = workspace.files[localPath];
    if (source === undefined) {
      findings.push(
        hardFinding(
          "example-source-missing",
          localPath,
          `Example source ${localPath} is missing`,
        ),
      );
      continue;
    }
    if (validator === undefined) {
      findings.push(
        hardFinding(
          "example-validator-unavailable",
          localPath,
          "No example validator is configured",
        ),
      );
      continue;
    }
    const issues = await validator.validate({
      entryId: entry.id,
      example,
      source,
    });
    findings.push(...schemaFindings("example-invalid", localPath, issues));
  }
  return findings;
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
    async check(request) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(request.draftId)) {
        return {
          ok: false,
          code: "invalid_request",
          issues: [
            {
              path: "/draftId",
              message: "must be a stable lowercase Entry ID",
              keyword: "pattern",
            },
          ],
        };
      }

      let workspace: DraftWorkspace | undefined;
      try {
        workspace = await dependencies.drafts.get(request.draftId);
      } catch (error) {
        return {
          ok: false,
          code: "draft_unreadable",
          issues: [
            {
              path: "/draft",
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
      const checkedAt = clock().toISOString();
      const draftIssues = validateAuthoringDraft(workspace.draft);
      if (draftIssues.length > 0) {
        return {
          ok: false,
          code: "draft_unreadable",
          issues: draftIssues.map((issue) => ({
            ...issue,
            path: `/draft${issue.path}`,
          })),
        };
      }
      const factIssues = validateAuthoringFactSheet(workspace.facts);
      const sourceIssues = validateAuthoringSourceLedger(workspace.sources);

      const findings: AuthoringFinding[] = [
        ...schemaFindings("facts-schema", "facts.json", factIssues),
        ...schemaFindings("sources-schema", "sources.json", sourceIssues),
        ...(factIssues.length === 0 && sourceIssues.length === 0
          ? validateFactCoverage(workspace)
          : []),
        ...validateContentProfile(workspace),
      ];

      for (const [artifact, draftId] of [
        ["facts.json", workspace.facts.draftId],
        ["sources.json", workspace.sources.draftId],
        ["report.json", workspace.report.draftId],
      ] as const) {
        if (draftId !== workspace.draft.draftId) {
          findings.push(
            hardFinding(
              "draft-id-mismatch",
              `${artifact}/draftId`,
              `Expected ${workspace.draft.draftId}, received ${draftId}`,
            ),
          );
        }
      }

      let checkedEntry: ReferenceEntryManifest | undefined;
      const candidate = parseCandidateEntry(workspace.files["entry.json"]);
      if (!candidate.ok) {
        findings.push(candidate.finding);
      } else {
        const entryIssues = validateReferenceEntryManifest(candidate.entry);
        findings.push(
          ...schemaFindings("entry-schema", "entry.json", entryIssues),
        );
        if (entryIssues.length === 0) {
          checkedEntry = candidate.entry;
          findings.push(...validateEntryIdentity(workspace, candidate.entry));
          if (factIssues.length === 0 && sourceIssues.length === 0) {
            findings.push(
              ...validateSourceAlignment(
                workspace,
                candidate.entry,
                checkedAt.slice(0, 10),
              ),
            );
          }
          if (dependencies.catalog === undefined) {
            findings.push(
              hardFinding(
                "catalog-unavailable",
                "entry.json",
                "No active Reference catalog context is configured",
              ),
            );
          } else {
            try {
              findings.push(
                ...validateCatalogLinks(
                  workspace,
                  candidate.entry,
                  await dependencies.catalog.load(),
                ),
              );
            } catch (error) {
              findings.push(
                hardFinding(
                  "catalog-unreadable",
                  "entry.json",
                  error instanceof Error
                    ? error.message
                    : "Active Reference catalog is unreadable",
                ),
              );
            }
          }
          const content = workspace.files["content.md"];
          if (content !== undefined) {
            if (dependencies.quality === undefined) {
              findings.push(
                hardFinding(
                  "quality-validator-unavailable",
                  "content.md",
                  "No canonical Reference quality validator is configured",
                ),
              );
            } else {
              findings.push(
                ...schemaFindings(
                  "content-quality",
                  "content.md",
                  await dependencies.quality.validate({
                    entry: candidate.entry,
                    content,
                  }),
                ),
              );
            }
          }
          findings.push(
            ...(await validateExamples(
              workspace,
              candidate.entry,
              dependencies.examples,
            )),
          );
        }
      }

      findings.sort(
        (left, right) =>
          left.path.localeCompare(right.path) ||
          left.code.localeCompare(right.code),
      );
      const nextRevision = workspace.draft.revision + 1;
      const report: AuthoringReport = {
        schemaVersion: 1,
        draftId: workspace.draft.draftId,
        draftRevision: nextRevision,
        status: findings.length === 0 ? "ready" : "blocked",
        findings,
        cacheEvidence: [],
      };
      const draft: AuthoringDraftManifest = {
        ...workspace.draft,
        revision: nextRevision,
        state: findings.length === 0 ? "checked" : "draft",
        affectedEntryIds:
          checkedEntry === undefined
            ? workspace.draft.affectedEntryIds
            : [
                ...new Set([
                  workspace.draft.target.entryId,
                  ...checkedEntry.relatedEntryIds,
                ]),
              ],
        updatedAt: checkedAt,
      };
      const checkedWorkspace: DraftWorkspace = {
        ...workspace,
        draft,
        report,
        files: {
          ...workspace.files,
          "draft.json": jsonFile(draft),
          "report.json": jsonFile(report),
        },
      };
      const committed = await dependencies.drafts.commitCheck({
        draftId: workspace.draft.draftId,
        expectedRevision: workspace.draft.revision,
        workspace: checkedWorkspace,
      });
      if (!committed) {
        return { ok: false, code: "revision_conflict", issues: [] };
      }
      return { ok: true, report, workspace: checkedWorkspace };
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

export {
  createFilesystemReferenceDraftRepository,
  type FilesystemReferenceDraftRepositoryOptions,
} from "./filesystem.js";
export {
  createFilesystemAuthoringCatalogContext,
  type FilesystemAuthoringCatalogContextOptions,
} from "./catalog-context.js";
export {
  createNativeAuthoringExampleValidator,
  type NativeAuthoringExampleValidatorOptions,
} from "./native-example-validator.js";
