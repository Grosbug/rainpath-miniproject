import type { WorkflowSummary } from '@/api/workflows'
interface Props {
  open: boolean
  target: WorkflowSummary | null
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}
export function DeleteWorkflowConfirm(_: Props) {
  return null
}
