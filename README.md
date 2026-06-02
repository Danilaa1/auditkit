# Audit Kit

Local CLI for creating structured website audit workspaces.

## Commands

Install local terminal commands:

```bash
npm link
```

Then use:

- `ak new` - create a new audit folder
- `ak check latest` - run automated feedback for the latest audit and save it
- `ak security latest` - run security header check for the latest audit and save it
- `ak lighthouse latest` - run Lighthouse for the latest audit and save markdown + JSON
- `ak inspect latest` - run automated feedback, security, and Lighthouse
- `ak check <url>` - fetch a website and print quick feedback
- `ak security <url>` - fetch a website and print security feedback
- `ak lighthouse <url>` - run Lighthouse for a website
- `ak check <url> --save <audit-folder>` - fetch a website and save feedback into an audit
- `ak security <url> --save <audit-folder>` - save security feedback into an audit
- `ak lighthouse <url> --save <audit-folder>` - save Lighthouse output into an audit
- `ak report latest` - generate `final-report.md` and `client-email.md`
- `ak list` - list existing audits

Long form also works:

- `auditkit new`
- `auditkit check latest`
- `auditkit report latest`
- `auditkit list`

NPM scripts still work:

- `npm run audit -- new` - create a new audit folder
- `npm run audit -- check latest` - run automated feedback for the latest audit and save it
- `npm run audit -- check <url>` - fetch a website and print quick feedback
- `npm run audit -- check <url> --save <audit-folder>` - fetch a website and save feedback into an audit
- `npm run audit -- report latest` - generate `final-report.md` and `client-email.md`
- `npm run audit -- list` - list existing audits

Older aliases still work:

- `npm run audit:new` - create a new audit folder
- `npm run audit:list` - list existing audits
- `npm run audit:check -- <url>` - fetch a website and print quick feedback

Generated audits live in `audits/`.

## Simplest Audit Flow

```bash
ak new
ak inspect latest
ak report latest
```

After `new`, fill in the generated files while reviewing the site:

- `findings.md`
- `scorecard.md`
- `pages/*.md`
- `raw-notes.md`

Then run `report latest` to create:

- `final-report.md`
- `client-email.md`

## Quick Website Check

```bash
ak check https://example.com
```

The check is intentionally lightweight. It reviews basic HTML signals:

- title tag
- meta description
- H1 count
- image alt text
- viewport tag
- canonical link
- obvious CTA language
- initial response time and HTML size

## Lighthouse Requirement

`ak lighthouse` and `ak inspect` need a Chrome-family browser installed:

- Helium
- Google Chrome
- Chromium
- Brave
- Microsoft Edge

If none is installed, Lighthouse cannot run.

Audit Kit auto-detects Helium at:

```text
/Applications/Helium.app/Contents/MacOS/Helium
```

Override browser path when needed:

```bash
AUDITKIT_BROWSER_PATH="/path/to/browser" ak lighthouse https://example.com
```
