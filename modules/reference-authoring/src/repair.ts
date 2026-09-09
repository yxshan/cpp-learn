import { createHash } from "node:crypto";

import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import type { CppStandard } from "@cpp-learn/contracts";
import type { ReferenceEntryManifest } from "@cpp-learn/reference";

import authoringRepairSchema from "./authoring-repair.schema.json" with { type: "json" };
import type {
  AuthoringFactKind,
  AuthoringFinding,
  AuthoringProfile,
  AuthoringValidationIssue,
  DraftWorkspace,
} from "./index.js";

export const AUTHORING_REPAIR_MAX_ATTEMPTS = 3 as const;

interface AuthoringRepairTargetBase {
  readonly id: string;
  readonly factGroupIds: readonly string[];
  readonly findingDigests: readonly string[];
}

export type AuthoringRepairTarget =
  | (AuthoringRepairTargetBase & {
      readonly kind: "section";
      readonly heading: string;
    })
  | (AuthoringRepairTargetBase & {
      readonly kind: "example";
      readonly exampleId: string;
      readonly exampleKind: "compile" | "run" | "expected-compile-failure";
      readonly standard: CppStandard;
    });

export interface AuthoringRepairAttempt {
  readonly targetId: string;
  readonly attempt: number;
  readonly outcome: "issued";
  readonly issuedAt: string;
}

