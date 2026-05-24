// Reminders list — view all reminders across all users
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useReminders, useCancelReminder } from '@/hooks/useReminders'
import { useUsers } from '@/hooks/useUsers'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDateTime, formatPhone, formatRepeat } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'


export function RemindersPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [cancelId, setCancelId] = useState<string | null>(null)

  const { data: reminders, isLoading, error } = useReminders({
    status: statusFilter || undefined,
    source: sourceFilter || undefined,
    user_id: userFilter || undefined,
  })

  const { data: users } = useUsers()
  const cancelReminder = useCancelReminder()

  const handleConfirmCancel = async () => {
    if (!cancelId) return
    await cancelReminder.mutateAsync(cancelId)
    setCancelId(null)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text">Reminders</h1>
          <p className="text-text-muted text-sm">All scheduled and historical reminders.</p>
        </div>
        <Button
          className="bg-primary text-primary-foreground"
          onClick={() => navigate('/reminders/new')}
        >
          New Reminder
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4">
        <Select
          value={statusFilter}
          onValueChange={(val) => setStatusFilter(val === 'all' ? '' : val)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="voicemail">Voicemail</SelectItem>
            <SelectItem value="missed">Missed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={sourceFilter}
          onValueChange={(val) => setSourceFilter(val === 'all' ? '' : val)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="ivr">IVR</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={userFilter}
          onValueChange={(val) => setUserFilter(val === 'all' ? '' : val)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Users" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {users?.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      ) : (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Callback Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Delivery Method</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Repeat</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-text-muted py-12">
                    Loading reminders...
                  </TableCell>
                </TableRow>
              ) : !reminders || reminders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-text-muted py-12">
                    No reminders found.
                  </TableCell>
                </TableRow>
              ) : (
                reminders.map((reminder) => (
                  <TableRow key={reminder.id}>
                    <TableCell className="font-medium text-text">
                      {reminder.users?.name ?? 'Unknown'}
                    </TableCell>
                    <TableCell className="text-sm text-text">
                      {formatDateTime(reminder.scheduled_at, reminder.users?.timezone)}
                    </TableCell>
                    <TableCell className="text-sm text-text">
                      {formatPhone(reminder.callback_number)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={reminder.status as Parameters<typeof StatusBadge>[0]['status']} />
                    </TableCell>
                    <TableCell className="text-sm text-text">
                      {reminder.delivery_method
                        ? reminder.delivery_method === 'human' ? 'Human' : 'Voicemail'
                        : <span className="text-text-muted">—</span>
                      }
                    </TableCell>
                    <TableCell className="text-sm text-text">
                      {reminder.delivery_attempts}
                    </TableCell>
                    <TableCell className="text-sm text-text">
                      {reminder.source === 'ivr' ? 'IVR' : 'Admin'}
                    </TableCell>
                    <TableCell className="text-text-muted text-sm">{formatRepeat(reminder)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/reminders/${reminder.id}`)}
                          className="p-1.5 text-text-muted hover:text-text transition-colors"
                          title="View / Edit"
                        >
                          <i className="ti ti-edit text-base" />
                        </button>
                        {reminder.status === 'pending' && (
                          <button
                            onClick={() => setCancelId(reminder.id)}
                            className="p-1.5 text-text-muted hover:text-destructive transition-colors"
                            title="Cancel"
                          >
                            <i className="ti ti-x text-base" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </div>
      )}

      {/* Cancel confirmation dialog */}
      <AlertDialog open={!!cancelId} onOpenChange={(open: boolean) => { if (!open) setCancelId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this reminder?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this reminder? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmCancel}
            >
              Cancel Reminder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
