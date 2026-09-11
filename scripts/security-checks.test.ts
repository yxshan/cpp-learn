import { describe, expect, it } from "vitest";

import {
  ALLOW_MARKER,
  auditAdvisories,
  evaluateAudit,
  parseExemptions,
  redact,
  scanFiles,
  scanText,
} from "./security-checks.ts";

/** Least-privilege fixtures: shapes only, never a usable credential. */
const AWS_FIXTURE = "AKIAIOSFODNN7EXAMPLE"; // security-check:allow
const PRIVATE_KEY_FIXTURE = "-----BEGIN RSA PRIVATE KEY-----"; // security-check:allow

function auditReport(
  ...advisories: { id: string; package?: string; title?: string }[]
): unknown {
  const byPackage = new Map<string, unknown[]>();
  for (const advisory of advisories) {
    const name = advisory.package ?? "dompurify";
    byPackage.set(name, [
      ...(byPackage.get(name) ?? []),
      {
        source: 1,
        name,
        title: advisory.title ?? "controlled test advisory",
        url: `https://github.com/advisories/${advisory.id}`,
        severity: "moderate",
      },
    ]);
  }
  return {
    auditReportVersion: 2,
    vulnerabilities: Object.fromEntries(
      [...byPackage].map(([name, via]) => [
        name,
        { name, severity: "moderate", via },
      ]),
    ),
  };
}

const exemption = (overrides: Record<string, string> = {}) => ({
  advisoryId: "GHSA-AAAA-BBBB-CCCC",
  package: "dompurify",
  reason: "No upstream release yet; the affected path is unreachable",
  owner: "maintainer",
  expiresOn: "2026-12-31",
  ...overrides,
});

describe("[SEC-F04] production advisory gate", () => {
  it("fails an advisory that has no exemption", () => {
    const evaluation = evaluateAudit({
      report: auditReport({ id: "GHSA-AAAA-BBBB-CCCC" }),
      exemptions: [],
      today: "2026-09-11",
    });

    expect(evaluation.advisories).toHaveLength(1);
    expect(evaluation.failures).toHaveLength(1);
    expect(evaluation.waived).toHaveLength(0);
  });

  it("waives a matching exemption until it expires, then fails it", () => {
    const report = auditReport({ id: "GHSA-AAAA-BBBB-CCCC" });

    const active = evaluateAudit({
      report,
      exemptions: [exemption()],
      today: "2026-09-11",
    });
    expect(active.failures).toHaveLength(0);
    expect(active.waived).toHaveLength(1);
    expect(active.expired).toHaveLength(0);
    expect(active.stale).toHaveLength(0);

    const expired = evaluateAudit({
      report,
      exemptions: [exemption()],
      today: "2027-01-01",
    });
    expect(expired.failures).toHaveLength(0);
    expect(expired.expired).toHaveLength(1);
  });

  it("requires an exemption to name both the advisory and its package", () => {
    const evaluation = evaluateAudit({
      report: auditReport({ id: "GHSA-AAAA-BBBB-CCCC" }),
      exemptions: [exemption({ package: "monaco-editor" })],
      today: "2026-09-11",
    });

    expect(evaluation.failures).toHaveLength(1);
    expect(evaluation.stale).toHaveLength(1);
  });

  it("flags an exemption that matches nothing, so it cannot linger", () => {
    const evaluation = evaluateAudit({
      report: auditReport(),
      exemptions: [exemption()],
      today: "2026-09-11",
    });

    expect(evaluation.advisories).toHaveLength(0);
    expect(evaluation.stale).toHaveLength(1);
  });

  it("fails a vulnerability that carries no advisory identifier", () => {
    const evaluation = evaluateAudit({
      report: {
        vulnerabilities: {
          "some-package": {
            name: "some-package",
            severity: "high",
            via: ["other"],
          },
        },
      },
      exemptions: [],
      today: "2026-09-11",
    });

    expect(evaluation.failures).toEqual([
      {
        advisoryId: "npm:some-package",
        package: "some-package",
        severity: "high",
        title: "Vulnerability reported without an advisory identifier",
      },
    ]);
  });

  it("reads advisories from a clean report as an empty list", () => {
    expect(auditAdvisories({ vulnerabilities: {} })).toEqual([]);
    expect(auditAdvisories({ auditReportVersion: 2 })).toEqual([]);
  });

  it("refuses an exemption file without the auditable fields", () => {
    expect(() => parseExemptions({ schemaVersion: 1 })).toThrow(
      "must list exemptions",
    );
    expect(() => parseExemptions([])).toThrow("must be a JSON object");
    expect(() => parseExemptions({ schemaVersion: 2, exemptions: [] })).toThrow(
      "schemaVersion 1",
    );
    expect(() =>
      parseExemptions({
        schemaVersion: 1,
        exemptions: [exemption({ owner: "" })],
      }),
    ).toThrow("owner must be a non-empty string");
    expect(() =>
      parseExemptions({
        schemaVersion: 1,
        exemptions: [exemption({ expiresOn: "soon" })],
      }),
    ).toThrow("must be YYYY-MM-DD");
  });
});

describe("[SEC-F04] secret gate", () => {
  it("fails a controlled credential fixture with a redacted preview", () => {
    const findings = scanText("src/config.ts", `const key = "${AWS_FIXTURE}";`);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      path: "src/config.ts",
      line: 1,
      patternId: "aws-access-key",
    });
    expect(findings[0]?.preview).not.toContain(AWS_FIXTURE);
    expect(findings[0]?.preview).toContain("AKIA");
  });

  it("fails a controlled private key fixture", () => {
    const findings = scanText("deploy/key.pem", PRIVATE_KEY_FIXTURE);

    expect(findings.map((finding) => finding.patternId)).toEqual([
      "private-key",
    ]);
  });

  it("honours the inline allow marker that fixtures must carry", () => {
    const allowed = `${PRIVATE_KEY_FIXTURE} ${ALLOW_MARKER}`;
    expect(scanText("fixtures.md", allowed)).toEqual([]);

    // Assembled at run time: an unmarked literal would (correctly) fail the
    // repository scan, which is the behaviour this test asserts.
    const unmarked = scanText(
      "fixtures.md",
      `const key = '${"AKIA"}${"IOSFODNN7EXAMPLE"}'`,
    );
    expect(unmarked).toHaveLength(1);
  });

  it("ignores binary content instead of reporting noise", () => {
    expect(scanText("exercises/program", `\u0000${AWS_FIXTURE}`)).toEqual([]);
  });

  it("reports the offending line number", () => {
    const findings = scanText(
      "src/app.ts",
      `const a = 1;\nconst b = "${AWS_FIXTURE}";\n`,
    );

    expect(findings[0]?.line).toBe(2);
  });

  it("carries skipped files through the aggregate result", () => {
    const result = scanFiles(
      [{ path: "clean.ts", text: "const a = 1;\n" }],
      ["binary.bin (binary)"],
    );

    expect(result.findings).toEqual([]);
    expect(result.skipped).toEqual(["binary.bin (binary)"]);
  });

  it("never reveals enough of a credential to be reusable", () => {
    expect(redact(AWS_FIXTURE)).not.toContain("FODNN7EXAMPLE");
    expect(redact("short")).toBe("sh…(5)");
  });
});
