import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { queryKeys } from '@/api/query-keys'
import { createNodeTemplate, updateNodeTemplate, deleteNodeTemplate } from '@/api/node-templates'
import { describeError } from '@/api/error-messages'
import { useEditorStore } from '../store'
import { useModalState, type NodeKind, type ModalContent } from '../modal-state'
import { EmailParamsForm } from './EmailParamsForm'
import { SmsParamsForm } from './SmsParamsForm'
import { WhatsAppParamsForm } from './WhatsAppParamsForm'
import { PostalParamsForm } from './PostalParamsForm'
import type { AnyParams } from './form-types'

const KIND_LABEL: Record<NodeKind, string> = {
  send_email: 'Email',
  send_sms: 'SMS',
  send_whatsapp: 'WhatsApp',
  send_postal: 'Courrier postal'
}

function emptyParams(kind: NodeKind): AnyParams {
  switch (kind) {
    case 'send_email':    return { subject: '', body: '', output: { mode: 'simple', successCondition: { statuses: ['delivered', 'opened', 'clicked', 'unopened'] } } } as AnyParams
    case 'send_sms':      return { body: '', output: { mode: 'simple', successCondition: { statuses: ['delivered'] } } } as AnyParams
    case 'send_whatsapp': return { body: '', output: { mode: 'simple', successCondition: { statuses: ['delivered', 'read'] } } } as AnyParams
    case 'send_postal':   return { body: '', tracked: false, output: { mode: 'simple', successCondition: { statuses: ['sent'] } } } as AnyParams
  }
}

export function NodeEditorModal() {
  const content = useModalState(s => s.content)
  const closeModal = useModalState(s => s.close)
  if (!content) return null
  return <ModalBody content={content} onClose={closeModal} key={JSON.stringify(content)} />
}

interface BodyProps {
  content: Exclude<ModalContent, null>
  onClose: () => void
}

function ModalBody({ content, onClose }: BodyProps) {
  const editorNodes = useEditorStore(s => s.nodes)
  const updateNodeData = useEditorStore(s => s.updateNodeData)
  const removeNode = useEditorStore(s => s.removeNode)
  const qc = useQueryClient()

  const initialParams: AnyParams =
    content.mode === 'node-edit'
      ? ((): AnyParams => {
          const node = editorNodes.find(n => n.id === content.nodeId)
          if (node && 'params' in node.data) return node.data.params as AnyParams
          return emptyParams(content.kind)
        })()
      : content.mode === 'template-edit'
        ? ((content.template as unknown as { params: AnyParams }).params)
        : emptyParams(content.kind)

  const initialName: string =
    content.mode === 'template-edit' ? (content.template as unknown as { name: string }).name :
    ''

  const initialDescription: string =
    content.mode === 'template-edit'
      ? ((content.template as unknown as { description?: string }).description ?? '')
      : ''

  const [params, setParams] = useState<AnyParams>(initialParams)
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [error, setError] = useState<string | null>(null)

  const kind: NodeKind =
    content.mode === 'template-edit'
      ? ((content.template as unknown as { kind: NodeKind }).kind)
      : content.kind

  const createMut = useMutation({
    mutationFn: () => createNodeTemplate({
      name: name.trim() || `Nouveau ${KIND_LABEL[kind]}`,
      description: description.trim() || undefined,
      kind,
      params
    } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.nodeTemplates.list() })
      toast.success('Modèle créé')
      onClose()
    },
    onError: e => setError(describeError(e, 'Impossible de créer le modèle.'))
  })

  const updateMut = useMutation({
    mutationFn: () => updateNodeTemplate(
      content.mode === 'template-edit' ? (content.template as unknown as { id: string }).id : '',
      { name: name.trim() || undefined, description: description.trim() || undefined, params } as any
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.nodeTemplates.list() })
      toast.success('Modèle mis à jour')
      onClose()
    },
    onError: e => setError(describeError(e, 'Impossible de mettre à jour le modèle.'))
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteNodeTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.nodeTemplates.list() })
      toast.success('Modèle supprimé')
      onClose()
    },
    onError: e => setError(describeError(e, 'Impossible de supprimer le modèle.'))
  })

  const handleSave = () => {
    setError(null)
    if (content.mode === 'node-edit') {
      updateNodeData(content.nodeId, { kind, params } as any)
      onClose()
      return
    }
    if (content.mode === 'template-create') createMut.mutate()
    else updateMut.mutate()
  }

  const showNameField = content.mode !== 'node-edit'

  return (
    <Dialog
      open
      onOpenChange={o => { if (!o) onClose() }}
      title={
        content.mode === 'node-edit' ? `Éditer · ${KIND_LABEL[kind]}` :
        content.mode === 'template-edit' ? `Modèle · ${KIND_LABEL[kind]}` :
        `Nouveau modèle · ${KIND_LABEL[kind]}`
      }
      size='lg'
    >
      <div className='space-y-4'>
        {showNameField ? (
          <>
            <div>
              <label htmlFor='tmpl-name' className='mb-1 block text-sm font-medium text-fg'>
                Nom du modèle <span className='text-danger'>*</span>
              </label>
              <input
                id='tmpl-name'
                value={name}
                onChange={e => setName(e.target.value)}
                className='h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              />
            </div>
            <div>
              <label htmlFor='tmpl-desc' className='mb-1 block text-sm font-medium text-fg'>
                Description
              </label>
              <input
                id='tmpl-desc'
                value={description}
                onChange={e => setDescription(e.target.value)}
                className='h-9 w-full rounded-md border border-border bg-surface px-3 text-sm'
              />
            </div>
          </>
        ) : null}

        {kind === 'send_email' && (
          <EmailParamsForm value={params as any} onChange={setParams as any} />
        )}
        {kind === 'send_sms' && (
          <SmsParamsForm value={params as any} onChange={setParams as any} />
        )}
        {kind === 'send_whatsapp' && (
          <WhatsAppParamsForm value={params as any} onChange={setParams as any} />
        )}
        {kind === 'send_postal' && (
          <PostalParamsForm value={params as any} onChange={setParams as any} />
        )}

        {error ? <p role='alert' className='text-sm text-danger'>{error}</p> : null}

        <div className='flex items-center justify-between gap-2 pt-2'>
          {content.mode === 'node-edit' ? (
            <Button
              type='button'
              variant='danger'
              onClick={() => { removeNode(content.nodeId); onClose() }}
            >
              Supprimer
            </Button>
          ) : content.mode === 'template-edit' ? (
            <Button
              type='button'
              variant='danger'
              loading={deleteMut.isPending}
              disabled={createMut.isPending || updateMut.isPending}
              onClick={() => deleteMut.mutate((content.template as unknown as { id: string }).id)}
            >
              Supprimer
            </Button>
          ) : (
            <span />
          )}
          <div className='flex gap-2'>
            <Button type='button' variant='secondary' onClick={onClose}>Annuler</Button>
            <Button
              type='button'
              variant='primary'
              loading={createMut.isPending || updateMut.isPending}
              disabled={deleteMut.isPending}
              onClick={handleSave}
            >
              Enregistrer
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
