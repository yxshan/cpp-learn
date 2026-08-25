type CppTokenKind =
  | "word"
  | "number"
  | "literal"
  | "preprocessor"
  | "line-comment"
  | "block-comment"
  | "symbol";

interface CppToken {
  readonly kind: CppTokenKind;
  readonly value: string;
}

const multiCharacterSymbols = [
  "<=>",
  ">>=",
  "<<=",
  "->*",
  "...",
  "::",
  "->",
  ".*",
  "++",
  "--",
  "<<",
  ">>",
  "<=",
  ">=",
  "==",
  "!=",
  "&&",
  "||",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "&=",
  "|=",
  "^=",
  "##",
] as const;

const controlKeywords = new Set([
  "if",
  "for",
  "while",
  "switch",
  "catch",
  "case",
]);
const labelKeywords = new Set([
  "case",
  "default",
  "public",
  "private",
  "protected",
]);
const compactSymbols = new Set(["::", ".", "->", "->*", ".*"]);
const binarySymbols = new Set([
  "=",
  "+",
  "-",
  "*",
  "/",
  "%",
  "<",
  ">",
  "<=",
  ">=",
  "==",
  "!=",
  "&&",
  "||",
  "&",
  "|",
  "^",
  "<<",
  ">>",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "&=",
  "|=",
  "^=",
  "?",
]);
const blockOpeningKeywords = new Set([
  "catch",
  "class",
  "concept",
  "do",
  "else",
  "enum",
  "for",
  "if",
  "namespace",
  "requires",
  "struct",
  "switch",
  "try",
  "union",
  "while",
]);

export function isCppSourcePath(path: string): boolean {
  return /\.(?:c|cc|cpp|cxx|h|hh|hpp|hxx)$/i.test(path);
}

function readQuotedLiteral(
  source: string,
  start: number,
  quoteIndex: number,
): number {
  const quote = source[quoteIndex];
  let index = quoteIndex + 1;
  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2;
      continue;
    }
    if (source[index] === quote) return index + 1;
    index += 1;
  }
  return Math.max(start + 1, source.length);
}

function readRawLiteral(source: string, markerIndex: number): number {
  const delimiterStart = markerIndex + 2;
  const bodyStart = source.indexOf("(", delimiterStart);
  if (bodyStart < 0) return source.length;
  const delimiter = source.slice(delimiterStart, bodyStart);
  const closing = `)${delimiter}"`;
  const end = source.indexOf(closing, bodyStart + 1);
  return end < 0 ? source.length : end + closing.length;
}

function readLiteralSuffix(source: string, literalEnd: number): number {
  if (!/[A-Za-z_]/.test(source[literalEnd] ?? "")) return literalEnd;
  let end = literalEnd + 1;
  while (end < source.length && /[A-Za-z0-9_]/.test(source[end] ?? ""))
    end += 1;
  return end;
}

