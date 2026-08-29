---
name: Westview Science Olympiad
description: Editorial Wolverine confidence, translated into a precise A101 lab ledger.
colors:
  canvas: "#fbfbfd"
  surface: "#ffffff"
  soft-surface: "#f4f4f6"
  ink: "#1d1d1f"
  secondary-text: "#6e6e73"
  tertiary-text: "#86868b"
  rule: "#e3e3e6"
  black: "#0a0a0b"
  westview-gold: "#B98A23"
  gold-on-dark: "#E8B73A"
  gold-tint: "#faf4e4"
  catalog-paper: "#f7f7f4"
  catalog-muted: "#626660"
  catalog-rule: "#dcded8"
  catalog-rule-strong: "#bfc3ba"
  lab-green: "#172019"
  lab-green-hover: "#304234"
  catalog-gold: "#a97d18"
  danger: "#9d2f2f"
  available: "#608060"
  checked-out: "#c17b2f"
typography:
  display:
    fontFamily: "Satoshi, -apple-system, BlinkMacSystemFont, SF Pro Display, system-ui, sans-serif"
    fontSize: "clamp(3.7rem, 6.4vw, 6.7rem)"
    fontWeight: 900
    lineHeight: 0.94
    letterSpacing: "-0.05em"
  headline:
    fontFamily: "Satoshi, -apple-system, BlinkMacSystemFont, SF Pro Display, system-ui, sans-serif"
    fontSize: "clamp(2.1rem, 5vw, 3.6rem)"
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Satoshi, -apple-system, BlinkMacSystemFont, SF Pro Display, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.011em"
  catalog-page-title:
    fontFamily: "Satoshi, -apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif"
    fontSize: "clamp(2.2rem, 5vw, 4.4rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.035em"
  catalog-body:
    fontFamily: "Satoshi, -apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
  catalog-label:
    fontFamily: "Satoshi, -apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, sans-serif"
    fontSize: "0.86rem"
    fontWeight: 700
    lineHeight: 1.35
rounded:
  square: "0"
  focus: "4px"
  catalog-filter: "7px"
  catalog-field: "8px"
  catalog-control: "9px"
  catalog-dialog: "12px"
  public-card-sm: "18px"
  public-card: "28px"
  pill: "100px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  catalog-gutter-mobile: "16px"
  catalog-gutter: "24px"
  public-gutter: "28px"
  lg: "32px"
  section-min: "80px"
components:
  public-button-dark:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0.8rem 1.5rem"
  public-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.public-card}"
    padding: "2.2rem"
  catalog-button-primary:
    backgroundColor: "{colors.lab-green}"
    textColor: "{colors.surface}"
    typography: "{typography.catalog-label}"
    rounded: "{rounded.catalog-control}"
    padding: "0.55rem 1rem"
    height: "40px"
  catalog-button-primary-hover:
    backgroundColor: "{colors.lab-green-hover}"
    textColor: "{colors.surface}"
    rounded: "{rounded.catalog-control}"
  catalog-button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface}"
    typography: "{typography.catalog-label}"
    rounded: "{rounded.catalog-control}"
    padding: "0.55rem 1rem"
    height: "40px"
  catalog-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.catalog-body}"
    rounded: "{rounded.catalog-field}"
    padding: "0.72rem 0.8rem"
  catalog-filter:
    backgroundColor: "transparent"
    textColor: "{colors.catalog-muted}"
    typography: "{typography.catalog-label}"
    rounded: "{rounded.catalog-filter}"
    padding: "0.45rem 0.7rem"
  catalog-qr-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "1.25rem"
---

# Design System: Westview Science Olympiad

## Overview

**Creative North Star: "The Wolverine Field Ledger"**

Westview's visual language pairs editorial confidence with scientific directness. Satoshi, near-black type, warm whites, and a rare gold accent create a recognizable identity; the atom mark is the compact signature. The public site expresses that world expansively through oversized type, team photography, dark dramatic fields, pill actions, and generous section rhythm.

The private catalog is the same identity under operational pressure. Its built thesis is that every object has a known home and a scannable identity, so it refuses dashboard theater: search and factual rows lead, rules replace decorative cards, controls become compact and gently squared, and elevation is reserved for transient or modal layers. This is an Operate-mode lab ledger, not a miniature marketing page.

**Key Characteristics:**

- One Satoshi voice across public and private surfaces.
- Warm, near-white canvases with near-black text and restrained Westview gold.
- The atom mark and gold focus treatment carry identity across modes.
- Public surfaces are photographic, spacious, and expressive; catalog surfaces are flat, ruled, compact, and factual.
- Responsive behavior preserves the task: columns become labeled stacked facts rather than disappearing into generic cards.

## Colors

The shared palette is warm, high-contrast, and mostly neutral. Public pages use the brighter canvas and brand gold; the catalog shifts to slightly earthier paper, lab green, and harder rules while keeping the same ink and white surface.

### Primary

- **Westview Gold:** A rare identity accent for public eyebrows, links, progress, focus, active navigation, and selected words. It signals Westview, not generic importance.
- **Lab Green:** The catalog's action and authentication field color. Use it for primary controls, the atom mark, toasts, and large dark catalog fields; its lighter companion is the primary hover state.

