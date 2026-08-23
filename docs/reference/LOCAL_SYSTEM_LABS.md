# Local System Labs Reference

For each operating-system resource, name the owner and terminal cleanup action:

| Resource | Acquisition | Required terminal action |
|---|---|---|
| File stream | open/construct | close by RAII; remove fixture when required |
| Child process | fork/spawn | wait; kill process group on cancellation |
| Thread | construct | join before observing final shared state |
| Socket | socket/accept | close every endpoint |
| Dynamic port | bind loopback port zero | close listening socket |
| SQLite statement | prepare | finalize |
| SQLite connection | open | close |
| SQLite fixture | create inside Grade root | delete with the Grade root |

Tests bind loopback only, request a dynamic port, avoid external services, and keep artifacts under one per-Grade temporary directory. POSIX behavior verified on macOS/Linux must not be presented as evidence for a Linux-only syscall or tool.
