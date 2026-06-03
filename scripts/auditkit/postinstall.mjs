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
    commandLine("ak new", "create an audit workspace", colors),
    commandLine("ak inspect latest", "run check, security, Lighthouse", colors),
    commandLine("ak report latest", "generate report + client email", colors),
    commandLine("ak list", "show saved audits", colors),
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

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href && shouldShowWelcome()) {
  console.log(welcomeMessage());
}

function commandLine(command, description, colors) {
  return line(`   ${paint(command.padEnd(18), 36, colors)} ${paint(description.padEnd(34), 90, colors)}    `, colors);
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
