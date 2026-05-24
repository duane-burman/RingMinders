// Zod validation schemas — populated as forms are built
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginFormData = z.infer<typeof loginSchema>

export const userSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  primary_phone: z
    .string()
    .min(1, 'Primary phone is required')
    .regex(/^\d{10}$/, 'Enter a 10-digit phone number without spaces or dashes'),
  secondary_phone: z
    .string()
    .regex(/^\d{10}$/, 'Enter a 10-digit phone number without spaces or dashes')
    .optional()
    .or(z.literal('')),
  pin: z
    .string()
    .regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
  timezone: z.string().min(1, 'Timezone is required'),
  retry_max_attempts: z.coerce.number().int().min(1).max(10),
  retry_interval_minutes: z.coerce.number().int().min(5).max(60),
  notes: z.string().optional(),
})

export type UserFormData = z.infer<typeof userSchema>

export const userUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  primary_phone: z
    .string()
    .min(1, 'Primary phone is required')
    .regex(/^\d{10}$/, 'Enter a valid 10-digit phone number'),
  secondary_phone: z
    .string()
    .regex(/^\d{10}$/, 'Enter a valid 10-digit phone number')
    .optional()
    .or(z.literal('')),
  timezone: z.string().min(1, 'Timezone is required'),
  retry_max_attempts: z.coerce.number().int().min(1).max(10),
  retry_interval_minutes: z.coerce.number().int().min(5).max(60),
  notes: z.string().optional(),
})

export type UserUpdateFormData = z.infer<typeof userUpdateSchema>

export const reminderSchema = z.object({
  user_id: z.string().min(1, 'Please select a user'),
  scheduled_date: z.string().min(1, 'Date is required'),
  scheduled_time: z.string().min(1, 'Time is required'),
  callback_type: z.enum(['primary', 'secondary', 'custom']),
  custom_callback: z
    .string()
    .regex(/^\d{10}$/, 'Enter a valid 10-digit phone number')
    .optional()
    .or(z.literal('')),
  is_repeating: z.boolean(),
  repeat_type: z.enum(['daily', 'weekly', 'monthly_date', 'monthly_day']).optional(),
  repeat_interval_days: z.coerce.number().int().min(1).max(365).optional(),
  repeat_days_of_week: z.array(z.number().int().min(0).max(6)).optional(),
  repeat_day_of_month: z.coerce.number().int().min(1).max(28).optional(),
  repeat_week_of_month: z.coerce.number().int().min(1).max(4).optional(),
  repeat_day_of_week: z.coerce.number().int().min(0).max(6).optional(),
  repeat_end_date: z.string().optional(),
})
.refine(
  (data) => data.callback_type !== 'custom' || (data.custom_callback && data.custom_callback.length === 10),
  { message: 'Enter a valid 10-digit phone number', path: ['custom_callback'] }
)
.refine(
  (data) => !data.is_repeating || !!data.repeat_type,
  { message: 'Please select a repeat type', path: ['repeat_type'] }
)
.refine(
  (data) => data.repeat_type !== 'daily' || (data.repeat_interval_days && data.repeat_interval_days > 0),
  { message: 'Enter the number of days between reminders', path: ['repeat_interval_days'] }
)
.refine(
  (data) => data.repeat_type !== 'weekly' || (data.repeat_days_of_week && data.repeat_days_of_week.length > 0),
  { message: 'Select at least one day of the week', path: ['repeat_days_of_week'] }
)
.refine(
  (data) => data.repeat_type !== 'monthly_date' || (data.repeat_day_of_month && data.repeat_day_of_month >= 1),
  { message: 'Select a day of the month', path: ['repeat_day_of_month'] }
)
.refine(
  (data) => data.repeat_type !== 'monthly_day' || (data.repeat_week_of_month && data.repeat_day_of_week !== undefined),
  { message: 'Select a week and day', path: ['repeat_week_of_month'] }
)
.refine(
  (data) => {
    if (!data.is_repeating || !data.repeat_end_date || !data.scheduled_date) return true
    return new Date(data.repeat_end_date) > new Date(data.scheduled_date)
  },
  { message: 'End date must be after the scheduled date', path: ['repeat_end_date'] }
)
.refine(
  (data) => {
    if (!data.scheduled_date || !data.scheduled_time) return true
    const scheduled = new Date(`${data.scheduled_date}T${data.scheduled_time}`)
    return scheduled > new Date()
  },
  { message: 'Scheduled date and time must be in the future', path: ['scheduled_time'] }
)

