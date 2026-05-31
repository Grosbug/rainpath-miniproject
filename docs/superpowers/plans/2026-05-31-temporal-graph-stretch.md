# Étirement de l'axe temporel — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Permettre d'écarter/resserrer les nœuds le long de l'axe temporel (densité jours→pixels) dans l'éditeur de workflow et la vue parcours patient, via une toolbar et Ctrl/Cmd+molette, sans modifier la taille des cartes ni l'axe vertical.

**Architecture :** Une constante figée `PX_PER_DAY = 28` (dupliquée dans 5 endroits) devient une valeur réactive `pxPerDay = BASE_PX_PER_DAY × timeScale`, où `timeScale` vit dans un petit store zustand persisté en localStorage et partagé par les deux vues. Toutes les conversions jours↔pixels (positions des nœuds, axe temporel, curseur du jour, drag/drop) lisent cette valeur. Le zoom React Flow garde son rôle propre, mais on le désactive sur la molette/pinch pour réserver Ctrl/Cmd+molette à l'étirement et faire de la molette seule un pan.

**Tech Stack :** React 18, TypeScript, `@xyflow/react` 12.3.5, zustand 4.5.5, Vitest 1.6 + Testing Library, Tailwind. Alias `@/` → `frontend/src/`. Commandes lancées depuis `frontend/`.

---

## Décisions de cadrage (issues de la spec)

- **Temps seul** : seul l'espacement jours→px change ; cartes et lanes verticales inchangées.
- **Contrôle** : toolbar (boutons −/+ + slider) ET Ctrl/Cmd+molette, même état partagé.
- **Molette** : `zoomOnScroll=false`, `zoomOnPinch=false`, `panOnScroll=true` ; zoom natif uniquement via les boutons `<Controls>`. Ctrl/Cmd+molette = étirement.
- **Persistance** : localStorage, clé unique partagée `rainpath:time-scale`.
- **Portée** : une seule échelle pour les deux vues.
- **Ancrage** : J+0 est en X=0, donc `0 × pxPerDay = 0` → le bord gauche reste fixe pendant l'étirement, sans correction de viewport (cohérent avec `useLeftAnchoredZoom`). Aucun code d'ancrage à écrire en V1.

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `frontend/src/canvas/time-scale.ts` | **Nouveau.** Constantes + helpers purs (`clampScale`, `readInitialScale`) + store zustand `useTimeScale` + sélecteur `usePxPerDay`. |
| `frontend/src/canvas/time-scale.test.ts` | **Nouveau.** Tests des helpers purs et du store. |
| `frontend/src/canvas/TimeScaleControl.tsx` | **Nouveau.** Contrôle toolbar (−/+, slider, reset). |
| `frontend/src/canvas/TimeScaleControl.test.tsx` | **Nouveau.** Tests RTL du contrôle. |
| `frontend/src/canvas/useTimeStretchGesture.ts` | **Nouveau.** Hook geste Ctrl/Cmd+molette sur un ref. |
| `frontend/src/canvas/useTimeStretchGesture.test.tsx` | **Nouveau.** Tests RTL du geste. |
| `frontend/src/pages/WorkflowEditor/TimelineBackground.tsx` | Lit `pxPerDay` ; `chooseStep` exporté + signature en px-écran. |
| `frontend/src/pages/WorkflowEditor/TimelineBackground.test.ts` | **Nouveau.** Test de `chooseStep`. |
| `frontend/src/pages/WorkflowEditor/Canvas.tsx` | `pxPerDay` pour positions + drag/drop ; config molette RF ; monte le geste. |
| `frontend/src/pages/WorkflowEditor/TopBar.tsx` | Monte `<TimeScaleControl />`. |
| `frontend/src/pages/PatientRunView/PatientCanvas.tsx` | `pxPerDay` pour positions + `TodayCursor` ; config molette RF ; monte le geste. |
| `frontend/src/pages/PatientRunView/index.tsx` | Monte `<TimeScaleControl />` dans la barre. |
| `frontend/src/pages/PatientRunView/compute-lanes.ts` | Dédup : `NODE_WIDTH_DAYS` basé sur `BASE_PX_PER_DAY` (figé, inchangé fonctionnellement). |

---

## Task 1 : Store d'échelle temporelle (`time-scale.ts`)

**Files:**
- Create: `frontend/src/canvas/time-scale.ts`
- Test: `frontend/src/canvas/time-scale.test.ts`

- [ ] **Step 1 : Écrire les tests qui échouent**

Create `frontend/src/canvas/time-scale.test.ts` :

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import {
  BASE_PX_PER_DAY, MIN_SCALE, MAX_SCALE, STORAGE_KEY,
  clampScale, readInitialScale, useTimeScale
} from './time-scale'

