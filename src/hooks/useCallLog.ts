// Fetches call log entries from Supabase with filtering and pagination
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

export type CallLogEntry = Database['public']['Tables']['call_log']['Row'] & {
  users: { name: string } | null
}

export function useCallLog(filters?: {
  user_id?: string
  direction?: string
  call_status?: string
  outcome?: string
  from_date?: string
  to_date?: string
}) {
  return useQuery({
    queryKey: ['call-log', filters],
    queryFn: async () => {
      let query = supabase
        .from('call_log')
        .select('*, users(name)')
        .order('created_at', { ascending: false })
        .limit(200)

      if (filters?.user_id) query = query.eq('user_id', filters.user_id)
      if (filters?.direction) query = query.eq('direction', filters.direction)
      if (filters?.call_status) query = query.eq('call_status', filters.call_status)
      if (filters?.outcome) query = query.eq('outcome', filters.outcome)
      if (filters?.from_date) query = query.gte('created_at', filters.from_date)
      if (filters?.to_date) query = query.lte('created_at', filters.to_date + 'T23:59:59')

      const { data, error } = await query
      if (error) throw error
      return data
    }
  })
}
