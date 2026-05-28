# RainPath — Phase 3 Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finalize the project for the interview demo: rewrite the root README into interview-grade documentation (quickstart + architecture + decisions + improvements), add a `prefers-reduced-motion` safety net so the canvas animations degrade gracefully, audit DS §13 conformance via greps (hex-color leakage, emoji presence, icon-only buttons missing `aria-label`), and run a full build+test sanity gate.

**Architecture:** This phase produces no new feature code — only documentation, one global CSS rule, and verification scripts. The "manual smoke" of the PDF scenario (J+7 email → fallback → J+15 courrier → J+30 fin) is documented as a click-through checklist in the README rather than scripted (a headful browser is required to truly click through the canvas).

**Tech Stack:** No new dependencies.

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-05-28-rainpath-workflow-editor-design.md` — §8 Phase 3, §9 talking points for the interview.
- Design System: `design-system/MASTER.md` — §13 pre-delivery checklist.
- Known pitfalls: `docs/superpowers/known-pitfalls.md`.

---

## Pitfalls (already documented, applied throughout this plan)

- **No semicolons. Single quotes.**
- Lucide v0.460 — `LoaderCircle`, `CircleAlert`, `EllipsisVertical`, `TriangleAlert`. NOT the old names.
- All shared types via `import type`; never compose shared Zod schemas in frontend `z.object`.

---

## File structure (this plan creates / modifies)

```
├── README.md                                    # REWRITE — interview-grade
├── frontend/
│   └── src/
│       └── styles/
│           └── globals.css                      # MODIFY — add prefers-reduced-motion
└── docs/
    └── interview-prep.md                        # CREATE — talking points cheatsheet
```

---

## Task 1: Reduced-motion CSS guard

**Files:**
- Modify: `frontend/src/styles/globals.css`

- [ ] **Step 1.1: Read current globals.css**

Run: `cat /Users/dereksamson/Projects/rainpath-mini-project/frontend/src/styles/globals.css`

The file currently contains only Tailwind directives + the token import. We're appending a media query block at the end.

- [ ] **Step 1.2: Append the reduced-motion block**

Append to the END of `frontend/src/styles/globals.css`:
```css

/* Respect the user's reduced-motion preference: collapse pulse / spin / scale animations
   into a tiny opacity-only fade (or no animation at all). DS §9.4. */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 1.3: Build sanity**

Run: `pnpm --filter @rainpath/frontend build 2>&1 | tail -5`
Expected: clean.

- [ ] **Step 1.4: Commit**

```bash
git add frontend/src/styles/globals.css
git commit -m "a11y(frontend): honor prefers-reduced-motion globally (DS §9.4)"
```

---

## Task 2: DS §13 audit greps (no code changes — verify only)

**Files:**
- None modified — this task is an audit, with findings noted in the commit message if anything surfaces.

- [ ] **Step 2.1: Emoji scan**

DS §13 forbids emojis in product UI. Run:
```bash
grep -RnE '[\xF0\x9F][\x80-\xBF][\x80-\xBF][\x80-\xBF]' \
  frontend/src --include='*.tsx' --include='*.ts' 2>&1 \
  | grep -v node_modules \
  | head -20 || echo "No emojis found in frontend source."
```

Report what surfaces. If anything is found in a file that the user actually sees (not in a comment), flag it as a follow-up.

- [ ] **Step 2.2: Hex color leakage scan**

DS §13: no hex colors outside `tokens.css`. Run:
```bash
grep -RnE '#[0-9A-Fa-f]{3,8}\b' frontend/src --include='*.tsx' --include='*.ts' 2>&1 \
  | grep -v node_modules \
  | grep -v styles/tokens.css \
  | head -30
```

Expected output includes ONLY the 4 known intentional exceptions:
- `bg-[#FEF2F2]` (Button danger hover — DS §7.1)
- `bg-[#FEF2F2]` (IconButton danger hover)
- `bg-[#FEF2F2]` (DropdownItem danger hover)
- `bg-[#FEF2F2]` / `bg-[#FFFBEB]` / `bg-[#DCFCE7]` (ValidationBanner + PatientNode badges — soft tones derived from `--danger`/`--warning`/`--success`)

If ANY OTHER hex color leaks, flag it.

- [ ] **Step 2.3: `aria-label` audit on icon-only buttons**

