import { beforeEach, describe, expect, it } from 'vitest'
import {
  BASE_PX_PER_DAY, MIN_SCALE, MAX_SCALE, STEP_RATIO, STORAGE_KEY,
  clampScale, readInitialScale, useTimeScale
} from './time-scale'

describe('clampScale', () => {
  it('borne en dessous du minimum', () => {
    expect(clampScale(0.1)).toBe(MIN_SCALE)
  })
  it('borne au dessus du maximum', () => {
    expect(clampScale(99)).toBe(MAX_SCALE)
  })
  it("laisse passer une valeur dans l'intervalle", () => {
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
  it('stretch multiplie par le ratio et persiste', () => {
    useTimeScale.getState().stretch()
    expect(useTimeScale.getState().timeScale).toBeCloseTo(STEP_RATIO, 5)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(String(useTimeScale.getState().timeScale))
  })
  it('compress divise par le ratio et persiste', () => {
    useTimeScale.getState().compress()
    expect(useTimeScale.getState().timeScale).toBeCloseTo(1 / STEP_RATIO, 5)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(String(useTimeScale.getState().timeScale))
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
