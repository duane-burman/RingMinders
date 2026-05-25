// Fetches and updates system-wide settings from the single-row settings table
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

export type Settings = Database['public']['Tables']['settings']['Row']
export type SettingsUpdate = Omit<Database['public']['Tables']['settings']['Update'], 'id' | 'updated_at'>

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .single()
      if (error) throw error
      return data
    }
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (updates: SettingsUpdate) => {
      const { error } = await supabase
        .from('settings')
        .update(updates)
        .eq('id', 1)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] })
  })
}
