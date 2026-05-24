// Redirects to the Reports page Scheduler tab
import { Navigate } from 'react-router-dom'

export function SchedulerHealthPage() {
  return <Navigate to="/reports?tab=scheduler" replace />
}
