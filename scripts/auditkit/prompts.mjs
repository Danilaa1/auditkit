import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { slugify, today } from "./utils.mjs";
import { section } from "./ui.mjs";

function splitLines(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function collectAuditInput() {
  const rl = createInterface({ input, output });

  try {
    console.log(section("New Audit"));
    const clientName = await rl.question("Client name            ");
    const url = await rl.question("Website URL            ");
    const businessType = await rl.question("Business type          ");
    const goal = await rl.question("Primary goal           ");
    const targetCustomer = await rl.question("Target customer        ");
    const conversionAction = await rl.question("Main conversion action ");
    const pages = await rl.question("Pages, comma-separated ");
    const knownConcerns = await rl.question("Known concerns         ");
    const competitors = await rl.question("Competitors            ");

    return {
      clientName: clientName.trim(),
      slug: slugify(clientName),
      url: url.trim(),
      businessType: businessType.trim(),
      goal: goal.trim(),
      targetCustomer: targetCustomer.trim(),
      conversionAction: conversionAction.trim(),
      pages: splitLines(pages),
      knownConcerns: splitLines(knownConcerns),
      competitors: splitLines(competitors),
      createdAt: today(),
    };
  } finally {
    rl.close();
  }
}
