/**
 * [SEC-F04] Supply-chain and secret checks.
 *
 * The pure decision logic lives here so `scripts/security-checks.test.ts` can
 * prove that a controlled advisory and a controlled secret both fail the gate;
 * `scripts/check-security.ts` is the thin process wrapper that talks to npm and
 * git.
 */

export interface SecretPattern {
  readonly id: string;
  readonly description: string;
  readonly pattern: RegExp;
}

/**
 * High-signal credential patterns. Anything broader turns the gate into noise,
 * and a noisy gate is a disabled gate.
 */
export const SECRET_PATTERNS: readonly SecretPattern[] = [
  {
    id: "private-key",
    description: "PEM private key block",
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/,
  },
  {
    id: "aws-access-key",
    description: "AWS access key identifier",
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
  },
  {
    id: "github-token",
    description: "GitHub personal access or app token",
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b/,
  },
  {
    id: "openai-key",
    description: "OpenAI API key",
    pattern: /\bsk-[A-Za-z0-9]{20,}\b/,
  },
  {
    id: "slack-token",
    description: "Slack token",
    pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/,
  },
  {
    id: "google-api-key",
    description: "Google API key",
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/,
  },
];

/**
 * A line carrying this marker is skipped. Test fixtures and documentation that
 * must show a credential shape use it, so the marker is part of a reviewable
 * diff rather than a silent exclusion list.
 */
export const ALLOW_MARKER = "security-check:allow";

/** Largest file read as text; larger files are counted as skipped, not scanned. */
export const MAX_SCANNED_BYTES = 2 * 1024 * 1024;

export interface SecretFinding {
  readonly path: string;
  readonly line: number;
  readonly patternId: string;
  readonly description: string;
  /** Redacted excerpt: never enough of a live credential to be reusable. */
  readonly preview: string;
}

export function looksBinary(text: string): boolean {
  return text.includes("\u0000");
}

export function redact(value: string): string {
  if (value.length <= 8) return `${value.slice(0, 2)}…(${value.length})`;
  return `${value.slice(0, 4)}…${value.slice(-2)}(${value.length})`;
}

export function scanText(path: string, text: string): SecretFinding[] {
  if (looksBinary(text)) return [];
  const findings: SecretFinding[] = [];
  const lines = text.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (line.includes(ALLOW_MARKER)) continue;
    for (const { id, description, pattern } of SECRET_PATTERNS) {
      const match = pattern.exec(line);
      if (!match) continue;
      findings.push({
        path,
        line: index + 1,
        patternId: id,
        description,
        preview: redact(match[0]),
      });
    }
  }
  return findings;
}

export interface ScannedFile {
  readonly path: string;
  readonly text: string;
}

export interface SecretScanResult {
  readonly findings: readonly SecretFinding[];
  readonly skipped: readonly string[];
}

export function scanFiles(
  files: readonly ScannedFile[],
  skipped: readonly string[] = [],
): SecretScanResult {
  return {
    findings: files.flatMap((file) => scanText(file.path, file.text)),
    skipped,
  };
}

export interface AuditExemption {
  readonly advisoryId: string;
  readonly package: string;
  readonly reason: string;
  readonly owner: string;
  /** Inclusive `YYYY-MM-DD` expiry; an expired exemption is a gate failure. */
  readonly expiresOn: string;
}

export interface AuditExemptionsFile {
  readonly schemaVersion: 1;
  readonly exemptions: readonly AuditExemption[];
}

export interface AuditAdvisory {
  readonly advisoryId: string;
  readonly package: string;
  readonly severity: string;
  readonly title: string;
}

