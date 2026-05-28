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