describe('clampScale', () => {
  it('borne en dessous du minimum', () => {
    expect(clampScale(0.1)).toBe(MIN_SCALE)
  })
  it('borne au dessus du maximum', () => {
    expect(clampScale(99)).toBe(MAX_SCALE)
  })
  it('laisse passer une valeur dans l’intervalle', () => {
    expect(clampScale(1.5)).toBe(1.5)
  })
  it('retombe à 1 pour une valeur non finie', () => {
    expect(clampScale(Number.NaN)).toBe(1)
  })
})

describe('readInitialScale', () => {
  beforeEach(() => window.localStorage.clear())
  it('vaut 1 sans valeur stockée', () => {
    expect(readInitialScale()).toBe(1)
  })
  it('lit et parse une valeur valide', () => {
    window.localStorage.setItem(STORAGE_KEY, '2')
    expect(readInitialScale()).toBe(2)
  })
  it('clampe une valeur hors bornes', () => {
    window.localStorage.setItem(STORAGE_KEY, '50')
    expect(readInitialScale()).toBe(MAX_SCALE)
  })
  it('retombe à 1 pour une valeur corrompue', () => {
    window.localStorage.setItem(STORAGE_KEY, 'abc')
    expect(readInitialScale()).toBe(1)
  })
})

describe('useTimeScale', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useTimeScale.setState({ timeScale: 1 })
  })
  it('setScale clampe et persiste', () => {
    useTimeScale.getState().setScale(99)
    expect(useTimeScale.getState().timeScale).toBe(MAX_SCALE)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(String(MAX_SCALE))
  })
  it('stretch multiplie par le ratio', () => {
    useTimeScale.getState().stretch()
    expect(useTimeScale.getState().timeScale).toBeCloseTo(1.2, 5)
  })
  it('compress divise par le ratio', () => {
    useTimeScale.getState().compress()
    expect(useTimeScale.getState().timeScale).toBeCloseTo(1 / 1.2, 5)
  })
  it('reset revient à 1 et persiste', () => {
    useTimeScale.getState().setScale(2)
    useTimeScale.getState().reset()
    expect(useTimeScale.getState().timeScale).toBe(1)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('1')
  })
})

it('BASE_PX_PER_DAY vaut 28', () => {
  expect(BASE_PX_PER_DAY).toBe(28)
})
```

- [ ] **Step 2 : Lancer les tests, vérifier l'échec**

Run: `npx vitest run src/canvas/time-scale.test.ts`
Expected: FAIL — `Failed to resolve import "./time-scale"`.

- [ ] **Step 3 : Implémenter le store**

Create `frontend/src/canvas/time-scale.ts` :

```ts
import { create } from 'zustand'

/** Pixels entre deux jours adjacents à timeScale = 1 et zoom React Flow = 1. */
export const BASE_PX_PER_DAY = 28
export const MIN_SCALE = 0.5 // → 14 px/jour (compact)
export const MAX_SCALE = 4 // → 112 px/jour (très aéré)
export const STEP_RATIO = 1.2 // facteur multiplicatif par cran
export const STORAGE_KEY = 'rainpath:time-scale'

/** Ramène n dans [MIN_SCALE, MAX_SCALE] ; 1 si non fini. */
export function clampScale(n: number): number {
  if (!Number.isFinite(n)) return 1
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, n))
}

/** Lit l'échelle persistée (clampée), 1 par défaut. SSR-safe. */
export function readInitialScale(): number {
  if (typeof window === 'undefined') return 1
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === null) return 1
  return clampScale(Number.parseFloat(raw))
}

function persist(scale: number): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, String(scale))
}

interface TimeScaleState {
  /** Multiplicateur d'échelle temporelle (défaut 1). Partagé par les deux vues. */
  timeScale: number
  setScale(next: number): void
  stretch(): void
  compress(): void
  reset(): void
}

export const useTimeScale = create<TimeScaleState>(set => ({
  timeScale: readInitialScale(),
  setScale: next => set(() => {
    const s = clampScale(next)
    persist(s)
    return { timeScale: s }
  }),
  stretch: () => set(state => {
    const s = clampScale(state.timeScale * STEP_RATIO)
    persist(s)
    return { timeScale: s }
  }),
  compress: () => set(state => {
    const s = clampScale(state.timeScale / STEP_RATIO)
    persist(s)
    return { timeScale: s }
  }),
  reset: () => set(() => {
    persist(1)
    return { timeScale: 1 }
  })
}))

/**
 * Pixels par jour à l'échelle courante (coordonnées « monde », avant zoom RF).
 * Sélecteur renvoyant un primitif → sûr vis-à-vis de la comparaison Object.is
 * de zustand (pas de nouvel objet par render).
 */
