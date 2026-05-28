# RainPath — Master Design System

> Source of truth for visual and interaction design across the RainPath workflow editor.
> When building a specific page, first check `design-system/pages/<page>.md`; if present, its rules override this file. Otherwise, use this file exclusively.

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

| Family | Bg | Border | Accent | CSS variables |
|---|---|---|---|---|
| **Départ** (start) | `#ECFDF5` | `#A7F3D0` | `#059669` | `--node-start-{bg,border,accent}` |
| **Email** | `#EFF6FF` | `#BFDBFE` | `#1D4ED8` | `--node-email-{bg,border,accent}` |
| **SMS** | `#EEF2FF` | `#C7D2FE` | `#4338CA` | `--node-sms-{bg,border,accent}` |
| **WhatsApp** | `#F0FDF4` | `#BBF7D0` | `#15803D` | `--node-whatsapp-{bg,border,accent}` |
| **Courrier postal** | `#FFFBEB` | `#FDE68A` | `#B45309` | `--node-postal-{bg,border,accent}` |
| **Temporisation** (wait) | `#F8FAFC` | `#CBD5E1` | `#475569` | `--node-wait-{bg,border,accent}` |
| **Condition — donnée** | `#FAF5FF` | `#E9D5FF` | `#7C3AED` | `--node-cond-data-{bg,border,accent}` |
| **Condition — résultat** | `#FDF4FF` | `#F5D0FE` | `#A21CAF` | `--node-cond-result-{bg,border,accent}` |
| **Fin** (end) | `#F1F5F9` | `#94A3B8` | `#334155` | `--node-end-{bg,border,accent}` |

### 3.4 Edge (connector) colors

Edges between nodes carry meaning; encode it with color **and** label (never color-alone — WCAG `color-not-only`).

| Edge type | Color | Label / pattern |
|---|---|---|
| Default flow | `--fg-subtle` `#94A3B8` solid | (no label) |
| Yes / true / success branch | `--success` `#059669` solid | small `Oui` chip on the edge |
| No / false / failure branch | `--danger` `#B91C1C` solid | small `Non` chip on the edge |
| Pending / selected | `--primary` `#0E7490` solid, 2px | grows on hover/select |

### 3.5 Contrast verification (must hold)

- `--fg` on `--bg`: 17.4:1 ✓ AAA
- `--fg-muted` on `--bg`: 7.1:1 ✓ AAA
- `--on-primary` on `--primary`: 5.4:1 ✓ AA
- `--primary` on `--bg`: 5.6:1 ✓ AA (use for links + filled buttons)
- `--success` / `--warning` / `--danger` on white: ≥4.5:1 ✓ AA (foreground text use only)
- Node accent on node bg: each pair ≥4.5:1 ✓ AA — never put body text directly on a node bg without verifying.

### 3.6 Dark mode token map (stretch — keep parity, don't ship until tested)

`--bg → #0B1220`, `--surface → #111827`, `--surface-muted → #1F2937`, `--fg → #F8FAFC`, `--fg-muted → #94A3B8`, `--border → #1F2937`, `--border-strong → #334155`, `--primary → #22D3EE` (lighter for contrast), `--ring → #22D3EE`. Re-verify all contrast pairs separately — do not invert.

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

- **Library: Lucide** (`lucide-react`). Single source. Stroke 1.5px. 16px / 20px / 24px sizes only.
- **Channel icons** (for action nodes): `Mail` (Email), `MessageSquare` (SMS), `MessageCircle` (WhatsApp — or use the brand WhatsApp svg if licensing permits), `Mail` filled variant or `Inbox` for Courrier postal.
- **Node family icons:** `Play` (start), `Clock` (wait), `GitBranch` (condition), `Square` or `CircleStop` (end).
- **Never:** emojis, FontAwesome (mixed style), bitmap PNG icons.
- All icon-only buttons get `aria-label` (see §9.3).

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

```
┌─────────────────────────────────┐  ← border: family border color (1px)
│ ▎ ⌘ Family label                │  ← left bar 3px = family accent
│   Title (text-md, weight 600)   │
│   ─────                          │
│   Detail (text-sm, fg-muted)    │
│                                  │
│   ●──── source handle (right)   │
│   ────● target handle (left)    │
└─────────────────────────────────┘
```

- Width: ~240–280px (let content drive within this range).
- Padding: 12px.
- Radius: 8px (`--radius-md`).
- Bg: family `bg` token. Border: family `border`. Left strip: family `accent`.
- Resting elevation `--elev-1`. Selected: `--elev-2` + 2px ring `--primary`. Hover: bg shifts 1 tonal step.
- Connection handles: 10px circles, `--surface` bg, family-accent border. Become `--primary` while dragging an edge.
- Drag affordance: cursor `grab` resting, `grabbing` while dragging. The node rotates **0°** (no playful tilt) and gains `--elev-2`.

