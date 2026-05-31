# Étirement de l'axe temporel (densité jours→pixels)

**Date :** 2026-05-31
**Statut :** Design validé, prêt pour planification d'implémentation

## Problème

Dans l'éditeur de workflow et la vue parcours patient, les nœuds peuvent être visuellement trop serrés le long de l'axe temporel. L'utilisateur veut pouvoir **écarter les nœuds** en augmentant la distance entre deux graduations de l'axe temporel — sans grossir les cartes ni l'axe vertical.

## Décisions de cadrage

| Question | Décision |
|---|---|
| Comportement de l'étirement | **Temps seul (densité)** : seul l'espacement jours→px change. Cartes et lanes verticales inchangées. |
| Contrôle | **Toolbar (slider + boutons) ET geste molette**, partageant le même état. |
| Persistance | **localStorage par poste**. |
| Portée | **Échelle unique partagée** entre éditeur workflow et parcours patient (une seule préférence). |
| Geste molette | **Ctrl/Cmd + molette = étirement** ; **molette seule = pan** ; **zoom natif via boutons Controls uniquement**. |
| Modificateur ancrage | J+0 ancré à gauche (naturel). Ancrage curseur en option pour la molette. |

## Approche retenue

**Échelle temporelle en coordonnées « monde ».** On transforme la constante figée `PX_PER_DAY = 28` en une valeur réactive `pxPerDay = BASE_PX_PER_DAY × timeScale`. Les positions X des nœuds (`canvasDay × pxPerDay`) et l'axe temporel lisent tous cette même valeur. Le zoom React Flow garde son rôle propre (vrai zoom uniforme).

### Pourquoi cette approche

- Correspond exactement à « temps seul » : ni Y ni la largeur des cartes ne sont multipliés.
- Propriété d'ancrage gratuite : J+0 est en X=0, et `0 × pxPerDay = 0` quelle que soit l'échelle → le bord gauche reste fixe pendant l'étirement, cohérent avec `useLeftAnchoredZoom`, sans correction de viewport.
- Occasion de dédupliquer `PX_PER_DAY`, aujourd'hui copié dans 3 fichiers.

### Approches rejetées

- **Transform CSS `scaleX`** : déforme aussi les cartes horizontalement ; contre-scaler chaque carte est fragile.
- **Détourner le zoom natif + contre-scaler le vertical** : se bat contre React Flow (zoom uniforme par nature), casse l'ancrage existant.

## Architecture

### 1. Source de vérité unique — `frontend/src/canvas/time-scale.ts` (nouveau)

```ts
export const BASE_PX_PER_DAY = 28
export const MIN_SCALE = 0.5   // → 14 px/jour (compact)
export const MAX_SCALE = 4     // → 112 px/jour (très aéré)
export const STEP_RATIO = 1.2  // facteur multiplicatif par cran
export const STORAGE_KEY = 'rainpath.timeScale'
```

Remplace les 3 occurrences dupliquées de `PX_PER_DAY` :
- `frontend/src/pages/WorkflowEditor/Canvas.tsx:21`
- `frontend/src/pages/PatientRunView/PatientCanvas.tsx:24`
- `frontend/src/pages/WorkflowEditor/TimelineBackground.tsx:5`

### 2. Store d'échelle partagé et persistant — `useTimeScale`

Petit store module-level branché sur `useSyncExternalStore` (zéro dépendance, pas de prop-drilling, synchronisation live entre toolbar et canvas dans une même vue).

API :
```ts
useTimeScale() → {
  timeScale: number       // multiplicateur, défaut 1
  pxPerDay: number        // BASE_PX_PER_DAY × timeScale
  setScale(s: number): void
  stretch(): void         // × STEP_RATIO, clampé
  compress(): void        // ÷ STEP_RATIO, clampé
  reset(): void           // → 1
}
```

- Clé localStorage unique partagée `rainpath.timeScale` : les deux vues lisent/écrivent la même valeur. Lecture au montage ; les deux vues étant sur des routes distinctes, la synchro inter-vues se fait via localStorage au montage (un listener `storage` optionnel pour la synchro multi-onglets).
- Toutes les valeurs bornées à `[MIN_SCALE, MAX_SCALE]`.
- `setScale` valide/clampe l'entrée (slider) ; valeurs non numériques ou hors-bornes ramenées dans l'intervalle.

### 3. Contrôle toolbar — `TimeScaleControl`

Composant inséré dans la barre d'outils des deux éditeurs :
- Bouton `−` (compress), bouton `+` (stretch).
- Slider mappé sur `[MIN_SCALE, MAX_SCALE]`.
- Lecture de la valeur courante (`×1.0`).
- Bouton/double-clic de reset à `×1.0`.

### 4. Geste molette — `useTimeStretchGesture`

