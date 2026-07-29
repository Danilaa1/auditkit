# Audit Kit

Fast, client-ready website audits from one TypeScript CLI.

[Sponsor Audit Kit](https://github.com/sponsors/Danilaa1)

```text
ak example.com
```

That one command runs the HTML, security, performance, accessibility, best-practices, and SEO checks. Audit Kit shows a clear terminal summary and asks whether to save the reports.

## Install

```bash
npm install -g auditkit
```

Requirements:

- Node.js 24 or newer
- Chrome, Chromium, Brave, Edge, or Helium for Lighthouse

No Rust toolchain or build step is needed.

## Common workflows

Run a complete one-off audit:

```bash
ak example.com
ak example.com --save ./example-audit
```

Run one focused check:

```bash
ak check example.com
ak security example.com
ak lighthouse example.com
```

Create a reusable client workspace:

```bash
ak new
ak inspect latest
ak report latest
```

Workspaces live in the current directory:

```text
audits/2026-07-29-example/
├─ brief.md
├─ workspace.md
├─ findings.md
├─ final-report.md
├─ client-email.md
└─ raw/lighthouse.json
```

## Commands

| Command | Result |
| --- | --- |
| `ak <url>` | Run the complete audit |
| `ak check [url]` | Check HTML and SEO basics |
| `ak security [url]` | Check security headers |
| `ak lighthouse [url]` | Run Lighthouse |
| `ak new` | Create a client workspace |
| `ak inspect [latest\|workspace]` | Run every check and update a workspace |
| `ak report [latest\|workspace]` | Build the report and client email |
| `ak list` | List workspaces |

Add `--save [folder]` to any audit command. Use an existing workspace name or `latest` to save into a workspace.

```bash
ak check example.com --save ./example-audit
ak security example.com --save latest
```

Use `ak help <command>` for focused help.

## Browser override

```bash
AUDITKIT_BROWSER_PATH="/path/to/browser" ak lighthouse example.com
```

## Report settings

Audit Kit reads `auditkit.config.json` from the directory where you run it. The included file shows the supported agency name, auditor name, and service pricing fields.

## Development

```bash
npm install
npm test
node src/cli.ts --help
```

The CLI runs TypeScript directly on Node 24. There is no generated build folder. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the code map.
