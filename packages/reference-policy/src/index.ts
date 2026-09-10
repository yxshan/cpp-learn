export {
  areasForHeading,
  COMMON_SEMANTIC_AREAS,
  entryKindPolicy,
  HEADING_AREA_IDS,
  headingMatchesArea,
  SEMANTIC_AREA_ORDER,
  type EntryKindPolicy,
  type HeadingAreaId,
  type MetadataAreaId,
  type RepairableAreaId,
  type SemanticAreaId,
} from "./areas.ts";

export {
  auditReferenceContent,
  sortReferenceQualityFindings,
  type ReferenceQualityFinding,
  type ReferenceQualityInput,
} from "./evaluate.ts";

export {
  REPAIR_HEADINGS_BY_AREA,
  repairableHeadings,
} from "./repair-targets.ts";
