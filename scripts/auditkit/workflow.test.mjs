import test from "node:test";
import assert from "node:assert/strict";
import {
  buildClientEmail,
  buildFinalReport,
  parseBrief,
  renderAutomatedCheck,
  resolveAuditFolderName,
} from "./workflow.mjs";

const config = {
  agencyName: "Origin",
  auditorName: "Daniel White",
  services: {
    audit: "Starting at £299",
    refresh: "Starting at £1,999",
    growth: "Starting at £499/mo",
  },
};

const check = {
  url: "https://acmedental.co.uk/",
  score: 74,
  signals: {
    status: 200,
    bytes: 528,
    durationMs: 86,
    title: { text: "Acme Dental" },
    metaDescription: { present: false },
    h1: { count: 1 },
    images: { missingAlt: 1, total: 2 },
  },
  feedback: ["Missing meta description.", "1 image is missing alt text."],
};

test("parseBrief extracts client and website context", () => {
  const brief = `# Acme Dental Audit Brief

Website: https://acmedental.co.uk
Business type: Dental clinic
Goal: More bookings
Target customer: Local families
Main conversion action: Book consultation
Created: 2026-06-02`;

  assert.deepEqual(parseBrief(brief), {
    clientName: "Acme Dental",
    website: "https://acmedental.co.uk",
    businessType: "Dental clinic",
    goal: "More bookings",
    targetCustomer: "Local families",
    conversionAction: "Book consultation",
    created: "2026-06-02",
  });
});

test("renderAutomatedCheck turns check result into reusable markdown", () => {
  const markdown = renderAutomatedCheck(check);

  assert.match(markdown, /# Automated Check/);
  assert.match(markdown, /Score: 74\/100/);
  assert.match(markdown, /Missing meta description/);
});

test("buildFinalReport combines audit files into a client-facing report", () => {
  const report = buildFinalReport({
    config,
    folderName: "2026-06-02-acme-dental",
    files: {
      "brief.md": "# Acme Dental Audit Brief\n\nWebsite: https://acmedental.co.uk\nGoal: More bookings",
      "scorecard.md": "# Scorecard\n\nPerformance: 6/10",
      "findings.md": "# Findings\n\n## Critical\n\n### F-001 CTA unclear",
      "automated-check.md": renderAutomatedCheck(check),
      "security.md": "# Security Check\n\nScore: 80/100",
      "lighthouse.md": "# Lighthouse Check\n\nPerformance: 87/100",
      "pages/home.md": "# Homepage Review\n\n## CTA\nNeeds stronger booking language.",
    },
  });

  assert.match(report, /# Acme Dental Website Audit/);
  assert.match(report, /Prepared by Daniel White, Origin/);
  assert.match(report, /## Automated Check/);
  assert.match(report, /## Security Check/);
  assert.match(report, /## Lighthouse Check/);
  assert.match(report, /### Homepage Review/);
  assert.match(report, /Refresh: Starting at £1,999/);
});

test("buildClientEmail creates send-ready email draft", () => {
  const email = buildClientEmail({
    config,
    brief: { clientName: "Acme Dental", goal: "More bookings" },
  });

  assert.match(email, /Subject: Website audit for Acme Dental/);
  assert.match(email, /final-report.md/);
  assert.match(email, /video/);
});

test("resolveAuditFolderName supports latest shortcut", () => {
  assert.equal(
    resolveAuditFolderName("latest", ["2026-06-01-old", "2026-06-02-new"]),
    "2026-06-02-new",
  );
  assert.equal(resolveAuditFolderName("2026-06-02-new", ["2026-06-02-new"]), "2026-06-02-new");
});
