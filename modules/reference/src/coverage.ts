import type {
  CppStandard,
  ReferenceEntryKind,
  ReferenceVerification,
} from "@cpp-learn/contracts";

import type { ReferenceCatalog } from "./index.js";

type SourceKind = "primary" | "secondary" | "vendor";
type ExampleKind = "compile" | "run" | "expected-compile-failure";

export interface ReferenceCoverageReport {
  readonly catalogVersion: number;
  readonly entries: {
    readonly total: number;
    readonly withExamples: number;
    readonly withPrimarySource: number;
    readonly byCategory: readonly {
      readonly id: string;
      readonly title: string;
      readonly count: number;
    }[];
    readonly byKind: Readonly<Record<ReferenceEntryKind, number>>;
    readonly byIntroducedStandard: Readonly<
      Record<CppStandard | "unspecified", number>
    >;
    readonly bySourceKind: Readonly<
      Record<SourceKind, { readonly entries: number; readonly sources: number }>
    >;
  };
  readonly examples: {
    readonly total: number;
    readonly byKind: Readonly<Record<ExampleKind, number>>;
    readonly byStandard: Readonly<Record<CppStandard, number>>;
    readonly byVerification: Readonly<Record<ReferenceVerification, number>>;
  };
}

export async function createReferenceCoverageReport(
  reference: ReferenceCatalog,
): Promise<ReferenceCoverageReport> {
  const readiness = await reference.readiness();
  if (!readiness.ready) {
    throw new Error(
      `Reference catalog is unavailable: ${readiness.issueCodes.join(", ")}`,
    );
  }

  const navigation = await reference.getNavigation();
  const entryIds = [
    ...new Set(
      navigation.categories.flatMap((category) => category.entryIds),
    ),
  ];
  const entries = await Promise.all(
    entryIds.map(async (entryId) => {
      const entry = await reference.getEntry(entryId);
      if (!entry) {
        throw new Error(`Reference navigation contains unknown Entry ${entryId}`);
      }
      return entry;
    }),
  );

  const byKind: Record<ReferenceEntryKind, number> = {
    landing: 0,
    header: 0,
    type: 0,
    object: 0,
    function: 0,
    member: 0,
    concept: 0,
    guide: 0,
  };
  const byIntroducedStandard: Record<CppStandard | "unspecified", number> = {
    "c++98": 0,
    "c++03": 0,
    "c++11": 0,
    "c++14": 0,
    "c++17": 0,
    "c++20": 0,
    "c++23": 0,
    "c++26-draft": 0,
    unspecified: 0,
  };
  const bySourceKind: Record<
    SourceKind,
    { entries: number; sources: number }
  > = {
    primary: { entries: 0, sources: 0 },
    secondary: { entries: 0, sources: 0 },
    vendor: { entries: 0, sources: 0 },
  };
  const examplesByKind: Record<ExampleKind, number> = {
    compile: 0,
    run: 0,
    "expected-compile-failure": 0,
  };
  const examplesByStandard: Record<CppStandard, number> = {
    "c++98": 0,
    "c++03": 0,
    "c++11": 0,
    "c++14": 0,
    "c++17": 0,
    "c++20": 0,
    "c++23": 0,
    "c++26-draft": 0,
  };
  const examplesByVerification: Record<ReferenceVerification, number> = {
    verified: 0,
    unsupported: 0,
    "not-checked": 0,
  };

  for (const entry of entries) {
    byKind[entry.kind] += 1;
    byIntroducedStandard[entry.since ?? "unspecified"] += 1;
    for (const sourceKind of ["primary", "secondary", "vendor"] as const) {
      const sources = entry.sources.filter(
        (source) => source.kind === sourceKind,
      ).length;
      if (sources > 0) bySourceKind[sourceKind].entries += 1;
      bySourceKind[sourceKind].sources += sources;
    }
    for (const example of entry.examples) {
      examplesByKind[example.kind] += 1;
      examplesByStandard[example.standard] += 1;
      examplesByVerification[example.verification] += 1;
    }
  }

  return {
    catalogVersion: readiness.catalogVersion,
    entries: {
      total: entries.length,
      withExamples: entries.filter((entry) => entry.examples.length > 0).length,
      withPrimarySource: entries.filter((entry) =>
        entry.sources.some((source) => source.kind === "primary"),
      ).length,
      byCategory: navigation.categories.map((category) => ({
        id: category.id,
        title: category.title,
        count: category.entryIds.length,
      })),
      byKind,
      byIntroducedStandard,
      bySourceKind,
    },
    examples: {
      total: entries.reduce(
        (total, entry) => total + entry.examples.length,
        0,
      ),
      byKind: examplesByKind,
      byStandard: examplesByStandard,
      byVerification: examplesByVerification,
    },
  };
}
