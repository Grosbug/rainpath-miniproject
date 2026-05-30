# RainPath — Éditeur visuel de workflows de relance patient

Mini-application web qui permet à un chef de laboratoire d'anatomopathologie de **dessiner**, **persister** et **simuler** un workflow de relance patient, avec axe temporel contraignant (X = jour d'exécution depuis l'examen).

![](https://img.shields.io/badge/frontend-Vite_5_·_React_18_·_TS-blue) ![](https://img.shields.io/badge/backend-NestJS_10_·_Prisma_6-red) ![](https://img.shields.io/badge/shared-Zod_·_TypeScript-violet) ![](https://img.shields.io/badge/tests-196-brightgreen)

---

## 🚀 Démarrage rapide

**Prérequis** : Node.js ≥ 20 (LTS). `pnpm` est détecté s'il est déjà installé, sinon bootstrappé via Corepack — sinon le Makefile imprime les options d'install.

### Avec `make` (recommandé)

```bash
make up
```

Enchaîne : check Node + pnpm → `pnpm install` → `cp backend/.env.example backend/.env` → `prisma generate` / `migrate` / `seed` → `pnpm dev`. Toutes les étapes sont idempotentes : `make up` re-tourne en toute sécurité. Voir `make help` pour les targets granulaires (`setup`, `dev`, `seed`, `reset`, …).

### Manuellement

```bash
# 1. Installer les dépendances du monorepo
pnpm install

# 2. Configurer le backend
cp backend/.env.example backend/.env

# 3. Préparer la base de données (SQLite locale)
pnpm --filter @rainpath/backend prisma:generate
pnpm --filter @rainpath/backend prisma:migrate
pnpm --filter @rainpath/backend prisma:seed   # données de démo (recommandé)

# 4. Lancer l'application (shared + backend + frontend en parallèle)
pnpm dev
```

Ouvrir [http://localhost:5173](http://localhost:5173) — l'API tourne sur [http://localhost:3000/api](http://localhost:3000/api) (proxy Vite automatique).

> **Astuce** : pour lancer un seul package, utiliser `pnpm dev:shared`, `pnpm dev:backend` ou `pnpm dev:frontend`.

---

## 🎬 Aperçu fonctionnel

1. **Éditeur de workflow** (`/workflows/:id`) — canvas React Flow, axe temporel adaptatif, drag + snap au jour, click-to-connect avec state machine custom, palette drag-and-drop, undo/redo, auto-save débouncé, badge de validité avec détail en popover.
2. **Vue patient** (`/workflows/:id/patient-runs/:runId`) — canvas read-only avec lanes calculées, état des nœuds (visité / courant / accessible / bloqué) recalculé en live, simulateur J+N, historique daté.
3. **Validation continue** — `validateGraph` après chaque mutation, erreurs surfacées en toasts ancrés au curseur et synthèse dans le `ValidationStatusBadge`.

---

## 📦 Structure du monorepo

```
rainpath-mini-project/
├── shared/        # @rainpath/shared — Zod schemas + algos purs (source de vérité)
├── backend/       # @rainpath/backend — NestJS 10 + Prisma 6 + SQLite
├── frontend/      # @rainpath/frontend — Vite + React 18 + React Flow + Zustand
├── design-system/ # MASTER.md (tokens, composants, a11y)
└── docs/          # architecture, specs, plans d'implémentation
```

**Vue détaillée de l'architecture** : [`docs/architecture.md`](docs/architecture.md).

---

## 🛠 Scripts utiles

| Commande | Description |
|---|---|
| `pnpm install` | Installe toutes les dépendances |
| `pnpm dev` | Lance shared + backend + frontend en parallèle (mode watch) |
| `pnpm build` | Build production des 3 packages |
| `pnpm test` | Lance toutes les suites (shared + backend unit + frontend) |
| `pnpm lint` | ESLint sur les 3 packages |
| `pnpm --filter @rainpath/backend prisma:generate` | Régénère le client Prisma |
| `pnpm --filter @rainpath/backend prisma:migrate` | **Dev** : `migrate dev` (applique/crée des migrations) |
| `pnpm --filter @rainpath/backend prisma:seed` | Peuple la DB avec un jeu de démo |
| `pnpm --filter @rainpath/backend exec prisma migrate deploy` | **Prod** : applique les migrations commitées |
| `pnpm --filter @rainpath/backend start:prod` | Lance l'API compilée (port 3000) |
| `pnpm --filter @rainpath/frontend preview` | Sert le build frontend en local (port 4173) |
| `pnpm --filter @rainpath/backend test:e2e` | Tests e2e backend (SQLite éphémère) |

---

## ⚙️ Configuration

### Backend — `backend/.env`

| Variable | Obligatoire | Exemple | Description |
|---|---|---|---|
| `DATABASE_URL` | oui | `file:./dev.db` | URL Prisma. En SQLite, chemin **relatif au répertoire backend**. |

### Frontend — build (optionnel)

| Variable | Quand | Exemple | Description |
|---|---|---|---|
| `VITE_API_BASE_URL` | build Vite | `https://api.example.com/api` | URL de base des appels API. Par défaut : `/api`. |

En **dev**, le proxy Vite redirige `/api` vers `http://localhost:3000` — aucune variable nécessaire.

---

## 🏗 Build & déploiement

```bash
# 1. Installer + générer le client Prisma + builder
pnpm install
pnpm --filter @rainpath/backend prisma:generate
pnpm build
# (frontend distant) VITE_API_BASE_URL=https://api.example.com/api pnpm --filter @rainpath/frontend build

# 2. Appliquer les migrations sur la DB cible
pnpm --filter @rainpath/backend exec prisma migrate deploy

# 3. Démarrer l'API (port 3000)
pnpm --filter @rainpath/backend start:prod

# 4. Servir frontend/dist/ derrière un reverse-proxy qui route /api vers le backend
```

**Artefacts** : `shared/dist/`, `backend/dist/main.js`, `frontend/dist/`.

**Exemple nginx** :

```nginx
location /api/ { proxy_pass http://127.0.0.1:3000/api/; }
location /     { root /chemin/vers/frontend/dist; try_files $uri $uri/ /index.html; }
```

**Notes** :
- **CORS** : le backend n'autorise que `http://localhost:5173` par défaut (`backend/src/main.ts`) — adapter `enableCors({ origin: ... })` pour la prod.
- **SQLite en prod** : OK pour une démo mono-instance avec volume persistant ; pour la haute dispo, basculer en PostgreSQL via le `provider` Prisma.
- Ne **jamais** utiliser `prisma migrate dev` en prod (interactif, peut créer des migrations).

---

## 🧪 Tests

| Stack | Runner | Specs | Couverture |
|---|---|---|---|
| `shared/` (algos purs) | Vitest | **78** | `computeXPositions`, `computeReachability`, `validateGraph`, `simulate*`, schémas Zod |
| `backend/` unit | Jest | **39** | services, pipe Zod, `advance.ts` |
| `backend/` e2e | Jest + Supertest | **27** | suites end-to-end sur toutes les routes `/api/*` |
| `frontend/` | Vitest + RTL | **52** | API clients, store Zustand, `validateConnection`, `WorkflowsList` |

**Total : 196 tests.** Lancer avec `pnpm test`.

---

## 🔌 Contrat API

| Méthode | Route | Description |
|---|---|---|
| `GET / POST` | `/api/workflows` | Liste / création (avec flag `isValid`) |
| `GET / PATCH / DELETE` | `/api/workflows/:id` | Détail (graph + validationErrors) / patch / soft delete |
| `POST` | `/api/workflows/:id/duplicate` | Dupliquer |
| `GET / POST / PATCH / DELETE` | `/api/node-templates[/:id]` | CRUD modèles de nœuds |
| `GET / POST / PATCH / DELETE` | `/api/patient-profiles[/:id]` | CRUD profils patients |
| `GET` | `/api/patient-profiles/:id/patient-runs` | Parcours d'un patient |
| `GET / POST` | `/api/workflows/:id/patient-runs` | Liste / création d'un parcours |
| `GET` | `/api/patient-runs/:id` | Détail (workflow + patient + history) |
| `POST` | `/api/patient-runs/:id/advance` | Avancer (`outcome?`) |
| `POST` | `/api/patient-runs/:id/reset` | Réinitialiser au start |

**Format d'erreur 422** : `{ statusCode: 422, errors: [{ code, message, path?, nodeId?, edgeId? }], warnings: [...] }`. Codes exhaustifs dans [`shared/src/algorithms/validate-graph.ts`](shared/src/algorithms/validate-graph.ts).

---

## 🎯 Choix techniques structurants

- **Axe temporel contraignant** : X = jour d'exécution. La temporisation est **portée par l'arête** (`edge.daysAfter`) — pas de nœud `delay` dédié.
- **JSON blob + Zod** : `Workflow.graph` et `PatientProfile.address` stockés en colonnes `String` JSON-encodées ; validation rigoureuse dans `shared/`.
- **Monorepo pnpm + `@rainpath/shared`** : types, schémas Zod et algorithmes critiques consommés par backend ET frontend.
- **2 modes de sortie pour les nœuds d'envoi** (`simple` / `multi`) : reflète l'observabilité réelle des canaux (email riche vs postal pauvre).
- **State machine custom pour les arêtes** : `useClickConnection` + `validateConnection` (cycle / unreachable / handle_conflict / …) — supporte la reconnexion non-destructive.
- **Validation en couches** : préventive (hover handle vert/rouge) → commit (rejet typé + toast ancré) → continue (`validateGraph` + `ValidationStatusBadge`).
- **Soft delete par défaut** : approprié au contexte (audit, traçabilité, droit à l'oubli RGPD).
- **Auto-save débouncé (1.5 s)** + retry exponentiel + gate de validation + hash-dedup.
- **Design system** : tokens (Inter, spacing 4/8 pt, motion, radius) et règles WCAG AA+ dans [`design-system/MASTER.md`](design-system/MASTER.md), implémentés dans `frontend/src/styles/tokens.css`.

---

## ⚠️ Limites assumées (hors scope MVP)

- Pas d'authentification (mono-utilisateur).
- Pas d'envoi réel de message (simulation uniquement).
- Pas de versioning des workflows (soft-delete sans restauration UI).
- Pas de dark mode (tokens DS prêts, à activer via `:root[data-theme="dark"]`).
- Pas de localisation (français only ; codes API en anglais).
- SQLite en dev — migration Postgres possible via changement du `provider` Prisma.

---

## 👤 Auteur

Mini-projet technique préalable à l'entretien final RainPath (Mai 2026). Conçu avec un soin particulier sur la séparation front/back/shared, les tests, et la cohérence visuelle DS-driven.