### 7.4 Inspector panel (right side)

- Width 360px, full canvas height, scrollable.
- Header: node family icon (20px) + family label + node title input.
- Body: form fields stacked, 16px gap.
- Sections labeled with `--text-sm` weight 600 uppercase tracking 0.02em.
- Empty state when no node is selected: centered `--text-md` muted "Sélectionnez un nœud pour en modifier les paramètres."

### 7.5 Node palette (left side)

- Width 320px, full canvas height.
- Grouped by family with section headers (`--text-xs` weight 600 uppercase, `--fg-muted`).
- Each item: 48px tall, family icon + label + drag handle (`GripVertical`).
- Drag preview: a real node card at 80% opacity, cursor `grabbing`.

### 7.6 Top bar

- Height 48px, sticky.
- Left: app mark + workflow name (editable inline; click to edit).
- Center: save status — `Enregistré` (muted check) / `Modifications non enregistrées` (warning dot) / `Enregistrement…` (spinner).
- Right: actions (Annuler, Restaurer, Enregistrer, kebab for "Renommer / Dupliquer / Supprimer").
- Border-bottom: 1px `--border`.

### 7.7 Workflow list page

- Header: page title `Workflows` + primary CTA `Nouveau workflow`.
- Empty state: large illustration-free message, primary CTA centered, max-width 480px.
- Populated: table or card grid. Rows show: name, last updated (relative), node count, status badge. Click → open editor. Row hover bg `--surface-muted`. Right-click / kebab → rename, duplicate, delete (with confirm modal).

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

- **Tab order matches visual order.** Top bar → palette → canvas → inspector.
- Canvas keyboard equivalents (must-have for an editor):
  - `Tab` to move between nodes; `Enter` to open inspector for the focused node; arrows to nudge (8px / 1px with Shift).
  - `Delete` / `Backspace` removes the selected node or edge.
  - `Cmd/Ctrl+S` saves; `Cmd/Ctrl+Z` / `Cmd/Ctrl+Shift+Z` undo/redo (stretch).
- **Focus rings always visible** (2px `--ring`, offset 2px).
- **No keyboard traps** — modals trap focus *inside* the modal, ESC always closes.
- Skip-link `Aller au canvas` at the top of `<main>`.

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

Desktop-first (≥1024px is the design target — lab admins on a workstation). Tablet usable; mobile is **not** a v1 requirement and the editor is not expected to work below 768px.

| Breakpoint | Behavior |
|---|---|
| `≥1280px` | Full layout: 320 palette + canvas + 360 inspector. |
| `1024–1279px` | Inspector collapses behind a toggle button on the right edge; palette stays. |
| `768–1023px` | Editor: both panels collapse behind toggles; list page reflows to single column cards. |
| `<768px` | Show a friendly "Mieux sur grand écran" message for the editor route; the list route still works (single column). |

- Container max-width for non-editor pages (list, settings): `max-w-6xl` (1152px), horizontal padding `--space-6` on desktop, `--space-4` on tablet.
- Use `min-h-dvh` (not `100vh`) on full-height containers.
- Z-index scale: `0` canvas, `10` panels, `20` top bar, `40` dropdowns/popovers, `100` modals, `1000` toasts.

---

## 11. Implementation notes (React + TS)

- **CSS approach:** Tailwind v3+ with a token layer in `tailwind.config.ts` mapping the variables in §3–§5. Components author classes; no raw hex in components.
- **Tokens file:** `src/styles/tokens.css` declares `:root { --bg: ...; ... }` (and `:root[data-theme="dark"]` for future dark mode). Tailwind reads them via `theme.extend.colors` using CSS variables.
- **Component library:** **headless** (Radix UI primitives or React Aria) + Tailwind. Avoid full UI kits (MUI / Chakra / Ant) — they drag a contradictory visual system.
- **Graph library:** **React Flow** (now `@xyflow/react`). Strongly recommended for this brief — supports custom nodes, custom edges, controlled state, accessibility hooks, deep-link-friendly snapshots. Discuss alternatives (Dagre + custom SVG, Rete.js) in the interview defense.
- **Icons:** `lucide-react`, sized via Tailwind classes (`size-4`, `size-5`).
- **Forms:** React Hook Form + Zod for validation. Errors rendered with the rules in §7.2.
- **Motion:** Framer Motion only where springs matter (modals, sheet open). Use Tailwind transitions for hovers / presses.
- **Date/relative time:** `date-fns` with French locale.

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
