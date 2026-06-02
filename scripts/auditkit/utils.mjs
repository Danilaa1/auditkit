import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export const rootDir = path.resolve(currentDir, "../..");
export const auditsDir = path.join(rootDir, "audits");

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function auditFolderName(audit) {
  return `${audit.createdAt}-${audit.slug}`;
}

export function auditFolderPath(audit) {
  return path.join(auditsDir, auditFolderName(audit));
}

export async function ensureAuditsDir() {
  await mkdir(auditsDir, { recursive: true });
}

export async function listAuditFolders() {
  await ensureAuditsDir();

  const entries = await readdir(auditsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export async function writeAuditFiles(audit, files) {
  const folder = auditFolderPath(audit);
  await mkdir(folder, { recursive: true });

  await Promise.all(
    Object.entries(files).map(async ([filename, content]) => {
      const filePath = path.join(folder, filename);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, content, "utf8");
    }),
  );

  return folder;
}
