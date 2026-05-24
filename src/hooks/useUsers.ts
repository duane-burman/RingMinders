// Fetches and mutates user accounts from Supabase
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { UserFormData } from '@/lib/validations'

export type User = Database['public']['Tables']['users']['Row']
export type UserInsert = Database['public']['Tables']['users']['Insert']
export type UserUpdate = Database['public']['Tables']['users']['Update']

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name')
      if (error) throw error
      return data
    }
  })
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('users')
        .update({ status })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] })
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: UserFormData & { pin_hash: string }) => {
      const phone = (p: string) => `+1${p}`
      const { error } = await supabase.from('users').insert({
        name: data.name,
        primary_phone: phone(data.primary_phone),
        secondary_phone: data.secondary_phone ? phone(data.secondary_phone) : null,
        pin_hash: data.pin_hash,
        timezone: data.timezone,
        retry_max_attempts: data.retry_max_attempts,
        retry_interval_minutes: data.retry_interval_minutes,
        notes: data.notes || null,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] })
  })
}