function tokenizeCpp(source: string): readonly CppToken[] {
  const tokens: CppToken[] = [];
  let index = 0;
  let lineStart = true;
  while (index < source.length) {
    const character = source[index] ?? "";
    if (/\s/.test(character)) {
      if (character === "\n") lineStart = true;
      index += 1;
      continue;
    }
    if (lineStart && character === "#") {
      let end = index;
      do {
        end = source.indexOf("\n", end);
        if (end < 0) {
          end = source.length;
          break;
        }
        const prior = source.slice(index, end).match(/\\+$/)?.[0].length ?? 0;
        end += 1;
        if (prior % 2 === 0) break;
      } while (end < source.length);
      tokens.push({
        kind: "preprocessor",
        value: source.slice(index, end).trimEnd(),
      });
      index = end;
      lineStart = true;
      continue;
    }
    lineStart = false;
    if (source.startsWith("//", index)) {
      const end = source.indexOf("\n", index + 2);
      tokens.push({
        kind: "line-comment",
        value: source.slice(index, end < 0 ? source.length : end).trimEnd(),
      });
      index = end < 0 ? source.length : end + 1;
      lineStart = true;
      continue;
    }
    if (source.startsWith("/*", index)) {
      const closing = source.indexOf("*/", index + 2);
      const end = closing < 0 ? source.length : closing + 2;
      tokens.push({ kind: "block-comment", value: source.slice(index, end) });
      index = end;
      continue;
    }

    const rawPrefix = /^(?:u8|u|U|L)?R"/.exec(source.slice(index));
    if (rawPrefix) {
      const markerIndex = index + rawPrefix[0].length - 2;
      const end = readLiteralSuffix(
        source,
        readRawLiteral(source, markerIndex),
      );
      tokens.push({ kind: "literal", value: source.slice(index, end) });
      index = end;
      continue;
    }
    const quotePrefix = /^(?:u8|u|U|L)?(["'])/.exec(source.slice(index));
    if (quotePrefix) {
      const quoteIndex = index + quotePrefix[0].length - 1;
      const end = readLiteralSuffix(
        source,
        readQuotedLiteral(source, index, quoteIndex),
      );
      tokens.push({ kind: "literal", value: source.slice(index, end) });
      index = end;
      continue;
    }
    if (/[A-Za-z_]/.test(character)) {
      let end = index + 1;
      while (end < source.length && /[A-Za-z0-9_]/.test(source[end] ?? ""))
        end += 1;
      tokens.push({ kind: "word", value: source.slice(index, end) });
      index = end;
      continue;
    }
    if (/\d/.test(character)) {
      let end = index + 1;
      while (end < source.length) {
        const candidate = source[end] ?? "";
        if (/[A-Za-z0-9_.']/.test(candidate)) {
          end += 1;
          continue;
        }
        if (
          (candidate === "+" || candidate === "-") &&
          /[eEpP]/.test(source[end - 1] ?? "")
        ) {
          end += 1;
          continue;
        }
        break;
      }
      tokens.push({ kind: "number", value: source.slice(index, end) });
      index = end;
      continue;
    }
    const symbol = multiCharacterSymbols.find((candidate) =>
      source.startsWith(candidate, index),
    );
    tokens.push({ kind: "symbol", value: symbol ?? character });
    index += symbol?.length ?? 1;
  }
  return tokens;
}

function isTemplateOpening(
  tokens: readonly CppToken[],
  index: number,
): boolean {
  const previous = tokens[index - 1];
  if (
    !previous ||
    (previous.kind !== "word" &&
      previous.value !== ">" &&
      previous.value !== ">>" &&
      previous.value !== "::")
  ) {
    return false;
  }
  let depth = 0;
  for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
    const value = tokens[cursor]?.value;
    if (value === "<") depth += 1;
    if (value === ">" || value === ">>") {
      if (depth === 0) return true;
      depth -= value === ">>" ? 2 : 1;
    }
    if ([";", "{", "}", ")"].includes(value ?? "")) return false;
  }
  return false;
}

function isArrayDeclaratorClosing(
  tokens: readonly CppToken[],
  closingIndex: number,
): boolean {
  let depth = 0;
  for (let index = closingIndex - 1; index >= 0; index -= 1) {
    const token = tokens[index];
    if (token?.value === "]") depth += 1;
    if (token?.value !== "[") continue;
    if (depth > 0) {
      depth -= 1;
      continue;
    }
    const prior = tokens[index - 1];
    return prior?.kind === "word" || prior?.value === "]";
  }
  return false;
}

function isBlockOpening(
  tokens: readonly CppToken[],
  index: number,
  currentLine: string,
): boolean {
  const previous = tokens[index - 1];
  if (!previous || currentLine.trim().length === 0) return true;
  if (previous.value === ")") return true;
  if (previous.value === "}" && currentLine.includes(")")) return true;
  if (previous.value === "]")
    return !isArrayDeclaratorClosing(tokens, index - 1);

  const lineTokens: CppToken[] = [];
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const token = tokens[cursor];
    if (!token || [";", "{", "}"].includes(token.value)) break;
    lineTokens.push(token);
  }
  if (
    lineTokens.some(
      (token) => token.kind === "word" && blockOpeningKeywords.has(token.value),
    )
  ) {
    return true;
  }

  const containsParameters = lineTokens.some((token) => token.value === ")");
  const containsConstructorSeparator = lineTokens.some(
    (token) => token.value === ":",
  );
  return containsParameters && !containsConstructorSeparator;
}

export function formatCppSource(source: string): string {
  if (source.trim().length === 0) return "";
  const tokens = tokenizeCpp(source.replace(/\r\n?/g, "\n"));
  const lines: string[] = [];
  let line = "";
  let indentation = 0;
  let parentheses = 0;
  let templateDepth = 0;
  let isCaseLabel = false;
  let caseTernaryDepth = 0;
  const caseBodyIndentations: number[] = [];
  const braceKinds: ("block" | "initializer")[] = [];
  let previous: CppToken | undefined;

  const append = (value: string, spaceBefore = false): void => {
    if (spaceBefore && line.length > 0 && !line.endsWith(" ")) line += " ";
    line += value;
  };
  const finishLine = (allowBlank = false): void => {
    const content = line.trimEnd();
    if (content.length > 0) {
      lines.push(
        `${"  ".repeat(Math.max(0, indentation))}${content.trimStart()}`,
      );
    } else if (allowBlank && lines.at(-1) !== "") {
      lines.push("");
    }
    line = "";
  };
  const nextNonComment = (start: number): CppToken | undefined =>
    tokens.slice(start).find((token) => !token.kind.endsWith("comment"));
  const isUnaryPosition = (prior: CppToken | undefined): boolean =>
    !prior ||
    [
      "(",
      "[",
      "{",
      ",",
      ";",
      "=",
      "+",
      "-",
      "*",
      "/",
      "%",
      "!",
      "~",
      "?",
      ":",
      "&&",
      "||",
    ].includes(prior.value) ||
    (prior.kind === "word" &&
      ["return", "throw", "case", "co_return"].includes(prior.value));

  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex];
    if (!token) continue;
    const next = tokens[tokenIndex + 1];

    if (token.kind === "preprocessor") {
      finishLine();
      lines.push(token.value);
      if (next?.kind !== "preprocessor") finishLine(true);
      previous = token;
      continue;
    }
    if (token.kind === "line-comment" || token.kind === "block-comment") {
      append(token.value, line.length > 0);
      finishLine();
      previous = token;
      continue;
    }
    if (token.value === "{") {
      if (!isBlockOpening(tokens, tokenIndex, line)) {
        line = line.trimEnd();
        append(
          "{",
          previous?.value === "=" ||
            previous?.value === "," ||
            previous?.value === "return",
        );
        braceKinds.push("initializer");
        previous = token;
        continue;
      }
      braceKinds.push("block");
      append("{", line.length > 0);
      finishLine();
      indentation += 1;
      previous = token;
      continue;
    }
    if (token.value === "}") {
      if (braceKinds.pop() === "initializer") {
        line = line.trimEnd();
        append("}");
        previous = token;
        continue;
      }
      finishLine();
      if (caseBodyIndentations.at(-1) === indentation - 1) {
        indentation -= 1;
        caseBodyIndentations.pop();
      }
      indentation = Math.max(0, indentation - 1);
      append("}");
      if (
        !next ||
        (![";", ",", ")", "]"].includes(next.value) &&
          !["else", "catch", "while"].includes(next.value))
      ) {
        finishLine();
      }
      previous = token;
      continue;
    }
    if (token.value === ";") {
      append(";");
      if (parentheses === 0) finishLine();
      previous = token;
      continue;
    }
    if (token.value === "(") {
      append(
        "(",
        previous?.kind === "word" && controlKeywords.has(previous.value),
      );
      parentheses += 1;
      previous = token;
      continue;
    }
    if (token.value === ")") {
      line = line.trimEnd();
      append(")");
      parentheses = Math.max(0, parentheses - 1);
      previous = token;
      continue;
    }
    if (token.value === "[") {
      append("[");
      previous = token;
      continue;
    }
    if (token.value === "]") {
      line = line.trimEnd();
      append("]");
      previous = token;
      continue;
    }
    if (token.value === ",") {
      append(",");
      previous = token;
      continue;
    }
    if (token.value === ":") {
      if (isCaseLabel && caseTernaryDepth > 0) {
        append(":", true);
        line += " ";
        caseTernaryDepth -= 1;
      } else if (isCaseLabel) {
        append(":");
        finishLine();
        caseBodyIndentations.push(indentation);
        indentation += 1;
        isCaseLabel = false;
      } else if (
        previous?.kind === "word" &&
        labelKeywords.has(previous.value)
      ) {
        append(":");
        finishLine();
      } else {
        append(":", true);
        line += " ";
      }
      previous = token;
      continue;
    }

    if (
      token.kind === "word" &&
      (token.value === "case" || token.value === "default") &&
      line.trim().length === 0
    ) {
      if (caseBodyIndentations.at(-1) === indentation - 1) {
        indentation -= 1;
        caseBodyIndentations.pop();
      }
      isCaseLabel = true;
      caseTernaryDepth = 0;
    }

    if (token.kind === "symbol") {
      if (isCaseLabel && token.value === "?") caseTernaryDepth += 1;
      if (token.value === "<" && isTemplateOpening(tokens, tokenIndex)) {
        append("<");
        templateDepth += 1;
      } else if (token.value === ">" && templateDepth > 0) {
        line = line.trimEnd();
        append(">");
        templateDepth -= 1;
      } else if (token.value === ">>" && templateDepth > 0) {
        line = line.trimEnd();
        append(">>");
        templateDepth = Math.max(0, templateDepth - 2);
      } else if (compactSymbols.has(token.value)) {
        line = line.trimEnd();
        append(token.value);
      } else if (
        ["++", "--", "!", "~"].includes(token.value) ||
        (["+", "-", "*", "&"].includes(token.value) &&
          isUnaryPosition(previous))
      ) {
        append(
          token.value,
          previous?.kind === "word" ||
            previous?.kind === "number" ||
            previous?.kind === "literal" ||
            previous?.value === ")" ||
            previous?.value === "]" ||
            previous?.value === "," ||
            previous?.value === ";",
        );
      } else if (binarySymbols.has(token.value)) {
        append(token.value, true);
        line += " ";
      } else {
        append(token.value);
      }
      previous = token;
      continue;
    }

    const priorValue = previous?.value;
    const needsSpace =
      line.length > 0 &&
      (previous?.kind === "word" ||
        previous?.kind === "number" ||
        previous?.kind === "literal" ||
        priorValue === ")" ||
        priorValue === "]" ||
        priorValue === ">" ||
        priorValue === ">>" ||
        priorValue === "," ||
        priorValue === ";" ||
        priorValue === "}");
    append(token.value, needsSpace);
    previous = token;

    if (
      token.kind === "word" &&
      ["else", "catch"].includes(token.value) &&
      nextNonComment(tokenIndex + 1)?.value === "{"
    ) {
      // The opening brace branch supplies the separating space.
    }
  }
  finishLine();
  while (lines.at(-1) === "") lines.pop();
  return `${lines.join("\n")}\n`;
}
