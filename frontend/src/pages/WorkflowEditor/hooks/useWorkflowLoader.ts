import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getWorkflow } from '@/api/workflows'
import { queryKeys } from '@/api/query-keys'
import { useEditorStore } from '../store'

export function useWorkflowLoader(id: string | undefined) {
  const query = useQuery({
    queryKey: id ? queryKeys.workflows.detail(id) : ['workflows', 'detail', 'none'],
    queryFn: () => getWorkflow(id!),
    enabled: !!id,
    staleTime: Infinity,
    refetchOnWindowFocus: false
  })

  const load = useEditorStore(s => s.load)
  const storeWfId = useEditorStore(s => s.workflowId)

  useEffect(() => {
    if (query.data && query.data.id !== storeWfId) {
      load({
        id: query.data.id,
        name: query.data.name,
        description: query.data.description ?? '',
        nodes: query.data.graph.nodes,
        edges: query.data.graph.edges
      })
    }
  }, [query.data, storeWfId, load])

  return query
}