### Secondary

- **Gold on Dark:** The more luminous gold reserved for black or green fields and the public site's medal-like gradients.
- **Catalog Gold:** A darker operational gold used for focus rings, back links, and active navigation on the catalog's warm paper.

### Tertiary

- **Available Green:** A small status dot for equipment available in A101.
- **Checked-out Amber:** A small status dot for equipment currently out. Status color supplements explicit text and never carries the meaning alone.
- **Danger Red:** Destructive catalog actions and inline errors only.

### Neutral

- **Canvas / Catalog Paper:** Two closely related warm near-whites. Use the brighter canvas for the public editorial site and the earthier paper for the equipment ledger.
- **Surface / Soft Surface:** White is the raised or contained surface; soft gray supports public icon wells and secondary groupings.
- **Ink / Black:** Ink is the default text and primary control color. True black is reserved for the public site's strongest dramatic fields and hover states.
- **Secondary / Tertiary Text:** Public descriptive copy and lower-priority metadata.
- **Catalog Muted:** Operational metadata, timestamps, subtitles, and inactive controls.
- **Rule / Catalog Rule / Catalog Rule Strong:** Hairline structure. The catalog uses stronger contrast because rows, fields, and fact grids depend on rules for scanability.

**The Rare Gold Rule.** Gold identifies Westview, active location, and interactive focus. It does not flood backgrounds or compete with factual status.

**The Status Has Words Rule.** Available, checked-out, error, and destructive states always retain a text label; hue is reinforcement.

## Typography

**Display Font:** Satoshi with the platform sans-serif stack as fallback  
**Body Font:** Satoshi with the platform sans-serif stack as fallback  
**Label Font:** Satoshi with the platform sans-serif stack as fallback

**Character:** A single geometric sans family makes the brand contemporary without separating “school spirit” from “equipment work.” Weight, size, line-height, and density—not a second typeface—create the mode shift.

### Hierarchy

- **Public Display:** Heavy, tightly tracked, and compressed; use for the singular recruiting statement or an equally important campaign headline.
- **Public Headline:** Bold and tightly tracked; use for section introductions and major editorial claims.
- **Public Body:** Slightly larger than browser default with subtle negative tracking for persuasive reading.
- **Catalog Page Title:** Large and direct but less theatrical than the public display. Use for Catalog, People, and equipment identity.
- **Catalog Body:** Browser-default-sized, neutral tracking, and compact leading for rows, forms, facts, and movement history.
- **Catalog Label:** Small and bold for field labels, filters, statuses, table headers, and compact action text. Inventory headers reduce further to 0.75rem; detail terms and history timestamps sit around 0.78rem.

**The One Family Rule.** Do not introduce a decorative display or monospace face. Satoshi's scale and weight already separate persuasion from operation.

**The Identity Before Metadata Rule.** Equipment name, box code, and page identity receive the strongest type; location, holder, status, and history remain compact but plainly readable.

## Layout

Public pages use an 1120px content container with 28px gutters and sections that breathe from 80px upward. Editorial sections alternate between split compositions, full-width dark fields, photography, four-column card grids, and ruled lists. The public hero intentionally breaks the container into a near-equal copy/photo split.

The catalog uses a 1240px workspace with 24px gutters, a 64px sticky top bar, and a 3rem top inset. Its inventory is a five-column ledger: identity, status, location, current or last holder, and disclosure. Detail pages use a roughly 70/30 content-to-QR split; the QR panel sticks beneath the top bar while facts form a two-column ruled grid. Dialogs cap at 700px, with a 520px compact variant.

At 860px, the catalog hides its secondary top navigation, stacks search above horizontally scrollable filters, turns inventory columns into labeled facts, and moves the QR panel into normal flow. At 560px, headers and actions stack, facts become one column, form pairs become single fields, and dialogs become full-screen. Public layouts likewise collapse multi-column arrangements while keeping generous reading gutters.

**The Ledger Before Cards Rule.** Operational collections are rows divided by hairlines. Do not translate the inventory, people list, history, or fact grid into floating cards.

**The Permanent Place Rule.** Home, current location, holder, last holder, and QR identity remain structurally visible on detail views; responsive layouts may restack them but may not demote or hide them.

## Elevation & Depth

The public site uses a hybrid depth system: most composition comes from tonal sections, photography, borders, and overlap-free grids, while interactive editorial cards lift on hover with diffuse shadows. The catalog is flat by default. Its paper, white fields, rules, and dark authentication split do the structural work; only dialogs and transient toasts cast shadows.

### Shadow Vocabulary

- **Public Card Hover:** A wide, very soft shadow paired with a small upward move. Use only on genuinely card-like editorial choices.
- **Catalog Dialog:** A strong 12px/36px modal shadow over a dark translucent backdrop. This is the catalog's clearest layer boundary.
- **Catalog Toast:** A compact 5px/16px shadow that separates short-lived confirmation from the workspace.

**The Flat Ledger Rule.** Catalog rows, fact groups, QR panels, filters, fields, and sticky navigation stay shadowless at rest.

