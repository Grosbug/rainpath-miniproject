import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/AppLayout'
import NotFound from '@/pages/NotFound'
import WorkflowsList from '@/pages/WorkflowsList'
import WorkflowEditorPlaceholder from '@/pages/WorkflowEditorPlaceholder'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Navigate to="/workflows" replace /> },
      { path: '/workflows', element: <WorkflowsList /> },
      { path: '/workflows/:id', element: <WorkflowEditorPlaceholder /> },
      { path: '*', element: <NotFound /> }
    ]
  }
])
