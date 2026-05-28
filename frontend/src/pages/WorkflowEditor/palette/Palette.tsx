import { SystemNodesSection } from './SystemNodesSection'
import { TemplatesSection } from './TemplatesSection'

export function Palette() {
  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col overflow-y-auto border-r border-border bg-surface">
      <SystemNodesSection />
      <TemplatesSection />
    </aside>
  )
}