Hook attaché à la pane React Flow :
- **Ctrl/Cmd + molette** → `preventDefault` + `stretch()`/`compress()` selon le signe de `deltaY`.
- N'intercepte que lorsque Ctrl ou Cmd (metaKey) est pressé ; sinon laisse passer (pan).
- Option : ancrage curseur — ajuster `viewport.x` pour que le jour sous le pointeur reste fixe pendant l'étirement (sinon ancrage gauche par défaut). Implémentable en V2 si la V1 (ancrage gauche) suffit.

### 5. Configuration React Flow (les deux canvases)

Conséquence de la décision molette :
- `zoomOnScroll={false}` — la molette seule ne zoome plus.
- `zoomOnPinch={false}` — libère Ctrl/Cmd+molette pour notre geste (sinon capté par le pinch-zoom natif).
- `panOnScroll={true}` — la molette seule fait du pan.
- Zoom natif conservé via les boutons `<Controls>` (et `useLeftAnchoredZoom` inchangé).

### 6. Câblage des positions et de l'axe

- `Canvas.tsx` et `PatientCanvas.tsx` : remplacer la constante locale par `pxPerDay` issu de `useTimeScale()`. Le `useMemo` calculant les positions des nœuds dépend désormais de `pxPerDay`.
- `TimelineBackground.tsx` : reçoit `pxPerDay` en prop. **Important** : `chooseStep` doit recevoir `pxPerDay × zoom` (pixels effectifs à l'écran) pour que la décimation des labels `J+N` reste correcte à toute échelle. Le `screenX` des graduations utilise `d × pxPerDay × zoom + viewport.x`.

### 7. Lanes verticales figées

Pour honorer « le vertical ne bouge pas », `compute-lanes.ts` calcule toujours `NODE_WIDTH_DAYS` avec `BASE_PX_PER_DAY` (28), **indépendamment de l'échelle**. L'assignation des lanes reste identique quel que soit l'étirement — aucun nœud ne change de ligne quand on étire. `LANE_HEIGHT` et `LANE_TOP_OFFSET` restent constants.

## Flux de données

```
timeScale (store localStorage, partagé)
   ↓
pxPerDay = BASE_PX_PER_DAY × timeScale
   ↓                              ↓
positions nœuds:                  TimelineBackground:
canvasDay × pxPerDay              graduations à d × pxPerDay × zoom + viewport.x
   ↓                              chooseStep(pxPerDay × zoom)
transform viewport (zoom RF)
   ↓
position écran
```

`compute-lanes` lit `BASE_PX_PER_DAY` (figé) → Y indépendant de `timeScale`.

## Gestion des cas limites

- **Valeur localStorage corrompue/absente** : fallback `timeScale = 1`, clamp systématique à la lecture.
- **Bornes** : `stretch`/`compress`/`setScale` clampent toujours ; les boutons se désactivent (ou no-op) aux extrêmes.
- **Décimation des labels** : `chooseStep` reçoit les px effectifs (`pxPerDay × zoom`) pour ne jamais chevaucher ni trop espacer les labels.
- **Synchro inter-vues** : valeur relue au montage de chaque vue ; listener `storage` pour la cohérence multi-onglets (optionnel).

## Stratégie de test

- **`time-scale` / `useTimeScale`** : clamp aux bornes, `stretch`/`compress` multiplicatifs, persistance localStorage (lecture/écriture/corruption), `reset`.
- **`chooseStep`** : retourne un pas correct pour des combinaisons `pxPerDay × zoom` représentatives (compact, normal, aéré).
- **`compute-lanes`** : l'assignation des lanes est invariante au `timeScale` (utilise `BASE_PX_PER_DAY`).
- **Geste molette** : Ctrl/Cmd+molette modifie l'échelle et `preventDefault` ; molette seule ne modifie pas l'échelle.
- **Intégration canvas** : changer l'échelle repositionne les nœuds horizontalement, garde J+0 ancré à gauche, ne déplace pas les nœuds verticalement.

## Fichiers touchés

| Fichier | Changement |
|---|---|
| `frontend/src/canvas/time-scale.ts` | **Nouveau** — constantes + store `useTimeScale`. |
| `frontend/src/canvas/TimeScaleControl.tsx` | **Nouveau** — contrôle toolbar. |
| `frontend/src/canvas/useTimeStretchGesture.ts` | **Nouveau** — geste Ctrl/Cmd+molette. |
| `frontend/src/pages/WorkflowEditor/Canvas.tsx` | Utilise `pxPerDay`, config RF molette, monte le contrôle + le geste. |
| `frontend/src/pages/PatientRunView/PatientCanvas.tsx` | Idem. |
| `frontend/src/pages/WorkflowEditor/TimelineBackground.tsx` | Prop `pxPerDay`, `chooseStep(pxPerDay × zoom)`. |
| `frontend/src/pages/PatientRunView/compute-lanes.ts` | `NODE_WIDTH_DAYS` basé sur `BASE_PX_PER_DAY` figé. |

(Chemins exacts des hooks/contrôles à adapter aux conventions de dossier existantes lors de l'implémentation.)
