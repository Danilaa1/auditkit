import test from "node:test";
import assert from "node:assert/strict";
import { analyzeHtml, formatFeedback } from "./analyzer.mjs";

test("analyzeHtml flags useful website feedback from raw HTML", () => {
  const html = `<!doctype html>
    <html lang="en">
      <head>
        <title>Acme Dental</title>
        <meta name="description" content="Book family dental care in Brighton.">
      </head>
      <body>
        <h1>Brighton dental care</h1>
        <a href="/contact">Contact us</a>
        <img src="/hero.jpg">
        <img src="/team.jpg" alt="Acme team">
      </body>
    </html>`;

  const result = analyzeHtml("https://acmedental.co.uk", html, {
    status: 200,
    bytes: 512,
    durationMs: 120,
  });

  assert.equal(result.url, "https://acmedental.co.uk");
  assert.equal(result.score, 78);
  assert.deepEqual(result.signals.title, { text: "Acme Dental", length: 11 });
  assert.equal(result.signals.metaDescription.present, true);
  assert.equal(result.signals.h1.count, 1);
  assert.equal(result.signals.images.total, 2);
  assert.equal(result.signals.images.missingAlt, 1);
  assert.match(result.feedback.join("\n"), /1 image is missing alt text/);
  assert.match(result.feedback.join("\n"), /Primary CTA found/);
});

test("analyzeHtml penalizes missing basics", () => {
  const html = `<!doctype html><html><head></head><body><h1>One</h1><h1>Two</h1></body></html>`;

  const result = analyzeHtml("https://example.com", html, {
    status: 200,
    bytes: 260000,
    durationMs: 2100,
  });

  assert.equal(result.score, 30);
  assert.match(result.feedback.join("\n"), /Missing title tag/);
  assert.match(result.feedback.join("\n"), /Missing meta description/);
  assert.match(result.feedback.join("\n"), /Multiple H1 tags found/);
  assert.match(result.feedback.join("\n"), /HTML response is large/);
  assert.match(result.feedback.join("\n"), /Slow initial response/);
});

test("formatFeedback renders concise CLI output", () => {
  const result = analyzeHtml("https://example.com", "<title>Example</title>", {
    status: 200,
    bytes: 128,
    durationMs: 50,
  });

  assert.match(formatFeedback(result), /Audit Kit Check/);
  assert.match(formatFeedback(result), /Score:/);
  assert.match(formatFeedback(result), /Feedback/);
});
