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

import authoringCatalogProposalSchema from "./authoring-catalog-proposal.schema.json" with { type: "json" };
import authoringDraftSchema from "./authoring-draft.schema.json" with { type: "json" };
import authoringFactsSchema from "./authoring-facts.schema.json" with { type: "json" };
import authoringPublicationPlanSchema from "./authoring-publication-plan.schema.json" with { type: "json" };
import authoringReportSchema from "./authoring-report.schema.json" with { type: "json" };
import authoringSourcesSchema from "./authoring-sources.schema.json" with { type: "json" };
import type {
  AuthoringValidationCache,
  AuthoringValidationCacheValue,
} from "./cache.js";
import type {
  AuthoringPublicationCandidate,
  AuthoringPublisher,
} from "./publisher.js";

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
  readonly inputDigest: string;
  readonly status: "not_checked" | "blocked" | "ready";
  readonly affectedEntryIds: readonly string[];
  readonly affectedActivityIds: readonly string[];
  readonly findings: readonly {
    readonly severity: "hard" | "warning";
    readonly risk: "high" | "medium" | "low";
    readonly code: string;
    readonly path: string;
    readonly message: string;
  }[];
  readonly reviewQueue: readonly {
    readonly severity: "warning";
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
    readonly operation: "create" | "update";
    readonly previousDigest?: string;
  }[];
}

export interface DraftWorkspace {
  readonly draft: AuthoringDraftManifest;
  readonly proposal: AuthoringCatalogProposal;
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

export interface PublishDraftRequest {
  readonly draftId: string;
  readonly expectedRevision: number;
  readonly mode: "dry_run" | "apply";
}

export type PublishDraftResult =
  | {
      readonly ok: true;
      readonly applied: boolean;
      readonly plan: AuthoringPublicationPlan;
    }
  | {
      readonly ok: false;
      readonly code:
        | "invalid_request"
        | "draft_not_found"
        | "draft_unreadable"
        | "draft_not_ready"
        | "revision_conflict"
        | "draft_changed"
        | "publication_failed";
      readonly issues: readonly AuthoringValidationIssue[];
    };

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
  readonly entries: readonly {
    readonly id: string;
    readonly slug: string;
    readonly kind: ReferenceEntryKind;
    readonly title: string;
    readonly symbol?: string;
    readonly header?: string;
    readonly categories: readonly string[];
    readonly relatedEntryIds: readonly string[];
  }[];
  readonly entryIds: readonly string[];
  readonly categoryIds: readonly string[];
  readonly slugsByEntryId: Readonly<Record<string, string>>;
  readonly redirects: readonly {
    readonly fromSlug: string;
    readonly toEntryId: string;
  }[];
  readonly activityIdsByEntryId?: Readonly<Record<string, readonly string[]>>;
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
  cacheKey?(request: AuthoringExampleValidationRequest): Promise<string>;
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
  publish(request: PublishDraftRequest): Promise<PublishDraftResult>;
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
    readonly expectedFiles: Readonly<Record<string, string>>;
    readonly workspace: DraftWorkspace;
  }): Promise<boolean>;
}

