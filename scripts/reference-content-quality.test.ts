import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  auditReferenceContent,
  auditReferenceCatalog,
  compareReferenceQualityBaseline,
  parseReferenceQualityBaseline,
  type ReferenceQualityBaseline,
  type ReferenceQualityInput,
} from "./reference-content-quality.js";

const completeFunction: ReferenceQualityInput = {
  id: "std-demo",
  kind: "function",
  content: `# std::demo

## 快速信息

摘要。

## 什么时候使用

说明选择边界。

## 代表性声明

\`\`\`cpp
int demo(int value);
\`\`\`

## 参数与前置条件

说明参数和约束。

## 返回值

说明结果。

## 复杂度

常数时间。

## 异常、错误与未定义行为

说明失败语义。

## 生命周期与失效规则

说明引用是否失效。

## 示例

两个可运行示例。

## 常见错误

列出误区。

## 与 JavaScript 的区别

给出语义对照。

## 相关内容

继续阅读。

## 来源

标准草案。
`,
  exampleCount: 2,
  primarySourceCount: 1,
  relatedEntryCount: 2,
};

describe("Reference content quality profiles", () => {
  it("accepts a complete function page", () => {
    expect(auditReferenceContent(completeFunction)).toEqual([]);
  });

  it("reports missing function semantics without requiring exact heading wording", () => {
    const findings = auditReferenceContent({
      ...completeFunction,
      content: completeFunction.content
        .replace("## 复杂度\n\n常数时间。\n\n", "")
        .replace("## 与 JavaScript 的区别\n\n给出语义对照。\n\n", ""),
      exampleCount: 1,
      primarySourceCount: 0,
      relatedEntryCount: 1,
    });

    expect(findings).toEqual([
      { entryId: "std-demo", area: "complexity" },
      { entryId: "std-demo", area: "examples" },
      { entryId: "std-demo", area: "javascript" },
      { entryId: "std-demo", area: "related" },
      { entryId: "std-demo", area: "sources" },
    ]);
  });

  it("uses a type profile instead of demanding function-only parameter and return sections", () => {
    const content = completeFunction.content
      .replace("## 代表性声明", "## 接口与主要操作")
      .replace(/## 参数与前置条件[\s\S]*?(?=## 返回值)/, "")
      .replace(/## 返回值[\s\S]*?(?=## 复杂度)/, "");

    expect(
      auditReferenceContent({ ...completeFunction, kind: "type", content }),
    ).toEqual([]);
  });

  it("requires header pages to teach direct inclusion and map their facilities", () => {
    const findings = auditReferenceContent({
      id: "header-demo",
      kind: "header",
      header: "<demo>",
      content: `# <demo>

## 快速信息

C++20 头文件。

## 什么时候包含

用于演示。

## 示例

可运行示例。

## 常见错误

不要遗漏头文件。

## 相关内容

继续阅读。

## 来源

标准草案。
`,
      exampleCount: 1,
      primarySourceCount: 1,
      relatedEntryCount: 2,
    });

    expect(findings).toEqual([
      { entryId: "header-demo", area: "direct-include" },
      { entryId: "header-demo", area: "facility-map" },
    ]);
  });

  it("does not confuse an unrelated example include or table with header guidance", () => {
    const findings = auditReferenceContent({
      id: "header-demo",
      kind: "header",
      header: "<demo>",
      content: `# <demo>

## 快速信息

C++20 头文件。

## 什么时候包含

不要依赖其他头文件的传递包含。

## 主要设施

这里应该解释设施，但还没有设施表。

## 示例

\`\`\`cpp
#include <vector>
\`\`\`

| 输入 | 输出 |
|---|---|
| 1 | 1 |

## 常见错误

不要遗漏头文件。

## 相关内容

继续阅读。

## 来源

标准草案。
`,
      exampleCount: 1,
      primarySourceCount: 1,
      relatedEntryCount: 2,
    });

    expect(findings).toEqual([
      { entryId: "header-demo", area: "direct-include" },
      { entryId: "header-demo", area: "facility-map" },
    ]);
  });

  it("requires version boundaries inside the facility table", () => {
    const findings = auditReferenceContent({
      id: "header-demo",
      kind: "header",
      header: "<demo>",
      content: `# <demo>

## 快速信息

C++20 头文件。

## 直接包含

直接使用时应显式包含：

\`\`\`cpp
#include <demo>
\`\`\`

不要依赖其他头文件的传递包含。

## 主要设施

| 设施 | 说明 | 首次标准 |
|---|---|---|
| demo | 演示 | C++20 |
| demo_later | 后续设施 | — |

## 什么时候使用

需要演示设施时使用。

## 示例

可运行示例。

## 常见错误

不要遗漏头文件。

## 相关内容

继续阅读。

## 来源

标准草案。
`,
      exampleCount: 1,
      primarySourceCount: 1,
      relatedEntryCount: 2,
    });

    expect(findings).toEqual([
      { entryId: "header-demo", area: "facility-map" },
    ]);
  });
});

describe("Reference quality baseline ratchet", () => {
  const baseline: ReferenceQualityBaseline = {
    schemaVersion: 1,
    catalogVersion: 6,
    review: {
      id: "quality-ratchet-batch-7",
      reviewedAt: "2026-08-30",
      fixedPoint: "a2ae587",
      scope: "Inherited catalog debt only.",
    },
    acceptedEntryVersions: { "std-old": 2 },
    knownGaps: [
      { entryId: "std-old", area: "javascript" },
      { entryId: "std-old", area: "lifetime" },
    ],
    notApplicable: [],
  };

  it("passes only when the current findings exactly match the reviewed debt", () => {
    expect(
      compareReferenceQualityBaseline({
        catalogVersion: 6,
        findings: baseline.knownGaps,
        entryVersions: { "std-old": 2 },
        baseline,
      }),
    ).toEqual({
      newFindings: [],
      resolvedFindings: [],
      catalogVersionMatches: true,
    });
  });

  it("reports both new regressions and stale baseline entries", () => {
    expect(
      compareReferenceQualityBaseline({
        catalogVersion: 7,
        findings: [
          { entryId: "std-old", area: "lifetime" },
          { entryId: "std-new", area: "complexity" },
        ],
        entryVersions: { "std-old": 2, "std-new": 1 },
        baseline,
      }),
    ).toEqual({
      newFindings: [{ entryId: "std-new", area: "complexity" }],
      resolvedFindings: [{ entryId: "std-old", area: "javascript" }],
      catalogVersionMatches: false,
    });
  });

  it("accepts a reviewed not-applicable decision but reports a stale one", () => {
    const notApplicable = {
      entryId: "std-no-analogy",
      area: "javascript" as const,
      reason:
        "No JavaScript API has a sufficiently similar observable contract.",
      reviewedAt: "2026-08-30",
    };
    const baselineWithDecision: ReferenceQualityBaseline = {
      ...baseline,
      acceptedEntryVersions: { "std-no-analogy": 1 },
      knownGaps: [],
      notApplicable: [notApplicable],
    };

    expect(
      compareReferenceQualityBaseline({
        catalogVersion: 6,
        findings: [{ entryId: "std-no-analogy", area: "javascript" }],
        entryVersions: { "std-no-analogy": 1 },
        baseline: baselineWithDecision,
      }),
    ).toEqual({
      newFindings: [],
      resolvedFindings: [],
      catalogVersionMatches: true,
    });
    expect(
      compareReferenceQualityBaseline({
        catalogVersion: 6,
        findings: [],
        entryVersions: { "std-no-analogy": 1 },
        baseline: baselineWithDecision,
      }).resolvedFindings,
    ).toEqual([{ entryId: "std-no-analogy", area: "javascript" }]);
  });

  it("invalidates inherited debt when its Entry version changes", () => {
    expect(
      compareReferenceQualityBaseline({
        catalogVersion: 6,
        findings: baseline.knownGaps,
        entryVersions: { "std-old": 3 },
        baseline,
      }),
    ).toEqual({
      newFindings: [
        { entryId: "std-old", area: "lifetime" },
        { entryId: "std-old", area: "javascript" },
      ],
      resolvedFindings: [
        { entryId: "std-old", area: "lifetime" },
        { entryId: "std-old", area: "javascript" },
      ],
      catalogVersionMatches: true,
    });
  });

  it("rejects malformed, duplicate, and overlapping baseline records", () => {
    expect(() =>
      parseReferenceQualityBaseline({ ...baseline, schemaVersion: 2 }),
    ).toThrow(/schemaVersion/u);
    expect(() =>
      parseReferenceQualityBaseline({
        ...baseline,
        knownGaps: [baseline.knownGaps[0], baseline.knownGaps[0]],
      }),
    ).toThrow(/duplicate/u);
    expect(() =>
      parseReferenceQualityBaseline({
        ...baseline,
        notApplicable: [
          {
            ...baseline.knownGaps[0],
            reason: "Not applicable after semantic review.",
            reviewedAt: "2026-08-30",
          },
        ],
      }),
    ).toThrow(/both knownGap and notApplicable/u);
  });
});

describe("Reference quality catalog audit", () => {
  it("keeps the checked-in catalog structurally debt-free through the CLI seam", async () => {
    const audit = await auditReferenceCatalog(
      resolve("reference", "catalog.json"),
    );

    expect(audit.catalogVersion).toBe(13);
    expect(audit.totalEntryCount).toBe(101);
    expect(audit.auditedEntryCount).toBe(97);
    expect(audit.skippedEntryCount).toBe(4);
    expect(audit.findings).toEqual([]);
    expect(audit.entriesWithFindings).toBe(0);
    expect(audit.findingsByArea).toEqual({});
  });
});
