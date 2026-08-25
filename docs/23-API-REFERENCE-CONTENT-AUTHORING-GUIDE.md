# C++ API Reference Content Authoring Guide

| Field | Value |
|---|---|
| Document ID | REF-AUTH-001 |
| Version | 1.0 |
| Status | Baseline |
| Owner | Project Maintainer |
| Last updated | 2026-08-25 |

## 1. Audience and purpose

This guide defines how maintainers and future content authors create original,
verifiable C++ Reference Entries. It complements the [Reference Module
Design](22-API-REFERENCE-MODULE-DESIGN.md); the implemented JSON Schema and
`check:reference` content checker are normative for release content.

The Reference serves a learner who knows JavaScript and is learning modern C++
for software, Web, backend, and infrastructure development. It must remain
precise enough for engineering use without reading like copied standardese.

## 2. Authoring principles

- Explain the normal use first, then edge cases and formal detail.
- Separate normative facts from teaching comparisons and recommendations.
- State ownership, lifetime, invalidation, complexity, and exceptions when they
  materially affect correct use.
- Prefer one minimal example and one realistic example over a large demo.
- Use JavaScript comparisons only when they reduce confusion; always state
  where the analogy stops.
- Cite the source used to verify each Entry; do not paste source prose.
- Describe standard availability separately from local compiler support.
- Never describe undefined behavior as a permitted implementation choice.

## 3. Selecting Entry granularity

Create a separate Entry when at least one applies:

- The entity has its own standard-library identity or header role.
- Learners are likely to search for the exact symbol.
- Its preconditions, invalidation, complexity, or overload set needs substantial
  explanation.
- It is linked independently from several Activities or Entries.

Keep a member as an anchor on its owning type page when its behavior is short,
unsurprising, and adequately explained in a member table. Promote the member to
a `member` Entry when the type page becomes difficult to scan or the member has
important traps, such as iterator invalidation.

## 4. Required manifest metadata

Every Entry defines:

- Stable `id`, version, slug, kind, and title.
- Canonical symbol, header, and namespace when applicable.
- Standard availability and explicit draft status.
- Search aliases and categories.
- Related Entry IDs; related Activities declare this Entry through their
  `referenceIds`.
- Markdown content path.
- Original example manifests.
- Primary and optional secondary sources.
- Last verification date.

Aliases should cover real search intent, not keyword stuffing. Useful aliases
include stripped names (`vector`), header form (`<vector>`), Chinese terms
(`动态数组`), and established alternate vocabulary (`哈希表`).

## 5. Markdown template

````markdown
# std::example

一句话说明这个实体解决什么问题。

## 快速信息

- 头文件：`<example>`
- 命名空间：`std`
- 标准：C++20 起
- 本地验证：Apple Clang / libc++，C++20

## 什么时候使用

描述正常场景，并指出一个不适用的场景。

## 声明

```cpp
representative_signature();
```

## 参数

逐项说明语义、约束和所有权。

## 返回值

说明值、引用或迭代器的语义和生命周期。

## 复杂度

使用标准保证的复杂度，不以单机耗时代替。

## 异常与错误

说明异常保证、错误条件和未定义行为前提。

## 生命周期与失效规则

说明指针、引用和迭代器何时失效。

## 示例

使用对应的外部 `.cpp` 示例文件。

## 常见错误

列出可操作的错误模式及其修正。

## 与 JavaScript 的区别

只在确实有帮助时保留本节。

## 相关内容

由 manifest 关系生成，正文仅补充阅读顺序。

## 来源

由 manifest 生成并显示验证时间。
````

If a section does not apply, omit it rather than adding an empty placeholder.
The title, summary, quick information, example, related content, and sources
remain required for ordinary entity Entries.

## 6. Signatures and overloads

- Show representative public declarations, not implementation detail.
- Do not invent parameter names that change the apparent meaning.
- Group overloads by learner-visible behavior.
- Mark omitted overloads and link to the complete group on the same page.
- Preserve `const`, reference qualifiers, constraints, `constexpr`, `noexcept`,
  and return category when they affect use.
- Label exposition-only entities and never present them as callable public API.

## 7. Examples

Example requirements:

- Stored as standalone UTF-8 source files with a trailing newline.
- Deterministic and free from external network, wall-clock, locale, and random
  dependencies.
- Use the minimum required standard and declare it in the manifest.
- Compile with warnings enabled; warnings are treated as content defects.
- Avoid `using namespace std;` in canonical examples.
- Demonstrate the Entry rather than unrelated setup code.
- Avoid undefined behavior, unspecified-output assertions, sleeps, and absolute
  performance claims.
- Use comments to explain intent, not to restate each line.

Every example records whether it is `compile`, `run`, or
`expected-compile-failure`. Every Run example declares bounded stdin when
needed and exact bounded expected stdout. Examples teaching concurrency,
clocks, randomness, locale, or another nondeterministic facility use `compile`
unless they can assert and print a deterministic invariant; the prose explains
the varying behavior instead of making an unstable output claim.

## 8. C++-specific fact checklist

Before review, verify where relevant:

- Required header and namespace.
- First standard, later changes, deprecation, and removal.
- Feature-test macro.
- Template parameters and constraints.
- Value category and ownership transfer.
- Object, reference, iterator, and view lifetime.
- Iterator/reference invalidation.
- Time and space complexity.
- Exception behavior and guarantees.
- Thread-safety implications.
- `constexpr` and `noexcept` status by standard version.
- Undefined, unspecified, or implementation-defined behavior.
- Local Apple Clang/libc++ support without confusing it with standard status.

## 9. Sources and licensing

Use this source order:

1. Published ISO standard reference or current C++ working-draft section.
2. Applicable WG21 paper for a changed or draft feature.
3. cppreference for secondary organization and implementation notes.
4. Compiler or standard-library vendor documentation for local support.

Original prose and examples are the default. If material is reused, record:

- Source title and canonical URL.
- Author or contributor attribution required by the source.
- License and compatible project treatment.
- Which material was reused.
- A concise description of modifications.

Do not copy MDN layout, logos, or visual identity. Do not scrape or translate
cppreference pages into Entries. A link does not require copying its content.

Useful policy references:

- [MDN attribution and licensing](https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Attrib_copyright_license)
- [cppreference licensing](https://en.cppreference.com/Cppreference%3AAbout)
- [ISO C++ standard status](https://isocpp.org/std/the-standard)
- [Current working draft](https://eel.is/c%2B%2Bdraft/)

## 10. Review workflow

1. Reserve the Entry ID and slug in the catalog.
2. Add manifest, Markdown, and example files.
3. Run schema, relationship, link, and source validation.
4. Compile every example with its declared profile.
5. Review technical facts against primary sources.
6. Review the page as a learner: searchability, quick answer, example, traps.
7. Review Chinese terminology against [CONTEXT.md](CONTEXT.md).
8. Add or update the related Activity manifests' `referenceIds`.
9. Merge only after content and Web rendering gates pass.

An AI may draft structure, aliases, or examples, but a maintainer must verify
every signature, standard-status claim, complexity statement, and source before
activation.

## 11. Initial editorial backlog

The first 15 Entries should exercise the full model rather than maximize count:

- Landing: Standard Library, Containers, Algorithms.
- Headers: `<vector>`, `<algorithm>`.
- Types: `std::vector`, `std::string`, `std::string_view`,
  `std::unique_ptr`, `std::optional`.
- Functions: `std::sort`, `std::find`, `std::make_unique`.
- Complex member: `std::vector::push_back`.
- Guide: choosing a sequence container.

The next expansion targets 80–120 Entries across containers, algorithms,
strings, memory, utilities, I/O, filesystem, time, and concurrency.

## 12. Coverage report

Run `npm run report:reference` from the repository root after adding or
reclassifying Entries. The command validates and activates the same filesystem
catalog used by the application, then emits a machine-readable JSON report.

The report covers:

- Entry totals and the number of Entries with examples and primary sources;
- Entry counts by navigation category, Entry kind, and introduction standard;
- source counts and unique Entry coverage for primary, secondary, and vendor
  sources;
- example counts by kind, declared language standard, and current local
  verification status.

`not-checked` means that the catalog instance used for the report has not been
given a local toolchain verification result. It does not mean that an example
failed. `npm run check:reference` remains the release gate that compiles and,
where applicable, runs every declared example.