export interface AuthoringRepairPlan {
  readonly schemaVersion: 1;
  readonly repairId: string;
  readonly draftId: string;
  readonly baseline: {
    readonly draftRevision: number;
    readonly inputDigest: string;
    readonly reportDigest: string;
    readonly profile: AuthoringProfile;
  };
  readonly maxAttempts: typeof AUTHORING_REPAIR_MAX_ATTEMPTS;
  readonly targets: readonly AuthoringRepairTarget[];
  readonly attempts: readonly AuthoringRepairAttempt[];
  readonly ignoredFindingDigests: readonly string[];
  readonly planDigest: string;
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateRepair = ajv.compile<AuthoringRepairPlan>(authoringRepairSchema);

function issuePath(error: ErrorObject): string {
  if (error.keyword === "required") {
    return `${error.instancePath}/${String(error.params["missingProperty"])}`;
  }
  if (error.keyword === "additionalProperties") {
    return `${error.instancePath}/${String(error.params["additionalProperty"])}`;
  }
  return error.instancePath || "/";
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function authoringFindingDigest(finding: AuthoringFinding): string {
  return digest(finding);
}

export function authoringReportDigest(
  report: DraftWorkspace["report"],
): string {
  return digest(report);
}

function repairPlanPayload(
  plan: Omit<AuthoringRepairPlan, "planDigest"> | AuthoringRepairPlan,
) {
  return {
    schemaVersion: plan.schemaVersion,
    repairId: plan.repairId,
    draftId: plan.draftId,
    baseline: plan.baseline,
    maxAttempts: plan.maxAttempts,
    targets: plan.targets,
    ignoredFindingDigests: plan.ignoredFindingDigests,
  };
}

export function authoringRepairPlanDigest(
  plan: Omit<AuthoringRepairPlan, "planDigest"> | AuthoringRepairPlan,
): string {
  return digest(repairPlanPayload(plan));
}

export function validateAuthoringRepairPlan(
  value: unknown,
): readonly AuthoringValidationIssue[] {
  if (!validateRepair(value)) {
    return (validateRepair.errors ?? []).map((error) => ({
      path: issuePath(error),
      message: error.message ?? "invalid value",
      keyword: error.keyword,
    }));
  }
  const plan = value;
  const issues: AuthoringValidationIssue[] = [];
  if (authoringRepairPlanDigest(plan) !== plan.planDigest) {
    issues.push({
      path: "/planDigest",
      message:
        "Repair plan digest does not match its immutable baseline and targets",
      keyword: "digest",
    });
  }
  const targets = new Set<string>();
  for (const [index, target] of plan.targets.entries()) {
    if (targets.has(target.id)) {
      issues.push({
        path: `/targets/${index}/id`,
        message: `Repair target ID ${target.id} is duplicated`,
        keyword: "unique",
      });
    }
    targets.add(target.id);
  }
  const attemptsByTarget = new Map<string, number[]>();
  for (const [index, attempt] of plan.attempts.entries()) {
    if (!targets.has(attempt.targetId)) {
      issues.push({
        path: `/attempts/${index}/targetId`,
        message: `Repair attempt references unknown target ${attempt.targetId}`,
        keyword: "unknown-target",
      });
      continue;
    }
    const attempts = attemptsByTarget.get(attempt.targetId) ?? [];
    attempts.push(attempt.attempt);
    attemptsByTarget.set(attempt.targetId, attempts);
  }
  for (const [targetId, attempts] of attemptsByTarget) {
    const expected = Array.from(
      { length: attempts.length },
      (_, index) => index + 1,
    );
    if (
      attempts.length > plan.maxAttempts ||
      attempts.some((attempt, index) => attempt !== expected[index])
    ) {
      issues.push({
        path: "/attempts",
        message: `Repair attempts for ${targetId} must be contiguous, ordered, and bounded by ${plan.maxAttempts}`,
        keyword: "attempt-sequence",
      });
    }
  }
  return issues;
}

const AREA_REPAIR: Readonly<
  Record<
    string,
    {
      readonly headings: readonly string[];
      readonly kinds: readonly AuthoringFactKind[];
    }
  >
> = {
  selection: { headings: ["什么时候使用", "如何选择"], kinds: ["selection"] },
  interface: {
    headings: ["声明与重载", "快速信息", "类型与所有权"],
    kinds: ["signature", "availability", "ownership"],
  },
  parameters: { headings: ["参数与前置条件"], kinds: ["parameters"] },
  returns: { headings: ["返回值"], kinds: ["return"] },
  complexity: { headings: ["复杂度"], kinds: ["complexity"] },
  errors: { headings: ["异常与错误"], kinds: ["errors"] },
  lifetime: {
    headings: ["生命周期与失效", "类型与所有权"],
    kinds: ["lifetime_invalidation", "ownership"],
  },
  examples: { headings: ["示例"], kinds: ["examples"] },
  mistakes: { headings: ["常见误区"], kinds: ["pitfalls"] },
  javascript: { headings: ["与 JavaScript 对照"], kinds: ["js_comparison"] },
};

function verifiedFactIds(
  workspace: DraftWorkspace,
  kinds: readonly AuthoringFactKind[],
): readonly string[] {
  const allowed = new Set(kinds);
  return workspace.facts.groups
    .filter((group) => group.status === "verified" && allowed.has(group.kind))
    .map(({ id }) => id);
}

function parsedEntry(
  workspace: DraftWorkspace,
): ReferenceEntryManifest | undefined {
  try {
    return JSON.parse(
      workspace.files["entry.json"] ?? "null",
    ) as ReferenceEntryManifest;
  } catch {
    return undefined;
  }
}

function exampleIdFromFinding(
  finding: AuthoringFinding,
  entry: ReferenceEntryManifest | undefined,
): string | undefined {
  const manifestId = entry?.examples.find((example) => {
    const localPath = `examples/${example.path.split("/").at(-1)}`;
    return (
      finding.path === localPath || finding.path.startsWith(`${localPath}/`)
    );
  })?.id;
  if (manifestId !== undefined) return manifestId;
  return finding.path.match(
    /^examples\/([a-z0-9]+(?:-[a-z0-9]+)*)\.cpp(?:\/|$)/u,
  )?.[1];
}

function sectionBodies(content: string): ReadonlyMap<string, string> {
  const bodies = new Map<string, string>();
  const lines = content.replaceAll("\r\n", "\n").split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index]!.match(/^## (.+)$/u);
    if (match === null) continue;
    const next = lines.slice(index + 1).findIndex((line) => /^## /u.test(line));
    const end = next < 0 ? lines.length : index + 1 + next;
    bodies.set(match[1]!, lines.slice(index + 1, end).join("\n"));
  }
  return bodies;
}

interface BuildRepairPlanOptions {
  readonly repairId: string;
  readonly requiredHeadings: readonly string[];
  readonly expectedExampleIds: readonly string[];
  readonly workspace: DraftWorkspace;
}

export function buildAuthoringRepairPlan(options: BuildRepairPlanOptions): {
  readonly plan?: AuthoringRepairPlan;
  readonly ignoredFindingDigests: readonly string[];
} {
  const { workspace } = options;
  const entry = parsedEntry(workspace);
  const targets = new Map<string, AuthoringRepairTarget>();
  const ignored = new Set<string>();
  const contentBodies = sectionBodies(workspace.files["content.md"] ?? "");

  const addSection = (
    id: string,
    heading: string,
    kinds: readonly AuthoringFactKind[],
    findingDigest: string,
  ): boolean => {
    const factGroupIds = verifiedFactIds(workspace, kinds);
    if (
      !options.requiredHeadings.includes(heading) ||
      factGroupIds.length === 0
    ) {
      ignored.add(findingDigest);
      return false;
    }
    const existing = targets.get(id);
    targets.set(id, {
      id,
      kind: "section",
      heading,
      factGroupIds,
      findingDigests: [
        ...(existing?.findingDigests ?? []),
        ...((existing?.findingDigests ?? []).includes(findingDigest)
          ? []
          : [findingDigest]),
      ],
    });
    return true;
  };

  const addExample = (exampleId: string, findingDigest: string): boolean => {
    const factGroupIds = verifiedFactIds(workspace, ["examples"]);
    if (factGroupIds.length === 0) {
      ignored.add(findingDigest);
      return false;
    }
    const manifest = entry?.examples.find(({ id }) => id === exampleId);
    const id = `example-${exampleId}`;
    const existing = targets.get(id);
    targets.set(id, {
      id,
      kind: "example",
      exampleId,
      exampleKind: manifest?.kind ?? "run",
      standard: manifest?.standard ?? "c++20",
      factGroupIds,
      findingDigests: [
        ...(existing?.findingDigests ?? []),
        ...((existing?.findingDigests ?? []).includes(findingDigest)
          ? []
          : [findingDigest]),
      ],
    });
    return true;
  };

  for (const finding of workspace.report.findings) {
    const findingDigest = authoringFindingDigest(finding);
    if (finding.code === "content-quality") {
      const area = finding.path.match(/^content\.md\/([^/]+)/u)?.[1];
      const repair = area === undefined ? undefined : AREA_REPAIR[area];
      const heading = repair?.headings.find((candidate) =>
        options.requiredHeadings.includes(candidate),
      );
      if (repair !== undefined && heading !== undefined) {
        addSection(`section-${area}`, heading, repair.kinds, findingDigest);
      } else {
        ignored.add(findingDigest);
      }
      continue;
    }
    if (finding.code === "content-placeholder") {
      let added = false;
      for (const [index, heading] of options.requiredHeadings.entries()) {
        if (!/\bTODO\b/u.test(contentBodies.get(heading) ?? "")) continue;
        const repair = Object.values(AREA_REPAIR).find(({ headings }) =>
          headings.includes(heading),
        );
        if (repair === undefined) continue;
        added =
          addSection(
            `section-${index + 1}`,
            heading,
            repair.kinds,
            findingDigest,
          ) || added;
      }
      if (!added) ignored.add(findingDigest);
      continue;
    }
    if (
      finding.code === "example-invalid" ||
      finding.code === "example-source-missing"
    ) {
      const exampleId = exampleIdFromFinding(finding, entry);
      if (exampleId === undefined) ignored.add(findingDigest);
      else addExample(exampleId, findingDigest);
      continue;
    }
    if (finding.code === "examples-missing") {
      const existingIds = new Set(entry?.examples.map(({ id }) => id) ?? []);
      const missing = options.expectedExampleIds.filter(
        (id) => !existingIds.has(id),
      );
      let added = false;
      for (const exampleId of missing) {
        added = addExample(exampleId, findingDigest) || added;
      }
      if (!added) ignored.add(findingDigest);
      continue;
    }
    ignored.add(findingDigest);
  }

  if (targets.size === 0) {
    return { ignoredFindingDigests: [...ignored] };
  }
  const withoutDigest: Omit<AuthoringRepairPlan, "planDigest"> = {
    schemaVersion: 1,
    repairId: options.repairId,
    draftId: workspace.draft.draftId,
    baseline: {
      draftRevision: workspace.draft.revision,
      inputDigest: workspace.report.inputDigest,
      reportDigest: authoringReportDigest(workspace.report),
      profile: workspace.draft.profile,
    },
    maxAttempts: AUTHORING_REPAIR_MAX_ATTEMPTS,
    targets: [...targets.values()],
    attempts: [],
    ignoredFindingDigests: [...ignored],
  };
  return {
    plan: {
      ...withoutDigest,
      planDigest: authoringRepairPlanDigest(withoutDigest),
    },
    ignoredFindingDigests: [...ignored],
  };
}

export { authoringRepairSchema };
