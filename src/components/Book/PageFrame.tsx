import React from "react";
import type { BookPage } from "../../lib/book-model.ts";
import { sections } from "../../data/site.ts";

/**
 * One physical page of the flipbook. forwardRef on purpose:
 * react-pageflip collects its children's refs and needs the actual
 * DOM node of each page.
 */
const PageFrame = React.forwardRef<HTMLDivElement, PageFrameProps>(
	function PageFrame({ page, number, html }, ref) {
		let body: React.ReactNode = null;

		switch (page.kind) {
			case "cover":
				body = (
					<div className="page-cover">
						<p className="cover-kicker">From the kitchen of Glen</p>
						<h1 className="cover-title">{page.title}</h1>
						<div className="cover-rule" aria-hidden="true" />
						<p className="cover-intro">{page.intro}</p>
					</div>
				);
				break;
			case "divider":
				body = (
					<div className="page-divider">
						<span className="ribbon" aria-hidden="true">
							<span className="ribbon-label">Chapter {chapterLabel(page.section)}</span>
						</span>
						<h2 className="divider-title">{page.section}</h2>
						<div className="divider-rule" aria-hidden="true" />
						{page.preamble?.map((para, i) => (
							<p key={i} className="divider-preamble">
								{para}
							</p>
						))}
						{page.referenceLine && <p className="divider-ref">{page.referenceLine}</p>}
					</div>
				);
				break;
			case "recipe":
				body = (
					<article className="page-recipe">
						<header className="page-head">
							<h2 className="recipe-title">{page.title}</h2>
							<p className="recipe-meta">
								{page.inTesting && <span className="badge badge-testing">In testing</span>}
								{page.yield && <span className="badge badge-yield">{page.yield}</span>}
							</p>
							{page.source && <p className="recipe-source">{page.source}</p>}
						</header>
						<div
							className="page-content"
							dangerouslySetInnerHTML={{ __html: html ?? "" }}
						/>
					</article>
				);
				break;
			case "recipe-cont":
				body = (
					<article className="page-recipe page-recipe-cont">
						<header className="page-head">
							<h2 className="recipe-title recipe-title-cont">
								{page.title} <span className="cont-word">cont’d</span>
							</h2>
						</header>
						<div
							className="page-content"
							dangerouslySetInnerHTML={{ __html: html ?? "" }}
						/>
					</article>
				);
				break;
			case "toc":
				body = <div className="page-content" dangerouslySetInnerHTML={{ __html: html ?? "" }} />;
				break;
			case "back":
				body = (
					<div className="page-back">
						<div className="back-rule" aria-hidden="true" />
						<p className="back-title">Glen Approved Foods</p>
						<p className="back-sub">Taste as you cook.</p>
						<div className="back-rule" aria-hidden="true" />
					</div>
				);
				break;
		}

		const folio = page.kind !== "cover" && page.kind !== "back";
		return (
			<div
				ref={ref}
				className={`page page-${page.kind}`}
				data-page={page.kind}
				data-slug={"slug" in page ? page.slug : undefined}
			>
				{body}
				{folio && <span className="folio">{number}</span>}
			</div>
		);
	}
);

type PageFrameProps = {
	page: BookPage;
	number: number;
	html?: string;
};

export default PageFrame;

const CHAPTERS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

function chapterLabel(section: string): string {
	const idx = (sections as readonly string[]).indexOf(section);
	return CHAPTERS[idx] ?? "·";
}