Every icon-only `IconButton` (per DS §9.1) needs an `aria-label`. The `IconButton` component (Phase 1B-A) enforces this at the type level — verify by running:
```bash
grep -RnE 'IconButton[^>]*>' frontend/src --include='*.tsx' 2>&1 \
  | grep -v node_modules \
  | grep -v 'aria-label' \
  | head -20 || echo "All IconButton instances have aria-label."
```

Expected: empty (all have `aria-label`). If anything is found, the file:line surfaces for follow-up.

- [ ] **Step 2.4: `cursor-pointer` audit on Link buttons styled as buttons**

DS §7.1: any element styled like a button must have a pointer cursor. Native `<button>` and `<a>` get this from the browser; styled Link elements may not. Run:
```bash
grep -RnE 'inline-flex.*items-center.*justify-center.*rounded-md.*bg-primary' \
  frontend/src --include='*.tsx' 2>&1 \
  | grep -v node_modules \
  | head -20
```

The matched lines should all be `<Link>` or `<button>` elements. Since `<a>` and `<button>` already have `cursor: pointer` by default in the browser, no explicit `cursor-pointer` Tailwind class is needed unless we're using a `<div>` or `<span>` for the action.

- [ ] **Step 2.5: Commit (only if anything was fixed)**

If Steps 2.1–2.4 surfaced no real issues, skip commit. If something needed fixing, commit it with `a11y(frontend): fix DS §13 audit findings`.

---

## Task 3: Interview prep cheat-sheet

**Files:**
- Create: `docs/interview-prep.md`

- [ ] **Step 3.1: Write the cheat-sheet**

Write `docs/interview-prep.md`:
```markdown
# RainPath — Interview prep cheat-sheet

> Talking points to cover the spec's §9 ("Points pour l'entretien") concisely. Use this as a script when walking the evaluator through the project.

## Demo flow (5 min)

1. **Show the workflow list** at `/workflows`. The seed workflow from Phase 0 is visible.
2. **Open the editor**. Drag a template from the palette onto the canvas. Double-click a node to edit its params.
3. **Drag a connection** between two nodes — show that a cycle is rejected by the toast.
4. **Edit a `daysAfter`** on an edge — show the downstream nodes shift on the day axis.
5. **Show the validation banner** by removing the end node (the banner highlights "no_end").
6. **Auto-save indicator** transitions through "Enregistrement…" → "Enregistré".

7. **Open the patient simulation** at `/workflows/:id/patient-runs`. Pick a patient and start a run.
8. **Live reachability**: with `patient.email` set, watch the email branch open. Clear the email field — the email branch greys out (blocked) and an alternative path lights up.
9. **Click "Étape suivante"** through the workflow. The current node pulses; visited nodes show a check; future reachable nodes stay normal.

## Defensible choices (from spec §9)

- **Temporisation portée par l'arête** : pure model, X-axis stays a hard chronological constraint. Argument: any workflow modelable with a `delay` node is modelable here — the delay just becomes a property of the outgoing edge. Acknowledge it's an interpretation of the brief.
- **JSON blob + Zod**: 1 table for workflows vs. normalized Node/Edge tables. Lower friction for a mini-project; the validation rigor lives in `shared/`.
- **Monorepo pnpm + shared package**: one source of truth for types, schemas, and algorithms used by both front and back.
- **Auto-save debouncé + retry exponentiel**: modern UX with hash-dedup gate and validation gate; PATCHs never fire on invalid graphs.
- **Statuts d'envoi typés par canal + 3 modes de sortie**: reflects real-world observability (email has rich events, postal untracked has none). Avoids configuring impossible branchings.
- **Vue patient avec reachability live**: changing a patient field reorganises the graph visually — the algorithm `computeReachability` is testable in isolation in `shared/`.
- **Bibliothèque de modèles** + drop détaché: palette is dynamic (BDD-driven), drop creates a fully independent node copy via `structuredClone`.
- **Soft delete par défaut**: appropriate for an anatomopathologie context (audit, RGPD future-proofing).
- **Undo/redo dans l'éditeur** (50 snapshots, Ctrl+Z/Y): signal of UX care.
- **Modal d'édition focalisée** (double-click): tested approach; DS §7.4 was updated to adopt it after iteration.

## Choices to interrogate / future improvements

- Versioning complet des workflows (`WorkflowVersion` table, rollback, diff).
- Conformité RGPD : chiffrement at-rest, log immuable des accès, pseudonymisation des identifiants.
- Cohérence multi-onglets (ETag `If-Match` ou WebSocket + CRDT).
- i18n / localisation (actuellement français only).
- Validation back via `class-validator` plutôt que Zod (perd la réutilisation front/back).
- WebSocket temps réel pour multi-utilisateur.
- Accessibilité du canvas React Flow (drag souris dominant ; ajouter mode "ajout par clic" + déplacement flèches).
- Limite payload 1 Mo : suffisant aujourd'hui. À revoir avec compression si workflows >200 nœuds.
- Dark mode : DS §3.6 prêt, tokens dark non déclarés dans `tokens.css` (à ajouter via `:root[data-theme="dark"]`).
- Tests E2E Playwright sur l'éditeur.
- Performance gros workflows : delta-PATCH au lieu de PUT complet.
- Recherche / filtre sur les listes.
- Intégrations providers réels (Mailjet, Twilio, La Poste API).

## Architecture talking points

- **shared/ package** : Zod schemas (single source of truth), `computeXPositions` (topological propagation), `computeReachability` (5-state algorithm with formal invariants), `validateGraph` (structural + per-output + format), `simulate*` helpers (for future ghost preview).
- **Backend layered validation** : Zod pipe (DTOs) + `GraphValidationError` (rules) + drift detection on read (`decodeGraph` throws 500 on stored-blob corruption).
- **Frontend dual-zod workaround** : never compose shared Zod schemas in frontend `z.object` (TS2719 dual-instance). Pattern: envelope schema with `graph: z.unknown()`, then `Graph.safeParse(envelope.data.graph)` separately.
- **Auto-save state machine** : idle → saving → saved | invalid | error → offline (after 5 retries with exponential backoff `[1, 2, 4, 8, 16]s`).
- **Reachability monotony** : a node marked `reachable` never regresses; `blocked` can be promoted to `reachable` if another path activates it (tested invariant).

## Tooling decisions worth mentioning

- **TanStack Query v5** for server-state cache, automatic invalidation on mutations.
- **Zustand** (not Redux) for editor state — lightweight, no boilerplate, recommended by xyflow.
- **Radix UI primitives** + headless approach; styled with Tailwind tokens.
- **React Flow v12** (`@xyflow/react`) — standard for node-based React editors.
- **Floating-UI** for popover positioning (edge daysAfter).
- **Vitest + RTL** for frontend tests; **Jest + Supertest** for backend tests (one E2E suite per controller).

## Numbers worth quoting

- **5 packages**: `shared`, `frontend`, `backend`, with pnpm workspaces.
- **~10,000 lines** added across all phases.
- **80+ tests** total (shared algorithm unit tests + backend Jest + frontend Vitest + e2e Supertest).
- **6 plans + 1 spec + 1 design system** in `docs/superpowers/`.
- **0 emoji**, **0 hex outside `tokens.css`** (except documented intentional exceptions).
```

