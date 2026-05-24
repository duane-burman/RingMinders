// Fetches and mutates reminders from Supabase
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

export type Reminder = Database['public']['Tables']['reminders']['Row'] & {
  users: { name: string; timezone: string } | null
}

export type ReminderInsert = Database['public']['Tables']['reminders']['Insert']
export type ReminderUpdate = Database['public']['Tables']['reminders']['Update']

export function useReminders(filters?: {
  status?: string
  user_id?: string
  source?: string
}) {
  return useQuery({
    queryKey: ['reminders', filters],
    queryFn: async () => {
      let query = supabase
        .from('reminders')
        .select('*, users(name, timezone)')
        .order('scheduled_at', { ascending: false })

      if (filters?.status) query = query.eq('status', filters.status)
      if (filters?.user_id) query = query.eq('user_id', filters.user_id)
      if (filters?.source) query = query.eq('source', filters.source)

      const { data, error } = await query
      if (error) throw error
      return data
    }
  })
}

export function useCancelReminder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reminders')
        .update({ status: 'cancelled' })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reminders'] })
  })
}
