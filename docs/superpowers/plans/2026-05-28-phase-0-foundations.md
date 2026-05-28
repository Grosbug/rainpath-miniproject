# RainPath — Phase 0 Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a pnpm monorepo with three packages (`shared/`, `frontend/`, `backend/`), implement all `shared/` schemas, constants and algorithms with unit tests, configure the Design System tokens on the frontend, and complete Prisma migration + seed on the backend. After this plan, Phase 1A (Backend) and Phase 1B (Frontend) can run in parallel because the API contract and shared logic are frozen.

**Architecture:**
- pnpm workspaces with `frontend/`, `backend/`, `shared/` packages
- `shared/` is the single source of truth for Zod schemas, channel constants, and pure algorithms (`computeXPositions`, `computeReachability`, `validateGraph`, `simulateAddEdge`/`Change`/`Remove`). Built with `tsc -w` and consumed by front and back via path aliases.
- Frontend scaffolded with Vite 5 (React 18 + TS), preconfigured with Tailwind v3 reading DS tokens from `tokens.css`, plus Radix UI + Lucide + Framer Motion installed (used in Phase 1B).
- Backend scaffolded with NestJS CLI; Prisma 5 wired to SQLite with a complete schema (Workflow, NodeTemplate, PatientProfile, PatientRun) including `deletedAt` for soft delete, plus a seed script.

**Tech Stack:** pnpm workspaces, TypeScript 5, Vitest (shared tests), Vite 5, React 18, Tailwind v3, Radix UI, Lucide, Framer Motion, NestJS 10, Prisma 5, SQLite, Zod 3.

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-05-28-rainpath-workflow-editor-design.md`
- Design System: `design-system/MASTER.md`

---

## File structure (this plan creates)

```
rainpath-mini-project/
├── package.json                              # pnpm workspaces root (created)
├── pnpm-workspace.yaml                       # (created)
├── tsconfig.base.json                        # shared TS config (created)
├── README.md                                 # (created/replaced)
│
├── shared/
│   ├── package.json                          # (created)
│   ├── tsconfig.json                         # (created)
│   ├── vitest.config.ts                      # (created)
│   ├── src/
│   │   ├── index.ts                          # public API
│   │   ├── schemas/
│   │   │   ├── primitives.ts                 # Position, GraphNode, GraphEdge, Graph
│   │   │   ├── channels.ts                   # CHANNEL_STATUSES + ChannelKey
│   │   │   ├── format.ts                     # CHANNEL_FORMAT_RULES + ChannelFormatKey
│   │   │   ├── expressions.ts                # DataAvailableExpressions
│   │   │   ├── node-data.ts                  # NodeData discriminated union (start, end, send_*, condition)
│   │   │   ├── node-template.ts              # NodeTemplate + NodeTemplateBody
│   │   │   └── api-dtos.ts                   # API request/response DTOs
│   │   ├── algorithms/
│   │   │   ├── compute-x-positions.ts        # computeXPositions
│   │   │   ├── compute-reachability.ts       # computeReachability
│   │   │   ├── validate-graph.ts             # validateGraph
│   │   │   └── simulate.ts                   # simulateAddEdge / Change / Remove
│   │   └── constants.ts                      # START_Y constant
│   └── tests/
│       ├── compute-x-positions.test.ts
│       ├── compute-reachability.test.ts
│       ├── validate-graph.test.ts
│       └── simulate.test.ts
│
├── frontend/
│   ├── package.json                          # (Vite scaffolded)
│   ├── tsconfig.json                         # (Vite scaffolded, adjusted)
│   ├── vite.config.ts                        # (adjusted for shared alias)
│   ├── tailwind.config.ts                    # (created — reads tokens.css)
│   ├── postcss.config.js                     # (created)
│   ├── index.html                            # (Vite scaffolded)
│   ├── src/
│   │   ├── main.tsx                          # (Vite scaffolded)
│   │   ├── App.tsx                           # (placeholder)
│   │   ├── styles/
│   │   │   ├── tokens.css                    # (created — all DS variables)
│   │   │   └── globals.css                   # (created — Tailwind directives + tokens import)
│   │   └── components/
│   │       └── Icon.tsx                      # (created — Lucide wrapper)
│   └── ...
│
└── backend/
    ├── package.json                          # (NestJS scaffolded)
    ├── tsconfig.json                         # (NestJS scaffolded, adjusted)
    ├── nest-cli.json                         # (scaffolded)
    ├── src/
    │   ├── main.ts                           # (scaffolded, adjusted for body limit + global pipe)
    │   ├── app.module.ts                     # (scaffolded)
    │   └── prisma/
    │       ├── prisma.service.ts             # (created — with $extends soft delete filter)
    │       └── prisma.module.ts              # (created)
    ├── prisma/
    │   ├── schema.prisma                     # (created — full schema)
    │   ├── migrations/                       # (generated)
    │   └── seed.ts                           # (created — 1 workflow + 8 templates)
    ├── .env                                  # (created)
    └── .env.example                          # (created)
```

---

## Task 1: Initialize pnpm monorepo root

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`

- [ ] **Step 1.1: Verify pnpm is installed**

Run:
```bash
pnpm --version
```
Expected: a version number (e.g., `9.x.x`). If "command not found", install via `npm install -g pnpm` or `corepack enable pnpm`.

- [ ] **Step 1.2: Create root `package.json`**

Write `package.json`:
```json
{
  "name": "rainpath",
  "private": true,
  "version": "0.0.0",
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "dev": "pnpm -r --parallel --filter shared --filter frontend --filter backend dev",
    "dev:shared": "pnpm --filter shared dev",
    "dev:frontend": "pnpm --filter frontend dev",
    "dev:backend": "pnpm --filter backend start:dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "typescript": "5.4.5"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

- [ ] **Step 1.3: Create `pnpm-workspace.yaml`**

Write `pnpm-workspace.yaml`:
```yaml
packages:
  - shared
  - frontend
  - backend
```

- [ ] **Step 1.4: Create base TypeScript config**

Write `tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 1.5: Install TypeScript at root**

Run:
```bash
pnpm install
```
Expected: lockfile created, `node_modules/typescript` present.

- [ ] **Step 1.6: Commit**

Run:
```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json pnpm-lock.yaml
git commit -m "chore: initialize pnpm monorepo with shared/frontend/backend workspaces"
```

---

## Task 2: Shared package skeleton + Vitest

**Files:**
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `shared/vitest.config.ts`
- Create: `shared/src/index.ts` (empty for now)

- [ ] **Step 2.1: Create `shared/package.json`**

Write `shared/package.json`:
```json
{
  "name": "@rainpath/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "dev": "tsc -w",
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "zod": "3.23.8"
  },
  "devDependencies": {
    "typescript": "5.4.5",
    "vitest": "1.6.0"
  }
}
```

- [ ] **Step 2.2: Create `shared/tsconfig.json`**

Write `shared/tsconfig.json`:
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "tests", "node_modules"]
}
```

- [ ] **Step 2.3: Create `shared/vitest.config.ts`**

Write `shared/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
})
```

- [ ] **Step 2.4: Create empty `shared/src/index.ts`**

Write `shared/src/index.ts`:
```ts
// Public API of @rainpath/shared
// Re-exports are added as tasks land.
export {}
```

- [ ] **Step 2.5: Install shared dependencies**

Run:
```bash
pnpm install
```
Expected: `shared/node_modules` exists, `zod` and `vitest` installed.

- [ ] **Step 2.6: Verify build & test commands work (empty for now)**

Run:
```bash
pnpm --filter @rainpath/shared build
pnpm --filter @rainpath/shared test
```
Expected: build succeeds (generates `dist/index.js`); test exits 0 with "No test files found" (or similar).

- [ ] **Step 2.7: Commit**

Run:
```bash
git add shared/package.json shared/tsconfig.json shared/vitest.config.ts shared/src/index.ts pnpm-lock.yaml
git commit -m "feat(shared): initialize shared package skeleton with Vitest"
```

---

## Task 3: Channel constants (CHANNEL_STATUSES, CHANNEL_FORMAT_RULES, DataAvailableExpressions)

**Files:**
- Create: `shared/src/schemas/channels.ts`
- Create: `shared/src/schemas/format.ts`
- Create: `shared/src/schemas/expressions.ts`
- Create: `shared/tests/constants.test.ts`
- Modify: `shared/src/index.ts`

- [ ] **Step 3.1: Write failing test for constants shape**

Write `shared/tests/constants.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { CHANNEL_STATUSES, type ChannelKey } from '../src/schemas/channels'
import { CHANNEL_FORMAT_RULES, type ChannelFormatKey } from '../src/schemas/format'
import { DataAvailableExpressions } from '../src/schemas/expressions'

describe('CHANNEL_STATUSES', () => {
  it('lists email statuses without delivered ambiguity', () => {
    expect(CHANNEL_STATUSES.email).toEqual([
      'delivered', 'bounced', 'rejected', 'opened', 'clicked', 'unopened'
    ])
  })
  it('postal_untracked only has sent', () => {
    expect(CHANNEL_STATUSES.postal_untracked).toEqual(['sent'])
  })
  it('postal_tracked observes sent, delivered, returned', () => {
    expect(CHANNEL_STATUSES.postal_tracked).toEqual(['sent', 'delivered', 'returned'])
  })
})

describe('CHANNEL_FORMAT_RULES', () => {
  it('sms body maxLength 459 and recommendedMax 160', () => {
    expect(CHANNEL_FORMAT_RULES.sms.body.maxLength).toBe(459)
    expect(CHANNEL_FORMAT_RULES.sms.body.recommendedMax).toBe(160)
    expect(CHANNEL_FORMAT_RULES.sms.body.unicodeThreshold).toBe(70)
  })
  it('email subject maxLength 78 recommended 50', () => {
    expect(CHANNEL_FORMAT_RULES.email.subject.maxLength).toBe(78)
    expect(CHANNEL_FORMAT_RULES.email.subject.recommendedMax).toBe(50)
  })
  it('whatsapp body maxLength 4096', () => {
    expect(CHANNEL_FORMAT_RULES.whatsapp.body.maxLength).toBe(4096)
  })
})

describe('DataAvailableExpressions', () => {
  it('contains exactly the 4 patient fields', () => {
    expect(DataAvailableExpressions).toEqual([
      'patient.email', 'patient.phone', 'patient.whatsapp', 'patient.address'
    ])
  })
})
```

- [ ] **Step 3.2: Run test, verify FAIL**

Run:
```bash
pnpm --filter @rainpath/shared test
```
Expected: FAIL with "Cannot find module '../src/schemas/channels'" or equivalent.

- [ ] **Step 3.3: Create `shared/src/schemas/channels.ts`**

Write `shared/src/schemas/channels.ts`:
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

- [ ] **Step 3.4: Create `shared/src/schemas/format.ts`**

Write `shared/src/schemas/format.ts`:
```ts
export const CHANNEL_FORMAT_RULES = {
  email: {
    subject: { maxLength: 78, recommendedMax: 50, format: 'plain' as const },
    body:    { maxLength: 100_000, format: 'html_or_plain' as const }
  },
  sms: {
    body: {
      maxLength: 459,
      recommendedMax: 160,
      unicodeThreshold: 70,
      format: 'plain' as const
    }
  },
  whatsapp: {
    body: {
      maxLength: 4096,
      format: 'whatsapp_markdown' as const
    }
  },
  postal: {
    body: { maxLength: 20_000, format: 'plain' as const }
  }
} as const

export type ChannelFormatKey = keyof typeof CHANNEL_FORMAT_RULES
```

- [ ] **Step 3.5: Create `shared/src/schemas/expressions.ts`**

Write `shared/src/schemas/expressions.ts`:
```ts
export const DataAvailableExpressions = [
  'patient.email',
  'patient.phone',
  'patient.whatsapp',
  'patient.address'
] as const

export type DataAvailableExpression = (typeof DataAvailableExpressions)[number]
```

- [ ] **Step 3.6: Re-export from index**

Replace `shared/src/index.ts` with:
```ts
export * from './schemas/channels'
export * from './schemas/format'
export * from './schemas/expressions'
```

- [ ] **Step 3.7: Run tests, verify PASS**

Run:
```bash
pnpm --filter @rainpath/shared test
```
Expected: 3 test files (one test file with 7 assertions) all PASS.

- [ ] **Step 3.8: Commit**

Run:
```bash
git add shared/src/schemas shared/src/index.ts shared/tests/constants.test.ts
git commit -m "feat(shared): add channel statuses, format rules, and data-available expressions"
```

---

## Task 4: Primitive Zod schemas (Position, GraphEdge, START_Y)

**Files:**
- Create: `shared/src/constants.ts`
- Create: `shared/src/schemas/primitives.ts`
- Create: `shared/tests/primitives.test.ts`
- Modify: `shared/src/index.ts`

- [ ] **Step 4.1: Write failing test**

Write `shared/tests/primitives.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { Position, GraphEdge } from '../src/schemas/primitives'
import { START_Y } from '../src/constants'

describe('START_Y', () => {
  it('exports a constant of 200', () => {
    expect(START_Y).toBe(200)
  })
})

describe('Position', () => {
  it('parses valid coordinates', () => {
    expect(Position.parse({ x: 0, y: 200 })).toEqual({ x: 0, y: 200 })
  })
  it('rejects missing fields', () => {
    expect(() => Position.parse({ x: 0 })).toThrow()
  })
})

