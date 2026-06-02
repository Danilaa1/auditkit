# Architecture

Audit Kit is a hybrid CLI.

## Rust Core

Rust owns the workflow that should be fast, predictable, and easy to inspect:

- command routing
- audit folder creation
- HTML checks
- security header checks
- report and email generation
- terminal output

Rust source lives in `src/`.

## Node Lighthouse Helper

Lighthouse is a Node ecosystem tool, so Audit Kit keeps that part in Node:

- `scripts/lighthouse.mjs`
- `scripts/auditkit/lighthouse-runner.mjs`

Rust calls the Node helper as a subprocess only when running:

```bash
ak lighthouse latest
ak inspect latest
```

## Module Map

- `src/main.rs`: command router
- `src/audit.rs`: audit input helpers
- `src/workspace.rs`: paths, generated audit files, folder lookup
- `src/templates.rs`: starter markdown files
- `src/html_check.rs`: lightweight HTML feedback
- `src/security.rs`: security header feedback
- `src/report.rs`: final report and client email
- `src/lighthouse.rs`: bridge to the Node Lighthouse helper
- `src/ui.rs`: terminal output helpers

The code is intentionally plain. Each file owns one small part of the workflow.
