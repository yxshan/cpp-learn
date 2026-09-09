import { Buffer } from "node:buffer";

import Ajv2020, {
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";

import type { CppStandard } from "@cpp-learn/contracts";

import authoringExampleGenerationSchema from "./authoring-example-generation.schema.json" with { type: "json" };
import authoringGenerationSchema from "./authoring-generation.schema.json" with { type: "json" };
import authoringSummaryGenerationSchema from "./authoring-summary-generation.schema.json" with { type: "json" };

export interface AuthoringGenerationClaim {
  readonly id: string;
  readonly text: string;
  readonly factGroupIds: readonly string[];
}

export interface AuthoringSectionGeneration {
  readonly schemaVersion: 1;
  readonly draftId: string;
  readonly contextDigest: string;
  readonly section: {
    readonly heading: string;
    readonly markdown: string;
    readonly claims: readonly AuthoringGenerationClaim[];
  };
}

export interface AuthoringSummaryGeneration {
  readonly schemaVersion: 1;
  readonly draftId: string;
  readonly contextDigest: string;
  readonly summary: {
    readonly text: string;
    readonly claims: readonly AuthoringGenerationClaim[];
  };
}

export interface AuthoringExampleGeneration {
  readonly schemaVersion: 1;
  readonly draftId: string;
  readonly contextDigest: string;
  readonly example: {
    readonly id: string;
    readonly kind: "compile" | "run" | "expected-compile-failure";
    readonly standard: CppStandard;
    readonly stdin?: string;
    readonly expectedStdout?: string;
    readonly expectedDiagnosticCategory?: string;
    readonly source: string;
    readonly claims: readonly AuthoringGenerationClaim[];
  };
}

export type AuthoringGeneration =
  | AuthoringExampleGeneration
  | AuthoringSectionGeneration
  | AuthoringSummaryGeneration;

export type AuthoringGenerationKind = "example" | "section" | "summary";

export function authoringGenerationKind(
  value: unknown,
): AuthoringGenerationKind | "unknown" {
  if (value === null || typeof value !== "object") return "unknown";
  if ("example" in value) return "example";
  if ("summary" in value) return "summary";
  if ("section" in value) return "section";
  return "unknown";
}

export interface GenerationValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly keyword: string;
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateExampleGeneration = ajv.compile(authoringExampleGenerationSchema);
const validateGeneration = ajv.compile(authoringGenerationSchema);
const validateSummaryGeneration = ajv.compile(authoringSummaryGenerationSchema);

function issuePath(error: ErrorObject): string {
  if (error.keyword === "required") {
    return `${error.instancePath}/${String(error.params["missingProperty"])}`;
  }
  return error.instancePath || "/";
}

function validationIssues(
  validator: ValidateFunction,
  value: unknown,
): readonly GenerationValidationIssue[] {
  if (validator(value)) return [];
  return (validator.errors ?? []).map((error) => ({
    path: issuePath(error),
    message: error.message ?? "invalid value",
    keyword: error.keyword,
  }));
}

export function validateAuthoringSectionGeneration(
  value: unknown,
): readonly GenerationValidationIssue[] {
  return validationIssues(validateGeneration, value);
}

export function validateAuthoringSummaryGeneration(
  value: unknown,
): readonly GenerationValidationIssue[] {
  return validationIssues(validateSummaryGeneration, value);
}

export function validateAuthoringExampleGeneration(
  value: unknown,
): readonly GenerationValidationIssue[] {
  const issues = [...validationIssues(validateExampleGeneration, value)];
  if (issues.length > 0) return issues;
  const generation = value as AuthoringExampleGeneration;
  if (Buffer.byteLength(generation.example.source, "utf8") > 128 * 1024) {
    issues.push({
      path: "/example/source",
      message: "must be at most 128 KiB when UTF-8 encoded",
      keyword: "maxBytes",
    });
  }
  return issues;
}

export function replaceMarkdownSection(
  source: string,
  heading: string,
  markdown: string,
  insertionOrder?: readonly string[],
):
  | { readonly ok: true; readonly content: string }
  | { readonly ok: false; readonly message: string } {
  if (markdown.trim().length === 0) {
    return {
      ok: false,
      message: "Generated section Markdown must contain non-whitespace text",
    };
  }
  if (
    /^ {0,3}#{1,2}\s/mu.test(markdown) ||
    /^ {0,3}(?:=+|-+)[ \t]*$/mu.test(markdown)
  ) {
    return {
      ok: false,
      message:
        "Generated section Markdown must not introduce level-one or level-two headings",
    };
  }
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const marker = `## ${heading}`;
  const matches = lines
    .map((line, index) => (line === marker ? index : -1))
    .filter((index) => index >= 0);
  if (
    matches.length > 1 ||
    (matches.length === 0 && insertionOrder === undefined)
  ) {
    return {
      ok: false,
      message: `Expected exactly one section heading ${marker}`,
    };
  }
  const body = markdown.trim().split("\n");
  if (matches.length === 0) {
    const headingIndex = insertionOrder!.indexOf(heading);
    if (headingIndex < 0) {
      return {
        ok: false,
        message: `Section heading ${marker} is not present in the insertion order`,
      };
    }
    let insertionIndex = lines.length;
    for (const nextHeading of insertionOrder!.slice(headingIndex + 1)) {
      const candidate = lines.indexOf(`## ${nextHeading}`);
      if (candidate >= 0) {
        insertionIndex = candidate;
        break;
      }
    }
    const before = lines.slice(0, insertionIndex);
    const after = lines.slice(insertionIndex);
    const content = [
      ...before,
      ...(before.at(-1) === "" ? [] : [""]),
      marker,
      "",
      ...body,
      "",
      ...after,
    ]
      .join("\n")
      .replace(/\n+$/u, "\n");
    return { ok: true, content };
  }
  const start = matches[0]!;
  const nextHeadingOffset = lines
    .slice(start + 1)
    .findIndex((line) => /^##\s+/u.test(line));
  const end =
    nextHeadingOffset < 0 ? lines.length : start + 1 + nextHeadingOffset;
  const content = [
    ...lines.slice(0, start + 1),
    "",
    ...body,
    "",
    ...lines.slice(end),
  ]
    .join("\n")
    .replace(/\n+$/u, "\n");
  return { ok: true, content };
}

export {
  authoringExampleGenerationSchema,
  authoringGenerationSchema,
  authoringSummaryGenerationSchema,
};