describe('GraphEdge', () => {
  it('parses a minimal edge', () => {
    expect(GraphEdge.parse({
      id: 'e1', source: 'n1', target: 'n2', daysAfter: 3
    })).toMatchObject({ id: 'e1', source: 'n1', target: 'n2', daysAfter: 3 })
  })
  it('accepts optional sourceHandle', () => {
    const e = GraphEdge.parse({
      id: 'e1', source: 'n1', target: 'n2', daysAfter: 0, sourceHandle: 'success'
    })
    expect(e.sourceHandle).toBe('success')
  })
  it('rejects negative daysAfter', () => {
    expect(() => GraphEdge.parse({
      id: 'e1', source: 'n1', target: 'n2', daysAfter: -1
    })).toThrow()
  })
  it('rejects non-integer daysAfter', () => {
    expect(() => GraphEdge.parse({
      id: 'e1', source: 'n1', target: 'n2', daysAfter: 1.5
    })).toThrow()
  })
})
```

- [ ] **Step 4.2: Run test, verify FAIL**

Run:
```bash
pnpm --filter @rainpath/shared test
```
Expected: FAIL — modules not found.

- [ ] **Step 4.3: Create `shared/src/constants.ts`**

Write `shared/src/constants.ts`:
```ts
/** Y coordinate where the start node is anchored on every workflow. */
export const START_Y = 200
```

- [ ] **Step 4.4: Create `shared/src/schemas/primitives.ts`**

Write `shared/src/schemas/primitives.ts`:
```ts
import { z } from 'zod'

export const Position = z.object({
  x: z.number(),
  y: z.number()
})
export type Position = z.infer<typeof Position>

export const GraphEdge = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  daysAfter: z.number().int().min(0)
})
export type GraphEdge = z.infer<typeof GraphEdge>
```

- [ ] **Step 4.5: Update index**

Replace `shared/src/index.ts` with:
```ts
export * from './constants'
export * from './schemas/channels'
export * from './schemas/format'
export * from './schemas/expressions'
export * from './schemas/primitives'
```

- [ ] **Step 4.6: Run tests, verify PASS**

Run:
```bash
pnpm --filter @rainpath/shared test
```
Expected: All tests pass.

- [ ] **Step 4.7: Commit**

```bash
git add shared/src/constants.ts shared/src/schemas/primitives.ts shared/src/index.ts shared/tests/primitives.test.ts
git commit -m "feat(shared): add Position and GraphEdge primitives, START_Y constant"
```

---

## Task 5: NodeData discriminated union (start, end, send_*, condition)

**Files:**
- Create: `shared/src/schemas/output-config.ts`
- Create: `shared/src/schemas/node-data.ts`
- Create: `shared/tests/node-data.test.ts`
- Modify: `shared/src/schemas/primitives.ts` (add GraphNode and Graph)
- Modify: `shared/src/index.ts`

- [ ] **Step 5.1: Write failing test for OutputConfig and NodeData**

Write `shared/tests/node-data.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { OutputConfig } from '../src/schemas/output-config'
import { NodeData, EmailParams, SmsParams, WhatsAppParams, PostalParams, ConditionParams } from '../src/schemas/node-data'
import { GraphNode, Graph } from '../src/schemas/primitives'

describe('OutputConfig', () => {
  it('parses single mode', () => {
    expect(OutputConfig.parse({ mode: 'single' }).mode).toBe('single')
  })
  it('parses simple mode with successCondition', () => {
    const out = OutputConfig.parse({
      mode: 'simple',
      successCondition: { statuses: ['delivered', 'opened'] }
    })
    expect(out.mode).toBe('simple')
  })
  it('parses multi mode with outputs', () => {
    const out = OutputConfig.parse({
      mode: 'multi',
      outputs: [
        { id: 'engaged', label: 'Engagé', condition: { statuses: ['opened'] } },
        { id: 'rejected', label: 'Rejeté', condition: { statuses: ['bounced'] } }
      ]
    })
    expect(out.mode).toBe('multi')
    if (out.mode === 'multi') expect(out.outputs.length).toBe(2)
  })
  it('rejects empty multi outputs', () => {
    expect(() => OutputConfig.parse({ mode: 'multi', outputs: [] })).toThrow()
  })
  it('rejects empty successCondition statuses', () => {
    expect(() => OutputConfig.parse({ mode: 'simple', successCondition: { statuses: [] } })).toThrow()
  })
})

describe('EmailParams', () => {
  it('caps subject at 78 chars', () => {
    expect(() => EmailParams.parse({
      subject: 'a'.repeat(79),
      body: 'ok',
      output: { mode: 'single' }
    })).toThrow()
  })
  it('caps body at 100_000 chars', () => {
    expect(() => EmailParams.parse({
      subject: '',
      body: 'a'.repeat(100_001),
      output: { mode: 'single' }
    })).toThrow()
  })
  it('accepts a valid email params', () => {
    expect(EmailParams.parse({
      subject: 'Relance',
      body: 'Bonjour…',
      output: { mode: 'simple', successCondition: { statuses: ['delivered'] } }
    })).toMatchObject({ subject: 'Relance' })
  })
})

describe('SmsParams', () => {
  it('caps body at 459', () => {
    expect(() => SmsParams.parse({
      body: 'a'.repeat(460),
      output: { mode: 'single' }
    })).toThrow()
  })
})

describe('WhatsAppParams', () => {
  it('caps body at 4096', () => {
    expect(() => WhatsAppParams.parse({
      body: 'a'.repeat(4097),
      output: { mode: 'single' }
    })).toThrow()
  })
})

describe('PostalParams', () => {
  it('has tracked field', () => {
    expect(PostalParams.parse({
      body: 'lettre',
      tracked: true,
      output: { mode: 'single' }
    }).tracked).toBe(true)
  })
})

describe('ConditionParams', () => {
  it('accepts data_available with patient.email', () => {
    expect(ConditionParams.parse({
      conditionType: 'data_available',
      expression: 'patient.email'
    }).conditionType).toBe('data_available')
  })
  it('rejects unknown conditionType', () => {
    expect(() => ConditionParams.parse({
      conditionType: 'other',
      expression: 'x'
    })).toThrow()
  })
})

describe('NodeData', () => {
  it('parses start node', () => {
    expect(NodeData.parse({ kind: 'start' }).kind).toBe('start')
  })
  it('parses end node', () => {
    expect(NodeData.parse({ kind: 'end' }).kind).toBe('end')
  })
  it('parses send_email node with params', () => {
    const n = NodeData.parse({
      kind: 'send_email',
      params: { subject: '', body: '', output: { mode: 'single' } }
    })
    expect(n.kind).toBe('send_email')
  })
})

describe('GraphNode', () => {
  it('parses a valid node', () => {
    expect(GraphNode.parse({
      id: 'n1',
      position: { x: 0, y: 200 },
      data: { kind: 'start' }
    }).id).toBe('n1')
  })
})

describe('Graph', () => {
  it('parses empty nodes/edges arrays', () => {
    expect(Graph.parse({ nodes: [], edges: [] })).toEqual({ nodes: [], edges: [] })
  })
})
```

- [ ] **Step 5.2: Run test, verify FAIL**

Run:
```bash
pnpm --filter @rainpath/shared test
```
Expected: FAIL — modules not found.

- [ ] **Step 5.3: Create `shared/src/schemas/output-config.ts`**

Write `shared/src/schemas/output-config.ts`:
```ts
import { z } from 'zod'

export const OutputCondition = z.object({
  statuses: z.array(z.string().min(1)).min(1)
})
export type OutputCondition = z.infer<typeof OutputCondition>

const SingleOutput = z.object({
  mode: z.literal('single')
})

const SimpleOutput = z.object({
  mode: z.literal('simple'),
  successCondition: OutputCondition
})

const MultiOutput = z.object({
  mode: z.literal('multi'),
  outputs: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    condition: OutputCondition
  })).min(1)
})

export const OutputConfig = z.discriminatedUnion('mode', [SingleOutput, SimpleOutput, MultiOutput])
export type OutputConfig = z.infer<typeof OutputConfig>
```

- [ ] **Step 5.4: Create `shared/src/schemas/node-data.ts`**

Write `shared/src/schemas/node-data.ts`:
```ts
import { z } from 'zod'
import { CHANNEL_FORMAT_RULES } from './format'
import { OutputConfig } from './output-config'

export const EmailParams = z.object({
  subject: z.string().max(CHANNEL_FORMAT_RULES.email.subject.maxLength).default(''),
  body:    z.string().max(CHANNEL_FORMAT_RULES.email.body.maxLength).default(''),
  output:  OutputConfig
})
export type EmailParams = z.infer<typeof EmailParams>

export const SmsParams = z.object({
  body:   z.string().max(CHANNEL_FORMAT_RULES.sms.body.maxLength).default(''),
  output: OutputConfig
})
export type SmsParams = z.infer<typeof SmsParams>

export const WhatsAppParams = z.object({
  body:   z.string().max(CHANNEL_FORMAT_RULES.whatsapp.body.maxLength).default(''),
  output: OutputConfig
})
export type WhatsAppParams = z.infer<typeof WhatsAppParams>

export const PostalParams = z.object({
  body:    z.string().max(CHANNEL_FORMAT_RULES.postal.body.maxLength).default(''),
  tracked: z.boolean().default(false),
  output:  OutputConfig
})
export type PostalParams = z.infer<typeof PostalParams>

export const ConditionParams = z.object({
  conditionType: z.enum(['data_available', 'previous_result']),
  expression: z.string()
})
export type ConditionParams = z.infer<typeof ConditionParams>

export const NodeData = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('start') }),
  z.object({ kind: z.literal('end') }),
  z.object({ kind: z.literal('send_email'),    params: EmailParams }),
  z.object({ kind: z.literal('send_sms'),      params: SmsParams }),
  z.object({ kind: z.literal('send_whatsapp'), params: WhatsAppParams }),
  z.object({ kind: z.literal('send_postal'),   params: PostalParams }),
  z.object({ kind: z.literal('condition'),     params: ConditionParams })
])
export type NodeData = z.infer<typeof NodeData>
export type NodeKind = NodeData['kind']
```

- [ ] **Step 5.5: Extend `shared/src/schemas/primitives.ts` with GraphNode and Graph**

Replace `shared/src/schemas/primitives.ts` with:
```ts
import { z } from 'zod'
import { NodeData } from './node-data'

export const Position = z.object({
  x: z.number(),
  y: z.number()
})
export type Position = z.infer<typeof Position>

export const GraphNode = z.object({
  id: z.string(),
  position: Position,
  data: NodeData
})
export type GraphNode = z.infer<typeof GraphNode>

export const GraphEdge = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  daysAfter: z.number().int().min(0)
})
export type GraphEdge = z.infer<typeof GraphEdge>

export const Graph = z.object({
  nodes: z.array(GraphNode),
  edges: z.array(GraphEdge)
})
export type Graph = z.infer<typeof Graph>
```

- [ ] **Step 5.6: Update `shared/src/index.ts`**

Replace with:
```ts
export * from './constants'
export * from './schemas/channels'
export * from './schemas/format'
export * from './schemas/expressions'
export * from './schemas/output-config'
export * from './schemas/node-data'
export * from './schemas/primitives'
```

- [ ] **Step 5.7: Run tests, verify PASS**

Run:
```bash
pnpm --filter @rainpath/shared test
```
Expected: All previously written tests pass.

- [ ] **Step 5.8: Commit**

```bash
git add shared/src/schemas shared/src/index.ts shared/tests/node-data.test.ts
git commit -m "feat(shared): add OutputConfig and NodeData discriminated union with per-channel param limits"
```

---

## Task 6: NodeTemplate schema and API DTOs

**Files:**
- Create: `shared/src/schemas/node-template.ts`
- Create: `shared/src/schemas/api-dtos.ts`
- Create: `shared/tests/node-template.test.ts`
- Modify: `shared/src/index.ts`

- [ ] **Step 6.1: Write failing test**

Write `shared/tests/node-template.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { NodeTemplate, NodeTemplateBody, NodeTemplateKind } from '../src/schemas/node-template'
import { CreateWorkflowDto, UpdateWorkflowDto } from '../src/schemas/api-dtos'

describe('NodeTemplateKind', () => {
  it('lists exactly send_* and condition (no start/end)', () => {
    expect(() => NodeTemplateKind.parse('start')).toThrow()
    expect(() => NodeTemplateKind.parse('end')).toThrow()
    expect(NodeTemplateKind.parse('send_email')).toBe('send_email')
    expect(NodeTemplateKind.parse('condition')).toBe('condition')
  })
})

describe('NodeTemplateBody', () => {
  it('parses a valid send_email template body', () => {
    expect(NodeTemplateBody.parse({
      kind: 'send_email',
      params: {
        subject: 'Hello',
        body: 'Bonjour',
        output: { mode: 'single' }
      }
    }).kind).toBe('send_email')
  })
  it('rejects wrong params for kind', () => {
    expect(() => NodeTemplateBody.parse({
      kind: 'send_sms',
      params: { subject: 'x' /* sms has no subject */ }
    })).toThrow()
  })
})

describe('NodeTemplate', () => {
  it('parses a full template with metadata', () => {
    const t = NodeTemplate.parse({
      id: 't1',
      name: 'Email première relance',
      kind: 'send_email',
      params: {
        subject: 'Sujet',
        body: '',
        output: { mode: 'single' }
      },
      createdAt: '2026-05-28T00:00:00.000Z',
      updatedAt: '2026-05-28T00:00:00.000Z'
    })
    expect(t.name).toBe('Email première relance')
  })
})

describe('CreateWorkflowDto', () => {
  it('accepts {name} alone', () => {
    expect(CreateWorkflowDto.parse({ name: 'My Workflow' }).name).toBe('My Workflow')
  })
  it('accepts {name, description}', () => {
    expect(CreateWorkflowDto.parse({
      name: 'wf', description: 'desc'
    }).description).toBe('desc')
  })
  it('accepts optional graph for import', () => {
    expect(CreateWorkflowDto.parse({
      name: 'imported',
      graph: { nodes: [], edges: [] }
    }).graph).toEqual({ nodes: [], edges: [] })
  })
  it('rejects empty name', () => {
    expect(() => CreateWorkflowDto.parse({ name: '' })).toThrow()
  })
})

