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
8. **Read-only canvas** : same graph as the editor, but laid out by `computeLanes` — main path stays on rail 0, alternate branches drop below, orphans get their own rails. A vertical dashed "today" line tracks the day cursor.
9. **Day-by-day simulator** (top toolbar) : `+1 j` / `+7 j` / `Prochain événement`. When the cursor crosses an edge's `daysAfter`, `useDaySimulator` auto-fires POST `/advance` with the default success outcome and the loop re-evaluates after refetch. Pause on multi-output (user picks a branch) and `end`.
10. **Manual step** : `Étape suivante` in the right panel still works — it lets you force a specific outcome (e.g. `bounced`) instead of the default success. The cursor snaps forward to the new current-node day after each manual advance.

## Defensible choices (from spec §9)

- **Temporisation portée par l'arête** : pure model, X-axis stays a hard chronological constraint. Argument: any workflow modelable with a `delay` node is modelable here — the delay just becomes a property of the outgoing edge. Acknowledge it's an interpretation of the brief.
- **JSON blob + Zod**: 1 table for workflows vs. normalized Node/Edge tables. Lower friction for a mini-project; the validation rigor lives in `shared/`.
- **Monorepo pnpm + shared package**: one source of truth for types, schemas, and algorithms used by both front and back.
- **Auto-save debouncé + retry exponentiel**: modern UX with hash-dedup gate and validation gate; PATCHs never fire on invalid graphs.
- **Statuts d'envoi typés par canal + 3 modes de sortie**: reflects real-world observability (email has rich events, postal untracked has none). Avoids configuring impossible branchings. **All branching now goes through these outputs** — see "deviations from the brief" below.
- **Vue patient avec reachability live + auto-layout en couloirs**: `computeLanes` ignore le Y libre de l'éditeur et redessine les branches sur des rails ; le user voit immédiatement « cette branche est celle du succès, celle-là est l'alternative ». L'algorithme `computeReachability` reste testable en isolation dans `shared/`.
- **Simulateur jour-par-jour côté front** : le cursor `day = max(userBumped, dayOfHistory)` est purement frontend (somme `daysAfter` des arêtes traversées + offset utilisateur). Aucune migration BDD, aucun endpoint supplémentaire — le simulateur orchestre des `/advance` existants avec l'outcome par défaut. Mimic un scheduler sans embarquer BullMQ.
- **Bibliothèque de modèles** + drop détaché: palette is dynamic (BDD-driven), drop creates a fully independent node copy via `structuredClone`.
- **Soft delete par défaut**: appropriate for an anatomopathologie context (audit, RGPD future-proofing).
- **Undo/redo dans l'éditeur** (50 snapshots, Ctrl+Z/Y): signal of UX care.
- **Modal d'édition focalisée** (double-click): tested approach; DS §7.4 was updated to adopt it after iteration.

## Deviations from the brief (assume + defend)

- **No Condition nodes**. The brief (§3) explicitly lists `Condition — disponibilité d'une donnée` and `Condition — résultat d'une action précédente`. They were removed in favor of pushing all branching into the **multi-output** mode of send nodes. Argument: the multi-output's status-based routing covers "résultat d'une action précédente" natively; "disponibilité d'une donnée" is partially absorbed by the fact that sending to a missing channel yields a `bounced`/`failed` status which routes via the failure handle. Acknowledge the cost: you can no longer pre-empt the send to spare a useless attempt. Add Condition back as a half-day re-implementation if reviewer pushes.
- **`daysAfter` on the edge** rather than a dedicated `Wait` node (already in the original deck; reiterate).

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

- **shared/ package** : Zod schemas (single source of truth), `computeXPositions` (topological propagation), `computeReachability` (5-state algorithm with formal invariants — now purely outcome-driven since Condition nodes were removed), `validateGraph` (structural + per-output + format), `simulate*` helpers (for future ghost preview).
- **Backend layered validation** : Zod pipe (DTOs) + `GraphValidationError` (rules) + drift detection on read (`decodeGraph` throws 500 on stored-blob corruption).
- **Frontend dual-zod workaround** : never compose shared Zod schemas in frontend `z.object` (TS2719 dual-instance). Pattern: envelope schema with `graph: z.unknown()`, then `Graph.safeParse(envelope.data.graph)` separately.
- **Auto-save state machine** : idle → saving → saved | invalid | error → offline (after 5 retries with exponential backoff `[1, 2, 4, 8, 16]s`).
- **Reachability monotony** : a node marked `reachable` never regresses; `blocked` can be promoted to `reachable` if another path activates it (tested invariant).
- **Day simulator architecture** : zero backend change. `dayOfHistory` sums `daysAfter` over the visited path → `currentNodeDay`. The user cursor is `userCursor + offset` ; effective cursor is `max(userCursor, currentNodeDay)`. A `useEffect` watches `(day, nextEventDay, currentNodeId)` and fires `POST /advance` with the default success outcome whenever the cursor crosses `currentNodeDay + nextEdge.daysAfter`. Refetch re-runs the effect → cascades until pause (multi-output or `end`). Reset is detected via history length collapsing to 1 → cursor rewinds.

## Tooling decisions worth mentioning

- **TanStack Query v5** for server-state cache, automatic invalidation on mutations.
- **Zustand** (not Redux) for editor state — lightweight, no boilerplate, recommended by xyflow.
- **Radix UI primitives** + headless approach; styled with Tailwind tokens.
- **React Flow v12** (`@xyflow/react`) — standard for node-based React editors.
- **Floating-UI** for popover positioning (edge daysAfter).
- **Vitest + RTL** for frontend tests; **Jest + Supertest** for backend tests (one E2E suite per controller).

## Numbers worth quoting

- **3 packages**: `shared`, `frontend`, `backend`, with pnpm workspaces.
- **~10,000 lines** added across all phases.
- **80+ tests** total (shared algorithm unit tests + backend Jest + frontend Vitest + e2e Supertest).
- **8 plans + 1 spec + 1 design system** in `docs/superpowers/` (the Condition-node bits are now historical — kept as-is for traceability).
- **0 emoji**, **0 hex outside `tokens.css`** (except documented intentional exceptions).
