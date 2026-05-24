// Call log — searchable history of all inbound and outbound calls
import { useState } from 'react'
import { useCallLog } from '@/hooks/useCallLog'
import { useUsers } from '@/hooks/useUsers'
import { formatDateTime, formatPhone } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
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

const dateInputClass =
  'flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

function formatOutcome(outcome: string | null): string {
  if (!outcome) return '—'
  return outcome
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function directionClass(direction: string): string {
  return direction === 'inbound' ? 'text-primary' : 'text-text-muted'
}

function statusClass(status: string): string {
  if (status === 'completed') return 'text-success'
  if (status === 'failed') return 'text-destructive'
  if (status === 'no-answer' || status === 'busy' || status === 'canceled') return 'text-warning'
  return 'text-text-muted'
}

function truncateError(message: string | null): string {
  if (!message) return '—'
  return message.length > 40 ? `${message.slice(0, 40)}...` : message
}

function truncateSid(sid: string): string {
  return `${sid.slice(0, 12)}...`
}

export function CallLogPage() {
  const [directionFilter, setDirectionFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [outcomeFilter, setOutcomeFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [copiedSid, setCopiedSid] = useState<string | null>(null)

  const { data: users } = useUsers()
  const { data: calls, isLoading, error } = useCallLog({
    user_id: userFilter || undefined,
    direction: directionFilter || undefined,
    call_status: statusFilter || undefined,
    outcome: outcomeFilter || undefined,
    from_date: fromDate || undefined,
    to_date: toDate || undefined,
  })

  const handleCopySid = async (sid: string) => {
    await navigator.clipboard.writeText(sid)
    setCopiedSid(sid)
    window.setTimeout(() => setCopiedSid(null), 1200)
  }

  const totalCalls = calls?.length ?? 0

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text">Call Log</h1>
        <p className="text-text-muted text-sm">Inbound and outbound call history.</p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Select
          value={directionFilter}
          onValueChange={(val) => setDirectionFilter(val === 'all' ? '' : val)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Directions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Directions</SelectItem>
            <SelectItem value="inbound">Inbound</SelectItem>
            <SelectItem value="outbound">Outbound</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(val) => setStatusFilter(val === 'all' ? '' : val)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="no-answer">No Answer</SelectItem>
            <SelectItem value="busy">Busy</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={outcomeFilter}
          onValueChange={(val) => setOutcomeFilter(val === 'all' ? '' : val)}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All Outcomes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Outcomes</SelectItem>
            <SelectItem value="reminder_created">Reminder Created</SelectItem>
            <SelectItem value="reminder_delivered">Reminder Delivered</SelectItem>
            <SelectItem value="reminder_voicemail">Reminder Voicemail</SelectItem>
            <SelectItem value="reminder_missed">Reminder Missed</SelectItem>
            <SelectItem value="auth_failed">Auth Failed</SelectItem>
            <SelectItem value="authenticated">Authenticated</SelectItem>
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
            {users?.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="from_date" className="text-xs text-text-muted">From</Label>
            <input
              id="from_date"
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className={dateInputClass}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to_date" className="text-xs text-text-muted">To</Label>
            <input
              id="to_date"
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className={dateInputClass}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Twilio SID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-text-muted py-12">
                        Loading call log...
                      </TableCell>
                    </TableRow>
                  ) : !calls || calls.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-text-muted py-12">
                        No calls found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    calls.map((call) => (
                      <TableRow key={call.id}>
                        <TableCell className="text-sm text-text">
                          {formatDateTime(call.created_at, 'America/New_York')}
                        </TableCell>
                        <TableCell className="font-medium text-text">
                          {call.users?.name ?? 'Unknown'}
                        </TableCell>
                        <TableCell className={`text-sm font-medium capitalize ${directionClass(call.direction)}`}>
                          {call.direction}
                        </TableCell>
                        <TableCell className="text-sm text-text">
                          {formatPhone(call.from_number)}
                        </TableCell>
                        <TableCell className="text-sm text-text">
                          {formatPhone(call.to_number)}
                        </TableCell>
                        <TableCell className={`text-sm font-medium ${statusClass(call.call_status)}`}>
                          {call.call_status === 'no-answer'
                            ? 'No Answer'
                            : call.call_status.charAt(0).toUpperCase() + call.call_status.slice(1)}
                        </TableCell>
                        <TableCell className="text-sm text-text">
                          {formatDuration(call.duration_seconds)}
                        </TableCell>
                        <TableCell className="text-sm text-text">
                          {formatOutcome(call.outcome)}
                        </TableCell>
                        <TableCell className="text-destructive text-xs">
                          {truncateError(call.error_message)}
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => void handleCopySid(call.twilio_call_sid)}
                            className="relative font-mono text-xs text-text-muted hover:text-text transition-colors"
                            title="Copy Twilio SID"
                          >
                            {truncateSid(call.twilio_call_sid)}
                            {copiedSid === call.twilio_call_sid && (
                              <span className="absolute -top-7 left-0 rounded bg-text px-2 py-1 text-xs text-white">
                                Copied
                              </span>
                            )}
                          </button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <p className="text-text-muted text-sm mt-3">
            Showing {totalCalls} of {totalCalls} calls
          </p>
        </>
      )}
    </div>
  )
}