describe('UpdateWorkflowDto', () => {
  it('accepts partial', () => {
    expect(UpdateWorkflowDto.parse({}).name).toBeUndefined()
    expect(UpdateWorkflowDto.parse({ name: 'new' }).name).toBe('new')
  })
})
```

- [ ] **Step 6.2: Run test, verify FAIL**

Run:
```bash
pnpm --filter @rainpath/shared test
```
Expected: FAIL — modules not found.

- [ ] **Step 6.3: Create `shared/src/schemas/node-template.ts`**

Write `shared/src/schemas/node-template.ts`:
```ts
import { z } from 'zod'
import { EmailParams, SmsParams, WhatsAppParams, PostalParams, ConditionParams } from './node-data'

export const NodeTemplateKind = z.enum(['send_email', 'send_sms', 'send_whatsapp', 'send_postal', 'condition'])
export type NodeTemplateKind = z.infer<typeof NodeTemplateKind>

export const NodeTemplateBody = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('send_email'),    params: EmailParams }),
  z.object({ kind: z.literal('send_sms'),      params: SmsParams }),
  z.object({ kind: z.literal('send_whatsapp'), params: WhatsAppParams }),
  z.object({ kind: z.literal('send_postal'),   params: PostalParams }),
  z.object({ kind: z.literal('condition'),     params: ConditionParams })
])
export type NodeTemplateBody = z.infer<typeof NodeTemplateBody>

export const NodeTemplate = NodeTemplateBody.and(z.object({
  id:          z.string(),
  name:        z.string().min(1),
  description: z.string().optional(),
  createdAt:   z.string(),
  updatedAt:   z.string()
}))
export type NodeTemplate = z.infer<typeof NodeTemplate>
```

- [ ] **Step 6.4: Create `shared/src/schemas/api-dtos.ts`**

Write `shared/src/schemas/api-dtos.ts`:
```ts
import { z } from 'zod'
import { Graph } from './primitives'
import { NodeTemplateBody } from './node-template'

// Workflows
export const CreateWorkflowDto = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  graph: Graph.optional()
})
export type CreateWorkflowDto = z.infer<typeof CreateWorkflowDto>

export const UpdateWorkflowDto = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  graph: Graph.optional()
})
export type UpdateWorkflowDto = z.infer<typeof UpdateWorkflowDto>

export const DuplicateWorkflowDto = z.object({
  name: z.string().min(1).optional()
})
export type DuplicateWorkflowDto = z.infer<typeof DuplicateWorkflowDto>

// Node templates
export const CreateNodeTemplateDto = z.intersection(
  NodeTemplateBody,
  z.object({
    name: z.string().min(1),
    description: z.string().optional()
  })
)
export type CreateNodeTemplateDto = z.infer<typeof CreateNodeTemplateDto>

export const UpdateNodeTemplateDto = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  params: z.unknown().optional() // validated against kind in the service
})
export type UpdateNodeTemplateDto = z.infer<typeof UpdateNodeTemplateDto>

// Patient profile
export const CreatePatientProfileDto = z.object({
  name: z.string().min(1),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  address: z.string().nullable().optional()
})
export type CreatePatientProfileDto = z.infer<typeof CreatePatientProfileDto>

export const UpdatePatientProfileDto = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  address: z.string().nullable().optional()
})
export type UpdatePatientProfileDto = z.infer<typeof UpdatePatientProfileDto>

// Patient run
export const CreatePatientRunDto = z.object({
  patientId: z.string().min(1)
})
export type CreatePatientRunDto = z.infer<typeof CreatePatientRunDto>

export const AdvancePatientRunDto = z.object({
  outcome: z.string().optional()
})
export type AdvancePatientRunDto = z.infer<typeof AdvancePatientRunDto>
```

- [ ] **Step 6.5: Update index**

Replace `shared/src/index.ts` with:
```ts
export * from './constants'
export * from './schemas/channels'
export * from './schemas/format'
export * from './schemas/expressions'
export * from './schemas/output-config'
export * from './schemas/node-data'
export * from './schemas/primitives'
export * from './schemas/node-template'
export * from './schemas/api-dtos'
```

- [ ] **Step 6.6: Run tests, verify PASS**

Run:
```bash
pnpm --filter @rainpath/shared test
```
Expected: All tests pass.

- [ ] **Step 6.7: Commit**

```bash
git add shared/src/schemas/node-template.ts shared/src/schemas/api-dtos.ts shared/src/index.ts shared/tests/node-template.test.ts
git commit -m "feat(shared): add NodeTemplate schema and API DTOs"
```

---

## Task 7: `computeXPositions` algorithm

**Files:**
- Create: `shared/src/algorithms/compute-x-positions.ts`
- Create: `shared/tests/compute-x-positions.test.ts`
- Modify: `shared/src/index.ts`

- [ ] **Step 7.1: Write failing tests (spec §5.4)**

Write `shared/tests/compute-x-positions.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { computeXPositions } from '../src/algorithms/compute-x-positions'
import type { Graph } from '../src/schemas/primitives'

const startNode = { id: 's', position: { x: 0, y: 200 }, data: { kind: 'start' as const } }
const endNode = (id = 'e') => ({ id, position: { x: 0, y: 200 }, data: { kind: 'end' as const } })
const sendNode = (id: string) => ({
  id, position: { x: 0, y: 200 },
  data: { kind: 'send_email' as const, params: { subject: '', body: '', output: { mode: 'single' as const } } }
})
const edge = (id: string, source: string, target: string, daysAfter: number, sourceHandle?: string) =>
  ({ id, source, target, daysAfter, sourceHandle })

describe('computeXPositions', () => {
  it('places start at X=0', () => {
    const g: Graph = { nodes: [startNode], edges: [] }
    const x = computeXPositions(g)
    expect(x.get('s')).toBe(0)
  })

  it('propagates daysAfter on a linear path', () => {
    const g: Graph = {
      nodes: [startNode, sendNode('a'), endNode()],
      edges: [edge('e1', 's', 'a', 7), edge('e2', 'a', 'e', 8)]
    }
    const x = computeXPositions(g)
    expect(x.get('s')).toBe(0)
    expect(x.get('a')).toBe(7)
    expect(x.get('e')).toBe(15)
  })

  it('uses max() on convergence', () => {
    // s -3-> a -2-> c
    //   \-5-> b -1-/
    const g: Graph = {
      nodes: [startNode, sendNode('a'), sendNode('b'), sendNode('c')],
      edges: [
        edge('e1', 's', 'a', 3),
        edge('e2', 's', 'b', 5),
        edge('e3', 'a', 'c', 2),
        edge('e4', 'b', 'c', 1)
      ]
    }
    const x = computeXPositions(g)
    expect(x.get('c')).toBe(6) // max(3+2=5, 5+1=6)
  })

  it('throws on cycle', () => {
    const g: Graph = {
      nodes: [startNode, sendNode('a'), sendNode('b')],
      edges: [
        edge('e1', 's', 'a', 1),
        edge('e2', 'a', 'b', 1),
        edge('e3', 'b', 'a', 0)
      ]
    }
    expect(() => computeXPositions(g)).toThrow(/cycle/i)
  })

  it('throws when start is missing', () => {
    const g: Graph = { nodes: [endNode()], edges: [] }
    expect(() => computeXPositions(g)).toThrow(/start/i)
  })

  it('preserves orphan X from existingX', () => {
    const orphan = sendNode('o')
    orphan.position.x = 42
    const g: Graph = {
      nodes: [startNode, orphan, endNode()],
      edges: [edge('e1', 's', 'e', 5)]
    }
    const x = computeXPositions(g, new Map([['o', 42]]))
    expect(x.get('s')).toBe(0)
    expect(x.get('e')).toBe(5)
    expect(x.get('o')).toBe(42) // orphan preserved
  })

  it('defaults orphan X to 0 when no existingX provided', () => {
    const g: Graph = {
      nodes: [startNode, sendNode('orphan'), endNode()],
      edges: [edge('e1', 's', 'e', 5)]
    }
    const x = computeXPositions(g)
    expect(x.get('orphan')).toBe(0)
  })

  it('handles multiple ends', () => {
    const g: Graph = {
      nodes: [startNode, sendNode('a'), endNode('e1'), endNode('e2')],
      edges: [
        edge('e_sa', 's', 'a', 1),
        edge('e_ae1', 'a', 'e1', 2),
        edge('e_ae2', 'a', 'e2', 10)
      ]
    }
    const x = computeXPositions(g)
    expect(x.get('e1')).toBe(3)
    expect(x.get('e2')).toBe(11)
  })
})
```

- [ ] **Step 7.2: Run test, verify FAIL**

Run:
```bash
pnpm --filter @rainpath/shared test
```
Expected: FAIL — `computeXPositions` not found.

- [ ] **Step 7.3: Implement `computeXPositions`**

Write `shared/src/algorithms/compute-x-positions.ts`:
```ts
import type { Graph } from '../schemas/primitives'

/**
 * Compute X positions for every node in the graph based on edge.daysAfter.
 *
 * - The start node anchors at X=0.
 * - For any node reachable from start: X(node) = max over incoming edges of (X(source) + edge.daysAfter).
 * - Orphan nodes (not reachable from start) keep their `existingX` value, or 0 if absent.
 * - Throws on cycle within the connected component, or when no start node exists.
 */
export function computeXPositions(
  graph: Graph,
  existingX?: Map<string, number>
): Map<string, number> {
  const startNode = graph.nodes.find(n => n.data.kind === 'start')
  if (!startNode) {
    throw new Error('computeXPositions: no start node found')
  }

  // Build adjacency list (source -> outgoing edges) and incoming-degree map.
  const outgoing = new Map<string, typeof graph.edges>()
  const inDegree = new Map<string, number>()
  for (const n of graph.nodes) {
    outgoing.set(n.id, [])
    inDegree.set(n.id, 0)
  }
  for (const e of graph.edges) {
    if (!outgoing.has(e.source) || !inDegree.has(e.target)) continue
    outgoing.get(e.source)!.push(e)
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
  }

  // Discover the connected component reachable from the start (BFS following outgoing edges).
  const connected = new Set<string>([startNode.id])
  const stack = [startNode.id]
  while (stack.length > 0) {
    const id = stack.pop()!
    for (const e of outgoing.get(id) ?? []) {
      if (!connected.has(e.target)) {
        connected.add(e.target)
        stack.push(e.target)
      }
    }
  }

  // Initialize X.
  const x = new Map<string, number>()
  x.set(startNode.id, 0)
  for (const n of graph.nodes) {
    if (!connected.has(n.id)) {
      x.set(n.id, existingX?.get(n.id) ?? 0)
    }
  }

  // Kahn's topological sort restricted to the connected component.
  const remainingIn = new Map<string, number>()
  for (const id of connected) {
    let count = 0
    for (const e of graph.edges) {
      if (e.target === id && connected.has(e.source)) count++
    }
    remainingIn.set(id, count)
  }

  const queue: string[] = [startNode.id]
  let visited = 0
  while (queue.length > 0) {
    const id = queue.shift()!
    visited++
    for (const e of outgoing.get(id) ?? []) {
      if (!connected.has(e.target)) continue
      const candidate = (x.get(id) ?? 0) + e.daysAfter
      const current = x.get(e.target)
      if (current === undefined || candidate > current) {
        x.set(e.target, candidate)
      }
      const r = (remainingIn.get(e.target) ?? 0) - 1
      remainingIn.set(e.target, r)
      if (r === 0) queue.push(e.target)
    }
  }

  if (visited < connected.size) {
    throw new Error('computeXPositions: cycle detected in connected component')
  }

  return x
}
```

- [ ] **Step 7.4: Update index**

Append to `shared/src/index.ts`:
```ts
export * from './algorithms/compute-x-positions'
```

- [ ] **Step 7.5: Run tests, verify PASS**

Run:
```bash
pnpm --filter @rainpath/shared test
```
Expected: All `computeXPositions` tests pass.

- [ ] **Step 7.6: Commit**

```bash
git add shared/src/algorithms/compute-x-positions.ts shared/src/index.ts shared/tests/compute-x-positions.test.ts
git commit -m "feat(shared): implement computeXPositions with topological propagation and orphan tolerance"
```

---

## Task 8: `validateGraph` (structural + per-output + format)

**Files:**
- Create: `shared/src/algorithms/validate-graph.ts`
- Create: `shared/tests/validate-graph.test.ts`
- Modify: `shared/src/index.ts`

- [ ] **Step 8.1: Write failing tests**

Write `shared/tests/validate-graph.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { validateGraph } from '../src/algorithms/validate-graph'
import { START_Y } from '../src/constants'

const startNode = { id: 's', position: { x: 0, y: START_Y }, data: { kind: 'start' as const } }
const endNode = (id = 'e') => ({ id, position: { x: 1, y: START_Y }, data: { kind: 'end' as const } })
const emailNode = (id: string, output: any = { mode: 'single' }) => ({
  id, position: { x: 5, y: START_Y },
  data: { kind: 'send_email' as const, params: { subject: '', body: '', output } }
})
const edge = (id: string, source: string, target: string, daysAfter = 1, sourceHandle?: string) =>
  ({ id, source, target, daysAfter, sourceHandle })

