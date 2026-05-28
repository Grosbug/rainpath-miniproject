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
    │   ├── plans/       # 8 implementation plans (Phase 0 → 3)
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

Le projet a été développé en 8 phases planifiées (Phase 0, 1A, 1B-A, 1B-B1, 1B-B2, 2A, 2B, 3). Chaque plan est dans [`docs/superpowers/plans/`](docs/superpowers/plans/). Voir [`docs/interview-prep.md`](docs/interview-prep.md) pour le détail des choix et les pistes d'amélioration.

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
