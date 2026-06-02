#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  formatLighthouseCli,
  formatLighthouseReport,
  runLighthouse,
} from "./auditkit/lighthouse-runner.mjs";

const url = process.argv[2];
const outIndex = process.argv.indexOf("--out");
const outDir = outIndex >= 0 ? process.argv[outIndex + 1] : null;

if (!url) {
  console.error("Usage: node scripts/lighthouse.mjs <url> [--out <folder>]");
  process.exit(1);
}

try {
  const result = await runLighthouse(url);
  console.log(formatLighthouseCli(result.summary));

  const folder = outDir ?? process.cwd();
  await mkdir(folder, { recursive: true });

  const markdownPath = path.join(folder, "lighthouse.md");
  const jsonPath = path.join(folder, "lighthouse.json");

  await writeFile(markdownPath, formatLighthouseReport(result.summary), "utf8");
  await writeFile(jsonPath, result.json, "utf8");

  console.log(`LIGHTHOUSE_MD: ${markdownPath}`);
  console.log(`LIGHTHOUSE_JSON: ${jsonPath}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
