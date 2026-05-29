export const queryKeys = {
  workflows: {
    all: ['workflows'] as const,
    list: () => [...queryKeys.workflows.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.workflows.all, 'detail', id] as const
  },
  nodeTemplates: {
    all: ['node-templates'] as const,
    list: () => [...queryKeys.nodeTemplates.all, 'list'] as const
  },
  patientProfiles: {
    all: ['patient-profiles'] as const,
    list: () => [...queryKeys.patientProfiles.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.patientProfiles.all, 'detail', id] as const
  },
  patientRuns: {
    all: ['patient-runs'] as const,
    listForWorkflow: (workflowId: string) => [...queryKeys.patientRuns.all, 'workflow', workflowId] as const,
    listForPatient: (patientId: string) => [...queryKeys.patientRuns.all, 'patient', patientId] as const,
    detail: (id: string) => [...queryKeys.patientRuns.all, 'detail', id] as const
  }
}
