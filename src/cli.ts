#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  analyzeHtml,
  analyzeSecurity,
  fetchWebsite,
  formatHtmlCli,
  formatHtmlMarkdown,
  formatSecurityCli,
  formatSecurityMarkdown,
  normalizeUrl,
  type HtmlCheck,
  type SecurityCheck,
} from "./checks.ts";
import {
  formatLighthouseCli,
  formatLighthouseMarkdown,
  runLighthouse,
} from "./lighthouse.ts";
import { generateReport, parseBrief } from "./report.ts";
import * as ui from "./ui.ts";
import {
  slugify,
  splitCommaList,
  Workspace,
  type AuditInput,
} from "./workspace.ts";

type Command = "new" | "list" | "check" | "security" | "lighthouse" | "inspect" | "report";
type SaveRequest = { explicit: boolean; value?: string };

export type ParsedArgs = {
  command?: Command;
  target?: string;
  save: SaveRequest;
  noColor: boolean;
  help?: Command | "all";
  version: boolean;
};

type ResolvedTarget =
  | { kind: "url"; url: string; prompted: boolean }
  | { kind: "audit"; folder: string; url: string; prompted: false };

type SaveDestination =
  | { kind: "audit"; folder: string }
  | { kind: "directory"; folder: string };

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };
const commands = new Set<Command>([
  "new",
  "list",
  "check",
  "security",
  "lighthouse",
  "inspect",
  "report",
]);

const help = `Audit Kit ${packageJson.version}
Fast website audits from one simple CLI.

Usage
  ak <url> [--save [folder]]       Run the full audit
  ak check [url] [--save [folder]] HTML and SEO basics
  ak security [url] [--save]       Security headers
  ak lighthouse [url] [--save]     Performance and accessibility
  ak new                            Create a client workspace
  ak inspect [latest|workspace]     Audit and update a workspace
  ak report [latest|workspace]      Build report and client email
  ak list                           List workspaces

Options
  --save [folder]  Keep results in a folder or workspace
  --no-color       Plain terminal output
  -h, --help       Show help
  -v, --version    Show version

Examples
  ak example.com
  ak example.com --save ./acme-audit
  ak new
  ak inspect latest
  ak report latest`;

const commandHelp: Record<Command, string> = {
  new: `ak new
Create a reusable client workspace in ./audits.`,
  list: `ak list
List client workspaces. Newest workspace is marked latest.`,
  check: `ak check [url|workspace] [--save [folder]]
Check title, metadata, headings, images, and CTA signals.`,
  security: `ak security [url|workspace] [--save [folder]]
Check HTTPS, HSTS, CSP, frame, referrer, and cookie protections.`,
  lighthouse: `ak lighthouse [url|workspace] [--save [folder]]
Run Lighthouse performance, accessibility, best-practices, and SEO checks.`,
  inspect: `ak inspect [url|workspace] [--save [folder]]
Run website, security, and Lighthouse checks together.

Shortcut: ak <url>`,
  report: `ak report [latest|workspace]
Create final-report.md and client-email.md from a workspace.`,
};

class CliError extends Error {
  readonly hint?: string;
  readonly exitCode: number;

  constructor(
    message: string,
    hint?: string,
    exitCode = 1,
  ) {
    super(message);
    this.hint = hint;
    this.exitCode = exitCode;
  }
}

