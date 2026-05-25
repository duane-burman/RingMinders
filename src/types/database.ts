export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      call_log: {
        Row: {
          call_status: string
          created_at: string
          direction: string
          duration_seconds: number | null
          error_message: string | null
          from_number: string
          id: string
          outcome: string | null
          reminder_id: string | null
          to_number: string
          twilio_call_sid: string
          user_id: string | null
        }
        Insert: {
          call_status: string
          created_at?: string
          direction: string
          duration_seconds?: number | null
          error_message?: string | null
          from_number: string
          id?: string
          outcome?: string | null
          reminder_id?: string | null
          to_number: string
          twilio_call_sid: string
          user_id?: string | null
        }
        Update: {
          call_status?: string
          created_at?: string
          direction?: string
          duration_seconds?: number | null
          error_message?: string | null
          from_number?: string
          id?: string
          outcome?: string | null
          reminder_id?: string | null
          to_number?: string
          twilio_call_sid?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_log_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          callback_number: string
          created_at: string
          delivered_at: string | null
          delivery_attempts: number
          delivery_method: string | null
          heard_at: string | null
          id: string
          is_repeating: boolean
          last_attempt_at: string | null
          next_retry_at: string | null
          parent_reminder_id: string | null
          recording_duration: number | null
          recording_url: string
          repeat_day_of_month: number | null
          repeat_day_of_week: number | null
          repeat_days_of_week: number[] | null
          repeat_end_date: string | null
          repeat_interval_days: number | null
          repeat_type: string | null
          repeat_week_of_month: number | null
          scheduled_at: string
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          callback_number: string
          created_at?: string
          delivered_at?: string | null
          delivery_attempts?: number
          delivery_method?: string | null
          heard_at?: string | null
          id?: string
          is_repeating?: boolean
          last_attempt_at?: string | null
          next_retry_at?: string | null
          parent_reminder_id?: string | null
          recording_duration?: number | null
          recording_url: string
          repeat_day_of_month?: number | null
          repeat_day_of_week?: number | null
          repeat_days_of_week?: number[] | null
          repeat_end_date?: string | null
          repeat_interval_days?: number | null
          repeat_type?: string | null
          repeat_week_of_month?: number | null
          scheduled_at: string
          source: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          callback_number?: string
          created_at?: string
          delivered_at?: string | null
          delivery_attempts?: number
          delivery_method?: string | null
          heard_at?: string | null
          id?: string
          is_repeating?: boolean
          last_attempt_at?: string | null
          next_retry_at?: string | null
          parent_reminder_id?: string | null
          recording_duration?: number | null
          recording_url?: string
          repeat_day_of_month?: number | null
          repeat_day_of_week?: number | null
          repeat_days_of_week?: number[] | null
          repeat_end_date?: string | null
          repeat_interval_days?: number | null
          repeat_type?: string | null
          repeat_week_of_month?: number | null
          scheduled_at?: string
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_parent_reminder_id_fkey"
            columns: ["parent_reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduler_log: {
        Row: {
          duration_ms: number | null
          edge_function_status: number | null
          error_message: string | null
          executed_at: string
          id: number
          reminders_due: number
          reminders_failed: number
          reminders_processed: number
        }
        Insert: {
          duration_ms?: number | null
          edge_function_status?: number | null
          error_message?: string | null
          executed_at?: string
          id?: number
          reminders_due: number
          reminders_failed: number
          reminders_processed: number
        }
        Update: {
          duration_ms?: number | null
          edge_function_status?: number | null
          error_message?: string | null
          executed_at?: string
          id?: number
          reminders_due?: number
          reminders_failed?: number
          reminders_processed?: number
        }
        Relationships: []
      }
      settings: {
        Row: {
          account_lockout_duration_minutes: number
          account_lockout_threshold: number
          default_retry_interval_minutes: number
          default_retry_max_attempts: number
          default_timezone: string
          id: number
          max_recording_length_seconds: number
          scheduler_concurrency_limit: number
          scheduler_secret: string | null
          updated_at: string
        }
        Insert: {
          account_lockout_duration_minutes?: number
          account_lockout_threshold?: number
          default_retry_interval_minutes?: number
          default_retry_max_attempts?: number
          default_timezone?: string
          id?: number
          max_recording_length_seconds?: number
          scheduler_concurrency_limit?: number
          scheduler_secret?: string | null
          updated_at?: string
        }
        Update: {
          account_lockout_duration_minutes?: number
          account_lockout_threshold?: number
          default_retry_interval_minutes?: number
          default_retry_max_attempts?: number
          default_timezone?: string
          id?: number
          max_recording_length_seconds?: number
          scheduler_concurrency_limit?: number
          scheduler_secret?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          id: string
          locked_until: string | null
          name: string
          notes: string | null
          pin_attempts: number
          pin_hash: string
          primary_phone: string
          retry_interval_minutes: number
          retry_max_attempts: number
          secondary_phone: string | null
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          locked_until?: string | null
          name: string
          notes?: string | null
          pin_attempts?: number
          pin_hash: string
          primary_phone: string
          retry_interval_minutes?: number
          retry_max_attempts?: number
          secondary_phone?: string | null
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          locked_until?: string | null
          name?: string
          notes?: string | null
          pin_attempts?: number
          pin_hash?: string
          primary_phone?: string
          retry_interval_minutes?: number
          retry_max_attempts?: number
          secondary_phone?: string | null
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_scheduler_health: { Args: never; Returns: Json }
      get_dashboard_stats: { Args: never; Returns: Json }
      get_delivery_report: {
        Args: { end_date: string; start_date: string }
        Returns: Json
      }
      get_failure_report: {
        Args: { end_date: string; start_date: string }
        Returns: Json
      }
      get_user_activity_report: { Args: never; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
<claude-code-hint v="1" type="plugin" value="supabase@claude-plugins-official" />
