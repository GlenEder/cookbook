/**
 * Ordered page list for the Glen Approved Foods flipbook — the single source
 * of truth consumed by both the Astro page (src/pages/index.astro) and the
 * React book island (src/components/Book). Stage 3 (TOC + search) builds on
 * these exports too.
 *
 * Pure TS, no DOM and no astro imports, so scripts/test-book-model.mjs can run
 * it directly under `node --experimental-strip-types`.
 */
import {
	siteTitle,
	siteIntro,
	cocktailSectionIntro,
	cocktailReferenceLine,
	sections,
} from "../data/site.ts";

export type RecipeInput = {
	slug: string;
	title: string;
	section: string;
	yield?: string;
	inTesting: boolean;
	source?: string;
};

export type BookPage =
	| { kind: "cover"; title: string; intro: string }
	| {
			kind: "divider";
			section: string;
			preamble?: string[];
			referenceLine?: string;
	  }
	| {
			kind: "recipe";
			slug: string;
			section: string;
			title: string;
			yield?: string;
			inTesting: boolean;
			source?: string;
	  }
	/** Continuation page for a recipe that did not fit on one page. */
	| { kind: "recipe-cont"; slug: string; section: string; title: string }
	| { kind: "toc"; part: number; count: number }
	| { kind: "back" };

/**
 * Base page list: cover → per section (in doc order): divider + recipes
 * (alphabetical by slug within a section — the only stable order the content
 * collection gives us), → back cover. Recipe HTML is attached later
 * (server-side render) and continuations are inserted after pagination.
 */
export function buildBasePages(recipes: RecipeInput[]): BookPage[] {
	const pages: BookPage[] = [{ kind: "cover", title: siteTitle, intro: siteIntro }];
	for (const section of sections) {
		pages.push({
			kind: "divider",
			section,
			preamble: section === "Cock & Tails" ? cocktailSectionIntro : undefined,
			referenceLine: section === "Cock & Tails" ? cocktailReferenceLine : undefined,
		});
		for (const recipe of recipes.filter((r) => r.section === section)) {
			pages.push({
				kind: "recipe",
				slug: recipe.slug,
				section: recipe.section,
				title: recipe.title,
				yield: recipe.yield,
				inTesting: recipe.inTesting,
				source: recipe.source,
			});
		}
	}
	pages.push({ kind: "back" });
	return pages;
}

/**
 * Insert `tocCount` TOC pages right after the front cover (index 1). The count
 * must come from measuring the TOC contents client-side BEFORE recipes are
 * paginated, since it shifts every subsequent page index.
 */
export function insertTocPages(base: BookPage[], tocCount: number): BookPage[] {
	const toc: BookPage[] = Array.from({ length: tocCount }, (_, part) => ({
		kind: "toc",
		part,
		count: tocCount,
	}));
	const out = [...base];
	out.splice(1, 0, ...toc);
	return out;
}

/**
 * Map slugs (recipe → its first page) and section names (→ divider page) to
 * indexes in a fully expanded page list. Only valid AFTER insertTocPages +
 * expandContinuations; this is how TOC/search jumps resolve to the right page.
 */
export function buildPageIndexMap(pages: BookPage[]): {
	bySlug: Record<string, number>;
	bySection: Record<string, number>;
} {
	const bySlug: Record<string, number> = {};
	const bySection: Record<string, number> = {};
	pages.forEach((page, index) => {
		if ((page.kind === "recipe" || page.kind === "recipe-cont") && !(page.slug in bySlug)) {
			bySlug[page.slug] = index;
		} else if (page.kind === "divider" && !(page.section in bySection)) {
			bySection[page.section] = index;
		}
	});
	return { bySlug, bySection };
}

/**
 * Insert continuation pages after their recipe page.
 * `chunksBySlug[slug]` holds the paginated HTML chunks for that recipe
 * (chunk 0 = content on the recipe's own page, 1.. = continuation pages).
 */
export function expandContinuations(
	base: BookPage[],
	chunksBySlug: Record<string, string[]>,
): BookPage[] {
	const out: BookPage[] = [];
	for (const page of base) {
		out.push(page);
		if (page.kind !== "recipe") continue;
		const chunks = chunksBySlug[page.slug];
		if (!chunks) continue;
		for (let i = 1; i < chunks.length; i++) {
			out.push({
				kind: "recipe-cont",
				slug: page.slug,
				section: page.section,
				title: page.title,
			});
		}
	}
	return out;
}

/** Flip the book to a page index (0-based, in the expanded page list). */
export function goToPage(index: number): void {
	if (typeof window !== "undefined") {
		window.dispatchEvent(new CustomEvent("book:goto", { detail: index }));
	}
}
