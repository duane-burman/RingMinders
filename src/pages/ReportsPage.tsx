// Reports — delivery, failure, scheduler, and user activity reports
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  useDeliveryReport,
  useFailureReport,
  useSchedulerHealth,
  useUserActivityReport,
} from '@/hooks/useReports'
import { StatCard } from '@/components/shared/StatCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDateTime, formatPhone } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function formatDay(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function formatLabel(value: string): string {
  return value
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function successRateClass(rate: number): string {
  if (rate >= 80) return 'text-success'
  if (rate >= 50) return 'text-warning'
  return 'text-destructive'
}

function deliveryRateAccent(rate: number): 'success' | 'warning' | 'danger' {
  if (rate >= 80) return 'success'
  if (rate >= 50) return 'warning'
  return 'danger'
}

function secondsAgo(iso: string | null): number | null {
  if (!iso) return null
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
}

function formatAgo(seconds: number | null): string {
  if (seconds === null) return 'never'
  if (seconds < 60) return `${seconds} seconds ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minutes ago`
  const hours = Math.floor(minutes / 60)
  return `${hours} hours ago`
}

function schedulerStatus(lastRun: string | null): {
  label: string
  dot: string
  text: string
} {
  const elapsed = secondsAgo(lastRun)
  if (elapsed === null || elapsed > 300) {
    return { label: 'Scheduler critical', dot: 'bg-destructive', text: 'text-destructive' }
  }
  if (elapsed >= 120) {
    return { label: 'Scheduler warning', dot: 'bg-warning', text: 'text-warning' }
  }
  return { label: 'Scheduler healthy', dot: 'bg-success', text: 'text-success' }
}

function RangeSelect({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <Select
      value={String(value)}
      onValueChange={(val) => onChange(Number(val))}
    >
      <SelectTrigger className="w-44">
        <SelectValue placeholder="Date range" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="7">Last 7 Days</SelectItem>
        <SelectItem value="30">Last 30 Days</SelectItem>
        <SelectItem value="90">Last 90 Days</SelectItem>
      </SelectContent>
    </Select>
  )
}

