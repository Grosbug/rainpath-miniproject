import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/AppLayout'
import NotFound from '@/pages/NotFound'
import WorkflowsList from '@/pages/WorkflowsList'
import WorkflowEditor from '@/pages/WorkflowEditor'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Navigate to="/workflows" replace /> },
      { path: '/workflows', element: <WorkflowsList /> },
      { path: '/workflows/:id', element: <WorkflowEditor /> },
      { path: '*', element: <NotFound /> }
    ]
  }
])
