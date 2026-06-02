function list(items, fallback = "- None provided") {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : fallback;
}

function titleCase(value) {
  if (value === "/") {
    return "Homepage";
  }

  return value
    .replace(/^\/$/, "home")
    .replace(/^\/+|\/+$/g, "")
    .replace(/[-_/]+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function pageFileName(page) {
  const slug = page
    .replace(/^\/$/, "home")
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return `pages/${slug || "home"}.md`;
}

function pageSpeedUrl(url) {
  return `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(url)}`;
}

function richResultsUrl(url) {
  return `https://search.google.com/test/rich-results?url=${encodeURIComponent(url)}`;
}

function metaPreviewUrl(url) {
  return `https://metatags.io/?url=${encodeURIComponent(url)}`;
}

export function briefTemplate(audit) {
  return `# ${audit.clientName} Audit Brief

Website: ${audit.url}
Business type: ${audit.businessType}
Goal: ${audit.goal}
Target customer: ${audit.targetCustomer}
Main conversion action: ${audit.conversionAction}
Created: ${audit.createdAt}

## Known Concerns

${list(audit.knownConcerns)}

## Pages

${list(audit.pages)}

## Competitors

${list(audit.competitors)}
`;
}

export function checklistTemplate() {
  return `# Audit Checklist

## Performance

- [ ] Run PageSpeed on key pages
- [ ] Check mobile score
- [ ] Identify LCP element
- [ ] Check image weight
- [ ] Check font loading
- [ ] Check layout shift

## UX and Conversion

- [ ] Above-fold offer is clear
- [ ] Primary CTA is obvious
- [ ] User can contact/book within 1 click
- [ ] Trust signals are visible
- [ ] Forms are short enough
- [ ] Navigation supports key journey

## SEO

- [ ] Title tags
- [ ] Meta descriptions
- [ ] H1 structure
- [ ] Internal links
- [ ] Image alt text
- [ ] Schema opportunity
- [ ] Local SEO basics
`;
}

export function findingsTemplate() {
  return `# Findings

## Finding Template

Title:
Category: Performance / UX / SEO / Conversion / Trust
Severity: Critical / High / Medium / Low
Page:
Evidence:
Why it matters:
Recommendation:
Estimated effort:
Business impact:
Screenshot/video note:

## Critical

### 1. Finding title

Evidence:

Why it matters:

Recommendation:

Estimated effort:

Business impact:

## High

## Medium

## Low
`;
}

export function scorecardTemplate() {
  return `# Scorecard

Performance: /10
UX clarity: /10
Conversion path: /10
SEO basics: /10
Trust signals: /10
Mobile experience: /10

Overall:

## Notes

`;
}

export function statusTemplate() {
  return `# Audit Status

- [ ] Intake complete
- [ ] Pages reviewed
- [ ] Performance checked
- [ ] SEO checked
- [ ] Findings prioritised
- [ ] Report drafted
- [ ] Video recorded
- [ ] Sent to client
`;
}

export function pageReviewTemplate(page) {
  const pageName = titleCase(page);

  return `# ${pageName} Review

Path: ${page}

## First Impression

## CTA

## Copy Clarity

## Visual Hierarchy

## Mobile Issues

## SEO Notes

## Performance Notes

## Recommended Fixes
`;
}

export function reportTemplate(audit) {
  return `# ${audit.clientName} Website Audit

Website: ${audit.url}
Goal: ${audit.goal}

## Executive Summary

## Priority Fixes

1.
2.
3.

## Performance

## UX and Conversion

## SEO

## Recommended Next Step
`;
}

export function videoScriptTemplate(audit) {
  return `# ${audit.clientName} Video Script

## Opening

What I reviewed and what matters most.

## Biggest Conversion Issue

## Performance Issue

## SEO or Structure Issue

## Close

Summarise top 3 fixes and recommended next step.
`;
}

export function linksTemplate(audit) {
  return `# Audit Links

## Test Links

- PageSpeed: ${pageSpeedUrl(audit.url)}
- Rich Results: ${richResultsUrl(audit.url)}
- Meta Preview: ${metaPreviewUrl(audit.url)}

## Pages

${list(audit.pages.map((page) => new URL(page, audit.url).toString()))}

## Competitors

${list(audit.competitors)}
`;
}

export function rawNotesTemplate() {
  return `# Raw Notes

`;
}

export function createAuditFiles(audit) {
  const files = {
    "brief.md": briefTemplate(audit),
    "status.md": statusTemplate(),
    "scorecard.md": scorecardTemplate(),
    "checklist.md": checklistTemplate(),
    "findings.md": findingsTemplate(),
    "report.md": reportTemplate(audit),
    "video-script.md": videoScriptTemplate(audit),
    "links.md": linksTemplate(audit),
    "raw-notes.md": rawNotesTemplate(),
  };

  for (const page of audit.pages) {
    files[pageFileName(page)] = pageReviewTemplate(page);
  }

  return files;
}