function looksLikeDirectUrl(value: string): boolean {
  return (
    /^[a-z][a-z\d+.-]*:\/\//i.test(value) ||
    value.includes(".") ||
    value.startsWith("localhost") ||
    /^\d{1,3}(?:\.\d{1,3}){3}/.test(value)
  );
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = [...argv];
  const parsed: ParsedArgs = {
    save: { explicit: false },
    noColor: false,
    version: false,
  };

  for (let index = args.length - 1; index >= 0; index -= 1) {
    if (args[index] === "--no-color") {
      parsed.noColor = true;
      args.splice(index, 1);
    }
  }

  if (args.includes("-v") || args.includes("--version")) {
    parsed.version = true;
    return parsed;
  }

  if (!args.length) {
    parsed.help = "all";
    return parsed;
  }

  if (args[0] === "help") {
    const requested = args[1];
    if (!requested) {
      parsed.help = "all";
      return parsed;
    }
    if (!commands.has(requested as Command)) {
      throw new CliError(`Unknown command: ${requested}`, "ak --help", 2);
    }
    parsed.help = requested as Command;
    return parsed;
  }

  if (args[0] === "-h" || args[0] === "--help") {
    parsed.help = "all";
    return parsed;
  }

  if (looksLikeDirectUrl(args[0]!)) {
    parsed.command = "inspect";
  } else if (commands.has(args[0] as Command)) {
    parsed.command = args.shift() as Command;
  } else {
    throw new CliError(`Unknown command: ${args[0]}`, "ak --help", 2);
  }

  if (args.includes("-h") || args.includes("--help")) {
    parsed.help = parsed.command;
    return parsed;
  }

  const positionals: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg.startsWith("--save=")) {
      const value = arg.slice("--save=".length).trim();
      if (!value) throw new CliError("Save folder cannot be empty.", "ak <url> --save ./audit", 2);
      parsed.save = { explicit: true, value };
    } else if (arg === "--save") {
      const value = args[index + 1];
      parsed.save = { explicit: true };
      if (value && !value.startsWith("-")) {
        parsed.save.value = value;
        index += 1;
      }
    } else if (arg.startsWith("-")) {
      throw new CliError(`Unknown option: ${arg}`, `ak help ${parsed.command}`, 2);
    } else {
      positionals.push(arg);
    }
  }

  if (positionals.length > 1) {
    throw new CliError("Too many targets.", `ak help ${parsed.command}`, 2);
  }
  parsed.target = positionals[0];

  if (parsed.target && ["new", "list"].includes(parsed.command)) {
    throw new CliError(`ak ${parsed.command} does not accept a target.`, `ak help ${parsed.command}`, 2);
  }
  if (parsed.save.explicit && !["check", "security", "lighthouse", "inspect"].includes(parsed.command)) {
    throw new CliError(`--save is not supported by ak ${parsed.command}.`, `ak help ${parsed.command}`, 2);
  }

  return parsed;
}

