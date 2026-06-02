import test from "node:test";
import assert from "node:assert/strict";
import { analyzeSecurityHeaders, formatSecurityReport } from "./security.mjs";

test("analyzeSecurityHeaders scores useful security headers", () => {
  const result = analyzeSecurityHeaders("https://example.com", {
    status: 200,
    headers: new Map([
      ["strict-transport-security", "max-age=31536000"],
      ["content-security-policy", "default-src 'self'"],
      ["x-frame-options", "DENY"],
      ["referrer-policy", "strict-origin-when-cross-origin"],
      ["set-cookie", "session=abc; Secure; HttpOnly; SameSite=Lax"],
    ]),
  });

  assert.equal(result.score, 100);
  assert.equal(result.signals.https, true);
  assert.equal(result.signals.hsts, true);
  assert.equal(result.signals.csp, true);
  assert.match(result.feedback.join("\n"), /HSTS header found/);
});

test("analyzeSecurityHeaders flags missing basics", () => {
  const result = analyzeSecurityHeaders("http://example.com", {
    status: 200,
    headers: new Map(),
  });

  assert.equal(result.score, 25);
  assert.equal(result.signals.https, false);
  assert.match(result.feedback.join("\n"), /Site is not using HTTPS/);
  assert.match(result.feedback.join("\n"), /Missing Content-Security-Policy/);
  assert.match(result.feedback.join("\n"), /Missing X-Frame-Options/);
});

test("formatSecurityReport renders markdown", () => {
  const result = analyzeSecurityHeaders("https://example.com", {
    status: 200,
    headers: new Map([["content-security-policy", "default-src 'self'"]]),
  });

  const report = formatSecurityReport(result);

  assert.match(report, /# Security Check/);
  assert.match(report, /Score:/);
  assert.match(report, /## Feedback/);
});
