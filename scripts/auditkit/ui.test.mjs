import test from "node:test";
import assert from "node:assert/strict";
import {
  box,
  formatHelp,
  formatKeyValue,
  formatSaved,
  withTask,
  scoreStatus,
  section,
  stripAnsi,
} from "./ui.mjs";

test("section renders readable heading without color", () => {
  assert.equal(section("Audit Kit", { color: false }), "\n== Audit Kit ==");
});

test("formatKeyValue aligns label and value", () => {
  assert.equal(formatKeyValue("Score", "74/100", { color: false }), "Score: 74/100");
});

test("box wraps content in a compact terminal panel", () => {
  const output = box("Audit Kit", ["new", "check latest"], { color: false });

  assert.match(output, /\+[-]+\+/);
  assert.match(output, /\| Audit Kit/);
  assert.match(output, /\| new/);
});

test("scoreStatus gives clear labels", () => {
  assert.equal(scoreStatus(90), "strong");
  assert.equal(scoreStatus(70), "okay");
  assert.equal(scoreStatus(45), "needs work");
});

test("formatSaved renders save confirmation", () => {
  assert.match(formatSaved("/tmp/report.md", { color: false }), /\[saved\] \/tmp\/report.md/);
});

test("formatHelp contains simplified commands", () => {
  const help = formatHelp({ color: false });

  assert.match(help, /ak new/);
  assert.match(help, /ak check latest/);
  assert.match(help, /ak report latest/);
});

test("stripAnsi removes color escape codes", () => {
  assert.equal(stripAnsi("\u001b[32mOK\u001b[0m"), "OK");
});

test("withTask reports start and completion in fallback mode", async () => {
  const events = [];
  const result = await withTask("Fetching site", () => "done", {
    spinnerFactory: null,
    log: (value) => events.push(value),
    color: false,
  });

  assert.equal(result, "done");
  assert.deepEqual(events, ["... Fetching site", "[done] Fetching site"]);
});

test("withTask reports failure in fallback mode", async () => {
  const events = [];

  await assert.rejects(
    withTask(
      "Fetching site",
      () => {
        throw new Error("failed");
      },
      {
        spinnerFactory: null,
        log: (value) => events.push(value),
        color: false,
      },
    ),
    /failed/,
  );

  assert.deepEqual(events, ["... Fetching site", "[failed] Fetching site"]);
});