export type ReminderFormData = z.infer<typeof reminderSchema>

export const reminderUpdateSchema = z.object({
  scheduled_date: z.string().min(1, 'Date is required'),
  scheduled_time: z.string().min(1, 'Time is required'),
  callback_type: z.enum(['primary', 'secondary', 'custom']),
  custom_callback: z
    .string()
    .regex(/^\d{10}$/, 'Enter a valid 10-digit phone number')
    .optional()
    .or(z.literal('')),
  is_repeating: z.boolean(),
  repeat_type: z.enum(['daily', 'weekly', 'monthly_date', 'monthly_day']).optional(),
  repeat_interval_days: z.coerce.number().int().min(1).max(365).optional(),
  repeat_days_of_week: z.array(z.number().int().min(0).max(6)).optional(),
  repeat_day_of_month: z.coerce.number().int().min(1).max(28).optional(),
  repeat_week_of_month: z.coerce.number().int().min(1).max(4).optional(),
  repeat_day_of_week: z.coerce.number().int().min(0).max(6).optional(),
  repeat_end_date: z.string().optional(),
})
.refine(
  (data) => data.callback_type !== 'custom' || (data.custom_callback && data.custom_callback.length === 10),
  { message: 'Enter a valid 10-digit phone number', path: ['custom_callback'] }
)
.refine(
  (data) => !data.is_repeating || !!data.repeat_type,
  { message: 'Please select a repeat type', path: ['repeat_type'] }
)
.refine(
  (data) => data.repeat_type !== 'daily' || (data.repeat_interval_days && data.repeat_interval_days > 0),
  { message: 'Enter the number of days between reminders', path: ['repeat_interval_days'] }
)
.refine(
  (data) => data.repeat_type !== 'weekly' || (data.repeat_days_of_week && data.repeat_days_of_week.length > 0),
  { message: 'Select at least one day of the week', path: ['repeat_days_of_week'] }
)
.refine(
  (data) => data.repeat_type !== 'monthly_date' || (data.repeat_day_of_month && data.repeat_day_of_month >= 1),
  { message: 'Select a day of the month', path: ['repeat_day_of_month'] }
)
.refine(
  (data) => data.repeat_type !== 'monthly_day' || (data.repeat_week_of_month && data.repeat_day_of_week !== undefined),
  { message: 'Select a week and day', path: ['repeat_week_of_month'] }
)
.refine(
  (data) => {
    if (!data.is_repeating || !data.repeat_end_date || !data.scheduled_date) return true
    return new Date(data.repeat_end_date) > new Date(data.scheduled_date)
  },
  { message: 'End date must be after the scheduled date', path: ['repeat_end_date'] }
)
.refine(
  (data) => {
    if (!data.scheduled_date || !data.scheduled_time) return true
    const scheduled = new Date(`${data.scheduled_date}T${data.scheduled_time}`)
    return scheduled > new Date()
  },
  { message: 'Scheduled date and time must be in the future', path: ['scheduled_time'] }
)

export type ReminderUpdateFormData = z.infer<typeof reminderUpdateSchema>

export const settingsSchema = z.object({
  default_timezone: z.string().min(1, 'Timezone is required'),
  default_retry_max_attempts: z.coerce.number().int().min(1).max(10),
  default_retry_interval_minutes: z.coerce.number().int().min(5).max(60),
  max_recording_length_seconds: z.coerce.number().int().min(30).max(300),
  account_lockout_threshold: z.coerce.number().int().min(3).max(10),
  account_lockout_duration_minutes: z.coerce.number().int().min(5).max(1440),
  scheduler_concurrency_limit: z.coerce.number().int().min(1).max(50),
})

export type SettingsFormData = z.infer<typeof settingsSchema>
