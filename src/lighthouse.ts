import { existsSync } from "node:fs";

import { resultBlock, type Feedback } from "./ui.ts";

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

type LighthouseCategory = { score?: number | null };
type LighthouseAudit = {
  title?: string;
  score?: number | null;
  displayValue?: string;
  description?: string;
};

export type LighthouseResult = {
  finalDisplayedUrl?: string;
  finalUrl?: string;
  categories?: Record<string, LighthouseCategory | undefined>;
  audits?: Record<string, LighthouseAudit | undefined>;
};

export type LighthouseSummary = {
  url: string;
  scores: {
    performance: number | null;
    accessibility: number | null;
    bestPractices: number | null;
    seo: number | null;
  };
  vitals: { lcp: string; cls: string; tbt: string };
  opportunities: Array<{
    id: string;
    title: string;
    score: number;
    displayValue: string;
    description: string;
  }>;
};

type BrowserOptions = {
  browserPath?: string;
};

export function findBrowserPath({
  env = process.env,
  config = {},
  exists = existsSync,
}: {
  env?: NodeJS.ProcessEnv;
  config?: BrowserOptions;
  exists?: (value: string) => boolean;
} = {}): string | null {
  const candidates = [
    config.browserPath,
    env.AUDITKIT_BROWSER_PATH,
    env.CHROME_PATH,
    ...browserCandidates,
  ].filter((value): value is string => Boolean(value));

  return candidates.find((candidate) => exists(candidate)) ?? null;
}

function categoryScore(category: LighthouseCategory | undefined): number | null {
  return typeof category?.score === "number" ? Math.round(category.score * 100) : null;
}

function auditValue(audits: LighthouseResult["audits"], id: string): string {
  return audits?.[id]?.displayValue ?? "n/a";
}

export function summarizeLighthouse(lhr: LighthouseResult): LighthouseSummary {
  const audits = lhr.audits ?? {};
  const opportunities = opportunityIds
    .map((id) => ({ id, ...audits[id] }))
    .filter(
      (
        audit,
      ): audit is LighthouseAudit & {
        id: string;
        title: string;
        score: number;
      } => Boolean(audit.title && typeof audit.score === "number" && audit.score < 0.9),
    )
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
      lcp: auditValue(audits, "largest-contentful-paint"),
      cls: auditValue(audits, "cumulative-layout-shift"),
      tbt: auditValue(audits, "total-blocking-time"),
    },
    opportunities,
  };
}

function metricTone(value: string, good: number, okay: number): Feedback["tone"] {
  const metric = Number(value.match(/[0-9]+(?:\.[0-9]+)?/)?.[0]);
  if (!Number.isFinite(metric)) return "warning";
  if (metric <= good) return "positive";
  if (metric <= okay) return "warning";
  return "critical";
}

function scoreTone(score: number | null): Feedback["tone"] {
  if (score === null) return "warning";
  if (score >= 85) return "positive";
  if (score >= 65) return "warning";
  return "critical";
}

export function formatLighthouseCli(summary: LighthouseSummary): string {
  const feedback: Feedback[] = summary.opportunities.length
    ? summary.opportunities.map((item) => ({
        tone: item.score < 50 ? "critical" : "warning",
        text: `${item.title}${item.displayValue ? ` — ${item.displayValue}` : ""}`,
      }))
    : [{ tone: "positive", text: "No major Lighthouse opportunities found." }];

  return resultBlock(
    "Lighthouse check",
    summary.url,
    null,
    [
      {
        label: "Performance",
        value: `${summary.scores.performance ?? "n/a"}/100`,
        tone: scoreTone(summary.scores.performance),
      },
      {
        label: "Accessibility",
        value: `${summary.scores.accessibility ?? "n/a"}/100`,
        tone: scoreTone(summary.scores.accessibility),
      },
      {
        label: "Best practices",
        value: `${summary.scores.bestPractices ?? "n/a"}/100`,
        tone: scoreTone(summary.scores.bestPractices),
      },
      {
        label: "SEO",
        value: `${summary.scores.seo ?? "n/a"}/100`,
        tone: scoreTone(summary.scores.seo),
      },
      { label: "LCP", value: summary.vitals.lcp, tone: metricTone(summary.vitals.lcp, 2.5, 4) },
      { label: "CLS", value: summary.vitals.cls, tone: metricTone(summary.vitals.cls, 0.1, 0.25) },
      { label: "TBT", value: summary.vitals.tbt, tone: metricTone(summary.vitals.tbt, 200, 600) },
    ],
    feedback,
  );
}

export function formatLighthouseMarkdown(summary: LighthouseSummary): string {
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

export async function runLighthouse(
  inputUrl: string,
  options: BrowserOptions = {},
): Promise<{ lhr: LighthouseResult; json: string; summary: LighthouseSummary }> {
  const [{ default: lighthouse }, chromeLauncher] = await Promise.all([
    import("lighthouse"),
    import("chrome-launcher"),
  ]);
  const browserPath = findBrowserPath({ config: options });
  let chrome: Awaited<ReturnType<typeof chromeLauncher.launch>>;

  try {
    chrome = await chromeLauncher.launch({
      chromePath: browserPath ?? undefined,
      chromeFlags: ["--headless", "--disable-gpu"],
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    if (message.includes("No Chrome installations found")) {
      throw new Error(
        "No Chrome-compatible browser found. Install Chrome, Chromium, Brave, Edge, or set AUDITKIT_BROWSER_PATH.",
      );
    }
    throw cause;
  }

  try {
    const result = await lighthouse(inputUrl, {
      port: chrome.port,
      output: "json",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    });
    if (!result?.lhr) throw new Error("Lighthouse returned no report.");
    const lhr = result.lhr as LighthouseResult;
    return {
      lhr,
      json: JSON.stringify(lhr, null, 2),
      summary: summarizeLighthouse(lhr),
    };
  } finally {
    await chrome.kill();
  }
}