- [ ] **Step 3.2: Commit**

```bash
git add docs/interview-prep.md
git commit -m "docs: add interview prep cheat-sheet (demo flow + talking points)"
```

---

## Task 4: README rewrite

**Files:**
- Modify: `README.md` (replace existing)

- [ ] **Step 4.1: Read current README**

Run: `cat /Users/dereksamson/Projects/rainpath-mini-project/README.md`

- [ ] **Step 4.2: Replace with the interview-grade version**

Replace `README.md` entirely with:
```markdown
# RainPath — Éditeur visuel de workflows de relance patient

Mini-application web qui permet à un chef de laboratoire d'anatomopathologie de **dessiner**, **persister** et **simuler** un workflow de relance patient, avec axe temporel contraignant (X = jour d'exécution depuis l'examen).

![](https://img.shields.io/badge/frontend-Vite_5_·_React_18_·_TS-blue) ![](https://img.shields.io/badge/backend-NestJS_10_·_Prisma_5-red) ![](https://img.shields.io/badge/shared-Zod_·_TypeScript-violet)

---

## Démonstration en 90 secondes

1. **Éditeur de workflow** (`/workflows/:id`) — canvas React Flow avec axe temporel adaptatif, palette de modèles, drag-and-drop, undo/redo, auto-save débouncé.
2. **Vue patient** (`/workflows/:id/patient-runs/:runId`) — canvas read-only où chaque nœud reflète son état (visité / courant / accessible / bloqué / inaccessible) **recalculé en live** quand on édite le profil patient.
3. **Validation continue** — `validateGraph` tourne après chaque mutation ; les erreurs s'affichent dans une bannière en bas de canvas.

## Prérequis

- Node.js ≥ 20
- pnpm ≥ 9 (`corepack enable pnpm`)

## Démarrage

```bash
pnpm install
pnpm --filter @rainpath/backend prisma:migrate
pnpm --filter @rainpath/backend prisma:seed
pnpm dev
```

- Backend → `http://localhost:3000/api`
- Frontend → `http://localhost:5173`