export function usePxPerDay(): number {
  return useTimeScale(s => BASE_PX_PER_DAY * s.timeScale)
}
```

- [ ] **Step 4 : Lancer les tests, vérifier le succès**

Run: `npx vitest run src/canvas/time-scale.test.ts`
Expected: PASS (toutes).

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/canvas/time-scale.ts frontend/src/canvas/time-scale.test.ts
git commit -m "feat(canvas): store d'échelle temporelle persisté (time-scale)"
```

---

## Task 2 : Contrôle toolbar (`TimeScaleControl`)

**Files:**
- Create: `frontend/src/canvas/TimeScaleControl.tsx`
- Test: `frontend/src/canvas/TimeScaleControl.test.tsx`

Note : `IconButton` (`@/components/ui/IconButton`) accepte `icon` (nom lucide), `aria-label`, `onClick`, `disabled`, `data-rp-tooltip` — voir usage dans `TopBar.tsx`. Les icônes lucide `Minus` et `Plus` existent.

- [ ] **Step 1 : Écrire les tests qui échouent**

Create `frontend/src/canvas/TimeScaleControl.test.tsx` :

```tsx
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TimeScaleControl } from './TimeScaleControl'
import { MIN_SCALE, MAX_SCALE, useTimeScale } from './time-scale'

describe('TimeScaleControl', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useTimeScale.setState({ timeScale: 1 })
  })

  it('le bouton + écarte (timeScale augmente)', () => {
    render(<TimeScaleControl />)
    fireEvent.click(screen.getByLabelText("Écarter l'axe temporel"))
    expect(useTimeScale.getState().timeScale).toBeGreaterThan(1)
  })

  it('le bouton − resserre (timeScale diminue)', () => {
    render(<TimeScaleControl />)
    fireEvent.click(screen.getByLabelText("Resserrer l'axe temporel"))
    expect(useTimeScale.getState().timeScale).toBeLessThan(1)
  })

  it('le slider appelle setScale', () => {
    render(<TimeScaleControl />)
    fireEvent.change(screen.getByLabelText("Échelle de l'axe temporel"), {
      target: { value: '2' }
    })
    expect(useTimeScale.getState().timeScale).toBe(2)
  })

  it('le bouton de réinitialisation ramène à 1', () => {
    useTimeScale.setState({ timeScale: 2 })
    render(<TimeScaleControl />)
    fireEvent.click(screen.getByLabelText('Réinitialiser la densité'))
    expect(useTimeScale.getState().timeScale).toBe(1)
  })

  it('désactive − au minimum et + au maximum', () => {
    useTimeScale.setState({ timeScale: MIN_SCALE })
    const { rerender } = render(<TimeScaleControl />)
    expect(screen.getByLabelText("Resserrer l'axe temporel")).toBeDisabled()
    useTimeScale.setState({ timeScale: MAX_SCALE })
    rerender(<TimeScaleControl />)
    expect(screen.getByLabelText("Écarter l'axe temporel")).toBeDisabled()
  })
})
```

- [ ] **Step 2 : Lancer les tests, vérifier l'échec**

Run: `npx vitest run src/canvas/TimeScaleControl.test.tsx`
Expected: FAIL — `Failed to resolve import "./TimeScaleControl"`.

- [ ] **Step 3 : Implémenter le composant**

Create `frontend/src/canvas/TimeScaleControl.tsx` :

```tsx
import { IconButton } from '@/components/ui/IconButton'
import { MIN_SCALE, MAX_SCALE, useTimeScale } from './time-scale'

const EPS = 1e-6

/**
 * Contrôle de densité de l'axe temporel : boutons resserrer/écarter, slider
 * continu, et un bouton % qui réinitialise à 100 %. Pilote le store partagé
 * `useTimeScale` — monté dans les deux vues (éditeur + parcours patient).
 */
export function TimeScaleControl() {
  const timeScale = useTimeScale(s => s.timeScale)
  const stretch = useTimeScale(s => s.stretch)
  const compress = useTimeScale(s => s.compress)
  const setScale = useTimeScale(s => s.setScale)
  const reset = useTimeScale(s => s.reset)
  const pct = Math.round(timeScale * 100)

  return (
    <div className='flex items-center gap-1' aria-label="Densité de l'axe temporel">
      <IconButton
        icon='Minus'
        aria-label="Resserrer l'axe temporel"
        onClick={compress}
        disabled={timeScale <= MIN_SCALE + EPS}
        data-rp-tooltip='Resserrer les nœuds'
      />
      <input
        type='range'
        min={MIN_SCALE}
        max={MAX_SCALE}
        step={0.05}
        value={timeScale}
        onChange={e => setScale(Number.parseFloat(e.target.value))}
        aria-label="Échelle de l'axe temporel"
        className='h-1 w-24 cursor-pointer accent-primary'
      />
      <IconButton
        icon='Plus'
        aria-label="Écarter l'axe temporel"
        onClick={stretch}
        disabled={timeScale >= MAX_SCALE - EPS}
        data-rp-tooltip='Écarter les nœuds'
      />
      <button
        type='button'
        onClick={reset}
        className='min-w-[3ch] text-xs tabular-nums text-fg-muted hover:text-fg'
        aria-label='Réinitialiser la densité'
        data-rp-tooltip='Réinitialiser la densité (100 %)'
      >
        {pct}%
      </button>
    </div>
  )
}
```

