import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { checkWebsite, formatFeedback } from "./analyzer.mjs";
import { formatLighthouseReport, runLighthouse } from "./lighthouse-runner.mjs";
import { checkSecurity, formatSecurityReport } from "./security.mjs";
import { auditsDir, listAuditFolders } from "./utils.mjs";

const defaultConfig = {
  agencyName: "Origin",
  auditorName: "Daniel White",
  services: {
    audit: "Starting at £299",
    refresh: "Starting at £1,999",
    growth: "Starting at £499/mo",
  },
};

function headingFromPath(filePath) {
  const value = filePath
    .replace(/^pages\//, "")
    .replace(/\.md$/, "")
    .replace(/^home$/, "homepage")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return value;
}

function field(markdown, label) {
  const pattern = new RegExp(`^${label}:\\s*(.+)$`, "im");
  return markdown.match(pattern)?.[1]?.trim() ?? "";
}

function stripTitle(markdown) {
  return markdown.replace(/^# .+\n+/, "").trim();
}

export function parseBrief(markdown) {
  const title = markdown.match(/^#\s+(.+?)\s+Audit Brief/im)?.[1]?.trim() ?? "Client";

  return {
    clientName: title,
    website: field(markdown, "Website"),
    businessType: field(markdown, "Business type"),
    goal: field(markdown, "Goal"),
    targetCustomer: field(markdown, "Target customer"),
    conversionAction: field(markdown, "Main conversion action"),
    created: field(markdown, "Created"),
  };
}

export function resolveAuditFolderName(target, folders) {
  if (!folders.length) {
    throw new Error("No audits found.");
  }

  if (!target || target === "latest") {
    return [...folders].sort().at(-1);
  }

  if (!folders.includes(target)) {
    throw new Error(`Audit folder not found: ${target}`);
  }

  return target;
}

export function renderAutomatedCheck(result) {
  return `# Automated Check

${formatFeedback(result)}
`;
}

export function buildFinalReport({ config = defaultConfig, folderName, files }) {
  const brief = parseBrief(files["brief.md"] ?? "");
  const pageFiles = Object.entries(files)
    .filter(([filename]) => filename.startsWith("pages/") && filename.endsWith(".md"))
    .sort(([a], [b]) => a.localeCompare(b));

  const pageSections = pageFiles
    .map(([filename, content]) => `### ${headingFromPath(filename)} Review\n\n${stripTitle(content)}`)
    .join("\n\n");

  return `# ${brief.clientName} Website Audit

Prepared by ${config.auditorName}, ${config.agencyName}
Audit folder: ${folderName}

## Context

Website: ${brief.website}
Goal: ${brief.goal}
Business type: ${brief.businessType || "Not specified"}
Target customer: ${brief.targetCustomer || "Not specified"}
Main conversion action: ${brief.conversionAction || "Not specified"}

## Scorecard

${stripTitle(files["scorecard.md"] ?? "Not completed yet.")}

## Automated Check

${stripTitle(files["automated-check.md"] ?? "Not run yet.")}

## Security Check

${stripTitle(files["security.md"] ?? "Not run yet.")}

## Lighthouse Check

${stripTitle(files["lighthouse.md"] ?? "Not run yet.")}

## Findings

${stripTitle(files["findings.md"] ?? "No findings captured yet.")}

## Page Reviews

${pageSections || "No page reviews captured yet."}

## Recommended Next Step

Audit: ${config.services.audit}
Refresh: ${config.services.refresh}
Growth: ${config.services.growth}

Use the audit to prioritise immediate fixes. If most findings require design, copy, and frontend changes, the Refresh package is likely the best next step.
`;
}

export function buildClientEmail({ config = defaultConfig, brief }) {
  return `Subject: Website audit for ${brief.clientName}

Hi,

I've completed the website audit for ${brief.website || "your website"}.

The report is in final-report.md. I also included a video-script.md outline so the walkthrough can focus on the highest-impact issues.

Main goal reviewed: ${brief.goal || "Not specified"}

Recommended next step:
Review the priority fixes in the report. If you want me to handle the design, copy, and implementation work, the Refresh package is the most likely fit.

Thanks,
${config.auditorName}
${config.agencyName}
`;
}

export async function loadConfig(rootDir) {
  try {
    const content = await readFile(path.join(rootDir, "auditkit.config.json"), "utf8");
    return { ...defaultConfig, ...JSON.parse(content) };
  } catch {
    return defaultConfig;
  }
}

export async function readAuditFiles(folderName) {
  const folder = path.join(auditsDir, folderName);
  const files = {};
  const entries = await readdir(folder, { recursive: true, withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    const parentPath = entry.parentPath ?? folder;
    const filePath = path.join(parentPath, entry.name);
    const relativePath = path.relative(folder, filePath);
    files[relativePath] = await readFile(filePath, "utf8");
  }

  return files;
}

export async function saveAutomatedCheck(folderName) {
  const files = await readAuditFiles(folderName);
  const brief = parseBrief(files["brief.md"] ?? "");

  if (!brief.website) {
    throw new Error(`No website found in ${folderName}/brief.md`);
  }

  const result = await checkWebsite(brief.website);
  const markdown = renderAutomatedCheck(result);
  await writeFile(path.join(auditsDir, folderName, "automated-check.md"), markdown, "utf8");

  return { result, path: path.join(auditsDir, folderName, "automated-check.md") };
}

export async function saveCheckForUrl(url, folderName) {
  const result = await checkWebsite(url);
  const markdown = renderAutomatedCheck(result);

  if (!folderName) {
    return { result, path: null };
  }

  await writeFile(path.join(auditsDir, folderName, "automated-check.md"), markdown, "utf8");
  return { result, path: path.join(auditsDir, folderName, "automated-check.md") };
}

export async function saveSecurityCheck(folderName) {
  const files = await readAuditFiles(folderName);
  const brief = parseBrief(files["brief.md"] ?? "");

  if (!brief.website) {
    throw new Error(`No website found in ${folderName}/brief.md`);
  }

  const result = await checkSecurity(brief.website);
  const markdown = formatSecurityReport(result);
  const outputPath = path.join(auditsDir, folderName, "security.md");
  await writeFile(outputPath, markdown, "utf8");

  return { result, path: outputPath };
}

export async function saveSecurityForUrl(url, folderName) {
  const result = await checkSecurity(url);

  if (!folderName) {
    return { result, path: null };
  }

  const outputPath = path.join(auditsDir, folderName, "security.md");
  await writeFile(outputPath, formatSecurityReport(result), "utf8");

  return { result, path: outputPath };
}

export async function saveLighthouseCheck(folderName) {
  const files = await readAuditFiles(folderName);
  const brief = parseBrief(files["brief.md"] ?? "");

  if (!brief.website) {
    throw new Error(`No website found in ${folderName}/brief.md`);
  }

  const result = await runLighthouse(brief.website);
  const folder = path.join(auditsDir, folderName);
  const markdownPath = path.join(folder, "lighthouse.md");
  const jsonPath = path.join(folder, "lighthouse.json");

  await writeFile(markdownPath, formatLighthouseReport(result.summary), "utf8");
  await writeFile(jsonPath, result.json, "utf8");

  return { result, markdownPath, jsonPath };
}

export async function saveLighthouseForUrl(url, folderName) {
  const result = await runLighthouse(url);

  if (!folderName) {
    return { result, markdownPath: null, jsonPath: null };
  }

  const folder = path.join(auditsDir, folderName);
  const markdownPath = path.join(folder, "lighthouse.md");
  const jsonPath = path.join(folder, "lighthouse.json");

  await writeFile(markdownPath, formatLighthouseReport(result.summary), "utf8");
  await writeFile(jsonPath, result.json, "utf8");

  return { result, markdownPath, jsonPath };
}

export async function saveInspectionChecks(folderName) {
  const automated = await saveAutomatedCheck(folderName);
  const security = await saveSecurityCheck(folderName);
  const lighthouse = await saveLighthouseCheck(folderName);

  return { automated, security, lighthouse };
}

export async function generateReport(rootDir, folderName) {
  const config = await loadConfig(rootDir);
  const files = await readAuditFiles(folderName);
  const brief = parseBrief(files["brief.md"] ?? "");
  const report = buildFinalReport({ config, folderName, files });
  const email = buildClientEmail({ config, brief });

  const folder = path.join(auditsDir, folderName);
  const reportPath = path.join(folder, "final-report.md");
  const emailPath = path.join(folder, "client-email.md");

  await writeFile(reportPath, report, "utf8");
  await writeFile(emailPath, email, "utf8");

  return { reportPath, emailPath };
}

export async function resolveAuditTarget(target) {
  const folders = await listAuditFolders();
  return resolveAuditFolderName(target, folders);
}