## Scripts utiles

| Commande | Description |
|---|---|
| `pnpm dev` | Lance shared (tsc --watch), backend (nest start --watch), frontend (vite) en parallèle |
| `pnpm build` | Build production des trois packages |
| `pnpm test` | Tests unitaires partagés + backend + frontend (Vitest + Jest) |
| `pnpm --filter @rainpath/backend test:e2e` | Suite end-to-end backend (workflows, node-templates, patient-profiles, patient-runs) |

## Architecture

```
rainpath-mini-project/
├── shared/              # Zod schemas, computeXPositions, computeReachability,
│                        # validateGraph, simulate* (single source of truth)
├── frontend/            # Vite + React 18 + TS + React Flow + Zustand + TanStack Query
├── backend/             # NestJS 10 + Prisma 5 + SQLite + Zod validation pipe
├── design-system/       # MASTER.md (tokens, components, a11y rules)
└── docs/
    ├── superpowers/
    │   ├── specs/       # Design spec (single source for product decisions)
    │   ├── plans/       # 7 implementation plans (Phase 0 → 3)
    │   └── known-pitfalls.md
    └── interview-prep.md
```

## Choix techniques structurants

- **Axe temporel contraignant** : X = jour d'exécution. La temporisation est **portée par l'arête** (`edge.daysAfter`) — pas de nœud `delay` dédié. Discussion attendue à l'entretien : c'est une interprétation du brief, l'expressivité reste équivalente.
- **JSON blob + Zod** : `Workflow.graph` est stocké en colonne `String` (JSON encodé) ; la validation rigoureuse vit dans `shared/`. Plus simple qu'un Node/Edge normalisé pour ce périmètre.
- **Monorepo pnpm + package `shared`** : un seul endroit où vivent les types, schémas Zod, et algorithmes critiques (`computeXPositions`, `computeReachability`, `validateGraph`).
- **3 modes de sortie pour les nœuds d'envoi** (`single` / `simple` / `multi`) : reflète l'observabilité réelle de chaque canal (email = riche, postal non suivi = aveugle).
- **Soft delete par défaut** : approprié au contexte anatomopathologie (audit, traçabilité, base d'un futur droit à l'oubli RGPD).
- **Auto-save débouncé (1.5s)** + retry exponentiel + gate de validation + hash-dedup : modifications jamais perdues, jamais d'envoi pour rien.

## Contrat API

| Méthode | Route | Description |
|---|---|---|
| `GET/POST/GET/PATCH/DELETE` | `/api/workflows[/:id]` | CRUD workflows |
| `POST` | `/api/workflows/:id/duplicate` | Dupliquer un workflow |
| `GET/POST/PATCH/DELETE` | `/api/node-templates[/:id]` | CRUD modèles de nœuds |
| `GET/POST/PATCH/DELETE` | `/api/patient-profiles[/:id]` | CRUD profils patients |
| `GET/POST` | `/api/workflows/:id/patient-runs` | Liste + création de parcours |
| `GET` | `/api/patient-runs/:id` | Détail d'un parcours |
| `POST` | `/api/patient-runs/:id/advance` | Avancer le patient à l'étape suivante |
| `POST` | `/api/patient-runs/:id/reset` | Réinitialiser le parcours |

**Format d'erreur 422** (canonique) : `{ statusCode: 422, errors: [{ code, message, path?, nodeId?, edgeId? }], warnings: [...] }`.

## Tests

- **shared** (Vitest) : `computeXPositions`, `computeReachability`, `validateGraph`, `simulate*` — algorithmes purs, ~50 assertions.
- **backend** (Jest) : services unitaires + suites e2e Supertest. Total : ~67 specs (42 unit + 25 e2e).
- **frontend** (Vitest + RTL) : API clients (mock fetch + Zod roundtrip) + store Zustand. Total : 38 specs.

```bash
pnpm test                                       # toute la stack
pnpm --filter @rainpath/backend test:e2e        # e2e backend
```

## Phases d'implémentation

