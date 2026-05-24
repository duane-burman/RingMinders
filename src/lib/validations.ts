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
