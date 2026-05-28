import { create } from 'zustand'
import type { NodeTemplate } from '@rainpath/shared'

export type NodeKind = 'send_email' | 'send_sms' | 'send_whatsapp' | 'send_postal' | 'condition'

export type ModalContent =
  | { mode: 'node-edit'; nodeId: string; kind: NodeKind }
  | { mode: 'template-create'; kind: NodeKind }
  | { mode: 'template-edit'; template: NodeTemplate }
  | null

interface ModalState {
  content: ModalContent
  open(content: Exclude<ModalContent, null>): void
  close(): void
}

export const useModalState = create<ModalState>(set => ({
  content: null,
  open: content => set({ content }),
  close: () => set({ content: null })
}))
