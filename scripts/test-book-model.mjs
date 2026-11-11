/**
 * Book page-model test — no browser needed.
 * Run: npm run test:book
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBasePages, expandContinuations } from "../src/lib/book-model.ts";
import { sections, siteTitle } from "../src/data/site.ts";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "..", "src", "content", "recipes");

// Minimal frontmatter parser (mirrors the Zod schema fields we need).
function loadRecipes() {
	return readdirSync(dir)
		.filter((f) => f.endsWith(".md"))
		.sort()
		.map((file) => {
			const fm = readFileSync(join(dir, file), "utf8").split("---")[1];
			const get = (key) => fm.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1];
			const slug = file.replace(/\.md$/, "");
			return {
				slug,
				title: get("title").replace(/^"|"$/g, ""),
				section: get("section").replace(/^"|"$/g, ""),
				inTesting: get("inTesting") === "true",
			};
		});
}

const recipes = loadRecipes();
const pages = buildBasePages(recipes);

// Cover first, back cover last, one divider per section, every recipe present.
assert.equal(pages[0].kind, "cover");
assert.equal(pages[0].title, siteTitle);
assert.equal(pages.at(-1).kind, "back");
const dividers = pages.filter((p) => p.kind === "divider");
assert.equal(dividers.length, sections.length);
assert.deepEqual(
	dividers.map((p) => p.section),
	[...sections],
);
const recipePages = pages.filter((p) => p.kind === "recipe");
assert.equal(recipePages.length, recipes.length);
assert.deepEqual(
	[...new Set(recipePages.map((p) => p.section))],
	[...sections],
);

// Cock & Tails divider carries the preamble.
const tails = dividers.at(-1);
assert.ok(tails.preamble && tails.preamble.length === 2);
assert.ok(tails.referenceLine.includes("1 oz or 30 ml"));

// Continuations: expandContinuations inserts cont pages right after their
// recipe, in chunk order, and is deterministic.
const base = buildBasePages([
	{ slug: "a", title: "A", section: sections[0], inTesting: false },
	{ slug: "long-recipe", title: "Long", section: sections[0], inTesting: true },
	{ slug: "b", title: "B", section: sections[0], inTesting: false },
]);
const expanded = expandContinuations(base, {
	"long-recipe": ["chunk0", "chunk1", "chunk2"],
	"a": ["only"],
});
assert.deepEqual(
	expanded.map((p) => p.kind),
	[
		"cover",
		"divider",
		"recipe", // a (single chunk)
		"recipe", // long-recipe
		"recipe-cont",
		"recipe-cont",
		"recipe", // b
		...Array(sections.length - 1).fill("divider"),
		"back",
	],
);
assert.deepEqual(expanded, expandContinuations(base, {
	"long-recipe": ["chunk0", "chunk1", "chunk2"],
	"a": ["only"],
}));
assert.equal(expanded[0].number ?? undefined, undefined); // cont pages carry no payload

// Real book: the 3 longest recipes (chunked by the browser paginator) would
// each produce >1 chunk — verify the model inserts cont pages for them.
const longOnes = ["butter-paneer", "chickn-pot-pie", "low-effort-carrot-cake"];
const chunksBySlug = Object.fromEntries(recipes.map((r) => [r.slug, ["x"]]));
for (const slug of longOnes) chunksBySlug[slug] = ["x", "y"];
const full = expandContinuations(pages, chunksBySlug);
for (const slug of longOnes) {
	const idx = full.findIndex((p) => p.kind === "recipe" && p.slug === slug);
	assert.equal(full[idx + 1].kind, "recipe-cont", `${slug} continuation follows its recipe`);
}
assert.equal(full.at(-1).kind, "back");

console.log(`book-model: ${pages.length} base pages, ${full.length} with continuations — all assertions passed`);
