import { pathToFileURL } from "node:url";

export function shouldShowWelcome(env = process.env) {
  return !env.CI && !env.AUDITKIT_SKIP_WELCOME && env.npm_config_loglevel !== "silent";
}

export function welcomeMessage(env = process.env) {
  const colors = !env.NO_COLOR;
  const rows = [
    line("                                                            ", colors),
    line(`   ${paint("Audit Kit", 96, colors)}                                                `, colors),
    line(`   ${paint("Local website audits from your terminal.", 90, colors)}                 `, colors),
    line("                                                            ", colors),
    divider(colors),
    line(`   ${paint("Try first", 97, colors)}                                                `, colors),
    line("                                                            ", colors),
    commandLine("ak check", "guided website check", colors),
    commandLine("ak check --save", "choose a save folder", colors),
    commandLine("ak new", "create a full audit", colors),
    commandLine("ak inspect latest", "run every check", colors),
    line("                                                            ", colors),
  ];

  return [
    "",
    glow("    · ✦ ·        ·          · ✧ ·          ·        · ✦ ·", colors),
    `${corner("╭", colors)}${gradient("────────────────────────────────────────────────────────────", colors)}${corner("╮", colors)}`,
    ...rows,
    `${corner("╰", colors)}${gradient("────────────────────────────────────────────────────────────", colors)}${corner("╯", colors)}`,
    glow("      ·        · ✧ ·          ·        · ✦ ·        ·", colors),
  ].join("\n");
}

export function showWelcome(stream = process.stderr, env = process.env) {
  if (shouldShowWelcome(env)) {
    stream.write(`${welcomeMessage(env)}\n`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  showWelcome();
}

function commandLine(command, description, colors) {
  return line(`   ${paint(command.padEnd(24).slice(0, 24), 36, colors)} ${paint(description.padEnd(28).slice(0, 28), 90, colors)}    `, colors);
}

function line(content, colors) {
  return `${border("│", colors)}${content}${border("│", colors)}`;
}

function divider(colors) {
  return `${border("├", colors)}${gradient("────────────────────────────────────────────────────────────", colors)}${border("┤", colors)}`;
}

function gradient(value, colors) {
  const palette = [36, 96, 35, 93, 95, 94];
  return [...value]
    .map((character, index) => paint(character, palette[index % palette.length], colors))
    .join("");
}

function border(value, colors) {
  return paint(value, 96, colors);
}

function corner(value, colors) {
  return paint(value, 95, colors);
}

function glow(value, colors) {
  return paint(value, 90, colors);
}

function paint(value, code, colors) {
  return colors ? `\x1b[${code}m${value}\x1b[0m` : value;
}
