# RainPath — Master Design System

> Source of truth for visual and interaction design across the RainPath workflow editor.
> When building a specific page, first check `design-system/pages/<page>.md`; if present, its rules override this file. Otherwise, use this file exclusively.
>
> **Relation au spec projet** : `docs/superpowers/specs/2026-05-28-rainpath-workflow-editor-design.md` est la source de vérité **fonctionnelle et architecturale**. Ce DS est aligné sur les décisions concrètes du spec (modale d'édition vs inspector ; pas de nœud `delay` ; ancrage X=0/Y=200 du `start` ; bibliothèque `NodeTemplate` ; états de reachability ; bibliothèques retenues). Si un point fonctionnel manque ici, se référer au spec.

---

## 1. Product context

- **What:** Web app where lab admins draw patient-relance workflows as a node graph (n8n / Zapier style).
- **Who:** Chefs de laboratoire d'anatomopathologie. Office context, desktop-first, keyboard-fluent, not patient-facing.
- **Tone:** Clinical minimal — calm, trustworthy, neutral. Healthcare context, but the chrome reads as a professional B2B SaaS tool, not a wellness app.
- **Stack:** React + TypeScript (Vite). Imposed library choices: NestJS / Prisma / SQL on the backend.
- **Surface mix:** ~70% graph canvas, ~30% chrome (top bar, side panels, lists, modals, forms).

---

## 2. Design direction

| Dimension | Choice | Why |
|---|---|---|
| Pattern family | **Productivity Tool / B2B SaaS dashboard** | Editor + persisted documents + list — not a landing or marketing page. |
| Primary style | **Minimalism & Swiss Modernism** | High whitespace, strict grid, single accent, AAA contrast — fits clinical context and editor's need to recede behind the user's graph. |
| Secondary style | **Micro-interactions** | Tactile feedback on drag/drop, node connect, save state — gives the editor the responsiveness expected of modern tools. |
| Mode | **Light-first; dark as a stretch goal.** | Lab admin context (often well-lit office), and light canvas reads cleaner for graph editing. Dark mode tokens defined but not required for v1. |

**Avoid:** glassmorphism, neumorphism, gradients on chrome, decorative shadows, emojis as icons, "playful" SaaS colors (orange/pink), patient-facing wellness aesthetics (rounded blobs, illustrations).

---

## 3. Color tokens

Single brand accent (medical cyan/teal) + neutral SaaS chrome (slate) + dedicated semantic colors per node family for the canvas. Raw hex stays in this file only; in code, use the CSS variables below.

### 3.1 Chrome / surfaces (the app shell)

| Role | Hex | CSS variable | Usage |
|---|---|---|---|
| Background (app) | `#F8FAFC` | `--bg` | Behind everything; canvas background |
| Surface | `#FFFFFF` | `--surface` | Panels, cards, modals, inputs |
| Surface muted | `#F1F5F9` | `--surface-muted` | Hover rows, secondary chrome, code, key-cap |
| Foreground | `#0F172A` | `--fg` | Body text, primary content |
| Foreground muted | `#475569` | `--fg-muted` | Secondary text, captions |
| Foreground subtle | `#94A3B8` | `--fg-subtle` | Placeholder, disabled label, tertiary |
| Border | `#E2E8F0` | `--border` | Card edges, dividers, input borders (resting) |
| Border strong | `#CBD5E1` | `--border-strong` | Input border (focus-within), separator on hover |
| Ring (focus) | `#0E7490` | `--ring` | Outer focus ring — 2px, offset 2px |

### 3.2 Brand & semantic

| Role | Hex | CSS variable | Usage |
|---|---|---|---|
| Primary | `#0E7490` | `--primary` | Brand cyan; primary buttons, links, selection, active state |
| Primary hover | `#155E75` | `--primary-hover` | Hover state for primary buttons |
| On primary | `#FFFFFF` | `--on-primary` | Text on primary surfaces |
| Primary soft | `#ECFEFF` | `--primary-soft` | Selected row, primary-tinted badge bg |
| Success | `#059669` | `--success` | Save confirmed, sent OK, healthy state |
| Warning | `#B45309` | `--warning` | Wait nodes, soft warnings (4.5:1 on white) |
| Danger | `#B91C1C` | `--danger` | Destructive actions, error states, "rejected" branch |
| Info | `#0369A1` | `--info` | Informational badges, neutral hints |

### 3.3 Node family palette (canvas only)

Each node family gets its own tonal pair: a `bg` (very tinted, low chroma) for the node body, a `border` for the outline, and an `accent` for the icon dot / header strip. This keeps families recognizable at a glance without screaming.

Per spec, the workflow's `kind` enum is: `start`, `end`, `send_email`, `send_sms`, `send_whatsapp`, `send_postal`, `condition`. There is **no `delay` / `wait` node** — temporisation is carried by `edge.daysAfter`. The `condition` kind splits visually into two families via its `conditionType` parameter (`data_available` vs `previous_result`), so the canvas exposes 8 distinct visual families for 7 logical kinds.

| Family | Maps to | Bg | Border | Accent | CSS variables |
|---|---|---|---|---|---|
| **Départ** | `kind = start` | `#ECFDF5` | `#A7F3D0` | `#059669` | `--node-start-{bg,border,accent}` |
| **Email** | `kind = send_email` | `#EFF6FF` | `#BFDBFE` | `#1D4ED8` | `--node-email-{bg,border,accent}` |
| **SMS** | `kind = send_sms` | `#EEF2FF` | `#C7D2FE` | `#4338CA` | `--node-sms-{bg,border,accent}` |
| **WhatsApp** | `kind = send_whatsapp` | `#F0FDF4` | `#BBF7D0` | `#15803D` | `--node-whatsapp-{bg,border,accent}` |
| **Courrier postal** | `kind = send_postal` | `#FFFBEB` | `#FDE68A` | `#B45309` | `--node-postal-{bg,border,accent}` |
| **Condition — donnée** | `kind = condition`, `conditionType = data_available` | `#FAF5FF` | `#E9D5FF` | `#7C3AED` | `--node-cond-data-{bg,border,accent}` |
| **Condition — résultat** | `kind = condition`, `conditionType = previous_result` | `#FDF4FF` | `#F5D0FE` | `#A21CAF` | `--node-cond-result-{bg,border,accent}` |
| **Fin** | `kind = end` | `#F1F5F9` | `#94A3B8` | `#334155` | `--node-end-{bg,border,accent}` |

> **`--node-wait-*` tokens (#F8FAFC / #CBD5E1 / #475569) are defined for forward-compatibility but unused in v1.** If a future iteration reverses the spec divergence (delay-on-edge → dedicated wait node), the tokens are already in place. Do **not** ship a wait node card while the spec is in force.

### 3.4 Edge (connector) colors

Edges between nodes carry two semantic layers: the **branch role** (default flow / yes / no / selected) AND the **delay** (`edge.daysAfter`). Both must be visible. Encode the role with color **and** chip text (never color-alone — WCAG `color-not-only`).

| Edge type | Color | Pattern | Chip(s) |
|---|---|---|---|
| Default flow (`start → next`, `single` out, default `multi` branches) | `--fg-subtle` `#94A3B8` | solid 1.5px | delay chip only |
| Yes / `true` / `success` branch | `--success` `#059669` | solid 1.5px | `Oui` chip (text-xs, fond `--primary-soft`) + delay chip |
| No / `false` / `failure` branch | `--danger` `#B91C1C` | solid 1.5px | `Non` chip (text-xs, fond `#FEE2E2`) + delay chip |
| Selected / pending (drag in progress) | `--primary` `#0E7490` | solid 2px | unchanged |
| Invalid (would-be cycle, self-loop) | `--danger` `#B91C1C` | solid 2px | tooltip with cause; never committed |

**Delay chip** (`X j`): every committed edge carries a chip centered on the path. `--text-xs`, `font-variant-numeric: tabular-nums`, padding `4px 8px`, bg `--surface`, border `1px --border`, radius `--radius-sm`. Click → popover (positioned with `@floating-ui/react` + `flip`/`shift`) with a numeric input. If a role chip (`Oui`/`Non`) is present, the role chip sits adjacent to the delay chip, not overlaid.

**Animation on creation**: edge tracks the pointer with no easing during drag, then the delay chip fades in over 180ms after release.

### 3.5 Contrast verification (must hold)

- `--fg` on `--bg`: 17.4:1 ✓ AAA
- `--fg-muted` on `--bg`: 7.1:1 ✓ AAA
- `--on-primary` on `--primary`: 5.4:1 ✓ AA
- `--primary` on `--bg`: 5.6:1 ✓ AA (use for links + filled buttons)
- `--success` / `--warning` / `--danger` on white: ≥4.5:1 ✓ AA (foreground text use only)
- Node accent on node bg: each pair ≥4.5:1 ✓ AA — never put body text directly on a node bg without verifying.

### 3.6 Dark mode token map (stretch — keep parity, don't ship until tested)

`--bg → #0B1220`, `--surface → #111827`, `--surface-muted → #1F2937`, `--fg → #F8FAFC`, `--fg-muted → #94A3B8`, `--border → #1F2937`, `--border-strong → #334155`, `--primary → #22D3EE` (lighter for contrast), `--ring → #22D3EE`. Re-verify all contrast pairs separately — do not invert.

### 3.7 Canvas — temporal axis

The editor canvas is not a free 2D plane: the X axis encodes **the day of execution since the exam** (spec §3, §5.4). The visual language of the canvas must make that immediately readable.

| Element | Token / value | Notes |
|---|---|---|
| Canvas surface | `--bg` `#F8FAFC` | Same as app background — the canvas is the "paper". |
| Day gridlines (vertical) | `--border` `#E2E8F0`, 1px | One line every N days; N adapts to zoom (1/5/10 — thresholds 0.8 and 0.3 on `useViewport().zoom`). Max ~50 simultaneous lines for perf. |
| Day labels | `--text-xs`, weight 500, `--fg-muted`, `tabular-nums` | Format `J+0`, `J+1`, `J+30`. Positioned at the top of the canvas (sticky), aligned to each visible gridline. |
| **J+0 rail** | `--node-start-accent` `#059669`, 2px | The vertical line passing through `start.position.x = 0`. Slightly thicker than other gridlines — anchors the start node visually. |
| Horizontal grid | none | Y is free; do not draw horizontal lines (would suggest discrete tracks that don't exist). |

The background is implemented as an SVG `<Panel>` in React Flow, repositioned with `useViewport()`. The plage temps auto-fits to `[0, max(X) + 5]`. Label memoization required (don't re-render on every pan).

---

## 4. Typography

**One family, full control: Inter.** It's the de facto standard for SaaS dashboards (Linear, Vercel, Stripe), supports tabular figures (critical for delays / dates), has excellent screen rendering at small sizes, and ships variable. No serif companion needed for a tool of this scope.

```css
@import url('https://rsms.me/inter/inter.css');
/* Or via @fontsource/inter for Vite */
```

```css
:root {
  --font-sans: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
  font-feature-settings: 'cv11', 'ss01', 'ss03';   /* Inter's nicer alts */
}
```

### 4.1 Type scale (8pt-aligned, 1.25 ratio for headings, 1.5 line-height for body)

| Token | Size / line-height | Weight | Use |
|---|---|---|---|
| `--text-xs` | 12 / 16 | 500 | Captions, badges, edge chips, helper text |
| `--text-sm` | 13 / 20 | 400 | Inspector field labels, table cells, secondary body |
| `--text-base` | 14 / 22 | 400 | Body, form values, node body text |
| `--text-md` | 16 / 24 | 500 | Section labels, dialog body, palette item titles |
| `--text-lg` | 18 / 26 | 600 | Panel titles, dialog titles, list item primary |
| `--text-xl` | 22 / 30 | 600 | Page section heads |
| `--text-2xl` | 28 / 36 | 600 | Page title (workflow name in top bar) |
| `--text-display` | 36 / 44 | 700 | Empty states only |

### 4.2 Rules

- **Body minimum: 14px** on desktop (this is a desktop-first app, not mobile-first); 16px in form inputs to prevent iOS auto-zoom if used on mobile.
- **Tabular figures** (`font-variant-numeric: tabular-nums`) on: delay inputs ("X jours"), timestamps, list metadata, anywhere numbers must align vertically.
- **Letter-spacing** -0.01em on `--text-2xl` and `--text-display` only; default everywhere else.
- **Truncation:** prefer wrapping; if truncating (long workflow names in the list), single-line ellipsis + full text in a tooltip on hover.

---

## 5. Spacing, radius, elevation

### 5.1 Spacing (4pt base, 8pt rhythm)

`--space-0: 0`, `--space-1: 4px`, `--space-2: 8px`, `--space-3: 12px`, `--space-4: 16px`, `--space-5: 20px`, `--space-6: 24px`, `--space-8: 32px`, `--space-10: 40px`, `--space-12: 48px`, `--space-16: 64px`.

- Inside a node card: padding 12px.
- Between form fields in inspector: 16px.
- Between panel sections: 24px.
- Top bar height: 48px. Side panel width: 320px (palette) / 360px (inspector).

### 5.2 Radius

- `--radius-sm: 6px` — inputs, badges, chips, small buttons.
- `--radius-md: 8px` — cards, nodes, dropdowns. **This is the default.**
- `--radius-lg: 12px` — modals, sheets, large surfaces.
- `--radius-full: 9999px` — pill buttons (sparingly), avatars.

**Never:** 0px (too brutalist for healthcare), 20px+ (too playful for a clinical tool).

### 5.3 Elevation (shadow scale)

Swiss style says "no shadows," but a graph editor needs to lift nodes above the canvas grid. Use sparingly and tonal-only.

- `--elev-0: none` — flush with canvas, inputs at rest.
- `--elev-1: 0 1px 2px 0 rgba(15, 23, 42, 0.05)` — cards at rest, nodes at rest.
- `--elev-2: 0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.05)` — nodes selected, dropdowns.
- `--elev-3: 0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.05)` — modals, popovers.
- `--elev-scrim: rgba(15, 23, 42, 0.5)` — modal backdrop.

---

## 6. Iconography

- **Library: Lucide** (`lucide-react`). Single source. Stroke 1.5px. 16px / 20px / 24px sizes only. A thin wrapper `<Icon name="..." size={16|20|24} />` enforces the size scale.
- **Node family icons** (locked by spec §7.3):

  | Family | Icon | Notes |
  |---|---|---|
  | `start` | `Play` | + secondary `Anchor` badge (16px) bottom-right of the start card |
  | `send_email` | `Mail` | — |
  | `send_sms` | `MessageSquare` | — |
  | `send_whatsapp` | `MessageCircle` | Brand WhatsApp SVG only if a licensed asset is supplied; otherwise stay on Lucide |
  | `send_postal` | `Inbox` | + `Truck` or `MapPin` micro-badge when `tracked = true` |
  | `condition` (both subtypes) | `GitBranch` | Family is distinguished by color tokens, not by icon |
  | `end` | `Square` | — |

- **UI icons** used by the spec: `Plus`, `Upload`, `RotateCw`, `Undo2`, `Redo2`, `MoreVertical`, `GripVertical`, `Check`, `XCircle`, `AlertCircle`, `AlertTriangle`, `Loader2`, `WifiOff`, `Anchor`, `Edit`, `Copy`, `Trash2`.
- **Never:** emojis, FontAwesome (mixed style), bitmap PNG icons.
- All icon-only buttons get `aria-label` in French (see §9.3).

---

## 7. Components & patterns

### 7.1 Buttons

| Variant | Bg | Fg | Border | Hover | Active | Disabled |
|---|---|---|---|---|---|---|
| **Primary** | `--primary` | `--on-primary` | none | `--primary-hover` | bg darken 8% | opacity 0.5, no pointer |
| **Secondary** | `--surface` | `--fg` | `--border` | `--surface-muted` | border `--border-strong` | opacity 0.5 |
| **Ghost** | transparent | `--fg` | none | `--surface-muted` | `--surface-muted`, fg darker | opacity 0.5 |
| **Danger** | transparent | `--danger` | `--border` | `#FEF2F2` bg | `#FEE2E2` bg | opacity 0.5 |
| **Icon-only** | as ghost | as ghost | none | as ghost | as ghost | as ghost; requires `aria-label` |

- Height: `32px` (sm), `36px` (default), `40px` (lg).
- Padding: 12px horizontal for sm, 16px for default.
- Loading state: spinner replaces text, button stays the same width (`min-w` from text), disabled while loading.
- Press feedback: 100ms scale 0.98 + bg darken (Micro-interactions).
- Focus: 2px `--ring`, offset 2px. **Never remove without a replacement.**

### 7.2 Inputs

- Height 36px (sm), 40px (default).
- Padding 12px horizontal.
- Border `--border` resting, `--primary` on focus + 2px ring (offset 0, no border doubling).
- Always-visible label above (`--text-sm`, weight 500). **No placeholder-as-label.**
- Helper text below, `--text-xs`, `--fg-muted`.
- Error: border `--danger`, helper text `--danger`, `role="alert"` + `aria-live="polite"`.
- Validate **on blur**, not on every keystroke.

### 7.3 Node card (canvas)

Uniform card per family — never different shapes (no circles, no diamonds). Swiss coherence beats BPMN convention. Recognition relies on **color + icon + label** (never color alone — WCAG `color-not-only`).

```
┌─────────────────────────────────┐  ← border: --node-<family>-border, 1px (2px for end)
│ ▎ [Icon] Family label           │  ← strip 3px = --node-<family>-accent
│   Title (text-md, weight 600)   │
│   ─────                          │
│   Detail 1 (text-sm, fg-muted)  │
│   Detail 2                       │
│                                  │
│              ────● source handle│  ← positions depend on output.mode (see below)
│   ●──── target handle (left)    │
└─────────────────────────────────┘
```

**Common rules:**
- Width: 240–280px (content-driven within range). **Exceptions: `start` and `end` → 180px compact.**
- Padding: 12px. Radius: 8px (`--radius-md`).
- Bg: `--node-<family>-bg`. Border: `--node-<family>-border`, **1px** (default). Strip: `--node-<family>-accent`, 3px left.
- Resting elevation `--elev-1`. Selected: `--elev-2` + 2px ring `--primary`. Hover: bg shifts one tonal step.
- Cursor: `grab` resting, `grabbing` during drag (never `not-allowed` on resting — that signals a real block; reserved for `start`).
- Press feedback: 100ms scale 0.98 (Micro-interactions §2). No rotation, no tilt.

**Per-family specifics:**

| Family | Width | Special chrome | Detail rows shown on the card |
|---|---|---|---|
| `start` (Départ) | **180px** | `Anchor` badge 16px bottom-right; J+0 rail (§3.7) passes through; `cursor: not-allowed` on hover, `draggable: false` | Icon + "Examen effectué" label only. No detail rows. |
| `send_email` | 240–280px | — | Subject truncated (one line) + first line of body |
| `send_sms` | 240–280px | — | Body truncated + character counter `X / 160` colored per §5.2.b rules |
| `send_whatsapp` | 240–280px | — | Body truncated |
| `send_postal` | 240–280px | "Suivi" badge (`--success` chip) when `tracked = true` | Body truncated |
| `condition` (data) | 240–280px | — | Humanized expression (`patient.email` → "Email connu ?") |
| `condition` (result) | 240–280px | — | Raw expression text |
| `end` (Fin) | **180px** | **Border 2px** (not 1px) — terminal weight | Icon + "Fin" label only. No detail rows. |

**Source handles — position and count depend on `output.mode`:**

| Source node kind / mode | Source handles | Position | Color |
|---|---|---|---|
| `start` | 1 handle `out` | right edge, center | `--node-start-accent` |
| `send_*` mode `single` | 1 handle `out` | right edge, center | family accent |
| `send_*` mode `simple` | 2 handles: `success`, `failure` | `success` top-right (~25% from top), `failure` bottom-right (~75%) | `success` → `--success`; `failure` → `--danger` |
| `send_*` mode `multi` | N handles, one per `output` | right edge, vertically stacked at even intervals; each labeled with `output.label` next to the handle (text-xs, fg-muted) | family accent |
| `condition` (both subtypes) | 2 handles: `true`, `false` | `true` right edge, `false` bottom edge | `true` → `--success`; `false` → `--danger` |
| `end` | none | — | — |

**Target handle:** every kind except `start` has one target handle on the left edge, centered. 10px circle, `--surface` background, family-accent border.

**Handle drag state:** any handle becomes `--primary` while an edge is being dragged from it; the matching valid target handle highlights to `--primary` when the pointer enters its hit area.

### 7.4 Node edit modal (double-click on a node)

**Divergence assumée du DS** (spec §4.3) : le DS d'origine recommandait un inspector panel latéral fixe ; le spec retient une **modale ouverte au double-click** pour laisser le canvas entièrement libre quand l'utilisateur navigue, et présenter un formulaire focalisé seulement quand il édite. UX style n8n/Zapier, à défendre en entretien.

**Container** (Radix Dialog) :
- Largeur 640px (formulaire), padding 24px, `--radius-lg`, élévation `--elev-3`, scrim `--elev-scrim`.
- Animation : scrim fade 150ms ease-out + content scale 0.96 → 1 + fade 180ms via Framer Motion spring `{ stiffness: 320, damping: 30 }`. Respect `prefers-reduced-motion` (instant fade).
- Focus trap (natif Radix), ESC ferme, premier input focusé à l'ouverture, focus restauré au close.
- Click-outside ne ferme **que** si pas de modifications non sauvegardées ; sinon mini-confirm "Abandonner les modifications ?".

**En-tête** : icône famille 20px + libellé famille (`--text-sm` weight 600, `--fg-muted`) + champ titre du nœud (`--text-lg` weight 600, éditable inline).

**Corps — onglets Radix Tabs** :

- **Onglet "Message"** (nœuds `send_*` uniquement) :
  - `subject` (email), `body` (textarea autosize), toggle `tracked` (postal).
  - **Compteur de caractères** sous chaque champ : `142 / 160`, couleur `--success` (`< recommendedMax`), `--warning` (`< maxLength`), `--danger` (`> maxLength`, bloque le save). Tabular-nums.
  - SMS : tooltip à 70 chars "votre message basculera en unicode" ; à 160 chars "votre message sera segmenté en N SMS".
  - Email : warning sur subject > 78 chars.
  - WhatsApp : panneau d'aide repliable listant la syntaxe markdown supportée.
  - Postal : compteur informatif uniquement.

- **Onglet "Routage"** (nœuds `send_*` uniquement) :
  - Sélecteur `output.mode` : 3 radio cards (`single` / `simple` / `multi`).
  - Mode `simple` : multi-sélecteur de statuts pour `successCondition` (liste = `CHANNEL_STATUSES[channel]` recalculé si `tracked` change). **Presets cliquables** au-dessus : "Envoi technique réussi", "Engagement confirmé", "Échec à router".
  - Mode `multi` : table éditable `(label, statuts)` avec ajout/suppression de lignes ; 2 warnings UI non bloquants (chevauchement, couverture incomplète) + bouton "Tout couvrir" (catch-all).
  - Mode `single` : message "1 sortie unique, aucun routage requis".
  - Aperçu live des handles tels qu'ils apparaîtront sur le nœud.

- **Onglet unique** pour `condition` :
  - `conditionType` : 2 radios "Donnée disponible" / "Résultat précédent".
  - `expression` :
    - si `data_available` → dropdown parmi `DataAvailableExpressions` (`patient.email`, `patient.phone`, `patient.whatsapp`, `patient.address`).
    - si `previous_result` → input texte libre + placeholder d'exemple.

**Bandeau d'alerte** en bas du body si la modale ferme alors que des edges sortants référencent des `sourceHandle` qui ne sont plus définis (mutation d'outputs) → "supprimer ces edges" ou "annuler".

**Pied** : `Annuler` (secondary) à gauche du primary `Enregistrer`, right-aligned. Le primary est disabled tant que la validation Zod inline n'est pas verte.

**Modale d'édition partagée** : la même modale sert pour l'édition d'un nœud du canvas **et** pour l'édition d'un `NodeTemplate` (§7.5). Champs `name` et `description` du template apparaissent en tête uniquement dans ce second mode.

### 7.5 Node palette (left side) — bibliothèque de modèles

Largeur **320px**, full canvas height, scrollable. La palette n'expose pas une liste fixe de types, mais une **bibliothèque éditable de modèles** (table `NodeTemplate` du backend) en plus des nœuds système non éditables. Deux sections, séparées par un `<Separator />` Radix.

**Section "Nœuds système"** (fixe, en tête) :

- Header `--text-xs` weight 600 uppercase tracking 0.02em `--fg-muted`.
- 2 entrées : `Départ` (icône `Play`, famille `start`) et `Fin` (icône `Square`, famille `end`).
- Chaque entrée : 48px de haut, padding 12px, hover bg `--surface-muted`, icône 20px + label `--text-md` weight 500 + `GripVertical` 16px `--fg-subtle` à droite.
- `Départ` désactivé (opacity 0.5, `aria-disabled="true"`, cursor `not-allowed`, tooltip "Un nœud de départ existe déjà") si un `start` est déjà présent dans le graphe (singleton).

**Section "Modèles"** (dynamique, source = `GET /node-templates`) :

- Header `--text-xs` weight 600 uppercase tracking 0.02em `--fg-muted`.
- Bouton `+ Nouveau modèle` (variant secondary, icône `Plus`, full-width) en tête de section. Ouvre un sélecteur de `kind` (Radix Popover) puis la modale d'édition vide.
- Liste **groupée par `kind`** via Radix Accordion (sous-sections collapsables "Email", "SMS", "WhatsApp", "Postal", "Condition") — chaque sous-titre `--text-xs` weight 500 `--fg-muted` avec compteur `(N)`.
- Chaque entrée modèle : 48px de haut, padding 12px, hover bg `--surface-muted` :
  - icône Lucide du canal (16px)
  - `name` (`--text-md` weight 500)
  - `MoreVertical` 16px en bas-droite (Radix DropdownMenu : `Éditer` / `Dupliquer` / `Supprimer` — l'item Supprimer en `--danger`, séparé par `<Separator />`).
  - Drag handle `GripVertical` au survol (16px, `--fg-subtle`) — apparaît à droite, masque le menu kebab par défaut, échange au focus.
  - Tooltip Radix au survol : preview une ligne (subject tronqué ou expression).
- **Drag preview** : aperçu = vraie node card (même rendu §7.3) à 80% opacité, cursor `grabbing`.
- **Drop sur canvas** : crée un nœud `{ kind: template.kind, params: structuredClone(template.params) }` à la position Y du drop, X recalculé. **Détaché** du template (aucune référence persistée — éditer le template ensuite n'affecte pas l'instance).

**Empty state** (aucun modèle, peu probable car seed) : message centré "Aucun modèle pour le moment." + CTA secondary `+ Nouveau modèle`.

**Loading** : skeleton 5 lignes de 48px (animation shimmer, respect reduced-motion).

**Modale "Éditer / Nouveau modèle"** : réutilise §7.4 avec en plus en tête les champs `name` (requis) et `description` (optionnel).

### 7.6 Top bar

- Hauteur 48px, sticky, border-bottom 1px `--border`, bg `--surface`.

**Gauche** : app mark + nom du workflow (`--text-md` weight 600, **éditable inline** — clic = mode édition, `Enter` valide, `Escape` annule), description en sous-titre (`--text-sm` `--fg-muted`, tronquée).

**Centre** : indicateur de statut d'auto-save. **Largeur réservée** (~220px min-width) pour éviter tout layout shift quand le libellé change. Tous les états utilisent une icône Lucide 16px + label `--text-sm`.

| `saveStatus` | Icône | Couleur icône | Label |
|---|---|---|---|
| `idle` / `saved` | `Check` | `--success` | `Enregistré il y a Ns` (relative time, `date-fns` fr) |
| `saving` | `Loader2` (rotation) | `--fg-muted` | `Enregistrement…` |
| `dirty` (mutations non encore push) | dot 8px | `--warning` | `Modifications non enregistrées` |
| `invalid` (validation échoue, PATCH gated) | `AlertCircle` | `--warning` | `Erreur de validation` |
| `error` (réseau) | `AlertCircle` | `--danger` | `Échec de sauvegarde — nouvel essai…` |
| `offline` (5 retries épuisés) | `WifiOff` | `--warning` | `Hors-ligne — reconnexion en cours`; bouton ghost `Réessayer maintenant` à droite |

**Centre droite** : boutons ghost `Undo2` et `Redo2` (icon-only, 32×32, tooltip Radix avec raccourci `Cmd/Ctrl+Z` et `Cmd/Ctrl+Shift+Z`), disabled selon `canUndo` / `canRedo`.

**Droite** : kebab `MoreVertical` (Radix DropdownMenu) avec `Renommer`, `Dupliquer`, `Exporter en JSON`, `<Separator />`, `Supprimer` (item `--danger`).

**Bandeau "Hors-ligne"** : quand `saveStatus === 'offline'`, ajouter sous la top bar un bandeau persistant 32px `--surface-muted` border-bottom 1px : "Vos modifications restent locales, reconnexion en cours" + bouton `Réessayer maintenant`. Disparaît dès qu'un PATCH réussit.

### 7.7 Workflow list page

Container `max-w-6xl` (1152px), padding horizontal `--space-6`.

**Header** :
- Titre `Workflows` (`--text-2xl` weight 600).
- À droite : bouton primary `+ Nouveau workflow` (icône `Plus`) + bouton secondary `Importer un JSON` (icône `Upload`).

**Empty state** (DS §7.10) : centré, max-width 480px, message "Aucun workflow créé pour le moment." + CTA primary "Créer mon premier workflow". Pas d'illustration, pas de clip-art.

**Liste populée** : **table** (préférée à une card grid pour la densité métier en contexte labo), tri par `updatedAt` décroissant.

| Colonne | Contenu | Notes |
|---|---|---|
| `Name` | lien vers `/workflows/:id` | row hover bg `--surface-muted`, primary color sur hover du nom |
| `Description` | tronqué une ligne | tooltip Radix avec le texte complet au survol |
| `Nœuds` | compteur | `tabular-nums`, right-aligned |
| `Statut` | badge | `Brouillon` (`--warning` chip) si `updatedAt < 1h`, sinon `Actif` (`--success` chip) |
| `Modifié` | relative date | `date-fns/formatDistanceToNow` locale `fr` |
| (kebab) | `MoreVertical` | DropdownMenu : `Ouvrir`, `Renommer`, `Dupliquer`, `Exporter en JSON`, `<Separator />`, `Supprimer` (item `--danger`) |

**Loading state** : skeleton de 5 lignes mirroring la structure (DS §7.10), si chargement > 300ms.

**Error state** : message humain "Impossible de charger les workflows" + bouton secondary `Réessayer` (icône `RotateCw`).

**Virtualisation** : `@tanstack/react-virtual` au-delà de 50 lignes (DS §13 perf).

**Création** : clic `+ Nouveau workflow` → Radix Dialog 480px (DS §7.8) avec `name` (requis) + `description` (optionnel) + boutons `Annuler` / `Créer`. Au submit : POST `/workflows` → redirect `/workflows/:id`.

**Import** : clic `Importer un JSON` → input file (`accept=".json"`) caché + clic programmatique. Lecture, `safeParse(Graph)` Zod côté front, modale de confirmation listant `nodes.length` / `edges.length`, ou modale d'erreur avec liste structurée (path + message Zod).

**Suppression** : modal de confirmation Radix Dialog 480px qui nomme explicitement l'artefact ("Supprimer le workflow « Relance standard » ?"), bouton primary `Supprimer` (variant `Danger`), `Annuler` secondary à gauche.

### 7.8 Modals & dialogs

- Width: `--radius-lg`, padding 24px, max-width 480px (confirm) / 640px (form).
- Scrim: `--elev-scrim`, click-outside closes only if no unsaved changes (else `sheet-dismiss-confirm`).
- ESC closes. Focus trap. First focusable input or primary action gets focus on open.
- Title `--text-lg` weight 600. Body `--text-base`. Footer: secondary left of primary, right-aligned.

### 7.9 Toasts

- Position: bottom-right, max 3 stacked.
- Auto-dismiss: 4s for success/info, 6s for warning, manual close for danger.
- `aria-live="polite"` (success/info) or `aria-live="assertive"` (danger).
- Never use a toast as the *only* feedback for a destructive action (also reflect state in the UI).

### 7.10 Empty / loading / error states (the "three states rule")

Every async surface must define all three.

- **Empty:** explain what would appear here + one clear next action. No clip-art.
- **Loading:** skeleton matching the final layout for >300ms operations; spinner only inside buttons.
- **Error:** human sentence (what / why / how to retry), single primary retry button. Never a stack trace.

### 7.11 Validation banner (canvas)

Fixé en bas du canvas, pleine largeur, hauteur auto, max-height 25vh (scroll si dépassement).

- **Hidden** quand `validationErrors.length === 0` ET aucun warning. Pas de bandeau "tout va bien".
- **Visible** dès qu'il y a au moins un item :
  - bg `#FEF2F2` (rouge clair) si une erreur ; `#FFFBEB` (jaune clair) si uniquement des warnings.
  - border-top 2px `--danger` (ou `--warning`).
  - padding `--space-3 --space-4`.
- **Header** : icône `AlertCircle` 20px + `--text-sm` weight 600 — `N erreurs · M avertissements`. Bouton ghost `MoreVertical` à droite pour collapse/expand (mémo session).
- **Liste** : `--text-sm`, chaque item = icône (`XCircle` `--danger` pour error, `AlertTriangle` `--warning` pour warning) + message + bouton ghost **"Centrer sur l'erreur"** (icône `Target` Lucide ou similaire) qui pan/zoom le canvas vers le nœud ou l'arête concernée (`nodeId` / `edgeId` du `ValidationError`).
- **A11y** : `role="region"` `aria-label="Validation du workflow"`, le compteur dans le header en `aria-live="polite"` pour annoncer les changements.

### 7.12 Live-preview interactions (ghosts)

Le spec applique le principe **"preview is the confirmation"** : l'utilisateur voit l'impact temporel d'une mutation avant de la confirmer, plutôt que de subir un dialog. Trois interactions concernées : création d'arête, édition de `daysAfter`, suppression d'arête. Toutes utilisent les helpers `simulateAddEdge` / `simulateChangeDaysAfter` / `simulateRemoveEdge` (`shared/src/simulate.ts`).

**Rendu commun : nœud ghost**
- Opacité 0.5, bordure tiretée (`stroke-dasharray: 4 4` côté SVG ou `border-style: dashed` côté DOM), 1px de la couleur de famille.
- Position : à la position **future** calculée (X cible).
- Badge `+N j` (ou `-N j`) en `--text-xs` `tabular-nums` collé en haut-droite du ghost, bg `--surface`, border 1px `--border`.
- Le nœud à sa position actuelle reste visible en arrière-plan, opacité 0.3 sans bordure (référence visuelle de "d'où il vient").

**Création d'une connexion** (`onConnectStart` → `onConnectMove` → `onConnectEnd`)

| Résultat de `simulateAddEdge` | Trait de connexion | Halo / overlay | Tooltip flottant |
|---|---|---|---|
| `selfLoop` | rouge 2px, dashed | halo rouge sur source | "Auto-connexion impossible" |
| `cycle` | rouge 2px, dashed | halo rouge sur target | "Boucle détectée — connexion impossible" |
| `handleConflict` | orange 2px, dashed | halo orange sur la source | "Ce handle a déjà une sortie" |
| `shifts.size > 0` (valide, mais décale) | **vert** `--success` 2px | ghosts sur tous les nœuds décalés + badges `+N j` | aucun |
| valide, pas de shift | **vert** `--success` 2px, solid | aucun | aucun |

Au release :
- Cas invalides → drop **rejeté**, toast `danger` "Connexion impossible : `<raison>`", aucun snapshot dans l'history.
- Cas valide → commit : edge ajoutée, X recalculées via `recomputeXPositions`, **animation CSS 300ms** sur `transform` des nœuds décalés. Popover d'édition de `daysAfter` s'ouvre immédiatement.

**Édition de `daysAfter` via popover edge**

- Input numérique → à chaque keystroke (debounce 100ms), appel `simulateChangeDaysAfter`.
- Les nœuds qui se décaleraient sont rendus en ghost en temps réel (même style que ci-dessus).
- `Enter` ou bouton `Valider` → commit + animation 300ms. `Escape` ou clic-outside → annule, retour à l'état initial sans ghost.

**Suppression d'arête**
- Pas de confirmation (réversible via undo).
- Recompute immédiat via `simulateRemoveEdge` puis commit. Animation 300ms sur les nœuds qui reculent en X.

**Suppression d'un nœud** (cascade)
- Toutes les edges entrantes ET sortantes sont retirées en une opération atomique. Recompute X. Animation 300ms.
- Un seul snapshot dans l'history pour cette opération.
- **Garde-fous** : `start` jamais supprimable (bouton désactivé, raccourci `Delete` ignoré, garde dans le store en safety net). `end` supprimable tant qu'il en reste ≥ 1 (sinon no-op + toast "Au moins un nœud Fin doit être présent").

**Performance** : throttle à 60fps (`requestAnimationFrame`) sur `onConnectMove`. Sur graphes > 100 nœuds, fallback debounce 50ms.

### 7.13 Patient view — états de reachability (bonus)

Vue read-only du graphe avec curseur "jour courant" et 5 états par nœud calculés par `computeReachability(graph, profile, currentNodeId, history)`. **Aucune information par couleur seule** : chaque état embarque une icône ou un libellé.

| État | Bg du nœud | Bordure | Décorations | A11y |
|---|---|---|---|---|
| `visited` (déjà traversé) | `--node-<family>-bg` (normal) | `--success` 1px | icône `Check` 16px `--success` en bas-droite | `aria-label="Étape terminée : <label>"` |
| `current` (étape en cours) | `--node-<family>-bg` | `--primary` 2px **pulsante** (animation 2s `box-shadow` ; désactivée sous `prefers-reduced-motion`) | badge `--primary` "En cours" en haut-droite | `aria-current="step"`, `aria-label="Étape en cours : <label>"` |
| `reachable` (futur possible) | `--node-<family>-bg` (normal) | `--node-<family>-border` (normal) | aucune | `aria-label="Étape à venir : <label>"` |
| `blocked` (chemin coupé par donnée manquante) | `--surface-muted` | `--danger` 1px dashed | opacité 0.4, badge `XCircle` 16px `--danger` "Bloqué" + raison ("Email patient manquant") | `aria-label="Étape bloquée : <label> — <raison>"` |
| `unreachable` (jamais accessible depuis le nœud courant) | `--surface-muted` | `--border` 1px | opacité 0.15, grisé, `pointer-events: none`, `aria-hidden="true"` | retiré de l'arbre AT |

**Curseur "jour courant"** : `<line>` verticale à `X = X_dérivé[currentNodeId]`, 2px `--primary`, label flottant en haut "Jour courant : J+7" (`--text-sm` weight 600, bg `--primary-soft`, padding `2px 8px`, radius `--radius-sm`).

**Edges** suivant l'état des nœuds qu'elles relient :
- vers `visited` → couleur `--success`
- vers `blocked` → couleur `--danger`, dashed
- vers `unreachable` → opacité 0.15
- vers `reachable` → couleur normale

**Transitions** : fade 200ms sur le changement de bg/border quand le profil patient mute (montre la propagation). Respect `prefers-reduced-motion`.

**Panneau latéral** (30% de la largeur, à droite, full-height scrollable) :
1. **Profil patient éditable** : champs `name` / `email` / `phone` / `whatsapp` / `address`. Toggle "Ajouter" / "Supprimer" sur les champs optionnels. Debounce 500ms → `PATCH /patient-profiles/:id`. Bannière `--info` "Modifier ces données change immédiatement les chemins disponibles dans le workflow."
2. **Avancement** : bouton primary `Étape suivante` + sélecteur d'outcome contextuel (dropdown statuts du canal pour `send_*`, radios Vrai/Faux pour `condition`, rien pour `start` / `single`). Bouton disabled si l'outcome choisi n'a pas de branche définie (tooltip explicatif). Pré-warning `--warning` si le nœud courant est `send_*` et la donnée nécessaire manque dans le profil. Bouton ghost `Réinitialiser le parcours`.
3. **Historique** : liste chronologique des étapes traversées (label + jour d'entrée + outcome simulé), `--text-sm`, separators `<Separator />`.

---

## 8. Motion

Aligned with §7 of the skill's UX rules. Spring-feel where physical, ease-out where flat. **Always respect `prefers-reduced-motion`.**

| Action | Duration | Easing |
|---|---|---|
| Button hover / press | 100ms / 80ms | `ease-out` |
| Input focus | 120ms | `ease-out` |
| Toast enter / exit | 180ms / 120ms | `cubic-bezier(0.16, 1, 0.3, 1)` enter, `ease-in` exit |
| Modal scrim fade | 150ms | `ease-out` |
| Modal content (scale 0.96 → 1 + fade) | 180ms | spring (Framer Motion: `{ type: 'spring', stiffness: 320, damping: 30 }`) |
| Panel collapse / expand | 200ms | `ease-in-out` |
| Node selection ring | 120ms | `ease-out` |
| Edge being drawn | follows pointer, no animation curve | — |
| Page → editor transition | 220ms slide-in from right | `ease-out` |

**Animate `transform` and `opacity` only.** Never `width`, `height`, `top`, `left`, `margin`.

**Reduced motion:** swap all spring/slide for instant or `opacity-only` 100ms. Respect `@media (prefers-reduced-motion: reduce)`.

---

## 9. Accessibility (non-negotiable)

These are gates, not nice-to-haves. Each will be re-checked before delivery.

### 9.1 Color & contrast

- All text/icon vs bg pairs verified in §3.5.
- No information conveyed by color alone: Yes/Non edges carry text chips; node families carry icons + labels.
- Status: success/warning/danger always pair color with icon (`CheckCircle`, `AlertTriangle`, `XCircle`).

### 9.2 Keyboard

- **Tab order matches visual order** : top bar → palette → canvas → modale (quand ouverte).
- **Skip-link** `Aller au canvas` en haut de `<main>` (visible au focus clavier seulement).
- **Focus rings always visible** (2px `--ring`, offset 2px). Jamais retirés sans remplacement équivalent.
- **No keyboard traps** — Radix Dialog piège le focus *à l'intérieur* de la modale, `ESC` ferme et restaure le focus précédent.
- **Canvas keyboard nav** (équivalents souris obligatoires) :

| Touche | Action |
|---|---|
| `Tab` / `Shift+Tab` | Passe d'un nœud au suivant **en ordre topologique** (pour stabilité) |
| `Enter` | Ouvre la modale d'édition (§7.4) sur le nœud focused |
| `↑` / `↓` | Nudge Y de 8px |
| `Shift+↑` / `Shift+↓` | Nudge Y de 1px |
| `←` / `→` | **No-op** — X est dérivé du graphe, modifier `daysAfter` sur l'arête entrante pour décaler. Tooltip persistant au premier essai |
| `Delete` / `Backspace` | Supprime le nœud ou edge sélectionné (sauf `start`) |
| `Cmd/Ctrl+S` | Save explicite (déclenche `saveNow` ; ignoré si focus dans un input) |
| `Cmd/Ctrl+Z` | Undo (désactivé si focus dans un input) |
| `Cmd/Ctrl+Shift+Z` ou `Cmd/Ctrl+Y` | Redo (désactivé si focus dans un input) |

### 9.3 Screen reader

- Every icon-only button has `aria-label` in French (the lab admin context — `aria-label="Supprimer le nœud"`).
- Heading hierarchy: page `h1`, panel `h2`, section `h3`. No level skipping.
- Forms: `<label for=>` (not `aria-label`) when the label is visible.
- The canvas: `role="application"` with an `aria-label` describing the editor, plus a textual fallback ("Liste des nœuds: ...") via a visually-hidden list mirroring the graph structure. (Stretch — minimum: a "Voir la liste des étapes" panel.)
- Toasts: `aria-live="polite"` (success/info), `assertive` (errors). Don't steal focus.
- Errors in forms: `role="alert"` + `aria-live="polite"` + focus the first invalid field on submit error.

### 9.4 Motion & text scaling

- `prefers-reduced-motion` honored everywhere — see §8.
- Layout must survive 200% browser zoom without horizontal scroll or clipped controls.
- No `user-scalable=no` in viewport meta.

### 9.5 Interaction

- Click targets ≥ 32×32px in the chrome (desktop-first; nothing tap-only in v1). Buttons in modals ≥ 36px high.
- Disabled controls: `disabled` attr + opacity 0.5 + `cursor: not-allowed`. Never use only color.
- Destructive actions go through a confirm modal that names the artifact ("Supprimer le workflow « Relance standard » ?").

---

## 10. Layout & responsive

Desktop-first (≥1024px est la cible — chefs de labo sur poste de travail). Tablet utilisable ; mobile **n'est pas** une exigence v1.

L'éditeur a deux zones permanentes : **palette gauche (320px)** + **canvas plein-écran**. La modale d'édition (§7.4) est un overlay, pas un panneau de layout. La vue patient bonus ajoute un panneau latéral droit de 30% (read-only).

| Breakpoint | Comportement éditeur | Liste / autres pages |
|---|---|---|
| `≥1280px` | Layout complet : palette 320px + canvas | Container `max-w-6xl`, table dense |
| `1024–1279px` | Palette toujours visible ; modale plein espace | Idem |
| `768–1023px` | Palette **collapsable** derrière un bouton toggle (icône `PanelLeft`) ; canvas pleine largeur | Reflow en single column |
| `<768px` | Message "Mieux sur grand écran" + CTA `Retour aux workflows` | Liste reste utilisable, single column |

- Container max-width pour les pages non-éditeur (liste, profils, runs) : `max-w-6xl` (1152px), padding horizontal `--space-6` desktop, `--space-4` tablet.
- `min-h-dvh` (pas `100vh`) sur les conteneurs full-height.
- **Z-index scale** : `0` canvas, `10` panels (palette), `20` top bar, `40` dropdowns / popovers (`@floating-ui`), `100` modales (Radix Dialog), `1000` toasts.

---

## 11. Implementation notes (React + TS)

Verrouillé par le spec §4.2 — réutiliser ces choix pour cohérence avec le plan d'implémentation.

- **Bundler / framework :** Vite 5 + React 18 + TypeScript 5.
- **CSS :** Tailwind v3+ avec un token layer dans `tailwind.config.ts` lisant les variables CSS de §3–§5. Pas de hex en dur dans les composants.
- **Tokens :** `src/styles/tokens.css` déclare `:root { --bg: ...; ... }` (et `:root[data-theme="dark"]` pour future dark mode).
- **Composants headless :** **Radix UI primitives** (`Dialog`, `Popover`, `DropdownMenu`, `Tabs`, `Tooltip`, `Accordion`, `Separator`). Pas de kit complet (MUI / Chakra / Ant).
- **Graph :** **React Flow** (`@xyflow/react`). Custom nodes, custom edges, custom background.
- **State éditeur :** **Zustand** (recommandé par xyflow) avec historique undo/redo (50 snapshots max).
- **Cache API :** **TanStack Query** (workflows, templates, profils, runs).
- **Popovers d'arête :** **`@floating-ui/react`** (`useFloating` + `autoUpdate` + middleware `flip` / `shift`). Pas Radix Popover sur les arêtes — ancrage dynamique au clic sur le path SVG.
- **Icons :** `lucide-react` via wrapper `<Icon name="..." size={16|20|24} />`. Tailwind `size-4` / `size-5` / `size-6`.
- **Forms :** **React Hook Form + Zod** (validation inline). Schémas Zod importés depuis `@rainpath/shared`.
- **Motion :** **Framer Motion** uniquement sur les modales (spring `{stiffness: 320, damping: 30}`). Tailwind transitions sur hover / press. CSS `transition: transform 300ms ease-out` sur les nœuds qui se décalent post-mutation.
- **Police :** `@fontsource/inter` (variable font), feature settings `cv11, ss01, ss03` dans `tokens.css`.
- **Dates relatives :** `date-fns` locale `fr` (`formatDistanceToNow`).
- **Toasts :** `sonner` ou `react-hot-toast` (bottom-right, max 3 stacked, dismiss 4s / 6s / manuel selon variant).
- **Virtualisation listes :** `@tanstack/react-virtual` au-delà de 50 lignes.
- **Lint anti-drift :** `eslint-plugin-tailwindcss` + règle custom interdisant les hex 6-digit hors `tokens.css` (R23).

---

## 12. Anti-patterns (do not ship)

- Emoji as a node family icon.
- Removing focus rings.
- Color-only meaning (Yes/Non without label).
- Placeholder used as the only label.
- Toast as the only feedback for a destructive action.
- A modal used as the primary navigation path.
- Animating `width` / `height` to expand a panel.
- Healthcare clip-art (stethoscopes, pills, illustrated doctors) — wrong product context.
- More than one primary CTA on a screen.
- Gradients on chrome surfaces.
- Mixed icon families (Lucide + emoji + FontAwesome).

---

## 13. Pre-delivery checklist

### Visual
- [ ] Only Lucide icons used, no emoji.
- [ ] All colors come from §3 tokens; no raw hex in components.
- [ ] Pressed/active states do not shift layout.
- [ ] Light mode tested at 100% and 200% zoom.

### Interaction
- [ ] All clickable elements have `cursor-pointer` + visible focus ring + press feedback.
- [ ] Disabled states verified.
- [ ] Validate-on-blur; errors announced to AT.
- [ ] Canvas keyboard nav works: tab between nodes, delete, save shortcut.

### Accessibility
- [ ] `aria-label` on every icon-only button.
- [ ] Heading hierarchy clean (no level skips).
- [ ] No color-only information.
- [ ] `prefers-reduced-motion` honored.
- [ ] All §3.5 contrast pairs verified with a checker.

### Performance
- [ ] Fonts loaded with `font-display: swap`.
- [ ] React Flow nodes memoized; inspector form uncontrolled where possible.
- [ ] Lists virtualized if >50 workflows in the list page.
- [ ] No layout-shift on save state changes (reserve width of the status text).

### Three-state coverage
- [ ] Every async surface defines empty / loading / error.
- [ ] Save flow has explicit success + error feedback.

---

## 14. Page-specific overrides

Page overrides live in `design-system/pages/<page-slug>.md`. When building a page, **first read** the page file if it exists — its rules win over this Master file.

Pages anticipated:
- `pages/workflow-list.md` — workflow list (home).
- `pages/workflow-editor.md` — the graph editor itself.
- `pages/patient-dossier.md` — bonus patient progress view.

(None exist yet. Re-run the skill with `--page <slug>` to generate one.)
