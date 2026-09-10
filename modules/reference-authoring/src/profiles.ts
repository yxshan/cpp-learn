import type { ReferenceEntryKind } from "@cpp-learn/contracts";

import type { AuthoringFactKind, AuthoringProfile } from "./index.ts";

/**
 * Entry-kind profiles.
 *
 * A profile decides which sections the scaffolder generates, which authoring
 * fact groups back them, and how many examples an Entry needs. The quality gate
 * reads the same document vocabulary through `@cpp-learn/reference-policy`, so
 * a scaffolded Entry already satisfies the areas the gate requires.
 */

export const PROFILE_BY_KIND: Readonly<
  Record<ReferenceEntryKind, AuthoringProfile>
> = {
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

export const PROFILE_DEFINITIONS: Readonly<
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

export function contentTemplate(
  title: string,
  profile: AuthoringProfile,
): string {
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

export function exampleTemplate(label: "minimal" | "realistic"): string {
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