- [ ] **Step 4 : Lancer les tests, vérifier le succès**

Run: `npx vitest run src/canvas/TimeScaleControl.test.tsx`
Expected: PASS.

Si `toBeDisabled()` n'est pas reconnu : vérifier que `@testing-library/jest-dom` est importé globalement (le repo a déjà des tests `.tsx` — il l'est via le setup vitest). Sinon ajouter `import '@testing-library/jest-dom'` en tête du test.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/canvas/TimeScaleControl.tsx frontend/src/canvas/TimeScaleControl.test.tsx
git commit -m "feat(canvas): contrôle toolbar de densité temporelle"
```

---

## Task 3 : Geste Ctrl/Cmd+molette (`useTimeStretchGesture`)

**Files:**
- Create: `frontend/src/canvas/useTimeStretchGesture.ts`
- Test: `frontend/src/canvas/useTimeStretchGesture.test.tsx`

- [ ] **Step 1 : Écrire les tests qui échouent**

Create `frontend/src/canvas/useTimeStretchGesture.test.tsx` :

```tsx
import { beforeEach, describe, expect, it } from 'vitest'
import { useRef } from 'react'
import { render } from '@testing-library/react'
import { useTimeStretchGesture } from './useTimeStretchGesture'
import { useTimeScale } from './time-scale'

function Harness() {
  const ref = useRef<HTMLDivElement>(null)
  useTimeStretchGesture(ref)
  return <div ref={ref} data-testid='pane' style={{ width: 100, height: 100 }} />
}

function wheel(el: Element, init: WheelEventInit): boolean {
  return el.dispatchEvent(new WheelEvent('wheel', { cancelable: true, bubbles: true, ...init }))
}

describe('useTimeStretchGesture', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useTimeScale.setState({ timeScale: 1 })
  })

  it('Ctrl+molette vers le haut écarte', () => {
    const { getByTestId } = render(<Harness />)
    wheel(getByTestId('pane'), { ctrlKey: true, deltaY: -1 })
    expect(useTimeScale.getState().timeScale).toBeGreaterThan(1)
  })

  it('Cmd+molette vers le bas resserre', () => {
    const { getByTestId } = render(<Harness />)
    wheel(getByTestId('pane'), { metaKey: true, deltaY: 1 })
    expect(useTimeScale.getState().timeScale).toBeLessThan(1)
  })

  it('molette seule ne change pas l’échelle', () => {
    const { getByTestId } = render(<Harness />)
    wheel(getByTestId('pane'), { deltaY: -1 })
    expect(useTimeScale.getState().timeScale).toBe(1)
  })

  it('preventDefault sur Ctrl+molette', () => {
    const { getByTestId } = render(<Harness />)
    const notCancelled = wheel(getByTestId('pane'), { ctrlKey: true, deltaY: -1 })
    expect(notCancelled).toBe(false) // dispatchEvent renvoie false si preventDefault a été appelé
  })
})
```

- [ ] **Step 2 : Lancer les tests, vérifier l'échec**

Run: `npx vitest run src/canvas/useTimeStretchGesture.test.tsx`
Expected: FAIL — import non résolu.

- [ ] **Step 3 : Implémenter le hook**

Create `frontend/src/canvas/useTimeStretchGesture.ts` :

```ts
import { useEffect, type RefObject } from 'react'
import { useTimeScale } from './time-scale'

/**
 * Ctrl/Cmd + molette au-dessus de `ref` écarte (deltaY < 0) ou resserre
 * (deltaY > 0) l'axe temporel. `preventDefault` bloque le zoom-page natif du
 * navigateur sur Ctrl+molette. La molette seule est laissée intacte pour que
 * React Flow puisse paner (panOnScroll). Listener non-passif (capture) requis
 * pour pouvoir annuler l'événement.
 */
