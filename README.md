# A Collection of Glen Approved Foods

A cookbook as a real flipbook: every recipe is a page in a paper-and-ink book,
rendered with Astro (static build) + React (`react-pageflip`). Hosted on
Cloudflare Workers static assets.

## Add or edit a recipe

Recipes live in `src/content/recipes/*.md` — one Markdown file per recipe,
named after the slug (e.g. `moms-banana-bread.md`).

Frontmatter:

```yaml
---
title: Mom's Banana Bread
section: Breads & Breakfast   # must match one of the section names in src/content.config.ts
yield: 1 loaf                 # optional
inTesting: true               # optional (default false) — shows the "In testing" badge
source: Mom's recipe card     # optional — shown under the title
---
```

Below the frontmatter, write normal Markdown: headings for Ingredients /
Instructions, lists, paragraphs. The book paginates it automatically across
pages; long recipes continue with a "cont'd" header.

Sections available: `Basic Things You Should Know`, `Breads & Breakfast`,
`Sauce & Butter Me Up`, `Apps, Snacks, & Sides (aka ASS)`, `Entree Deez Nuts`,
`Desserts not Deserts`, `Cock & Tails`.

## Local development

```sh
npm install
npm run dev     # dev server at localhost:4321
npm run build   # production build to ./dist/
npm run preview # preview the build locally
```

## Validation

```sh
npm run validate   # checks every recipe's frontmatter (title, section, etc.)
npm run test:book  # tests the book model (page ordering, TOC, continuations)
```

## Deploy to Cloudflare

```sh
npm run deploy   # astro build && wrangler deploy
```

Requires Cloudflare auth first: run `npx wrangler login` once (opens a browser
to authorize your Cloudflare account). The site is served as Workers static
assets from `./dist` — no Cloudflare adapter needed; config is in
`wrangler.jsonc`. The worker name (`glen-cookbook`) is hardcoded — rename
`name` in `wrangler.jsonc` before your first deploy (it must be unique on your
Cloudflare account).
