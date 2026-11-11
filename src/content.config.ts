import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// Recipes ingested from the Glen Approved Foods Google Doc (Stage 1 of glen-cookbook-v1).
// Sections are stored in doc order; `section` holds the exact display name.
const recipes = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/recipes" }),
	schema: z.object({
		title: z.string(),
		section: z.enum([
			"Basic Things You Should Know",
			"Breads & Breakfast",
			"Sauce & Butter Me Up",
			"Apps, Snacks, & Sides (aka ASS)",
			"Entree Deez Nuts",
			"Desserts not Deserts",
			"Cock & Tails",
		]),
		yield: z.string().optional(),
		inTesting: z.boolean().default(false),
		source: z.string().optional(),
	}),
});

export const collections = { recipes };
