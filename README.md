# Audit Kit

Fast local website audits for freelancers and agencies. Run HTML, security, Lighthouse, and report-generation workflows from one small CLI.

[Sponsor Audit Kit](https://github.com/sponsors/Danilaa1)

```text
╭──────────────────────── Audit Kit ────────────────────────╮
│ ak check        guided one-off website audit               │
│ ak check --save choose where the audit files should go     │
│ ak new          create a reusable client workspace          │
╰────────────────────────────────────────────────────────────╯
```

## Install

```bash
npm install -g auditkit
# or
bun add -g auditkit
```

Requirements:

- Rust + `cargo` (Audit Kit builds its native CLI on first run; install from [rustup.rs](https://rustup.rs))
- Node.js 24+
- Chrome, Chromium, Brave, Edge, or Helium for Lighthouse

## Quick start

```bash
ak check
```

Audit Kit asks for the website, runs the check, then asks where to save the markdown files.

```text
› Website URL (https://example.com) https://example.com
✓ Fetching website and reading HTML
› Save this check as markdown? (Y/n) y
› Save folder (./auditkit-example-com) ~/audits/example
✓ saved /Users/you/audits/example/automated-check.md
```

## Save anywhere

```bash
ak check https://example.com --save ~/audits/example
ak security https://example.com --save ~/audits/example
ak lighthouse https://example.com --save ~/audits/example
ak inspect https://example.com --save ~/audits/example
```

Saved files use simple names:

```text
~/audits/example/
├─ automated-check.md
├─ security-check.md
├─ lighthouse.md
└─ lighthouse.json
```

## Full client workflow

```bash
ak new
ak inspect latest
ak report latest
```

That creates an audit workspace, runs every check, then writes:

```text
audits/<date-client>/
├─ workspace.md
├─ findings.md
├─ final-report.md
├─ client-email.md
└─ raw/lighthouse.json
```

## Commands

| Command | Use |
| --- | --- |
| `ak check` | guided HTML/SEO basics check |
| `ak check <url> --save <folder>` | save check markdown to any folder |
| `ak security <url> --save <folder>` | save security header audit |
| `ak lighthouse <url> --save <folder>` | save Lighthouse markdown + JSON |
| `ak inspect <url> --save <folder>` | run and save every automated check |
| `ak new` | create a client audit workspace |
| `ak inspect latest` | run all checks for the newest workspace |
| `ak report latest` | create the final report and client email |
| `ak list` | list audit workspaces |

## Browser override

```bash
AUDITKIT_BROWSER_PATH="/path/to/browser" ak lighthouse https://example.com
```

## Development

```bash
npm test
cargo test
```

Architecture notes live in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
