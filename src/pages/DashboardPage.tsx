// Main dashboard — delivery stats, scheduler health, recent reminders
import { useNavigate } from 'react-router-dom'
import { useDashboardStats, useRecentReminders } from '@/hooks/useDashboard'
import { StatCard } from '@/components/shared/StatCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDateTime, formatRepeat } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const today = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

export function DashboardPage() {
  const navigate = useNavigate()
  const { data: stats, isLoading: statsLoading, error: statsError } = useDashboardStats()
  const { data: recentReminders, isLoading: remindersLoading, error: remindersError } = useRecentReminders()

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text">Dashboard</h1>
        <p className="text-text-muted text-sm">{today}</p>
      </div>

      {/* Stats error */}
      {statsError && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{(statsError as Error).message}</AlertDescription>
        </Alert>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {statsLoading ? (
          <>
            <div className="bg-border animate-pulse rounded h-16" />
            <div className="bg-border animate-pulse rounded h-16" />
            <div className="bg-border animate-pulse rounded h-16" />
            <div className="bg-border animate-pulse rounded h-16" />
            <div className="bg-border animate-pulse rounded h-16" />
            <div className="bg-border animate-pulse rounded h-16" />
          </>
        ) : stats ? (
          <>
            <StatCard label="Active Users" value={stats.total_active_users} />
            <StatCard label="Pending Reminders" value={stats.total_pending_reminders} />
            <StatCard label="Due Today" value={stats.reminders_due_today} />
            <StatCard
              label="Delivered Today"
              value={stats.delivered_today}
              valueClassName={stats.delivered_today > 0 ? 'text-success' : 'text-text'}
            />
            <StatCard
              label="Missed Today"
              value={stats.missed_today}
              valueClassName={stats.missed_today > 0 ? 'text-destructive' : 'text-text'}
            />
            <StatCard
              label="Failed Calls (24h)"
              value={stats.failed_calls_24h}
              valueClassName={stats.failed_calls_24h > 0 ? 'text-warning' : 'text-text'}
            />
          </>
        ) : null}
      </div>

      {/* Scheduler health placeholder */}
      <div className="flex items-center gap-2 mb-6">
        <div className="w-2 h-2 rounded-full bg-text-muted" />
        <span className="text-text-muted text-sm">Scheduler status unavailable until Twilio is configured</span>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="outline"
          onClick={() => navigate('/users/new')}
        >
          <i className="ti ti-user-plus mr-2" />
          New User
        </Button>
        <Button
          className="bg-primary text-primary-foreground"
          onClick={() => navigate('/reminders/new')}
        >
          <i className="ti ti-bell-plus mr-2" />
          New Reminder
        </Button>
      </div>

      {/* Recent reminders */}
      {remindersError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{(remindersError as Error).message}</AlertDescription>
        </Alert>
      )}

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-medium text-text">Recent Reminders</h2>
          <button
            onClick={() => navigate('/reminders')}
            className="text-primary text-sm hover:underline"
          >
            View all
          </button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Repeat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {remindersLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-text-muted py-12 text-sm">
                    Loading recent reminders...
                  </TableCell>
                </TableRow>
              ) : !recentReminders || recentReminders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-text-muted py-12 text-sm">
                    No reminders found.
                  </TableCell>
                </TableRow>
              ) : (
                recentReminders.map((reminder) => (
                  <TableRow
                    key={reminder.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => navigate(`/reminders/${reminder.id}`)}
                  >
                    <TableCell className="font-medium text-text">
                      {reminder.users?.name ?? 'Unknown'}
                    </TableCell>
                    <TableCell className="text-sm text-text">
                      {formatDateTime(reminder.scheduled_at, reminder.users?.timezone)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={reminder.status as Parameters<typeof StatusBadge>[0]['status']} />
                    </TableCell>
                    <TableCell className="text-text-muted text-sm">
                      {formatRepeat(reminder)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
