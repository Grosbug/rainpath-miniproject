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

| Outil | Version minimum | Installation |
|---|---|---|
| **Git** | récent | [git-scm.com](https://git-scm.com/) |
| **Node.js** | ≥ 20.0 (LTS recommandé) | [nodejs.org](https://nodejs.org/) ou `nvm install 20` |
| **pnpm** | ≥ 9.0 (verrouillé à `9.0.0` dans le repo) | `corepack enable` puis `corepack prepare pnpm@9.0.0 --activate` |

Le monorepo déclare aussi `engines` dans le `package.json` racine : Node ≥ 20 et pnpm ≥ 9.

**Packages du workspace** (installés ensemble via pnpm à la racine) :

| Package | Rôle |
|---|---|
| `@rainpath/shared` | Schémas Zod + algorithmes (compilé en `shared/dist/`) |
| `@rainpath/backend` | API NestJS 10 + Prisma 6 |
| `@rainpath/frontend` | SPA Vite + React 18 |

---

## Installation des dépendances

Depuis la racine du dépôt :

```bash
git clone <url-du-repo>
cd rainpath-miniproject   # adapter au nom du dossier cloné

# Installer toutes les dépendances des workspaces (shared, backend, frontend)
pnpm install
```

Ensuite, **générer le client Prisma** (obligatoire avant le premier build ou démarrage du backend — le client n’est pas versionné) :

```bash
pnpm --filter @rainpath/backend prisma:generate
```

> **Pourquoi ?** `@prisma/client` s’appuie sur du code généré à partir de `backend/prisma/schema.prisma`. Sans `prisma generate`, `nest build` ou `start:prod` échouent avec des erreurs de types ou de module manquant.

---

## Configuration (variables d’environnement)

### Backend — `backend/.env`

Copier le modèle fourni :

```bash
cp backend/.env.example backend/.env
```

| Variable | Obligatoire | Exemple | Description |
|---|---|---|---|
| `DATABASE_URL` | oui | `file:./dev.db` | URL Prisma ([doc connection URLs](https://www.prisma.io/docs/reference/database-reference/connection-urls)). En SQLite, le chemin est **relatif au répertoire de travail du processus backend** (souvent `backend/` quand on utilise les scripts pnpm du package). |

Le fichier `.env` est ignoré par git ; ne jamais committer de secrets.

### Frontend — build (optionnel)

| Variable | Quand | Exemple | Description |
|---|---|---|---|
| `VITE_API_BASE_URL` | build Vite (`pnpm build`) | `https://api.example.com/api` | URL de base des appels API. Par défaut : `/api` (même origine ou reverse-proxy). Voir `frontend/src/api/client.ts`. |

En **développement**, le proxy Vite redirige déjà `/api` vers `http://localhost:3000` — aucune variable nécessaire.

---

## Prisma — base de données, migrations et seed

Schéma : `backend/prisma/schema.prisma` (SQLite par défaut). Migrations versionnées : `backend/prisma/migrations/`.

| Migration | Contenu |
|---|---|
| `20260529070202_init` | Tables `Workflow`, `NodeTemplate`, `PatientProfile`, `PatientRun` |
| `20260529160000_patient_run_focused_node` | Colonne `focusedNodeId` sur `PatientRun` |

### Commandes (via pnpm, depuis la racine)

| Commande | Usage | Effet |
|---|---|---|
| `pnpm --filter @rainpath/backend prisma:generate` | Après `pnpm install` ou changement de schéma | Régénère `@prisma/client` |
| `pnpm --filter @rainpath/backend prisma:migrate` | **Développement uniquement** | `prisma migrate dev` : applique les migrations, peut créer une nouvelle migration si le schéma a changé |
| `pnpm --filter @rainpath/backend exec prisma migrate deploy` | **Production / CI / staging** | Applique **uniquement** les migrations déjà commitées, sans en créer de nouvelles |
| `pnpm --filter @rainpath/backend prisma:seed` | Démo / premier lancement local | Exécute `backend/prisma/seed.ts` (workflows, modèles de nœuds, profils et parcours de démo) |

Équivalent en se plaçant dans `backend/` (avec `.env` présent) :

```bash
cd backend
pnpm exec prisma generate
pnpm exec prisma migrate dev      # dev
pnpm exec prisma migrate deploy   # prod
pnpm exec prisma db seed          # seed (configuré dans package.json → tsx prisma/seed.ts)
```

### Premier lancement en local (base vide)

```bash
cp backend/.env.example backend/.env
pnpm --filter @rainpath/backend prisma:generate
pnpm --filter @rainpath/backend prisma:migrate   # crée backend/dev.db + tables
pnpm --filter @rainpath/backend prisma:seed      # données de démo (optionnel mais recommandé)
```

Fichier SQLite créé : `backend/dev.db` (ignoré par git). Journaux WAL éventuels : `backend/dev.db-journal`.

### Déploiement — appliquer le schéma en production

Ordre recommandé **à chaque déploiement** qui inclut de nouvelles migrations :

1. Définir `DATABASE_URL` sur l’environnement cible (fichier `.env`, secrets du PaaS, etc.).
2. Installer les dépendances et builder l’application (voir section suivante).
3. **Avant** de démarrer le serveur Nest :

```bash
pnpm --filter @rainpath/backend prisma:generate
pnpm --filter @rainpath/backend exec prisma migrate deploy
```

4. Démarrer le backend : `pnpm --filter @rainpath/backend start:prod`.

> **Ne pas** utiliser `prisma migrate dev` en production : cette commande est interactive, peut proposer de créer des migrations et n’est pas faite pour les pipelines de déploiement.

**Seed en production** : `prisma:seed` est utile pour une démo ou un environnement de recette. Sur une base déjà peuplée, il peut créer des doublons — à n’exécuter qu’une fois ou à désactiver en prod.

### Modifier le schéma (développeurs)

1. Éditer `backend/prisma/schema.prisma`.
2. `pnpm --filter @rainpath/backend prisma:migrate` — Prisma génère un dossier sous `prisma/migrations/` ; **committer** ce dossier avec le code.
3. `pnpm --filter @rainpath/backend prisma:generate` si le client n’a pas été régénéré automatiquement.
4. Les autres environnements appliquent la nouvelle migration via `migrate deploy`.

### Passer à PostgreSQL ou MySQL

1. Changer `provider` et `url` dans `backend/prisma/schema.prisma` et `backend/prisma/migrations/migration_lock.toml` (ou repartir d’un historique de migrations adapté au SGBD cible).
2. Mettre à jour `DATABASE_URL` (ex. `postgresql://user:pass@host:5432/rainpath?schema=public`).
3. En dev : `prisma migrate dev` ; en prod : `prisma migrate deploy`.
4. Réexécuter `prisma:generate` après tout changement de provider.

Le service Nest `PrismaService` se connecte au démarrage du module (`$connect` dans `onModuleInit`).

---

## Démarrage en local (mode développement)

```bash
# Prérequis : pnpm install, backend/.env, prisma:generate, prisma:migrate (et seed optionnel)
pnpm dev
```

`pnpm dev` lance en parallèle :

- `shared` — `tsc -w`
- `backend` — `nest start --watch` (port **3000**, préfixe global `/api`)
- `frontend` — Vite (port **5173**, proxy `/api` → backend)

URLs :

- **API** → [http://localhost:3000/api](http://localhost:3000/api)
- **Application** → [http://localhost:5173](http://localhost:5173)

Lancer un seul package si besoin :

```bash
pnpm dev:shared
pnpm dev:backend
pnpm dev:frontend
```

---

## Build, déploiement et lancement du serveur

### 1. Build de production

```bash
pnpm install
pnpm --filter @rainpath/backend prisma:generate
pnpm build
```

`pnpm build` enchaîne le build des trois packages (`shared` → `tsc`, `backend` → `nest build`, `frontend` → `tsc` + `vite build`).

Artefacts :

- `shared/dist/`
- `backend/dist/` (point d’entrée `dist/main.js`)
- `frontend/dist/` (assets statiques)

Pour un frontend hébergé séparément, builder avec l’URL d’API cible :

```bash
VITE_API_BASE_URL=https://votre-api.example.com/api pnpm --filter @rainpath/frontend build
```

### 2. Migrations base de données (production)

```bash
# DATABASE_URL doit être défini (backend/.env ou variable d'environnement système)
pnpm --filter @rainpath/backend exec prisma migrate deploy
```

### 3. Démarrer le backend

```bash
pnpm --filter @rainpath/backend start:prod
```

Écoute par défaut sur le port **3000** (`backend/src/main.ts`). Le processus charge `dotenv` depuis `backend/.env` si présent.

Vérification rapide : `curl http://localhost:3000/api/workflows`

### 4. Servir le frontend

**Option A — preview Vite (test local du build)**

```bash
pnpm --filter @rainpath/frontend preview   # http://localhost:4173
```

Sans reverse-proxy, configurer le preview pour proxy `/api` ou utiliser `VITE_API_BASE_URL` pointant vers le backend.

**Option B — serveur statique + reverse-proxy (recommandé en prod)**

Servir `frontend/dist/` (nginx, Caddy, S3 + CloudFront, etc.) et router `/api` vers le backend Nest.

Exemple nginx (schéma) :

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:3000/api/;
}
location / {
  root /chemin/vers/frontend/dist;
  try_files $uri $uri/ /index.html;
}
```

### Checklist déploiement complet

| Étape | Commande / action |
|---|---|
| 1 | `pnpm install` |
| 2 | `cp backend/.env.example backend/.env` et renseigner `DATABASE_URL` |
| 3 | `pnpm --filter @rainpath/backend prisma:generate` |
| 4 | `pnpm build` (+ `VITE_API_BASE_URL` si frontend distant) |
| 5 | `pnpm --filter @rainpath/backend exec prisma migrate deploy` |
| 6 | (optionnel) `pnpm --filter @rainpath/backend prisma:seed` |
| 7 | `pnpm --filter @rainpath/backend start:prod` |
| 8 | Publier `frontend/dist/` derrière un reverse-proxy |

### Notes de déploiement

- **CORS** : en l’état, le backend n’autorise que `http://localhost:5173` (`backend/src/main.ts`). Pour un domaine de prod, adapter `enableCors({ origin: ... })` ou placer front et API derrière le même domaine via le proxy.
- **SQLite en prod** : possible pour une démo mono-instance ; prévoir un volume persistant pour `dev.db` (ou le chemin configuré dans `DATABASE_URL`). Pour la haute dispo, migrer vers PostgreSQL (voir Prisma ci-dessus).
- **Pas d’authentification** : mono-utilisateur. Un déploiement public doit ajouter une couche d’auth (cf. Limites assumées).
- **Soft delete** : les enregistrements ont `deletedAt` ; une purge physique reste à implémenter pour un usage prod long terme.

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
| `pnpm install` | Installe les dépendances de tous les workspaces |
| `pnpm dev` | Lance shared (tsc --watch), backend (nest --watch), frontend (vite) en parallèle |
| `pnpm build` | Build production des 3 packages |
| `pnpm test` | Suites unitaires partagées + backend + frontend |
| `pnpm --filter @rainpath/backend prisma:generate` | Régénère le client Prisma (après install ou changement de schéma) |
| `pnpm --filter @rainpath/backend prisma:migrate` | **Dev** : `migrate dev` — applique et peut créer des migrations |
| `pnpm --filter @rainpath/backend exec prisma migrate deploy` | **Prod** : applique les migrations commitées sans en créer |
| `pnpm --filter @rainpath/backend prisma:seed` | Peuple la DB avec un jeu de démo (`backend/prisma/seed.ts`) |
| `pnpm --filter @rainpath/backend start:prod` | Lance l’API compilée (`node dist/main`, port 3000) |
| `pnpm --filter @rainpath/frontend preview` | Sert le build frontend en local (port 4173) |
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
