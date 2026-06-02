import { bullet, formatKeyValue, scoreColor, scoreStatus, section, color } from "./ui.mjs";

function headerValue(headers, name) {
  if (typeof headers.get === "function") {
    return headers.get(name);
  }

  return headers.get(name.toLowerCase()) ?? headers.get(name) ?? "";
}

function cookieHasSecureFlags(cookieHeader) {
  if (!cookieHeader) {
    return true;
  }

  return /secure/i.test(cookieHeader) && /httponly/i.test(cookieHeader) && /samesite/i.test(cookieHeader);
}

export function analyzeSecurityHeaders(url, response) {
  const headers = response.headers;
  const signals = {
    status: response.status,
    https: url.startsWith("https://"),
    hsts: Boolean(headerValue(headers, "strict-transport-security")),
    csp: Boolean(headerValue(headers, "content-security-policy")),
    frameOptions: Boolean(headerValue(headers, "x-frame-options")),
    referrerPolicy: Boolean(headerValue(headers, "referrer-policy")),
    secureCookies: cookieHasSecureFlags(headerValue(headers, "set-cookie")),
  };

  const feedback = [];
  let score = 100;

  if (!signals.https) {
    score -= 25;
    feedback.push("Site is not using HTTPS. Serve the site over HTTPS before client launch.");
  } else {
    feedback.push("HTTPS is enabled.");
  }

  if (!signals.hsts) {
    score -= 15;
    feedback.push("Missing HSTS header. Add Strict-Transport-Security once HTTPS is stable.");
  } else {
    feedback.push("HSTS header found.");
  }

  if (!signals.csp) {
    score -= 20;
    feedback.push("Missing Content-Security-Policy. Add a CSP to reduce script injection risk.");
  } else {
    feedback.push("Content-Security-Policy found.");
  }

  if (!signals.frameOptions) {
    score -= 10;
    feedback.push("Missing X-Frame-Options. Add clickjacking protection.");
  }

  if (!signals.referrerPolicy) {
    score -= 5;
    feedback.push("Missing Referrer-Policy. Add one to avoid leaking full URLs.");
  }

  if (!signals.secureCookies) {
    score -= 10;
    feedback.push("Cookies are missing Secure, HttpOnly, or SameSite flags.");
  }

  return {
    url,
    score: Math.max(0, score),
    signals,
    feedback,
  };
}

export async function checkSecurity(inputUrl) {
  const url = /^https?:\/\//i.test(inputUrl) ? inputUrl : `https://${inputUrl}`;
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "AuditKit/0.1 (+https://localhost)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  return analyzeSecurityHeaders(response.url || url, response);
}

export function formatSecurityCli(result) {
  const score = color(`${result.score}/100`, scoreColor(result.score));

  return [
    section("Security Check"),
    formatKeyValue("URL", result.url),
    formatKeyValue("Score", `${score} (${scoreStatus(result.score)})`),
    section("Signals"),
    formatKeyValue("HTTPS", result.signals.https ? "yes" : "no"),
    formatKeyValue("HSTS", result.signals.hsts ? "yes" : "no"),
    formatKeyValue("CSP", result.signals.csp ? "yes" : "no"),
    formatKeyValue("X-Frame-Options", result.signals.frameOptions ? "yes" : "no"),
    formatKeyValue("Referrer-Policy", result.signals.referrerPolicy ? "yes" : "no"),
    formatKeyValue("Secure cookies", result.signals.secureCookies ? "yes" : "no"),
    section("Feedback"),
    ...result.feedback.map((item) => bullet(item)),
  ].join("\n");
}

export function formatSecurityReport(result) {
  return `# Security Check

URL: ${result.url}
Score: ${result.score}/100 (${scoreStatus(result.score)})

## Signals

- HTTPS: ${result.signals.https ? "yes" : "no"}
- HSTS: ${result.signals.hsts ? "yes" : "no"}
- CSP: ${result.signals.csp ? "yes" : "no"}
- X-Frame-Options: ${result.signals.frameOptions ? "yes" : "no"}
- Referrer-Policy: ${result.signals.referrerPolicy ? "yes" : "no"}
- Secure cookies: ${result.signals.secureCookies ? "yes" : "no"}

## Feedback

${result.feedback.map((item) => `- ${item}`).join("\n")}
`;
}
