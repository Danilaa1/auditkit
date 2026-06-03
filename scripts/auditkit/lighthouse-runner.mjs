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

const colorEnabled = !process.env.NO_COLOR;

function color(code, value) {
  return colorEnabled ? `\x1b[${code}m${value}\x1b[0m` : value;
}

function positive(value) {
  return color("1;32", value);
}

function warning(value) {
  return color("1;33", value);
}

function critical(value) {
  return color("1;31", value);
}

function frame(value) {
  return color("1;36", value);
}

function dim(value) {
  return color("2", value);
}

function toneIcon(tone) {
  if (tone === "positive") {
    return positive("✓");
  }

  if (tone === "warning") {
    return warning("◆");
  }

  return critical("●");
}

function scoreTone(score) {
  if (typeof score !== "number") {
    return "warning";
  }

  if (score >= 85) {
    return "positive";
  }

  if (score >= 65) {
    return "warning";
  }

  return "critical";
}

function numericMetric(value) {
  const match = String(value).match(/[0-9]+(?:\.[0-9]+)?/);
  return match ? Number(match[0]) : null;
}

function lcpTone(value) {
  const metric = numericMetric(value);
  if (metric === null) {
    return "warning";
  }

  if (metric <= 2.5) {
    return "positive";
  }

  if (metric <= 4) {
    return "warning";
  }

  return "critical";
}

function clsTone(value) {
  const metric = numericMetric(value);
  if (metric === null) {
    return "warning";
  }

  if (metric <= 0.1) {
    return "positive";
  }

  if (metric <= 0.25) {
    return "warning";
  }

  return "critical";
}

function tbtTone(value) {
  const metric = numericMetric(value);
  if (metric === null) {
    return "warning";
  }

  if (metric <= 200) {
    return "positive";
  }

  if (metric <= 600) {
    return "warning";
  }

  return "critical";
}

function toneValue(tone, value) {
  if (tone === "positive") {
    return positive(value);
  }

  if (tone === "warning") {
    return warning(value);
  }

  return critical(value);
}

function signalLine(label, value, tone) {
  return `  ${toneIcon(tone)} ${dim(label.padEnd(21))} ${toneValue(tone, value)}`;
}

function feedbackLine(tone, value) {
  const label = tone === "critical" ? critical("FIX") : warning("WATCH");
  return `  ${toneIcon(tone)} ${label} ${toneValue(tone, value)}`;
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
  const opportunityLines = summary.opportunities.length
    ? summary.opportunities.map((item) =>
        feedbackLine(
          item.score < 50 ? "critical" : "warning",
          `${item.title}${item.displayValue ? ` — ${item.displayValue}` : ""}`,
        ),
      )
    : [signalLine("Opportunities", "No major Lighthouse opportunities found.", "positive")];

  return [
    "",
    frame("╭─ Lighthouse Check"),
    `${frame("│ URL  ")} ${summary.url}`,
    frame("╰─ Signals"),
    signalLine("Performance", `${summary.scores.performance ?? "n/a"}/100`, scoreTone(summary.scores.performance)),
    signalLine("Accessibility", `${summary.scores.accessibility ?? "n/a"}/100`, scoreTone(summary.scores.accessibility)),
    signalLine("Best practices", `${summary.scores.bestPractices ?? "n/a"}/100`, scoreTone(summary.scores.bestPractices)),
    signalLine("SEO", `${summary.scores.seo ?? "n/a"}/100`, scoreTone(summary.scores.seo)),
    signalLine("LCP", summary.vitals.lcp, lcpTone(summary.vitals.lcp)),
    signalLine("CLS", summary.vitals.cls, clsTone(summary.vitals.cls)),
    signalLine("TBT", summary.vitals.tbt, tbtTone(summary.vitals.tbt)),
    "",
    frame("Feedback"),
    ...opportunityLines,
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
