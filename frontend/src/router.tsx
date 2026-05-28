import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/AppLayout'
import NotFound from '@/pages/NotFound'
import WorkflowsList from '@/pages/WorkflowsList'
import WorkflowEditor from '@/pages/WorkflowEditor'
import PatientProfilesList from '@/pages/PatientProfilesList'
import PatientRunsList from '@/pages/PatientRunsList'
import PatientRunView from '@/pages/PatientRunView'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Navigate to='/workflows' replace /> },
      { path: '/workflows', element: <WorkflowsList /> },
      { path: '/workflows/:id', element: <WorkflowEditor /> },
      { path: '/patient-profiles', element: <PatientProfilesList /> },
      { path: '/workflows/:id/patient-runs', element: <PatientRunsList /> },
      { path: '/workflows/:id/patient-runs/:runId', element: <PatientRunView /> },
      { path: '*', element: <NotFound /> }
    ]
  }
])
