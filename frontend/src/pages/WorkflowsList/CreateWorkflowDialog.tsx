interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}
export function CreateWorkflowDialog({ open }: Props) {
  return open ? null : null
}
