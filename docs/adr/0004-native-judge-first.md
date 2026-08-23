---
status: accepted
---

# Native Judge first, container Adapter later

The initial Judge will execute trusted learner code natively in disposable Worker processes, with argument arrays, temporary roots, environment filtering, timeouts, output limits, and process cleanup. Container or remote Linux execution is deferred behind the Judge seam because requiring it initially would increase setup cost, while native execution must never be described as a strong sandbox.

## Considered Options

- Native execution only.
- Mandatory container execution from the first release.
- Native Adapter first with a later container/Linux Adapter.

## Consequences

The UI and security documentation must disclose native limitations. Third-party or untrusted code is not supported in native mode, and Linux-specific coverage requires the future Adapter.

