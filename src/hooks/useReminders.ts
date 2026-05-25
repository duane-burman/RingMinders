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

export function useCreateReminder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      user_id: string
      scheduled_at: string
      callback_number: string
      recording_url: string
      recording_duration?: number
      is_repeating: boolean
      repeat_type?: string
      repeat_interval_days?: number | null
      repeat_days_of_week?: number[] | null
      repeat_day_of_month?: number | null
      repeat_week_of_month?: number | null
      repeat_day_of_week?: number | null
      repeat_end_date?: string | null
    }) => {
      const { error } = await supabase.from('reminders').insert({
        ...data,
        status: 'pending',
        source: 'admin',
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reminders'] })
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reminders'] }),
    onError: (error: Error) => console.error('Cancel reminder failed:', error.message)
  })
}

export function useReminder(id: string) {
  return useQuery({
    queryKey: ['reminders', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reminders')
        .select('*, users(name, timezone, primary_phone, secondary_phone)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    }
  })
}

export function useUpdateReminder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: ReminderUpdate & { id: string }) => {
      const { error } = await supabase
        .from('reminders')
        .update(updates)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      queryClient.invalidateQueries({ queryKey: ['reminders', variables.id] })
    }
  })
}
