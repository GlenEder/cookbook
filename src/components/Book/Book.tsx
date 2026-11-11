import React, { useEffect, useMemo, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import { expandContinuations, type BookPage } from "../../lib/book-model.ts";
import { paginateHtml } from "./paginate";
import PageFrame from "./PageFrame";

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
			document.fonts.load('600 16px "EB Garamond"'),
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
	}>({ pages, chunks: {} });
	const flipRef = useRef<any>(null);

	// Paginate only after fonts are ready; rerun whenever the page size changes.
	useEffect(() => {
		let cancelled = false;
		(async () => {
			await waitForFonts();
			if (cancelled) return;
			const htmlBySlug = readRecipeHtml();
			const box = {
				width: size.w - PAGE_PAD_X,
				height: size.h - PAGE_PAD_Y - PAGE_HEAD,
			};
			const chunks: Record<string, string[]> = {};
			for (const page of pages) {
				if (page.kind !== "recipe") continue;
				chunks[page.slug] = paginateHtml(htmlBySlug[page.slug] ?? "", box);
			}
			setExpanded({ pages: expandContinuations(pages, chunks), chunks });
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

	// Pair every page with its HTML chunk (recipe pages take chunk 0,
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
			} else {
				out.push({ page });
			}
		}
		return out;
	}, [expanded]);

	if (!ready) {
		return (
			<div className="book-stage">
				<p className="book-loading">Opening the cookbook…</p>
			</div>
		);
	}

	return (
		<div className="book-stage">
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
	);
}
