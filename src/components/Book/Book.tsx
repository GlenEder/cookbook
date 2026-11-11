import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import HTMLFlipBook from "react-pageflip";
import {
	buildPageIndexMap,
	expandContinuations,
	goToPage,
	insertTocPages,
	type BookPage,
} from "../../lib/book-model.ts";
import { paginateHtml } from "./paginate";
import { buildTocHtml, fillTocNumbers } from "./toc";
import PageFrame from "./PageFrame";
import Search from "./Search";

const PAGE_RATIO = 1.45;
/** Reserves matching the CSS box on every measured recipe page. */
const PAGE_PAD_X = 60; // .page side padding (2 × 30px)
const PAGE_PAD_Y = 70; // .page top+bottom padding (32 + 38)
const PAGE_HEAD = 88; // fixed .page-head height + its bottom margin

type PageSize = { w: number; h: number; mobile: boolean };

function computePageSize(): PageSize {
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	if (vw < 900) {
		const w = Math.max(300, Math.min(440, vw - 24));
		const h = Math.max(w, Math.min(Math.round(w * 1.5), vh - 48));
		return { w, h, mobile: true };
	}
	let w = Math.min(440, Math.floor((vw - 64) / 2));
	let h = Math.round(w * PAGE_RATIO);
	if (h > vh - 88) {
		h = vh - 88;
		w = Math.min(w, Math.floor(h / PAGE_RATIO));
	}
	return { w, h, mobile: false };
}

/** Make sure the self-hosted serif is actually loaded before measuring. */
async function waitForFonts(): Promise<void> {
	try {
		await Promise.all([
			document.fonts.load('16px "EB Garamond"'),
			document.fonts.load('italic 16px "EB Garamond"'),
			document.fonts.load('700 16px "EB Garamond"'),
		]);
		await document.fonts.ready;
	} catch {
		/* fonts API unavailable — measure with whatever is loaded */
	}
}

/** Recipe HTML lives in hidden <template data-recipe-html> nodes from Astro. */
function readRecipeHtml(): Record<string, string> {
	const map: Record<string, string> = {};
	document.querySelectorAll<HTMLElement>("template[data-recipe-html]").forEach((t) => {
		map[t.dataset.recipeHtml!] = t.innerHTML;
	});
	return map;
}

