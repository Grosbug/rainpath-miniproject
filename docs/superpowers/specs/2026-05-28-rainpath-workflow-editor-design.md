# RainPath — Éditeur visuel de workflows de relance

**Date** : 2026-05-28
**Statut** : design validé, prêt pour planification d'implémentation
**Contexte** : mini-projet technique préalable à l'entretien final RainPath. Cf. `Mini Projet Technique RainPath.pdf`.

---

## 1. Objectif

Construire une mini-application web permettant à un chef de laboratoire d'anatomopathologie :

1. de **dessiner visuellement** un workflow de relance patient sous forme de graphe à nœuds, avec un **axe temporel contraignant** (X = jour d'exécution depuis l'examen) ;
2. de **sauvegarder** ce workflow dans une base de données via un backend dédié ;
3. de **recharger** un workflow existant pour le modifier ;
4. **(bonus)** de visualiser l'avancement simulé d'un patient fictif dans un workflow donné.

**Hors scope** (rappel PDF) : aucun envoi réel de message, pas de providers, pas d'authentification, pas de gestion d'utilisateurs.

---

## 2. Contraintes imposées

| Domaine | Contrainte |
|---|---|
| Frontend | React + TypeScript |
| Backend | NestJS |
| ORM | Prisma |
| DB | SQL (SQLite retenu) |
| API | REST minimaliste (create / list / load / update) |
| Auth | Aucune |
| Structure repo | Monorepo public, structuré (ex. `/frontend` et `/backend`) |
| Durée cible | 2-3h indicatif (projet réel estimé 3h30-4h compte tenu de l'axe temporel) |

---

## 3. Décisions de design

| Domaine | Décision | Rationale |
|---|---|---|
| Stockage du graphe | `Workflow.graph` en colonne **JSON** Prisma | Le graphe est consommé/produit comme un tout par React Flow ; éviter le boilerplate de tables Node/Edge normalisées pour un mini-projet |
| Typage des nœuds/arêtes | **Zod** + types TS partagés (`shared/`) | Validation runtime côté NestJS + types statiques côté front à partir d'une seule source |
| Validation graphe | Côté front (UX immédiate) + côté back (source de vérité) | Le back rejette tout PATCH d'un graphe invalide ; le front prévient avant |
| Versioning | Overwrite simple | Hors scope mini-projet |
| Multi-workflow | Oui (CRUD complet via UI) | Permet de démontrer le chargement multiple |
| Identification workflow | `name` + `description` | Suffisant, pas d'authent donc pas de scoping par labo |
| Bibliothèque graphe | **React Flow (xyflow)** | Standard du marché pour éditeur node-based React ; écosystème riche (custom nodes/edges/background), bonne intégration Zustand |
| State management front | **Zustand** | Recommandé par xyflow, léger, pas de boilerplate Redux |
| UX édition params nœud | **Modal** (double-click) | Plus lisible qu'un panneau latéral encombrant les params optionnels |
| Sauvegarde | **Auto-save debouncé** (1.5s) | UX moderne, évite la perte de travail, indicateur d'état visible |
| Sorties des nœuds d'envoi | 3 modes : `single` / `simple` (succès/échec avec condition de succès) / `multi` (N sorties custom avec condition par sortie) | Reflète la réalité métier : chaque canal a une observabilité différente ; l'utilisateur compose son routage |
| Statuts post-envoi par canal | Liste fixe par canal (`CHANNEL_STATUSES` dans `shared/`) | Email observe ouvert/cliqué/rebondi, SMS observe peu, postal non suivi observe rien. Évite à l'utilisateur d'inventer des statuts incohérents avec le canal |
| Courrier postal | Paramètre `tracked: boolean` qui restreint les modes de sortie | Non suivi → mode `single` forcé (zéro observabilité) ; suivi → `simple`/`multi` autorisés |
| Contraintes de format par canal | Table `CHANNEL_FORMAT_RULES` ; compteur de caractères + warnings visibles dans la modal | Reflète la réalité métier (SMS limité, WhatsApp markdown, postal libre) et évite des erreurs invisibles |
| Profil patient | Table Prisma `PatientProfile` (email, phone, whatsapp, address tous optionnels) éditable depuis la vue patient | Permet de démontrer dynamiquement l'impact des données disponibles sur le routage |
| Reachability dynamique | Algorithme `computeReachability` côté `shared/`, recalculé live à chaque édition du profil patient | Le graphe patient projette en temps réel les conséquences de chaque info de contact (chemins bloqués/possibles/inaccessibles) — démo très lisible |
| Modèles de nœuds réutilisables | Table `NodeTemplate` globale ; palette = bibliothèque de modèles éditables + section "système" pour Start/End | Évite à l'utilisateur de re-saisir subject/body/output à chaque workflow. Drop = copie détachée des params, simple à raisonner |
| Suppression | **Soft delete** (`deletedAt`) sur toutes les tables, filtre Prisma global | Contexte médical = audit, traçabilité, base d'un futur droit à l'oubli RGPD ; faible coût |
| Historique d'édition | Undo/redo via snapshot du store Zustand (50 entrées max), raccourcis Ctrl+Z/Y | UX classique mais marqueur de soin ; ne nécessite pas de versioning persistant |
| Export / import / duplication | Export = download JSON depuis `GET /workflows/:id` ; import = `POST /workflows` avec graph fourni (validé Zod) ; duplication = endpoint dédié `POST /workflows/:id/duplicate` | Pratique pour démo, backup et partage ; sans surface API nouvelle hors duplicate |
| Axe temporel | **Contraignant** : X = jour d'exécution, Y libre | Lisibilité chronologique, modèle plus pur |
| Représentation de la temporisation | **Portée par l'arête** (`edge.daysAfter`) plutôt que par un nœud `delay` dédié | Conséquence directe de l'axe contraignant : l'écart de jours entre deux nœuds devient une propriété de la transition, pas une étape. Le concept "Temporisation" du PDF reste pleinement exprimable — chaque graphe modélisable avec nœuds `delay` reste modélisable ici (la valeur passe juste sur l'arête sortante). À défendre comme une interprétation du brief, pas comme une suppression |
| Convergence X | **Max** des délais entrants | Sémantique "tout doit être arrivé avant" |
| Édition délai | **Clic sur l'arête → popover inline** | UX rapide, contextuelle |
| Plage temps | **Auto-fit** `[0, max(X) + 5]`, graduations adaptatives au zoom | Pas de configuration utilisateur, s'ajuste au workflow |
| Bonus patient | Bouton **"Étape suivante"** manuel, état persisté en BDD | Contrôlable pour démo |
| Prévention live d'incohérences | Helpers `simulateAddEdge`/`simulateChangeDaysAfter`/`simulateRemoveEdge` dans `shared/` + rendu ghost des nœuds qui se décaleraient pendant le drag d'une connexion ou l'édition d'un délai | "Preview is the confirmation" : l'utilisateur voit l'impact temporel avant de relâcher, plutôt que de subir un dialog de confirmation. Cycles et self-loops bloqués visuellement (ligne rouge) |
| Ancrage du `start` | **Pleinement verrouillé** : X = 0 (algo), Y = constante (ex. 200), drag entièrement désactivé. Singleton, non supprimable, seedé à la création | Point de départ immuable et toujours présent. Sert d'ancre visuelle pour l'axe temporel — le rail J+0 passe systématiquement par le start |
| Distinction visuelle par type de nœud | **Card uniforme** (DS §7.3) avec strip 3 px coloré par famille + icône **Lucide** spécifique + tokens couleur DS (`--node-<family>-{bg,border,accent}`) | Conformité au DS Swiss minimal. Reconnaissance instantanée via couleur + icône (jamais couleur seule, WCAG). `start` = card compacte 180 px avec icône `Play` + badge `Anchor` + rail J+0 ; `end` = card compacte avec bordure 2 px et icône `Square`. Les 2 types de `condition` (data/résultat) sont distincts visuellement via leurs deux tokens |
| Design System | Référence unique = `design-system/MASTER.md` (DS). Adopté pour tokens couleurs, typographie (Inter), spacing 4/8pt, motion, composants headless (Radix UI), icônes (Lucide) | Cohérence visuelle clinique B2B, contrast AA+ vérifié, base productive avec Tailwind + tokens CSS. 2 divergences explicites assumées (modal vs inspector ; pas de nœud Délai) documentées en 4.3 et 9 |

---

## 4. Architecture

### 4.1 Layout monorepo

```
rainpath-mini-project/
├── frontend/                 # Vite + React + TS + React Flow + Zustand
│   ├── src/
│   │   ├── api/              # Client REST typé
│   │   ├── components/       # Custom nodes, edges, background, palette, modals
│   │   ├── pages/            # WorkflowsList, WorkflowEditor, PatientRunView
│   │   ├── store/            # Zustand store de l'éditeur
│   │   ├── routes.tsx
│   │   └── main.tsx
│   └── package.json
├── backend/                  # NestJS + Prisma + SQLite
│   ├── src/
│   │   ├── workflows/        # module CRUD workflows
│   │   ├── node-templates/   # module CRUD modèles de nœuds
│   │   ├── patient-profiles/ # module CRUD profils patients (bonus)
│   │   ├── patient-runs/     # module runs + advance + reset (bonus)
│   │   ├── prisma/           # PrismaService
│   │   ├── validation/       # Pipe Zod + helpers de validation graphe
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts           # Seed des 8 modèles par défaut + workflow exemple
│   └── package.json
├── shared/                   # Types TS + schémas Zod + algos
│   ├── src/
│   │   ├── schemas/          # Zod (Node, Edge, Graph, NodeTemplate, DTOs API, CHANNEL_STATUSES, CHANNEL_FORMAT_RULES)
│   │   ├── types.ts          # Types inférés Zod
│   │   ├── computeX.ts       # Algo de propagation X
│   │   ├── computeReachability.ts  # Algo de reachability (vue patient)
│   │   └── validateGraph.ts  # Validation structurelle complète
│   └── package.json
├── package.json              # pnpm workspaces
├── pnpm-workspace.yaml
└── README.md
```

Choix `pnpm` workspaces : léger, rapide, gère bien les dépendances locales `shared` consommée par `frontend` et `backend`.

### 4.2 Stack technique

- **Frontend** : Vite 5, React 18, TypeScript 5, React Flow (`@xyflow/react`), Zustand, React Router, TanStack Query (cache API), **Tailwind CSS v3+** (tokens via CSS variables, cf. 4.3), **Radix UI primitives** (composants headless : Dialog, Popover, Tabs, DropdownMenu, Tooltip), **`lucide-react`** (icônes), **Framer Motion** (springs sur modales et sheets), **`@floating-ui/react`** (positionnement popover edges), **React Hook Form + Zod** (formulaires), **`date-fns`** (locale `fr` pour dates relatives), **`@fontsource/inter`** (police).
- **Backend** : NestJS 10, Prisma 5, SQLite, Zod, `nestjs-zod` (intégration validation pipe).
- **Shared** : TypeScript en mode dual (types + schémas Zod runtime).

### 4.3 Design System

La référence visuelle et d'interaction est **`design-system/MASTER.md`** (RainPath Master Design System). Ce document définit :
- Tokens (couleurs, typographie Inter, spacing 4/8pt, radius, élévation, motion)
- Composants (boutons, inputs, node card, inspector, palette, top bar, modales, toasts)
- Règles d'accessibilité (WCAG AA+, focus rings, contrast pairs vérifiés)
- Anti-patterns (no emoji, no gradient sur chrome, no clip-art, no removed focus rings)

**Le DS prévaut sur ce spec pour tout aspect visuel ou d'interaction non explicitement contredit ici.** Si `design-system/pages/<page>.md` existe pour une page donnée, il prévaut sur `MASTER.md` (aucun n'existe à ce stade).

**Le DS a co-évolué avec ce spec** et a **adopté les choix qui étaient initialement présentés comme divergences** :

| Aspect | État DS actuel | Notre choix |
|---|---|---|
| Édition des params de nœuds | DS §7.4 "Node edit modal (double-click on a node)" — modal adoptée | Modal au double-click — ✅ aligné |
| Temporisation | DS §3.3 explicite : "There is no delay / wait node — temporisation is carried by `edge.daysAfter`". Tokens `--node-wait-*` conservés en forward-compatibility uniquement | Pas de nœud `delay`, délai sur arête — ✅ aligné |
| Anti-pattern "modal as navigation" | DS §12 clarifie : "Focused-edit modals — opened by an explicit user action (e.g., double-click on a node) to edit a specific item's parameters, dismissable via ESC with focus trap — are acceptable" | Modal d'édition de nœud = focused-edit, pas navigation — ✅ aligné |

**Aucune divergence active à ce stade.** Le DS et le spec sont mutuellement cohérents.

**Implémentation pratique des tokens** :
- `src/styles/tokens.css` déclare toutes les variables CSS du DS §3-§5 sous `:root { … }`
- `tailwind.config.ts` lit ces variables via `theme.extend.colors`, `spacing`, `borderRadius`, etc. — pas de hex en dur dans les composants
- Inter chargé via `@fontsource/inter` (variable font), feature settings `cv11, ss01, ss03` activés dans `tokens.css`

**Pages anticipées** (DS §14) : `workflow-list.md`, `workflow-editor.md`, `patient-dossier.md`. Aucune n'existe — utiliser `MASTER.md` exclusivement pour ces pages.

---

## 5. Modèle de données