export interface AuditEvaluation {
  readonly advisories: readonly AuditAdvisory[];
  readonly waived: readonly {
    readonly advisory: AuditAdvisory;
    readonly exemption: AuditExemption;
  }[];
  readonly failures: readonly AuditAdvisory[];
  /** Exemptions already past their expiry date. */
  readonly expired: readonly AuditExemption[];
  /** Exemptions that no longer match anything reported; they must be deleted. */
  readonly stale: readonly AuditExemption[];
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function parseExemptions(value: unknown): AuditExemptionsFile {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Audit exemption file must be a JSON object");
  }
  const record = value as Record<string, unknown>;
  if (record["schemaVersion"] !== 1) {
    throw new Error("Audit exemption file must declare schemaVersion 1");
  }
  const raw = record["exemptions"];
  if (!Array.isArray(raw)) {
    throw new Error("Audit exemption file must list exemptions");
  }
  return {
    schemaVersion: 1,
    exemptions: raw.map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        throw new Error("Each audit exemption must be an object");
      }
      const candidate = entry as Record<string, unknown>;
      for (const field of [
        "advisoryId",
        "package",
        "reason",
        "owner",
        "expiresOn",
      ] as const) {
        const fieldValue = candidate[field];
        if (typeof fieldValue !== "string" || fieldValue.trim() === "") {
          throw new Error(
            `Audit exemption ${field} must be a non-empty string`,
          );
        }
      }
      const expiresOn = candidate["expiresOn"] as string;
      if (!DATE_ONLY.test(expiresOn)) {
        throw new Error(
          `Audit exemption expiresOn must be YYYY-MM-DD, received ${expiresOn}`,
        );
      }
      return {
        advisoryId: candidate["advisoryId"] as string,
        package: candidate["package"] as string,
        reason: candidate["reason"] as string,
        owner: candidate["owner"] as string,
        expiresOn,
      };
    }),
  };
}

const GHSA_URL = /\/advisories\/(GHSA-[0-9a-z-]+)/i;

/**
 * Read `npm audit --json` output into a flat advisory list.
 *
 * A vulnerability that arrives without an advisory identifier is reported as
 * `npm:<package>` so it still fails the gate and can still be exempted.
 */
export function auditAdvisories(report: unknown): AuditAdvisory[] {
  if (typeof report !== "object" || report === null) {
    throw new Error("npm audit output must be a JSON object");
  }
  const vulnerabilities = (report as Record<string, unknown>)[
    "vulnerabilities"
  ];
  if (vulnerabilities === undefined) return [];
  if (typeof vulnerabilities !== "object" || vulnerabilities === null) {
    throw new Error("npm audit vulnerabilities must be an object");
  }
  const advisories: AuditAdvisory[] = [];
  for (const [packageName, entry] of Object.entries(vulnerabilities)) {
    if (typeof entry !== "object" || entry === null) continue;
    const candidate = entry as Record<string, unknown>;
    const severity =
      typeof candidate["severity"] === "string"
        ? candidate["severity"]
        : "unknown";
    const via = Array.isArray(candidate["via"]) ? candidate["via"] : [];
    let identified = false;
    for (const item of via) {
      if (typeof item !== "object" || item === null) continue;
      const source = item as Record<string, unknown>;
      const url = typeof source["url"] === "string" ? source["url"] : "";
      const match = GHSA_URL.exec(url);
      if (!match) continue;
      identified = true;
      advisories.push({
        advisoryId: (match[1] as string).toUpperCase(),
        package: packageName,
        severity,
        title: typeof source["title"] === "string" ? source["title"] : "",
      });
    }
    if (!identified) {
      advisories.push({
        advisoryId: `npm:${packageName}`,
        package: packageName,
        severity,
        title: "Vulnerability reported without an advisory identifier",
      });
    }
  }
  return advisories;
}

export function evaluateAudit(input: {
  readonly report: unknown;
  readonly exemptions: readonly AuditExemption[];
  /** Inclusive expiry comparison date, `YYYY-MM-DD`. */
  readonly today: string;
}): AuditEvaluation {
  const advisories = auditAdvisories(input.report);
  const waived: { advisory: AuditAdvisory; exemption: AuditExemption }[] = [];
  const failures: AuditAdvisory[] = [];
  const used = new Set<AuditExemption>();

  for (const advisory of advisories) {
    const exemption = input.exemptions.find(
      (candidate) =>
        candidate.advisoryId === advisory.advisoryId &&
        candidate.package === advisory.package,
    );
    if (!exemption) {
      failures.push(advisory);
      continue;
    }
    used.add(exemption);
    waived.push({ advisory, exemption });
  }

  return {
    advisories,
    waived,
    failures,
    expired: input.exemptions.filter(
      (exemption) => exemption.expiresOn < input.today,
    ),
    stale: input.exemptions.filter((exemption) => !used.has(exemption)),
  };
}

export function formatSecretFinding(finding: SecretFinding): string {
  return `${finding.path}:${finding.line} ${finding.patternId} (${finding.description}) ${finding.preview}`;
}
