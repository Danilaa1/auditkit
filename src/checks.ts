import type { Feedback, Signal } from "./ui.ts";
import { resultBlock, scoreStatus } from "./ui.ts";

export type FetchedPage = {
  url: string;
  status: number;
  html: string;
  bytes: number;
  headers: Headers;
};

export type HtmlCheck = {
  url: string;
  score: number;
  status: number;
  bytes: number;
  title: string;
  metaDescriptionPresent: boolean;
  h1Count: number;
  imageTotal: number;
  imageMissingAlt: number;
  feedback: Feedback[];
};

export type SecurityCheck = {
  url: string;
  score: number;
  https: boolean;
  hsts: boolean;
  csp: boolean;
  frameOptions: boolean;
  referrerPolicy: boolean;
  secureCookies: boolean | null;
  feedback: Feedback[];
};

export function normalizeUrl(input: string): string {
  const value = input.trim();
  if (!value) throw new Error("Website URL is required.");

  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error(`Invalid website URL: ${input}`);
  }

  if (!["http:", "https:"].includes(url.protocol) || !url.hostname) {
    throw new Error(`Invalid website URL: ${input}`);
  }

  return url.href;
}

export async function fetchWebsite(input: string): Promise<FetchedPage> {
  const url = normalizeUrl(input);
  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "AuditKit",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`Could not reach ${url} (${message})`);
  }

  const html = await response.text();
  return {
    url: response.url || url,
    status: response.status,
    html,
    bytes: Buffer.byteLength(html),
    headers: response.headers,
  };
}

function stripTags(html: string): string {
  return html
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ponytail: regex keeps lightweight checks dependency-free; add an HTML parser if malformed markup becomes a measured accuracy problem.
function attributeValue(tag: string, name: string): string | null {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
  );
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : null;
}

function tags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) ?? [];
}

function hasMeta(html: string, name: string): boolean {
  return tags(html, "meta").some(
    (tag) =>
      attributeValue(tag, "name")?.toLowerCase() === name &&
      attributeValue(tag, "content") !== null,
  );
}

function hasLink(html: string, relation: string): boolean {
  return tags(html, "link").some((tag) =>
    (attributeValue(tag, "rel") ?? "")
      .toLowerCase()
      .split(/\s+/)
      .includes(relation),
  );
}

function containsCta(html: string): boolean {
  return /\b(book|buy|call|contact|demo|enquire|quote|schedule|start)\b|get started|request a quote/i.test(
    stripTags(html),
  );
}

export function analyzeHtml(page: FetchedPage): HtmlCheck {
  const rawTitle = page.html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const title = stripTags(rawTitle);
  const metaDescriptionPresent = hasMeta(page.html, "description");
  const h1Count = tags(page.html, "h1").length;
  const images = tags(page.html, "img");
  const imageMissingAlt = images.filter((image) => attributeValue(image, "alt") === null).length;
  const hasViewport = hasMeta(page.html, "viewport");
  const hasCanonical = hasLink(page.html, "canonical");
  let score = 100;
  const feedback: Feedback[] = [];

  if (!title) {
    score -= 15;
    feedback.push({
      tone: "critical",
      text: "Add a clear title tag for search results and browser tabs.",
    });
  } else if (title.length < 10 || title.length > 65) {
    score -= 8;
    feedback.push({
      tone: "warning",
      text: `Title is ${title.length} characters. Aim for roughly 10–65.`,
    });
  } else {
    feedback.push({ tone: "positive", text: `Title found: "${title}".` });
  }

  if (!metaDescriptionPresent) {
    score -= 12;
    feedback.push({
      tone: "critical",
      text: "Add a concise meta description for search snippets.",
    });
  } else {
    feedback.push({ tone: "positive", text: "Meta description found." });
  }

  if (h1Count === 0) {
    score -= 12;
    feedback.push({ tone: "critical", text: "Add one clear primary H1." });
  } else if (h1Count > 1) {
    score -= 8;
    feedback.push({
      tone: "warning",
      text: `${h1Count} H1 tags found. Keep one primary page heading.`,
    });
  } else {
    feedback.push({ tone: "positive", text: "Single H1 found." });
  }

  if (imageMissingAlt > 0) {
    score -= Math.min(imageMissingAlt * 8, 15);
    feedback.push({
      tone: "critical",
      text: `${imageMissingAlt} image(s) have no alt attribute.`,
    });
  }

  if (!hasViewport) {
    score -= 10;
    feedback.push({
      tone: "critical",
      text: "Add a viewport meta tag so mobile layouts render correctly.",
    });
  }

  if (!hasCanonical) {
    score -= 4;
    feedback.push({
      tone: "warning",
      text: "Add a canonical link when duplicate URLs are possible.",
    });
  }

  if (!containsCta(page.html)) {
    score -= 10;
    feedback.push({
      tone: "critical",
      text: "Make the primary next action clearer.",
    });
  } else {
    feedback.push({ tone: "positive", text: "Primary CTA language found." });
  }

  if (page.bytes > 200_000) {
    score -= 7;
    feedback.push({
      tone: "warning",
      text: "HTML response is large. Check markup, scripts, and inline payloads.",
    });
  }

  return {
    url: page.url,
    score: Math.max(0, score),
    status: page.status,
    bytes: page.bytes,
    title,
    metaDescriptionPresent,
    h1Count,
    imageTotal: images.length,
    imageMissingAlt,
    feedback,
  };
}

function cookies(headers: Headers): string[] {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const value = headers.get("set-cookie");
  return value ? [value] : [];
}