**The Modal Boundary Rule.** Elevation in the catalog means temporary context. If a surface is part of the permanent page hierarchy, separate it with tone or a rule instead.

## Shapes

Westview uses two related shape dialects. Public calls to action and tags are fully pill-shaped, while editorial cards use generous 18–28px curves. Catalog controls tighten to 7–9px radii, fields and type badges use 8px, dialogs use 12px, and the QR panel remains square. Status dots and the atom's orbital geometry provide the only recurring circular forms in the ledger.

Borders are one-pixel structural rules. Public cards may combine a soft border with a large corner; catalog structure pairs low radius with clearer borders. Avoid decorative blobs, nested rounded containers, and indiscriminate pill labels in the catalog.

**The Radius Follows Mode Rule.** Large soft corners belong to expressive public cards; compact corners and square ruled panels belong to catalog work.

## Components

### Buttons

- **Public Primary:** A dark, fully pill-shaped action with a medium-bold label. Hover deepens to black and lifts by 1–2px; focus uses the gold outline.
- **Public Text Action:** Gold text with a directional arrow that advances on hover. It carries less weight than a filled registration action.
- **Catalog Primary:** A 40px-minimum lab-green control with a 9px corner and bold label. Hover shifts color only; it never lifts.
- **Catalog Secondary / Quiet:** Secondary controls use white plus the strong catalog rule. Quiet actions start transparent. Both use a pale neutral hover fill.
- **Catalog Danger:** Danger red with white text, reserved for confirmed destructive action inside the delete dialog.
- **Focus:** All interactive controls use a 2px gold outline. Catalog fields move the outline to the edge and also change border color.

### Chips

- **Public Event Tag:** A small fully rounded category tag with category-colored text and a light category tint.
- **Catalog Filter:** A compact 7px control, muted and transparent at rest; hover and active states use a pale gray-green fill with ink text. Filters scroll horizontally instead of wrapping into multiple dense rows.

### Cards / Containers

- **Public Editorial Card:** White, 28px corners, one-pixel rule, and spacious 2.2rem padding. Hover may lift because it is a self-contained editorial object.
- **Inventory Row:** Full-width transparent button divided by rules. Hover changes only the background. Identity begins with a 34px bordered BOX or ITEM badge.
- **QR Panel:** Square white panel with a strong catalog rule and 1.25rem padding. It is a factual print/scan tool, not a promotional card.
- **Dialog:** White, 12px corners on larger screens, ruled header/footer, and a modal shadow. It becomes edge-to-edge and square on narrow phones.

### Inputs / Fields

- **Style:** White fill, one-pixel strong catalog rule, 8px corners, and compact internal padding. Labels are small, bold, and dark gray.
- **Focus:** A 2px catalog-gold outline directly on the field with a matching border.
- **Error / Disabled:** Errors use danger red and reserve at least one line of space to avoid layout shift. Disabled buttons reduce opacity and use the not-allowed cursor.

### Navigation

- **Public:** A 60px fixed bar. At the top it is opaque and ruled; after scrolling it becomes translucent with blur. Links are restrained until a gold underline and color shift reveal hover/current state. Mobile replaces the link row with a two-line menu trigger and a ruled vertical menu.
- **Catalog:** A 64px sticky paper bar with the atom-and-wordmark lockup, three work destinations, and account controls. Active navigation is expressed by ink text and a 2px gold bottom rule. The destination row hides below 860px to protect workspace width.

### Inventory Ledger

Search precedes filtering and the ledger itself. Every row exposes name, type, status, location, holder context, and a disclosure arrow. On narrow screens, labels such as “Location” are inserted so the same facts survive the loss of column headers. Empty states are centered text within the ruled ledger, not illustrated panels.

### Facts, History, and Movement

Detail facts use definition lists, movement history uses a date/action two-column timeline without ornamental rails, and contents use full-width ruled rows. Checkout, return, and relocation happen in focused dialogs; successful actions resolve into a dark-green toast with concise factual copy.

## Do's and Don'ts

### Do:

- **Do** keep Satoshi, near-black, warm white, and restrained gold as the durable cross-surface signature.
- **Do** let photography, large type, and generous rhythm carry public persuasion.
- **Do** let search, rules, rows, explicit labels, and familiar forms carry catalog operation.
- **Do** preserve visible focus, reduced-motion behavior, explicit status text, and responsive fact labels.
- **Do** use the atom mark as the compact brand signature in public navigation, catalog navigation, and authentication.
- **Do** reserve catalog dialogs for create, edit, movement, account, and destructive confirmation tasks.

### Don't:

- **Don't** import public bento cards, hover lifts, animated entrance choreography, or giant promotional copy into the catalog workspace.
- **Don't** turn the catalog into a KPI dashboard or make add actions compete with search and inventory.
- **Don't** use shadows on permanent catalog surfaces or round every operational container.
- **Don't** use gold as a general background wash or replace available/checked-out wording with color alone.
- **Don't** hide home, current location, holder, last holder, history, or QR identity to simplify a narrow layout; restack them.
- **Don't** add a second font family or use ornamental typography to manufacture hierarchy.
