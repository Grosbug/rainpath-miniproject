import { useEffect } from 'react'
import { create } from 'zustand'
import type { NodeTemplate } from '@rainpath/shared'

export type NodeKind = 'send_email' | 'send_sms' | 'send_whatsapp' | 'send_postal'

export type ModalContent =
  | { mode: 'node-edit'; nodeId: string; kind: NodeKind }
  | { mode: 'template-create'; kind: NodeKind }
  | { mode: 'template-edit'; template: NodeTemplate }
  | null

interface ModalState {
  content: ModalContent
  /** Count of small overlays (popovers, dropdowns) currently open. */
  overlayCount: number
  open(content: Exclude<ModalContent, null>): void
  close(): void
  incrementOverlay(): void
  decrementOverlay(): void
}

export const useModalState = create<ModalState>(set => ({
  content: null,
  overlayCount: 0,
  open: content => set({ content }),
  close: () => set({ content: null }),
  incrementOverlay: () => set(s => ({ overlayCount: s.overlayCount + 1 })),
  decrementOverlay: () => set(s => ({ overlayCount: Math.max(0, s.overlayCount - 1) }))
}))

/**
 * Bump the shared overlay counter while `open` is true and decrement on close /
 * unmount. Used by popovers / dropdowns / menus so the React Flow canvas knows
 * to suspend zoom while any of them is up.
 */
export function useTrackOverlayOpen(open: boolean): void {
  const inc = useModalState(s => s.incrementOverlay)
  const dec = useModalState(s => s.decrementOverlay)
  useEffect(() => {
    if (!open) return
    inc()
    return () => dec()
  }, [open, inc, dec])
}