export function useTimeStretchGesture(ref: RefObject<HTMLElement>): void {
  const stretch = useTimeScale(s => s.stretch)
  const compress = useTimeScale(s => s.compress)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      if (e.deltaY < 0) stretch()
      else if (e.deltaY > 0) compress()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [ref, stretch, compress])
}
```

- [ ] **Step 4 : Lancer les tests, vérifier le succès**

Run: `npx vitest run src/canvas/useTimeStretchGesture.test.tsx`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/canvas/useTimeStretchGesture.ts frontend/src/canvas/useTimeStretchGesture.test.tsx
git commit -m "feat(canvas): geste Ctrl/Cmd+molette pour étirer l'axe temporel"
```

---

## Task 4 : Brancher `TimelineBackground` sur `pxPerDay`

**Files:**
- Modify: `frontend/src/pages/WorkflowEditor/TimelineBackground.tsx`
- Test: `frontend/src/pages/WorkflowEditor/TimelineBackground.test.ts` (nouveau)

`chooseStep` reçoit aujourd'hui `zoom` et multiplie par la constante `PX_PER_DAY` en interne. On l'exporte et on lui passe directement les **pixels par jour à l'écran** (`pxPerDay × zoom`), pour que la décimation reste correcte à toute échelle.

- [ ] **Step 1 : Écrire le test de `chooseStep`**

Create `frontend/src/pages/WorkflowEditor/TimelineBackground.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { chooseStep } from './TimelineBackground'

describe('chooseStep', () => {
  it('pas de 1 jour quand les jours sont larges à l’écran', () => {
    expect(chooseStep(44)).toBe(1) // 44px/jour ≥ LABEL_MIN_PX
  })
  it('élargit le pas quand les jours sont serrés', () => {
    // 28 px/jour (×1, zoom 1) : 28 < 44 → pas 1 trop serré, doit monter à 2
    expect(chooseStep(28)).toBe(2)
  })
  it('monte plus haut dans l’échelle quand très serré', () => {
    expect(chooseStep(5)).toBeGreaterThanOrEqual(10)
  })
})
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npx vitest run src/pages/WorkflowEditor/TimelineBackground.test.ts`
Expected: FAIL — `chooseStep` n'est pas exporté (`export` manquant) / signature incompatible.

- [ ] **Step 3 : Modifier `TimelineBackground.tsx`**

Remplacer l'import et la constante en tête (lignes 1-6) :

```tsx
import { useMemo } from 'react'
import { useStore as useRFStore, useViewport } from '@xyflow/react'
import { usePxPerDay } from '@/canvas/time-scale'

const START_X_VIEW = 0
```

Remplacer le bloc `chooseStep` (lignes 14-22) — exporté, signature en px-écran :

```tsx
const LABEL_MIN_PX = 44
const STEP_LADDER = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000]
/**
 * Choisit le pas (en jours) entre deux graduations pour que les labels ne se
 * chevauchent jamais. `pxPerDayOnScreen` = pixels par jour réellement affichés
 * (densité × zoom). Échelle 1-2-5 standard.
 */
export function chooseStep(pxPerDayOnScreen: number): number {
  for (const step of STEP_LADDER) {
    if (pxPerDayOnScreen * step >= LABEL_MIN_PX) return step
  }
  return STEP_LADDER[STEP_LADDER.length - 1]!
}
```

Dans le composant, remplacer les lignes 30-31 :

```tsx
  // px par jour : densité « monde » (usePxPerDay) × zoom RF = px écran.
  const worldPxPerDay = usePxPerDay()
  const pxPerDay = worldPxPerDay * viewport.zoom
  const stepDays = chooseStep(pxPerDay)
```

Dans le `useMemo` (lignes 33-41), remplacer les deux usages de `PX_PER_DAY` par `worldPxPerDay` et ajouter la dépendance :

```tsx
  const { leftDay, rightDay } = useMemo(() => {
    const worldLeftX = -viewport.x / Math.max(viewport.zoom, 1e-6)
    const worldRightX = (widthPx - viewport.x) / Math.max(viewport.zoom, 1e-6)
    return {
      leftDay: Math.floor(worldLeftX / worldPxPerDay) - 2,
      rightDay: Math.ceil(worldRightX / worldPxPerDay) + 2
    }
  }, [viewport, widthPx, worldPxPerDay])
```

(La ligne `const screenX = d * pxPerDay + viewport.x + START_X_VIEW` reste inchangée — `pxPerDay` y est déjà la densité écran.)

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `npx vitest run src/pages/WorkflowEditor/TimelineBackground.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/pages/WorkflowEditor/TimelineBackground.tsx frontend/src/pages/WorkflowEditor/TimelineBackground.test.ts
git commit -m "feat(canvas): TimelineBackground lit la densité temporelle réactive"
```

