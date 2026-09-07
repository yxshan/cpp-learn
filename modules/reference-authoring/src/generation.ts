import Ajv2020, {
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";

import authoringGenerationSchema from "./authoring-generation.schema.json" with { type: "json" };

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

export interface GenerationValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly keyword: string;
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateGeneration = ajv.compile(authoringGenerationSchema);

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

export function replaceMarkdownSection(
  source: string,
  heading: string,
  markdown: string,
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
  if (matches.length !== 1) {
    return {
      ok: false,
      message: `Expected exactly one section heading ${marker}`,
    };
  }
  const start = matches[0]!;
  const nextHeadingOffset = lines
    .slice(start + 1)
    .findIndex((line) => /^##\s+/u.test(line));
  const end =
    nextHeadingOffset < 0 ? lines.length : start + 1 + nextHeadingOffset;
  const body = markdown.trim().split("\n");
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

export { authoringGenerationSchema };
