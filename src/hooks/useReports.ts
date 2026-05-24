// Fetches report data from Supabase RPC functions
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface DeliveryReportData {
  total_due: number
  total_delivered: number
  total_voicemail: number
  total_missed: number
  avg_attempts: number
  avg_latency_minutes: number
  daily_breakdown: Array<{
    day: string
    delivered: number
    voicemail: number
    missed: number
    total: number
  }>
  top_users: Array<{
    name: string
    total: number
    delivered: number
    missed: number
  }>
}

export interface FailureReportData {
  by_status: Array<{ call_status: string; count: number }>
  top_failing_users: Array<{ name: string; failed_calls: number }>
  top_failing_numbers: Array<{ to_number: string; failed_calls: number }>
  error_codes: Array<{ error_message: string; count: number }>
}

export interface SchedulerHealthData {
  last_run: string
  last_10_runs: Array<{
    executed_at: string
    reminders_due: number
    reminders_processed: number
    reminders_failed: number
    edge_function_status: number
    error_message: string | null
    duration_ms: number
  }>
  errors_last_24h: number
  gaps: Array<{ executed_at: string; gap_minutes: number }> | null
  queue_depth: number
}

export interface UserActivityRow {
  id: string
  name: string
  status: string
  total_reminders: number
  ivr_reminders: number
  admin_reminders: number
  delivered: number
  missed: number
  pending: number
  success_rate: number
  last_call_in: string | null
  last_delivered: string | null
}

function dateRange(days: number) {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)
  return { start: start.toISOString(), end: end.toISOString() }
}

export function useDeliveryReport(rangeDays: number) {
  const { start, end } = dateRange(rangeDays)
  return useQuery({
    queryKey: ['delivery-report', rangeDays],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_delivery_report', {
        start_date: start,
        end_date: end,
      })
      if (error) throw error
      return data as DeliveryReportData
    }
  })
}

export function useFailureReport(rangeDays: number) {
  const { start, end } = dateRange(rangeDays)
  return useQuery({
    queryKey: ['failure-report', rangeDays],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_failure_report', {
        start_date: start,
        end_date: end,
      })
      if (error) throw error
      return data as FailureReportData
    }
  })
}

export function useSchedulerHealth() {
  return useQuery({
    queryKey: ['scheduler-health'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('check_scheduler_health')
      if (error) throw error
      return data as SchedulerHealthData
    },
    refetchInterval: 60000
  })
}

export function useUserActivityReport() {
  return useQuery({
    queryKey: ['user-activity-report'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_user_activity_report')
      if (error) throw error
      return (data as UserActivityRow[]) ?? []
    }
  })
}