---

## Task 5 : Brancher l'éditeur de workflow (`Canvas.tsx`)

**Files:**
- Modify: `frontend/src/pages/WorkflowEditor/Canvas.tsx`

Pas de test unitaire (intégration React Flow) — vérification par typecheck + manuel (Task 10).

- [ ] **Step 1 : Imports + suppression de la constante**

Ajouter aux imports (après la ligne 19) :

```tsx
import { usePxPerDay } from '@/canvas/time-scale'
import { useTimeStretchGesture } from '@/canvas/useTimeStretchGesture'
```

Supprimer la ligne 21 :

```tsx
const PX_PER_DAY = 28
```

- [ ] **Step 2 : `toRFNodes` reçoit `pxPerDay`**

Remplacer la signature et la conversion de position. Signature (ligne 36-41) — ajouter le paramètre :

```tsx
function toRFNodes(
  nodes: ReturnType<typeof useEditorStore.getState>['nodes'],
  errors: ReturnType<typeof useEditorStore.getState>['validationErrors'],
  warnings: ReturnType<typeof useEditorStore.getState>['validationWarnings'],
  liftedNodeIds: ReadonlySet<string> | null,
  pxPerDay: number
): RFNode[] {
```

Et la position (ligne 55) :

```tsx
    position: { x: n.position.x * pxPerDay, y: n.position.y },
```

- [ ] **Step 3 : `pxPerDay` dans `CanvasInner`, ref + geste**

Dans `CanvasInner`, juste après les sélecteurs de store (après la ligne 118 `const prettifyTick = ...`), ajouter :

```tsx
  const pxPerDay = usePxPerDay()
  const paneRef = useRef<HTMLDivElement>(null)
  useTimeStretchGesture(paneRef)
```

(`useRef` est déjà importé ligne 1.)

- [ ] **Step 4 : Passer `pxPerDay` au memo des nœuds**

Remplacer le memo `rfNodes` (lignes 156-159) :

```tsx
  const rfNodes = useMemo(
    () => toRFNodes(nodes, validationErrors, validationWarnings, liftedNodeIds, pxPerDay),
    [nodes, validationErrors, validationWarnings, liftedNodeIds, pxPerDay]
  )
```

- [ ] **Step 5 : Conversion inverse au drag**

Dans `onNodesChange`, remplacer la ligne 196 :

```tsx
          const dayX = ch.position.x / pxPerDay
```

Et ajouter `pxPerDay` au tableau de dépendances du `useCallback` (ligne 206) :

```tsx
    [nodes, setSelectedNode, updateNodePositionDrag, commitNodePositionDrag, pxPerDay]
```

- [ ] **Step 6 : Conversion au drop**

Dans `onDrop`, remplacer la ligne 274 :

```tsx
    const atX = (flowPos.x - NODE_WIDTH_PX / 2) / pxPerDay
```

Et la ligne 305 (dans `snapToMeasuredCenter`) :

```tsx
            const exactX = Math.max(0, (flowPos.x - w / 2) / pxPerDay)
```

Ajouter `pxPerDay` aux dépendances du `useCallback` `onDrop` (ligne 317) :

```tsx
  }, [addNode, screenToFlowPosition, getInternalNode, updateNodePositionDrag, pxPerDay])
```

- [ ] **Step 7 : Ref sur le wrapper + config molette React Flow**

Sur le `<div>` racine (ligne 358), ajouter le ref :

```tsx
    <div
      ref={paneRef}
      className='relative h-full w-full'
      onClick={onCanvasClick}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
```

Remplacer les deux props de zoom molette (lignes 380-381) et ajouter `panOnScroll` :

```tsx
        zoomOnDoubleClick={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        panOnScroll={!modalOpen && !popover}
```

(Le zoom natif reste accessible via les boutons `<Controls>`. `panOnDrag={[0,1,2]}` est conservé tel quel.)

- [ ] **Step 8 : Typecheck**

Run: `cd frontend && npx tsc -b`
Expected: aucune erreur.

- [ ] **Step 9 : Commit**

```bash
git add frontend/src/pages/WorkflowEditor/Canvas.tsx
git commit -m "feat(workflow-editor): densité temporelle réactive + Ctrl/Cmd+molette"
```

---

## Task 6 : Monter le contrôle dans la TopBar de l'éditeur

**Files:**
- Modify: `frontend/src/pages/WorkflowEditor/TopBar.tsx`

- [ ] **Step 1 : Import**

Ajouter après la ligne 17 :

```tsx
import { TimeScaleControl } from '@/canvas/TimeScaleControl'
```

- [ ] **Step 2 : Insérer le contrôle dans le groupe d'actions**

