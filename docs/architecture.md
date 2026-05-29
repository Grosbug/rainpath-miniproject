# Architecture — RainPath mini-projet

> Vue d'ensemble technique du dépôt. Décrit le découpage des packages, le contrat d'API, le modèle de données, les algorithmes partagés, la boucle d'édition front-end, et les décisions qui structurent le code.

---

## Sommaire

1. [Vue d'ensemble](#1-vue-densemble)
2. [Monorepo & résolution des packages](#2-monorepo--résolution-des-packages)
3. [Package `shared` — source de vérité](#3-package-shared--source-de-vérité)
4. [Backend — NestJS + Prisma + SQLite](#4-backend--nestjs--prisma--sqlite)
5. [Frontend — React + Vite + React Flow + Zustand](#5-frontend--react--vite--react-flow--zustand)
6. [Design system](#6-design-system)
7. [Décisions structurantes](#7-décisions-structurantes)
8. [Flux end-to-end](#8-flux-end-to-end)
9. [Tests & qualité](#9-tests--qualité)
10. [Limites & angles de discussion](#10-limites--angles-de-discussion)

---

## 1. Vue d'ensemble

RainPath est une mini-application web qui permet à un chef de laboratoire d'anatomopathologie de **dessiner**, **persister** et **simuler** un workflow de relance patient sur un canvas à axe temporel contraint.

```
┌─────────────────────────────────────────────────────────────────┐
│                       Frontend (React)                          │
│  Vite · React Flow · Zustand · TanStack Query · Tailwind        │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────┐ │
│  │ Editor canvas│  │ Patient run   │  │ Lists + CRUD dialogs │ │
│  │ + auto-save  │  │ read-only     │  │ workflows / profils  │ │
│  └──────┬───────┘  └───────┬───────┘  └──────────┬───────────┘ │
│         │ HTTP /api ▼                            │             │
└─────────┼────────────────────────────────────────┼─────────────┘
          │                                        │
┌─────────▼────────────────────────────────────────▼─────────────┐
│                       Backend (NestJS)                         │
│  Global prefix /api · ZodValidationPipe · ZodExceptionFilter   │
│  ┌──────────┐ ┌───────────────┐ ┌────────────┐ ┌────────────┐ │
│  │workflows │ │node-templates │ │patient-    │ │patient-    │ │
│  │          │ │               │ │profiles    │ │runs        │ │
│  └────┬─────┘ └───────┬───────┘ └─────┬──────┘ └─────┬──────┘ │
│       └──────────┬────┴────────┬──────┴───────┬──────┘        │
│                  ▼ Prisma ORM ▼              ▼                │
│           ┌────────────────────────────────────┐              │
│           │           SQLite (file)            │              │
│           └────────────────────────────────────┘              │
└────────────────────────────┬───────────────────────────────────┘
                             │
                             ▼ import { … } from "@rainpath/shared"
            ┌────────────────────────────────────────┐
            │            shared (Zod + algos)        │
            │  schemas/ · algorithms/                │
            │  Graph · GraphNode · GraphEdge ·       │
            │  NodeData · NodeTemplate · OutputConfig│
            │  validateGraph · computeXPositions ·   │
            │  computeReachability · simulate*       │
            └────────────────────────────────────────┘
```

- **Pas d'authentification, pas d'envoi réel** — conforme au cadrage du [brief](mini-projet-technique-rainpath.md).
- **Persistance simple** : `Workflow.graph` est stocké en blob JSON sous SQLite ; la validation rigoureuse est faite côté serveur par les schémas Zod du package `shared`.
- **Single source of truth** : tous les contrats (DTO d'API, formes du graphe, paramètres de nœud, algorithmes de layout/validation/atteignabilité) vivent dans `shared/`. Backend et frontend les importent à l'identique.

---

## 2. Monorepo & résolution des packages

### Workspace

- Gestionnaire : **pnpm 9** (déclaration `packageManager` à la racine).
- Packages déclarés dans [pnpm-workspace.yaml](../pnpm-workspace.yaml) : `shared`, `frontend`, `backend`. Le dossier `design-system/` est une référence documentaire, pas un package.
- Racine : [tsconfig.base.json](../tsconfig.base.json) (ES2022, `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `moduleResolution: Bundler`).
- Scripts root : `pnpm dev` (lance shared en watch + backend + frontend en parallèle), `pnpm build`, `pnpm test`, `pnpm lint`.

### Comment `shared` est consommé

| Cible | Mécanisme | Détail |
|---|---|---|
| **Backend** (runtime + tests) | Workspace pnpm + Jest `moduleNameMapper` | Le mapping pointe vers `../../shared/src/index.ts` directement (source TS), évite le besoin de builder `shared` avant de tester. |
| **Frontend dev** | Alias Vite `@rainpath/shared` → `../shared/src` | Import direct de la source pour HMR. |
| **Frontend prod** | Workspace pnpm | Resolved via `"workspace:*"`. |
| **Frontend tests** (Vitest) | Même alias Vite | Mocks possibles via `vi.mock`. |
| **TS check global** | Path aliases dans les `tsconfig.json` | Types importables sans build préalable. |

Conséquence : **un changement dans une schema Zod de `shared` casse immédiatement la compilation des deux autres packages** — c'est le mécanisme qui rend le contrat tenace.

---

## 3. Package `shared` — source de vérité

[shared/](../shared/) contient ce qui ne peut pas dériver : schémas Zod, types dérivés, algorithmes purs sur le graphe.

### Schémas Zod ([shared/src/schemas/](../shared/src/schemas/))

| Fichier | Exporte | Rôle |
|---|---|---|
| `primitives.ts` | `Position`, `GraphNode`, `GraphEdge`, `Graph` | Forme du graphe stocké. Point clé : `GraphEdge.daysAfter: z.number().int().min(0)`. |
| `node-data.ts` | `NodeData` (union discriminée), `EmailParams`, `SmsParams`, `WhatsAppParams`, `PostalParams` | Paramètres typés par famille de nœud. Le `kind = 'condition'` historique a été retiré ; les branchements passent désormais par les sorties multi des nœuds d'envoi. |
| `node-template.ts` | `NodeTemplate`, `NodeTemplateBody` | Modèles réutilisables (palette éditeur). |
| `api-dtos.ts` | `Create*Dto`, `Update*Dto`, `DuplicateWorkflowDto`, `AdvancePatientRunDto`, … | DTO partagés frontend ↔ backend. |
| `output-config.ts` | `OutputConfig` (`single` / `simple` / `multi`) | Mode de sortie d'un nœud d'envoi — détermine le `sourceHandle` des arêtes. |
| `channels.ts` | `CHANNEL_STATUSES` | Statuts observables par canal (email = riche, postal non tracké = aveugle). |
| `format.ts` | `CHANNEL_FORMAT_RULES` | Limites de taille / format par canal (SMS unicode, HTML, etc.). |
| `constants.ts` | `START_Y = 200` | Constante de layout. |

### Algorithmes ([shared/src/algorithms/](../shared/src/algorithms/))

Tous **purs**, sans I/O, testés en isolation côté `shared/tests/`.

| Fonction | Signature | Rôle |
|---|---|---|
| `computeXPositions` | `(graph, existingX?) → Map<nodeId, number>` | Ancre le nœud `start` à `X=0` puis propage `X(target) = max(X(source) + edge.daysAfter)` via tri topo Kahn. Détecte les cycles. Préserve les X des orphelins via `existingX`. |
| `validateGraph` | `(graph) → { errors, warnings }` | Règles structurelles : un seul `start`, au moins une `end`, pas de self-loop, pas d'arête entrant dans `start` ni sortant de `end`. Valide les `OutputConfig` vs statuts canaux. Détecte cycles. Messages en français. |
| `computeReachability` | `(graph, patientProfile, currentNodeId, history) → Map<nodeId, "visited" \| "current" \| "reachable" \| "blocked" \| "unreachable">` | Propage l'atteignabilité depuis `current` en suivant toutes les sorties d'un nœud non-terminal (le simulateur décidera de la branche réellement empruntée). Le profil patient reste passé pour les futures extensions ; aujourd'hui seules les sorties `success/failure` ou multi-output portent l'aiguillage. |
| `simulateAddEdge` / `simulateChangeDaysAfter` / `simulateRemoveEdge` | `(graph, …) → { cycle?, newX, shifts }` | Permet à l'éditeur de **prévisualiser** l'effet d'une mutation (déplacement de nœuds en X) avant de la committer dans le store Zustand. |

### Index

[shared/src/index.ts](../shared/src/index.ts) re-exporte tout. Backend et frontend importent uniquement via `@rainpath/shared`.

---

## 4. Backend — NestJS + Prisma + SQLite

### Bootstrap

[backend/src/main.ts](../backend/src/main.ts) :

- `NestFactory.create(AppModule)`
- **Préfixe global** `api`
- **CORS** : `http://localhost:5173`
- **Filter global** : `ZodExceptionFilter` → enveloppe d'erreur canonique (voir plus bas)
- Limite body : 1 MB

[backend/src/app.module.ts](../backend/src/app.module.ts) compose : `PrismaModule`, `WorkflowsModule`, `NodeTemplatesModule`, `PatientProfilesModule`, `PatientRunsModule`.

### Modèle de données ([backend/prisma/schema.prisma](../backend/prisma/schema.prisma))

| Modèle | Champs notables | Relations | Soft delete |
|---|---|---|---|
| `Workflow` | `id (cuid)`, `name`, `description`, `graph (String, JSON encodé)`, `createdAt`, `updatedAt`, `deletedAt` | 1-N → `PatientRun` | `deletedAt` indexé |
| `NodeTemplate` | `id`, `name`, `description`, `kind (string)`, `params (String, JSON)` | — | `deletedAt` indexé |
| `PatientProfile` | `id`, `name`, `email?`, `phone?`, `whatsapp?`, `address?` | 1-N → `PatientRun` | `deletedAt` indexé |
| `PatientRun` | `id`, `workflowId (FK Restrict)`, `patientId (FK Restrict)`, `currentNodeId?`, `history (String, JSON)` | N-1 → Workflow, N-1 → PatientProfile | `deletedAt` indexé |

- **Cuid2** pour les IDs (`@paralleldrive/cuid2`).
- **JSON-as-string** : `graph`, `params`, `history` sont stockés en colonne `String`. La forme typée est imposée par Zod à la frontière (entrée + sortie).
- **`onDelete: Restrict`** : impossible de supprimer dur un Workflow ou un Patient référencé par une run — soft delete obligatoire.
- Une seule migration : [20260528150628_init/](../backend/prisma/migrations/).

### Modules feature

Chacun suit le pattern Nest classique : Controller → Service → Prisma. Le service applique la validation Zod du graphe avant écriture.

| Module | Routes | Méthodes service notables |
|---|---|---|
| **WorkflowsModule** ([workflows/](../backend/src/workflows/)) | `GET/POST /workflows`, `GET/PATCH/DELETE /workflows/:id`, `POST /workflows/:id/duplicate` | `list`, `get` (decode + validate, retourne warnings), `create`, `update` (re-valide si `graph` fourni), `duplicate`, `softDelete`. Encode/décode via [graph-codec.ts](../backend/src/workflows/graph-codec.ts). |
| **NodeTemplatesModule** ([node-templates/](../backend/src/node-templates/)) | CRUD `/node-templates` | Mêmes opérations standards. |
| **PatientProfilesModule** ([patient-profiles/](../backend/src/patient-profiles/)) | CRUD `/patient-profiles` | Idem. |
| **PatientRunsModule** ([patient-runs/](../backend/src/patient-runs/)) | `GET/POST /workflows/:workflowId/patient-runs`, `GET /patient-runs/:id`, `POST /patient-runs/:id/advance`, `POST /patient-runs/:id/reset` | `advance` ([advance.ts](../backend/src/patient-runs/advance.ts)) applique la logique d'avancement nœud → nœud en s'appuyant sur l'`OutputConfig` du nœud courant (handle `success`/`failure` en mode simple, handle nommé en mode multi). |
| **PrismaModule** ([prisma/](../backend/src/prisma/)) | — | `PrismaService` + helper `buildSoftDeleteClient` qui filtre `deletedAt IS NULL` partout par défaut. |

### Validation & enveloppe d'erreur

[backend/src/validation/](../backend/src/validation/) :

- `ZodValidationPipe<T>` — pipe Nest générique : `schema.safeParse(value)`, throw `BadRequestException` si KO. Utilisé sur chaque body de controller : `@Body(new ZodValidationPipe(CreateWorkflowDto))`.
- `GraphValidationError` — erreur custom levée par le service quand `validateGraph(graph)` retourne des `errors`.
- `ZodExceptionFilter` — global ; produit l'enveloppe **422** :

```jsonc
{
  "statusCode": 422,
  "errors": [
    { "code": "missing_start", "message": "Le workflow doit avoir un nœud de départ", "nodeId": null }
  ],
  "warnings": [
    { "code": "uncovered_status", "message": "Statut « rejected » non couvert", "nodeId": "n_abc" }
  ]
}
```

- `format-zod-error.ts` aplatit les `ZodIssue` en `{ code, message, path }`.
- Les **warnings** ne bloquent pas : un workflow peut être sauvegardé avec warnings (le frontend les affiche en bannière), seuls les `errors` provoquent 422.

### Contrat d'API

| Méthode | Route | Body | Réponse |
|---|---|---|---|
| `GET` | `/api/workflows` | — | `WorkflowListItem[]` |
| `POST` | `/api/workflows` | `CreateWorkflowDto` | `WorkflowDetail` |
| `GET` | `/api/workflows/:id` | — | `WorkflowDetail` (graph décodé) |
| `PATCH` | `/api/workflows/:id` | `UpdateWorkflowDto` | `WorkflowDetail` |
| `DELETE` | `/api/workflows/:id` | — | 204 |
| `POST` | `/api/workflows/:id/duplicate` | `DuplicateWorkflowDto` | `WorkflowDetail` |
| `GET/POST/PATCH/DELETE` | `/api/node-templates[/:id]` | shared DTO | `NodeTemplate` |
| `GET/POST/PATCH/DELETE` | `/api/patient-profiles[/:id]` | shared DTO | `PatientProfile` |
| `GET` | `/api/workflows/:workflowId/patient-runs` | — | `PatientRun[]` |
| `POST` | `/api/workflows/:workflowId/patient-runs` | `CreatePatientRunDto` | `PatientRun` |
| `GET` | `/api/patient-runs/:id` | — | `PatientRunDetail` |
| `POST` | `/api/patient-runs/:id/advance` | `AdvancePatientRunDto` | `PatientRunDetail` |
| `POST` | `/api/patient-runs/:id/reset` | — | `PatientRunDetail` |

Toute erreur de validation (DTO ou graphe) renvoie l'enveloppe 422 décrite plus haut.

---

## 5. Frontend — React + Vite + React Flow + Zustand

### Stack

[frontend/package.json](../frontend/package.json) :

- React 18.3 · TypeScript · Vite 5.3
- **Canvas** : [`@xyflow/react`](https://reactflow.dev/) 12.3 (anciennement React Flow)
- **State graphe** : Zustand 4.5 (avec middleware d'historique pour undo/redo)
- **Data fetching** : TanStack Query 5.59 (`staleTime: 30s`, `retry: 1`)
- **Routing** : React Router 6.26
- **Style** : Tailwind 3.4 + tokens CSS issus du design system
- **UI primitives** : Radix UI · lucide-react · sonner (toasts) · @floating-ui/react

### Routing ([frontend/src/router.tsx](../frontend/src/router.tsx))

```
/                                          → redirect /workflows
/workflows                                 → WorkflowsList (table + dialogs CRUD)
/workflows/:id                             → WorkflowEditor (canvas)
/patient-profiles                          → PatientProfilesList
/workflows/:id/patient-runs                → PatientRunsList
/workflows/:id/patient-runs/:runId         → PatientRunView (read-only canvas)
*                                          → NotFound
```

Le shell [AppLayout](../frontend/src/components/AppLayout.tsx) fournit la sidebar et un `<Outlet />`.

### Clients API ([frontend/src/api/](../frontend/src/api/))

- `client.ts` — wrapper `apiFetch<T>` + classe `ApiError(status, body)`. Base URL : `VITE_API_BASE_URL ?? "/api"` (proxy Vite vers `localhost:3000` en dev).
- Un fichier par ressource (`workflows.ts`, `node-templates.ts`, `patient-profiles.ts`, `patient-runs.ts`).
- **Re-validation Zod en sortie** : chaque payload qui contient un `graph` est re-parsé avec le schéma `Graph` de `shared`. En cas de drift schema ↔ payload, l'erreur lève une `ApiError(code: "response_drift")` — le contrat tient même si le backend dérive.
- `query-keys.ts` — factory de clés TanStack Query (`["workflows", id]`, etc.).

### Pages

#### `WorkflowEditor` ([pages/WorkflowEditor/](../frontend/src/pages/WorkflowEditor/))

Le cœur du produit. Architecture :

| Couche | Fichier(s) | Rôle |
|---|---|---|
| **Page** | `index.tsx` | Charge le workflow, monte le canvas + topbar + bannière + modales. |
| **Canvas** | `Canvas.tsx` | Wrapper `@xyflow/react` ; conversion logique X → pixels via `PX_PER_DAY = 28`. |
| **Background** | `TimelineBackground.tsx` | SVG : gridlines journalières, labels J+0 / J+1 / J+N, rail J+0 en vert. |
| **Nodes** | `StartNode`, `EndNode`, `SendEmailNode`, `SendSmsNode`, `SendWhatsAppNode`, `SendPostalNode` | Un composant par famille ; rendu cohérent avec le DS (couleurs `--node-{kind}-{bg,border,accent}`). |
| **Edges** | `FlowEdge.tsx`, `DaysAfterPopover.tsx` | Chip « X j » centré sur l'arête, popover numérique pour éditer `daysAfter`. |
| **Modales** | `NodeEditorModal.tsx` + un `*ParamsForm.tsx` par famille + `OutputConfigField.tsx` | Édition des paramètres d'un nœud sélectionné. |
| **Topbar** | `TopBar.tsx`, `SaveStatusBadge.tsx`, `ValidationBanner.tsx` | Nom/description, statut de sauvegarde, erreurs/warnings. |
| **Store** | `store.ts` (Zustand) | `workflowId`, `name`, `description`, `nodes`, `edges`, `saveStatus`, `validationErrors`, pile undo/redo. |
| **Snapshot** | `snapshot.ts` | `EditorSnapshot` + `hashSnapshot()` pour dédupliquer les saves. |
| **Hooks** | `useAutoSave.ts`, `useEditorShortcuts.ts`, `useWorkflowLoader.ts` | Logique transversale. |

**Boucle d'auto-save** (`useAutoSave`) :

1. Toute mutation du store met à jour `saveStatus = "dirty"`.
2. Debounce 1.5 s sans nouvelle mutation.
3. **Gate validation** : `validateGraph(graph)` ; si `errors`, on bloque (`saveStatus = "invalid"`).
4. **Hash-dedup** : si `hashSnapshot()` est identique au dernier save committed, on saute.
5. PATCH backend ; retry exponentiel sur erreur réseau (statuts ≥ 500).
6. `saveStatus = "saved"` (ou `"error" / "offline"`).

#### `PatientRunView` ([pages/PatientRunView/](../frontend/src/pages/PatientRunView/))

- `PatientCanvas.tsx` — même graphe que l'éditeur, **read-only**, chaque nœud reçoit son état issu de `computeReachability(graph, profile, currentNodeId, history)`. Le layout vertical est recalculé par `computeLanes` (les positions Y libres de l'éditeur sont ignorées au profit de couloirs : la branche succès garde le rail du parent, les autres descendent ; les nœuds orphelins atterrissent sur leurs propres rails sous la chaîne principale). Un `TodayCursor` SVG dessine un trait pointillé vertical à `dayCursor * PX_PER_DAY`.
- `PatientNode.tsx` — variante read-only avec badge d'état (`visited`, `current`, `reachable`, `blocked`, `unreachable`) et badge `J+N` (délai cumulé).
- `DayCursorControls.tsx` + `use-day-simulator.ts` — barre « Aujourd'hui J+N » avec boutons `+1 j` / `+7 j` / `Prochain événement` / retour-arrière. Le cursor est purement front (somme des `daysAfter` traversés depuis l'historique + offset utilisateur). Quand `day ≥ currentNodeDay + nextDefaultEdge.daysAfter`, un effet POST `/advance` avec l'outcome par défaut (premier `successCondition.statuses` en mode simple) et la boucle re-évalue après refetch. Pause sur multi-output et `end` — l'utilisateur choisit manuellement via `PatientAdvanceControls`.
- `PatientAdvanceControls.tsx` — bouton « Étape suivante » + sélection du statut de sortie (basé sur `CHANNEL_STATUSES`) → POST `/patient-runs/:id/advance`. Sert d'aiguillage manuel quand le simulateur est en pause.
- `PatientProfilePanel.tsx` — édition live des champs patient (déclenche un recompute reachability sans aller-retour serveur).
- `PatientHistoryList.tsx` — trace des nœuds visités, projection calendaire (`startDate + J+N`) à côté du label, statut observé.
- Helpers : `compute-lanes.ts` (assignation BFS lane-par-lane avec réservation des cellules d'arête), `cumulative-days.ts` (`dayOfHistory`, `nextDefaultEdge`, `defaultOutcomeFor`).

#### Autres pages

- `WorkflowsList` — table, dialogs create/import/delete.
- `PatientProfilesList` — CRUD profils patient.
- `PatientRunsList` — liste des parcours d'un workflow.

### Style

[frontend/src/styles/](../frontend/src/styles/) :

- `tokens.css` — toutes les CSS custom properties issues du DS (`--bg`, `--surface`, `--fg`, `--primary`, `--node-{family}-{bg|border|accent}`, etc.).
- `globals.css` — imports `tokens.css` + directives Tailwind + override `prefers-reduced-motion`.

Tailwind utilise les tokens via `theme.extend.colors = { ... "var(--primary)" ... }`.

---

## 6. Design system

[design-system/MASTER.md](../design-system/MASTER.md) est la **référence visuelle** unique. Il documente :

1. Contexte produit (admin labo, ton clinique minimal).
2. Direction design (Swiss / SaaS minimalism, micro-interactions).
3. **Tokens couleur** : neutres chromés, primaire cyan, sémantiques (succès, warning, danger), **6 familles de nœuds** (start / email / sms / whatsapp / postal / end).
4. Couleurs d'arêtes (défaut gris, succès vert, échec rouge) + chip délai centré.
5. **Axe temporel canvas** : X = jours depuis l'examen ; gridlines `--border` ; labels J+N ; rail J+0 en vert ; Y libre.
6. Typographie : Inter, échelle `--text-xs` → `--text-3xl`, chiffres tabulaires pour délais.
7. Spacing 4/8 pt, radius `--radius-{sm,md,lg}`.
8. Accessibilité : paires de contraste AAA, focus ring `--ring`, prise en charge de `prefers-reduced-motion`.
9. Catalogue composants (Button, Input, Dialog, Dropdown, Accordion, Tooltip, Form).
10. Map dark mode (objectif stretch, non livré).

`design-system/pages/` est prévu pour des overrides page-par-page (vide à ce jour).

---

## 7. Décisions structurantes

### 7.1 Axe temporel : `edge.daysAfter`, pas de nœud `delay`

**Décision** — la temporisation est portée par l'arête, pas par un nœud dédié.

**Pourquoi** — le brief évoque un nœud « attendre X jours », mais cela duplique la sémantique : un nœud de délai serait toujours suivi d'une arête, et le délai vit naturellement sur la transition. En mettant `daysAfter` sur l'arête, on obtient :

- un axe X strictement déterminé par `computeXPositions`,
- un graphe plus dense (moins de nœuds techniques),
- une UX simple : chip « X j » sur chaque arête, popover pour éditer.

**Conséquence** — l'expressivité reste équivalente : tout scénario du brief reste modélisable. Point à défendre en entretien.

### 7.2 `graph` stocké en blob JSON

**Décision** — `Workflow.graph` est une colonne `String` (JSON sérialisé), pas un schéma normalisé (table `Node` + table `Edge`).

**Pourquoi** —

- Le graphe est toujours lu/écrit **en entier** par l'UI : pas de query partielle, pas de jointure utile.
- La validation Zod est plus forte qu'un schéma SQL normalisé (`OutputConfig` discriminé, contraintes inter-champs).
- Une seule transaction d'écriture, atomicité gratuite.
- Migration ultérieure vers du normalisé reste possible si besoin (audit, full-text, requêtes analytiques).

### 7.3 Trois modes de sortie (`OutputConfig`)

`single` / `simple` / `multi` — reflète l'**observabilité réelle** de chaque canal :

| Canal | Mode typique | Pourquoi |
|---|---|---|
| Email | `multi` | sent / delivered / opened / clicked / bounced |
| SMS | `simple` (sent vs failed) | feedback binaire |
| WhatsApp | `simple` ou `multi` selon provider | varie |
| Postal non tracké | `single` | aveugle — pas de feedback |

Le `sourceHandle` des arêtes correspond à un mode, ce qui force la cohérence (validée par `validateGraph`).

### 7.4 Soft delete par défaut

`deletedAt DateTime?` sur tous les modèles, index dédié, `onDelete: Restrict` sur les FKs. Adapté au contexte anatomopathologie : **audit, traçabilité, base d'un futur droit à l'oubli RGPD**.

### 7.5 Single source of truth via `shared/`

Tous les contrats (DTO, formes du graphe, algorithmes) vivent dans `shared/`. Backend valide à l'entrée avec les **mêmes instances** Zod que le frontend utilise pour parser ses réponses. Un changement de schéma casse les deux côtés à la compilation — pas de dérive silencieuse.

### 7.6 Auto-save débouncé + validation + hash-dedup

Voir [§5 - boucle d'auto-save](#workfloweditor-pagesworkfloweditor). En résumé : **rien n'est perdu, rien n'est envoyé pour rien, rien n'est sauvé en état invalide**.

---

## 8. Flux end-to-end

### Création / édition d'un workflow

```
Utilisateur ──drag───────────┐
   │                         ▼
   │                  Zustand store
   │                  (nodes, edges, name, …)
   │                         │
   │                         ▼
   │             validateGraph(graph)  ◄─── shared
   │              ├── errors? → bannière
   │              └── ok → useAutoSave (1.5s debounce)
   │                         │
   │                         ▼
   │               hashSnapshot() = lastSaved?
   │              ├── oui → skip
   │              └── non → PATCH /api/workflows/:id
   │                         │
   │                         ▼
   │          ZodValidationPipe(UpdateWorkflowDto)
   │                         │
   │                         ▼
   │             WorkflowsService.update()
   │              ├── validateGraph (re-check serveur)
   │              ├── encodeGraph → String JSON
   │              └── prisma.workflow.update(…)
   │                         │
   │                         ▼
   │              Response WorkflowDetail
   │                         │
   │                         ▼
   │       apiFetch parse + Graph.parse (re-validate)
   │                         │
   ▼                         ▼
saveStatus = "saved"     TanStack Query cache update
```

### Avancement d'un patient run

```
PatientRunView load
   │
   ├── GET /api/workflows/:id  → graph
   ├── GET /api/patient-runs/:runId → { currentNodeId, history, patient }
   │
   ▼
computeReachability(graph, patient, currentNodeId, history)
   │
   ▼
Canvas read-only colore chaque nœud par état
   │
   ├── User édite PatientProfile (panel)
   │     └── recompute reachability LOCAL — pas d'aller-retour
   │
   ├── User clique « avancer » + choisit statut sortie
   │     └── POST /api/patient-runs/:runId/advance
   │           └── advance.ts : applique OutputConfig (handle success/failure ou multi)
   │                 └── retourne nouveau currentNodeId + history
   │
   └── User déplace le cursor jour (+1 j / +7 j / Prochain)
         └── useDaySimulator détecte day ≥ currentNodeDay + nextEdge.daysAfter
               └── POST /advance auto avec outcome par défaut (success)
                     └── refetch → la boucle re-évalue jusqu'à pause (multi-output, end)
```

---

## 9. Tests & qualité

| Package | Runner | Cible | Localisation |
|---|---|---|---|
| `shared` | Vitest | Algorithmes purs (computeXPositions, validateGraph, computeReachability, simulate*) + schémas | [shared/tests/](../shared/tests/) — 8 fichiers de specs |
| `backend` | Jest | Services unitaires + **e2e Supertest** (workflows, node-templates, patient-profiles, patient-runs) | [backend/src/**/*.spec.ts](../backend/src/) + [backend/test/](../backend/test/) |
| `frontend` | Vitest + RTL + jsdom | Clients API (mock fetch + roundtrip Zod) + store Zustand + smoke tests | [frontend/src/api/*.test.ts](../frontend/src/api/), [frontend/src/pages/WorkflowEditor/store.test.ts](../frontend/src/pages/WorkflowEditor/store.test.ts), [frontend/src/test/](../frontend/src/test/) |

Lancer :

```bash
pnpm test                                    # toute la stack
pnpm --filter @rainpath/shared test          # algorithmes seuls
pnpm --filter @rainpath/backend test         # backend unit
pnpm --filter @rainpath/backend test:e2e     # backend e2e
pnpm --filter @rainpath/frontend test        # frontend
```

---

## 10. Limites & angles de discussion

| Limite | Statut | Discussion |
|---|---|---|
| Pas d'authentification | Hors scope brief | Trivial à ajouter (Nest guard + JWT), pas de valeur démo. |
| Pas d'envoi réel | Hors scope brief | Architecture des `OutputConfig` est compatible avec providers réels (Mailgun, Twilio…). |
| Pas de versioning workflow | Choix | Soft delete fait office de filet ; full versioning = projet à part entière. |
| Pas de dark mode | Préparé, non livré | Tokens DS §10 prêts ; à brancher via `:root[data-theme="dark"]`. |
| FR uniquement | Choix | Messages Zod + UI en dur ; à i18n-iser via `react-intl` si besoin. |
| `daysAfter` sur arête | **Interprétation du brief** | À défendre en entretien : équivalent en expressivité, plus simple sémantiquement. |
| JSON blob vs schéma normalisé | **Choix structurant** | Acceptable pour la taille de graphe attendue ; à reconsidérer si analytics/audit. |
| Pas de cron d'exécution | Hors scope brief | `advance` est manuel ; le simulateur jour-par-jour (front) pilote des `/advance` successifs pour mimer un scheduler. Un vrai run = BullMQ, Temporal… |
| Retrait des nœuds **Condition** | **Écart au brief assumé** | Le brief PDF (§3) mandate les nœuds Condition (`data_available`, `previous_result`). Décision : tout l'aiguillage passe par les sorties **multi** d'un nœud d'envoi (le statut canal sert d'expression). Plus simple à modéliser, mais moins expressif que `patient.email` en l'état (la disponibilité d'un canal n'est pas testable sans tenter un envoi). À justifier en entretien. |

Pour les choix techniques détaillés et les axes d'amélioration, voir [interview-prep.md](interview-prep.md). Pour la séquence d'implémentation, voir les 8 plans dans [superpowers/plans/](superpowers/plans/).
