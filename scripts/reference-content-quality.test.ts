import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  auditReferenceContent,
  auditReferenceCatalog,
  compareReferenceQualityBaseline,
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
});

describe("Reference quality baseline ratchet", () => {
  const baseline: ReferenceQualityBaseline = {
    schemaVersion: 1,
    catalogVersion: 6,
    knownGaps: [
      { entryId: "std-old", area: "javascript" },
      { entryId: "std-old", area: "lifetime" },
    ],
  };

  it("passes only when the current findings exactly match the reviewed debt", () => {
    expect(
      compareReferenceQualityBaseline({
        catalogVersion: 6,
        findings: baseline.knownGaps,
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
        baseline,
      }),
    ).toEqual({
      newFindings: [{ entryId: "std-new", area: "complexity" }],
      resolvedFindings: [{ entryId: "std-old", area: "javascript" }],
      catalogVersionMatches: false,
    });
  });
});

describe("Reference quality catalog audit", () => {
  it("audits the checked-in catalog through the same public seam as the CLI", async () => {
    const audit = await auditReferenceCatalog(
      resolve("reference", "catalog.json"),
    );

    expect(audit.catalogVersion).toBe(6);
    expect(audit.totalEntryCount).toBe(61);
    expect(audit.auditedEntryCount).toBe(57);
    expect(audit.skippedEntryCount).toBe(4);
    expect(audit.findings.length).toBeGreaterThan(0);
    expect(audit.findings.map(({ entryId }) => entryId)).toEqual(
      [...audit.findings.map(({ entryId }) => entryId)].sort(),
    );
    expect(
      new Set(audit.findings.map(({ entryId, area }) => `${entryId}:${area}`))
        .size,
    ).toBe(audit.findings.length);
  });
});
