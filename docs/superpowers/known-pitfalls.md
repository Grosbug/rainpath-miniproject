# RainPath — Known runtime pitfalls

> Living list of gotchas discovered while executing the implementation plans. **Every new plan should reference or restate the relevant items in its preamble** so subagent implementers don't rediscover them.

Last updated after the Phase 3 cleanup pass: 2 of 13 pitfalls have been eliminated (#9, #10). The remaining are by-design constraints or have acceptable workarounds.

---

## 1. Dual-zod TS2719

**Symptom**: `error TS2719: Type 'X' is not assignable to type 'X'. Two different types with this name exist, but they are unrelated.`

**Root cause**: The frontend imports a Zod **schema** value from `@rainpath/shared` (e.g. `Graph`, `NodeTemplateBody`) and composes it into a frontend `z.object({ ..., graph: Graph })`. TypeScript sees `zod` from `shared/dist/index.d.ts` (built declarations) and from `frontend/node_modules/zod` as distinct module instances even though they symlink to the same pnpm-store path. The resulting `ZodObject` types are nominally different.

**Workaround**:
- Use `import type { Graph } from '@rainpath/shared'` when you only need the TS type.
- For runtime validation, call `Schema.safeParse(unknown)` separately. Never compose a shared Zod schema inside a frontend `z.object({ ... })`.
- Pattern in [`frontend/src/api/workflows.ts`](../../frontend/src/api/workflows.ts): a local `WorkflowDetailEnvelope` validates with `graph: z.unknown()`, then `Graph.safeParse(env.data.graph)` runs separately.

---

## 2. Lucide React v0.460 icon renames

Several common icons were renamed in lucide-react v0.460. **Always verify availability before using a name you remember from prior versions.**

| Old name (pre-0.460) | New name (≥ 0.460) |
|---|---|
| `Loader2` | `LoaderCircle` |
| `AlertCircle` | `CircleAlert` |
| `MoreVertical` | `EllipsisVertical` |
| `AlertTriangle` | `TriangleAlert` |

**Verified-present** in this codebase (run `node -e "console.log('X' in require('lucide-react').icons)"` to double-check before using a new name):
`Play, Square, Mail, MessageSquare, MessageCircle, Inbox, GitBranch, Anchor, Plus, Minus, Trash2, Copy, Save, Undo2, Redo2, EllipsisVertical, X, Check, LoaderCircle, CircleAlert, CircleCheck, TriangleAlert, Target, Construction, MapPinOff, RotateCw, Upload, Download, WifiOff, ArrowLeft, GripVertical, Pencil, ChevronDown, ChevronUp, ListPlus`.

---

## 3. Icon size constraint via the `Icon` wrapper

The shared `Icon` component in [`frontend/src/components/Icon.tsx`](../../frontend/src/components/Icon.tsx) restricts `size` to the union `16 | 20 | 24` (per DS §6). Passing `32` or larger causes a TS error.

**Workaround**:
- Use `size={24}` for empty/error states.
- For SVG details inside the canvas (e.g. axis labels), write raw `<text>` / `<svg>` — bypass the `Icon` wrapper.
- For dropdown items needing 14 px icons, cast intentionally: `size={14 as any}` (already used in [`DropdownMenu.tsx`](../../frontend/src/components/ui/DropdownMenu.tsx)).

---

## 4. Code style: no semicolons, single quotes

The entire monorepo (Phase 0 onwards) uses **no semicolons** and **single quotes**. `frontend/src/main.tsx`, `backend/src/main.ts`, and `shared/src/index.ts` are the reference files. Match this style exactly — no exceptions, even when the rest of the JS ecosystem uses semicolons.

Unicode right-single-quotation-mark (`'`, U+2019) is safe inside `'...'` JS string literals — it is **not** a JS delimiter. Use it for French text (`'L'élément'`) rather than escaped straight apostrophes (`'L\'élément'`) when readability matters.

---

## 5. TanStack Query v5 mutation state

`useMutation` exposes `isPending` (NOT `isLoading` — that flag was removed in v5).
`useQuery` still has both `isLoading` and `isPending`, but `isPending` is preferred for the strict-initial-load case.

---

## 6. Tailwind JIT can't scan template-literal class names

`bg-[var(--node-${family}-bg)]` will NOT work — Tailwind's JIT scanner reads source text statically, not runtime values. The class is silently dropped.

**Workarounds** (used in this codebase):
- **Inline styles** for fully dynamic family tokens: `style={{ backgroundColor: \`var(--node-${family}-bg)\` }}` — see [`NodeCard.tsx`](../../frontend/src/pages/WorkflowEditor/nodes/NodeCard.tsx).
- **Hardcoded per-file class strings** when the family is known statically: each `SendXNode.tsx` uses `border-[var(--node-email-accent)]` etc. as literal strings, so JIT picks them up.

If you need a hybrid, list all combinations in a `safelist` in `tailwind.config.ts` — but we've avoided that so far.

---

## 7. React Flow v12 — `useReactFlow` requires `<ReactFlowProvider>`

Any component using the imperative API (`useReactFlow()`, `screenToFlowPosition`, `fitView`, etc.) must be a descendant of a `<ReactFlowProvider>`. The provider is NOT created automatically by `<ReactFlow>`.

**Pattern** ([`Canvas.tsx`](../../frontend/src/pages/WorkflowEditor/Canvas.tsx)):
```tsx
function CanvasInner() {
  const { screenToFlowPosition } = useReactFlow()
  // …
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}
```

---

## 8. React Flow v12 needs an explicit-height parent

The `<ReactFlow>` element collapses to zero height unless its parent has a defined height. Use `min-h-dvh`, `h-[calc(100dvh-48px)]`, or similar — never rely on flex auto-sizing without a defined dimension somewhere in the chain.

---

## ~~RESOLVED~~ 9. Shared `ValidationWarning` type does not have `edgeId`

The `validateGraph` function from `@rainpath/shared` returns `{ errors: ValidationError[], warnings: ValidationWarning[] }`. The two types differ:

- `ValidationError` has: `code, message, nodeId?, edgeId?, path?`
- `ValidationWarning` has: `code, message, nodeId?, missingStatuses?`

If you write a generic `runValidation` helper that maps both, **do NOT include `w.edgeId`** when mapping warnings — it doesn't exist and triggers TS2339. See [`store.ts`](../../frontend/src/pages/WorkflowEditor/store.ts) `runValidation` for the correct mapping.

**RESOLVED**: `ValidationWarning` now carries `edgeId?: string` and the frontend `runValidation` maps it through. Kept here for historical context.

---

## ~~RESOLVED~~ 10. supertest default import on backend tsconfig

The backend's `tsconfig.json` does NOT enable `esModuleInterop`. So `import request from 'supertest'` fails at runtime (`supertest_1.default is not a function`). Use:
```ts
import * as request from 'supertest'
// …
;(request as any)(app.getHttpServer()).get('/api/whatever')
```
…or alternatively `import { default as request } from 'supertest'` if interop ever gets enabled. Pattern in [`backend/test/*.e2e-spec.ts`](../../backend/test/).

**RESOLVED**: `esModuleInterop: true` is now set in `backend/tsconfig.json`. E2E specs use the standard `import request from 'supertest'` pattern. Kept here for historical context.

---

## 11. Jest `moduleNameMapper` needed for `@rainpath/shared` in the backend

The backend Jest config has a `moduleNameMapper` entry pointing `@rainpath/shared` to `shared/src/index.ts` (TypeScript source, not the built `dist/`). This avoids rebuilding the shared package before each test run. See [`backend/package.json`](../../backend/package.json) `jest.moduleNameMapper` and [`backend/test/jest-e2e.json`](../../backend/test/jest-e2e.json).

If you add a new test suite that imports from `@rainpath/shared`, this works automatically — no extra config needed.

---

## 12. `@paralleldrive/cuid2` is a direct frontend AND backend dependency

Prisma's `@default(cuid())` uses cuid2 internally, but the Prisma client does NOT re-export the `createId` function. For generating IDs in application code, install `@paralleldrive/cuid2` directly as a dependency. Both packages do this (pinned to `2.2.2`).

---

## 13. `zod` is a direct frontend dependency

The Vite alias `@rainpath/shared → ../shared/src` causes Vite to resolve the shared sources directly. When that source code does `import { z } from 'zod'`, Vite needs to find `zod` from the frontend's perspective. So `frontend/package.json` must list `zod` as a direct dependency (pinned to the same version as shared — currently `3.23.8`).

This is why the dual-zod TS2719 (Pitfall 1) shows up: there are two zod resolutions even though they point at the same pnpm-store path. The workaround there (don't compose shared schemas) is the right fix.

---

## How to update this doc

When you finish a phase and discover a new pitfall — add it here. Cross-reference from the next plan's preamble. Keep entries terse: symptom + root cause + workaround + one code reference.
