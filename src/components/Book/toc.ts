/**
 * TOC page contents for the flipbook (Stage 3).
 *
 * The TOC is paginated client-side with the same measure host as the recipes
 * (see Book.tsx): entries are individual blocks, so paginateHtml splits between
 * rows and never mid-entry. Entry→page numbers are unknown while measuring, so
 * every row carries an empty .toc-num span (fixed min-width keeps line heights
 * stable); fillTocNumbers fills them from the post-pagination index map.
 */
import type { BookPage } from "../../lib/book-model.ts";

function esc(text: string): string {
	return text.replace(/[&<>"']/g, (c) =>
		({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
	);
}

/** One block per section heading and recipe row, in book order. */
export function buildTocHtml(pages: BookPage[]): string {
	const parts: string[] = ['<h2 class="toc-heading">Contents</h2>'];
	for (const page of pages) {
		if (page.kind === "divider") {
			parts.push(
				`<button type="button" class="toc-section" data-section="${esc(page.section)}">${esc(page.section)}</button>`,
			);
		} else if (page.kind === "recipe") {
			parts.push(
				`<button type="button" class="toc-entry" data-slug="${esc(page.slug)}">` +
					`<span class="toc-name">${esc(page.title)}</span>` +
					'<span class="toc-dots" aria-hidden="true"></span>' +
					`<span class="toc-num" data-num="${esc(page.slug)}"></span>` +
					"</button>",
			);
		}
	}
	return parts.join("");
}

/** Replace the empty .toc-num spans with the recipe's 1-based page number. */
export function fillTocNumbers(
	html: string,
	bySlug: Record<string, number>,
): string {
	return html.replace(
		/class="toc-num" data-num="([^"]*)"><\/span>/g,
		(_, slug) =>
			`class="toc-num" data-num="${slug}">${bySlug[slug] !== undefined ? bySlug[slug] + 1 : "?"}</span>`,
	);
}
