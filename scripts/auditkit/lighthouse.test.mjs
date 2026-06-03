import test from "node:test";
import assert from "node:assert/strict";
import {
  findBrowserPath,
  formatLighthouseReport,
  summarizeLighthouse,
} from "./lighthouse-runner.mjs";
import { shouldShowWelcome, showWelcome, welcomeMessage } from "./postinstall.mjs";

const lhr = {
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
      description: "Resources are blocking first paint.",
      score: 0.4,
      displayValue: "Potential savings of 350 ms",
    },
    "uses-optimized-images": {
      title: "Efficiently encode images",
      description: "Images could be smaller.",
      score: 0.7,
      displayValue: "Potential savings of 120 KiB",
    },
  },
};

test("summarizeLighthouse extracts scores, vitals, and opportunities", () => {
  const summary = summarizeLighthouse(lhr);

  assert.deepEqual(summary.scores, {
    performance: 87,
    accessibility: 92,
    bestPractices: 78,
    seo: 100,
  });
  assert.equal(summary.vitals.lcp, "1.8 s");
  assert.equal(summary.opportunities.length, 2);
  assert.equal(summary.opportunities[0].title, "Eliminate render-blocking resources");
});

test("formatLighthouseReport renders markdown summary", () => {
  const report = formatLighthouseReport(summarizeLighthouse(lhr));

  assert.match(report, /# Lighthouse Check/);
  assert.match(report, /Performance: 87\/100/);
  assert.match(report, /Eliminate render-blocking resources/);
});

test("findBrowserPath prefers explicit config path", () => {
  assert.equal(
    findBrowserPath({
      env: {},
      config: { browserPath: "/Applications/Helium.app/Contents/MacOS/Helium" },
      exists: () => true,
    }),
    "/Applications/Helium.app/Contents/MacOS/Helium",
  );
});

test("findBrowserPath falls back to Helium app path", () => {
  assert.equal(
    findBrowserPath({
      env: {},
      config: {},
      exists: (value) => value === "/Applications/Helium.app/Contents/MacOS/Helium",
    }),
    "/Applications/Helium.app/Contents/MacOS/Helium",
  );
});

test("postinstall welcome explains first commands", () => {
  const message = welcomeMessage();
  const plainMessage = welcomeMessage({ NO_COLOR: "1" });

  assert.match(message, /Audit Kit/);
  assert.match(message, /ak check/);
  assert.match(message, /ak check --save/);
  assert.match(message, /\x1b\[/);
  assert.doesNotMatch(plainMessage, /\x1b\[/);
  assert.match(plainMessage, /Audit Kit/);
  assert.equal(shouldShowWelcome({}), true);
  assert.equal(shouldShowWelcome({ CI: "true" }), false);
  assert.equal(shouldShowWelcome({ AUDITKIT_SKIP_WELCOME: "1" }), false);
  assert.equal(shouldShowWelcome({ npm_config_loglevel: "silent" }), false);
});

test("postinstall writes welcome to the provided stream", () => {
  let output = "";
  showWelcome({ write: (value) => (output += value) }, { NO_COLOR: "1" });
  assert.match(output, /Audit Kit/);
  assert.match(output, /ak check/);

  output = "";
  showWelcome({ write: (value) => (output += value) }, { CI: "true" });
  assert.equal(output, "");
});
