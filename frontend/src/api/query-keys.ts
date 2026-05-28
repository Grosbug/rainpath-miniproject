export const queryKeys = {
  workflows: {
    all: ['workflows'] as const,
    list: () => [...queryKeys.workflows.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.workflows.all, 'detail', id] as const
  },
  nodeTemplates: {
    all: ['node-templates'] as const,
    list: () => [...queryKeys.nodeTemplates.all, 'list'] as const
  }
}