export function ReportsPage() {
  const [searchParams] = useSearchParams()
  const defaultTab = searchParams.get('tab') ?? 'delivery'
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [deliveryRangeDays, setDeliveryRangeDays] = useState<number>(30)
  const [failureRangeDays, setFailureRangeDays] = useState<number>(30)

  const deliveryReport = useDeliveryReport(deliveryRangeDays)
  const failureReport = useFailureReport(failureRangeDays)
  const schedulerHealth = useSchedulerHealth()
  const userActivity = useUserActivityReport()

  const deliveryData = deliveryReport.data
  const failureData = failureReport.data
  const schedulerData = schedulerHealth.data
  const userRows = userActivity.data ?? []

  const deliveryRate = deliveryData?.total_due
    ? Math.round((deliveryData.total_delivered / deliveryData.total_due) * 100)
    : 0
  const status = schedulerStatus(schedulerData?.last_run ?? null)
  const lastRunAgo = formatAgo(secondsAgo(schedulerData?.last_run ?? null))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text">Reports</h1>
        <p className="text-text-muted text-sm">Delivery, failure, scheduler, and user activity reports.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
          <TabsTrigger value="failures">Failures</TabsTrigger>
          <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
          <TabsTrigger value="activity">User Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="delivery">
          <div className="mb-4">
            <RangeSelect value={deliveryRangeDays} onChange={setDeliveryRangeDays} />
          </div>

          {deliveryReport.error ? (
            <Alert variant="destructive">
              <AlertDescription>{(deliveryReport.error as Error).message}</AlertDescription>
            </Alert>
          ) : deliveryReport.isLoading ? (
            <div className="text-text-muted text-sm py-12 text-center">Loading delivery report...</div>
          ) : deliveryData ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard
                  label="Total Due"
                  value={deliveryData.total_due}
                  icon="ti-calendar"
                  accent="muted"
                />
                <StatCard
                  label="Delivered"
                  value={deliveryData.total_delivered}
                  icon="ti-check"
                  accent={deliveryData.total_delivered > 0 ? 'success' : 'muted'}
                />
                <StatCard
                  label="Missed"
                  value={deliveryData.total_missed}
                  icon="ti-bell-off"
                  accent={deliveryData.total_missed > 0 ? 'danger' : 'muted'}
                />
                <StatCard
                  label="Delivery Rate"
                  value={`${deliveryRate || 0}%`}
                  icon="ti-chart-bar"
                  accent={deliveryRateAccent(deliveryRate)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-surface border border-border rounded-lg p-4 text-text">
                  Avg attempts before delivery: {deliveryData.avg_attempts ?? 0}
                </div>
                <div className="bg-surface border border-border rounded-lg p-4 text-text">
                  Avg delivery latency: {deliveryData.avg_latency_minutes ?? 0} minutes
                </div>
              </div>

              <div className="bg-surface border border-border rounded-lg p-4 mb-6">
                <h2 className="font-medium text-text mb-4">Daily Breakdown</h2>
                <div className="h-[280px] min-w-0">
                  {activeTab === 'delivery' && (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <LineChart data={deliveryData.daily_breakdown ?? []}>
                        <CartesianGrid stroke="#E2E6EC" />
                        <XAxis dataKey="day" tickFormatter={formatDay} />
                        <YAxis allowDecimals={false} />
                        <Tooltip labelFormatter={(label) => formatDay(String(label))} />
                        <Legend />
                        <Line type="monotone" dataKey="delivered" stroke="#3DBE6E" />
                        <Line type="monotone" dataKey="voicemail" stroke="#E8A838" />
                        <Line type="monotone" dataKey="missed" stroke="#E05555" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="bg-surface border border-border rounded-lg overflow-hidden">
                <h2 className="font-medium text-text p-4 border-b border-border">Top Users by Volume</h2>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Delivered</TableHead>
                        <TableHead>Missed</TableHead>
                        <TableHead>Success Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(deliveryData.top_users ?? []).map((row) => {
                        const rate = row.total ? Math.round((row.delivered / row.total) * 100) : 0
                        return (
                          <TableRow key={row.name}>
                            <TableCell className="font-medium text-text">{row.name}</TableCell>
                            <TableCell>{row.total}</TableCell>
                            <TableCell>{row.delivered}</TableCell>
                            <TableCell>{row.missed}</TableCell>
                            <TableCell className={successRateClass(rate)}>{rate || 0}%</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="failures">
          <div className="mb-4">
            <RangeSelect value={failureRangeDays} onChange={setFailureRangeDays} />
          </div>

          {failureReport.error ? (
            <Alert variant="destructive">
              <AlertDescription>{(failureReport.error as Error).message}</AlertDescription>
            </Alert>
          ) : failureReport.isLoading ? (
            <div className="text-text-muted text-sm py-12 text-center">Loading failure report...</div>
          ) : failureData ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div className="bg-surface border border-border rounded-lg p-4">
                  <h2 className="font-medium text-text mb-4">Failures by Reason</h2>
                  <div className="space-y-3">
                    {(failureData.by_status ?? []).map((row) => (
                      <div key={row.call_status} className="flex items-center justify-between text-sm">
                        <span className="text-text">{formatLabel(row.call_status)}</span>
                        <span className="font-semibold text-text">{row.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-surface border border-border rounded-lg p-4">
                  <h2 className="font-medium text-text mb-4">Top Failing Users</h2>
                  <div className="space-y-3">
                    {(failureData.top_failing_users ?? []).map((row) => (
                      <div key={row.name} className="flex items-center justify-between text-sm">
                        <span className="text-text">{row.name}</span>
                        <span className="font-semibold text-text">{row.failed_calls}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-surface border border-border rounded-lg p-4">
                  <h2 className="font-medium text-text mb-4">Top Failing Numbers</h2>
                  <div className="space-y-3">
                    {(failureData.top_failing_numbers ?? []).map((row) => (
                      <div key={row.to_number} className="flex items-center justify-between text-sm">
                        <span className="text-text">{formatPhone(row.to_number)}</span>
                        <span className="font-semibold text-text">{row.failed_calls}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-surface border border-border rounded-lg overflow-hidden">
                <h2 className="font-medium text-text p-4 border-b border-border">Error Messages</h2>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Error Message</TableHead>
                        <TableHead>Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(failureData.error_codes ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-text-muted text-center py-8">
                            No errors recorded in this period.
                          </TableCell>
                        </TableRow>
                      ) : (
                        (failureData.error_codes ?? []).map((row) => (
                          <TableRow key={row.error_message}>
                            <TableCell className="text-text">{row.error_message}</TableCell>
                            <TableCell className="font-semibold text-text">{row.count}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="scheduler">
          {schedulerHealth.error ? (
            <Alert variant="destructive">
              <AlertDescription>{(schedulerHealth.error as Error).message}</AlertDescription>
            </Alert>
          ) : schedulerHealth.isLoading ? (
            <div className="text-text-muted text-sm py-12 text-center">Loading scheduler health...</div>
          ) : schedulerData ? (
            <>
              <div className="bg-surface border border-border rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between gap-4">
                  <div className={`flex items-center gap-2 text-sm font-medium ${status.text}`}>
                    <span className={`h-3 w-3 rounded-full ${status.dot}`} />
                    <span>{status.label} — last run {lastRunAgo}</span>
                  </div>
                  <div className={schedulerData.queue_depth > 0 ? 'text-warning' : 'text-success'}>
                    Queue depth: {schedulerData.queue_depth}
                  </div>
                </div>
              </div>

              <div className="bg-surface border border-border rounded-lg overflow-hidden mb-6">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>Processed</TableHead>
                        <TableHead>Failed</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(schedulerData.last_10_runs ?? []).map((run) => (
                        <TableRow key={run.executed_at}>
                          <TableCell className="text-sm text-text">{formatDateTime(run.executed_at)}</TableCell>
                          <TableCell>{run.reminders_due}</TableCell>
                          <TableCell>{run.reminders_processed}</TableCell>
                          <TableCell>{run.reminders_failed}</TableCell>
                          <TableCell>
                            <div className={run.edge_function_status === 200 && !run.error_message ? 'text-success' : 'text-destructive'}>
                              {run.edge_function_status === 200 && !run.error_message ? '✓' : '✕'}
                            </div>
                            {run.error_message && (
                              <div className="text-destructive text-xs">{run.error_message}</div>
                            )}
                          </TableCell>
                          <TableCell>{run.duration_ms}ms</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="bg-surface border border-border rounded-lg p-4">
                <h2 className="font-medium text-text mb-3">Gaps &gt; 5 minutes (last 24h)</h2>
                {!schedulerData.gaps || schedulerData.gaps.length === 0 ? (
                  <p className="text-success text-sm">No gaps detected.</p>
                ) : (
                  <div className="space-y-2">
                    {schedulerData.gaps.map((gap) => (
                      <p key={gap.executed_at} className="text-warning text-sm">
                        Gap of {Math.round(gap.gap_minutes)} minutes at {formatDateTime(gap.executed_at)}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="activity">
          {userActivity.error ? (
            <Alert variant="destructive">
              <AlertDescription>{(userActivity.error as Error).message}</AlertDescription>
            </Alert>
          ) : userActivity.isLoading ? (
            <div className="text-text-muted text-sm py-12 text-center">Loading user activity...</div>
          ) : (
            <div className="bg-surface border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>IVR</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead>Delivered</TableHead>
                      <TableHead>Missed</TableHead>
                      <TableHead>Pending</TableHead>
                      <TableHead>Success Rate</TableHead>
                      <TableHead>Last Call-In</TableHead>
                      <TableHead>Last Delivered</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium text-text">{row.name}</TableCell>
                        <TableCell>
                          <StatusBadge status={row.status as Parameters<typeof StatusBadge>[0]['status']} />
                        </TableCell>
                        <TableCell>{row.total_reminders}</TableCell>
                        <TableCell>{row.ivr_reminders}</TableCell>
                        <TableCell>{row.admin_reminders}</TableCell>
                        <TableCell>{row.delivered}</TableCell>
                        <TableCell>{row.missed}</TableCell>
                        <TableCell>{row.pending}</TableCell>
                        <TableCell className={successRateClass(row.success_rate)}>
                          {row.success_rate}%
                        </TableCell>
                        <TableCell>
                          {row.last_call_in ? formatDateTime(row.last_call_in) : 'Never'}
                        </TableCell>
                        <TableCell>
                          {row.last_delivered ? formatDateTime(row.last_delivered) : 'Never'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
