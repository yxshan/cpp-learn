import type { ReferenceEntryKind } from "@cpp-learn/contracts";

/**
 * The semantic areas a Reference Entry can cover. This is the one vocabulary
 * every consumer shares: the quality gate, the authoring scaffolder, the repair
 * planner, and the coverage report.
 */
export type SemanticAreaId =
  | "quick-info"
  | "selection"
  | "interface"
  | "parameters"
  | "returns"
  | "complexity"
  | "errors"
  | "lifetime"
  | "examples"
  | "mistakes"
  | "javascript"
  | "related"
  | "sources"
  | "direct-include"
  | "facility-map";

/**
 * Areas decided by a heading. `direct-include` and `facility-map` are
 * heading-driven too: the Header profile locates its section by heading and then
 * applies a dedicated body rule.
 */
export type HeadingAreaId = Exclude<
  SemanticAreaId,
  "examples" | "related" | "sources"
>;

/** Areas decided by metadata rather than by any heading. */
export type MetadataAreaId = Extract<
  SemanticAreaId,
  "examples" | "related" | "sources"
>;

/** Areas a repair plan can target by writing a heading. */
export type RepairableAreaId = HeadingAreaId;

/**
 * Canonical presentation order. Doubles as the deterministic tie-breaker for
 * findings, so two areas on one Entry always sort the same way.
 */
export const SEMANTIC_AREA_ORDER: readonly SemanticAreaId[] = [
  "quick-info",
  "selection",
  "interface",
  "parameters",
  "returns",
  "complexity",
  "errors",
  "lifetime",
  "direct-include",
  "facility-map",
  "examples",
  "mistakes",
  "javascript",
  "related",
  "sources",
];

/**
 * Heading aliases per area. A Chinese Reference Entry names its sections
 * freely (「什么时候使用」/「如何选择」/「适用范围」), so an area owns a family
 * of headings rather than one canonical string.
 */
const HEADING_PATTERNS: Readonly<Record<HeadingAreaId, RegExp>> = {
  "quick-info": /快速信息/u,
  selection: /什么时候|何时|选择|适用|使用场景|用途/u,
  // "类型与所有权" is how the entity profile names its interface section.
  interface:
    /声明|重载|接口|主要操作|基本模型|主要实体|设施|观察|成员|类型与所有权/u,
  parameters: /参数|约束|前置条件|输入|范围要求|调用条件/u,
  returns: /返回|结果/u,
  complexity: /复杂度/u,
  errors: /异常|错误|失败|未定义行为|前提/u,
  lifetime: /生命周期|失效|所有权|引用|迭代器|线程安全|并发|控制块/u,
  "direct-include": /直接包含|什么时候包含/u,
  "facility-map": /主要实体|主要设施|设施与|设施地图/u,
  mistakes: /常见错误|常见误区|误区/u,
  javascript: /JavaScript|TypeScript/u,
};

export const HEADING_AREA_IDS = Object.keys(
  HEADING_PATTERNS,
) as readonly HeadingAreaId[];

/** True when `heading` satisfies `area`. */
export function headingMatchesArea(
  area: HeadingAreaId,
  heading: string,
): boolean {
  return HEADING_PATTERNS[area].test(heading);
}

/**
 * Inverse lookup: the areas a heading can satisfy. Used by repair planning,
 * which is told "this Entry is missing area X" and must find the heading to
 * write. Exposing it here is what keeps repair from maintaining a second,
 * silently divergent list of heading names.
 */
export function areasForHeading(heading: string): readonly HeadingAreaId[] {
  return HEADING_AREA_IDS.filter((area) => headingMatchesArea(area, heading));
}

/**
 * Areas every audited Entry must cover, in presentation order. `parameters` and
 * `returns` are inserted for callables only.
 */
export const COMMON_SEMANTIC_AREAS: readonly HeadingAreaId[] = [
  "quick-info",
  "selection",
  "interface",
  "complexity",
  "errors",
  "lifetime",
  "mistakes",
  "javascript",
];

export interface EntryKindPolicy {
  /** Whether the quality gate audits this kind at all. */
  readonly audited: boolean;
  /** Areas that must be present, in presentation order. */
  readonly requiredAreas: readonly SemanticAreaId[];
  /** Minimum number of compiled examples. */
  readonly minimumExamples: number;
  /** Minimum number of related Entries. */
  readonly minimumRelatedEntries: number;
  /** Minimum number of primary sources. */
  readonly minimumPrimarySources: number;
  /**
   * Areas enforced by a dedicated rule rather than by a heading match. Header
   * Entries must direct readers to include the header directly and must map
   * their facilities with version columns.
   */
  readonly dedicatedRules: readonly SemanticAreaId[];
}

const COMMON_REQUIREMENTS = {
  minimumRelatedEntries: 2,
  minimumPrimarySources: 1,
} as const;

const KIND_POLICIES: Readonly<Record<ReferenceEntryKind, EntryKindPolicy>> = {
  landing: {
    audited: false,
    requiredAreas: [],
    minimumExamples: 0,
    ...COMMON_REQUIREMENTS,
    dedicatedRules: [],
  },
  guide: {
    audited: false,
    requiredAreas: [],
    minimumExamples: 0,
    ...COMMON_REQUIREMENTS,
    dedicatedRules: [],
  },
  header: {
    audited: true,
    requiredAreas: ["quick-info", "selection", "mistakes"],
    minimumExamples: 1,
    ...COMMON_REQUIREMENTS,
    dedicatedRules: ["direct-include", "facility-map"],
  },
  type: {
    audited: true,
    requiredAreas: COMMON_SEMANTIC_AREAS,
    minimumExamples: 2,
    ...COMMON_REQUIREMENTS,
    dedicatedRules: [],
  },
  object: {
    audited: true,
    requiredAreas: COMMON_SEMANTIC_AREAS,
    minimumExamples: 2,
    ...COMMON_REQUIREMENTS,
    dedicatedRules: [],
  },
  concept: {
    audited: true,
    requiredAreas: COMMON_SEMANTIC_AREAS,
    minimumExamples: 2,
    ...COMMON_REQUIREMENTS,
    dedicatedRules: [],
  },
  function: {
    audited: true,
    requiredAreas: withCallableAreas(COMMON_SEMANTIC_AREAS),
    minimumExamples: 2,
    ...COMMON_REQUIREMENTS,
    dedicatedRules: [],
  },
  member: {
    audited: true,
    requiredAreas: withCallableAreas(COMMON_SEMANTIC_AREAS),
    minimumExamples: 2,
    ...COMMON_REQUIREMENTS,
    dedicatedRules: [],
  },
};

/** Callables additionally document parameters and return values. */
function withCallableAreas(
  areas: readonly HeadingAreaId[],
): readonly SemanticAreaId[] {
  const required: SemanticAreaId[] = [...areas];
  required.splice(3, 0, "parameters", "returns");
  return required;
}

export function entryKindPolicy(kind: ReferenceEntryKind): EntryKindPolicy {
  return KIND_POLICIES[kind];
}