export function analyzeSecurity(page: Pick<FetchedPage, "url" | "headers">): SecurityCheck {
  const https = page.url.startsWith("https://");
  const hsts = page.headers.has("strict-transport-security");
  const csp = page.headers.has("content-security-policy");
  const frameOptions = page.headers.has("x-frame-options");
  const referrerPolicy = page.headers.has("referrer-policy");
  const setCookies = cookies(page.headers);
  const secureCookies =
    setCookies.length === 0
      ? null
      : setCookies.every((cookie) => {
          const value = cookie.toLowerCase();
          return (
            value.includes("secure") &&
            value.includes("httponly") &&
            value.includes("samesite")
          );
        });
  let score = 100;
  const feedback: Feedback[] = [];

  if (!https) {
    score -= 25;
    feedback.push({ tone: "critical", text: "Serve the site over HTTPS before launch." });
  } else {
    feedback.push({ tone: "positive", text: "HTTPS is enabled." });
  }

  if (!hsts) {
    score -= 15;
    feedback.push({
      tone: "warning",
      text: "Add Strict-Transport-Security once HTTPS is stable.",
    });
  } else {
    feedback.push({ tone: "positive", text: "HSTS header found." });
  }

  if (!csp) {
    score -= 20;
    feedback.push({
      tone: "critical",
      text: "Add a Content-Security-Policy to reduce script injection risk.",
    });
  } else {
    feedback.push({ tone: "positive", text: "Content-Security-Policy found." });
  }

  if (!frameOptions) {
    score -= 10;
    feedback.push({ tone: "warning", text: "Add X-Frame-Options for clickjacking protection." });
  }

  if (!referrerPolicy) {
    score -= 5;
    feedback.push({ tone: "warning", text: "Add Referrer-Policy to limit URL leakage." });
  }

  if (secureCookies === false) {
    score -= 10;
    feedback.push({
      tone: "critical",
      text: "Add Secure, HttpOnly, and SameSite to every cookie.",
    });
  }

  return {
    url: page.url,
    score: Math.max(0, score),
    https,
    hsts,
    csp,
    frameOptions,
    referrerPolicy,
    secureCookies,
    feedback,
  };
}

function yesNo(value: boolean | null): string {
  if (value === null) return "not set";
  return value ? "yes" : "no";
}

export function formatHtmlCli(result: HtmlCheck): string {
  const signals: Signal[] = [
    {
      label: "Status",
      value: result.status,
      tone: result.status >= 200 && result.status < 400 ? "positive" : "critical",
    },
    {
      label: "Response",
      value: `${result.bytes.toLocaleString("en-GB")} bytes`,
      tone: result.bytes > 200_000 ? "warning" : "positive",
    },
    {
      label: "Title",
      value: result.title || "missing",
      tone: !result.title
        ? "critical"
        : result.title.length < 10 || result.title.length > 65
          ? "warning"
          : "positive",
    },
    {
      label: "Meta description",
      value: result.metaDescriptionPresent ? "present" : "missing",
      tone: result.metaDescriptionPresent ? "positive" : "critical",
    },
    {
      label: "H1 count",
      value: result.h1Count,
      tone: result.h1Count === 1 ? "positive" : result.h1Count === 0 ? "critical" : "warning",
    },
    {
      label: "Images missing alt",
      value: `${result.imageMissingAlt}/${result.imageTotal}`,
      tone: result.imageMissingAlt === 0 ? "positive" : "critical",
    },
  ];

  return resultBlock("Website check", result.url, result.score, signals, result.feedback);
}

export function formatSecurityCli(result: SecurityCheck): string {
  const securityTone = (value: boolean | null, important = false): Signal["tone"] =>
    value === null ? "neutral" : value ? "positive" : important ? "critical" : "warning";

  return resultBlock(
    "Security check",
    result.url,
    result.score,
    [
      { label: "HTTPS", value: yesNo(result.https), tone: securityTone(result.https, true) },
      { label: "HSTS", value: yesNo(result.hsts), tone: securityTone(result.hsts) },
      { label: "CSP", value: yesNo(result.csp), tone: securityTone(result.csp, true) },
      {
        label: "X-Frame-Options",
        value: yesNo(result.frameOptions),
        tone: securityTone(result.frameOptions),
      },
      {
        label: "Referrer-Policy",
        value: yesNo(result.referrerPolicy),
        tone: securityTone(result.referrerPolicy),
      },
      {
        label: "Secure cookies",
        value: yesNo(result.secureCookies),
        tone: securityTone(result.secureCookies, true),
      },
    ],
    result.feedback,
  );
}

export function formatHtmlMarkdown(result: HtmlCheck): string {
  return `# Automated Check

URL: ${result.url}
Score: ${result.score}/100 (${scoreStatus(result.score)})

## Signals

- Status: ${result.status}
- Response: ${result.bytes} bytes
- Title: ${result.title || "missing"}
- Meta description: ${result.metaDescriptionPresent ? "present" : "missing"}
- H1 count: ${result.h1Count}
- Images missing alt: ${result.imageMissingAlt}/${result.imageTotal}

## Feedback

${result.feedback.map((item) => `- ${item.text}`).join("\n")}
`;
}

export function formatSecurityMarkdown(result: SecurityCheck): string {
  return `# Security Check

URL: ${result.url}
Score: ${result.score}/100 (${scoreStatus(result.score)})

## Signals

- HTTPS: ${yesNo(result.https)}
- HSTS: ${yesNo(result.hsts)}
- CSP: ${yesNo(result.csp)}
- X-Frame-Options: ${yesNo(result.frameOptions)}
- Referrer-Policy: ${yesNo(result.referrerPolicy)}
- Secure cookies: ${yesNo(result.secureCookies)}

## Feedback

${result.feedback.map((item) => `- ${item.text}`).join("\n")}
`;
}
