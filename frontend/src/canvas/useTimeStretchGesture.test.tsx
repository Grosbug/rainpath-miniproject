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

  it("molette seule ne change pas l'échelle", () => {
    const { getByTestId } = render(<Harness />)
    wheel(getByTestId('pane'), { deltaY: -1 })
    expect(useTimeScale.getState().timeScale).toBe(1)
  })

  it('preventDefault sur Ctrl+molette', () => {
    const { getByTestId } = render(<Harness />)
    const notCancelled = wheel(getByTestId('pane'), { ctrlKey: true, deltaY: -1 })
    expect(notCancelled).toBe(false) // dispatchEvent renvoie false si preventDefault a été appelé
  })

  it('stoppe la propagation sur Ctrl+molette (React Flow ne pane pas)', () => {
    let parentSaw = 0
    function Wrapped() {
      const ref = useRef<HTMLDivElement>(null)
      useTimeStretchGesture(ref)
      return (
        <div onWheel={() => { parentSaw++ }}>
          <div ref={ref} data-testid='pane' />
        </div>
      )
    }
    const { getByTestId } = render(<Wrapped />)
    wheel(getByTestId('pane'), { ctrlKey: true, deltaY: -1 })
    expect(parentSaw).toBe(0)
  })

  it('laisse propager la molette seule (pan possible)', () => {
    let parentSaw = 0
    function Wrapped() {
      const ref = useRef<HTMLDivElement>(null)
      useTimeStretchGesture(ref)
      return (
        <div onWheel={() => { parentSaw++ }}>
          <div ref={ref} data-testid='pane' />
        </div>
      )
    }
    const { getByTestId } = render(<Wrapped />)
    wheel(getByTestId('pane'), { deltaY: -1 })
    expect(parentSaw).toBe(1)
  })
})
