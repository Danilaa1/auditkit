import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { analyzeHtml, analyzeSecurity, type FetchedPage } from "../src/checks.ts";
import { parseArgs } from "../src/cli.ts";
import {
  formatLighthouseMarkdown,
  summarizeLighthouse,
  type LighthouseResult,
} from "../src/lighthouse.ts";
import { buildFinalReport, parseBrief } from "../src/report.ts";
import {
  replaceMarkdownSection,
  slugify,
  splitCommaList,
  Workspace,
  type AuditInput,
} from "../src/workspace.ts";

function page(overrides: Partial<FetchedPage> = {}): FetchedPage {
  const html =
    '<title>Acme Dental</title><meta NAME="description" content="Dental care"><h1>Care</h1><a>Book now</a><img src="/x.jpg">';
  return {
    url: "https://example.com/",
    status: 200,
    html,
    bytes: Buffer.byteLength(html),
    headers: new Headers(),
    ...overrides,
  };
}

test("HTML analysis finds actionable SEO feedback", () => {
  const result = analyzeHtml(page());

  assert.equal(result.score, 78);
  assert.equal(result.imageMissingAlt, 1);
  assert.match(
    result.feedback.map((item) => item.text).join("\n"),
    /Primary CTA language found/,
  );
});

test("empty alt attributes count as present", () => {
  const html =
    '<title>Useful page title</title><meta name="description" content="Summary"><meta name="viewport" content="width=device-width"><link rel="canonical" href="/"><h1>Title</h1><button>Book</button><img alt="" src="/shape.svg">';
  const result = analyzeHtml(page({ html, bytes: Buffer.byteLength(html) }));

  assert.equal(result.imageMissingAlt, 0);
  assert.equal(result.score, 100);
});

test("security analysis handles missing and secure headers", () => {
  const missing = analyzeSecurity(page({ url: "http://example.com/" }));
  assert.equal(missing.score, 25);
  assert.equal(missing.secureCookies, null);

  const headers = new Headers({
    "strict-transport-security": "max-age=31536000",
    "content-security-policy": "default-src 'self'",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin",
    "set-cookie": "session=x; Secure; HttpOnly; SameSite=Lax",
  });
  const strong = analyzeSecurity(page({ headers }));
  assert.equal(strong.score, 100);
  assert.equal(strong.secureCookies, true);
});

test("CLI parser supports URL shortcut and optional save value", () => {
  assert.deepEqual(parseArgs(["example.com", "--save", "./audit"]), {
    command: "inspect",
    target: "example.com",
    save: { explicit: true, value: "./audit" },
    noColor: false,
    version: false,
  });
  assert.deepEqual(parseArgs(["check", "example.com", "--save"]).save, {
    explicit: true,
  });
  assert.throws(() => parseArgs(["unknown"]), /Unknown command/);
  assert.throws(() => parseArgs(["new", "extra"]), /does not accept a target/);
});

test("workspace helpers keep names and sections predictable", () => {
  assert.equal(slugify("  My Kind_of Cruise! "), "my-kind-of-cruise");
  assert.deepEqual(splitCommaList("/, /pricing, , /contact"), [
    "/",
    "/pricing",
    "/contact",
  ]);
  const document =
    "# Audit Workspace\n\n## Automated Check\n\nNot run yet.\n\n## Security Check\n\nNot run yet.\n";
  const updated = replaceMarkdownSection(
    document,
    "Automated Check",
    "# Automated Check\n\nScore: 90/100",
  );
  assert.match(updated, /## Automated Check\n\nScore: 90\/100\n\n## Security Check/);
  assert.doesNotMatch(updated, /Not run yet\.\n\n## Security Check/);
});

test("workspace creates source files and refuses to overwrite an audit", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "auditkit-"));
  const workspace = new Workspace(root);
  const audit: AuditInput = {
    clientName: "Acme Dental",
    slug: "acme-dental",
    url: "https://example.com/",
    businessType: "Dental clinic",
    goal: "More bookings",
    targetCustomer: "Local families",
    conversionAction: "Book consultation",
    pages: ["/", "/contact"],
    knownConcerns: ["Slow mobile"],
    competitors: [],
    createdAt: "2026-07-29",
  };

  try {
    const folder = await workspace.createAudit(audit);
    assert.match(await readFile(path.join(folder, "brief.md"), "utf8"), /Acme Dental Audit Brief/);
    assert.deepEqual(await workspace.listAudits(), ["2026-07-29-acme-dental"]);
    await assert.rejects(() => workspace.createAudit(audit));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("report uses workspace checks and produces clean client copy", () => {
  const files = new Map([
    [
      "brief.md",
      "# Acme Dental Audit Brief\n\nWebsite: https://example.com\nGoal: More bookings",
    ],
    [
      "workspace.md",
      "# Audit Workspace\n\n## Scorecard\n\nPerformance: 8/10\n\n## Automated Check\n\nScore: 74/100\n\n## Security Check\n\nScore: 50/100\n\n## Lighthouse Check\n\nPerformance: 87/100\n\n## Page Reviews\n\n### Homepage Review\n\nCTA needs work.\n",
    ],
    ["findings.md", "# Findings\n\n## Critical"],
  ]);
  const config = {
    agencyName: "Origin",
    auditorName: "Daniel White",
    auditPrice: "£299",
    refreshPrice: "£1,999",
    growthPrice: "£499/mo",
  };
  const report = buildFinalReport(config, "2026-acme", files);

  assert.equal(parseBrief(files.get("brief.md")!).clientName, "Acme Dental");
  assert.match(report, /Performance: 8\/10/);
  assert.match(report, /CTA needs work/);
});

test("Lighthouse summary keeps scores, vitals, and opportunities", () => {
  const lhr: LighthouseResult = {
    finalDisplayedUrl: "https://example.com/",
    categories: {
      performance: { score: 0.87 },
      accessibility: { score: 0.92 },
      "best-practices": { score: 0.78 },
      seo: { score: 1 },
    },
    audits: {
      "largest-contentful-paint": { displayValue: "1.8 s" },
      "cumulative-layout-shift": { displayValue: "0.02" },
      "total-blocking-time": { displayValue: "120 ms" },
      "render-blocking-resources": {
        title: "Eliminate render-blocking resources",
        score: 0.4,
        displayValue: "Potential savings of 350 ms",
      },
    },
  };
  const summary = summarizeLighthouse(lhr);

  assert.deepEqual(summary.scores, {
    performance: 87,
    accessibility: 92,
    bestPractices: 78,
    seo: 100,
  });
  assert.equal(summary.vitals.lcp, "1.8 s");
  assert.match(formatLighthouseMarkdown(summary), /Eliminate render-blocking resources/);
});
