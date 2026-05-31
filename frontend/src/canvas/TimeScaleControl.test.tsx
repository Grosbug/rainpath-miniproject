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

  it('affiche le pourcentage courant', () => {
    useTimeScale.setState({ timeScale: 2 })
    render(<TimeScaleControl />)
    expect(screen.getByLabelText('Réinitialiser la densité')).toHaveTextContent('200%')
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