Dans le groupe `<div className='flex items-center gap-1'>`, insérer `<TimeScaleControl />` juste après `<ValidationStatusBadge />` (ligne 158) :

```tsx
        <ValidationStatusBadge />
        <TimeScaleControl />
```

- [ ] **Step 3 : Typecheck + lint**

Run: `cd frontend && npx tsc -b && npx eslint src/pages/WorkflowEditor/TopBar.tsx`
Expected: aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add frontend/src/pages/WorkflowEditor/TopBar.tsx
git commit -m "feat(workflow-editor): contrôle de densité dans la TopBar"
```

---

## Task 7 : Brancher la vue parcours patient (`PatientCanvas.tsx`)

**Files:**
- Modify: `frontend/src/pages/PatientRunView/PatientCanvas.tsx`

- [ ] **Step 1 : Imports + suppression de la constante**

Ajouter aux imports (après la ligne 22) :

```tsx
import { usePxPerDay } from '@/canvas/time-scale'
import { useTimeStretchGesture } from '@/canvas/useTimeStretchGesture'
```

Et `useRef` au premier import React (ligne 1) :

```tsx
import { useMemo, useRef, useState } from 'react'
```

Supprimer la ligne 24 :

```tsx
const PX_PER_DAY = 28
```

- [ ] **Step 2 : `pxPerDay` + ref + geste dans `CanvasInner`**

Après `useLeftAnchoredZoom(40)` (ligne 97), ajouter :

```tsx
  const pxPerDay = usePxPerDay()
  const paneRef = useRef<HTMLDivElement>(null)
  useTimeStretchGesture(paneRef)
```

- [ ] **Step 3 : Position X des nœuds**

Remplacer la ligne 156 :

```tsx
          x: canvasDay * pxPerDay,
```

Ajouter `pxPerDay` au tableau de dépendances du memo `rfNodes` (ligne 188) :

```tsx
  }, [graph, graph.nodes, focusedNodeId, activeFrontiers, actionableNodeIds, history, historyOutcomeByNode, yPositionFor, contactProfile, pendingByNode, onPendingChange, onFocusNode, pxPerDay])
```

- [ ] **Step 4 : Ref sur le wrapper + config molette**

Wrapper racine (ligne 219) :

```tsx
    <div ref={paneRef} className="rp-patient-canvas relative h-full w-full">
```

Ajouter les props de molette sur `<ReactFlow>` (après `maxZoom={2}`, ligne 230) :

```tsx
        minZoom={0.4}
        maxZoom={2}
        zoomOnScroll={false}
        zoomOnPinch={false}
        panOnScroll