function today(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

async function newAudit(workspace: Workspace): Promise<void> {
  if (!ui.canPrompt()) {
    throw new CliError("ak new needs an interactive terminal.", "Run ak new in your terminal.");
  }

  ui.section("New client audit", "four quick questions");
  const clientName = await ui.prompt("Client name", { required: true });
  const url = normalizeUrl(await ui.prompt("Website URL", { required: true }));
  const goal = await ui.prompt("Main goal", { defaultValue: "Improve website results" });
  const pages = await ui.prompt("Pages", { defaultValue: "/, /contact" });
  let businessType = "";
  let targetCustomer = "";
  let conversionAction = "";
  let knownConcerns = "";
  let competitors = "";

  if (await ui.confirm("Add more client context?", false)) {
    businessType = await ui.prompt("Business type");
    targetCustomer = await ui.prompt("Target customer");
    conversionAction = await ui.prompt("Main conversion action");
    knownConcerns = await ui.prompt("Known concerns", { defaultValue: "None" });
    competitors = await ui.prompt("Competitors");
  }

  const slug = slugify(clientName);
  if (!slug) throw new CliError("Client name must contain letters or numbers.");
  const input: AuditInput = {
    clientName,
    slug,
    url,
    businessType,
    goal,
    targetCustomer,
    conversionAction,
    pages: splitCommaList(pages),
    knownConcerns: knownConcerns === "None" ? [] : splitCommaList(knownConcerns),
    competitors: splitCommaList(competitors),
    createdAt: today(),
  };
  const folder = await workspace.createAudit(input);

  ui.section("Workspace ready");
  ui.saved(folder);
  ui.note("Next: ak inspect latest");
}

async function listAudits(workspace: Workspace): Promise<void> {
  const folders = await workspace.listAudits();
  ui.section("Client workspaces");
  if (!folders.length) {
    console.log("  No workspaces yet.");
    ui.note("Create one with ak new");
    return;
  }
  const latest = folders.at(-1);
  for (const folder of folders) {
    console.log(`  ${folder}${folder === latest ? "  latest" : ""}`);
  }
}

async function auditWebsite(workspace: Workspace, folder: string): Promise<string> {
  const files = await workspace.readAuditFiles(folder);
  const website = parseBrief(files.get("brief.md") ?? "").website;
  if (!website) throw new CliError(`No website found in audits/${folder}/brief.md.`);
  return normalizeUrl(website);
}

async function resolveTarget(
  workspace: Workspace,
  target: string | undefined,
  defaultToLatest: boolean,
): Promise<ResolvedTarget> {
  const folders = await workspace.listAudits();
  if (target === "latest" && folders.length) {
    const folder = folders.at(-1)!;
    return { kind: "audit", folder, url: await auditWebsite(workspace, folder), prompted: false };
  }
  if (target === "latest") {
    throw new CliError("No audit workspaces found.", "Create one with ak new.");
  }
  if (target && folders.includes(target)) {
    return {
      kind: "audit",
      folder: target,
      url: await auditWebsite(workspace, target),
      prompted: false,
    };
  }
  if (target && looksLikeDirectUrl(target)) {
    try {
      return { kind: "url", url: normalizeUrl(target), prompted: false };
    } catch {
      throw new CliError(
        `Unknown target: ${target}`,
        "Use a website URL, latest, or a workspace shown by ak list.",
      );
    }
  }
  if (target) {
    throw new CliError(
      `Unknown target: ${target}`,
      "Use a website URL, latest, or a workspace shown by ak list.",
    );
  }
  if (defaultToLatest && folders.length) {
    const folder = folders.at(-1)!;
    return { kind: "audit", folder, url: await auditWebsite(workspace, folder), prompted: false };
  }
  if (ui.canPrompt()) {
    const url = normalizeUrl(await ui.prompt("Website URL", { required: true }));
    return { kind: "url", url, prompted: true };
  }
  throw new CliError("Website URL is required.", "ak example.com");
}

function suggestedFolder(url: string): string {
  const hostname = new URL(url).hostname.replace(/^www\./, "");
  return `./auditkit-${slugify(hostname) || "audit"}`;
}

function expandPath(value: string): string {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return path.resolve(value);
}

async function resolveSaveDestination(
  workspace: Workspace,
  save: SaveRequest,
  url: string,
): Promise<SaveDestination> {
  let value = save.value?.trim();
  if (!value) {
    if (!ui.canPrompt()) {
      throw new CliError("Save folder is missing.", "Use --save ./audit-folder.");
    }
    value = await ui.prompt("Save folder", { defaultValue: suggestedFolder(url) });
  }

  const folders = await workspace.listAudits();
  if (value === "latest") {
    if (!folders.length) {
      throw new CliError("No workspace exists for --save latest.", "Use --save ./audit-folder.");
    }
    return { kind: "audit", folder: folders.at(-1)! };
  }
  if (folders.includes(value)) return { kind: "audit", folder: value };
  return { kind: "directory", folder: expandPath(value) };
}

async function chooseDestination(
  workspace: Workspace,
  target: ResolvedTarget,
  save: SaveRequest,
  offerSave: boolean,
): Promise<SaveDestination | null> {
  if (save.explicit) return resolveSaveDestination(workspace, save, target.url);
  if (target.kind === "audit") return { kind: "audit", folder: target.folder };
  if (offerSave && ui.canPrompt() && (await ui.confirm("Save the results?", true))) {
    return resolveSaveDestination(workspace, { explicit: true }, target.url);
  }
  return null;
}

async function writeExternal(
  destination: SaveDestination,
  filename: string,
  content: string,
): Promise<string> {
  if (destination.kind !== "directory") throw new Error("Expected directory destination.");
  await mkdir(destination.folder, { recursive: true });
  const file = path.join(destination.folder, filename);
  await writeFile(file, content);
  return file;
}

async function saveHtml(
  workspace: Workspace,
  destination: SaveDestination,
  result: HtmlCheck,
): Promise<void> {
  const markdown = formatHtmlMarkdown(result);
  const file =
    destination.kind === "audit"
      ? await workspace.updateWorkspaceSection(destination.folder, "Automated Check", markdown)
      : await writeExternal(destination, "automated-check.md", markdown);
  ui.saved(file);
}

async function saveSecurity(
  workspace: Workspace,
  destination: SaveDestination,
  result: SecurityCheck,
): Promise<void> {
  const markdown = formatSecurityMarkdown(result);
  const file =
    destination.kind === "audit"
      ? await workspace.updateWorkspaceSection(destination.folder, "Security Check", markdown)
      : await writeExternal(destination, "security-check.md", markdown);
  ui.saved(file);
}

async function saveLighthouse(
  workspace: Workspace,
  destination: SaveDestination,
  markdown: string,
  json: string,
): Promise<void> {
  if (destination.kind === "audit") {
    ui.saved(
      await workspace.updateWorkspaceSection(destination.folder, "Lighthouse Check", markdown),
    );
    ui.saved(await workspace.writeAuditFile(destination.folder, "raw/lighthouse.json", json));
    return;
  }
  ui.saved(await writeExternal(destination, "lighthouse.md", markdown));
  ui.saved(await writeExternal(destination, "lighthouse.json", json));
}

async function checkCommand(
  workspace: Workspace,
  targetValue: string | undefined,
  save: SaveRequest,
): Promise<void> {
  const target = await resolveTarget(workspace, targetValue, false);
  const destination = await chooseDestination(workspace, target, save, target.prompted);
  ui.section("Website check", target.url);
  const page = await ui.task("Read website HTML", () => fetchWebsite(target.url));
  const result = analyzeHtml(page);
  console.log(`\n${formatHtmlCli(result)}`);
  if (destination) await saveHtml(workspace, destination, result);
  else ui.note("Add --save to keep the markdown report");
}

async function securityCommand(
  workspace: Workspace,
  targetValue: string | undefined,
  save: SaveRequest,
): Promise<void> {
  const target = await resolveTarget(workspace, targetValue, true);
  const destination = await chooseDestination(workspace, target, save, target.prompted);
  ui.section("Security check", target.url);
  const page = await ui.task("Read response headers", () => fetchWebsite(target.url));
  const result = analyzeSecurity(page);
  console.log(`\n${formatSecurityCli(result)}`);
  if (destination) await saveSecurity(workspace, destination, result);
  else ui.note("Add --save to keep the markdown report");
}

async function lighthouseCommand(
  workspace: Workspace,
  targetValue: string | undefined,
  save: SaveRequest,
): Promise<void> {
  const target = await resolveTarget(workspace, targetValue, true);
  const destination = await chooseDestination(workspace, target, save, target.prompted);
  ui.section("Lighthouse", target.url);
  const result = await ui.task("Run Lighthouse", () => runLighthouse(target.url));
  console.log(`\n${formatLighthouseCli(result.summary)}`);
  if (destination) {
    await saveLighthouse(
      workspace,
      destination,
      formatLighthouseMarkdown(result.summary),
      result.json,
    );
  } else {
    ui.note("Add --save to keep the markdown and JSON reports");
  }
}

async function inspectCommand(
  workspace: Workspace,
  targetValue: string | undefined,
  save: SaveRequest,
): Promise<void> {
  const target = await resolveTarget(workspace, targetValue, true);
  const destination = await chooseDestination(workspace, target, save, target.kind === "url");
  ui.section("Full website audit", target.url);

  const page = await ui.task("Read website and headers", () => fetchWebsite(target.url));
  const html = analyzeHtml(page);
  const security = analyzeSecurity(page);
  console.log(`\n${formatHtmlCli(html)}`);
  console.log(`\n${formatSecurityCli(security)}`);
  if (destination) {
    await saveHtml(workspace, destination, html);
    await saveSecurity(workspace, destination, security);
  }

  const lighthouse = await ui.task("Run Lighthouse", () => runLighthouse(target.url));
  console.log(`\n${formatLighthouseCli(lighthouse.summary)}`);
  if (destination) {
    await saveLighthouse(
      workspace,
      destination,
      formatLighthouseMarkdown(lighthouse.summary),
      lighthouse.json,
    );
  } else {
    ui.note("Add --save to keep all reports");
  }

  if (destination?.kind === "audit") {
    ui.note(`Next: ak report ${destination.folder}`);
  }
}

async function reportCommand(workspace: Workspace, target?: string): Promise<void> {
  let folder: string;
  try {
    folder = await workspace.resolveAudit(target);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new CliError(message, "Create a workspace with ak new.");
  }
  ui.section("Client report", folder);
  const [reportPath, emailPath] = await ui.task("Build report and client email", () =>
    generateReport(workspace, folder),
  );
  ui.saved(reportPath);
  ui.saved(emailPath);
}

export async function run(argv = process.argv.slice(2)): Promise<void> {
  const parsed = parseArgs(argv);
  if (parsed.noColor) ui.setColorsEnabled(false);
  if (parsed.version) {
    console.log(packageJson.version);
    return;
  }
  if (parsed.help) {
    console.log(parsed.help === "all" ? help : commandHelp[parsed.help]);
    return;
  }

  const workspace = new Workspace();
  switch (parsed.command) {
    case "new":
      return newAudit(workspace);
    case "list":
      return listAudits(workspace);
    case "check":
      return checkCommand(workspace, parsed.target, parsed.save);
    case "security":
      return securityCommand(workspace, parsed.target, parsed.save);
    case "lighthouse":
      return lighthouseCommand(workspace, parsed.target, parsed.save);
    case "inspect":
      return inspectCommand(workspace, parsed.target, parsed.save);
    case "report":
      return reportCommand(workspace, parsed.target);
  }
}

async function main(): Promise<void> {
  try {
    await run();
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    ui.error(error.message, error instanceof CliError ? error.hint : undefined);
    process.exitCode = error instanceof CliError ? error.exitCode : 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
