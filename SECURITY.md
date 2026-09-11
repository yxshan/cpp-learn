# Security policy

## Supported scope

C++ Learn is a local, single-user learning application. The supported deployment
is one process listening on a loopback address, on a machine whose user is
trusted, running curriculum and Reference content that has been reviewed and
committed to this repository.

Nothing outside that scope is supported today. Binding to a non-loopback
address, serving multiple accounts, deploying remotely, importing third-party
curriculum, sharing backups, or executing automatically generated code all
require a new threat model and the isolated Judge adapter described below.

## Reporting a vulnerability

Report suspected vulnerabilities through GitHub's private vulnerability
reporting on `https://github.com/yxshan/cpp-learn` (Security → Report a
vulnerability). If that is unavailable, open a minimal issue that describes the
affected area without including a working exploit, and ask for a private
channel.

Please include the affected version or commit, the deployment model you used,
reproduction steps, and the impact you believe is reachable. Do not include real
credentials, another person's source code, private Judge inputs, or host paths
from your machine.

There is no bug-bounty programme and no response-time guarantee. Findings are
triaged against the severity model in
[`docs/71-CURRENT-SECURITY-AUDIT.md`](docs/71-CURRENT-SECURITY-AUDIT.md), which
also records the accepted risks below.

## Accepted risk: the native Judge is not a sandbox

`modules/judge` compiles and runs learner code with the current operating-system
user's privileges. It uses argument arrays with `shell: false`, a temporary
working directory, a minimal environment, wall-clock and output limits, and
process-group termination. Those controls reduce command injection, runaway
output, and ordinary infinite loops. They do **not** prevent executed code from
reading files that user can read, opening network connections, or consuming
CPU, memory, process slots, and disk until a limit fires.

Treat any C++ you did not write as code that runs on your machine: a snippet
copied from a forum, a chat reply, or an AI answer is exactly that. Read
[`docs/08-SECURITY_AND_PRIVACY.md`](docs/08-SECURITY_AND_PRIVACY.md) before
running anything you did not author. Container or lightweight-VM isolation,
with fail-closed proof, is a prerequisite for any expansion of the trust scope.

## Security gates

```bash
npm run check:security   # production advisories + working tree and history secret scan
npm run test:security    # proves a controlled advisory and a controlled secret both fail
npm run check            # full quality gate; run before merging
```

`check:security` runs in its own CI job. It fails on an unwaived production
advisory, an expired exemption, an exemption that matches nothing, or a secret
finding.

### Dependency exemptions

A production advisory may be waived only by adding an entry to
`security/audit-exemptions.json` with all five fields: `advisoryId`, `package`,
`reason`, `owner`, and `expiresOn` (`YYYY-MM-DD`). An exemption that has expired,
or that no longer matches a reported advisory, fails the gate; renewing it is a
reviewable commit, not a silent edit. Do not run `npm audit fix --force`.

### Secret findings

Findings are reported with a redacted excerpt. A line that must contain a
credential shape — a test fixture, or documentation — carries the inline marker
`security-check:allow`. The marker is a normal diff line, so adding one is
reviewed like any other change.

### Dependency overrides

`package.json` pins `overrides` only to keep a transitive dependency at or above
a released fix, with the reason recorded in
[`docs/71-CURRENT-SECURITY-AUDIT.md`](docs/71-CURRENT-SECURITY-AUDIT.md). A
message that ships code the package manager cannot see — such as a copy of a
library vendored inside another dependency — is redirected at build time so the
lockfile, the advisory database, and the shipped bundle describe the same code.
