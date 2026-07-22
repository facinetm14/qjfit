# QJFit — Design System: "The Dossier"

**Status**: Current direction, supersedes the mockups in `archive/` (see below).
**Prototype**: [`prototype.html`](./prototype.html) — a self-contained, interactive HTML/CSS/JS
file. Open it directly in a browser, or jump to a specific state:
`prototype.html#upload` (default), `#scanning`, `#results`, `#limited`.

---

## Why this changed

`archive/dashboard.png` and `archive/setup-profile.png` are the pre-pivot v2.0 design: a
sidebar-nav admin dashboard with a "Saved" list, a "Run now" fetch trigger, and an editable
profile form. All of that assumed a persistent account and is explicitly removed, not deferred,
by [ADR 0015](../adr/0015-anonymous-stateless-mvp.md) and the PRD v3.0 pivot (see
[`docs/prd/prd-v1.md`](../prd/prd-v1.md) §3.6). Visually it was also a fairly generic
blue-accent/Inter admin-panel look with no point of view.

This redesign starts over from the actual product: **there is no dashboard, no account, no
history — one visitor, one CV, one visit.** The concept leans into that instead of hiding it.

## Concept: a dossier for one visit only

QJFit's entire value proposition is ephemerality: the CV is read once, matched, and discarded.
Nothing persists. The design treats each visit as a **confidential case file that only exists
for the duration of the visit** — a document read under a desk lamp, scored with a rubber
stamp, and then gone. This gives the "nothing is stored" disclosure (PRD §3.1, §4) a visual
identity instead of burying it as a compliance footnote: it's the whole point of the page.

Concretely, this shows up as:
- **Paper cards, ink stage.** Job results are loose paper "case cards" scattered slightly askew
  across a dark ground, not a rounded-card SaaS list.
- **Rubber-stamp scoring.** The score badge is a stamped circle (rotated, ink-bled), not a
  progress bar or a flat pill — it reads as something applied by hand to *this* CV, not a
  cached number.
- **A scanner-beam loading state.** While matching runs, a light sweeps across a stylized
  document instead of a generic spinner — the CV is visibly being "read," once.
- **A "cachet" blue accent**, not the red/green/amber used for scoring. French official
  documents are commonly stamped in blue ink; it's a deliberate nod to France Travail as a data
  source and keeps the accent distinct from the semantic score colors (see below).

## Palette

Defined as CSS custom properties in `prototype.html`. This is a **single deliberate dark
theme** — the "one lamp, one desk" world is the point, so it does not adapt to light OS
preference (an intentional choice, not an oversight; see the comment above `:root` in the
prototype).

| Token | Value | Use |
|---|---|---|
| `--ink-900` | `#14151d` | Page ground — deep blue-black, not warm charcoal |
| `--ink-800` | `#1b1d29` | Panels: header, side card, scan stage |
| `--paper-100` | `#ece5d0` | Case-card surface — aged vellum, deliberately not bright cream |
| `--paper-200` | `#ddd4bb` | Folder-tab strips on the filter rail |
| `--stamp-blue` | `#2c4a72` | **Accent** — brand/interactive only (buttons, links, focus, drag-hover) |
| `--score-high` | `#3c5e3f` | Score ≥ 75 (PRD-mandated: green tier) |
| `--score-mid` | `#a97a2e` | Score 50–74 (PRD-mandated: amber tier) |
| `--score-low` | `#9c2b1f` | Score < 50 (PRD-mandated: red tier) |

The three score colors are **semantic and fixed by the PRD** (§3.5) — they are never reused as
the interactive accent, and the accent (`--stamp-blue`) is never used for scoring, so a visitor
never has to wonder whether a blue element means "good" or "click me."

## Type

Three families, three jobs, no overlap:

| Role | Face | Where |
|---|---|---|
| Display | **Literata** (italic 400 / bold 700) | Hero headline, "AI summary" quotes, stamp captions |
| Body | **Source Serif 4** (400 / 600) | Paragraphs, card titles, filter labels |
| Data / mono | **JetBrains Mono** (400 / 700) | Score numbers, source tags, metadata, the ticker, CSV/export affordances |

All three are embedded as base64 `@font-face` data URIs directly in `prototype.html` (latin
subset only — covers French accents) so the file renders correctly with no external requests
and no silent fallback-font substitution. **For the production Vue build, self-host these same
three families** (e.g. under `apps/front/public/fonts/`) rather than pulling from Google Fonts
at runtime, consistent with the project's privacy-conscious stance (nothing sent to a third
party beyond the LLM provider, PRD §4).

## Layout

One continuous vertical stage, no multi-page nav (there's no settings/account area to link to —
PRD §3.5). A slim header carries only the wordmark and the live "N checks left today" pill.
Below it, a single `<main>` swaps between four states — **upload → scanning → results →
rate-limited** — matching the PRD's single-visit flow exactly. Results split into a sticky
folder-tab filter rail and a stack of case cards; everything else (upload, scanning, the
rate-limit stamp) is a centered single column.

## States covered in the prototype

| State | PRD reference | Notable behavior |
|---|---|---|
| Upload | §3.1 | Drag/drop or click-to-browse, client-side type/size affordance, in-memory disclosure copy, live pool-freshness stats |
| Scanning | §3.5 (loader) | Typewriter ticker + scanning-beam animation over a document silhouette |
| Results | §3.4, §3.5 | Score stamp (semantic tier colors), match reasons / missing skills tags, sort, **working** client-side filters (score/source/contract/remote), **working** CSV export (real `Blob` download, not a mock) |
| Rate-limited | §3.2.2, US-07 | Stamped "quota used" state with a real countdown to local midnight, not a vague message |

The bottom-left "Preview" switcher is a **review aid only**, not product chrome — it lets you
jump between states instantly instead of re-running the 2/day limit or waiting for the scan
animation. Deep links (`#upload`, `#scanning`, `#results`, `#limited`) do the same thing and are
harmless to keep — useful for sharing a specific state.

## Handoff notes for implementation (issue #6, Results UI)

- Sample job data in the prototype's `JOBS` array is realistic placeholder content (French
  tech roles, France Travail / WTTJ sources) — replace with real API data, not the shape.
- The CSV export, filter, and sort logic in the prototype's `<script>` are real working
  implementations (not mockups) and can be ported near-directly into the Vue composables.
- Respect `prefers-reduced-motion` as the prototype does (disables the reveal stagger, stamp
  bounce, and scan-beam sweep).
- The card "tilt" (`nth-child` rotation) and stamp rotation are fixed, deterministic values —
  not random per render — so the layout stays stable across re-renders/filtering.

## Archive

`archive/dashboard.png` and `archive/setup-profile.png` are kept for historical reference only.
They depict the pre-pivot account-based product and should not inform any current work.
