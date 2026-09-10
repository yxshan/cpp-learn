import type { RepairableAreaId } from "./areas.ts";

/**
 * The repair planner is told "Entry X is missing area Y" and must produce the
 * heading to write. It must not keep its own private list of heading names:
 * that is exactly how a Header finding previously existed in the checker but
 * had no repair target.
 *
 * Each entry here is a canonical heading the planner may emit. The policy's
 * `headingMatchesArea` recognizes every one of them; a contract test enforces
 * that, so a name can never be added here that the checker would not accept.
 */
export const REPAIR_HEADINGS_BY_AREA: Readonly<
  Partial<Record<RepairableAreaId, readonly string[]>>
> = {
  "quick-info": ["快速信息"],
  selection: ["什么时候使用", "如何选择", "何时直接包含"],
  // "快速信息" is deliberately NOT a candidate for `interface`: writing it would
  // leave the finding unresolved, because the matcher reads it as quick-info.
  interface: ["声明与重载", "类型与所有权"],
  parameters: ["参数与前置条件"],
  returns: ["返回值"],
  complexity: ["复杂度"],
  errors: ["异常与错误"],
  lifetime: ["生命周期与失效", "类型与所有权"],
  "direct-include": ["何时直接包含"],
  "facility-map": ["设施地图"],
  mistakes: ["常见误区"],
  javascript: ["与 JavaScript 对照"],
};

export function repairableHeadings(area: RepairableAreaId): readonly string[] {
  return REPAIR_HEADINGS_BY_AREA[area] ?? [];
}
