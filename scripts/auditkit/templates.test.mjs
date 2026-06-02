import test from "node:test";
import assert from "node:assert/strict";
import { createAuditFiles } from "./templates.mjs";

const audit = {
  clientName: "Acme Dental",
  slug: "acme-dental",
  url: "https://acmedental.co.uk",
  goal: "More bookings",
  businessType: "Dental clinic",
  targetCustomer: "Local families",
  conversionAction: "Book consultation",
  knownConcerns: ["Slow mobile homepage", "Low enquiry volume"],
  pages: ["/", "/pricing", "/contact"],
  competitors: ["https://competitor-one.com"],
  createdAt: "2026-06-02",
};

test("createAuditFiles includes production-ready audit workspace files", () => {
  const files = createAuditFiles(audit);

  assert.deepEqual(Object.keys(files).sort(), [
    "brief.md",
    "checklist.md",
    "findings.md",
    "links.md",
    "pages/contact.md",
    "pages/home.md",
    "pages/pricing.md",
    "raw-notes.md",
    "report.md",
    "scorecard.md",
    "status.md",
    "video-script.md",
  ]);
});

test("brief captures website context needed for useful feedback", () => {
  const files = createAuditFiles(audit);

  assert.match(files["brief.md"], /Business type: Dental clinic/);
  assert.match(files["brief.md"], /Target customer: Local families/);
  assert.match(files["brief.md"], /Main conversion action: Book consultation/);
  assert.match(files["brief.md"], /Slow mobile homepage/);
});

test("findings template captures evidence, severity, impact, and effort", () => {
  const files = createAuditFiles(audit);

  assert.match(files["findings.md"], /Category: Performance \/ UX \/ SEO \/ Conversion \/ Trust/);
  assert.match(files["findings.md"], /Severity: Critical \/ High \/ Medium \/ Low/);
  assert.match(files["findings.md"], /Evidence:/);
  assert.match(files["findings.md"], /Business impact:/);
  assert.match(files["findings.md"], /Estimated effort:/);
});

test("page review files are generated from requested pages", () => {
  const files = createAuditFiles(audit);

  assert.match(files["pages/home.md"], /# Homepage Review/);
  assert.match(files["pages/pricing.md"], /# Pricing Review/);
  assert.match(files["pages/contact.md"], /# Contact Review/);
});
