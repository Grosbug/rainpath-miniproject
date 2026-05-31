import { describe, expect, it } from 'vitest'
import { chooseStep } from './TimelineBackground'

describe('chooseStep', () => {
  it("pas de 1 jour quand les jours sont larges à l'écran", () => {
    expect(chooseStep(44)).toBe(1) // 44px/jour ≥ LABEL_MIN_PX
  })
  it("élargit le pas quand les jours sont serrés", () => {
    // 28 px/jour (×1, zoom 1) : 28 < 44 → pas 1 trop serré, doit monter à 2
    expect(chooseStep(28)).toBe(2)
  })
  it("monte plus haut dans l'échelle quand très serré", () => {
    expect(chooseStep(5)).toBe(10)
  })
  it('retombe sur le dernier pas du ladder si extrêmement serré', () => {
    expect(chooseStep(0)).toBe(1000)
  })
})
