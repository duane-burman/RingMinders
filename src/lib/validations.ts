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
  repeat_interval_days: z.coerce.number().int().min(1).max(365).optional(),
  repeat_end_date: z.string().optional(),
  notes: z.string().optional(),
})
.refine(
  (data) => data.callback_type !== 'custom' || (data.custom_callback && data.custom_callback.length === 10),
  { message: 'Enter a valid 10-digit phone number', path: ['custom_callback'] }
)
.refine(
  (data) => !data.is_repeating || (data.repeat_interval_days && data.repeat_interval_days > 0),
  { message: 'Repeat interval is required when repeating is enabled', path: ['repeat_interval_days'] }
)

export type ReminderFormData = z.infer<typeof reminderSchema>
