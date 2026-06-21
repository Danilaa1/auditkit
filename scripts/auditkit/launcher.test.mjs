import test from "node:test";
import assert from "node:assert/strict";
import { chmod, copyFile, mkdir, mkdtemp, symlink } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("launcher explains how to install Rust when cargo is unavailable", async () => {
  const root = await mkdtemp(join(tmpdir(), "auditkit-launcher-"));
  const scriptDir = join(root, "scripts", "auditkit");
  const binDir = join(root, "test-bin");
  const launcher = join(scriptDir, "ak");

  await mkdir(scriptDir, { recursive: true });
  await mkdir(binDir);
  await copyFile(new URL("./ak", import.meta.url), launcher);
  await chmod(launcher, 0o755);
  await symlink("/usr/bin/dirname", join(binDir, "dirname"));
  await symlink("/usr/bin/readlink", join(binDir, "readlink"));

  const result = spawnSync("/bin/sh", [launcher], {
    encoding: "utf8",
    env: {
      ...process.env,
      AUDITKIT_SKIP_WELCOME: "1",
      PATH: binDir,
    },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Audit Kit requires Rust and Cargo/);
  assert.match(result.stderr, /https:\/\/rustup\.rs/);
});
