#!/usr/bin/env node

import { collectAuditInput } from "./prompts.mjs";
import { formatFeedback } from "./analyzer.mjs";
import { createAuditFiles } from "./templates.mjs";
import { listAuditFolders, rootDir, writeAuditFiles } from "./utils.mjs";
import {
  generateReport,
  resolveAuditTarget,
  saveAutomatedCheck,
  saveCheckForUrl,
  saveLighthouseCheck,
  saveLighthouseForUrl,
  saveSecurityCheck,
  saveSecurityForUrl,
} from "./workflow.mjs";
import { bullet, formatError, formatHelp, formatSaved, section, withTask } from "./ui.mjs";
import { formatLighthouseCli } from "./lighthouse-runner.mjs";
import { formatSecurityCli } from "./security.mjs";

const command = process.argv[2];
const args = process.argv.slice(3);

function looksLikeUrl(value) {
  return /^https?:\/\//i.test(value) || /^[^\s/]+\.[^\s]+/i.test(value);
}

async function createNewAudit() {
  const audit = await collectAuditInput();

  if (!audit.clientName || !audit.url) {
    throw new Error("Client name and website URL are required.");
  }

  const folder = await writeAuditFiles(audit, createAuditFiles(audit));
  console.log(section("Audit Created"));
  console.log(formatSaved(folder));
  console.log(bullet("Next: fill in findings.md, scorecard.md, and pages/*.md"));
  console.log(bullet("Then run: ak check latest"));
}

async function listAudits() {
  const folders = await listAuditFolders();

  if (!folders.length) {
    console.log(section("Audits"));
    console.log("No audits yet.");
    return;
  }

  console.log(section("Audits"));
  for (const folder of folders) {
    console.log(bullet(folder));
  }
}

async function checkUrl() {
  const target = args[0];

  if (!target) {
    throw new Error("Usage: npm run audit -- check <latest|audit-folder|website-url>");
  }

  if (target === "latest" || !looksLikeUrl(target)) {
    const folderName = await resolveAuditTarget(target);
    const { result, path } = await withTask("Fetching website and reading HTML", () =>
      saveAutomatedCheck(folderName),
    );
    console.log(formatFeedback(result));
    console.log(`\n${formatSaved(path)}`);
    return;
  }

  const saveIndex = args.indexOf("--save");
  const saveTarget = saveIndex >= 0 ? args[saveIndex + 1] : null;
  const folderName = saveTarget ? await resolveAuditTarget(saveTarget) : null;
  const { result, path } = await withTask("Fetching website and reading HTML", () =>
    saveCheckForUrl(target, folderName),
  );

  console.log(formatFeedback(result));

  if (path) {
    console.log(`\n${formatSaved(path)}`);
  }
}

async function createReport() {
  const target = args[0] ?? "latest";
  const folderName = await resolveAuditTarget(target);
  const { reportPath, emailPath } = await withTask("Building final report and client email", () =>
    generateReport(rootDir, folderName),
  );

  console.log(section("Report Generated"));
  console.log(formatSaved(reportPath));
  console.log(formatSaved(emailPath));
}

async function createSecurityCheck() {
  const target = args[0] ?? "latest";
  const saveIndex = args.indexOf("--save");
  const saveTarget = saveIndex >= 0 ? args[saveIndex + 1] : null;

  if (looksLikeUrl(target)) {
    const folderName = saveTarget ? await resolveAuditTarget(saveTarget) : null;
    const { result, path } = await withTask("Checking security headers", () =>
      saveSecurityForUrl(target, folderName),
    );
    console.log(formatSecurityCli(result));

    if (path) {
      console.log(`\n${formatSaved(path)}`);
    }

    return;
  }

  const folderName = await resolveAuditTarget(target);
  const { result, path } = await withTask("Checking security headers", () =>
    saveSecurityCheck(folderName),
  );

  console.log(formatSecurityCli(result));
  console.log(`\n${formatSaved(path)}`);
}

async function createLighthouseCheck() {
  const target = args[0] ?? "latest";
  const saveIndex = args.indexOf("--save");
  const saveTarget = saveIndex >= 0 ? args[saveIndex + 1] : null;

  if (looksLikeUrl(target)) {
    const folderName = saveTarget ? await resolveAuditTarget(saveTarget) : null;
    const { result, markdownPath, jsonPath } = await withTask("Running Lighthouse in Helium", () =>
      saveLighthouseForUrl(target, folderName),
    );
    console.log(formatLighthouseCli(result.summary));

    if (markdownPath && jsonPath) {
      console.log(`\n${formatSaved(markdownPath)}`);
      console.log(formatSaved(jsonPath));
    }

    return;
  }

  const folderName = await resolveAuditTarget(target);
  const { result, markdownPath, jsonPath } = await withTask("Running Lighthouse in Helium", () =>
    saveLighthouseCheck(folderName),
  );

  console.log(formatLighthouseCli(result.summary));
  console.log(`\n${formatSaved(markdownPath)}`);
  console.log(formatSaved(jsonPath));
}

async function createInspection() {
  const target = args[0] ?? "latest";
  const folderName = await resolveAuditTarget(target);

  console.log(section("Inspect"));
  console.log(bullet(`Running checks for ${folderName}`));
  const automated = await withTask("Fetching website and reading HTML", () =>
    saveAutomatedCheck(folderName),
  );
  const security = await withTask("Checking security headers", () => saveSecurityCheck(folderName));
  const lighthouse = await withTask("Running Lighthouse in Helium", () =>
    saveLighthouseCheck(folderName),
  );

  console.log(formatSaved(automated.path));
  console.log(formatSaved(security.path));
  console.log(formatSaved(lighthouse.markdownPath));
  console.log(formatSaved(lighthouse.jsonPath));
}

async function main() {
  if (command === "new") {
    await createNewAudit();
    return;
  }

  if (command === "list") {
    await listAudits();
    return;
  }

  if (command === "check") {
    await checkUrl();
    return;
  }

  if (command === "report") {
    await createReport();
    return;
  }

  if (command === "security") {
    await createSecurityCheck();
    return;
  }

  if (command === "lighthouse") {
    await createLighthouseCheck();
    return;
  }

  if (command === "inspect") {
    await createInspection();
    return;
  }

  console.log(formatHelp());
}

main().catch((error) => {
  console.error(formatError(error.message));
  process.exit(1);
});
