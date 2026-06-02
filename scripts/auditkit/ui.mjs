import { spinner } from "@clack/prompts";

const ansiPattern = /\u001b\[[0-9;]*m/g;

const codes = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  red: "\u001b[31m",
  cyan: "\u001b[36m",
  gray: "\u001b[90m",
};

function shouldColor(options = {}) {
  if (options.color === false || process.env.NO_COLOR) {
    return false;
  }

  return options.color === true || Boolean(process.stdout.isTTY);
}

export function color(value, style, options = {}) {
  if (!shouldColor(options)) {
    return value;
  }

  return `${codes[style] ?? ""}${value}${codes.reset}`;
}

export function stripAnsi(value) {
  return value.replace(ansiPattern, "");
}

export function section(title, options = {}) {
  return `\n${color(`== ${title} ==`, "bold", options)}`;
}

export function formatKeyValue(label, value, options = {}) {
  return `${color(`${label}:`, "dim", options)} ${value}`;
}

export function scoreStatus(score) {
  if (score >= 85) {
    return "strong";
  }

  if (score >= 65) {
    return "okay";
  }

  return "needs work";
}

export function scoreColor(score) {
  if (score >= 85) {
    return "green";
  }

  if (score >= 65) {
    return "yellow";
  }

  return "red";
}

export function bullet(value, options = {}) {
  return `${color("-", "cyan", options)} ${value}`;
}

export function formatSaved(filePath, options = {}) {
  return `${color("[saved]", "green", options)} ${filePath}`;
}

export function formatError(message, options = {}) {
  return `${color("[error]", "red", options)} ${message}`;
}

export function box(title, lines, options = {}) {
  const plainLines = [title, ...lines].map(stripAnsi);
  const width = Math.max(...plainLines.map((line) => line.length), 12);
  const border = `+${"-".repeat(width + 2)}+`;
  const padded = (line) => {
    const plainLength = stripAnsi(line).length;
    return `| ${line}${" ".repeat(width - plainLength)} |`;
  };

  return [
    color(border, "gray", options),
    padded(color(title, "bold", options)),
    color(border, "gray", options),
    ...lines.map(padded),
    color(border, "gray", options),
  ].join("\n");
}

export function formatHelp(options = {}) {
  return box(
    "Audit Kit",
    [
      "ak new              create audit workspace",
      "ak check latest     run + save quick website feedback",
      "ak security latest  run + save security header check",
      "ak lighthouse latest run + save Lighthouse audit",
      "ak inspect latest   run check + security + Lighthouse",
      "ak report latest    create final report + client email",
      "ak list             show audit folders",
      "ak check <url>      quick one-off website check",
      "ak security <url>   quick one-off security check",
      "ak lighthouse <url> quick one-off Lighthouse check",
    ],
    options,
  );
}

export async function withTask(label, task, options = {}) {
  const useSpinner = options.spinnerFactory !== null && (options.spinnerFactory || process.stdout.isTTY);
  const log = options.log ?? console.log;

  if (!useSpinner) {
    log(`... ${label}`);

    try {
      const result = await task();
      log(`[done] ${label}`);
      return result;
    } catch (error) {
      log(`[failed] ${label}`);
      throw error;
    }
  }

  const s = (options.spinnerFactory ?? spinner)();
  s.start(label);

  try {
    const result = await task();
    s.stop(`Done: ${label}`);
    return result;
  } catch (error) {
    s.stop(`Failed: ${label}`, 1);
    throw error;
  }
}
