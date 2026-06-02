import { bullet, color, formatKeyValue, scoreColor, scoreStatus, section } from "./ui.mjs";

const ctaWords = [
  "book",
  "buy",
  "call",
  "contact",
  "demo",
  "enquire",
  "get started",
  "quote",
  "schedule",
  "start",
];

function firstMatch(html, pattern) {
  return html.match(pattern)?.[1]?.trim() ?? "";
}

function countMatches(html, pattern) {
  return [...html.matchAll(pattern)].length;
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function normaliseUrl(value) {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `https://${value}`;
}

function imageAltStats(html) {
  const images = [...html.matchAll(/<img\b[^>]*>/gi)];
  const missingAlt = images.filter((match) => !/\balt\s*=\s*["'][^"']+["']/i.test(match[0]));

  return {
    total: images.length,
    missingAlt: missingAlt.length,
  };
}

function ctaFound(html) {
  const text = stripTags(html).toLowerCase();
  return ctaWords.some((word) => text.includes(word));
}

function plural(count, singular, pluralValue = `${singular}s`) {
  return count === 1 ? singular : pluralValue;
}

export function analyzeHtml(url, html, meta = {}) {
  const title = stripTags(firstMatch(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i));
  const description = firstMatch(
    html,
    /<meta\b(?=[^>]*\bname\s*=\s*["']description["'])(?=[^>]*\bcontent\s*=\s*["']([^"']*)["'])[^>]*>/i,
  );
  const h1Texts = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) =>
    stripTags(match[1]),
  );
  const images = imageAltStats(html);
  const hasViewport = /<meta\b(?=[^>]*\bname\s*=\s*["']viewport["'])[^>]*>/i.test(html);
  const hasCanonical = /<link\b(?=[^>]*\brel\s*=\s*["']canonical["'])[^>]*>/i.test(html);
  const hasCta = ctaFound(html);

  const feedback = [];
  let score = 100;

  if (!title) {
    score -= 15;
    feedback.push("Missing title tag. Add a clear page title for search results and browser tabs.");
  } else if (title.length < 10 || title.length > 65) {
    score -= 8;
    feedback.push(`Title length is ${title.length}. Aim for roughly 10-65 characters.`);
  } else {
    feedback.push(`Title found: "${title}".`);
  }

  if (!description) {
    score -= 12;
    feedback.push("Missing meta description. Add a concise summary for search snippets.");
  } else if (description.length < 50 || description.length > 160) {
    feedback.push(`Meta description length is ${description.length}. Aim for roughly 50-160 characters.`);
  } else {
    feedback.push("Meta description found.");
  }

  if (h1Texts.length === 0) {
    score -= 12;
    feedback.push("Missing H1. Add one clear primary heading.");
  } else if (h1Texts.length > 1) {
    score -= 8;
    feedback.push(`Multiple H1 tags found (${h1Texts.length}). Keep one primary page heading.`);
  } else {
    feedback.push(`Single H1 found: "${h1Texts[0]}".`);
  }

  if (images.missingAlt > 0) {
    score -= Math.min(15, images.missingAlt * 8);
    feedback.push(
      `${images.missingAlt} ${plural(images.missingAlt, "image")} ${images.missingAlt === 1 ? "is" : "are"} missing alt text.`,
    );
  } else if (images.total > 0) {
    feedback.push("All detected images include alt text.");
  }

  if (!hasViewport) {
    score -= 10;
    feedback.push("Missing viewport meta tag. Mobile layout may render poorly.");
  }

  if (!hasCanonical) {
    score -= 4;
    feedback.push("No canonical link found. Add one if duplicate URLs are possible.");
  }

  if (!hasCta) {
    score -= 10;
    feedback.push("No obvious CTA language found. Make the next action clear.");
  } else {
    feedback.push("Primary CTA found.");
  }

  if ((meta.bytes ?? 0) > 200000) {
    score -= 7;
    feedback.push("HTML response is large. Check unnecessary markup, scripts, or inline payloads.");
  }

  if ((meta.durationMs ?? 0) > 1500) {
    score -= 4;
    feedback.push("Slow initial response. Check hosting, server rendering, and caching.");
  }

  return {
    url,
    score: Math.max(0, score),
    signals: {
      status: meta.status,
      bytes: meta.bytes,
      durationMs: meta.durationMs,
      title: { text: title, length: title.length },
      metaDescription: { present: Boolean(description), length: description.length },
      h1: { count: h1Texts.length, text: h1Texts },
      images,
      hasViewport,
      hasCanonical,
      hasCta,
    },
    feedback,
  };
}

export async function checkWebsite(inputUrl) {
  const url = normaliseUrl(inputUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "AuditKit/0.1 (+https://localhost)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    const html = await response.text();
    const durationMs = Date.now() - startedAt;
    const bytes = Buffer.byteLength(html, "utf8");

    return analyzeHtml(response.url || url, html, {
      status: response.status,
      bytes,
      durationMs,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function formatFeedback(result) {
  const status = scoreStatus(result.score);
  const score = color(`${result.score}/100`, scoreColor(result.score));
  const lines = [
    section("Audit Kit Check"),
    formatKeyValue("URL", result.url),
    formatKeyValue("Score", `${score} (${status})`),
    section("Signals"),
    formatKeyValue("Status", result.signals.status ?? "n/a"),
    formatKeyValue("Response", `${result.signals.durationMs ?? "n/a"}ms, ${result.signals.bytes ?? "n/a"} bytes`),
    formatKeyValue("Title", result.signals.title.text || "missing"),
    formatKeyValue("Meta description", result.signals.metaDescription.present ? "present" : "missing"),
    formatKeyValue("H1 count", result.signals.h1.count),
    formatKeyValue("Images missing alt", `${result.signals.images.missingAlt}/${result.signals.images.total}`),
    section("Feedback"),
    ...result.feedback.map((item) => bullet(item)),
  ];

  return lines.join("\n");
}
