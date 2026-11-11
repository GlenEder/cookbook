/**
 * Client-side pagination of recipe HTML into fixed-height page chunks.
 * Runs in the browser after document.fonts.ready (see Book.tsx) so late font
 * loads never cause mid-flip reflow or clipped text.
 *
 * Strategy: lay the remaining HTML out in a hidden host with the exact page
 * content box, then greedily take leading blocks while they fit. A block that
 * alone overflows the page is split mid-text via a Range scan (word-position
 * binary search), which preserves inline markup through cloneContents.
 * Deterministic: same input + same box → same chunks.
 */

const EPSILON = 2; // px slack for margin-collapse/rounding differences

let host: HTMLDivElement | null = null;

function getHost(): HTMLDivElement {
	if (!host) {
		host = document.createElement("div");
		host.className = "page-content page-measure";
		host.setAttribute("aria-hidden", "true");
		document.body.appendChild(host);
	}
	return host;
}

/** Split `html` into chunks that each fit a content box of width×height px. */
export function paginateHtml(
	html: string,
	box: { width: number; height: number },
): string[] {
	const el = getHost();
	el.style.width = `${box.width}px`;
	el.style.height = `${box.height}px`;

	const chunks: string[] = [];
	let remaining = html;
	for (let guard = 0; guard < 500 && remaining.trim(); guard++) {
		el.innerHTML = remaining;
		const hostTop = el.getBoundingClientRect().top;
		const cap = el.clientHeight;
		const blocks = Array.from(el.children) as HTMLElement[];
		if (blocks.length === 0) {
			// Text-only content without block wrappers — treat as one block.
			chunks.push(remaining);
			break;
		}
		const bottoms = blocks.map(
			(b) => b.getBoundingClientRect().bottom - hostTop,
		);

		// First block whose bottom crosses the page limit: blocks before it fit.
		let splitAt = blocks.length;
		for (let i = 0; i < blocks.length; i++) {
			if (bottoms[i] > cap - EPSILON) {
				splitAt = i;
				break;
			}
		}

		if (splitAt === blocks.length) {
			chunks.push(remaining);
			break;
		}

		if (splitAt === 0) {
			// Block 0 alone crosses the limit → split it mid-text.
			const [head, rest] = splitBlock(blocks[0], hostTop + cap - EPSILON);
			if (!head.trim()) {
				// Nothing fits at all (degenerate page size) — bail out whole.
				chunks.push(remaining);
				break;
			}
			chunks.push(head);
			const restOfBlocks = blocks
				.slice(1)
				.map((b) => b.outerHTML)
				.join("");
			remaining = rest + restOfBlocks;
			continue;
		}

		chunks.push(blocks.slice(0, splitAt).map((b) => b.outerHTML).join(""));
		remaining = blocks.slice(splitAt).map((b) => b.outerHTML).join("");
	}
	return chunks.length ? chunks : [html];
}
/**
 * Split a single overflowing block at the last text position that still fits
 * above `limitY` (viewport coords). Returns [fitsOnPage, remainder] HTML.
 */
function splitBlock(block: HTMLElement, limitY: number): [string, string] {
	const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
	let node: Node | null;
	let splitNode: Text | null = null;
	let splitOffset = 0;
	const range = document.createRange();

	while ((node = walker.nextNode())) {
		const text = node as Text;
		const len = text.textContent?.length ?? 0;
		if (len === 0) continue;
		// Binary search: smallest offset whose character rect is below limitY.
		let lo = 0;
		let hi = len;
		if (charBottom(text, 0, limitY)) {
			// Even the first character is below the limit — nothing fits in this node.
			continue;
		}
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (charBottom(text, mid, limitY)) {
				hi = mid;
			} else {
				lo = mid + 1;
			}
		}
		splitNode = text;
		splitOffset = lo; // first overflowing offset within this node
		break;
	}

	if (!splitNode) {
		// No text found below the limit (e.g. whitespace-only tail) — push whole block.
		const whole = block.outerHTML;
		block.remove();
		return [whole, ""];
	}

	range.setStart(splitNode, splitOffset);
	range.setEndAfter(block.lastChild ?? block);
	const rest = serialize(range.cloneContents());

	range.setStart(block, 0);
	range.setEnd(splitNode, splitOffset);
	const head = serialize(range.cloneContents());
	return [head, rest];
}

/** True if the character at `offset` in `text` sits below `limitY`. */
function charBottom(text: Text, offset: number, limitY: number): boolean {
	const range = document.createRange();
	range.setStart(text, offset);
	range.setEnd(text, Math.min(offset + 1, text.textContent?.length ?? offset + 1));
	const rect = range.getBoundingClientRect();
	return rect.bottom > limitY;
}

function serialize(fragment: DocumentFragment): string {
	const tmp = document.createElement("div");
	tmp.appendChild(fragment);
	return tmp.innerHTML;
}
