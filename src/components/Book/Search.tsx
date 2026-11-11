/**
 * Book search (Stage 3): magnifier toggle + results panel, styled like a paper
 * card. The index is a build-time JSON blob embedded by index.astro in a
 * <script type="application/json" id="search-index"> tag; matching is pure
 * client-side substring search. Results jump to the recipe's first page via
 * the onJump callback (which routes through the goToPage contract).
 */
import { useEffect, useMemo, useRef, useState } from "react";

type SearchEntry = { slug: string; t: string; x: string };
type Prepared = SearchEntry & { hay: string };

const SNIPPET_PAD = 44;

function esc(text: string): string {
	return text.replace(/[&<>"']/g, (c) =>
		({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
	);
}

/** Short excerpt of `x` around the first match, with the match highlighted. */
function makeSnippet(entry: Prepared, token: string): string {
	// Position of the first match in the instructions/ingredients text (the
	// title is always shown above the snippet, so we excerpt from x only).
	const at = entry.x.toLowerCase().indexOf(token);
	const x = entry.x;
	// Token matched only the title — show a plain fixed-length excerpt instead
	// of the whole body unclipped and unhighlighted.
	if (at < 0) {
		const cut = x.slice(0, 140);
		return esc(cut) + (cut.length < x.length ? "…" : "");
	}
	const start = Math.max(0, at - SNIPPET_PAD);
	const end = Math.min(x.length, at + token.length + SNIPPET_PAD * 2);
	return (
		(start > 0 ? "…" : "") +
		esc(x.slice(start, at)) +
		`<mark>${esc(x.slice(at, at + token.length))}</mark>` +
		esc(x.slice(at + token.length, end)) +
		(end < x.length ? "…" : "")
	);
}

function loadIndex(): Prepared[] {
	try {
		const raw = document.getElementById("search-index")?.textContent ?? "[]";
		return (JSON.parse(raw) as SearchEntry[]).map((e) => ({
			...e,
			hay: `${e.t} ${e.x}`.toLowerCase(),
		}));
	} catch {
		return [];
	}
}

export default function Search({ onJump }: { onJump: (slug: string) => void }) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const indexRef = useRef<Prepared[] | null>(null);
	const toggleRef = useRef<HTMLButtonElement>(null);

	// Closing from inside the panel (Escape, result click) returns focus to the
	// toggle so keyboard users aren't dropped at the top of the page.
	const close = () => {
		setOpen(false);
		toggleRef.current?.focus();
	};

	// Lazily load the index the first time the panel opens.
	useEffect(() => {
		if (open && !indexRef.current) indexRef.current = loadIndex();
	}, [open]);

	// Every token must appear somewhere (case-insensitive, partial words).
	// Earlier haystack position ranks first — the title leads the haystack,
	// so title matches naturally sort to the top.
	const results = useMemo(() => {
		const index = indexRef.current;
		const q = query.trim().toLowerCase();
		if (!index || !q) return null;
		const tokens = q.split(/\s+/);
		const out: { entry: Prepared; snippet: string; pos: number }[] = [];
		for (const entry of index) {
			let first = -1;
			let ok = true;
			for (const token of tokens) {
				const at = entry.hay.indexOf(token);
				if (at < 0) {
					ok = false;
					break;
				}
				if (first < 0 || at < first) first = at;
			}
			if (ok) {
				out.push({ entry, snippet: makeSnippet(entry, tokens[0]), pos: first });
			}
		}
		return out.sort((a, b) => a.pos - b.pos);
	}, [query, open]);

	return (
		<>
			<button
				ref={toggleRef}
				type="button"
				className="search-toggle"
				aria-label="Search the book"
				aria-expanded={open}
				onClick={() => setOpen(!open)}
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
					<circle cx="11" cy="11" r="7" />
					<line x1="16.5" y1="16.5" x2="21" y2="21" />
				</svg>
			</button>
			{open && (
				<div className="search-panel" role="search" aria-label="Recipe search">
					{/* Screen-reader-only live region announces result counts. */}
					<p className="search-status" aria-live="polite">
						{results
							? `${results.length} result${results.length === 1 ? "" : "s"}`
							: ""}
					</p>
					<input
						autoFocus
						type="search"
						className="search-input"
						placeholder="Search the whole book…"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={(e) => e.key === "Escape" && close()}
					/>
					{results === null ? (
						<p className="search-hint">
							Search titles, ingredients, and instructions — click a result to flip straight to the page.
						</p>
					) : results.length === 0 ? (
						<p className="search-empty">
							Nothing in the book matches that — even Glen is stumped. Try fewer words.
						</p>
					) : (
						<ul className="search-results">
							{results.slice(0, 40).map(({ entry, snippet }) => (
								<li key={entry.slug}>
									<button
										type="button"
										className="search-result"
										onClick={() => {
											close();
											onJump(entry.slug);
										}}
									>
										<span className="search-result-title">{entry.t}</span>
										<span
											className="search-result-snippet"
											dangerouslySetInnerHTML={{ __html: snippet }}
										/>
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			)}
		</>
	);
}
