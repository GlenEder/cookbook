#!/usr/bin/env node
/**
 * Build-time sanity check for the recipes content collection.
 * Usage: node scripts/validate-recipes.mjs   (or `npm run validate`)
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = new URL("../src/content/recipes/", import.meta.url).pathname;
const files = readdirSync(dir).filter((f) => f.endsWith(".md"));

const SECTIONS = [
	"Basic Things You Should Know",
	"Breads & Breakfast",
	"Sauce & Butter Me Up",
	"Apps, Snacks, & Sides (aka ASS)",
	"Entree Deez Nuts",
	"Desserts not Deserts",
	"Cock & Tails",
];

let failures = 0;
const perSection = Object.fromEntries(SECTIONS.map((s) => [s, 0]));

for (const file of files) {
	const text = readFileSync(join(dir, file), "utf8");
	const fail = (msg) => {
		console.error(`FAIL ${file}: ${msg}`);
		failures++;
	};

	const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n/);
	if (!fmMatch) fail("missing frontmatter");
	const fm = fmMatch?.[1] ?? "";
	const field = (name) => fm.match(new RegExp(`^${name}: (.*)$`, "m"))?.[1];
	const section = field("section")?.replaceAll('"', "");
	if (!field("title")) fail("no title");
	if (!SECTIONS.includes(section)) fail(`bad section: ${section}`);
	else perSection[section]++;
	if (!["true", "false"].includes(field("inTesting"))) fail("bad inTesting");

	const body = text.slice(fmMatch[0].length);
	const ingredients = body.match(/## Ingredients\n([\s\S]*?)\n## Instructions/);
	if (!ingredients) {
		fail("missing Ingredients/Instructions structure");
		continue;
	}
	if (!/- .+/.test(ingredients[1])) fail("empty ingredients list");
	const instructions = body.split("## Instructions")[1]?.trim();
	if (!instructions) fail("empty instructions");
}

console.log(`Validated ${files.length} recipes:`);
for (const [section, count] of Object.entries(perSection)) console.log(`  ${count}  ${section}`);
if (failures) {
	console.error(`${failures} failure(s)`);
	process.exit(1);
}
console.log("All checks passed.");