describe('validateGraph — structural', () => {
  it('accepts a minimal valid graph (start → end)', () => {
    const r = validateGraph({
      nodes: [startNode, endNode()],
      edges: [edge('e1', 's', 'e', 5)]
    })
    expect(r.errors).toHaveLength(0)
  })

  it('rejects missing start', () => {
    const r = validateGraph({ nodes: [endNode()], edges: [] })
    expect(r.errors.some(e => e.code === 'no_start')).toBe(true)
  })

  it('rejects multiple starts', () => {
    const second = { ...startNode, id: 's2' }
    const r = validateGraph({ nodes: [startNode, second, endNode()], edges: [edge('e1', 's', 'e', 1)] })
    expect(r.errors.some(e => e.code === 'multiple_starts')).toBe(true)
  })

  it('rejects no end', () => {
    const r = validateGraph({ nodes: [startNode], edges: [] })
    expect(r.errors.some(e => e.code === 'no_end')).toBe(true)
  })

  it('rejects edge to non-existent node', () => {
    const r = validateGraph({ nodes: [startNode, endNode()], edges: [edge('e1', 's', 'ghost', 1)] })
    expect(r.errors.some(e => e.code === 'edge_dangling')).toBe(true)
  })

  it('rejects self-loop', () => {
    const r = validateGraph({
      nodes: [startNode, emailNode('a'), endNode()],
      edges: [
        edge('e1', 's', 'a', 1),
        edge('e_self', 'a', 'a', 0),
        edge('e2', 'a', 'e', 1)
      ]
    })
    expect(r.errors.some(e => e.code === 'self_loop')).toBe(true)
  })

  it('rejects cycle', () => {
    const r = validateGraph({
      nodes: [startNode, emailNode('a'), emailNode('b'), endNode()],
      edges: [
        edge('e1', 's', 'a', 1),
        edge('e2', 'a', 'b', 1),
        edge('e3', 'b', 'a', 1),
        edge('e4', 'b', 'e', 1)
      ]
    })
    expect(r.errors.some(e => e.code === 'cycle')).toBe(true)
  })

  it('rejects edge entering start', () => {
    const r = validateGraph({
      nodes: [startNode, emailNode('a'), endNode()],
      edges: [edge('e1', 'a', 's', 1), edge('e2', 's', 'e', 1)]
    })
    expect(r.errors.some(e => e.code === 'edge_into_start')).toBe(true)
  })

  it('rejects edge leaving end', () => {
    const r = validateGraph({
      nodes: [startNode, endNode(), emailNode('a')],
      edges: [edge('e1', 's', 'e', 1), edge('e2', 'e', 'a', 1)]
    })
    expect(r.errors.some(e => e.code === 'edge_from_end')).toBe(true)
  })

  it('rejects duplicate sourceHandle on same node', () => {
    const node = emailNode('a', { mode: 'simple', successCondition: { statuses: ['delivered'] } })
    const r = validateGraph({
      nodes: [startNode, node, endNode('e1'), endNode('e2')],
      edges: [
        edge('e_sa', 's', 'a', 1),
        edge('e_a_e1', 'a', 'e1', 1, 'success'),
        edge('e_a_e2', 'a', 'e2', 1, 'success') // duplicate handle
      ]
    })
    expect(r.errors.some(e => e.code === 'duplicate_source_handle')).toBe(true)
  })
})

describe('validateGraph — send_* output rules', () => {
  it('rejects send_postal tracked=false with multi mode', () => {
    const node = {
      id: 'p', position: { x: 5, y: 200 },
      data: {
        kind: 'send_postal' as const,
        params: {
          body: '',
          tracked: false,
          output: {
            mode: 'multi' as const,
            outputs: [{ id: 'sent', label: 'Envoyé', condition: { statuses: ['sent'] } }]
          }
        }
      }
    }
    const r = validateGraph({
      nodes: [startNode, node, endNode()],
      edges: [edge('e1', 's', 'p', 1), edge('e2', 'p', 'e', 1, 'sent')]
    })
    expect(r.errors.some(e => e.code === 'postal_untracked_must_be_single')).toBe(true)
  })

  it('rejects status outside CHANNEL_STATUSES', () => {
    const node = emailNode('a', {
      mode: 'simple',
      successCondition: { statuses: ['nonsense_status'] }
    })
    const r = validateGraph({
      nodes: [startNode, node, endNode()],
      edges: [edge('e1', 's', 'a', 1), edge('e2', 'a', 'e', 1, 'success')]
    })
    expect(r.errors.some(e => e.code === 'status_not_in_channel')).toBe(true)
  })

  it('rejects multi outputs sharing a status', () => {
    const node = emailNode('a', {
      mode: 'multi',
      outputs: [
        { id: 'a', label: 'A', condition: { statuses: ['opened'] } },
        { id: 'b', label: 'B', condition: { statuses: ['opened'] } } // same status
      ]
    })
    const r = validateGraph({
      nodes: [startNode, node, endNode('e1'), endNode('e2')],
      edges: [
        edge('e_sa', 's', 'a', 1),
        edge('e_ae1', 'a', 'e1', 1, 'a'),
        edge('e_ae2', 'a', 'e2', 1, 'b')
      ]
    })
    expect(r.errors.some(e => e.code === 'status_overlap_in_multi')).toBe(true)
  })

  it('rejects sourceHandle in simple mode other than success/failure', () => {
    const node = emailNode('a', {
      mode: 'simple',
      successCondition: { statuses: ['opened'] }
    })
    const r = validateGraph({
      nodes: [startNode, node, endNode()],
      edges: [edge('e1', 's', 'a', 1), edge('e2', 'a', 'e', 1, 'weird_handle')]
    })
    expect(r.errors.some(e => e.code === 'invalid_source_handle_for_simple')).toBe(true)
  })

  it('rejects sourceHandle on single mode', () => {
    const node = emailNode('a', { mode: 'single' })
    const r = validateGraph({
      nodes: [startNode, node, endNode()],
      edges: [edge('e1', 's', 'a', 1), edge('e2', 'a', 'e', 1, 'unwanted')]
    })
    expect(r.errors.some(e => e.code === 'invalid_source_handle_for_single')).toBe(true)
  })

  it('warns on incomplete multi coverage', () => {
    // email has 6 statuses; cover only 'opened'
    const node = emailNode('a', {
      mode: 'multi',
      outputs: [{ id: 'eng', label: 'Engagé', condition: { statuses: ['opened'] } }]
    })
    const r = validateGraph({
      nodes: [startNode, node, endNode()],
      edges: [edge('e1', 's', 'a', 1), edge('e2', 'a', 'e', 1, 'eng')]
    })
    expect(r.warnings.some(w => w.code === 'incomplete_status_coverage')).toBe(true)
  })
})

describe('validateGraph — condition rules', () => {
  it('accepts data_available with patient.email', () => {
    const cond = {
      id: 'c', position: { x: 5, y: 200 },
      data: {
        kind: 'condition' as const,
        params: { conditionType: 'data_available' as const, expression: 'patient.email' }
      }
    }
    const r = validateGraph({
      nodes: [startNode, cond, endNode('et'), endNode('ef')],
      edges: [
        edge('e_sc', 's', 'c', 1),
        edge('e_ct', 'c', 'et', 0, 'true'),
        edge('e_cf', 'c', 'ef', 0, 'false')
      ]
    })
    expect(r.errors).toHaveLength(0)
  })

  it('rejects data_available with unknown expression', () => {
    const cond = {
      id: 'c', position: { x: 5, y: 200 },
      data: {
        kind: 'condition' as const,
        params: { conditionType: 'data_available' as const, expression: 'patient.unknown' }
      }
    }
    const r = validateGraph({
      nodes: [startNode, cond, endNode('et'), endNode('ef')],
      edges: [
        edge('e_sc', 's', 'c', 1),
        edge('e_ct', 'c', 'et', 0, 'true'),
        edge('e_cf', 'c', 'ef', 0, 'false')
      ]
    })
    expect(r.errors.some(e => e.code === 'unknown_data_available_expression')).toBe(true)
  })

  it('rejects condition sourceHandle other than true/false', () => {
    const cond = {
      id: 'c', position: { x: 5, y: 200 },
      data: {
        kind: 'condition' as const,
        params: { conditionType: 'data_available' as const, expression: 'patient.email' }
      }
    }
    const r = validateGraph({
      nodes: [startNode, cond, endNode()],
      edges: [
        edge('e_sc', 's', 'c', 1),
        edge('e_ce', 'c', 'e', 0, 'maybe')
      ]
    })
    expect(r.errors.some(e => e.code === 'invalid_source_handle_for_condition')).toBe(true)
  })
})

describe('validateGraph — start position', () => {
  it('rejects start.position.x !== 0', () => {
    const movedStart = { ...startNode, position: { x: 10, y: 200 } }
    const r = validateGraph({
      nodes: [movedStart, endNode()],
      edges: [edge('e1', 's', 'e', 5)]
    })
    expect(r.errors.some(e => e.code === 'start_position_x_must_be_zero')).toBe(true)
  })
  it('rejects start.position.y !== START_Y', () => {
    const movedStart = { ...startNode, position: { x: 0, y: 999 } }
    const r = validateGraph({
      nodes: [movedStart, endNode()],
      edges: [edge('e1', 's', 'e', 5)]
    })
    expect(r.errors.some(e => e.code === 'start_position_y_must_be_default')).toBe(true)
  })
})
```

- [ ] **Step 8.2: Run, verify FAIL**

Run:
```bash
pnpm --filter @rainpath/shared test
```
Expected: FAIL — `validateGraph` not found.

- [ ] **Step 8.3: Implement `validateGraph`**

Write `shared/src/algorithms/validate-graph.ts`:
```ts
import type { Graph, GraphEdge, GraphNode } from '../schemas/primitives'
import type { NodeData } from '../schemas/node-data'
import { CHANNEL_STATUSES, type ChannelKey } from '../schemas/channels'
import { DataAvailableExpressions } from '../schemas/expressions'
import { START_Y } from '../constants'

export interface ValidationError {
  code: string
  message: string
  nodeId?: string
  edgeId?: string
}

export interface ValidationWarning {
  code: string
  message: string
  nodeId?: string
  missingStatuses?: string[]
}

export interface ValidationResult {
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

function channelKey(node: GraphNode): ChannelKey | null {
  switch (node.data.kind) {
    case 'send_email':    return 'email'
    case 'send_sms':      return 'sms'
    case 'send_whatsapp': return 'whatsapp'
    case 'send_postal':   return node.data.params.tracked ? 'postal_tracked' : 'postal_untracked'
    default: return null
  }
}

export function validateGraph(graph: Graph): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  const nodesById = new Map(graph.nodes.map(n => [n.id, n]))
  const starts = graph.nodes.filter(n => n.data.kind === 'start')
  const ends = graph.nodes.filter(n => n.data.kind === 'end')

  // Structural — start / end counts
  if (starts.length === 0) errors.push({ code: 'no_start', message: 'Le workflow doit avoir un nœud de départ' })
  if (starts.length > 1) errors.push({ code: 'multiple_starts', message: 'Un seul nœud de départ autorisé' })
  if (ends.length === 0) errors.push({ code: 'no_end', message: 'Le workflow doit avoir au moins un nœud de fin' })

  // Start position
  for (const s of starts) {
    if (s.position.x !== 0) {
      errors.push({ code: 'start_position_x_must_be_zero', message: 'Le nœud start doit être à X=0', nodeId: s.id })
    }
    if (s.position.y !== START_Y) {
      errors.push({ code: 'start_position_y_must_be_default', message: `Le nœud start doit être à Y=${START_Y}`, nodeId: s.id })
    }
  }

  // Edges — dangling / self-loop / into-start / from-end / duplicate handles
  const handleUsage = new Map<string, Set<string | undefined>>() // nodeId -> set of handles seen
  for (const e of graph.edges) {
    if (!nodesById.has(e.source) || !nodesById.has(e.target)) {
      errors.push({ code: 'edge_dangling', message: 'Une arête référence un nœud inexistant', edgeId: e.id })
      continue
    }
    if (e.source === e.target) {
      errors.push({ code: 'self_loop', message: 'Une arête ne peut pas relier un nœud à lui-même', edgeId: e.id })
    }
    if (nodesById.get(e.target)!.data.kind === 'start') {
      errors.push({ code: 'edge_into_start', message: 'Aucune arête ne peut entrer dans le nœud de départ', edgeId: e.id })
    }
    if (nodesById.get(e.source)!.data.kind === 'end') {
      errors.push({ code: 'edge_from_end', message: 'Aucune arête ne peut sortir d’un nœud de fin', edgeId: e.id })
    }
    const handles = handleUsage.get(e.source) ?? new Set()
    if (handles.has(e.sourceHandle)) {
      errors.push({
        code: 'duplicate_source_handle',
        message: 'Deux arêtes utilisent le même handle de sortie',
        edgeId: e.id, nodeId: e.source
      })
    }
    handles.add(e.sourceHandle)
    handleUsage.set(e.source, handles)
  }