```

- [ ] **Step 5 : `TodayCursor` lit `pxPerDay`**

Dans le composant `TodayCursor` (ligne 249), ajouter le hook et remplacer le calcul de `screenX` (ligne 254) :

```tsx
function TodayCursor({ day }: { day: number }) {
  const viewport = useViewport()
  const widthPx = useRFStore(s => s.width)
  const heightPx = useRFStore(s => s.height)
  const pxPerDay = usePxPerDay()
  if (day < 0) return null
  const screenX = day * pxPerDay * viewport.zoom + viewport.x
```

- [ ] **Step 6 : Typecheck**

Run: `cd frontend && npx tsc -b`
Expected: aucune erreur.

- [ ] **Step 7 : Lancer les tests liés au parcours patient (non-régression)**

Run: `npx vitest run src/pages/PatientRunView`
Expected: PASS (canvas-day, cumulative-days, use-day-simulator inchangés).

- [ ] **Step 8 : Commit**

```bash
git add frontend/src/pages/PatientRunView/PatientCanvas.tsx
git commit -m "feat(patient-run): densité temporelle réactive + Ctrl/Cmd+molette"
```

---

## Task 8 : Monter le contrôle dans la barre du parcours patient

**Files:**
- Modify: `frontend/src/pages/PatientRunView/index.tsx`

- [ ] **Step 1 : Import**

Ajouter après la ligne 18 (`import { useDaySimulator }...`) :

```tsx
import { TimeScaleControl } from '@/canvas/TimeScaleControl'
```

- [ ] **Step 2 : Insérer le contrôle dans la barre des contrôles de jour**

Remplacer le bloc (lignes 195-203) :

```tsx
          <div className="flex items-center border-b border-border bg-surface px-4 py-2">
            <DayCursorControls
              sim={sim}
              graph={run.workflow.graph}
              activeFrontiers={run.activeFrontiers}
              workflowId={run.workflowId}
              workflowName={run.workflow.name}
            />
            <div className="ml-auto pl-3">
              <TimeScaleControl />
            </div>
          </div>
```

- [ ] **Step 3 : Typecheck + lint**

Run: `cd frontend && npx tsc -b && npx eslint src/pages/PatientRunView/index.tsx`
Expected: aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add frontend/src/pages/PatientRunView/index.tsx
git commit -m "feat(patient-run): contrôle de densité dans la barre d'outils"
```

---

## Task 9 : Dédupliquer la constante dans `compute-lanes.ts`

**Files:**
- Modify: `frontend/src/pages/PatientRunView/compute-lanes.ts`

Changement **sans effet fonctionnel** : on remplace le littéral `28` par `BASE_PX_PER_DAY` (qui vaut 28). Les lanes restent volontairement indépendantes de l'échelle (le vertical ne bouge pas).

- [ ] **Step 1 : Import + remplacement**

Ajouter en tête (après la ligne 1) :

```ts
import { BASE_PX_PER_DAY } from '@/canvas/time-scale'
```

Remplacer la ligne 23 :

```ts
const NODE_WIDTH_DAYS = Math.ceil(176 / BASE_PX_PER_DAY) + 1 // 7 day-columns
```

Mettre à jour le commentaire JSDoc juste au-dessus (ligne ~20) : remplacer « PatientCanvas `PX_PER_DAY = 28` » par « `BASE_PX_PER_DAY` (time-scale.ts) ».

- [ ] **Step 2 : Typecheck + tests du dossier**

Run: `cd frontend && npx tsc -b && npx vitest run src/pages/PatientRunView`
Expected: aucune erreur, tests PASS (lanes inchangées).

- [ ] **Step 3 : Commit**

```bash
git add frontend/src/pages/PatientRunView/compute-lanes.ts
git commit -m "refactor(patient-run): dédup PX_PER_DAY via BASE_PX_PER_DAY"
```

---

## Task 10 : Vérification globale + contrôle manuel

**Files:** aucun (vérification).

- [ ] **Step 1 : Suite de tests complète**

Run: `cd frontend && npm test`
Expected: tous les tests PASS.

- [ ] **Step 2 : Build + lint**

Run: `cd frontend && npm run build && npm run lint`
Expected: build OK, aucun warning/erreur eslint.

- [ ] **Step 3 : Contrôle manuel (dev server)**

Run: `cd frontend && npm run dev` puis dans le navigateur :

Éditeur de workflow :
- Cliquer `+` / `−` dans la TopBar → les nœuds s'écartent / se resserrent horizontalement ; les cartes gardent leur taille ; J+0 reste collé à gauche.
- Bouger le slider → densité continue.
- Ctrl (ou Cmd) + molette → étire / resserre ; molette seule → pan ; pas de zoom-page navigateur.
- Les boutons `<Controls>` (+/−) zooment toujours.
- Glisser-déposer un modèle depuis la palette à densité ≠ 100 % → le nœud tombe au bon endroit (la conversion px→jour utilise la densité courante).
- Déplacer un nœud à densité ≠ 100 % → le `daysAfter` reste cohérent après relâchement.
- Les labels `J+N` de l'axe restent lisibles (pas de chevauchement) en compact comme en aéré.

Vue parcours patient :
- Le réglage de densité est **le même** que dans l'éditeur (échelle partagée).
- Le curseur du jour (`J+N` pointillé) reste aligné sur la carte focalisée à toute densité.
- Recharger la page → la densité est restaurée (localStorage).

- [ ] **Step 4 : Commit éventuel d'ajustements**

Si le contrôle manuel révèle un défaut, le corriger puis :

```bash
git add -A && git commit -m "fix(canvas): ajustements densité temporelle après contrôle manuel"
```

---

## Auto-revue du plan

- **Couverture spec :** source unique (T1) ; store partagé + persistance (T1) ; contrôle toolbar deux vues (T2/T6/T8) ; geste Ctrl/Cmd+molette (T3 + câblage T5/T7) ; config molette RF zoomOnScroll/zoomOnPinch=false + panOnScroll (T5/T7) ; TimelineBackground `pxPerDay×zoom` + chooseStep (T4) ; lanes figées (T9) ; ancrage J+0 gauche (automatique, documenté). ✓
- **Placeholders :** aucun — chaque étape contient le code/commande exacts. ✓
- **Cohérence des types :** `usePxPerDay()`, `useTimeScale`, `clampScale`, `readInitialScale`, `chooseStep(pxPerDayOnScreen)`, `useTimeStretchGesture(ref)`, `<TimeScaleControl />` utilisés de façon identique entre tasks. La constante locale `PX_PER_DAY` est supprimée partout où elle existait (TimelineBackground T4, Canvas T5, PatientCanvas T7, compute-lanes T9). ✓