export interface ReferenceAuthoringDependencies {
  readonly drafts: ReferenceDraftRepository;
  readonly catalog?: AuthoringCatalogContextAdapter;
  readonly examples?: AuthoringExampleValidator;
  readonly quality?: AuthoringContentQualityValidator;
  readonly cache?: AuthoringValidationCache;
  readonly publisher?: AuthoringPublisher;
  readonly clock?: () => Date;
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateDraft = ajv.compile(authoringDraftSchema);
const validateCatalogProposal = ajv.compile(authoringCatalogProposalSchema);
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

export function validateAuthoringCatalogProposal(
  value: unknown,
): readonly AuthoringValidationIssue[] {
  return validationIssues(validateCatalogProposal, value);
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

export interface AuthoringCatalogProposal {
  readonly schemaVersion: 1;
  readonly draftId: string;
  readonly entryPath: string;
  readonly categories: readonly string[];
  readonly relatedEntryIds: readonly string[];
  readonly affectedRedirects: readonly {
    readonly fromSlug: string;
    readonly toEntryId: string;
  }[];
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

const GENERATED_DRAFT_FILES = new Set([
  "draft.json",
  "report.json",
  "preview.html",
  "publication-plan.json",
]);

export function authoringInputDigest(
  files: Readonly<Record<string, string>>,
): string {
  const hash = createHash("sha256");
  for (const path of Object.keys(files)
    .filter((candidate) => !GENERATED_DRAFT_FILES.has(candidate))
    .sort()) {
    const content = files[path]!;
    hash.update(`${path.length}:${path}${Buffer.byteLength(content)}:`);
    hash.update(content);
  }
  return hash.digest("hex");
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
  affectedEntryIds: readonly string[] = [target.entryId],
): AuthoringDraftManifest {
  return {
    schemaVersion: 1,
    draftId: target.entryId,
    revision: 1,
    state: "draft",
    profile,
    target,
    targetPaths: targetPaths(target),
    affectedEntryIds,
    createdAt: now,
    updatedAt: now,
  };
}

function candidateEntry(
  target: PrepareDraftTarget,
  proposal: AuthoringCatalogProposal,
) {
  return {
    schemaVersion: 2,
    id: target.entryId,
    version: 1,
    slug: target.slug,
    kind: target.kind,
    title: target.title,
    summary: "TODO",
    aliases: [],
    categories: proposal.categories,
    relatedEntryIds: proposal.relatedEntryIds,
    content: { format: "markdown", path: targetPaths(target).content },
    examples: [],
    sources: [],
    verifiedAt: null,
  };
}

function createDraftWorkspace(
  draft: AuthoringDraftManifest,
  proposal: AuthoringCatalogProposal,
): DraftWorkspace {
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
  const files: Record<string, string> = {
    "draft.json": jsonFile(draft),
    "facts.json": jsonFile(facts),
    "sources.json": jsonFile(sources),
    "catalog-proposal.json": jsonFile(proposal),
    "entry.json": jsonFile(candidateEntry(target, proposal)),
    "content.md": contentTemplate(target.title, profile),
  };
  for (const label of PROFILE_DEFINITIONS[profile].examples) {
    files[`examples/${label}.cpp`] = exampleTemplate(label);
  }
  const report: AuthoringReport = {
    schemaVersion: 1,
    draftId: target.entryId,
    draftRevision: 1,
    inputDigest: authoringInputDigest(files),
    status: "not_checked",
    affectedEntryIds: draft.affectedEntryIds,
    affectedActivityIds: [],
    findings: [],
    reviewQueue: [],
    cacheEvidence: [],
  };
  files["report.json"] = jsonFile(report);
  return { draft, proposal, facts, sources, report, files };
}

function emptyCatalogProposal(
  target: PrepareDraftTarget,
): AuthoringCatalogProposal {
  return {
    schemaVersion: 1,
    draftId: target.entryId,
    entryPath: targetPaths(target).entry,
    categories: [],
    relatedEntryIds: [],
    affectedRedirects: [],
  };
}

function catalogProposal(
  target: PrepareDraftTarget,
  catalog: AuthoringCatalogContext,
): AuthoringCatalogProposal {
  const ownerSymbol = target.title.includes("::")
    ? target.title.slice(0, target.title.lastIndexOf("::"))
    : undefined;
  const parentSlug = target.slug.includes("/")
    ? target.slug.slice(0, target.slug.lastIndexOf("/"))
    : undefined;
  const directlyRelated = catalog.entries.filter(
    (entry) =>
      entry.slug === parentSlug ||
      entry.symbol === ownerSymbol ||
      entry.title === ownerSymbol,
  );
  const owningHeaders = new Set(
    directlyRelated
      .map(({ header }) => header)
      .filter((header): header is string => header !== undefined),
  );
  const headerEntries = catalog.entries.filter(
    (entry) =>
      entry.kind === "header" &&
      (owningHeaders.has(entry.title) ||
        (entry.symbol !== undefined && owningHeaders.has(entry.symbol))),
  );
  const relatedEntries = [...directlyRelated, ...headerEntries].filter(
    (entry, index, entries) =>
      entry.id !== target.entryId &&
      entries.findIndex(({ id }) => id === entry.id) === index,
  );
  return {
    schemaVersion: 1,
    draftId: target.entryId,
    entryPath: targetPaths(target).entry,
    categories: [
      ...new Set(relatedEntries.flatMap(({ categories }) => [...categories])),
    ],
    relatedEntryIds: relatedEntries.map(({ id }) => id),
    affectedRedirects: catalog.redirects.filter(
      ({ toEntryId }) =>
        toEntryId === target.entryId ||
        relatedEntries.some(({ id }) => id === toEntryId),
    ),
  };
}

function cloneWorkspace(workspace: DraftWorkspace): DraftWorkspace {
  return structuredClone(workspace);
}

function sameFiles(
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, string>>,
): boolean {
  const leftPaths = Object.keys(left);
  const rightPaths = Object.keys(right);
  return (
    leftPaths.length === rightPaths.length &&
    leftPaths.every((path) => left[path] === right[path])
  );
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
    async commitCheck({ draftId, expectedRevision, expectedFiles, workspace }) {
      const existing = drafts.get(draftId);
      if (
        existing === undefined ||
        existing.draft.revision !== expectedRevision ||
        !sameFiles(existing.files, expectedFiles)
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

function warningFinding(
  code: string,
  path: string,
  message: string,
  risk: AuthoringFinding["risk"],
): AuthoringFinding {
  return { severity: "warning", risk, code, path, message };
}

function qualityRisk(path: string): AuthoringFinding["risk"] {
  if (/complexity|errors|lifetime|interface|parameters|returns/u.test(path)) {
    return "high";
  }
  if (/selection|examples|mistakes|javascript/u.test(path)) return "medium";
  return "low";
}

function qualityFindings(
  artifactPath: string,
  issues: readonly AuthoringValidationIssue[],
): AuthoringFinding[] {
  return issues.map((issue) =>
    warningFinding(
      "content-quality",
      `${artifactPath}${issue.path === "/" ? "" : issue.path}`,
      issue.message,
      qualityRisk(issue.path),
    ),
  );
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
  const groupKinds = new Set<AuthoringFactKind>();
  for (const group of workspace.facts.groups) {
    if (groupKinds.has(group.kind)) {
      findings.push(
        hardFinding(
          "fact-kind-duplicate",
          `facts.json/groups/${group.id}/kind`,
          `Fact kind ${group.kind} must appear at most once`,
        ),
      );
    }
    groupKinds.add(group.kind);
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
  const sourcesById = new Map(
    workspace.sources.sources.map((source) => [source.id, source]),
  );
  const usedSourceIds = new Set(
    workspace.facts.groups.flatMap((group) => [...group.sourceIds]),
  );
  const publishedSourceUrls = new Set(
    entry.sources.map((source) => source.url),
  );
  const publishedSourcesByUrl = new Map(
    entry.sources.map((source) => [source.url, source]),
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
    let hostname = "";
    try {
      hostname = new URL(source.url).hostname;
    } catch {
      // URL shape is handled by the source Schema before this validator runs.
    }
    if (
      (hostname === "cppreference.com" ||
        hostname.endsWith(".cppreference.com")) &&
      source.kind !== "secondary"
    ) {
      findings.push(
        hardFinding(
          "source-classification",
          `sources.json/sources/${source.id}/kind`,
          "cppreference must be classified as a secondary source",
        ),
      );
    }
    if (!usedSourceIds.has(source.id)) continue;
    if (!publishedSourceUrls.has(source.url)) {
      findings.push(
        hardFinding(
          "source-not-published",
          `sources.json/sources/${source.id}`,
          `Used source ${source.id} is missing from entry.json sources`,
        ),
      );
    } else {
      const published = publishedSourcesByUrl.get(source.url);
      if (published?.kind !== source.kind) {
        findings.push(
          hardFinding(
            "source-kind-mismatch",
            `entry.json/sources/${source.id}`,
            `Published source kind must remain ${source.kind}`,
          ),
        );
      }
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
  const normativeKinds = new Set<AuthoringFactKind>([
    "signature",
    "availability",
    "parameters",
    "return",
    "ownership",
    "errors",
    "complexity",
    "lifetime_invalidation",
    "thread_safety",
    "direct_include",
    "facility_map",
  ]);
  for (const group of workspace.facts.groups) {
    if (group.status !== "verified" || !normativeKinds.has(group.kind)) {
      continue;
    }
    const hasWorkingDraftClause = group.sourceIds.some((sourceId) => {
      const source = sourcesById.get(sourceId);
      if (source?.kind !== "primary" || source.standardSection === undefined) {
        return false;
      }
      try {
        const url = new URL(source.url);
        return (
          url.hostname === "eel.is" && url.pathname.startsWith("/c++draft")
        );
      } catch {
        return false;
      }
    });
    if (!hasWorkingDraftClause) {
      findings.push(
        hardFinding(
          "fact-normative-source-missing",
          `facts.json/groups/${group.id}/sourceIds`,
          `Normative fact ${group.kind} requires a cited Working Draft clause`,
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
  const redirect = catalog.redirects.find(
    ({ fromSlug }) => fromSlug === entry.slug,
  );
  if (redirect !== undefined) {
    findings.push(
      hardFinding(
        "redirect-slug-conflict",
        "entry.json/slug",
        `Slug is preserved as a historical redirect to ${redirect.toEntryId}`,
      ),
    );
  }
  return findings;
}

export function analyzeAuthoringImpact(
  targetEntryId: string,
  entry: ReferenceEntryManifest,
  catalog: AuthoringCatalogContext,
): {
  readonly entryIds: readonly string[];
  readonly activityIds: readonly string[];
} {
  const entryIds = new Set<string>([targetEntryId, ...entry.relatedEntryIds]);
  for (const candidate of catalog.entries) {
    if (
      candidate.relatedEntryIds.includes(targetEntryId) ||
      candidate.relatedEntryIds.some((id) => entry.relatedEntryIds.includes(id))
    ) {
      entryIds.add(candidate.id);
    }
  }
  for (const categoryId of entry.categories) {
    if (catalog.entryIds.includes(categoryId)) entryIds.add(categoryId);
  }
  for (const redirect of catalog.redirects) {
    if (
      redirect.toEntryId === targetEntryId ||
      entryIds.has(redirect.toEntryId)
    ) {
      entryIds.add(redirect.toEntryId);
    }
  }
  const activityIds = new Set<string>();
  for (const entryId of entryIds) {
    for (const activityId of catalog.activityIdsByEntryId?.[entryId] ?? []) {
      activityIds.add(activityId);
    }
  }
  return { entryIds: [...entryIds], activityIds: [...activityIds].sort() };
}

async function validateExamples(
  workspace: DraftWorkspace,
  entry: ReferenceEntryManifest,
  validator: AuthoringExampleValidator | undefined,
  cache: AuthoringValidationCache | undefined,
): Promise<{
  readonly findings: AuthoringFinding[];
  readonly cacheEvidence: AuthoringReport["cacheEvidence"];
}> {
  const findings: AuthoringFinding[] = [];
  const cacheEvidence: AuthoringReport["cacheEvidence"][number][] = [];
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
    const request = {
      entryId: entry.id,
      example,
      source,
    };
    let cacheKey: string | undefined;
    let cached: AuthoringValidationCacheValue | undefined;
    try {
      cacheKey =
        cache === undefined || validator.cacheKey === undefined
          ? undefined
          : await validator.cacheKey(request);
      cached =
        cacheKey === undefined || cache === undefined
          ? undefined
          : await cache.get(cacheKey);
    } catch {
      cacheKey = undefined;
      cached = undefined;
    }
    let issues: readonly AuthoringValidationIssue[];
    if (cached !== undefined) {
      issues = cached.issues;
      cacheEvidence.push({ key: cacheKey!, status: "hit" });
    } else {
      issues = await validator.validate(request);
      if (cacheKey !== undefined && cache !== undefined) {
        try {
          await cache.put(cacheKey, { schemaVersion: 1, issues });
        } catch {
          // The cache is disposable; a successful validation remains authoritative.
        }
        cacheEvidence.push({ key: cacheKey, status: "miss" });
      } else {
        cacheEvidence.push({
          key: `${entry.id}/${example.id}`,
          status: "not_checked",
        });
      }
    }
    findings.push(...schemaFindings("example-invalid", localPath, issues));
  }
  return { findings, cacheEvidence };
}

export function createReferenceAuthoring(
  dependencies: ReferenceAuthoringDependencies,
): ReferenceAuthoring {
  const clock = dependencies.clock ?? (() => new Date());
  return {
    async prepare(request) {
      const profile = PROFILE_BY_KIND[request.target.kind];
      const now = clock().toISOString();
      let proposal = emptyCatalogProposal(request.target);
      if (dependencies.catalog !== undefined) {
        let catalog: AuthoringCatalogContext;
        try {
          catalog = await dependencies.catalog.load();
        } catch (error) {
          return {
            ok: false,
            code: "invalid_request",
            issues: [
              {
                path: "/catalog",
                message:
                  error instanceof Error
                    ? error.message
                    : "Active Reference catalog is unreadable",
                keyword: "read",
              },
            ],
          };
        }
        const activeOwner = Object.entries(catalog.slugsByEntryId).find(
          ([entryId, slug]) =>
            entryId !== request.target.entryId && slug === request.target.slug,
        );
        const redirectOwner = catalog.redirects.find(
          ({ fromSlug }) => fromSlug === request.target.slug,
        );
        if (activeOwner !== undefined || redirectOwner !== undefined) {
          return {
            ok: false,
            code: "invalid_request",
            issues: [
              {
                path: "/target/slug",
                message:
                  activeOwner === undefined
                    ? `Slug is preserved as a historical redirect to ${redirectOwner!.toEntryId}`
                    : `Slug is already owned by ${activeOwner[0]}`,
                keyword: "conflict",
              },
            ],
          };
        }
        proposal = catalogProposal(request.target, catalog);
      }
      const draft = createDraftManifest(request.target, profile, now, [
        request.target.entryId,
        ...proposal.relatedEntryIds,
      ]);
      const issues = validateAuthoringDraft(draft);
      if (issues.length > 0) {
        return { ok: false, code: "invalid_request", issues };
      }

      const workspace = createDraftWorkspace(draft, proposal);
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
      const reportIssues = validateAuthoringReport(workspace.report);
      const proposalIssues = validateAuthoringCatalogProposal(
        workspace.proposal,
      );

      const findings: AuthoringFinding[] = [
        ...schemaFindings(
          "catalog-proposal-schema",
          "catalog-proposal.json",
          proposalIssues,
        ),
        ...schemaFindings("facts-schema", "facts.json", factIssues),
        ...schemaFindings("sources-schema", "sources.json", sourceIssues),
        ...schemaFindings("report-schema", "report.json", reportIssues),
        ...(factIssues.length === 0 && sourceIssues.length === 0
          ? validateFactCoverage(workspace)
          : []),
        ...validateContentProfile(workspace),
      ];

      const artifactDraftIds: [string, string][] = [];
      if (proposalIssues.length === 0) {
        artifactDraftIds.push([
          "catalog-proposal.json",
          workspace.proposal.draftId,
        ]);
      }
      if (factIssues.length === 0) {
        artifactDraftIds.push(["facts.json", workspace.facts.draftId]);
      }
      if (sourceIssues.length === 0) {
        artifactDraftIds.push(["sources.json", workspace.sources.draftId]);
      }
      if (reportIssues.length === 0) {
        artifactDraftIds.push(["report.json", workspace.report.draftId]);
      }
      for (const [artifact, draftId] of artifactDraftIds) {
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
      let checkedCatalog: AuthoringCatalogContext | undefined;
      const cacheEvidence: AuthoringReport["cacheEvidence"][number][] = [];
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
          if (
            proposalIssues.length === 0 &&
            (workspace.proposal.entryPath !==
              workspace.draft.targetPaths.entry ||
              JSON.stringify(workspace.proposal.categories) !==
                JSON.stringify(candidate.entry.categories) ||
              JSON.stringify(workspace.proposal.relatedEntryIds) !==
                JSON.stringify(candidate.entry.relatedEntryIds))
          ) {
            findings.push(
              hardFinding(
                "catalog-proposal-mismatch",
                "catalog-proposal.json",
                "Catalog proposal must match the candidate Entry path, categories, and related Entries",
              ),
            );
          }
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
              checkedCatalog = await dependencies.catalog.load();
              findings.push(
                ...validateCatalogLinks(
                  workspace,
                  candidate.entry,
                  checkedCatalog,
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
                ...qualityFindings(
                  "content.md",
                  await dependencies.quality.validate({
                    entry: candidate.entry,
                    content,
                  }),
                ),
              );
            }
          }
          const exampleValidation = await validateExamples(
            workspace,
            candidate.entry,
            dependencies.examples,
            dependencies.cache,
          );
          findings.push(...exampleValidation.findings);
          cacheEvidence.push(...exampleValidation.cacheEvidence);
        }
      }

      const riskOrder = { high: 0, medium: 1, low: 2 } as const;
      findings.sort(
        (left, right) =>
          (left.severity === "hard" ? 0 : 1) -
            (right.severity === "hard" ? 0 : 1) ||
          riskOrder[left.risk] - riskOrder[right.risk] ||
          left.path.localeCompare(right.path) ||
          left.code.localeCompare(right.code),
      );
      const reviewQueue = findings.filter(
        (finding): finding is AuthoringReport["reviewQueue"][number] =>
          finding.severity === "warning",
      );
      const blocked = findings.some(({ severity }) => severity === "hard");
      const nextRevision = workspace.draft.revision + 1;
      const impact =
        checkedEntry === undefined || checkedCatalog === undefined
          ? {
              entryIds: workspace.draft.affectedEntryIds,
              activityIds: [] as readonly string[],
            }
          : analyzeAuthoringImpact(
              workspace.draft.target.entryId,
              checkedEntry,
              checkedCatalog,
            );
      const affectedEntryIds = impact.entryIds;
      const report: AuthoringReport = {
        schemaVersion: 1,
        draftId: workspace.draft.draftId,
        draftRevision: nextRevision,
        inputDigest: authoringInputDigest(workspace.files),
        status: blocked ? "blocked" : "ready",
        affectedEntryIds,
        affectedActivityIds: impact.activityIds,
        findings,
        reviewQueue,
        cacheEvidence,
      };
      const draft: AuthoringDraftManifest = {
        ...workspace.draft,
        revision: nextRevision,
        state: blocked ? "draft" : "checked",
        affectedEntryIds,
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
        expectedFiles: workspace.files,
        workspace: checkedWorkspace,
      });
      if (!committed) {
        return { ok: false, code: "revision_conflict", issues: [] };
      }
      return { ok: true, report, workspace: checkedWorkspace };
    },
    async publish(request) {
      if (
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(request.draftId) ||
        !Number.isInteger(request.expectedRevision) ||
        request.expectedRevision < 1
      ) {
        return {
          ok: false,
          code: "invalid_request",
          issues: [
            {
              path: "/",
              message: "draftId and expectedRevision are invalid",
              keyword: "request",
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
      if (workspace.draft.revision !== request.expectedRevision) {
        return { ok: false, code: "revision_conflict", issues: [] };
      }
      if (
        workspace.draft.state !== "checked" ||
        workspace.report.status !== "ready" ||
        workspace.report.draftRevision !== workspace.draft.revision
      ) {
        return { ok: false, code: "draft_not_ready", issues: [] };
      }
      if (
        workspace.report.inputDigest !== authoringInputDigest(workspace.files)
      ) {
        return { ok: false, code: "draft_changed", issues: [] };
      }
      if (dependencies.publisher === undefined) {
        return {
          ok: false,
          code: "publication_failed",
          issues: [
            {
              path: "/publisher",
              message: "No Reference publication Adapter is configured",
              keyword: "configuration",
            },
          ],
        };
      }
      const candidate = parseCandidateEntry(workspace.files["entry.json"]);
      if (!candidate.ok) {
        return {
          ok: false,
          code: "draft_unreadable",
          issues: [
            {
              path: candidate.finding.path,
              message: candidate.finding.message,
              keyword: candidate.finding.code,
            },
          ],
        };
      }
      const files: AuthoringPublicationCandidate[] = [];
      for (const [localPath, canonicalPath] of [
        ["entry.json", workspace.draft.targetPaths.entry],
        ["content.md", workspace.draft.targetPaths.content],
      ] as const) {
        const content = workspace.files[localPath];
        if (content === undefined) {
          return {
            ok: false,
            code: "draft_unreadable",
            issues: [
              {
                path: localPath,
                message: "Publication source is missing",
                keyword: "required",
              },
            ],
          };
        }
        files.push({ path: canonicalPath, content });
      }
      const examplePrefix = `${workspace.draft.targetPaths.examples}/`;
      for (const example of candidate.entry.examples) {
        const localPath = example.path.startsWith(examplePrefix)
          ? `examples/${example.path.slice(examplePrefix.length)}`
          : "";
        const content = workspace.files[localPath];
        if (localPath === "" || content === undefined) {
          return {
            ok: false,
            code: "draft_unreadable",
            issues: [
              {
                path: example.path,
                message: "Example publication source is missing or unsafe",
                keyword: "required",
              },
            ],
          };
        }
        files.push({ path: example.path, content });
      }
      try {
        const plan = await dependencies.publisher.publish({
          draftId: request.draftId,
          expectedRevision: request.expectedRevision,
          mode: request.mode,
          entryPath: workspace.draft.targetPaths.entry,
          files,
        });
        const planIssues = validateAuthoringPublicationPlan(plan);
        if (planIssues.length > 0) {
          return {
            ok: false,
            code: "publication_failed",
            issues: planIssues,
          };
        }
        return { ok: true, applied: request.mode === "apply", plan };
      } catch (error) {
        return {
          ok: false,
          code: "publication_failed",
          issues: [
            {
              path: "/publisher",
              message:
                error instanceof Error ? error.message : "Publication failed",
              keyword: "publish",
            },
          ],
        };
      }
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
  createFilesystemAuthoringValidationCache,
  createInMemoryAuthoringValidationCache,
  type AuthoringValidationCache,
  type AuthoringValidationCacheValue,
  type FilesystemAuthoringValidationCacheOptions,
} from "./cache.js";
export {
  createFilesystemAuthoringPublisher,
  type AuthoringPublicationCandidate,
  type AuthoringPublishAdapterRequest,
  type AuthoringPublisher,
  type FilesystemAuthoringPublisherOptions,
} from "./publisher.js";
export {
  createFilesystemAuthoringCatalogContext,
  type FilesystemAuthoringCatalogContextOptions,
} from "./catalog-context.js";
export {
  createNativeAuthoringExampleValidator,
  type NativeAuthoringExampleValidatorOptions,
} from "./native-example-validator.js";
import { createHash } from "node:crypto";
