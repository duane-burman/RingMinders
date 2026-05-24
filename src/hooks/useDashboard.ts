// Fetches dashboard summary statistics and recent reminders
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Reminder } from './useReminders'

export interface DashboardStats {
  total_active_users: number
  total_pending_reminders: number
  reminders_due_today: number
  delivered_today: number
  missed_today: number
  failed_calls_24h: number
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_stats')
      if (error) throw error
      return data as DashboardStats
    },
    refetchInterval: 60000
  })
}

export function useRecentReminders() {
  return useQuery({
    queryKey: ['recent-reminders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reminders')
        .select('*, users(name, timezone)')
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data as Reminder[]
    },
    refetchInterval: 60000
  })
}
