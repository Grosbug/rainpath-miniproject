interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}
export function ImportWorkflowDialog({ open }: Props) {
  return open ? null : null
}
