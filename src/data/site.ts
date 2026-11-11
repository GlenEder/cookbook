/**
 * Site-level content pulled verbatim from the Glen Approved Foods Google Doc
 * (https://docs.google.com/document/d/1146DrP1_qnxYz6BZPFSorwIQHlEHeGClOr2z0cwtBFI).
 *
 * Stage 2 (cover + divider pages) consumes these. Do not paraphrase — the
 * author's voice is kept exactly, including punctuation and casing.
 */

/** Doc title (line 1 of the doc). */
export const siteTitle = "A Collection of Glen Approved Foods";

/** Intro blurb under the doc title (lines 2), shown on the cover page. */
export const siteIntro =
	"These recipes below are a collection of random online finds, cookbook gems, mom’s deciphered recipe cards, and some friends that shared too much over chef-beta meetups. Please use with caution and taste as you cook, everything should be salted and peppered as you proceed.";

/** Preamble at the top of the "Cock & Tails" section, for the section divider page. */
export const cocktailSectionIntro = [
	"Cocktail making is almost always done via ratios, so don’t expect this section to be any different. You are more than welcome to fudge the ratios a bit to alter the end product to extend towards your preferred flavor profile, i.e. a more spirit forward drink or a sweeter one. All drink recipes are designed to produce one serving unless otherwise mentioned. Please don’t cheap out and use fresh squeezed citrus and herbs whenever possible for the best results.",
	"Reference lookups for shorthand terms I will be using for this section. I highly recommend getting a japanese style jigger with good markings inside for making cocktails. The one I have is the Barfly Japanese Jigger.",
];

/** The shorthand reference bullet under the Cock & Tails preamble (line 862 of the doc). */
export const cocktailReferenceLine = "1 part (1 oz or 30 ml)";

/** Section display names in doc order — keep in sync with src/content.config.ts. */
export const sections = [
	"Basic Things You Should Know",
	"Breads & Breakfast",
	"Sauce & Butter Me Up",
	"Apps, Snacks, & Sides (aka ASS)",
	"Entree Deez Nuts",
	"Desserts not Deserts",
	"Cock & Tails",
] as const;
