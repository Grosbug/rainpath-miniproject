# RainPath — Éditeur visuel de workflows de relance patient

Mini-application web qui permet à un chef de laboratoire d'anatomopathologie de **dessiner**, **persister** et **simuler** un workflow de relance patient, avec axe temporel contraignant (X = jour d'exécution depuis l'examen).

![](https://img.shields.io/badge/frontend-Vite_5_·_React_18_·_TS-blue) ![](https://img.shields.io/badge/backend-NestJS_10_·_Prisma_6-red) ![](https://img.shields.io/badge/shared-Zod_·_TypeScript-violet) ![](https://img.shields.io/badge/tests-196-brightgreen)

---

## Démonstration en 90 secondes

1. **Éditeur de workflow** (`/workflows/:id`) — canvas React Flow avec axe temporel adaptatif (`useLeftAnchoredZoom`), drag libre des nœuds + snap au jour le plus proche, click-to-connect & reconnect via state machine custom, palette de modèles drag-and-drop, undo/redo, auto-save débouncé, et badge de validité dans la top bar avec détail des erreurs en popover.
2. **Vue patient** (`/workflows/:id/patient-runs/:runId`) — canvas read-only avec lanes calculées par `computeLanes`, état de chaque nœud (visité / courant / accessible / bloqué / inaccessible) **recalculé en live** quand on édite le profil patient, simulateur de date (J+N depuis la date de début), historique daté + colorié succès/échec.
3. **Validation continue** — `validateGraph` tourne après chaque mutation, les nouvelles erreurs s'affichent comme toasts ancrés sous le curseur (`useValidationToasts`) ; les erreurs persistantes sont lisibles depuis la pill `ValidationStatusBadge` qui détaille tous les codes en français.

---

## Prérequis

| Outil | Version minimum |
|---|---|
| Node.js | ≥ 20.0 |
| pnpm | ≥ 9.0 (`corepack enable pnpm`) |

## Démarrage en local

```bash
# 1. Cloner + installer
git clone <repo>
cd rainpath-mini-project
pnpm install

# 2. Initialiser la DB SQLite (générée dans backend/dev.db, ignorée par git)
cp backend/.env.example backend/.env             # DATABASE_URL="file:./dev.db"
pnpm --filter @rainpath/backend prisma:migrate   # crée + applique les migrations
pnpm --filter @rainpath/backend prisma:seed      # peuple quelques workflows + patients

# 3. Lancer en mode dev (3 workers en parallèle : shared tsc --watch, backend, frontend)
pnpm dev
```

- **Backend** → `http://localhost:3000/api`
- **Frontend** → `http://localhost:5173` (proxy `/api` vers le backend, cf. `frontend/vite.config.ts`)

## Build & déploiement

```bash
# Build prod des 3 packages (shared → tsc, backend → nest build, frontend → vite build)
pnpm build

# Servir le backend compilé
pnpm --filter @rainpath/backend start:prod        # node dist/main, port 3000

# Servir le frontend statique (preview Vite, ou n'importe quel serveur statique)
pnpm --filter @rainpath/frontend preview          # http://localhost:4173
```

**Notes de déploiement** :

- Le backend nécessite la variable `DATABASE_URL` (SQLite par défaut : `file:./dev.db`). Pour Postgres / MySQL, changer le `provider` dans `backend/prisma/schema.prisma` puis `prisma migrate dev`.
- Le frontend est purement statique après `vite build` (dossier `frontend/dist/`) ; il attend une API à `/api`. Pour un déploiement séparé, configurer un reverse-proxy ou poser un `VITE_API_BASE_URL` (à brancher dans `frontend/src/api/client.ts`).
- **Pas d'authentification** : mono-utilisateur. Un déploiement public doit ajouter une couche d'auth (cf. Limites assumées).
- Les workflows + parcours sont **soft-deleted** (`deletedAt` non-null). Une routine de purge mature reste à écrire pour un usage prod.

## Tests

| Stack | Runner | Specs | Couverture |
|---|---|---|---|
| `shared/` (algos purs) | Vitest | **78** | `computeXPositions`, `computeReachability`, `validateGraph`, `simulate*`, schémas Zod |
| `backend/` unit | Jest | **39** | services (`WorkflowsService`, `PatientProfilesService`, `PatientRunsService`, `NodeTemplatesService`, `advance.ts`), pipe de validation Zod |
| `backend/` e2e | Jest + Supertest | **27** | suites end-to-end sur `/api/workflows`, `/api/node-templates`, `/api/patient-profiles`, `/api/patient-runs` |
| `frontend/` | Vitest + RTL | **52** | API clients (mock fetch + Zod roundtrip), store Zustand, `validateConnection` (state machine d'arêtes), `WorkflowsList` (smoke) |

**Total : 196 tests.**

```bash
pnpm test                                       # toute la stack (shared + backend unit + frontend)
pnpm --filter @rainpath/backend test:e2e        # e2e backend (DB SQLite éphémère par suite)
pnpm --filter @rainpath/backend test:cov        # couverture backend
pnpm --filter @rainpath/shared test             # algos uniquement
pnpm --filter @rainpath/frontend test           # frontend uniquement
```

## Scripts utiles

| Commande | Description |
|---|---|
| `pnpm dev` | Lance shared (tsc --watch), backend (nest --watch), frontend (vite) en parallèle |
| `pnpm build` | Build production des 3 packages |
| `pnpm test` | Suites unitaires partagées + backend + frontend |
| `pnpm --filter @rainpath/backend prisma:migrate` | Crée + applique les migrations Prisma |
| `pnpm --filter @rainpath/backend prisma:seed` | Peuple la DB avec un jeu de démo |
| `pnpm --filter @rainpath/backend prisma:generate` | Régénère le client Prisma (à faire après changement de schéma) |
| `pnpm lint` | ESLint sur les 3 packages |

## Architecture

> **Vue détaillée** : [docs/architecture.md](docs/architecture.md) — modules, contrat d'API, modèle de données, algorithmes partagés, boucle d'auto-save, décisions structurantes.

```
rainpath-mini-project/
├── shared/                  # Zod schemas + algos purs (single source of truth)
│   └── src/
│       ├── algorithms/      # computeXPositions, computeReachability,
│       │                    # validateGraph, simulate*
│       └── schemas/         # primitives, node-data, output-config,
│                            # node-template, api-dtos, channels, format
├── frontend/                # Vite + React 18 + TS + React Flow + Zustand + TanStack Query
│   └── src/pages/
│       ├── WorkflowsList/
│       ├── WorkflowEditor/      # Canvas + hooks (click-connect, validation,
│       │                        # left-anchored zoom, history, autosave)
│       ├── PatientProfilesList/
│       ├── PatientRunsList/
│       ├── PatientRunView/      # Simulateur de date, lanes, historique
│       └── Documentation/       # Page d'aide /docs
├── backend/                 # NestJS 10 + Prisma 6 + SQLite + pipe Zod
│   ├── src/
│   │   ├── workflows/
│   │   ├── node-templates/
│   │   ├── patient-profiles/
│   │   ├── patient-runs/        # incl. advance.ts (resolveAdvance)
│   │   └── validation/          # pipe Zod générique + GraphValidationError
│   └── prisma/
│       ├── schema.prisma
│       ├── migrations/
│       └── seed.ts
├── design-system/           # MASTER.md (tokens, components, a11y rules)
└── docs/
    ├── architecture.md
    ├── mini-projet-technique-rainpath.md
    ├── interview-prep.md
    └── superpowers/
        ├── specs/            # Design spec
        ├── plans/            # 8 plans d'implémentation (Phase 0 → 3)
        └── known-pitfalls.md
```

## Choix techniques structurants

- **Axe temporel contraignant** : X = jour d'exécution. La temporisation est **portée par l'arête** (`edge.daysAfter`) — pas de nœud `delay` dédié. Le drag horizontal d'un nœud réécrit en live le `daysAfter` de l'arête entrante définissante (commit au snap, sur relâchement).
- **JSON blob + Zod** : `Workflow.graph` est stocké en colonne `String` (JSON encodé) ; la validation rigoureuse vit dans `shared/validateGraph`. Plus simple qu'un Node/Edge normalisé pour ce périmètre. Idem pour `PatientProfile.address` (objet `PostalAddress` JSON-encodé dans la même colonne TEXT, pas de migration nécessaire).
- **Monorepo pnpm + package `shared`** : un seul endroit où vivent les types, schémas Zod, et algorithmes critiques. Le backend ET le frontend les consomment via `@rainpath/shared`.
- **2 modes de sortie pour les nœuds d'envoi** (`simple` / `multi`) : reflète l'observabilité réelle de chaque canal (email = riche, postal non suivi = pauvre). En `simple` un seul handle `success` + `failure` ; en `multi` N handles avec coverage de statuts paramétrable.
- **State machine custom pour les arêtes** : `useClickConnection` (`idle` / `creating-edge` / `reconnecting-edge`) + `validateConnection` (cycle / unreachable_source / handle_conflict / …) — évite les pièges du drag-to-connect natif RF, supporte la reconnexion non-destructive (click sur un handle déjà câblé détache l'extrémité opposée et la laisse suivre le curseur, restauration sur clic droit).
- **Validation en couches** :
  - **Préventive** — `isValidConnection` côté RF + listener hover dans `useClickConnection` colorient le handle survolé en vert/rouge avant le clic.
  - **Au commit** — `store.addEdge` rejette avec un code typé ; `showAnchoredToast` ancre l'erreur au curseur.
  - **Continue** — `validateGraph` tourne après chaque mutation, les deltas d'erreurs sont surfacés en toasts ancrés sous le curseur ; l'état complet (`ValidationStatusBadge`) est consultable à tout moment depuis la top bar.
- **Soft delete par défaut** : approprié au contexte anatomopathologie (audit, traçabilité, base d'un futur droit à l'oubli RGPD).
- **Auto-save débouncé (1.5 s)** + retry exponentiel + gate de validation + hash-dedup : modifications jamais perdues, jamais d'envoi pour rien. Le backend accepte les workflows invalides (statut `saved_invalid`), mais bloque côté UI la création de parcours patient depuis ces workflows.
- **Adresse postale structurée** : `PostalAddress = { street, postalCode, city, country? }` côté shared, validation `postalCode: /^\d{5}$/`, marshallée comme JSON dans la colonne `address` TEXT existante (pas de migration Prisma).

## Contrat API

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/workflows` | Liste des workflows (résumé + flag `isValid`) |
| `POST` | `/api/workflows` | Créer un workflow (graph optionnel, défaut start+end) |
| `GET` | `/api/workflows/:id` | Détail (graph complet + warnings + validationErrors) |
| `PATCH` | `/api/workflows/:id` | Patch nom / description / graph |
| `DELETE` | `/api/workflows/:id` | Soft delete |
| `POST` | `/api/workflows/:id/duplicate` | Dupliquer |
| `GET/POST/PATCH/DELETE` | `/api/node-templates[/:id]` | CRUD modèles de nœuds |
| `GET/POST/PATCH/DELETE` | `/api/patient-profiles[/:id]` | CRUD profils patients |
| `GET` | `/api/patient-profiles/:id/patient-runs` | Liste des parcours d'un patient (vue depuis le profil) |
| `GET` | `/api/workflows/:id/patient-runs` | Liste des parcours d'un workflow |
| `POST` | `/api/workflows/:id/patient-runs` | Créer un parcours (`patientId`, `startDate?`) |
| `GET` | `/api/patient-runs/:id` | Détail (workflow + patient + history + startDate) |
| `POST` | `/api/patient-runs/:id/advance` | Avancer (`outcome?`) |
| `POST` | `/api/patient-runs/:id/reset` | Réinitialiser au start |

**Format d'erreur 422** (canonique) : `{ statusCode: 422, errors: [{ code, message, path?, nodeId?, edgeId? }], warnings: [...] }`. Voir [`shared/src/algorithms/validate-graph.ts`](shared/src/algorithms/validate-graph.ts) pour la liste exhaustive des codes (incl. `no_path_start_to_end`, `unreachable_node`, `duplicate_source_handle`, `invalid_source_handle_for_simple/multi`, `cycle`, `incomplete_status_coverage`, …).

## Design system

Référence visuelle et d'interaction : [`design-system/MASTER.md`](design-system/MASTER.md). Tokens (couleurs, typographie Inter, spacing 4/8 pt, motion, radius, élévation) et règles d'accessibilité (WCAG AA+, focus rings, contrast pairs). Le frontend implémente la quasi-totalité du DS — voir `frontend/src/styles/tokens.css` et `frontend/src/styles/globals.css`.

## Limites assumées (hors scope MVP)

- Pas d'authentification (mono-utilisateur).
- Pas d'envoi réel de message (simulation uniquement).
- Pas de versioning des workflows (soft-delete sans restauration UI).
- Pas de dark mode (tokens DS §3.6 prêts, à activer via `:root[data-theme="dark"]`).
- Pas de localisation (français only ; les codes API restent en anglais pour rester I18n-compatibles).
- SQLite en dev — migration Postgres possible via changement du `provider` Prisma.

## Auteur

Mini-projet technique préalable à l'entretien final RainPath (Mai 2026). Conçu avec un soin particulier sur la séparation front/back/shared, les tests, et la cohérence visuelle DS-driven.
