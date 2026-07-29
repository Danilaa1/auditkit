import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type AuditInput = {
  clientName: string;
  slug: string;
  url: string;
  businessType: string;
  goal: string;
  targetCustomer: string;
  conversionAction: string;
  pages: string[];
  knownConcerns: string[];
  competitors: string[];
  createdAt: string;
};

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function splitCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function markdownList(items: string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- None provided";
}

function titleCase(value: string): string {
  if (value === "/") return "Homepage";
  return value
    .replace(/^\/|\/$/g, "")
    .replace(/[-_/]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

function briefTemplate(audit: AuditInput): string {
  return `# ${audit.clientName} Audit Brief

Website: ${audit.url}
Business type: ${audit.businessType}
Goal: ${audit.goal}
Target customer: ${audit.targetCustomer}
Main conversion action: ${audit.conversionAction}
Created: ${audit.createdAt}

## Known Concerns

${markdownList(audit.knownConcerns)}

## Pages

${markdownList(audit.pages)}

## Competitors

${markdownList(audit.competitors)}
`;
}

function findingsTemplate(): string {
  return `# Findings

## Critical

## High

## Medium

## Low

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
`;
}

function workspaceTemplate(audit: AuditInput): string {
  const encoded = encodeURIComponent(audit.url);
  const pages = audit.pages
    .map((page) => {
      try {
        return `- ${new URL(page, audit.url)}`;
      } catch {
        return `- ${page}`;
      }
    })
    .join("\n");
  const reviews = audit.pages
    .map(
      (page) => `### ${titleCase(page)} Review

Path: ${page}

First impression:

CTA:

Copy clarity:

Visual hierarchy:

Mobile issues:

SEO notes:

Performance notes:

Recommended fixes:
`,
    )
    .join("\n");

  return `# Audit Workspace

## Status

- [ ] Intake complete
- [ ] Pages reviewed
- [ ] Performance checked
- [ ] SEO checked
- [ ] Findings prioritised
- [ ] Report drafted
- [ ] Sent to client

## Scorecard

Performance: /10
UX clarity: /10
Conversion path: /10
SEO basics: /10
Trust signals: /10
Mobile experience: /10

Overall:

Notes:

## Review Checklist

### Performance

- [ ] Check mobile score
- [ ] Identify LCP element
- [ ] Check image weight
- [ ] Check font loading
- [ ] Check layout shift

### UX and Conversion

- [ ] Above-fold offer is clear
- [ ] Primary CTA is obvious
- [ ] User can contact or book within one click
- [ ] Trust signals are visible
- [ ] Forms are short enough
- [ ] Navigation supports the key journey

### SEO

- [ ] Title tags
- [ ] Meta descriptions
- [ ] H1 structure
- [ ] Internal links
- [ ] Image alt text
- [ ] Schema opportunity
- [ ] Local SEO basics

## Test Links

- PageSpeed: https://pagespeed.web.dev/analysis?url=${encoded}
- Rich Results: https://search.google.com/test/rich-results?url=${encoded}
- Meta Preview: https://metatags.io/?url=${encoded}

## Pages To Review

${pages || "- None provided"}

## Competitors

${markdownList(audit.competitors)}

## Automated Check

Not run yet.

## Security Check

Not run yet.

## Lighthouse Check

Not run yet.

## Page Reviews

${reviews || "No page reviews provided yet."}

## Raw Notes

`;
}

export function replaceMarkdownSection(
  document: string,
  headingName: string,
  newContent: string,
): string {
  const heading = `## ${headingName}`;
  const content = newContent
    .trim()
    .replace(/^# [^\n]+\n?/, "")
    .trim();
  const lines = document.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading);

  if (start === -1) return `${document.trimEnd()}\n\n${heading}\n\n${content}\n`;

  const nextHeading = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  const end = nextHeading === -1 ? lines.length : nextHeading;
  return [...lines.slice(0, start + 1), "", content, "", ...lines.slice(end)]
    .join("\n")
    .trimEnd()
    .concat("\n");
}

export class Workspace {
  readonly root: string;
  readonly auditsDir: string;

  constructor(root = process.cwd()) {
    this.root = path.resolve(root);
    this.auditsDir = path.join(this.root, "audits");
  }

  auditFolder(folderName: string): string {
    return path.join(this.auditsDir, folderName);
  }

  async createAudit(audit: AuditInput): Promise<string> {
    await mkdir(this.auditsDir, { recursive: true });
    const folder = this.auditFolder(`${audit.createdAt}-${audit.slug}`);
    await mkdir(folder);
    await Promise.all([
      writeFile(path.join(folder, "brief.md"), briefTemplate(audit)),
      writeFile(path.join(folder, "workspace.md"), workspaceTemplate(audit)),
      writeFile(path.join(folder, "findings.md"), findingsTemplate()),
    ]);
    return folder;
  }

  async listAudits(): Promise<string[]> {
    await mkdir(this.auditsDir, { recursive: true });
    const entries = await readdir(this.auditsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  }

  async resolveAudit(target?: string): Promise<string> {
    const folders = await this.listAudits();
    if (!folders.length) throw new Error("No audit workspaces found.");
    if (!target || target === "latest") return folders.at(-1)!;
    if (folders.includes(target)) return target;
    throw new Error(`Audit workspace not found: ${target}`);
  }

  async readAuditFiles(folderName: string): Promise<Map<string, string>> {
    const folder = this.auditFolder(folderName);
    const files = new Map<string, string>();
    await readMarkdownFiles(folder, folder, files);
    return files;
  }

  async writeAuditFile(folderName: string, filename: string, content: string): Promise<string> {
    const file = path.join(this.auditFolder(folderName), filename);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
    return file;
  }

  async updateWorkspaceSection(
    folderName: string,
    heading: string,
    content: string,
  ): Promise<string> {
    const file = path.join(this.auditFolder(folderName), "workspace.md");
    let existing: string;
    try {
      existing = await readFile(file, "utf8");
    } catch {
      throw new Error(`Missing workspace.md in ${folderName}`);
    }
    await writeFile(file, replaceMarkdownSection(existing, heading, content));
    return file;
  }
}

async function readMarkdownFiles(
  root: string,
  current: string,
  files: Map<string, string>,
): Promise<void> {
  const entries = (await readdir(current, { withFileTypes: true })).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );

  for (const entry of entries) {
    const file = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await readMarkdownFiles(root, file, files);
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".md") {
      files.set(path.relative(root, file), await readFile(file, "utf8"));
    }
  }
}