### 5.1 Schéma Prisma

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Workflow {
  id          String   @id @default(cuid())
  name        String
  description String?
  graph       Json     // { nodes: GraphNode[], edges: GraphEdge[] }
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?                // soft delete (contexte médical)
  patientRuns PatientRun[]

  @@index([deletedAt])
}

model NodeTemplate {
  id          String   @id @default(cuid())
  name        String                   // ex: "Relance ferme — Email"
  description String?
  kind        String                   // send_email | send_sms | send_whatsapp | send_postal | condition
  params      Json                     // params spécifiques au kind (cf. EmailParams, SmsParams, …)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  @@index([deletedAt])
}

model PatientProfile {
  id          String       @id @default(cuid())
  name        String
  email       String?
  phone       String?       // utilisé pour SMS
  whatsapp    String?       // distinct du phone (peut être identique en valeur)
  address     String?       // adresse postale formatée libre
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  deletedAt   DateTime?
  patientRuns PatientRun[]

  @@index([deletedAt])
}

model PatientRun {
  id            String         @id @default(cuid())
  workflowId    String
  workflow      Workflow       @relation(fields: [workflowId], references: [id], onDelete: Restrict)
  patientId     String
  patient       PatientProfile @relation(fields: [patientId], references: [id], onDelete: Restrict)
  currentNodeId String?        // null = pas démarré ; nodeId d'un 'end' = terminé
  history       Json           // [{ nodeId, enteredAt, outcome? }]
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  deletedAt     DateTime?

  @@index([deletedAt])
}
```

**Soft delete et cascade cohérente** :
- Toutes les tables portent `deletedAt: DateTime?`. Les `DELETE` HTTP positionnent `deletedAt = now()` au lieu de supprimer physiquement.
- **`onDelete: Restrict`** sur les relations `PatientRun → Workflow` et `PatientRun → PatientProfile` : empêche un hard delete accidentel d'un workflow/profil référencé. Une éventuelle purge RGPD future devra faire un hard delete explicite et orchestré (cascade applicative).
- **Soft-cascade applicative** : le service `WorkflowsService.softDelete(id)` exécute en transaction :
  1. `Workflow.deletedAt = now()`
  2. `PatientRun.updateMany({ workflowId: id, deletedAt: null }, { deletedAt: now() })` — les runs sont marqués soft-deleted en chaîne
- Idem pour `PatientProfilesService.softDelete` : soft-delete les runs liés.
- Les services filtrent systématiquement `deletedAt: null` dans leurs queries via une extension Prisma globale (cf. R12).
- **Restauration** : non implémentée dans le MVP. Un endpoint d'admin pourrait `UPDATE deletedAt = null` à terme. Choix défendable en contexte anatomopathologie (audit, traçabilité, base d'un futur droit à l'oubli RGPD adressé séparément).
- **Note SQLite** : `@@index([deletedAt])` est indexé classiquement, ce qui couvre la majorité des cas où `deletedAt IS NULL`. Un filtered index (`WHERE deletedAt IS NULL`) serait optimal mais non supporté en SQLite via Prisma — acceptable pour le mini-projet.

### 5.2 Statuts post-envoi par canal (`shared/src/schemas/channels.ts`)

Chaque canal d'envoi a une liste fixe de statuts observables. Cette liste cadre les conditions de sortie que l'utilisateur peut composer.

```ts
export const CHANNEL_STATUSES = {
  email:            ['delivered', 'bounced', 'rejected', 'opened', 'clicked', 'unopened'],
  sms:              ['sent', 'delivered', 'failed'],
  whatsapp:         ['sent', 'delivered', 'read', 'failed'],
  postal_tracked:   ['sent', 'delivered', 'returned'],
  postal_untracked: ['sent']
} as const

export type ChannelKey = keyof typeof CHANNEL_STATUSES
export type ChannelStatus<K extends ChannelKey> = (typeof CHANNEL_STATUSES)[K][number]
```

**Sémantique des statuts par canal** :

**Email** — hiérarchie d'engagement implicite :
- `delivered` : MX destinataire a accepté l'email (livraison technique). Statut émis si aucun événement d'engagement ultérieur n'est observé au moment où le workflow résout le nœud.
- `opened` : pixel d'ouverture déclenché. **Implique** `delivered`.
- `clicked` : un lien dans le mail a été cliqué. **Implique** `opened` et `delivered`.
- `unopened` : livré, mais absence explicite d'engagement après une fenêtre d'observation. **Sémantiquement proche** de `delivered`, mais signal explicite "le patient n'a pas engagé" — utile pour router une branche "relance pour non-engagement".
- `bounced` : rejet par le MX destinataire (boîte inexistante, quota plein…).
- `rejected` : rejet à l'émission (politique anti-spam, expéditeur blacklisté…).

**Règle de résolution** : à la résolution du nœud, le système émet le statut **le plus élevé** observé dans la hiérarchie `clicked > opened > delivered > unopened`. `bounced` et `rejected` sont exclusifs.

**SMS** :
- `sent` : remis à l'opérateur sans accusé.
- `delivered` : accusé de réception opérateur (DLR).
- `failed` : refus opérateur.

**WhatsApp** :
- `sent` : message remis au serveur Meta.
- `delivered` : double-check gris (téléphone destinataire l'a reçu).
- `read` : double-check bleu (conversation ouverte par le destinataire).
- `failed` : non délivrable (pas de WhatsApp, bloqué…).

**Postal suivi** :
- `sent` : déposé.
- `delivered` : accusé de réception postal.
- `returned` : courrier retourné (NPAI, refusé, non réclamé).

**Postal non suivi** :
- `sent` : déposé, aucune observation possible au-delà.

**Choix de `successCondition` typiques** (guide UX dans la modal) :
| Intention | Email | SMS | WhatsApp | Postal suivi |
|---|---|---|---|---|
| Envoi techniquement réussi | `[delivered, opened, clicked, unopened]` | `[delivered]` | `[delivered, read]` | `[delivered]` |
| Engagement patient confirmé | `[opened, clicked]` | n/a | `[read]` | n/a |
| Échec à router pour fallback | `[bounced, rejected]` | `[failed]` | `[failed]` | `[returned]` |

(La modal peut proposer ces "presets" cliquables pour simplifier la saisie — cf. 7.3.)

**Mapping kind → canal** :
- `send_email` → `email`
- `send_sms` → `sms`
- `send_whatsapp` → `whatsapp`
- `send_postal` avec `tracked=true` → `postal_tracked`
- `send_postal` avec `tracked=false` → `postal_untracked`

### 5.2.b Contraintes de format du message par canal (`shared/src/schemas/format.ts`)

Les règles ci-dessous cadrent la saisie côté UI (compteur, warnings) et la validation côté back.

```ts
export const CHANNEL_FORMAT_RULES = {
  email: {
    subject: { maxLength: 78, recommendedMax: 50, format: 'plain' },
    body:    { maxLength: 100_000, format: 'html_or_plain' }
  },
  sms: {
    body:    {
      maxLength: 459,                  // 3 SMS concaténés en GSM-7
      recommendedMax: 160,             // 1 SMS GSM-7
      unicodeThreshold: 70,            // bascule unicode = facturé différemment
      format: 'plain'
    }
  },
  whatsapp: {
    body:    {
      maxLength: 4096,
      format: 'whatsapp_markdown'      // *gras*, _italique_, ~barré~, ```mono```
    }
  },
  postal: {
    body:    { maxLength: 20_000, format: 'plain' }   // courrier long-form
  }
} as const

export type ChannelFormatKey = keyof typeof CHANNEL_FORMAT_RULES
```

**Mapping kind → clé de format** : `send_email` → `email`, `send_sms` → `sms`, `send_whatsapp` → `whatsapp`, `send_postal` (tracked ou non) → `postal`.

**Conséquences UX** (cf. 7.3) :
- Compteur sous chaque textarea : `142 / 160` ; couleur verte (< recommended), orange (< max), rouge (> max)
- SMS : passage en orange + tooltip à 70 chars expliquant "votre message basculera en unicode"
- Email subject : warning visuel si > 78 chars
- WhatsApp : aide-mémoire de la syntaxe markdown
- Postal : pas de contrainte stricte mais compteur informatif

### 5.3 Schémas Zod partagés (`shared/src/schemas/`)

```ts
// Position : Y est persisté, X est dérivé (mais on le stocke en cache après computeX)
const Position = z.object({ x: z.number(), y: z.number() })

// Une condition de sortie est un OR de statuts. La validation cross-vérifie
// que ces statuts existent pour le canal du nœud parent.
const OutputCondition = z.object({
  statuses: z.array(z.string().min(1)).min(1)
})

// 3 modes de sortie pour un nœud d'envoi
const SingleOutput = z.object({
  mode: z.literal('single')                  // 1 handle "out", pas de branchement
})

const SimpleOutput = z.object({
  mode: z.literal('simple'),
  // sortie "success" si l'un des statuts du successCondition matche, sinon "failure"
  successCondition: OutputCondition
})

const MultiOutput = z.object({
  mode: z.literal('multi'),
  outputs: z.array(z.object({
    id: z.string().min(1),                   // handleId référencé par edge.sourceHandle
    label: z.string().min(1),                // libellé UI ("Engagé", "Pas engagé"…)
    condition: OutputCondition
  })).min(1)
})

const OutputConfig = z.discriminatedUnion('mode', [SingleOutput, SimpleOutput, MultiOutput])

// Params par type de nœud d'envoi
// Les contraintes .max() proviennent de CHANNEL_FORMAT_RULES (cf. 5.2.b)
const EmailParams = z.object({
  subject: z.string().max(CHANNEL_FORMAT_RULES.email.subject.maxLength).default(''),
  body:    z.string().max(CHANNEL_FORMAT_RULES.email.body.maxLength).default(''),
  output:  OutputConfig
})

const SmsParams = z.object({
  body:   z.string().max(CHANNEL_FORMAT_RULES.sms.body.maxLength).default(''),
  output: OutputConfig
})

const WhatsAppParams = z.object({
  body:   z.string().max(CHANNEL_FORMAT_RULES.whatsapp.body.maxLength).default(''),
  output: OutputConfig
})

const PostalParams = z.object({
  body:    z.string().max(CHANNEL_FORMAT_RULES.postal.body.maxLength).default(''),
  tracked: z.boolean().default(false),
  output:  OutputConfig
})

// Expressions supportées pour conditionType: 'data_available' (validation cross-vérifie l'appartenance)
const DataAvailableExpressions = ['patient.email', 'patient.phone', 'patient.whatsapp', 'patient.address'] as const

const ConditionParams = z.object({
  conditionType: z.enum(['data_available', 'previous_result']),
  expression: z.string()                     // ex: "patient.email" (data_available, dropdown UI), "last.status == rejected" (previous_result, texte libre)
})

const NodeData = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('start') }),
  z.object({ kind: z.literal('end') }),
  z.object({ kind: z.literal('send_email'),    params: EmailParams }),
  z.object({ kind: z.literal('send_sms'),      params: SmsParams }),
  z.object({ kind: z.literal('send_whatsapp'), params: WhatsAppParams }),
  z.object({ kind: z.literal('send_postal'),   params: PostalParams }),
  z.object({ kind: z.literal('condition'),     params: ConditionParams })
])

const GraphNode = z.object({
  id: z.string(),
  position: Position,
  data: NodeData
})

const GraphEdge = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),       // requis si nœud source en mode 'simple' ou 'multi'
  daysAfter: z.number().int().min(0)
})

const Graph = z.object({
  nodes: z.array(GraphNode),
  edges: z.array(GraphEdge)
})

// Modèles de nœuds réutilisables (palette dynamique)
// Le params est validé serveur-side via le discriminant kind
const NodeTemplateKind = z.enum(['send_email', 'send_sms', 'send_whatsapp', 'send_postal', 'condition'])

const NodeTemplateBody = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('send_email'),    params: EmailParams }),
  z.object({ kind: z.literal('send_sms'),      params: SmsParams }),
  z.object({ kind: z.literal('send_whatsapp'), params: WhatsAppParams }),
  z.object({ kind: z.literal('send_postal'),   params: PostalParams }),
  z.object({ kind: z.literal('condition'),     params: ConditionParams })
])

const NodeTemplate = NodeTemplateBody.and(z.object({
  id:          z.string(),
  name:        z.string().min(1),
  description: z.string().optional(),
  createdAt:   z.string(),
  updatedAt:   z.string()
}))
```

**Parse en lecture (back)** : à chaque chargement d'un `Workflow.graph` ou d'un `NodeTemplate.params` depuis la BDD, le service applique `safeParse` du schéma Zod correspondant. Si la lecture échoue (drift de schéma, corruption), retour HTTP 500 avec un message explicite plutôt qu'une donnée silencieusement malformée vers le front. Détecte tôt les évolutions incompatibles du schéma `params` (cf. section 9 "à interroger").

### 5.4 Algorithme `computeXPositions(graph, existingX?)` (shared)

**Tolérance des états transitoires** : pendant l'édition, l'utilisateur peut avoir des nœuds non encore connectés (in-degree 0 hors `start`). L'algo ne doit pas lever d'erreur dans ce cas — il calcule X sur la composante connectée au `start` et préserve la position X existante des orphelins.

```
Entrée : graph, existingX (Map<nodeId, number>, optionnel — positions X actuelles du store)
Sortie : Map<nodeId, number> ou erreur explicite (cycle, start manquant)

