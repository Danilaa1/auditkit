import { createInterface } from "node:readline/promises";

export type Tone = "positive" | "warning" | "critical" | "neutral";

export type Signal = {
  label: string;
  value: string | number;
  tone?: Tone;
};

export type Feedback = {
  text: string;
  tone: Exclude<Tone, "neutral">;
};

let colorsEnabled = Boolean(process.stdout.isTTY && !process.env.NO_COLOR);

export function setColorsEnabled(value: boolean): void {
  colorsEnabled = value;
}

function paint(code: string, value: unknown): string {
  const text = String(value);
  return colorsEnabled ? `\x1b[${code}m${text}\x1b[0m` : text;
}

const accent = (value: unknown) => paint("1;36", value);
const bold = (value: unknown) => paint("1", value);
const dim = (value: unknown) => paint("2", value);
const green = (value: unknown) => paint("1;32", value);
const yellow = (value: unknown) => paint("1;33", value);
const red = (value: unknown) => paint("1;31", value);

function tone(value: unknown, valueTone: Tone): string {
  if (valueTone === "positive") return green(value);
  if (valueTone === "warning") return yellow(value);
  if (valueTone === "critical") return red(value);
  return String(value);
}

export function scoreStatus(score: number): string {
  if (score >= 85) return "strong";
  if (score >= 65) return "okay";
  return "needs work";
}

function scoreTone(score: number): Tone {
  if (score >= 85) return "positive";
  if (score >= 65) return "warning";
  return "critical";
}

export function section(title: string, detail?: string): void {
  console.log(`\n${accent(title)}${detail ? `  ${dim(detail)}` : ""}`);
}

export function resultBlock(
  title: string,
  url: string,
  score: number | null,
  signals: Signal[],
  feedback: Feedback[],
): string {
  const rows: Signal[] = [
    { label: "URL", value: url },
    ...(score === null
      ? []
      : [
          {
            label: "Score",
            value: `${score}/100 · ${scoreStatus(score)}`,
            tone: scoreTone(score),
          } satisfies Signal,
        ]),
    ...signals,
  ];
  const width = Math.max(...rows.map((row) => row.label.length), 5);
  const lines = [
    accent(title),
    ...rows.map(
      (row) =>
        `  ${dim(row.label.padEnd(width))}  ${tone(row.value, row.tone ?? "neutral")}`,
    ),
  ];

  if (feedback.length) {
    lines.push("", bold("What to fix"));
    lines.push(
      ...feedback.map((item) => {
        const label = item.tone === "critical" ? "fix" : item.tone === "warning" ? "watch" : "good";
        return `  ${tone(label.padEnd(5), item.tone)} ${item.text}`;
      }),
    );
  }

  return lines.join("\n");
}

export function saved(path: string): void {
  console.log(`  ${green("saved")}  ${path}`);
}

export function note(value: string): void {
  console.log(`  ${accent(">")} ${value}`);
}

export function error(value: string, hint?: string): void {
  console.error(`\n${red("Error:")} ${value}`);
  if (hint) console.error(`${dim("Try:")} ${hint}`);
}

export function canPrompt(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export async function prompt(
  label: string,
  options: { defaultValue?: string; required?: boolean } = {},
): Promise<string> {
  if (!canPrompt()) {
    throw new Error(`Cannot prompt for ${label.toLowerCase()} outside an interactive terminal.`);
  }

  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    while (true) {
      const suffix = options.defaultValue ? ` ${dim(`(${options.defaultValue})`)}` : "";
      const value = (await terminal.question(`${accent(">")} ${label}${suffix}: `)).trim();
      const answer = value || options.defaultValue || "";
      if (answer || !options.required) return answer;
      console.log(`  ${yellow("required")} ${label}`);
    }
  } finally {
    terminal.close();
  }
}

export async function confirm(label: string, defaultValue = true): Promise<boolean> {
  const answer = (
    await prompt(`${label} ${defaultValue ? "(Y/n)" : "(y/N)"}`)
  ).toLowerCase();
  if (!answer) return defaultValue;
  return answer === "y" || answer === "yes";
}

export async function task<T>(label: string, work: () => Promise<T>): Promise<T> {
  const started = performance.now();
  if (process.stdout.isTTY) process.stdout.write(`  ${dim("working")} ${label}`);

  try {
    const result = await work();
    const elapsed = `${Math.round(performance.now() - started)}ms`;
    if (process.stdout.isTTY) {
      process.stdout.write(`\r\x1b[2K  ${green("done")}    ${label} ${dim(elapsed)}\n`);
    } else {
      console.log(`done ${label} (${elapsed})`);
    }
    return result;
  } catch (cause) {
    if (process.stdout.isTTY) {
      process.stdout.write(`\r\x1b[2K  ${red("failed")}  ${label}\n`);
    }
    throw cause;
  }
}