export default function Book({ pages }: { pages: BookPage[] }) {
	const [size, setSize] = useState<PageSize>(() =>
		typeof window === "undefined" ? { w: 440, h: 638, mobile: false } : computePageSize(),
	);
	const [ready, setReady] = useState(false);
	const [expanded, setExpanded] = useState<{
		pages: BookPage[];
		chunks: Record<string, string[]>;
		tocChunks: string[];
		map: ReturnType<typeof buildPageIndexMap>;
	}>({
		pages,
		chunks: {},
		tocChunks: [],
		map: { bySlug: {}, bySection: {} },
	});
	const flipRef = useRef<any>(null);
	const stageRef = useRef<HTMLDivElement>(null);

	// TOC rows live inside flipbook pages: without this, the flipbook's own
	// mousedown/touchstart click-to-turn ALSO fires (the target is the row's
	// span, not the button, so page-flip's checkTarget lets it through) and the
	// jump over-flips by one page. Scope to the TOC controls only — recipe page
	// roots also carry data-slug, which must NOT swallow flipping there.
	// Intercept in capture; the row's click still bubbles to handleStageClick.
	useEffect(() => {
		const stage = stageRef.current;
		if (!stage) return;
		const stop = (e: Event) => {
			if ((e.target as HTMLElement)?.closest?.(".toc-entry,.toc-section")) {
				e.stopPropagation();
			}
		};
		for (const type of ["mousedown", "touchstart"]) {
			stage.addEventListener(type, stop, true);
		}
		return () => {
			for (const type of ["mousedown", "touchstart"]) {
				stage.removeEventListener(type, stop, true);
			}
		};
	}, [ready]);

	// Paginate only after fonts are ready; rerun whenever the page size changes.
	useEffect(() => {
		let cancelled = false;
		(async () => {
			await waitForFonts();
			if (cancelled) return;
			const htmlBySlug = readRecipeHtml();
			const box = {
				width: size.w - PAGE_PAD_X,
				// TOC pages have no .page-head, so their content box is taller.
				tocHeight: size.h - PAGE_PAD_Y - 8,
				height: size.h - PAGE_PAD_Y - PAGE_HEAD,
			};
			// 1. Paginate the TOC first — its page count shifts every later index.
			const tocChunks = paginateHtml(buildTocHtml(pages), {
				width: box.width,
				height: box.tocHeight,
			});
			// 2. Insert TOC pages after the cover, then paginate + expand recipes.
			const base = insertTocPages(pages, tocChunks.length);
			const chunks: Record<string, string[]> = {};
			for (const page of base) {
				if (page.kind !== "recipe") continue;
				chunks[page.slug] = paginateHtml(htmlBySlug[page.slug] ?? "", box);
			}
			const finalPages = expandContinuations(base, chunks);
			// 3. Entry→page mapping exists only now; fill the TOC numbers from it.
			const map = buildPageIndexMap(finalPages);
			setExpanded({
				pages: finalPages,
				chunks,
				tocChunks: tocChunks.map((chunk) => fillTocNumbers(chunk, map.bySlug)),
				map,
			});
			setReady(true);
		})();
		return () => {
			cancelled = true;
		};
	}, [pages, size.w, size.h]);

	useEffect(() => {
		const onResize = () => setSize(computePageSize());
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);

	// Stage 3 hooks in via goToPage(index) from src/lib/book-model.ts.
	useEffect(() => {
		const onGoto = (e: Event) => {
			const target = (e as CustomEvent<number>).detail;
			const flip = flipRef.current?.pageFlip?.();
			if (flip) flip.turnToPage(Math.max(0, Math.min(target, expanded.pages.length - 1)));
		};
		window.addEventListener("book:goto", onGoto);
		return () => window.removeEventListener("book:goto", onGoto);
	}, [expanded.pages.length]);

	// Pair every page with its HTML chunk (TOC/recipe pages take their chunk,
	// continuation pages take chunks 1.. in order).
	const items = useMemo(() => {
		const out: { page: BookPage; html?: string }[] = [];
		const cursor: Record<string, number> = {};
		for (const page of expanded.pages) {
			if (page.kind === "recipe") {
				cursor[page.slug] = 1;
				out.push({ page, html: expanded.chunks[page.slug]?.[0] ?? "" });
			} else if (page.kind === "recipe-cont") {
				const i = cursor[page.slug] ?? 1;
				cursor[page.slug] = i + 1;
				out.push({ page, html: expanded.chunks[page.slug]?.[i] ?? "" });
			} else if (page.kind === "toc") {
				out.push({ page, html: expanded.tocChunks[page.part] ?? "" });
			} else {
				out.push({ page });
			}
		}
		return out;
	}, [expanded]);

	// TOC rows and search results all flip via the same goToPage → book:goto
	// contract (src/lib/book-model.ts).
	const jumpToSlug = (slug: string) => {
		const index = expanded.map.bySlug[slug];
		if (index !== undefined) goToPage(index);
	};

	const handleStageClick = (e: ReactMouseEvent) => {
		// Scope to the actual TOC controls: recipe/cont page roots carry
		// data-slug too, and matching those would jump instead of flipping.
		const target = (e.target as HTMLElement).closest(".toc-entry,.toc-section");
		if (!target) return;
		const slug = target.getAttribute("data-slug");
		const index = slug
			? expanded.map.bySlug[slug]
			: expanded.map.bySection[target.getAttribute("data-section")!];
		if (index !== undefined) goToPage(index);
	};

	if (!ready) {
		return (
			<div className="book-stage">
				<p className="book-loading">Opening the cookbook…</p>
			</div>
		);
	}

	return (
		<div className="book-stage" ref={stageRef} onClick={handleStageClick}>
			<div role="group" aria-label="Cookbook flipbook">
				<HTMLFlipBook
				key={`${size.w}x${size.h}m${size.mobile}`}
				ref={flipRef}
				width={size.w}
				height={size.h}
				size="fixed"
				minWidth={280}
				maxWidth={1000}
				minHeight={400}
				maxHeight={1400}
				showCover
				usePortrait={size.mobile}
				drawShadow
				maxShadowOpacity={0.5}
				flippingTime={700}
				useMouseEvents
				mobileScrollSupport={false}
				showPageCorners
				clickEventForward
				className="book"
			>
				{items.map(({ page, html }, i) => (
					<PageFrame key={`${i}-${page.kind}`} page={page} number={i + 1} html={html} />
						))}
					</HTMLFlipBook>
				</div>
				<Search onJump={jumpToSlug} />
			</div>
	);
}
