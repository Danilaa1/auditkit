# Architecture

Audit Kit is a TypeScript-only Node.js CLI.

## Flow

```text
terminal
  -> src/cli.ts
  -> website fetch
  -> HTML + security analysis
  -> Lighthouse
  -> terminal summary or saved markdown/JSON
```

Node 24 runs the `.ts` files directly. TypeScript is a development-only dependency used for strict type checking; there is no compile step or generated runtime code.

## Source map

- `src/cli.ts`: arguments, prompts, commands, save routing, and exit behavior
- `src/checks.ts`: shared website fetch plus HTML and security checks
- `src/lighthouse.ts`: browser discovery, Lighthouse execution, and summaries
- `src/workspace.ts`: client folders, templates, and markdown updates
- `src/report.ts`: final report, agency config, and client email
- `src/ui.ts`: terminal hierarchy, color, prompts, progress, and errors

The CLI uses Node built-ins for networking, files, paths, prompts, and tests. Lighthouse and Chrome Launcher remain the only runtime dependencies because those jobs belong to their ecosystem.

## Workspace model

`ak new`, `ak list`, `ak inspect latest`, and `ak report latest` use `./audits` relative to the directory where the command runs. This keeps client data beside the project instead of inside a global npm installation.

Generated audit folders stay ignored by Git except for `audits/.gitkeep`.
