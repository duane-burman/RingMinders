// Root application component — defines all routes
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProtectedRoute } from '@/components/shared/ProtectedRoute'
import { AppLayout } from '@/components/shared/AppLayout'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { UsersPage } from '@/pages/UsersPage'
import { UserDetailPage } from '@/pages/UserDetailPage'
import { UserNewPage } from '@/pages/UserNewPage'
import { RemindersPage } from '@/pages/RemindersPage'
import { ReminderNewPage } from '@/pages/ReminderNewPage'
import { ReminderDetailPage } from '@/pages/ReminderDetailPage'
import { CallLogPage } from '@/pages/CallLogPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { SchedulerHealthPage } from '@/pages/SchedulerHealthPage'
import { SettingsPage } from '@/pages/SettingsPage'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <AppLayout>
                <Routes>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/users/new" element={<UserNewPage />} />
                  <Route path="/users/:id" element={<UserDetailPage />} />
                  <Route path="/reminders" element={<RemindersPage />} />
                  <Route path="/reminders/new" element={<ReminderNewPage />} />
                  <Route path="/reminders/:id" element={<ReminderDetailPage />} />
                  <Route path="/call-log" element={<CallLogPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/reports/scheduler" element={<SchedulerHealthPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </AppLayout>
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
