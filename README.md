# RainPath — Mini-projet technique

Mini-application web qui permet à un chef de laboratoire d'anatomopathologie de **dessiner**, **persister** et **recharger** un workflow visuel de relance patient (style n8n / Zapier), avec axe temporel contraignant (X = jour depuis l'examen).

## Documentation

- **Spec** : [`docs/superpowers/specs/2026-05-28-rainpath-workflow-editor-design.md`](docs/superpowers/specs/2026-05-28-rainpath-workflow-editor-design.md)
- **Design System** : [`design-system/MASTER.md`](design-system/MASTER.md)
- **Plans d'implémentation** : [`docs/superpowers/plans/`](docs/superpowers/plans/)

## Stack

- **Frontend** : Vite 5, React 18, TypeScript 5, React Flow, Zustand, Radix UI, Lucide, Framer Motion, Tailwind v3
- **Backend** : NestJS 10, Prisma 5, SQLite, Zod
- **Shared** : TypeScript dual mode (Zod schemas + algorithms réutilisés des deux côtés)
- **Monorepo** : pnpm workspaces

## Prérequis

- Node.js ≥ 20
- pnpm ≥ 9 (`corepack enable pnpm` ou `npm install -g pnpm`)

## Démarrage

```bash
# 1. installer toutes les dépendances
pnpm install

# 2. générer la BDD SQLite + seed (8 modèles + 1 workflow exemple)
pnpm --filter @rainpath/backend prisma:migrate
pnpm --filter @rainpath/backend prisma:seed

# 3. lancer les 3 packages en parallèle (shared en watch, backend, frontend)
pnpm dev
```

Le backend écoute sur `http://localhost:3000/api`, le frontend sur `http://localhost:5173`.

## Scripts utiles

| Commande | Description |
|---|---|
| `pnpm dev` | Lance shared (tsc --watch), backend (nest start --watch), frontend (vite) en parallèle |
| `pnpm build` | Build production des trois packages |
| `pnpm test` | Exécute tous les tests (Vitest sur shared + Jest sur backend) |
| `pnpm --filter @rainpath/backend prisma:migrate -- --name <name>` | Crée une nouvelle migration |
| `pnpm --filter @rainpath/backend exec prisma studio` | Ouvre Prisma Studio sur la BDD |

## Contrat API (extrait)

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/workflows` | Liste des workflows |
| `GET` | `/api/workflows/:id` | Détails d'un workflow |
| `POST` | `/api/workflows` | Créer un workflow |
| `POST` | `/api/workflows/:id/duplicate` | Dupliquer un workflow |
| `PATCH` | `/api/workflows/:id` | Mettre à jour un workflow |
| `DELETE` | `/api/workflows/:id` | Soft-delete |
| `GET/POST/PATCH/DELETE` | `/api/node-templates[/:id]` | CRUD modèles de nœuds |
| `GET/POST/PATCH/DELETE` | `/api/patient-profiles[/:id]` | (Bonus) CRUD profils patients |
| `GET/POST` | `/api/workflows/:id/patient-runs[/:id]` | (Bonus) runs patient simulés |
| `POST` | `/api/patient-runs/:id/advance` | (Bonus) avancer un run |

Voir la spec pour le détail.

## Structure du repo

```
rainpath-mini-project/
├── shared/         # Zod schemas + algorithms (computeXPositions, computeReachability, validateGraph, simulate*)
├── frontend/       # Vite + React + TS, React Flow editor
├── backend/        # NestJS + Prisma + SQLite
├── docs/           # Spec + plans
└── design-system/  # Master DS document
```
