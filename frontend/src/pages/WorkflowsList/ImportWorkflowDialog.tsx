import { ChangeEvent, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Graph } from '@rainpath/shared'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/Icon'
import { createWorkflow } from '@/api/workflows'
import { queryKeys } from '@/api/query-keys'
import { ApiError } from '@/api/client'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Parsed = { graph: Graph; suggestedName: string }

export function ImportWorkflowDialog({ open, onOpenChange }: Props) {
  const [issues, setIssues] = useState<string[]>([])
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [name, setName] = useState('')
  const qc = useQueryClient()
  const navigate = useNavigate()

  const reset = () => {
    setIssues([])
    setParsed(null)
    setName('')
  }

  const mut = useMutation({
    mutationFn: () =>
      createWorkflow({
        name: name.trim() || parsed?.suggestedName || 'Workflow importé',
        graph: parsed?.graph
      }),
    onSuccess: wf => {
      qc.invalidateQueries({ queryKey: queryKeys.workflows.list() })
      toast.success('Workflow importé')
      reset()
      onOpenChange(false)
      navigate(`/workflows/${wf.id}`)
    },
    onError: err => {
      const msg = err instanceof ApiError ? err.body.errors?.[0]?.message ?? err.message : 'Erreur'
      setIssues([msg])
    }
  })

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    let text: string
    try {
      text = await file.text()
    } catch {
      setIssues(['Fichier illisible'])
      return
    }

    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      setIssues(['Fichier non JSON valide'])
      return
    }

    // Support two import shapes:
    //  (a) raw graph: { nodes, edges }
    //  (b) exported workflow: { name, graph: {...} }
    const obj = json && typeof json === 'object' ? (json as Record<string, unknown>) : null
    const candidate = obj && 'graph' in obj ? obj['graph'] : json
    const r = Graph.safeParse(candidate)
    if (!r.success) {
      setIssues(r.error.issues.slice(0, 5).map(i => `${i.path.join('.') || '·'}: ${i.message}`))
      setParsed(null)
      return
    }

    const suggested =
      (obj && 'name' in obj ? String(obj['name']) : null) ?? file.name.replace(/\.json$/i, '')
    setParsed({ graph: r.data, suggestedName: suggested })
    setName(suggested)
    setIssues([])
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Importer un workflow"
      description="Sélectionnez un fichier JSON exporté depuis RainPath."
    >
      <div className="space-y-4">
        <label className="flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-surface-muted text-sm text-fg-muted hover:bg-surface">
          <Icon name="Upload" size={20} />
          <span>Cliquer pour choisir un fichier JSON</span>
          <input type="file" accept=".json,application/json" className="hidden" onChange={handleFile} />
        </label>

        {parsed ? (
          <div className="rounded-md border border-border bg-surface-muted p-3 text-sm">
            <p className="font-medium text-fg">
              Graphe détecté — {parsed.graph.nodes.length} nœud(s), {parsed.graph.edges.length} arête(s)
            </p>
            <label htmlFor="import-name" className="mt-3 mb-1 block text-xs font-medium text-fg-muted">
              Nom du nouveau workflow
            </label>
            <input
              id="import-name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm"
            />
          </div>
        ) : null}

        {issues.length > 0 ? (
          <ul role="alert" className="space-y-1 rounded-md border border-danger bg-[#FEF2F2] p-3 text-sm text-danger">
            {issues.map((m, i) => (
              <li key={i}>• {m}</li>
            ))}
          </ul>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!parsed}
            loading={mut.isPending}
            onClick={() => mut.mutate()}
          >
            Importer
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
