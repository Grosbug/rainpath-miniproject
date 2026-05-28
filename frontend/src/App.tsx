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
        <Icon name="CircleCheck" size={16} className="text-success" />
        shared loaded — start.X = {demo.get('s')}
      </p>
    </main>
  )
}