  // Send node output rules
  for (const n of graph.nodes) {
    if (!n.data.kind.startsWith('send_')) continue
    const ck = channelKey(n)
    if (!ck) continue
    const channelStatuses = new Set<string>(CHANNEL_STATUSES[ck])

    const data = n.data as Extract<NodeData, { kind: 'send_email' | 'send_sms' | 'send_whatsapp' | 'send_postal' }>
    const output = data.params.output

    if (n.data.kind === 'send_postal' && !data.params.tracked && output.mode !== 'single') {
      errors.push({
        code: 'postal_untracked_must_be_single',
        message: 'Postal non suivi : seul le mode single est autorisé',
        nodeId: n.id
      })
    }

    if (output.mode === 'simple') {
      for (const s of output.successCondition.statuses) {
        if (!channelStatuses.has(s)) {
          errors.push({ code: 'status_not_in_channel', message: `Statut "${s}" inconnu pour ${ck}`, nodeId: n.id })
        }
      }
    }

    if (output.mode === 'multi') {
      const ids = new Set<string>()
      const seenStatuses = new Set<string>()
      for (const o of output.outputs) {
        if (ids.has(o.id)) {
          errors.push({ code: 'duplicate_output_id', message: `Identifiant de sortie en double : ${o.id}`, nodeId: n.id })
        }
        ids.add(o.id)
        for (const s of o.condition.statuses) {
          if (!channelStatuses.has(s)) {
            errors.push({ code: 'status_not_in_channel', message: `Statut "${s}" inconnu pour ${ck}`, nodeId: n.id })
          }
          if (seenStatuses.has(s)) {
            errors.push({ code: 'status_overlap_in_multi', message: `Statut "${s}" présent dans plusieurs sorties`, nodeId: n.id })
          }
          seenStatuses.add(s)
        }
      }
      // Coverage warning
      const missing = [...channelStatuses].filter(s => !seenStatuses.has(s))
      if (missing.length > 0) {
        warnings.push({
          code: 'incomplete_status_coverage',
          message: `Statuts non routés : ${missing.join(', ')}`,
          nodeId: n.id, missingStatuses: missing
        })
      }
    }

    // Validate sourceHandle of outgoing edges matches the output config.
    const outgoing = graph.edges.filter(e => e.source === n.id)
    for (const e of outgoing) {
      if (output.mode === 'single' && e.sourceHandle !== undefined) {
        errors.push({
          code: 'invalid_source_handle_for_single',
          message: 'Mode single : aucune arête ne doit porter un sourceHandle',
          edgeId: e.id
        })
      }
      if (output.mode === 'simple' && e.sourceHandle !== 'success' && e.sourceHandle !== 'failure') {
        errors.push({
          code: 'invalid_source_handle_for_simple',
          message: 'Mode simple : sourceHandle doit valoir "success" ou "failure"',
          edgeId: e.id
        })
      }
      if (output.mode === 'multi') {
        const matches = output.outputs.some(o => o.id === e.sourceHandle)
        if (!matches) {
          errors.push({
            code: 'invalid_source_handle_for_multi',
            message: `Mode multi : sourceHandle "${e.sourceHandle ?? '(vide)'}" ne correspond à aucun output.id`,
            edgeId: e.id
          })
        }
      }
    }
  }

  // Condition rules
  for (const n of graph.nodes) {
    if (n.data.kind !== 'condition') continue
    if (n.data.params.conditionType === 'data_available') {
      if (!(DataAvailableExpressions as readonly string[]).includes(n.data.params.expression)) {
        errors.push({
          code: 'unknown_data_available_expression',
          message: `Expression inconnue pour data_available : ${n.data.params.expression}`,
          nodeId: n.id
        })
      }
    }
    const outgoing = graph.edges.filter(e => e.source === n.id)
    for (const e of outgoing) {
      if (e.sourceHandle !== 'true' && e.sourceHandle !== 'false') {
        errors.push({
          code: 'invalid_source_handle_for_condition',
          message: 'Condition : sourceHandle doit valoir "true" ou "false"',
          edgeId: e.id
        })
      }
    }
  }

  // Cycle detection via topological sort restricted to nodes
  const outgoing = new Map<string, GraphEdge[]>()
  const inDeg = new Map<string, number>()
  for (const n of graph.nodes) { outgoing.set(n.id, []); inDeg.set(n.id, 0) }
  for (const e of graph.edges) {
    if (!nodesById.has(e.source) || !nodesById.has(e.target) || e.source === e.target) continue
    outgoing.get(e.source)!.push(e)
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1)
  }
  const queue = [...graph.nodes.filter(n => (inDeg.get(n.id) ?? 0) === 0).map(n => n.id)]
  let visited = 0
  while (queue.length > 0) {
    const id = queue.shift()!
    visited++
    for (const e of outgoing.get(id) ?? []) {
      const r = (inDeg.get(e.target) ?? 0) - 1
      inDeg.set(e.target, r)
      if (r === 0) queue.push(e.target)
    }
  }
  if (visited < graph.nodes.length) {
    errors.push({ code: 'cycle', message: 'Un cycle a été détecté dans le graphe' })
  }

  return { errors, warnings }
}
```

- [ ] **Step 8.4: Update index**

Append to `shared/src/index.ts`:
```ts
export * from './algorithms/validate-graph'
```

- [ ] **Step 8.5: Run tests, verify PASS**

Run:
```bash
pnpm --filter @rainpath/shared test
```
Expected: All `validateGraph` tests pass.

- [ ] **Step 8.6: Commit**

```bash
git add shared/src/algorithms/validate-graph.ts shared/src/index.ts shared/tests/validate-graph.test.ts
git commit -m "feat(shared): implement validateGraph with structural + output + condition + position rules"
```

---

## Task 9: `computeReachability` algorithm

**Files:**
- Create: `shared/src/algorithms/compute-reachability.ts`
- Create: `shared/tests/compute-reachability.test.ts`
- Modify: `shared/src/index.ts`

- [ ] **Step 9.1: Write failing tests**

Write `shared/tests/compute-reachability.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { computeReachability } from '../src/algorithms/compute-reachability'
import type { Graph } from '../src/schemas/primitives'

const startNode = { id: 's', position: { x: 0, y: 200 }, data: { kind: 'start' as const } }
const endNode = (id = 'e') => ({ id, position: { x: 1, y: 200 }, data: { kind: 'end' as const } })
const emailNode = (id: string, output: any = { mode: 'single' }) => ({
  id, position: { x: 1, y: 200 },
  data: { kind: 'send_email' as const, params: { subject: '', body: '', output } }
})
const condDataAvailNode = (id: string, expression: string) => ({
  id, position: { x: 1, y: 200 },
  data: { kind: 'condition' as const, params: { conditionType: 'data_available' as const, expression } }
})
const edge = (id: string, source: string, target: string, daysAfter = 1, sourceHandle?: string) =>
  ({ id, source, target, daysAfter, sourceHandle })

const profileEmpty = { name: 'Anon', email: null, phone: null, whatsapp: null, address: null }
const profileFull = { name: 'X', email: 'a@b.c', phone: '+33', whatsapp: '+33', address: '1 rue' }

describe('computeReachability', () => {
  it('marks history nodes as visited and current as current', () => {
    const g: Graph = {
      nodes: [startNode, emailNode('a'), endNode()],
      edges: [edge('e1', 's', 'a', 1), edge('e2', 'a', 'e', 1)]
    }
    const r = computeReachability(g, profileFull, 'a', ['s'])
    expect(r.get('s')).toBe('visited')
    expect(r.get('a')).toBe('current')
    expect(r.get('e')).toBe('reachable')
  })

  it('marks the false branch as blocked when data_available is true', () => {
    const g: Graph = {
      nodes: [startNode, condDataAvailNode('c', 'patient.email'), endNode('et'), endNode('ef')],
      edges: [
        edge('e_sc', 's', 'c', 0),
        edge('e_ct', 'c', 'et', 1, 'true'),
        edge('e_cf', 'c', 'ef', 1, 'false')
      ]
    }
    const r = computeReachability(g, profileFull, 'c', ['s'])
    expect(r.get('et')).toBe('reachable')
    expect(r.get('ef')).toBe('blocked')
  })

  it('marks the true branch as blocked when data_available is false', () => {
    const g: Graph = {
      nodes: [startNode, condDataAvailNode('c', 'patient.email'), endNode('et'), endNode('ef')],
      edges: [
        edge('e_sc', 's', 'c', 0),
        edge('e_ct', 'c', 'et', 1, 'true'),
        edge('e_cf', 'c', 'ef', 1, 'false')
      ]
    }
    const r = computeReachability(g, profileEmpty, 'c', ['s'])
    expect(r.get('et')).toBe('blocked')
    expect(r.get('ef')).toBe('reachable')
  })

  it('promotes a blocked node back to reachable when another path makes it accessible', () => {
    // s -> c (data: email) -> (true) -> target ; s -> a -> target
    // With profile empty, c.true → blocked, but a → target is still reachable.
    const g: Graph = {
      nodes: [
        startNode,
        condDataAvailNode('c', 'patient.email'),
        emailNode('a'),
        endNode('target')
      ],
      edges: [
        edge('e_sc', 's', 'c', 0),
        edge('e_sa', 's', 'a', 0),
        edge('e_c_target', 'c', 'target', 1, 'true'),
        edge('e_a_target', 'a', 'target', 1)
      ]
    }
    const r = computeReachability(g, profileEmpty, 's', [])
    expect(r.get('target')).toBe('reachable')
  })

  it('propagates both branches when previous_result (unknown future)', () => {
    const condRes = {
      id: 'c', position: { x: 1, y: 200 },
      data: { kind: 'condition' as const, params: { conditionType: 'previous_result' as const, expression: 'last.status == opened' } }
    }
    const g: Graph = {
      nodes: [startNode, condRes, endNode('et'), endNode('ef')],
      edges: [
        edge('e_sc', 's', 'c', 0),
        edge('e_ct', 'c', 'et', 1, 'true'),
        edge('e_cf', 'c', 'ef', 1, 'false')
      ]
    }
    const r = computeReachability(g, profileEmpty, 'c', ['s'])
    expect(r.get('et')).toBe('reachable')
    expect(r.get('ef')).toBe('reachable')
  })

  it('propagates all outputs of send_* multi', () => {
    const node = emailNode('a', {
      mode: 'multi',
      outputs: [
        { id: 'eng', label: 'Engagé', condition: { statuses: ['opened'] } },
        { id: 'rej', label: 'Rejeté', condition: { statuses: ['bounced'] } }
      ]
    })
    const g: Graph = {
      nodes: [startNode, node, endNode('e1'), endNode('e2')],
      edges: [
        edge('e_sa', 's', 'a', 1),
        edge('e_ae1', 'a', 'e1', 1, 'eng'),
        edge('e_ae2', 'a', 'e2', 1, 'rej')
      ]
    }
    const r = computeReachability(g, profileFull, 'a', ['s'])
    expect(r.get('e1')).toBe('reachable')
    expect(r.get('e2')).toBe('reachable')
  })

  it('leaves nodes unreachable when not connected from current', () => {
    const g: Graph = {
      nodes: [startNode, emailNode('orphan'), endNode()],
      edges: [edge('e1', 's', 'e', 1)]
    }
    const r = computeReachability(g, profileFull, 's', [])
    expect(r.get('orphan')).toBe('unreachable')
  })
})
```

- [ ] **Step 9.2: Run, verify FAIL**

Run:
```bash
pnpm --filter @rainpath/shared test
```
Expected: FAIL.

- [ ] **Step 9.3: Implement `computeReachability`**

Write `shared/src/algorithms/compute-reachability.ts`:
```ts
import type { Graph, GraphEdge, GraphNode } from '../schemas/primitives'

export type NodeReachState = 'visited' | 'current' | 'reachable' | 'blocked' | 'unreachable'

export interface PatientProfileLike {
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  address?: string | null
}

function evaluateDataAvailable(expression: string, profile: PatientProfileLike): boolean | undefined {
  switch (expression) {
    case 'patient.email':    return !!profile.email && profile.email !== ''
    case 'patient.phone':    return !!profile.phone && profile.phone !== ''
    case 'patient.whatsapp': return !!profile.whatsapp && profile.whatsapp !== ''
    case 'patient.address': return !!profile.address && profile.address !== ''
    default: return undefined
  }
}

function topologicalOrder(graph: Graph, root: string): string[] {
  const outgoing = new Map<string, GraphEdge[]>()
  const inDeg = new Map<string, number>()
  for (const n of graph.nodes) { outgoing.set(n.id, []); inDeg.set(n.id, 0) }
  for (const e of graph.edges) {
    if (!outgoing.has(e.source) || !inDeg.has(e.target)) continue
    if (e.source === e.target) continue
    outgoing.get(e.source)!.push(e)
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1)
  }
  // BFS from root to find connected component
  const connected = new Set<string>([root])
  const stack = [root]
  while (stack.length > 0) {
    const id = stack.pop()!
    for (const e of outgoing.get(id) ?? []) {
      if (!connected.has(e.target)) {
        connected.add(e.target)
        stack.push(e.target)
      }
    }
  }
  const order: string[] = []
  const queue = [root]
  const localIn = new Map<string, number>()
  for (const id of connected) {
    let count = 0
    for (const e of graph.edges) {
      if (e.target === id && connected.has(e.source) && e.source !== id) count++
    }
    localIn.set(id, count)
  }
  while (queue.length > 0) {
    const id = queue.shift()!
    order.push(id)
    for (const e of outgoing.get(id) ?? []) {
      if (!connected.has(e.target)) continue
      const r = (localIn.get(e.target) ?? 0) - 1
      localIn.set(e.target, r)
      if (r === 0) queue.push(e.target)
    }
  }
  return order
}

interface OutgoingResolution {
  followed: GraphEdge[]
  skippedBlocked: GraphEdge[]
}

function resolveOutgoingEdges(node: GraphNode, edges: GraphEdge[], profile: PatientProfileLike): OutgoingResolution {
  const outgoing = edges.filter(e => e.source === node.id)
  switch (node.data.kind) {
    case 'start':
    case 'send_email':
    case 'send_sms':
    case 'send_whatsapp':
    case 'send_postal':
      return { followed: outgoing, skippedBlocked: [] }
    case 'condition': {
      const params = node.data.params
      if (params.conditionType === 'data_available') {
        const result = evaluateDataAvailable(params.expression, profile)
        if (result === undefined) {
          return { followed: outgoing, skippedBlocked: [] }
        }
        const trueEdge = outgoing.find(e => e.sourceHandle === 'true')
        const falseEdge = outgoing.find(e => e.sourceHandle === 'false')
        if (result) {
          return {
            followed: trueEdge ? [trueEdge] : [],
            skippedBlocked: falseEdge ? [falseEdge] : []
          }
        } else {
          return {
            followed: falseEdge ? [falseEdge] : [],
            skippedBlocked: trueEdge ? [trueEdge] : []
          }
        }
      }
      // previous_result : both branches potentially possible
      return { followed: outgoing, skippedBlocked: [] }
    }
    case 'end':
      return { followed: [], skippedBlocked: [] }
  }
}

