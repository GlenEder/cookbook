/**
 * Book page-model test — no browser needed.
 * Run: npm run test:book
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
	buildBasePages,
	buildPageIndexMap,
	expandContinuations,
	insertTocPages,
} from "../src/lib/book-model.ts";
import { backUpToWhitespace } from "../src/components/Book/paginate.ts";
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

// TOC insertion (Stage 3): toc pages go right after the cover, numbered in
// order, and shift every later index.
const withToc = insertTocPages(base, 3);
assert.equal(withToc[0].kind, "cover");
assert.deepEqual(
	withToc.slice(1, 4).map((p) => ({ kind: p.kind, part: p.part, count: p.count })),
	[
		{ kind: "toc", part: 0, count: 3 },
		{ kind: "toc", part: 1, count: 3 },
		{ kind: "toc", part: 2, count: 3 },
	],
);
assert.equal(withToc[4].kind, "divider");
assert.equal(withToc[4].section, sections[0]);
assert.equal(withToc.at(-1).kind, "back");
assert.equal(withToc.length, base.length + 3);

// Entry→page mapping (Stage 3 contract): buildPageIndexMap resolves against the
// FULLY expanded list (toc inserted + continuations), so TOC/search jumps land
// on the recipe's first page.
const chunksFull = Object.fromEntries(recipes.map((r) => [r.slug, ["x"]]));
for (const slug of longOnes) chunksFull[slug] = ["x", "y", "z"]; // 2 continuations each
const fullBook = expandContinuations(insertTocPages(pages, 2), chunksFull);
const map = buildPageIndexMap(fullBook);

// Butter Paneer has continuations: its mapped index must be the index of its
// FIRST page (its own, not a cont page), and a recipe after it must be shifted
// by the toc pages AND butter-paneer's continuations.
const butter = "butter-paneer";
const butterFirst = fullBook.findIndex((p) => p.kind === "recipe" && p.slug === butter);
assert.ok(butterFirst > 0);
assert.equal(fullBook[butterFirst].kind, "recipe");
assert.equal(fullBook[butterFirst + 1].kind, "recipe-cont");
assert.equal(fullBook[butterFirst + 2].kind, "recipe-cont");
assert.equal(map.bySlug[butter], butterFirst);
// the recipe that follows butter-paneer in its section starts after both cont pages
const afterButter = fullBook.findIndex(
	(p, i) => i > butterFirst && p.kind === "recipe",
);
assert.ok(afterButter > butterFirst + 2);
assert.equal(map.bySlug[fullBook[afterButter].slug], afterButter);

// Every recipe in the book resolves to a real recipe page (never a cont page).
for (const recipe of recipes) {
	const at = map.bySlug[recipe.slug];
	assert.ok(at !== undefined && fullBook[at].kind === "recipe", `${recipe.slug} maps to its first page`);
}
// Section headings resolve to that section's divider page.
for (const section of sections) {
	const at = map.bySection[section];
	assert.equal(fullBook[at].kind, "divider");
	assert.equal(fullBook[at].section, section);
}

// Whitespace back-off (Stage 3 side task): oversized blocks split at word
// boundaries, never mid-word.
assert.equal(backUpToWhitespace("abc def ghi", 7), 4); // mid-"def" → cut after "abc "
assert.equal(backUpToWhitespace("abc def ghi", 3), 3); // already at whitespace
assert.equal(backUpToWhitespace("abcdefgh", 5), 5); // no whitespace → unchanged
assert.equal(backUpToWhitespace("a b c", 5), 4); // backs up to after the space
assert.equal(backUpToWhitespace("", 0), 0);

console.log(`book-model: ${pages.length} base pages, ${full.length} with continuations — all assertions passed`);