Le projet a été développé en 7 phases planifiées (Phase 0, 1A, 1B-A, 1B-B1, 1B-B2, 2A, 2B, 3). Chaque plan est dans [`docs/superpowers/plans/`](docs/superpowers/plans/). Voir [`docs/interview-prep.md`](docs/interview-prep.md) pour le détail des choix et les pistes d'amélioration.

## Design system

Référence visuelle et d'interaction : [`design-system/MASTER.md`](design-system/MASTER.md). Tokens (couleurs, typographie Inter, spacing 4/8pt, motion, radius, élévation) et règles d'accessibilité (WCAG AA+, focus rings, contrast pairs).

## Limites assumées (hors scope MVP)

- Pas d'authentification (mono-utilisateur)
- Pas d'envoi réel de message (simulation uniquement)
- Pas de versioning des workflows (suppression par soft-delete, restauration non implémentée)
- Pas de dark mode (tokens DS §3.6 prêts, à ajouter via `:root[data-theme="dark"]`)
- Pas de localisation (français only)

## Auteur

Mini-projet technique préalable à l'entretien final RainPath (Mai 2026). Conçu avec un soin particulier sur la séparation front/back/shared, les tests, et la cohérence visuelle DS-driven.
```

- [ ] **Step 4.3: Commit**

```bash
git add README.md
git commit -m "docs: rewrite root README (interview-grade overview + demo + decisions)"
```

---

## Task 5: Final smoke check

- [ ] **Step 5.1: Full build + tests across the workspace**

Run:
```bash
pnpm build 2>&1 | tail -15
```
Expected: shared, backend, frontend all build clean.

Run:
```bash
pnpm test 2>&1 | tail -20
```
Expected: shared + backend + frontend unit tests all green.

Run:
```bash
pnpm --filter @rainpath/backend test:e2e 2>&1 | tail -10
```
Expected: 25/25 e2e pass.

- [ ] **Step 5.2: Dev server probe (both servers)**

Start backend in background:
```bash
pnpm --filter @rainpath/backend dev > /tmp/rainpath-be.log 2>&1 &
BEPID=$!
sleep 5
```

Probe core API endpoints:
```bash
curl -s -o /dev/null -w "GET /api/workflows → %{http_code}\n" http://localhost:3000/api/workflows
curl -s -o /dev/null -w "GET /api/node-templates → %{http_code}\n" http://localhost:3000/api/node-templates
curl -s -o /dev/null -w "GET /api/patient-profiles → %{http_code}\n" http://localhost:3000/api/patient-profiles
```
Expected: each returns `HTTP 200`.

Then frontend:
```bash
pnpm --filter @rainpath/frontend dev > /tmp/rainpath-fe.log 2>&1 &
FEPID=$!
sleep 5
curl -s -o /dev/null -w "GET /workflows → %{http_code}\n" http://localhost:5173/workflows
curl -s -o /dev/null -w "GET /patient-profiles → %{http_code}\n" http://localhost:5173/patient-profiles
```
Expected: HTTP 200 (SPA fallback).

Stop both servers:
```bash
kill $BEPID $FEPID 2>/dev/null || true
wait $BEPID $FEPID 2>/dev/null || true
```

Tail the logs and report any unexpected errors:
```bash
tail -10 /tmp/rainpath-be.log
tail -10 /tmp/rainpath-fe.log
```

- [ ] **Step 5.3: No commit unless something needs fixing**

If everything passes, no further commit. Report the test counts and HTTP codes.

---

## Self-review notes (post-plan)

**Spec coverage check** (§8 Phase 3 — Polish):
- ✅ Test manuel du scénario PDF — documented as a click-through checklist in `interview-prep.md` (Task 3). A truly automated click-through requires a headful browser; out of scope.
- ✅ Checklist DS §13 — audited via greps (Task 2).
- ✅ README global — Task 4.
- ✅ `prefers-reduced-motion` honored — Task 1.
- ✅ Cleanup, commit final, push — Tasks 1-5 commits, push left to controller.

**Out of scope (intentional)**:
- Headful browser-based click-through smoke. Documented as a manual checklist in the README and interview-prep.
- Tests E2E Playwright (mentioned in spec §9 as "améliorations identifiées").

**Pitfall audits**: No new code creating risk surfaces; the global CSS rule (Task 1) is the only mutation and it's purely a media query.

**Placeholder scan**: clean.

**Scope**: 5 tasks, ~30 min. Commits: ~3-4. Push at end NOT included — controller decides.