/**
 * Compute the reachability state of every node from the perspective of `currentNodeId`,
 * given a patient profile and execution history. Idempotent and deterministic.
 */
export function computeReachability(
  graph: Graph,
  profile: PatientProfileLike,
  currentNodeId: string | null,
  history: string[]
): Map<string, NodeReachState> {
  const state = new Map<string, NodeReachState>()
  for (const n of graph.nodes) state.set(n.id, 'unreachable')
  for (const id of history) if (state.has(id)) state.set(id, 'visited')
  if (currentNodeId && state.has(currentNodeId)) state.set(currentNodeId, 'current')

  if (!currentNodeId) return state

  const order = topologicalOrder(graph, currentNodeId)
  const nodesById = new Map(graph.nodes.map(n => [n.id, n]))

  for (const id of order) {
    const node = nodesById.get(id)
    if (!node) continue
    const here = state.get(id)
    const canPropagate = here === 'current' || here === 'visited' || here === 'reachable'
    if (!canPropagate) continue
    const { followed, skippedBlocked } = resolveOutgoingEdges(node, graph.edges, profile)
    for (const e of followed) {
      const target = state.get(e.target)
      if (target === 'unreachable' || target === 'blocked') state.set(e.target, 'reachable')
    }
    for (const e of skippedBlocked) {
      const target = state.get(e.target)
      if (target === 'unreachable') state.set(e.target, 'blocked')
    }
  }
  return state
}
```

- [ ] **Step 9.4: Update index**

Append to `shared/src/index.ts`:
```ts
export * from './algorithms/compute-reachability'
```

- [ ] **Step 9.5: Run tests, verify PASS**

Run:
```bash
pnpm --filter @rainpath/shared test
```
Expected: All `computeReachability` tests pass.

- [ ] **Step 9.6: Commit**

```bash
git add shared/src/algorithms/compute-reachability.ts shared/src/index.ts shared/tests/compute-reachability.test.ts
git commit -m "feat(shared): implement computeReachability with topological traversal and data_available resolution"
```

---

## Task 10: `simulate*` helpers (live-preview)

**Files:**
- Create: `shared/src/algorithms/simulate.ts`
- Create: `shared/tests/simulate.test.ts`
- Modify: `shared/src/index.ts`

- [ ] **Step 10.1: Write failing tests**

Write `shared/tests/simulate.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { simulateAddEdge, simulateChangeDaysAfter, simulateRemoveEdge } from '../src/algorithms/simulate'
import type { Graph } from '../src/schemas/primitives'

const startNode = { id: 's', position: { x: 0, y: 200 }, data: { kind: 'start' as const } }
const endNode = (id = 'e') => ({ id, position: { x: 1, y: 200 }, data: { kind: 'end' as const } })
const sendNode = (id: string) => ({
  id, position: { x: 1, y: 200 },
  data: { kind: 'send_email' as const, params: { subject: '', body: '', output: { mode: 'single' as const } } }
})
const edge = (id: string, source: string, target: string, daysAfter = 1, sourceHandle?: string) =>
  ({ id, source, target, daysAfter, sourceHandle })

describe('simulateAddEdge', () => {
  it('flags selfLoop when source === target', () => {
    const g: Graph = { nodes: [startNode, sendNode('a'), endNode()], edges: [edge('e1', 's', 'a', 1), edge('e2', 'a', 'e', 1)] }
    const r = simulateAddEdge(g, 'a', 'a', 0)
    expect(r.selfLoop).toBe(true)
  })

  it('flags cycle when edge would create one', () => {
    const g: Graph = { nodes: [startNode, sendNode('a'), sendNode('b'), endNode()], edges: [
      edge('e1', 's', 'a', 1), edge('e2', 'a', 'b', 1), edge('e3', 'b', 'e', 1)
    ] }
    const r = simulateAddEdge(g, 'b', 'a', 0)
    expect(r.cycle).toBe(true)
  })

  it('reports shift when target moves forward', () => {
    const g: Graph = { nodes: [startNode, sendNode('a'), sendNode('b'), endNode()], edges: [
      edge('e1', 's', 'a', 1),
      edge('e2', 's', 'b', 3),
      edge('e3', 'b', 'e', 1)
    ] }
    // before: a.X=1, b.X=3, e.X=4 ; add a->e with daysAfter=10 → e.X = max(4, 1+10) = 11
    const r = simulateAddEdge(g, 'a', 'e', 10)
    expect(r.cycle).toBe(false)
    expect(r.shifts.get('e')).toEqual({ from: 4, to: 11 })
  })

  it('no shift when daysAfter does not exceed existing max', () => {
    const g: Graph = { nodes: [startNode, sendNode('a'), endNode()], edges: [edge('e1', 's', 'e', 10)] }
    const r = simulateAddEdge(g, 's', 'a', 0)
    expect(r.shifts.size).toBe(0) // a is new (well, it was orphan), so newX of a=0, existingX of a=0
  })

  it('flags handleConflict when sourceHandle already used', () => {
    const g: Graph = { nodes: [startNode, sendNode('a'), endNode()], edges: [
      edge('e1', 's', 'a', 1),
      edge('e2', 'a', 'e', 1, 'h1')
    ] }
    const r = simulateAddEdge(g, 'a', 'e', 0, 'h1')
    expect(r.handleConflict).toBe(true)
  })
})

describe('simulateChangeDaysAfter', () => {
  it('reports shift when increasing daysAfter on an edge', () => {
    const g: Graph = { nodes: [startNode, sendNode('a'), endNode()], edges: [
      edge('e1', 's', 'a', 1), edge('e2', 'a', 'e', 1)
    ] }
    const r = simulateChangeDaysAfter(g, 'e2', 30)
    expect(r.shifts.get('e')).toEqual({ from: 2, to: 31 })
  })

  it('reports backward shift when decreasing daysAfter', () => {
    const g: Graph = { nodes: [startNode, sendNode('a'), endNode()], edges: [
      edge('e1', 's', 'a', 1), edge('e2', 'a', 'e', 10)
    ] }
    const r = simulateChangeDaysAfter(g, 'e2', 2)
    expect(r.shifts.get('e')).toEqual({ from: 11, to: 3 })
  })
})

describe('simulateRemoveEdge', () => {
  it('moves a node back when removing its only incoming edge', () => {
    const g: Graph = { nodes: [startNode, sendNode('a'), endNode()], edges: [
      edge('e1', 's', 'a', 5), edge('e2', 'a', 'e', 1)
    ] }
    const r = simulateRemoveEdge(g, 'e1')
    // a becomes orphan → defaults to X=0 ; e's source is now disconnected too
    expect(r.shifts.get('a')).toEqual({ from: 5, to: 0 })
  })
})
```

- [ ] **Step 10.2: Run, verify FAIL**

Run:
```bash
pnpm --filter @rainpath/shared test
```
Expected: FAIL.

- [ ] **Step 10.3: Implement `simulate*` helpers**

Write `shared/src/algorithms/simulate.ts`:
```ts
import type { Graph, GraphEdge } from '../schemas/primitives'
import { computeXPositions } from './compute-x-positions'

export interface SimulateResult {
  cycle: boolean
  selfLoop: boolean
  handleConflict: boolean
  newX: Map<string, number>
  shifts: Map<string, { from: number; to: number }>
}

function computeXSafe(graph: Graph, existingX?: Map<string, number>): { x: Map<string, number>; cycle: boolean } {
  try {
    return { x: computeXPositions(graph, existingX), cycle: false }
  } catch (err) {
    if ((err as Error).message.match(/cycle/i)) {
      return { x: new Map(), cycle: true }
    }
    throw err
  }
}

function diff(before: Map<string, number>, after: Map<string, number>): Map<string, { from: number; to: number }> {
  const out = new Map<string, { from: number; to: number }>()
  for (const [id, to] of after) {
    const from = before.get(id) ?? 0
    if (from !== to) out.set(id, { from, to })
  }
  return out
}

export function simulateAddEdge(
  graph: Graph,
  source: string,
  target: string,
  daysAfter: number,
  sourceHandle?: string
): SimulateResult {
  const selfLoop = source === target
  const handleConflict = graph.edges.some(e => e.source === source && e.sourceHandle === sourceHandle && sourceHandle !== undefined)
  const beforeX = computeXSafe(graph).x

  if (selfLoop || handleConflict) {
    return { cycle: false, selfLoop, handleConflict, newX: beforeX, shifts: new Map() }
  }

  const newEdge: GraphEdge = { id: '__simulated__', source, target, daysAfter, sourceHandle }
  const draft: Graph = { nodes: graph.nodes, edges: [...graph.edges, newEdge] }
  const after = computeXSafe(draft, beforeX)
  if (after.cycle) {
    return { cycle: true, selfLoop: false, handleConflict: false, newX: beforeX, shifts: new Map() }
  }
  return {
    cycle: false, selfLoop: false, handleConflict: false,
    newX: after.x,
    shifts: diff(beforeX, after.x)
  }
}

export function simulateChangeDaysAfter(
  graph: Graph,
  edgeId: string,
  newDaysAfter: number
): { cycle: boolean; newX: Map<string, number>; shifts: Map<string, { from: number; to: number }> } {
  const beforeX = computeXSafe(graph).x
  const draft: Graph = {
    nodes: graph.nodes,
    edges: graph.edges.map(e => e.id === edgeId ? { ...e, daysAfter: newDaysAfter } : e)
  }
  const after = computeXSafe(draft, beforeX)
  if (after.cycle) {
    return { cycle: true, newX: beforeX, shifts: new Map() }
  }
  return { cycle: false, newX: after.x, shifts: diff(beforeX, after.x) }
}

export function simulateRemoveEdge(
  graph: Graph,
  edgeId: string
): { newX: Map<string, number>; shifts: Map<string, { from: number; to: number }> } {
  const beforeX = computeXSafe(graph).x
  const draft: Graph = {
    nodes: graph.nodes,
    edges: graph.edges.filter(e => e.id !== edgeId)
  }
  // After removal, do not pass existingX of nodes that become orphans — let them default to 0 per spec
  const after = computeXSafe(draft).x
  return { newX: after, shifts: diff(beforeX, after) }
}
```

- [ ] **Step 10.4: Update index**

Append to `shared/src/index.ts`:
```ts
export * from './algorithms/simulate'
```

- [ ] **Step 10.5: Run tests, verify PASS**

Run:
```bash
pnpm --filter @rainpath/shared test
```
Expected: All simulate tests pass.

- [ ] **Step 10.6: Commit**

```bash
git add shared/src/algorithms/simulate.ts shared/src/index.ts shared/tests/simulate.test.ts
git commit -m "feat(shared): implement simulateAddEdge / Change / Remove helpers"
```

---

## Task 11: Build shared package once (artifacts for downstream)

- [ ] **Step 11.1: Build the package**

Run:
```bash
pnpm --filter @rainpath/shared build
```
Expected: `shared/dist/` populated with `index.js`, `index.d.ts`, and all algorithm/schema files compiled.

- [ ] **Step 11.2: Run full test suite once more**

Run:
```bash
pnpm --filter @rainpath/shared test
```
Expected: All tests pass (50+ assertions across 5 files).

- [ ] **Step 11.3: Add a `.gitignore` for `shared/dist`**

Append to (or create if missing) `shared/.gitignore`:
```
node_modules/
dist/
coverage/
```

- [ ] **Step 11.4: Commit**

```bash
git add shared/.gitignore
git commit -m "chore(shared): gitignore node_modules and dist"
```

---

## Task 12: Scaffold frontend with Vite + React + TS

**Files:**
- Create: `frontend/package.json` (via Vite)
- Modify after scaffold: `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/src/App.tsx`

- [ ] **Step 12.1: Scaffold the frontend**

Run from repo root:
```bash
pnpm dlx create-vite@5 frontend --template react-ts
```
Expected: directory `frontend/` is created with default Vite React TS template.

- [ ] **Step 12.2: Adjust `frontend/package.json` to consume `@rainpath/shared`**

Edit `frontend/package.json` to set the name and add the shared dependency. The final file should look like (preserve Vite's `version`, `scripts`, and Vite-related `devDependencies`):
```json
{
  "name": "@rainpath/frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@rainpath/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "5.4.5",
    "vite": "^5.3.4",
    "vitest": "1.6.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.6",
    "jsdom": "^24.1.0"
  }
}
```

- [ ] **Step 12.3: Install frontend dependencies**

Run:
```bash
pnpm install
```
Expected: `@rainpath/shared` is linked to `frontend/node_modules/@rainpath/shared` via workspace protocol.

- [ ] **Step 12.4: Update Vite config to expose `@rainpath/shared` properly**

Replace `frontend/vite.config.ts` with:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@rainpath/shared': path.resolve(__dirname, '../shared/src')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
})
```

- [ ] **Step 12.5: Update `frontend/tsconfig.json` to resolve shared source directly**

Edit `frontend/tsconfig.json`'s `compilerOptions` to include path mapping:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": false,
    "isolatedModules": true,
    "useDefineForClassFields": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@rainpath/shared": ["../shared/src/index.ts"]
    }
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 12.6: Replace `frontend/src/App.tsx` with a placeholder**