1. Construire adjacency list (source -> edges sortantes) et reverse (target -> edges entrantes)
2. Identifier le startNode (kind === 'start'). Si absent → erreur "start manquant"
3. Calculer la composante connectée depuis startNode via BFS sur les edges sortantes : `connected: Set<nodeId>`
4. Initialiser X :
   - X[startNode] = 0
   - Pour chaque nodeId ∉ connected → X[nodeId] = existingX[nodeId] ?? nodeY * 0  (= 0 par défaut pour les nouveaux orphelins, position préservée pour les anciens)
5. Tri topologique de Kahn restreint à `connected` :
   - File initiale = { startNode } (le seul nœud connecté à in-degree 0 par définition, sauf si cycle)
   - Pour chaque node dépilé :
     * Pour chaque edge sortante :
       - candidate = X[node] + edge.daysAfter
       - X[edge.target] = max(X[edge.target] ?? -∞, candidate)
       - decrement in-degree(edge.target), si 0 → enqueue
6. Si nombre de nœuds visités < |connected| → cycle dans la composante connectée → erreur "cycle détecté"
7. Retourner X
```

**Sémantique** :
- Les nœuds **connectés au start** ont leur X **calculé** strictement
- Les nœuds **orphelins** (non atteignables depuis start) conservent leur X précédent (ou 0 s'ils viennent d'être créés) — l'utilisateur peut les placer librement jusqu'à ce qu'ils soient connectés
- Une fois un orphelin connecté (drag-drop d'une arête), il rejoint le calcul topologique au prochain `recomputeXPositions()`

Réutilisé côté front pour positionner les nœuds, côté back pour valider l'absence de cycle (étape 6).

### 5.4.b Algorithme `computeReachability(graph, profile, currentNodeId, history)` (shared)

Calcule, pour la vue patient, l'état de chaque nœud étant donné les données disponibles sur le patient et l'historique d'avancement.

**Entrées** :
- `graph` : Graph validé
- `profile` : PatientProfile (peut avoir des champs `null`)
- `currentNodeId` : nœud courant ou `null` si pas démarré
- `history` : liste des nœuds traversés

**Sortie** : map `nodeId -> NodeReachState` où `NodeReachState` est :
- `'visited'` : présent dans history
- `'current'` : === currentNodeId
- `'reachable'` : potentiellement atteignable depuis currentNodeId compte tenu du profil
- `'blocked'` : sur un chemin sortant d'une condition `data_available` qui résout faux pour le profil
- `'unreachable'` : aucun chemin depuis currentNodeId

**Résolution des conditions `data_available`** (à partir du profil) :
- expression `'patient.email'`     → vrai ssi `profile.email != null && profile.email !== ''`
- expression `'patient.phone'`     → idem `profile.phone`
- expression `'patient.whatsapp'`  → idem `profile.whatsapp`
- expression `'patient.address'`   → idem `profile.address`
- autres expressions               → considérées indéterminées (les deux branches restent reachable)

**Algorithme — visite en ordre topologique strict** :

L'ordre topologique garantit qu'à la visite d'un nœud, tous ses prédécesseurs sont déjà classés, ce qui élimine toute post-pass et toute fragilité de classification.

```
1. Tri topologique sur la composante atteignable depuis currentNodeId
   (réutilisation de l'ordre produit par computeXPositions, ou recalcul local si graphe non encore validé)

2. Initialiser état pour tous les nœuds :
   - 'visited' si nodeId ∈ history
   - 'current' si nodeId === currentNodeId
   - 'unreachable' sinon (par défaut)

3. Helper resolveOutgoingEdges(n) → { followed: Edge[], skippedBlocked: Edge[] }
   Selon kind(n) et output.mode :
   * start                       : followed = la (seule) edge sortante                  ; skippedBlocked = []
   * send_* mode 'single'        : followed = la (seule) edge sortante                  ; skippedBlocked = []
   * send_* mode 'simple'        : followed = toutes (les deux handles possibles)       ; skippedBlocked = []
   * send_* mode 'multi'         : followed = toutes les sorties définies               ; skippedBlocked = []
   * condition 'data_available'  : eval expression(profile)
       - vrai      : followed = edge('true')   ; skippedBlocked = edge('false')
       - faux      : followed = edge('false')  ; skippedBlocked = edge('true')
       - indéfini  : followed = toutes         ; skippedBlocked = []
   * condition 'previous_result' : followed = toutes                                    ; skippedBlocked = []
   * end                         : followed = []                                        ; skippedBlocked = []

4. Parcours en ordre topologique :
   Pour chaque node n dans l'ordre topologique :
     si state[n] ∈ {'unreachable', 'blocked'} et n ≠ currentNodeId :
       continuer (n n'est pas atteint depuis currentNodeId — ses successeurs hériteront)
     soit canPropagate = state[n] ∈ {'current', 'visited', 'reachable'}
     {followed, skippedBlocked} = resolveOutgoingEdges(n)
     Pour chaque edge ∈ followed :
       si canPropagate ET state[edge.target] === 'unreachable' :
         state[edge.target] = 'reachable'
       ou si state[edge.target] === 'blocked' ET canPropagate :
         state[edge.target] = 'reachable'   // promotion : une voie reachable annule un blocage
     Pour chaque edge ∈ skippedBlocked :
       si canPropagate ET state[edge.target] === 'unreachable' :
         state[edge.target] = 'blocked'
       // Si déjà 'reachable' via une autre voie, on ne dégrade jamais (invariant a)

5. Retourner state
```

**Invariants formels** (testés unitairement) :
- **(a) Reachable monotone** : un nœud `reachable` ne redevient jamais `unreachable` ou `blocked` au cours du parcours
- **(b) Blocked promu** : un nœud `blocked` est promu `reachable` si une autre arête entrante l'atteint via un chemin actif
- **(c) Symétrie previous_result** : sur une condition `previous_result`, les deux branches sont propagées identiquement (aucune n'est `blocked`)

Idempotent et déterministe (dépend du tri topologique, lui-même déterministe à id donnée). Recalculé côté front à chaque mutation du `PatientProfile` ; aussi côté back pour exposer un endpoint `GET /patient-runs/:id/reachability` consommé par la vue (ou calculé en local à partir du profil reçu — décidé en implémentation, préférence locale pour la fluidité).

### 5.4.c Helpers de simulation pour la prévention d'incohérences (`shared/src/simulate.ts`)

Pour offrir un retour visuel **avant** d'appliquer une mutation (ajout d'arête, modification de `daysAfter`, suppression d'arête), trois helpers purs calculent les conséquences sur les positions X sans mutation du graphe.

```ts
type Shifts = Map<nodeId, { from: number, to: number }>

function simulateAddEdge(
  graph: Graph,
  source: nodeId, target: nodeId,
  daysAfter: number, sourceHandle?: string
): {
  cycle: boolean,                    // l'edge créerait un cycle (DFS depuis target via edges existantes → si on retombe sur source ou son ascendant, cycle)
  selfLoop: boolean,                 // source === target
  handleConflict: boolean,           // sourceHandle déjà utilisé par une autre edge sortante du source
  newX: Map<nodeId, number>,         // positions X projetées si edge ajoutée
  shifts: Shifts                     // sous-ensemble de newX où la valeur change vs graphe actuel
}

function simulateChangeDaysAfter(
  graph: Graph, edgeId: string, newDaysAfter: number
): {
  cycle: boolean,                    // toujours false (changement de poids ne crée pas de cycle)
  newX: Map<nodeId, number>,
  shifts: Shifts
}

function simulateRemoveEdge(graph: Graph, edgeId: string): {
  newX: Map<nodeId, number>,         // X recalculées sans l'edge supprimée (certains nœuds peuvent reculer)
  shifts: Shifts                     // typiquement décalages négatifs (vers la gauche)
}
```

**Implémentation** :
- `simulateAddEdge` : copie virtuelle du graphe + ajout d'edge + `computeXPositions` ; détection de cycle = échec du tri topologique
- `simulateChangeDaysAfter` : remplace le poids + `computeXPositions`
- `simulateRemoveEdge` : retire l'edge + `computeXPositions`

**Complexité** : O(V + E) par appel. Pour un graphe < 200 nœuds, debounce non nécessaire ; pour les futurs gros graphes (cf. section 9 "à interroger"), envisager un debounce 50ms pendant le drag.

**Utilisation** :
- Frontend pendant drag d'une connexion (cf. 7.4)
- Frontend pendant édition de `daysAfter` dans popover (cf. 7.3 custom edge)
- Tests unitaires : jeux de cas C1 (cycle), C2 (self-loop), C3 (shift target), C4 (shift via daysAfter), C5 (recul après remove)

### 5.5 Validation graphe (back, en complément du parsing Zod)

**Structurelles :**
- ✅ Exactement 1 nœud `start`
- ✅ ≥ 1 nœud `end`
- ✅ `start` n'a pas d'arête entrante
- ✅ `end` n'a pas d'arête sortante
- ✅ Pas de cycle (échec du tri topologique)
- ✅ Pas d'auto-connexion : aucune arête où `source === target` (self-loop)
- ✅ Tout edge cible un nœud existant
- ✅ `daysAfter ≥ 0` (déjà imposé par Zod)

**Spécifiques aux sorties des nœuds d'envoi :**
- ✅ Pour chaque nœud d'envoi, tous les statuts cités dans les `OutputCondition` appartiennent à `CHANNEL_STATUSES[channelKey(node)]`
- ✅ Pour `send_postal` avec `tracked=false`, `output.mode` doit valoir `'single'`
- ✅ Pour les conditions `data_available`, `expression` doit appartenir à `DataAvailableExpressions` (`patient.email`, `patient.phone`, `patient.whatsapp`, `patient.address`)
- ✅ Mode `single` : nœud a au plus 1 arête sortante ; aucune arête n'a `sourceHandle`
- ✅ Mode `simple` : tout `edge.sourceHandle` partant du nœud vaut `'success'` ou `'failure'`. Une seule edge sortante (uniquement `success` ou uniquement `failure`) est autorisée — la branche manquante est traitée comme "fin implicite" lors d'une simulation patient (422 `'no_edge_for_handle'` invitant l'utilisateur à compléter ou utiliser un nœud `end`)
- ✅ Mode `multi` : les `output.id` sont uniques ; tout `edge.sourceHandle` partant du nœud matche un `output.id` existant
- ✅ Aucun statut n'apparaît dans plus d'un `OutputCondition` du même nœud (évite l'ambiguïté de routage en cas de match)

**Spécifiques au nœud `condition` :**
- ✅ Au plus 2 arêtes sortantes, chacune avec `sourceHandle ∈ {'true', 'false'}`, jamais en double

**Spécifiques au nœud `start` :**
- ✅ Au plus 1 arête sortante, sans `sourceHandle`
- ✅ `position.x === 0` (ancré sur l'axe temporel)
- ✅ `position.y === START_Y` (Y verrouillé pour cohérence visuelle, valeur partagée depuis `shared/`)
- ✅ Si à la validation `start.position` ne respecte pas ces contraintes (cas d'un import JSON forgé) → back **corrige silencieusement** à `{x: 0, y: START_Y}` avant écriture, sans rejeter. Trace dans la réponse via un warning informatif

**Unicité globale d'utilisation des handles :**
- ✅ Pour un nœud donné, deux arêtes ne peuvent pas partager le même `sourceHandle` (la branche est déterministe)

**Contraintes de format du message (par canal, cf. 5.2.b) :**
- ✅ `body.length ≤ CHANNEL_FORMAT_RULES[channel].body.maxLength`
- ✅ `subject.length ≤ CHANNEL_FORMAT_RULES.email.subject.maxLength` (email uniquement)
- ✅ Le dépassement de `recommendedMax` n'est pas bloquant côté back (warning UI uniquement)

**Couverture des statuts (non bloquant, niveau warning) :**
- ⚠️ Mode `multi` : si l'union des `condition.statuses` des outputs ne couvre pas l'intégralité de `CHANNEL_STATUSES[channel]`, émettre un **warning** dans la réponse (pas une erreur 422). Front affiche la liste des statuts non couverts avec proposition d'ajouter un output "Autre" / "Fallback".
- ⚠️ Mode `simple` : pas de contrainte de couverture (failure = complément implicite).
- Format de réponse : `{ warnings: [{ code: 'incomplete_status_coverage', nodeId, message, missingStatuses: [...] }], errors: [...] }`. Front doit afficher les deux.

Retour HTTP 422 avec un payload structuré `{ errors: [{ code, message, nodeId?, edgeId? }] }`.

---

## 6. API REST

Préfixe `/api`. Réponses JSON. **Limite de payload : 1 Mo** (configurée via `bodyParser.json({ limit: '1mb' })` dans `main.ts`) — protège contre les uploads malicieux ou les workflows pathologiques. Largement suffisant pour des graphes de plusieurs centaines de nœuds.

### 6.1 Workflows (cœur)

| Méthode | Route | Body | Réponse |
|---|---|---|---|
| `GET` | `/workflows` | — | `[{ id, name, description, updatedAt }]` (filtre `deletedAt: null`) |
| `GET` | `/workflows/:id` | — | `{ id, name, description, graph, createdAt, updatedAt }` |
| `POST` | `/workflows` | `{ name, description?, graph? }` | Workflow créé. Si `graph` fourni → utilisé après validation (cas import) ; sinon graphe initial avec ids `cuid()` : `{ nodes: [{id: cuid(), kind: 'start', position: {x:0, y:START_Y}}, {id: cuid(), kind: 'end', position: {x:30, y:START_Y}}], edges: [{id: cuid(), source: <startId>, target: <endId>, daysAfter:30}] }` où `START_Y` est une constante partagée (`shared/`, valeur 200). Garantit qu'un workflow nouvellement créé ne peut pas exister sans `start` |
| `POST` | `/workflows/:id/duplicate` | `{ name? }` | Crée une copie de `:id` avec `graph` copié et `name = body.name ?? "<original> (copie)"`. Retourne le nouveau workflow |
| `PATCH` | `/workflows/:id` | `{ name?, description?, graph? }` | Workflow mis à jour |
| `DELETE` | `/workflows/:id` | — | 204, soft delete (`deletedAt = now()`) |

**Export / import** : pas d'endpoints dédiés. Export = `GET /workflows/:id` côté front + download du JSON. Import = `POST /workflows` avec `graph` fourni. Le frontend valide via Zod avant l'envoi et affiche les erreurs lisiblement.

### 6.2 Modèles de nœuds

| Méthode | Route | Body | Réponse |
|---|---|---|---|
| `GET` | `/node-templates` | — | `[NodeTemplate]` triés par kind puis name |
| `POST` | `/node-templates` | `{ name, description?, kind, params }` | NodeTemplate créé (params validés selon kind via Zod) |
| `PATCH` | `/node-templates/:id` | `{ name?, description?, params? }` (kind non modifiable) | NodeTemplate mis à jour. **Implémentation** : le service lit le `kind` existant en BDD, le merge avec le body pour reconstruire `{kind, params}` puis applique `NodeTemplateBody.safeParse` (discriminated union nécessite `kind` au moment du parse) |
| `DELETE` | `/node-templates/:id` | — | 204, soft delete. Les nœuds déjà droppés sont détachés et restent intacts |

### 6.3 Patients (bonus)

**Profils :**
| Méthode | Route | Body | Réponse |
|---|---|---|---|
| `GET` | `/patient-profiles` | — | `[{ id, name, email, phone, whatsapp, address, updatedAt }]` |
| `POST` | `/patient-profiles` | `{ name, email?, phone?, whatsapp?, address? }` | Profil créé |
| `PATCH` | `/patient-profiles/:id` | `{ name?, email?, phone?, whatsapp?, address? }` (null pour vider un champ) | Profil mis à jour |
| `DELETE` | `/patient-profiles/:id` | — | 204, soft delete (les runs liés sont conservés et restent visibles ; à la liste des runs, le profil supprimé est marqué "Patient supprimé") |

**Runs :**
| Méthode | Route | Body | Réponse |
|---|---|---|---|
| `GET` | `/workflows/:id/patient-runs` | — | `[{ id, patient: {id, name}, currentNodeId, updatedAt }]` |
| `POST` | `/workflows/:id/patient-runs` | `{ patientId }` | Run créé, `currentNodeId = startNodeId`, `history = [{ nodeId: startNodeId, enteredAt: now }]` |
| `GET` | `/patient-runs/:id` | — | Run complet (workflow.graph + patient profile + history) |
| `POST` | `/patient-runs/:id/advance` | `{ outcome?: string }` | Calcule le prochain nœud et persiste |
| `POST` | `/patient-runs/:id/reset` | — | Remet `currentNodeId = startNodeId`, vide history |

**Logique d'avance** (back, dans `PatientRunsService.advance`) :
- Charger workflow.graph + currentNodeId
- Si nœud courant est `end` → erreur 400 "déjà terminé"
- Selon le kind du nœud courant :
  - **`start`** : suit l'unique arête sortante (pas d'outcome attendu)
  - **`send_*`** : l'outcome attendu est un statut du canal (ex. `'opened'` pour email). Le back résout le handle de sortie :
    - mode `single` → suit l'unique arête sortante (outcome ignoré)
    - mode `simple` → si `outcome ∈ successCondition.statuses` → handle `'success'`, sinon `'failure'`
    - mode `multi` → trouver l'output dont la `condition.statuses` contient l'outcome → handle = `output.id` ; si aucun match → 422 `{ code: 'unhandled_outcome', outcome, availableStatuses: [...], message: 'Le statut N n'est routé par aucune sortie' }` (front propose de revenir éditer le workflow et de couvrir le statut, ou de choisir un autre outcome)
  - **`condition`** : outcome attendu = `'true'` ou `'false'`, handle = outcome
- Sélectionner l'arête où `(source === currentNodeId) && (sourceHandle === handleRésolu)` ; si introuvable ou ambiguë → 422
- `nextNodeId = edge.target` ; append à history `{ nodeId: nextNodeId, enteredAt: now, outcome }`
- Persister + retourner le nouveau run

---

## 7. Frontend

### 7.1 Routes

| Route | Page | Description |
|---|---|---|
| `/` → redirect `/workflows` | — | — |
| `/workflows` | `WorkflowsList` | Liste, création (modal), suppression, lien vers édition |
| `/workflows/:id` | `WorkflowEditor` | Canvas React Flow, palette, modal d'édition, auto-save |
| `/patient-profiles` | `PatientProfilesList` (bonus) | Liste, création, édition rapide, suppression |
| `/workflows/:id/patient-runs` | `PatientRunsList` (bonus) | Liste runs du workflow + création (sélecteur de profil) |
| `/workflows/:id/patient-runs/:runId` | `PatientRunView` (bonus) | Canvas read-only + panneau profil éditable + reachability dynamique + avancement |

### 7.2 Store Zustand de l'éditeur

```ts
type EditorSnapshot = {
  name: string
  description: string
  nodes: GraphNode[]
  edges: GraphEdge[]
}

type EditorStore = {
  workflowId: string | null
  name: string
  description: string
  nodes: GraphNode[]        // x toujours = X dérivé, y libre
  edges: GraphEdge[]
  selectedNodeId: string | null
  selectedEdgeId: string | null
  saveStatus: 'idle' | 'saving' | 'saved' | 'invalid' | 'error' | 'offline'
  lastSavedAt: Date | null
  lastSavedSnapshotHash: string | null    // hash JSON.stringify(snapshot) du dernier save effectif
  validationErrors: ValidationError[]
  pendingSave: boolean                     // un PATCH attend en queue derrière le PATCH en cours

  // historique pour undo/redo
  history: EditorSnapshot[]                  // anciens états (le plus récent en queue)
  historyIndex: number                       // index courant dans history (-1 si vide)
  // règle : toute mutation push un snapshot dans history avant d'appliquer
  // règle : history limité à 50 entrées (FIFO)

  // actions
  loadWorkflow(id: string): Promise<void>
  addNode(kind, paramsFromTemplate, atDayX): void
  updateNodeData(id, data): void
  updateNodePositionY(id, y): void           // pas de X (dérivé)
  removeNode(id): void
  addEdge(source, target, daysAfter, sourceHandle?): void
  updateEdgeDays(id, daysAfter): void
  removeEdge(id): void
  recomputeXPositions(): void                // appelle shared/computeXPositions et met à jour nodes
  validate(): ValidationError[]
  saveNow(): Promise<void>                   // utilisé par debounce

  // undo/redo
  undo(): void                                // appliqué seulement si historyIndex > 0
  redo(): void                                // appliqué seulement si historyIndex < history.length - 1
  canUndo(): boolean
  canRedo(): boolean
}
```

**Auto-save** (gaté et résilient) :
- Effet React qui observe `nodes`, `edges`, `name`, `description` ; déclenche `saveNow` après 1.5s d'inactivité.
- **Gate de validation** : `saveNow` ne déclenche un PATCH que si `validationErrors.length === 0`. Si invalide, `saveStatus = 'invalid'` (pas de PATCH, pas de retry — l'utilisateur doit corriger). Distinct de `'error'` (erreur réseau).
- **Gate de différence** : `saveNow` ne déclenche un PATCH que si `JSON.stringify(snapshot) !== lastSavedSnapshotHash` (évite les PATCHs redondants après undo/redo aller-retour).
- **Sérialisation des sauvegardes** : queue d'un seul PATCH en vol ; si une nouvelle mutation arrive pendant le PATCH, `pendingSave = true`, et un nouveau `saveNow` est déclenché dès la résolution du PATCH en cours.
- **Retry réseau** : sur `'error'`, retry avec back-off exponentiel `[1s, 2s, 4s, 8s, 16s]` (5 tentatives max). Au-delà : `saveStatus = 'offline'` + **bandeau hors-ligne** (DS §7.6) ajouté sous la top bar — 32 px de haut, bg `--surface-muted`, border-bottom 1 px `--border`, texte `--text-sm` `Vos modifications restent locales, reconnexion en cours` + bouton ghost `Réessayer maintenant` (icône `RotateCw`) à droite. Disparaît dès qu'un PATCH réussit.
- **Au focus retrouvé / online event** : tentative de save immédiate si `lastSavedSnapshotHash !== current` ou `saveStatus ∈ {'error', 'offline'}`.

**Undo/redo** :
- Chaque mutation (`addNode`, `updateNodeData`, `addEdge`, `removeEdge`, etc.) pousse un snapshot dans `history` avant d'appliquer.
- Les drags continus (`updateNodePositionY` pendant un drag) sont debouncés : un seul snapshot à la fin du drag.
- Raccourcis clavier : `Ctrl+Z` / `Cmd+Z` → `undo`, `Ctrl+Shift+Z` / `Cmd+Shift+Z` (ou `Ctrl+Y`) → `redo`. Désactivés quand un champ texte a le focus.
- Boutons toolbar correspondants avec état `disabled` selon `canUndo` / `canRedo`.
- Un undo qui ramène à un état différent du dernier save déclenche l'auto-save normal.

### 7.3 Composants React Flow custom

- **Custom Background — axe temporel** (DS §3.7, conformité stricte) : SVG dans un `<Panel>` React Flow repositionné via `useViewport()`. Plage auto-fit `[0, max(X) + 5]`. Memoization des labels (pas de re-render au pan).
  - Surface : `--bg` (#F8FAFC, identique à l'app — le canvas est "le papier")
  - **Gridlines verticales** : `--border` (#E2E8F0), 1 px, une tous les N jours. N adaptatif via `useViewport().zoom` (seuils 0.8 et 0.3 → intervalles 1/5/10 jours). Plafonné à ~50 lignes visibles simultanément (perf)
  - **Labels jours** : `--text-xs` weight 500 `--fg-muted` `tabular-nums`, format `J+0`, `J+1`, `J+30`. Positionnés sticky en haut du canvas, alignés sur chaque gridline visible
  - **Rail J+0** : `--node-start-accent` (#059669), **2 px** (épaissi par rapport aux autres gridlines), traverse le nœud `start.position.x = 0`. Ancre visuelle du début du workflow
  - **Pas de gridlines horizontales** (Y est libre, des bandes horizontales suggéreraient à tort des "voies" discrètes)
- **Custom Nodes** : pattern **card uniforme** par famille (DS §7.3), différenciation par **couleur de famille** + **strip vertical 3px** à gauche + **icône Lucide**. Pas de formes hétérogènes (pas de cercles, pas de losanges) — la cohérence Swiss prime sur la convention BPMN.

  ```
  ┌─────────────────────────────────┐  ← bordure : `--node-<family>-border`, 1px, radius 8px
  │ ▎ [Icon]  Family label          │  ← strip 3px = `--node-<family>-accent` à gauche
  │   Title (text-md, weight 600)   │
  │   ──────                         │
  │   Detail 1 (text-sm, fg-muted)  │
  │   Detail 2                       │
  │                                  │
  │   ────●  source handle(s)       │  ← positions selon output.mode
  │   ●────  target handle (left)   │
  └─────────────────────────────────┘
  ```

  **Dimensions** (DS §7.3) : largeur ~240-280 px, padding 12px, `border-radius: 8px` (`--radius-md`). Bg = `--node-<family>-bg`, border = `--node-<family>-border`, strip 3px = `--node-<family>-accent`. Élévation `--elev-1` resting, `--elev-2` sélectionné + 2px ring `--primary`. Hover : bg shifte d'un cran tonal.

  **Variantes par famille** (DS §3.3 + icônes DS §6) :

  | `kind` | Famille DS | Tokens couleur | Icône Lucide | Spécificités |
  |---|---|---|---|---|
  | `start` | Départ | `--node-start-{bg,border,accent}` (vert) | `Play` | Largeur **réduite à 180 px** (juste icône + label "Examen effectué", pas de détail) ; badge `Anchor` 16px en bas-droite ; drag Y et X **désactivés** ; rail J+0 du Background traverse avec accent (épaisseur 2 px) |
  | `send_email` | Email | `--node-email-{bg,border,accent}` (bleu) | `Mail` | Détails : subject tronqué + 1 ligne body |
  | `send_sms` | SMS | `--node-sms-{bg,border,accent}` (indigo) | `MessageSquare` | Détails : body tronqué + compteur "X / 160" coloré |
  | `send_whatsapp` | WhatsApp | `--node-whatsapp-{bg,border,accent}` (vert clair) | `MessageCircle` | Détails : body tronqué |
  | `send_postal` | Courrier postal | `--node-postal-{bg,border,accent}` (jaune) | `Inbox` | Détails : body tronqué + badge "Suivi" si `tracked=true` |
  | `condition` avec `conditionType: 'data_available'` | Condition — donnée | `--node-cond-data-{bg,border,accent}` (violet clair) | `GitBranch` | Détails : expression formatée (`patient.email` → "Email connu ?") |
  | `condition` avec `conditionType: 'previous_result'` | Condition — résultat | `--node-cond-result-{bg,border,accent}` (rose) | `GitBranch` | Détails : expression brute |
  | `end` | Fin | `--node-end-{bg,border,accent}` (slate) | `Square` | Largeur réduite à 180 px ; bordure plus épaisse (2 px au lieu de 1) |

  **Handles** (DS §7.3) : cercles 10 px, fond `--surface`, bordure de la famille. Deviennent `--primary` pendant le drag d'une edge. Nombre dynamique selon `output.mode` :
  - `start` → 1 handle out
  - `end` → 1 handle in
  - `single` → 1 handle out
  - `simple` → 2 handles : `success` (couleur `--success`) en haut, `failure` (`--danger`) en bas
  - `multi` → N handles empilés verticalement, label de l'output affiché à côté
  - `condition` → 2 handles : `true` (`--success`) à droite, `false` (`--danger`) en bas

  **Curseur** (DS §7.3) : `grab` resting, `grabbing` pendant le drag, `not-allowed` sur le nœud `start`. Animation press 100ms scale 0.98 sur les cards (Micro-interactions DS §2).
- **Custom Edge** (DS §3.4) : couleur et chip texte selon le rôle, jamais couleur seule (WCAG `color-not-only`).

  | Type d'edge | Couleur | Pattern | Chip |
  |---|---|---|---|
  | Flow par défaut (start → suivant, send-single → suivant, send-multi → tout) | `--fg-subtle` (#94A3B8) | solid 1.5 px | aucun |
  | Branche `success` / `true` | `--success` (#059669) | solid 1.5 px | `Oui` (text-xs, fond `--primary-soft`) |
  | Branche `failure` / `false` | `--danger` (#B91C1C) | solid 1.5 px | `Non` (text-xs, fond rose pâle) |
  | Edge sélectionnée / pending | `--primary` (#0E7490) | solid 2 px | inchangé |

  **Label de délai** : chip "X j" (text-xs tabular-nums) centré sur l'edge, cliquable → popover `@floating-ui/react` avec input numérique + middleware `flip`/`shift`. Le chip de branche (Oui/Non) est positionné à côté du label de délai si présent.

  **Animation lors de la création** : edge tracée en suivant le pointeur sans easing pendant le drag, puis fade-in 180ms du chip de délai au release.
- **Top bar** (DS §7.6, hauteur 48 px, sticky, border-bottom 1px `--border`) :
  - À gauche : app mark + workflow name **éditable inline** (clic = mode édition, Enter valide, Escape annule), description en sous-titre `--text-sm` `--fg-muted`
  - Au centre : **indicateur de statut auto-save** (DS §7.6) — `Enregistré il y a Ns` (icône Lucide `Check` `--success`) / `Modifications non enregistrées` (point `--warning`) / `Enregistrement…` (spinner Lucide `Loader2`) / `Hors-ligne` (icône `WifiOff` `--warning`) / `Erreur de validation` (icône `AlertCircle` `--warning`). Largeur de la zone status **réservée** (DS §13 perf : pas de layout shift)
  - Au centre droite : boutons `Annuler` (icône `Undo2`) et `Rétablir` (`Redo2`), variant ghost, désactivés selon `canUndo` / `canRedo` ; chacun avec tooltip Radix indiquant le raccourci clavier
  - À droite immédiate du kebab : **bouton conditionnel `Enregistrer maintenant`** (variant primary, icône `Save`), visible uniquement quand `saveStatus ∈ {'error', 'offline'}` (force un PATCH immédiat hors retry) ou en hover prolongé (300 ms) sur l'indicateur de statut. Lecture DS §7.6 : on conserve l'auto-save comme mécanisme principal mais on offre un escape hatch explicite quand quelque chose ne va pas. Tooltip "Forcer l'enregistrement maintenant — utile en cas d'erreur réseau".
  - À l'extrême droite : kebab Radix DropdownMenu (icône `MoreVertical`) avec actions `Renommer` / `Dupliquer` / `Exporter en JSON` / `Supprimer` (item `text-danger` séparé par `<Separator>`)
- **Palette latérale** (gauche, DS §7.5 — largeur **320 px**, full-height scrollable) — **bibliothèque de modèles éditables** organisée en 2 sections, avec headers `--text-xs` weight 600 uppercase tracking 0.02em `--fg-muted` :

  **Section "Nœuds système"** (fixe, non éditable) :
  - 2 entrées : `Départ` (icône `Play`, famille start) et `Fin` (icône `Square`, famille end). Chaque entrée 48 px de haut, padding 12 px, hover bg `--surface-muted`.
  - `Départ` désactivé (opacité 0.5, `aria-disabled="true"`) si un start existe déjà.

  **Section "Modèles"** (dynamique, source = `GET /node-templates`) :
  - Liste **groupée par `kind`** avec sous-sections collapsables (Radix Accordion). Sous-titre par section : "Email", "SMS", "WhatsApp", "Postal", "Condition".
  - Chaque entrée = ligne 48 px : icône Lucide du canal (16 px) + `name` (`--text-md` weight 500) + drag handle `GripVertical` (16 px, `--fg-subtle`) à droite. Tooltip Radix avec preview 1 ligne (subject tronqué ou expression).
  - Menu `MoreVertical` par item (Radix DropdownMenu) : **Éditer / Dupliquer / Supprimer** (avec modal confirm DS §7.8).
  - Bouton `+ Nouveau modèle` (variant secondary) en tête de section, ouvre un sélecteur de kind (Radix Popover ou Select), puis la modal d'édition vide.
  - **Drop sur canvas** : crée un nœud avec `data = { kind: template.kind, params: structuredClone(template.params) }` à la position Y du drop, X recalculé. Le nœud est **détaché** du template (aucune référence persistée) — éditer le template ensuite n'affecte pas l'instance.
  - **Drag preview** (DS §7.5) : aperçu = vraie node card à 80% opacité, cursor `grabbing`.
  - Modal d'édition de template = même formulaire que la modal d'édition de nœud (mêmes champs, même validation), avec en plus le champ `name` et `description` du template en tête.

  **Seed initial** au premier démarrage (8 modèles) :
  - "Email — première relance" (mode simple, `successCondition = [delivered, opened, clicked, unopened]` = succès si envoi technique réussi)
  - "Email — rappel ferme" (mode multi : *Engagé* `[opened, clicked]` / *Pas engagé* `[delivered, unopened]` / *Échec* `[bounced, rejected]`)
  - "SMS — court" (mode simple, `successCondition = [delivered]`)
  - "WhatsApp — message court" (mode simple, `successCondition = [delivered, read]`)
  - "Postal — suivi" (mode simple, `tracked=true`, `successCondition = [delivered]`)
  - "Postal — non suivi" (mode single, `tracked=false`)
  - "Condition — email connu" (`conditionType: 'data_available', expression: 'patient.email'`)
  - "Condition — WhatsApp dispo" (`conditionType: 'data_available', expression: 'patient.whatsapp'`)
- **Modal d'édition** (au double-click sur un nœud) — **divergence assumée du DS** qui recommande un inspector panel (cf. 4.3) :
  - Implémentée via **Radix Dialog** (DS §7.8). Largeur 640 px (form), padding 24 px, `--radius-lg`, élévation `--elev-3`, scrim `--elev-scrim`.
  - Animation : scrim fade 150 ms ease-out + content scale 0.96 → 1 + fade 180 ms via Framer Motion spring `{stiffness: 320, damping: 30}`. Respect `prefers-reduced-motion`.
  - Focus trap, ESC ferme, premier input focus à l'ouverture, focus restauré au close.
  - Titre `--text-lg` weight 600 (nom du nœud + badge famille). Body `--text-base`. Footer : `Annuler` (variant secondary) à gauche du primary `Enregistrer` (variant primary), right-aligned.
  - Click-outside ne ferme que si pas de modifications non sauvegardées ; sinon mini-confirm "Abandonner les modifications ?".

  Formulaire React Hook Form piloté par `kind`. Onglets via **Radix Tabs**. Validation Zod inline. Pour les nœuds d'envoi, structure :
  - **Onglet "Message"** : subject (email), body, et pour postal le toggle `tracked`.
    - **Compteur de caractères** sous chaque champ : `142 / 160`, couleur verte sous `recommendedMax`, orange entre `recommendedMax` et `maxLength`, rouge au-delà (et bloque le save).
    - **Indicateur de format spécifique au canal** :
      - SMS : passage en orange à 70 chars + tooltip "votre message basculera en unicode et coûtera plus cher" ; passage en orange à 160 chars + "votre message sera segmenté en N SMS"
      - Email : warning sur subject > 78 chars
      - WhatsApp : panneau d'aide repliable listant la syntaxe markdown supportée (`*gras*`, `_italique_`, `~barré~`, `` ```mono``` ``)
      - Postal : pas de contrainte stricte, juste le compteur informatif
  - **Onglet "Routage"** : sélecteur `output.mode` (`single` / `simple` / `multi`), puis :
    - mode `simple` : multi-sélecteur de statuts du canal pour `successCondition`, prévisualisation des deux handles. **Presets cliquables** au-dessus du sélecteur : "Envoi technique réussi", "Engagement confirmé", "Échec à router" (cf. table en 5.2) — l'utilisateur peut cliquer un preset puis ajuster manuellement
    - mode `multi` : table éditable avec ajout/suppression de lignes `(label, condition: multi-sélecteur de statuts)`. Affiche **2 warnings UI** non bloquants :
       - chevauchement (un statut listé dans 2 conditions — ambiguïté) → rejeté à la validation back (rule 5.5)
       - couverture incomplète (statuts du canal non routés) → suggestion d'ajouter un output "Fallback" avec les statuts restants. Bouton "Tout couvrir" qui crée automatiquement un output catch-all
    - mode `single` : pas de configuration, juste un message "1 sortie unique"
  - Le multi-sélecteur de statuts liste **seulement les statuts du canal effectif** (recalculé si `tracked` change pour postal)
  - Bandeau d'alerte si la modal ferme alors que des edges sortants référencent des `sourceHandle` qui ne sont plus définis (proposer "supprimer ces edges" ou "annuler")

  Pour les **nœuds `condition`** :
  - Champ `conditionType` : 2 boutons radio "Donnée disponible" (`data_available`) / "Résultat précédent" (`previous_result`)
  - Champ `expression` :
    - si `data_available` → **dropdown** parmi `DataAvailableExpressions` (`patient.email`, `patient.phone`, `patient.whatsapp`, `patient.address`)
    - si `previous_result` → input texte libre avec exemple placeholder (`last.status == rejected`)

### 7.4 Contraintes drag, création d'arête et **prévention live des incohérences**

**Drag d'un nœud (Y uniquement, sauf start)** :
- `onNodeDrag` intercepté : force `node.position.x = X_dérivé[node.id]` quel que soit le delta X de l'utilisateur. Y libre.
- **Exception `start`** : `draggable: false` au niveau React Flow node config. X et Y sont **tous deux verrouillés** (X = 0 par algo, Y = constante `START_Y` exportée depuis `shared/`, ex. 200). Le nœud reste cliquable/sélectionnable mais non déplaçable. Curseur "not-allowed" au survol pour signaler explicitement la contrainte.

**Création d'une connexion (drag d'un handle vers un autre)** — preview live via `simulateAddEdge` :
- **`onConnectStart`** : snapshot du graphe courant + initialisation du buffer de simulation.
- **`onConnectMove`** (callback continu pendant le drag, ou `onConnect` au hover du target candidat) :
  - Appel `simulateAddEdge(graph, source, hoveredTarget, daysAfter=0, sourceHandle)`
  - Selon le résultat :
    | Résultat | Rendu visuel |
    |---|---|
    | `selfLoop` | Ligne de connexion **rouge** + halo rouge sur source + tooltip flottant "Auto-connexion impossible" |
    | `cycle` | Ligne **rouge** + halo rouge sur target + tooltip "Boucle détectée — connexion impossible" |
    | `handleConflict` | Ligne **orange** + tooltip "Ce handle a déjà une sortie" |
    | `shifts.size > 0` | Ligne **verte** + nœuds shiftés rendus en **ghost** à leur position future (opacité 0.5, bordure tiretée) + badge `+N j` sur chaque nœud décalé. Position actuelle reste rendue en arrière-plan grisée |
    | aucun changement | Ligne **verte** sans embellissement |
- **`onConnectEnd`** :
  - Si cycle / selfLoop / handleConflict → drop **rejeté**, toast "Connexion impossible : `<raison>`", aucun snapshot pushé dans history
  - Sinon → commit : edge ajoutée au store, X recalculées, **animation CSS 300ms** sur la propriété `transform` des nœuds décalés vers leurs nouvelles positions. Popover d'édition s'ouvre immédiatement pour permettre d'ajuster `daysAfter`.

**Suppression d'arête** :
- Aucune confirmation (réversible via undo).
- Recompute immédiat via `simulateRemoveEdge` puis commit.
- **Animation 300ms** sur les nœuds qui reculent en X (la transition est rendue par CSS `transition: transform 300ms ease-out` sur le wrapper de nœud).

**Suppression d'un nœud** :
- `removeNode` : cascade applicative dans le store — toutes les edges entrantes ET sortantes du nœud sont supprimées simultanément. Recompute X (certains nœuds peuvent reculer). Animation 300ms.
- Un seul snapshot poussé dans l'history pour cette opération atomique.

**Édition de `daysAfter` via popover sur arête** :
- À chaque keystroke dans l'input (debounced 100ms), appel `simulateChangeDaysAfter(graph, edgeId, newValue)`.
- Les nœuds qui se décaleraient sont rendus en ghost en temps réel (même style que création d'edge).
- Bouton "Valider" applique : commit + animation 300ms. Escape annule sans changement.

### 7.5 Bandeau de validation

Fixé en bas du canvas (DS §7.11), pleine largeur, hauteur auto, **max-height 25vh** (scroll interne si dépassement).

- **Caché** quand `validationErrors.length === 0` ET aucun warning. Pas de bandeau "tout va bien".
- **Visible** dès qu'il y a au moins un item :
  - bg `#FEF2F2` (rouge clair) si ≥ 1 erreur ; `#FFFBEB` (jaune clair) si uniquement des warnings
  - border-top 2 px `--danger` (ou `--warning`)
  - padding `--space-3 --space-4`
- **Header** : icône `AlertCircle` 20 px + `--text-sm` weight 600 — `N erreurs · M avertissements`. Bouton ghost `MoreVertical` à droite pour collapse/expand (état mémorisé en session storage).
- **Liste** : `--text-sm`, chaque item = icône (`XCircle` `--danger` pour erreur, `AlertTriangle` `--warning` pour warning) + message + bouton ghost **`Centrer sur l'erreur`** (icône Lucide `Target`) qui pan/zoom le canvas vers le `nodeId` ou `edgeId` du `ValidationError`.
- **A11y** : `role="region"` `aria-label="Validation du workflow"`, le compteur dans le header en `aria-live="polite"` pour annoncer les changements.

### 7.5.b Page liste des workflows

DS §7.7. Container `max-w-6xl` (1152 px), padding horizontal `--space-6`.

**Header** :
- Titre `Workflows` (`--text-2xl` weight 600)
- À droite : bouton primary `+ Nouveau workflow` (icône Lucide `Plus`) + bouton secondary `Importer un JSON` (icône `Upload`)

**Empty state** (DS §7.10) : centré, max-width 480 px, message "Aucun workflow créé pour le moment." + CTA primary "Créer mon premier workflow". Pas d'illustration.

**Liste populée** : **table** (préféré à la card grid pour la densité métier), tri par `updatedAt` décroissant. Colonnes :
- `Name` (link vers éditeur, hover bg `--surface-muted`)
- `Description` tronquée
- `Nœuds` (compteur, tabular-nums)
- `Statut` (badge : `Brouillon` si dernière modif < 1h, `Actif` sinon — placeholder, peut évoluer)
- `Modifié` (relative date `il y a X` via `date-fns/formatDistanceToNow` locale fr)
- Kebab `MoreVertical` (Radix DropdownMenu) : `Ouvrir`, `Renommer`, `Dupliquer`, `Exporter en JSON`, `Supprimer` (item danger séparé)

**Loading state** : skeleton table 5 lignes mirroring la structure (DS §7.10), affiché si chargement > 300 ms.

**Error state** : message humain "Impossible de charger les workflows" + bouton secondary `Réessayer` (icône `RotateCw`).

**Virtualisation** : `@tanstack/react-virtual` si > 50 workflows (DS §13 perf).

**Création** : clic sur `+ Nouveau workflow` → Radix Dialog (480 px, DS §7.8) avec champ `name` (requis) + `description` (optionnel) + boutons `Annuler` / `Créer`. Au submit, POST `/workflows` puis redirect vers `/workflows/:id`.

**Import** : clic sur `Importer un JSON` → input file (`accept=".json"`) caché + clic programmatique. Lecture, parse Zod côté front (`safeParse(Graph)`), si OK → modal de confirmation listant `nodes.length` et `edges.length`. Si KO → modal d'erreur avec liste structurée des erreurs Zod (path + message), bouton `Retour`.

### 7.6 Vue patient (bonus)

**Layout** : 2 colonnes — canvas read-only (70%) + panneau latéral (30%).

**Canvas read-only** :
- Réutilise les custom nodes/edges/background de l'éditeur avec prop `readOnly` (drag désactivé, popovers d'édition désactivés).
- **Curseur jour courant** : `<line>` verticale à `X = X_dérivé[currentNodeId]` colorée + label flottant "Jour courant : J+7".
- **Rendu d'état par nœud** (issu de `computeReachability`) :
  | État | Style |
  |---|---|
  | `visited` | Fond `--node-<family>-bg`, bordure `--success`, icône Lucide `Check` (16 px) en bas-droite. A11y `aria-label="Étape terminée : <label>"` |
  | `current` | Bordure `--primary` 2 px pulsante (animation 2 s `box-shadow`, désactivée sous `prefers-reduced-motion`) + badge `--primary` "En cours" en haut-droite. A11y `aria-current="step"` + `aria-label="Étape en cours : <label>"` |
  | `reachable` | Style normal du nœud (DS §7.3). A11y `aria-label="Étape à venir : <label>"` |
  | `blocked` | Opacité 0.4, bordure tiretée `--danger`, badge `--danger` "Bloqué" + icône `XCircle` + libellé raison (ex. "Email patient manquant"). A11y `aria-label="Étape bloquée : <label> — <raison>"` |
  | `unreachable` | Opacité 0.15, grisé `--surface-muted`, non interactif (`pointer-events: none`), retiré de l'arbre AT via `aria-hidden="true"` |
- **Edges** suivant le même schéma (verte si vers visited, pointillée rouge si vers blocked, etc.).
- Animation discrète **fade 200ms** sur les transitions d'état lorsque le profil change (pour montrer la propagation).

**Panneau latéral** — 3 sections :

1. **Profil patient (éditable inline)**
   - Champs : `name` (texte), `email`, `phone`, `whatsapp`, `address`.
   - Chaque champ optionnel a un bouton "Ajouter" / "Supprimer" (toggle null/value).
   - Modification debouncée (500ms) → `PATCH /patient-profiles/:id` → invalidate React Query → recompute reachability local → re-render du canvas.
   - Bannière informative : "Modifier ces données change immédiatement les chemins disponibles dans le workflow."

2. **Avancement**
   - Bouton "Étape suivante" avec sélecteur d'outcome contextuel au nœud courant :
     - `start` ou `send_*` en `single` → aucun sélecteur, juste le bouton
     - `send_*` en `simple` ou `multi` → dropdown des statuts du canal (libellés français : "Ouvert / Cliqué / Rejeté / Non ouvert" …)
     - `condition` → 2 boutons radio "Vrai / Faux"
   - **Garde** : si le sélecteur de statut n'a aucune branche définie côté workflow pour le statut choisi, bouton désactivé avec tooltip "Aucune sortie configurée pour ce statut".
   - **Pré-warning** : si le nœud courant est un `send_*` et que la donnée nécessaire manque dans le profil (ex. `send_email` mais `profile.email == null`), bandeau orange "Aucune adresse email dans le profil — l'envoi simulé devrait échouer".
   - Bouton "Réinitialiser le parcours" (reset endpoint).

3. **Historique du parcours**
   - Liste chronologique : pour chaque étape passée, `nodeId` (label du nœud) + jour d'entrée + outcome simulé.

### 7.7 Comportements transversaux

Aligné DS §7.10 (trois états), §8 (motion), §9 (accessibilité).

**Routing & erreurs** :
- **Route 404 catch-all** : page dédiée avec message + CTA `Retour aux workflows` (pas de redirect silencieux).
- **ErrorBoundary global** : enveloppe l'éditeur et la vue patient. Sur exception React, affiche un fallback `--text-md` "Erreur de chargement" + bouton `Recharger` (Lucide `RotateCw`) + lien secondary "Retour à la liste". Pas de stack trace exposée (DS §7.10 error).

**Trois états** (DS §7.10, sur chaque surface async) :
- **Empty** : message explicatif + un seul CTA primary, max-width 480 px, sans illustration ni clip-art. Exemples : pas de workflow, pas de modèle, pas de profil patient.
- **Loading** : skeleton matching la layout finale pour les attentes > 300 ms ; spinner Lucide `Loader2` (animé) uniquement à l'intérieur des boutons en cours d'action.
- **Error** : sentence humaine (quoi / pourquoi / comment réessayer) + bouton retry primary. Jamais de stack.

**Confirmations** (DS §9.5 + §7.8) : Radix Dialog **480 px**, padding 24 px, qui nomme explicitement l'artefact ("Supprimer le workflow « Relance standard » ?"). Footer : `Annuler` (variant secondary) à gauche du primary destructif `Supprimer` (variant danger). ESC ferme, focus sur Annuler par défaut (DS sécurise contre les actions destructives accidentelles). Pas de confirmation pour les actions réversibles via undo (nœuds, edges).

**Toasts** (DS §7.9) : `sonner` ou `react-hot-toast` configurés bottom-right, max 3 stacked. Auto-dismiss 4s (success/info), 6s (warning), manuel pour danger. `aria-live="polite"` (success/info), `assertive` (danger). Jamais comme seul feedback d'une action destructive (la modif est aussi reflétée dans l'UI).

**Accessibilité (DS §9, non négociable)** :
- **Tab order** : top bar → palette → canvas → inspector/modal. Vérifié à chaque page.
- **Focus rings** : 2 px `--ring`, offset 2 px sur tous les éléments focusables. **Jamais retirés** sans remplacement équivalent.
- **Skip-link** "Aller au canvas" en haut de `<main>` (visible au focus clavier seulement).
- **Canvas keyboard nav** (DS §9.2) :
  - `Tab` entre les nœuds (ordre = ordre topologique pour stabilité)
  - `Enter` ouvre la modal d'édition du nœud focused
  - Flèches : nudge Y (8 px), `Shift + flèches` (1 px). Pas de nudge X (verrouillé)
  - `Delete` / `Backspace` supprime le nœud ou edge sélectionné
  - `Cmd/Ctrl + S` save explicite ; `Cmd/Ctrl + Z` / `Cmd/Ctrl + Shift + Z` undo/redo
- **Focus trap** dans modales (Radix Dialog gère nativement), focus restauré au close.
- **Heading hierarchy** : page `h1`, panel `h2`, section `h3`. Pas de saut de niveau.
- **Forms** : `<label for>` (jamais placeholder-as-label), erreurs `role="alert"` + `aria-live="polite"`, focus sur le premier champ invalide au submit.
- **Canvas `role="application"`** avec `aria-label` explicite "Éditeur de workflow visuel" + fallback texte caché : liste structurée des nœuds en ordre topologique avec leurs paramètres (`<ul>` visually-hidden). Permet aux lecteurs d'écran d'accéder au contenu malgré l'interaction souris.
- **Icon-only buttons** : tous avec `aria-label` en français explicite (ex. `aria-label="Supprimer le nœud Email rappel ferme"`).
- **Couleurs jamais seules** (DS §9.1) : Oui/Non sur edges = couleur + chip texte ; états patient = couleur + icône ; statuts d'envoi = couleur + label.
- **`prefers-reduced-motion`** honoré : toutes les animations spring/slide remplacées par opacity-only 100 ms.
- **Zoom 200%** : layout survit sans clip ni scroll horizontal (testé en checklist DS §13).

**Boutons** (DS §7.1) :
- Variants : `primary` (`--primary` bg, `--on-primary` fg, hover `--primary-hover`), `secondary` (`--surface` bg, `--fg` fg, `--border`, hover `--surface-muted`), `ghost` (transparent, hover `--surface-muted`), `danger` (transparent fg `--danger`, hover bg `#FEF2F2`)
- Tailles : `sm` 32 px / padding 12 px, `default` 36 px / padding 16 px, `lg` 40 px
- Loading : spinner Lucide `Loader2` remplace le texte, largeur préservée (`min-w` from text), `disabled` pendant loading
- Press : 100 ms scale 0.98 + bg darken (micro-interaction DS §2)
- Focus : 2 px `--ring`, offset 2 px — **jamais retiré sans remplacement**
- Icon-only : variant `ghost` + `aria-label` obligatoire

**Inputs** (DS §7.2) :
- Hauteur 36 px (sm) / 40 px (default), padding horizontal 12 px
- Bordure `--border` resting, `--primary` focus + 2 px ring offset 0 (pas de bordure doublée)
- **Label `<label for>` toujours visible** au-dessus (`--text-sm` weight 500). Jamais placeholder-as-label.
- Helper text dessous, `--text-xs` `--fg-muted`
- Erreur : bordure `--danger`, helper text `--danger`, `role="alert"` + `aria-live="polite"`, focus sur le premier champ invalide au submit
- **Validation on blur**, pas à chaque keystroke (sauf compteurs de caractères qui sont eux live)

**Toasts** (DS §7.9) :
- Lib : `sonner` (recommandé) ou équivalent
- Position : bottom-right, max 3 stacked
- Auto-dismiss : 4 s (success/info), 6 s (warning), **manuel** pour danger
- `aria-live="polite"` (success/info), `assertive` (danger)
- **Jamais comme seul feedback** d'une action destructive — l'UI doit aussi refléter le changement

**Motion table** (DS §8) — durations et easings utilisés strictement :

| Action | Durée | Easing |
|---|---|---|
| Button hover / press | 100 ms / 80 ms | `ease-out` |
| Input focus ring | 120 ms | `ease-out` |
| Node selection ring | 120 ms | `ease-out` |
| Modal scrim fade | 150 ms | `ease-out` |
| Modal content (scale 0.96→1 + fade) | 180 ms | Framer Motion spring `{stiffness: 320, damping: 30}` |
| Toast enter / exit | 180 ms / 120 ms | `cubic-bezier(0.16, 1, 0.3, 1)` enter, `ease-in` exit |
| Panel collapse / expand | 200 ms | `ease-in-out` |
| Page → editor transition | 220 ms slide-in from right | `ease-out` |
| Node X transition (preview commit, suppression edge) | 300 ms | `ease-out` |
| Reachability state fade | 200 ms | `ease-out` |
| Edge drawn during connection | follows pointer | aucun easing |

**Animer uniquement `transform` et `opacity`.** Jamais `width`, `height`, `top`, `left`, `margin` (DS §8). Pour les panels collapsables : transform-based.

**`prefers-reduced-motion`** : toutes les animations spring/slide → instant ou opacity-only 100 ms.

**Typographie — règles supplémentaires DS §4.2** :
- **Tabular figures** (`font-variant-numeric: tabular-nums`) sur : labels `X j` des arêtes, dates relatives ("il y a N min"), compteur de caractères, métadonnées de listes (timestamps, node count)
- **Letter-spacing** : -0.01em uniquement sur `--text-2xl` et `--text-display` ; default partout ailleurs
- **Truncation** : préférer le wrap natif. Si forcé (ex. nom de workflow long dans la liste, label de template dans la palette) → ellipsis 1-line + **tooltip Radix au hover** avec texte complet

**Viewport meta** (DS §9.4) : `<meta name="viewport" content="width=device-width, initial-scale=1">` — **jamais `user-scalable=no`**, jamais `maximum-scale=1`.

**Tab order détaillé avec modal ouverte** (clarification DS §9.2 adaptée à notre choix de modal) :
- Modale fermée (état par défaut éditeur) : `top bar` → `palette` → `canvas` (Tab cycle entre nœuds en ordre topologique) → kebab top bar
- Modale ouverte : focus **trappé dans la modal** (Radix Dialog le fait nativement). Tab cycle : premier input → ... → bouton Annuler → bouton Enregistrer → premier input. ESC ferme et restaure le focus sur le nœud précédemment sélectionné dans le canvas
- Skip-link "Aller au canvas" visible au focus clavier seulement (positionnement absolu en haut à gauche, `--surface` bg, `--text-sm`, padding 8 px, `--ring` au focus)

**Layout responsive** (DS §10, desktop-first ≥ 1024 px) :
- ≥ 1280 px : full layout (320 palette + canvas + modal)
- 1024-1279 px : palette collapsable via toggle bouton
- 768-1023 px : palette collapsée par défaut ; list page en single column
- < 768 px : message "Mieux sur grand écran" sur l'éditeur ; list reste utilisable
- `min-h-dvh` (pas `100vh`) sur conteneurs full-height
- Z-index scale DS §10 : 0 canvas, 10 panels, 20 top bar, 40 dropdowns, 100 modals, 1000 toasts

---

## 8. Découpe parallèle

### Phase 0 — Fondations (séquentiel, ~30-35 min)

Indispensable pour débloquer le travail parallèle.

1. Init monorepo pnpm + workspace
2. Scaffolding `frontend/` (Vite React-TS) et `backend/` (NestJS CLI)
3. Création `shared/` :
   - Schémas Zod (`Position`, `NodeData`, `GraphNode`, `GraphEdge`, `Graph`, `NodeTemplate`, DTOs API)
   - Constantes `CHANNEL_STATUSES`, `CHANNEL_FORMAT_RULES`
   - Algo `computeXPositions`, `computeReachability`
   - Fonction `validateGraph` (cycles, contraintes structurelles, format)
   - **Tests unitaires explicites** (Vitest) :
     - `computeXPositions` : chemin linéaire / convergence (max gagne) / arbre simple / détection de cycle / start absent / multiple starts
     - `validateGraph` : graphe minimal valide / cycle / nœud orphelin / start manquant / multiples starts / end absent / arête vers nœud inexistant / `daysAfter < 0` / postal `tracked=false` avec mode `multi` (rejet) / mode `simple` avec sourceHandle invalide / mode `multi` avec doublon de `output.id` / statut hors canal / chevauchement de statuts entre conditions / body excédant `maxLength`
     - `computeReachability` : profil vide bloque toutes les conditions data_available / chemin simple visited→current→reachable / condition data_available qui résout vrai → branche false marquée blocked / chevauchement de chemins (un blocked + un reachable sur même cible → reachable l'emporte) / send multi : tous les outputs reachable
     - `simulateAddEdge` : self-loop détecté (C2) / cycle créé via chemin existant (C1) / shift target (C3) / handleConflict / cas idéal sans shift
     - `simulateChangeDaysAfter` : augmentation daysAfter décale target + descendants (C4) / diminution recule target / pas de cycle créé
     - `simulateRemoveEdge` : retrait d'edge maintenant un nœud → nœud recule (C5) / retrait d'edge non critique → aucun shift
4. README racine avec contrat API documenté + référence vers `design-system/MASTER.md`
5. **Setup design system côté frontend** :
   - Tailwind v3+ configuré avec les variables CSS du DS (`tailwind.config.ts` → `theme.extend.colors`, `spacing`, `borderRadius` lisant `var(--*)`)
   - `src/styles/tokens.css` déclarant `:root { --bg, --surface, --primary, --node-<family>-*, --text-*, --space-*, --radius-*, --elev-*, ... }` (full DS §3-§5)
   - `@fontsource/inter` installé + feature settings `cv11, ss01, ss03`
   - `lucide-react` installé, wrapper léger `<Icon name="…" size={16|20|24} />` pour cohérence
   - Radix UI primitives installées (Dialog, Popover, DropdownMenu, Tabs, Tooltip, Accordion, Separator)
   - Framer Motion installé (springs sur modales)
6. Prisma init + schema complet (`Workflow`, `NodeTemplate`, `PatientProfile`, `PatientRun`) + première migration
7. Seed script pour les 8 modèles de nœuds par défaut

**Sortie** : monorepo qui build, packages `shared` accessibles depuis front et back, contrat API gelé.

### Phase 1 — Implémentation parallèle (2 agents)

**Track 1A — Backend** (~1h30)
- Module `PrismaModule` (singleton) avec extension globale pour filtrer `deletedAt: null` sur les findMany/findFirst
- Module `WorkflowsModule` : controller, service, DTO, validation Zod + graphe, endpoint `POST /workflows/:id/duplicate`
- Module `NodeTemplatesModule` : controller, service, DTO (validation params selon kind via discriminated union)
- Soft delete sur tous les modèles (DELETE positionne `deletedAt`)
- Pipe Zod via `nestjs-zod` ou middleware custom
- Réponses 422 structurées
- Seed : 1 workflow d'exemple (scénario PDF) + 8 modèles par défaut
- Test e2e basique (workflows CRUD + duplicate + soft delete, templates CRUD, validation rejet sur graphe invalide, import via POST avec graph)

**Track 1B — Frontend core** (~3h30)
- Routing + layout général + Tailwind + ErrorBoundary global + route 404 catch-all
- API client typé (TanStack Query + types `shared`)
- **Tests unitaires ciblés** (Vitest + React Testing Library) :
  - `reconcileEdgesAfterOutputChange` : transitions multi→simple / multi→single / suppression handle / renommage output.id
  - Store Zustand : push/pop history, canUndo/canRedo, hash de snapshot pour autosave gate, queue de PATCH
  - API client : sérialisation/désérialisation Zod aller-retour sur `Workflow` complet
- Page `WorkflowsList` (cards + créer / dupliquer / exporter JSON / supprimer / importer JSON)
- Store Zustand de l'éditeur **avec historique undo/redo (50 snapshots max)**
- Custom Background (graduations adaptatives)
- Custom Nodes (5 types + Start + End)
- Custom Edge avec popover délai
- Toolbar éditeur : retour, name/desc inline, indicateur save, boutons undo/redo, menu ⋮ (Exporter / Dupliquer / Supprimer)
- Raccourcis clavier (Ctrl+Z, Ctrl+Shift+Z, Suppr sur sélection)
- **Palette latérale "bibliothèque de modèles"** : section système (Start/End) + section modèles dynamique (fetch GET /node-templates, groupée par kind, menu ⋮, bouton "+ Nouveau modèle")
- **Modal d'édition partagée** : utilisée pour éditer un nœud du canvas OU éditer un modèle (mêmes champs, validation Zod, compteurs de chars par canal)
- Auto-save debouncé + indicateur d'état
- Bandeau de validation
- Contrainte X sur drag
- **Prévention live d'incohérences** : intégration `simulateAddEdge`/`simulateChangeDaysAfter`/`simulateRemoveEdge` dans les callbacks React Flow (`onConnectStart`/`onConnectMove`/`onConnectEnd`) ; rendu ghost + halo de couleur selon résultat ; animation CSS 300ms sur transitions de position X

### Phase 2 — Bonus dossier patient (~1h30, après 1A + 1B)

Décomposable en deux sous-tracks parallèles si nécessaire :

**2A — Backend bonus**
- Tables `PatientProfile` et `PatientRun` (migration)
- Module `PatientProfilesModule` (CRUD)
- Module `PatientRunsModule` (CRUD + `advance` + `reset`) avec logique de résolution outcome→handle
- (optionnel) endpoint `GET /patient-runs/:id/reachability` si on choisit calcul back

**2B — Frontend bonus**
- Route `PatientProfilesList` (CRUD profils)
- Route `PatientRunsList` (création de run avec sélecteur de profil)
- Route `PatientRunView` :
  - canvas en `readOnly` réutilisant les composants éditeur
  - panneau profil éditable (debounce 500ms + PATCH)
  - intégration `computeReachability` local + re-render
  - sélecteur d'outcome contextuel + avancement
  - historique

### Phase 3 — Polish (~30 min, séquentiel)

- Test manuel du scénario PDF (J+7 email → fallback WhatsApp/SMS → J+15 courrier → J+30 fin) saisi en éditeur
- Test démo bonus : créer un profil, l'attacher à un run, modifier les champs et observer les chemins se débloquer/bloquer
- **Checklist DS §13 — pre-delivery** :
  - Visuel : seules icônes Lucide / aucune emoji / tokens DS partout / press states sans layout shift / zoom 200% OK
  - Interaction : `cursor-pointer` partout / focus rings visibles / disabled states / validate-on-blur / canvas keyboard nav (Tab, Delete, Cmd+S)
  - A11y : `aria-label` icon-only / heading hierarchy / pas de couleur seule / `prefers-reduced-motion` / contrast pairs §3.5
  - Perf : Inter `font-display: swap` / React Flow nodes memoized / virtualisation liste / pas de layout shift status save
  - Trois états couverts sur chaque surface async
- README global : démarrage, structure, choix techniques, points d'amélioration, lien vers `design-system/MASTER.md`
- Cleanup, commit final, push GitHub public

### Récap budget

| Phase | Estimation | Mode |
|---|---|---|
| 0 — Fondations (incl. tests shared + setup DS tokens + Tailwind + Radix + Lucide) | 45-55 min | Séquentiel |
| 1A — Backend (workflows + templates + soft delete + duplicate) | 1h30 | Parallèle à 1B |
| 1B — Frontend core (éditeur + palette + undo/redo + export/import/duplicate + prévention live + DS conformity) | 4h | Parallèle à 1A |
| 2A — Backend bonus | 45 min | Parallèle à 2B (après 1A+1B) |
| 2B — Frontend bonus | 1h-1h15 | Parallèle à 2A |
| 3 — Polish | 30 min | Séquentiel |
| **Total** | **~6h45-7h45** | — |

---

## 9. Points pour l'entretien

Éléments à préparer pour la discussion (cf. section 7 du PDF) :

**Choix défendables**
- **Axe temporel contraignant + temporisation portée par l'arête** : modèle plus pur, lisibilité immédiate de la chronologie, naturellement adapté à la vue patient bonus. **Point à argumenter en entretien** : le PDF liste "Temporisation" parmi les types minimum de nœuds ; ici elle est représentée différemment (propriété d'arête `daysAfter`) plutôt qu'éliminée. L'expressivité reste équivalente — tout workflow modélisable avec un nœud `delay` reste modélisable. Si l'évaluateur attend strictement la liste, ajouter un nœud `delay` "sucre syntaxique" qui se traduit en `daysAfter` sur l'arête sortante est faisable en ~15 min. À discuter ouvertement
- React Flow + Zustand : combinaison standard de l'écosystème, productive sans sur-engineering
- JSON blob + Zod : équilibre entre simplicité Prisma (1 table workflow) et rigueur de validation
- Monorepo pnpm + package `shared` : un seul endroit où vivent les types et la logique métier critique (validateGraph, computeX)
- Auto-save debouncé : UX moderne, montre une sensibilité au polish
- **Statuts d'envoi typés par canal + modes de sortie `single`/`simple`/`multi`** : reflète la différence d'observabilité réelle (email = riche, postal non suivi = aveugle), évite à l'utilisateur de configurer des branchements impossibles, et donne une UX claire (multi-sélecteur de statuts plutôt qu'expressions textuelles)
- **Contraintes de format par canal + UI réactive** : compteur SMS 160/70, warnings unicode, longueur subject email, aide markdown WhatsApp — montre une connaissance des spécificités des canaux
- **Vue patient avec profil éditable et reachability dynamique** : l'utilisateur modifie un champ → tout le graphe se réorganise visuellement (chemins débloqués/bloqués). Démontre la valeur métier du workflow et la cohérence du modèle. L'algorithme `computeReachability` est testable de façon isolée dans `shared/`
- **Bibliothèque de modèles de nœuds réutilisables** avec drop détaché : palette dynamique alimentée par une table BDD, partage de modèles entre workflows, mais sans lien fort (drop = copie). Modèle simple, productif, et la même modal d'édition sert pour modèle et instance — cohérence UX et code
- **Soft delete par défaut** sur toutes les tables : approprié au contexte anatomopathologie (audit, traçabilité, base d'un futur droit à l'oubli RGPD), faible coût d'implémentation
- **Undo/redo dans l'éditeur** (snapshot du store Zustand, 50 entrées max, Ctrl+Z/Y) : signal de soin UX, classique mais pas évident pour un mini-projet
- **Export/import JSON + duplication** des workflows : favorise la démo et le partage, ré-utilise les schémas Zod pour valider les imports
- **Adoption du Design System `MASTER.md`** : tokens CSS centralisés, Tailwind config liée aux tokens, Radix UI primitives + Lucide + Framer Motion. Pas de hex en dur dans les composants. Vérifications WCAG AA+ (contrast pairs déjà vérifiés dans le DS §3.5). Cohérence visuelle clinique B2B
- **Modal d'édition focalisée** (double-click) plutôt qu'inspector panel latéral fixe — choix UX initialement présenté comme divergence du DS d'origine, **désormais adopté par le DS §7.4** après itération collaborative. Argumentaire : laisse le canvas libre quand l'utilisateur navigue, et présente un formulaire focalisé seulement quand il édite. Cohérent avec n8n/Zapier. Pas un anti-pattern "modal as primary navigation" (DS §12 clarifié) — c'est un focused-edit modal, déclenché par action explicite, avec focus trap et ESC

**Choix à interroger / refaire avec plus de temps**
- **Versioning complet des workflows** (table `WorkflowVersion`, sélecteur, rollback, diff) — le soft delete déjà en scope adresse partiellement la traçabilité, mais un vrai historique des modifications serait défendable en environnement médical
- **Conformité RGPD et audit trail** : chiffrement at-rest des données patient, log immuable des accès/modifications, endpoint d'effacement définitif, pseudonymisation des identifiants. Sujet majeur dans un produit réel d'anatomopathologie
- **Cohérence multi-onglets / verrouillage optimiste** : aujourd'hui last-write-wins, deux onglets éditant le même workflow se piétinent. Solutions : `If-Match` HTTP avec ETag, ou réplication temps réel (WebSocket + CRDT). Versioning résout aussi en partie
- **i18n / localisation** : labels statuts, libellés UI, messages d'erreur — actuellement en français uniquement, structure prête à isoler les chaînes serait défendable
- **Validation back via `class-validator`** plutôt que Zod — alternative légitime, mais perd la réutilisation front/back. Trade-off discuté
- **WebSocket temps réel** pour multi-utilisateur (live cursor, présence, synchronisation)
- **Vue temporelle dual** (édition libre + visualisation temporelle séparée) au lieu de l'axe contraignant — autre point d'équilibre productivité/lisibilité
- **Évolution future du schéma `params` des nœuds/modèles** : aujourd'hui zéro migration en place (graphes stockés en JSON). Toute évolution de `EmailParams`, `ConditionParams`, etc. nécessiterait un script de migration qui parse, transforme et réécrit les blobs des `Workflow.graph` et `NodeTemplate.params` existants. Sujet à anticiper dès qu'on dépasse le mini-projet
- **Conventions REST vs RPC** : certains endpoints utilisent un verbe d'action dans l'URL (`/workflows/:id/duplicate`, `/patient-runs/:id/advance`, `/reset`). Pragmatique et lisible, mais non-RESTful pur — alternative : `POST /workflows {from: id}`, `POST /patient-run-events {runId, action}`. Compromis assumé pour ce mini-projet
- **Accessibilité du canvas React Flow** : drag-drop principalement souris ; clavier natif limité. Solutions possibles : modes "ajout par clic" (focus + Enter pour drop) + déplacement des nœuds via touches fléchées + sélection des edges via Tab. Demande un investissement non négligeable
- **Limite de payload 1 Mo** : suffisant pour usage courant. Si workflow géant (>200 nœuds avec body markdown longs), à revoir avec compression côté wire (gzip Express middleware déjà actif sur NestJS prod, à vérifier)
- **Dark mode** (DS §3.6 fournit un mapping complet de tokens dark : `--bg → #0B1220`, `--surface → #111827`, `--primary → #22D3EE`, etc.) : **stretch hors-scope MVP**. Aucun token dark déclaré côté `tokens.css` pour rester focalisé, mais l'architecture (variables CSS + Tailwind config lisant `var(--*)`) permet l'ajout via `:root[data-theme="dark"]` ultérieurement sans refonte. Re-vérification du contrast obligatoire à l'ajout (pas d'inversion directe). À discuter en entretien comme évolution courte

**Améliorations identifiées**
- **Tests E2E Playwright** sur l'éditeur (création, drag-drop, autosave, vue patient)
- **Workflow templates entiers** (au-delà des NodeTemplate) : graphes pré-fabriqués que l'utilisateur peut cloner comme point de départ
- **Recherche/filtre** sur les listes workflows, modèles, profils
- **Intégrations de providers réels** (Mailjet, Twilio, La Poste API) avec sélection au niveau du nœud d'envoi
- **Performance sur gros workflows** (>200 nœuds) : virtualisation React Flow déjà en place, mais auto-save à reconsidérer (delta-PATCH au lieu de PUT complet)

---

## 10. Risques & inconnues

### 10.1 Risques actifs et mitigations

| # | Risque | Mitigation |
|---|---|---|
| R1 | **Custom Background avec graduations adaptatives** non trivial | SVG dans un `<Panel>` React Flow (positionné par rapport au viewport), `useViewport()` pour lire zoom/pan, intervalles 1/5/10 jours selon zoom (seuils 0.8 et 0.3), memoization des labels pour éviter re-render à chaque pan. Plafonné à ~50 labels visibles simultanément |
| R2 | **Popover sur edge** avec positionnement correct | `@floating-ui/react` avec `useFloating()` + `autoUpdate` + middleware `flip`/`shift`, ancré sur la position du clic sur l'edge |
| R3 | **Mutation d'outputs perturbe les arêtes existantes** (multi→simple, multi→single, suppression d'un output, changement `tracked` postal) | Fonction pure `reconcileEdgesAfterOutputChange(node, oldOutput, newOutput, edges) → { edgesToKeep, edgesToRemove }` extraite dans `shared/` et testée unitairement (multi→simple, multi→single, suppression handle, renommage `output.id`). Dialog de confirmation listant les edges affectées avant application |
| R5 | **Reachability mal calculée** si conditions imbriquées ou branches parallèles | Invariants formels respectés : (a) un nœud marqué `reachable` ne redevient jamais `unreachable` ou `blocked`, (b) un nœud `blocked` redevient `reachable` si une autre entrée le rend atteignable, (c) `previous_result` propage symétriquement sur les deux branches. Tests unitaires `computeReachability` couvrant chaque invariant |
| R6 | **Édition profil patient et synchro canvas** (race, état stale) | Debounce 500ms front + invalidation React Query systématique. Reachability **calculée localement** front à chaque changement (pas d'aller-retour back). Backend reste source de vérité sur le profil |
| R10 | **Undo/redo × auto-save** | `lastSavedSnapshotHash = JSON.stringify({nodes, edges, name, description})`. L'auto-save n'émet un PATCH que si le hash courant ≠ `lastSavedSnapshotHash`. Un undo qui ramène à un état non sauvegardé déclenche un PATCH normal. Tests manuels en Phase 3 |
| R11 | **Import JSON invalide / corrompu** | Zod parse côté front avant POST (avec `safeParse`) + côté back en safety net. Erreurs affichées sous forme structurée : chemin du champ (`nodes[3].params.body`), message Zod, suggestion de correction. Viewer JSON read-only avec highlight de la ligne fautive |
| R12 | **Soft delete : oubli de filtrer `deletedAt: null`** | Extension Prisma globale : `prisma.$extends({ query: { $allModels: { findMany/findFirst/findUnique: ({ args, query }) => query({ ...args, where: { ...args.where, deletedAt: null } }) } } })`. Tests e2e systématiques (DELETE puis GET = absent dans la liste mais accessible si on demande explicitement avec `?includeDeleted=true`, hors scope MVP) |
| R13 | **Drag X "non éditable" frustrant** | Pendant un drag avec composante X non nulle : afficher un "ghost" du nœud à sa position calculée X-dérivée (overlay semi-transparent). Au release, le nœud snap à la position calculée. Tooltip persistant "X est dérivé du chemin — modifie le délai sur l'arête entrante pour décaler" |
| R15 | **`nestjs-zod` × `discriminatedUnion`** (compatibilité non garantie) | POC en Phase 0 avec `NodeData` (discriminated union complexe imbriquant `OutputConfig`). Si KO : fallback `ZodValidationPipe` custom (~20 lignes, prend un schéma Zod, appelle `safeParse`, throw `BadRequestException` avec les erreurs) |
| R16 | **Hot reload Vite avec le package `shared/`** | Configuration root pnpm + `vite-tsconfig-paths` côté front + `optimizeDeps.exclude: ['@rainpath/shared']` ; côté NestJS, `tsx watch` qui suit `shared/dist/**/*` ; script `dev` racine orchestre 3 processus parallèles : `tsc -w` (shared) + Vite (front) + tsx watch (back). Détection rapide via Phase 0 |
| R17 | **Suppression accidentelle du nœud `start` ou du dernier `end`** | Bouton "Supprimer" désactivé sur `start` (singleton requis par contrat). Suppression d'un `end` autorisée tant qu'il en reste ≥ 1 (vérif dans `removeNode` du store : `if (kind === 'end' && countEnds === 1) → no-op + toast`). Validation back en safety net |
| R18 | **Sauvegardes concurrentes** (auto-save / undo / édition rapide) | Queue de sauvegarde dans le store : un seul PATCH en vol à la fois. Le suivant est mis en attente et fusionné si plusieurs s'empilent (debounce sur le PATCH lui-même). L'état `saveStatus` reflète la queue (cf. 7.2). Évite les races et garantit l'ordre des écritures |
| R19 | **Auto-save sur graphe invalide** : sans gate, PATCH 422 en boucle pendant l'édition | `saveNow` court-circuité si `validationErrors.length > 0` → `saveStatus = 'invalid'` (distinct de `'error'`). PATCH ne part qu'une fois le graphe revalidé. Cf. 7.2 |
| R20 | **Perte réseau pendant l'édition** | Retry exponentiel `[1s, 2s, 4s, 8s, 16s]` (5 tentatives). Au-delà → `saveStatus = 'offline'` + bandeau persistant + bouton "Réessayer". Tentative immédiate à la reconnexion (`online` event navigateur). État local jamais perdu (les modifs restent dans le store, persistées au prochain save réussi) |
| R21 | **`simulateAddEdge` appelé trop souvent pendant drag** (chaque mouseMove) → cost CPU sur gros graphes | Throttle à 60 fps max (16ms) via `requestAnimationFrame` ; sur graphes > 100 nœuds, fallback à 50ms debounce. Mesure en Phase 0 avec un graphe artificiel pour valider |
| R22 | **Ghost de preview désynchronisé avec l'état réel** (clic-drop puis état des nœuds incohérent avec preview) | Commit applique exactement le `newX` calculé par le dernier `simulate` (pas un nouveau compute) — garantie que ce que l'user a vu = ce qu'il obtient. Si entre-temps le graphe a muté (autre source de mutation), recompute final post-commit avec `computeXPositions` |
| R23 | **Drift entre composants et DS** (un dev écrit un hex en dur, oublie un token, redéfinit une couleur) | `eslint-plugin-tailwindcss` + règle custom interdisant les hex 6-digit hors `tokens.css` + checklist DS §13 en Phase 3 (revue visuelle 100% + zoom 200%). Pas de PR sans relecture des composants visuels |
| R24 | **Page-specific overrides** (`design-system/pages/*.md`) absents mais leur format est défini | Aucune page-spec n'existe : utiliser `MASTER.md` strictement. Si un page-spec est ajouté en cours d'impl, le re-lire et appliquer (override). En entretien, mentionner la lecture du mécanisme prévu |

### 10.2 Plan de coupes en cas de retard

En cas de dépassement de budget, couper dans l'ordre suivant. Garder le bonus le plus longtemps possible (signature du projet, valeur en entretien).

| Ordre | Coupe | Économie | Impact |
|---|---|---|---|
| 1 | Skip undo/redo (store history, boutons toolbar, raccourcis Ctrl+Z/Y) | ~30 min | Faible — polish UX |
| 2 | Skip import/export JSON (boutons liste + parsing) | ~20 min | Modéré — argument démo perdu |
| 3 | Skip duplication workflow (endpoint back + bouton liste) | ~10 min | Faible |
| 4 | Réduire le bonus 2B : pas d'édition inline du profil, juste sélecteur de profil existant + reachability statique | ~30 min | Modéré — réduit l'effet "waouh" du bonus |
| 5 | Skip bonus entièrement (2A + 2B) | ~2h | Important — c'est la signature du projet |
| 6 | Skip tests e2e backend (garder seulement tests unitaires `shared/`) | ~15 min | Faible — couverture critique préservée |
| 7 | Polish UI minimal (Tailwind brut, pas de palette de couleurs custom, transitions désactivées) | ~20 min | Élevé sur la perception de soin |

**Repère temps** : à 4h écoulées, si Phase 1 n'est pas finie, déclencher la coupe 1. À 5h, déclencher 1+2+3. À 5h30, évaluer 4 ou 5.
