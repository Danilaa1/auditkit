import { existsSync } from "node:fs";

const opportunityIds = [
  "render-blocking-resources",
  "unused-javascript",
  "unused-css-rules",
  "uses-optimized-images",
  "modern-image-formats",
  "uses-responsive-images",
  "unminified-javascript",
  "unminified-css",
  "uses-text-compression",
  "server-response-time",
  "redirects",
  "bootup-time",
  "mainthread-work-breakdown",
  "third-party-summary",
];

const browserCandidates = [
  "/Applications/Helium.app/Contents/MacOS/Helium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
];

function section(title) {
  return `\n== ${title} ==`;
}

function formatKeyValue(label, value) {
  return `${label}: ${value}`;
}

function bullet(value) {
  return `- ${value}`;
}

export function findBrowserPath({ env = process.env, config = {}, exists = existsSync } = {}) {
  const candidates = [
    config.browserPath,
    env.AUDITKIT_BROWSER_PATH,
    env.CHROME_PATH,
    ...browserCandidates,
  ].filter(Boolean);

  return candidates.find((candidate) => exists(candidate)) ?? null;
}

function categoryScore(category) {
  if (!category || typeof category.score !== "number") {
    return null;
  }

  return Math.round(category.score * 100);
}

function auditDisplayValue(audits, id) {
  return audits?.[id]?.displayValue ?? "n/a";
}

export function summarizeLighthouse(lhr) {
  const audits = lhr.audits ?? {};
  const opportunities = opportunityIds
    .map((id) => ({ id, ...audits[id] }))
    .filter((audit) => audit.title && typeof audit.score === "number" && audit.score < 0.9)
    .slice(0, 6)
    .map((audit) => ({
      id: audit.id,
      title: audit.title,
      score: Math.round(audit.score * 100),
      displayValue: audit.displayValue ?? "",
      description: audit.description ?? "",
    }));

  return {
    url: lhr.finalDisplayedUrl ?? lhr.finalUrl ?? "",
    scores: {
      performance: categoryScore(lhr.categories?.performance),
      accessibility: categoryScore(lhr.categories?.accessibility),
      bestPractices: categoryScore(lhr.categories?.["best-practices"]),
      seo: categoryScore(lhr.categories?.seo),
    },
    vitals: {
      lcp: auditDisplayValue(audits, "largest-contentful-paint"),
      cls: auditDisplayValue(audits, "cumulative-layout-shift"),
      tbt: auditDisplayValue(audits, "total-blocking-time"),
    },
    opportunities,
  };
}

export function formatLighthouseCli(summary) {
  return [
    section("Lighthouse Check"),
    formatKeyValue("URL", summary.url),
    formatKeyValue("Performance", `${summary.scores.performance ?? "n/a"}/100`),
    formatKeyValue("Accessibility", `${summary.scores.accessibility ?? "n/a"}/100`),
    formatKeyValue("Best practices", `${summary.scores.bestPractices ?? "n/a"}/100`),
    formatKeyValue("SEO", `${summary.scores.seo ?? "n/a"}/100`),
    section("Vitals"),
    formatKeyValue("LCP", summary.vitals.lcp),
    formatKeyValue("CLS", summary.vitals.cls),
    formatKeyValue("TBT", summary.vitals.tbt),
    section("Top Opportunities"),
    ...(summary.opportunities.length
      ? summary.opportunities.map((item) => bullet(`${item.title}${item.displayValue ? ` — ${item.displayValue}` : ""}`))
      : [bullet("No major Lighthouse opportunities found.")]),
  ].join("\n");
}

export function formatLighthouseReport(summary) {
  return `# Lighthouse Check

URL: ${summary.url}

## Scores

- Performance: ${summary.scores.performance ?? "n/a"}/100
- Accessibility: ${summary.scores.accessibility ?? "n/a"}/100
- Best practices: ${summary.scores.bestPractices ?? "n/a"}/100
- SEO: ${summary.scores.seo ?? "n/a"}/100

## Core Web Vitals

- LCP: ${summary.vitals.lcp}
- CLS: ${summary.vitals.cls}
- TBT: ${summary.vitals.tbt}

## Top Opportunities

${
  summary.opportunities.length
    ? summary.opportunities
        .map((item) => `- ${item.title}${item.displayValue ? `: ${item.displayValue}` : ""}`)
        .join("\n")
    : "- No major Lighthouse opportunities found."
}
`;
}

export async function runLighthouse(inputUrl, options = {}) {
  const [{ default: lighthouse }, chromeLauncher] = await Promise.all([
    import("lighthouse"),
    import("chrome-launcher"),
  ]);

  const browserPath = findBrowserPath({ config: options });
  let chrome;

  try {
    chrome = await chromeLauncher.launch({
      chromePath: browserPath ?? undefined,
      chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"],
    });
  } catch (error) {
    if (String(error.message).includes("No Chrome installations found")) {
      throw new Error(
        "No Chrome-compatible browser found. Install Chrome/Chromium/Brave/Edge, or set AUDITKIT_BROWSER_PATH.",
      );
    }

    throw error;
  }

  try {
    const result = await lighthouse(inputUrl, {
      port: chrome.port,
      output: "json",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    });

    const lhr = result.lhr;
    return {
      lhr,
      json: JSON.stringify(lhr, null, 2),
      summary: summarizeLighthouse(lhr),
    };
  } finally {
    await chrome.kill();
  }
}