Write `frontend/src/App.tsx`:
```tsx
import { computeXPositions } from '@rainpath/shared'

export default function App() {
  // Demo: ensure the shared package is importable from the frontend.
  const demo = computeXPositions({ nodes: [{ id: 's', position: { x: 0, y: 200 }, data: { kind: 'start' } }], edges: [] })
  return (
    <main className="p-8 text-slate-900 antialiased">
      <h1 className="text-2xl font-semibold tracking-tight">RainPath — frontend bootstrap</h1>
      <p className="text-sm text-slate-600">shared loaded — start.X = {demo.get('s')}</p>
    </main>
  )
}
```

- [ ] **Step 12.7: Verify dev server starts**

Run:
```bash
pnpm --filter @rainpath/frontend dev
```
Expected: Vite dev server listens on `http://localhost:5173` and the page shows "shared loaded — start.X = 0". Stop the server with Ctrl+C.

- [ ] **Step 12.8: Commit**

```bash
git add frontend pnpm-lock.yaml
git commit -m "feat(frontend): scaffold Vite + React + TS, wire @rainpath/shared via workspace alias"
```

---

## Task 13: Tailwind + DS tokens setup

**Files:**
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.js`
- Create: `frontend/src/styles/tokens.css`
- Create: `frontend/src/styles/globals.css`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 13.1: Install Tailwind, PostCSS, Autoprefixer**

Run:
```bash
pnpm --filter @rainpath/frontend add -D tailwindcss@^3.4 postcss@^8.4 autoprefixer@^10.4
```
Expected: Tailwind v3.4.x installed.

- [ ] **Step 13.2: Initialize Tailwind config**

Run from repo root:
```bash
cd frontend && pnpm exec tailwindcss init -p && cd ..
```
Expected: `frontend/tailwind.config.js` and `frontend/postcss.config.js` created.

- [ ] **Step 13.3: Replace `frontend/tailwind.config.js` with TS variant**

Delete `frontend/tailwind.config.js`, then write `frontend/tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-muted': 'var(--surface-muted)',
        fg: 'var(--fg)',
        'fg-muted': 'var(--fg-muted)',
        'fg-subtle': 'var(--fg-subtle)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        ring: 'var(--ring)',
        primary: 'var(--primary)',
        'primary-hover': 'var(--primary-hover)',
        'on-primary': 'var(--on-primary)',
        'primary-soft': 'var(--primary-soft)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        info: 'var(--info)'
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        full: 'var(--radius-full)'
      },
      spacing: {
        // Tailwind spacing already aligns with 4pt rhythm; expose DS-named tokens for clarity
        'ds-1': 'var(--space-1)',
        'ds-2': 'var(--space-2)',
        'ds-3': 'var(--space-3)',
        'ds-4': 'var(--space-4)',
        'ds-5': 'var(--space-5)',
        'ds-6': 'var(--space-6)',
        'ds-8': 'var(--space-8)',
        'ds-10': 'var(--space-10)',
        'ds-12': 'var(--space-12)',
        'ds-16': 'var(--space-16)'
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)']
      },
      boxShadow: {
        'elev-1': 'var(--elev-1)',
        'elev-2': 'var(--elev-2)',
        'elev-3': 'var(--elev-3)'
      }
    }
  },
  plugins: []
} satisfies Config
```

- [ ] **Step 13.4: Update `frontend/postcss.config.js`**

Replace `frontend/postcss.config.js` with:
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
}
```

- [ ] **Step 13.5: Create `frontend/src/styles/tokens.css`**

Write `frontend/src/styles/tokens.css`:
```css
/* Design System tokens — see design-system/MASTER.md §3-§5 */
:root {
  /* Chrome / surfaces (DS §3.1) */
  --bg: #F8FAFC;
  --surface: #FFFFFF;
  --surface-muted: #F1F5F9;
  --fg: #0F172A;
  --fg-muted: #475569;
  --fg-subtle: #94A3B8;
  --border: #E2E8F0;
  --border-strong: #CBD5E1;
  --ring: #0E7490;

  /* Brand & semantic (DS §3.2) */
  --primary: #0E7490;
  --primary-hover: #155E75;
  --on-primary: #FFFFFF;
  --primary-soft: #ECFEFF;
  --success: #059669;
  --warning: #B45309;
  --danger: #B91C1C;
  --info: #0369A1;

  /* Node families (DS §3.3) */
  --node-start-bg: #ECFDF5;
  --node-start-border: #A7F3D0;
  --node-start-accent: #059669;

  --node-email-bg: #EFF6FF;
  --node-email-border: #BFDBFE;
  --node-email-accent: #1D4ED8;

  --node-sms-bg: #EEF2FF;
  --node-sms-border: #C7D2FE;
  --node-sms-accent: #4338CA;

  --node-whatsapp-bg: #F0FDF4;
  --node-whatsapp-border: #BBF7D0;
  --node-whatsapp-accent: #15803D;

  --node-postal-bg: #FFFBEB;
  --node-postal-border: #FDE68A;
  --node-postal-accent: #B45309;

  --node-cond-data-bg: #FAF5FF;
  --node-cond-data-border: #E9D5FF;
  --node-cond-data-accent: #7C3AED;

  --node-cond-result-bg: #FDF4FF;
  --node-cond-result-border: #F5D0FE;
  --node-cond-result-accent: #A21CAF;

  --node-end-bg: #F1F5F9;
  --node-end-border: #94A3B8;
  --node-end-accent: #334155;

  /* Wait tokens — forward compat only, not used in v1 (cf. spec §4.3) */
  --node-wait-bg: #F8FAFC;
  --node-wait-border: #CBD5E1;
  --node-wait-accent: #475569;

  /* Typography (DS §4) */
  --font-sans: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;

  /* Spacing (DS §5.1) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* Radius (DS §5.2) */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;

  /* Elevation (DS §5.3) */
  --elev-1: 0 1px 2px 0 rgba(15, 23, 42, 0.05);
  --elev-2: 0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.05);
  --elev-3: 0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.05);
  --elev-scrim: rgba(15, 23, 42, 0.5);
}

html {
  font-family: var(--font-sans);
  font-feature-settings: 'cv11', 'ss01', 'ss03';
  color: var(--fg);
  background: var(--bg);
}
```

- [ ] **Step 13.6: Create `frontend/src/styles/globals.css`**

Write `frontend/src/styles/globals.css`:
```css
@import './tokens.css';
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 13.7: Wire globals into main**

Replace `frontend/src/main.tsx` with:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './styles/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 13.8: Delete the leftover default CSS file from Vite scaffold**

Delete `frontend/src/index.css` and `frontend/src/App.css` (if they exist):
```bash
rm -f frontend/src/index.css frontend/src/App.css
```

- [ ] **Step 13.9: Verify build**

Run:
```bash
pnpm --filter @rainpath/frontend build
```
Expected: Successful build, no Tailwind/PostCSS errors.

- [ ] **Step 13.10: Verify dev server still works with tokens applied**

Run:
```bash
pnpm --filter @rainpath/frontend dev
```
Expected: Page loads with the slate text on slate-50 background. Stop with Ctrl+C.

- [ ] **Step 13.11: Commit**

```bash
git add frontend/tailwind.config.ts frontend/postcss.config.js frontend/src/styles frontend/src/main.tsx frontend/src/App.tsx frontend/package.json pnpm-lock.yaml
git commit -m "feat(frontend): wire Tailwind v3 + DS tokens (tokens.css + tailwind.config.ts)"
```

---

## Task 14: Frontend libs — Inter, Lucide wrapper, Radix UI, Framer Motion

**Files:**
- Create: `frontend/src/components/Icon.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 14.1: Install dependencies**

Run:
```bash
pnpm --filter @rainpath/frontend add @fontsource/inter@^5 lucide-react@^0.460 \
  @radix-ui/react-dialog@^1 @radix-ui/react-dropdown-menu@^2 @radix-ui/react-popover@^1 \
  @radix-ui/react-tabs@^1 @radix-ui/react-tooltip@^1 @radix-ui/react-accordion@^1 \
  @radix-ui/react-separator@^1 framer-motion@^11 @floating-ui/react@^0.26
```

- [ ] **Step 14.2: Import Inter in tokens.css**

Append to `frontend/src/styles/tokens.css` at the top (before `:root`):
```css
@import '@fontsource/inter/variable.css';
```
(If `@fontsource/inter/variable.css` is unavailable for the installed version, fall back to `@fontsource/inter/400.css; @fontsource/inter/500.css; @fontsource/inter/600.css; @fontsource/inter/700.css`.)

- [ ] **Step 14.3: Create the Icon wrapper**

Write `frontend/src/components/Icon.tsx`:
```tsx
import { icons, type LucideProps } from 'lucide-react'

type IconName = keyof typeof icons
type Size = 16 | 20 | 24

interface IconProps extends Omit<LucideProps, 'size'> {
  name: IconName
  size?: Size
}

/**
 * Icon wrapper enforcing the DS §6 size scale (16 / 20 / 24 only)
 * and the single-source-of-icons policy (Lucide).
 */
export function Icon({ name, size = 16, ...rest }: IconProps) {
  const Component = icons[name]
  if (!Component) {
    if (import.meta.env.DEV) console.warn(`<Icon name="${name}"> not found in lucide-react`)
    return null
  }
  return <Component size={size} strokeWidth={1.5} aria-hidden="true" {...rest} />
}
```

- [ ] **Step 14.4: Update App.tsx to demo Inter + Icon**

Replace `frontend/src/App.tsx`:
```tsx
import { computeXPositions } from '@rainpath/shared'
import { Icon } from '@/components/Icon'

export default function App() {
  const demo = computeXPositions({
    nodes: [{ id: 's', position: { x: 0, y: 200 }, data: { kind: 'start' } }],
    edges: []
  })
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-fg">
        RainPath — frontend bootstrap
      </h1>
      <p className="mt-2 flex items-center gap-2 text-sm text-fg-muted">
        <Icon name="CheckCircle" size={16} className="text-success" />
        shared loaded — start.X = {demo.get('s')}
      </p>
    </main>
  )
}
```

- [ ] **Step 14.5: Verify build with the new icons**

Run:
```bash
pnpm --filter @rainpath/frontend build
```
Expected: Build succeeds.

- [ ] **Step 14.6: Commit**

```bash
git add frontend pnpm-lock.yaml
git commit -m "feat(frontend): add Inter, Lucide (with Icon wrapper), Radix primitives, Framer Motion"
```

---

## Task 15: Scaffold backend with NestJS CLI

**Files:**
- Create: `backend/` (via NestJS CLI)
- Modify: `backend/package.json`, `backend/tsconfig.json`, `backend/src/main.ts`, `backend/src/app.module.ts`

- [ ] **Step 15.1: Scaffold the backend**

Run from repo root:
```bash
pnpm dlx @nestjs/cli@10 new backend --package-manager pnpm --skip-git --strict
```
When prompted for package manager, accept pnpm. Expected: `backend/` directory created.

- [ ] **Step 15.2: Edit `backend/package.json` to align with monorepo**

Edit `backend/package.json`'s `name` field to `@rainpath/backend` and add `@rainpath/shared` as a workspace dependency. The file should look like (preserve scripts and other deps from the scaffold):
```json
{
  "name": "@rainpath/backend",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "nest build",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@rainpath/shared": "workspace:*",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.1",
    "zod": "3.23.8"
  }
}
```
(The remaining `devDependencies` from the scaffold remain unchanged.)

- [ ] **Step 15.3: Install backend dependencies**

Run:
```bash
pnpm install
```
Expected: `@rainpath/shared` linked in `backend/node_modules/`.

- [ ] **Step 15.4: Update `backend/tsconfig.json` to resolve `@rainpath/shared`**

Append to `backend/tsconfig.json`'s `compilerOptions`:
```json
{
  "baseUrl": ".",
  "paths": {
    "@rainpath/shared": ["../shared/src/index.ts"]
  }
}
```
(Merge with the existing `compilerOptions` block; do not remove other options.)

- [ ] **Step 15.5: Replace `backend/src/main.ts` to set body limit and global Zod pipe placeholder**

Write `backend/src/main.ts`:
```ts
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false })

  const express = (await import('express')).default
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true, limit: '1mb' }))

  app.setGlobalPrefix('api')
  app.enableCors({ origin: 'http://localhost:5173' })

  await app.listen(3000)
}
bootstrap()
```

- [ ] **Step 15.6: Verify backend starts**

Run:
```bash
pnpm --filter @rainpath/backend start:dev
```
Expected: Nest listens on `http://localhost:3000`. Test with `curl http://localhost:3000/api` — likely 404 with default app controller mapping (depends on scaffold). Stop the server (Ctrl+C).

- [ ] **Step 15.7: Commit**

```bash
git add backend pnpm-lock.yaml
git commit -m "feat(backend): scaffold NestJS, wire @rainpath/shared, set 1mb body limit and /api prefix"
```

---

## Task 16: Prisma init + schema + first migration

**Files:**
- Create: `backend/prisma/schema.prisma`
- Create: `backend/.env`, `backend/.env.example`
- Create: `backend/src/prisma/prisma.service.ts`
- Create: `backend/src/prisma/prisma.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 16.1: Install Prisma**

Run:
```bash
pnpm --filter @rainpath/backend add @prisma/client@^5.18
pnpm --filter @rainpath/backend add -D prisma@^5.18 tsx@^4.16
```

- [ ] **Step 16.2: Initialize Prisma with SQLite**

Run from repo root:
```bash
cd backend && pnpm exec prisma init --datasource-provider sqlite && cd ..
```
Expected: `backend/prisma/schema.prisma` and `backend/.env` created with default content.

- [ ] **Step 16.3: Set up the `.env` files**

Replace `backend/.env`:
```
DATABASE_URL="file:./dev.db"
```

Create `backend/.env.example`:
```
DATABASE_URL="file:./dev.db"
```

Add `backend/.env` to `backend/.gitignore` (Prisma scaffold should already include it; verify):
```bash
cat backend/.gitignore | grep -q "^.env$" || echo ".env" >> backend/.gitignore
```

- [ ] **Step 16.4: Write the full schema**

Replace `backend/prisma/schema.prisma`:
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
  graph       String   // JSON-encoded Graph (SQLite has no native Json)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?
  patientRuns PatientRun[]

  @@index([deletedAt])
}

model NodeTemplate {
  id          String   @id @default(cuid())
  name        String
  description String?
  kind        String
  params      String   // JSON-encoded params
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  @@index([deletedAt])
}

model PatientProfile {
  id        String   @id @default(cuid())
  name      String
  email     String?
  phone     String?
  whatsapp  String?
  address   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  patientRuns PatientRun[]

  @@index([deletedAt])
}

model PatientRun {
  id            String         @id @default(cuid())
  workflowId    String
  workflow      Workflow       @relation(fields: [workflowId], references: [id], onDelete: Restrict)
  patientId     String
  patient       PatientProfile @relation(fields: [patientId], references: [id], onDelete: Restrict)
  currentNodeId String?
  history       String         // JSON-encoded [{ nodeId, enteredAt, outcome? }]
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  deletedAt     DateTime?

  @@index([deletedAt])
  @@index([workflowId])
  @@index([patientId])
}
```

> **Why `String` for `graph`/`params`/`history`?** SQLite has no native `Json`. Prisma 5 stores JSON via `String`. Services serialize with `JSON.stringify` on write and parse + Zod-validate on read.

- [ ] **Step 16.5: Run the first migration**

Run:
```bash
pnpm --filter @rainpath/backend prisma:migrate -- --name init
```
Expected: `backend/prisma/migrations/<timestamp>_init/migration.sql` generated, SQLite database created at `backend/prisma/dev.db`, Prisma client generated.

- [ ] **Step 16.6: Create the Prisma service with soft-delete filter**

Write `backend/src/prisma/prisma.service.ts`:
```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect()
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}

/**
 * Extended Prisma client that auto-filters soft-deleted rows on findMany/findFirst/findUnique.
 * Use `prismaWithSoftDelete` in services that should never see deleted rows.
 */
export function buildSoftDeleteClient(base: PrismaService) {
  return base.$extends({
    query: {
      $allModels: {
        async findMany({ args, query }) {
          args.where = { ...args.where, deletedAt: null }
          return query(args)
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, deletedAt: null }
          return query(args)
        },
        async findUnique({ args, query }) {
          args.where = { ...args.where, deletedAt: null }
          return query(args)
        }
      }
    }
  })
}
```

- [ ] **Step 16.7: Create the Prisma module**

Write `backend/src/prisma/prisma.module.ts`:
```ts
import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService]
})
export class PrismaModule {}
```

- [ ] **Step 16.8: Wire PrismaModule into AppModule**

Edit `backend/src/app.module.ts`:
```ts
import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { PrismaModule } from './prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
```

- [ ] **Step 16.9: Verify the backend still boots**

Run:
```bash
pnpm --filter @rainpath/backend start:dev
```
Expected: Nest listens on port 3000 with PrismaService initialized. Stop.

- [ ] **Step 16.10: Commit**

```bash
git add backend/prisma backend/.env.example backend/.gitignore backend/src/prisma backend/src/app.module.ts backend/package.json pnpm-lock.yaml
git commit -m "feat(backend): add Prisma 5 + SQLite schema (Workflow/NodeTemplate/PatientProfile/PatientRun) with soft delete"
```

---

## Task 17: Seed script — 8 node templates + 1 example workflow

**Files:**
- Create: `backend/prisma/seed.ts`
- Modify: `backend/package.json` (Prisma seed section)

- [ ] **Step 17.1: Tell Prisma how to run the seed**

Edit `backend/package.json` to add a `prisma` section near the bottom:
```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

- [ ] **Step 17.2: Write the seed script**

Write `backend/prisma/seed.ts`:
```ts
import { PrismaClient } from '@prisma/client'
import {
  NodeTemplateBody, Graph,
  type EmailParams, type SmsParams, type WhatsAppParams, type PostalParams, type ConditionParams,
  START_Y
} from '@rainpath/shared'

const prisma = new PrismaClient()

const emailRelance: EmailParams = {
  subject: 'Relance — règlement de votre examen',
  body: 'Bonjour,\n\nNous n’avons pas encore reçu le règlement…\n\nCordialement.',
  output: { mode: 'simple', successCondition: { statuses: ['delivered', 'opened', 'clicked', 'unopened'] } }
}

const emailFerme: EmailParams = {
  subject: 'Dernière relance',
  body: 'Bonjour,\n\nCeci est notre dernier rappel.\n\nCordialement.',
  output: {
    mode: 'multi',
    outputs: [
      { id: 'eng', label: 'Engagé', condition: { statuses: ['opened', 'clicked'] } },
      { id: 'no_eng', label: 'Pas engagé', condition: { statuses: ['delivered', 'unopened'] } },
      { id: 'fail', label: 'Échec', condition: { statuses: ['bounced', 'rejected'] } }
    ]
  }
}

const smsCourt: SmsParams = {
  body: 'Bonjour, votre examen est en attente de règlement. Détails par mail.',
  output: { mode: 'simple', successCondition: { statuses: ['delivered'] } }
}

const whatsappCourt: WhatsAppParams = {
  body: 'Bonjour, votre examen est en attente de règlement. *Merci de régulariser.*',
  output: { mode: 'simple', successCondition: { statuses: ['delivered', 'read'] } }
}

const postalSuivi: PostalParams = {
  body: 'Courrier postal de rappel.',
  tracked: true,
  output: { mode: 'simple', successCondition: { statuses: ['delivered'] } }
}

const postalNonSuivi: PostalParams = {
  body: 'Courrier postal simple.',
  tracked: false,
  output: { mode: 'single' }
}

const condEmail: ConditionParams = {
  conditionType: 'data_available',
  expression: 'patient.email'
}

const condWhatsapp: ConditionParams = {
  conditionType: 'data_available',
  expression: 'patient.whatsapp'
}

const TEMPLATES = [
  { name: 'Email — première relance', kind: 'send_email', params: emailRelance },
  { name: 'Email — rappel ferme', kind: 'send_email', params: emailFerme },
  { name: 'SMS — court', kind: 'send_sms', params: smsCourt },
  { name: 'WhatsApp — message court', kind: 'send_whatsapp', params: whatsappCourt },
  { name: 'Postal — suivi', kind: 'send_postal', params: postalSuivi },
  { name: 'Postal — non suivi', kind: 'send_postal', params: postalNonSuivi },
  { name: 'Condition — email connu', kind: 'condition', params: condEmail },
  { name: 'Condition — WhatsApp dispo', kind: 'condition', params: condWhatsapp }
]

// Build a small example workflow: J+7 email → end at J+30 (simplistic but valid)
function buildExampleWorkflow(): { name: string; description: string; graph: Graph } {
  const startId = 'start-1'
  const emailId = 'email-1'
  const endId = 'end-1'
  return {
    name: 'Exemple — Relance simple',
    description: 'Workflow d’exemple seedé au démarrage',
    graph: {
      nodes: [
        { id: startId, position: { x: 0, y: START_Y }, data: { kind: 'start' } },
        { id: emailId, position: { x: 7, y: START_Y }, data: { kind: 'send_email', params: emailRelance } },
        { id: endId, position: { x: 30, y: START_Y }, data: { kind: 'end' } }
      ],
      edges: [
        { id: 'e-s-email', source: startId, target: emailId, daysAfter: 7 },
        { id: 'e-email-end', source: emailId, target: endId, daysAfter: 23 }
      ]
    }
  }
}

async function main() {
  // Validate each template body with Zod before inserting
  for (const t of TEMPLATES) {
    NodeTemplateBody.parse({ kind: t.kind, params: t.params })
  }

  // Idempotent seed: only insert if there are no templates yet (developers can wipe DB to reseed)
  const count = await prisma.nodeTemplate.count()
  if (count === 0) {
    for (const t of TEMPLATES) {
      await prisma.nodeTemplate.create({
        data: { name: t.name, kind: t.kind, params: JSON.stringify(t.params) }
      })
    }
    console.log(`✓ ${TEMPLATES.length} node templates seeded`)
  } else {
    console.log(`= ${count} node templates already present — skipping`)
  }

  const wfCount = await prisma.workflow.count()
  if (wfCount === 0) {
    const wf = buildExampleWorkflow()
    Graph.parse(wf.graph) // sanity check
    await prisma.workflow.create({
      data: { name: wf.name, description: wf.description, graph: JSON.stringify(wf.graph) }
    })
    console.log('✓ Example workflow seeded')
  } else {
    console.log(`= ${wfCount} workflows already present — skipping`)
  }
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 17.3: Run the seed**

Run:
```bash
pnpm --filter @rainpath/backend prisma:seed
```
Expected output: `✓ 8 node templates seeded` and `✓ Example workflow seeded`.

- [ ] **Step 17.4: Verify via Prisma Studio (optional, manual)**

Run:
```bash
pnpm --filter @rainpath/backend exec prisma studio
```
Expected: Browser opens at http://localhost:5555 showing 8 rows in `NodeTemplate` and 1 row in `Workflow`. Close.

- [ ] **Step 17.5: Commit**

```bash
git add backend/prisma/seed.ts backend/package.json
git commit -m "feat(backend): add seed script with 8 default node templates and one example workflow"
```

---

## Task 18: README + dev orchestration

**Files:**
- Create: `README.md` (replacing any prior placeholder)

- [ ] **Step 18.1: Write the README**

Replace (or create) the root `README.md`:
````markdown
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
````

- [ ] **Step 18.2: Verify root scripts work**

Run:
```bash
pnpm test
```
Expected: Shared tests pass (50+ assertions); backend test command may already work with NestJS default specs.

- [ ] **Step 18.3: Commit**

```bash
git add README.md
git commit -m "docs: add root README with quickstart, scripts, and API contract overview"
```

---

## Task 19: Final integration smoke check

- [ ] **Step 19.1: Clean install from scratch**

Run:
```bash
rm -rf node_modules shared/node_modules frontend/node_modules backend/node_modules
rm -f pnpm-lock.yaml
pnpm install
```
Expected: install succeeds end-to-end, lockfile regenerated.

- [ ] **Step 19.2: Build everything**

Run:
```bash
pnpm build
```
Expected: all three packages build without error.

- [ ] **Step 19.3: Run all tests**

Run:
```bash
pnpm test
```
Expected: shared tests pass.

- [ ] **Step 19.4: Re-seed the database** (lockfile changes may have invalidated migrations)

Run:
```bash
pnpm --filter @rainpath/backend prisma:migrate
pnpm --filter @rainpath/backend prisma:seed
```
Expected: existing migrations re-applied, seed succeeds (or reports "skipping" if data still present).

- [ ] **Step 19.5: Smoke test dev mode**

Run:
```bash
pnpm dev
```
Visit `http://localhost:5173`. Expected: page shows "shared loaded — start.X = 0" with a green check icon. Stop with Ctrl+C.

- [ ] **Step 19.6: Final commit (only if pnpm-lock.yaml changed)**

Run:
```bash
git add pnpm-lock.yaml || true
git diff --cached --quiet || git commit -m "chore: refresh pnpm-lock after clean install verification"
```

- [ ] **Step 19.7: Push**

Run:
```bash
git push
```

Expected: all Phase 0 commits are now on `origin/main`.

---

## Self-review notes (post-plan)

**Spec coverage check** :
- ✅ Spec §4.1 layout monorepo → Tasks 1, 12, 15
- ✅ Spec §4.2 stack technique → Tasks 12, 13, 14, 15, 16
- ✅ Spec §4.3 design system tokens → Tasks 13, 14
- ✅ Spec §5.1 Prisma schema (4 modèles + soft delete + index) → Task 16
- ✅ Spec §5.2 channel statuses → Task 3
- ✅ Spec §5.2.b channel format rules → Task 3
- ✅ Spec §5.3 Zod schemas (Position, GraphNode, GraphEdge, Graph, NodeData, NodeTemplate, DTOs, OutputConfig, DataAvailableExpressions) → Tasks 4, 5, 6
- ✅ Spec §5.4 computeXPositions (orphan tolerance, max convergence) → Task 7
- ✅ Spec §5.4.b computeReachability (topological, 5 states, data_available evaluation) → Task 9
- ✅ Spec §5.5 validation rules (structural + send output + condition + start position + duplicate handles + format + multi-coverage warning) → Task 8
- ✅ Spec §5.4.c simulate helpers → Task 10
- ✅ Spec §6 API body limit 1mb → Task 15
- ✅ Spec §8 Phase 0 seed (8 templates + 1 example) → Task 17
- ✅ Spec §9 DS tokens consumption via Tailwind config → Tasks 13, 14

**Placeholder scan**: clean (no TBD, TODO, "implement later", or "similar to Task N").

**Type consistency**: types used in later tasks (`OutputConfig`, `NodeData`, `Graph`, `NodeTemplate`) match definitions in earlier tasks. Algorithm signatures stable across implementation and tests.

**Scope check**: Phase 0 produces a working monorepo that builds, fully tested `shared/` (50+ assertions), Prisma DB with seeded data, and bootstrapped frontend/backend ready for Phase 1A/1B parallel development.
