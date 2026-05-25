// New user — form to create a new user account
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { userSchema } from '@/lib/validations'
import type { UserFormData } from '@/lib/validations'
import { useCreateUser } from '@/hooks/useUsers'
import { useSettings } from '@/hooks/useSettings'
import { supabase } from '@/lib/supabase'
import { formatPhoneInput, TIMEZONES } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function generatePin(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0')
}


export function UserNewPage() {
  const navigate = useNavigate()
  const createUser = useCreateUser()
  const { data: settings } = useSettings()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [generatedPin, setGeneratedPin] = useState<string | null>(null)

  const form = useForm<UserFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(userSchema) as any,
    mode: 'onSubmit',
    defaultValues: {
      name: '',
      primary_phone: '',
      secondary_phone: '',
      pin: '',
      timezone: settings?.default_timezone ?? 'America/New_York',
      retry_max_attempts: settings?.default_retry_max_attempts ?? 3,
      retry_interval_minutes: settings?.default_retry_interval_minutes ?? 15,
      notes: '',
    },
  })

  const { register, handleSubmit, setValue, control, reset, formState: { errors, isSubmitting } } = form

  useEffect(() => {
    if (settings) {
      reset({
        name: '',
        primary_phone: '',
        secondary_phone: '',
        pin: '',
        timezone: settings.default_timezone,
        retry_max_attempts: settings.default_retry_max_attempts,
        retry_interval_minutes: settings.default_retry_interval_minutes,
        notes: '',
      })
    }
  }, [settings, reset])

  const handleGeneratePin = () => {
    const pin = generatePin()
    setValue('pin', pin, { shouldValidate: true })
    setGeneratedPin(pin)
  }

  const onSubmit = async (data: UserFormData) => {
    setSubmitError(null)
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('admin-reset-pin', {
        body: { pin: data.pin },
      })
      if (fnError) throw new Error(fnError.message)
      if (fnData?.error) throw new Error(fnData.error)

      await createUser.mutateAsync({ ...data, pin_hash: fnData.pin_hash })
      navigate('/users')
    } catch (err) {
      setSubmitError((err as Error).message)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/users')}
          className="text-text-muted hover:text-text transition-colors"
        >
          <i className="ti ti-arrow-left text-xl" />
        </button>
        <h1 className="text-2xl font-semibold text-text">New User</h1>
      </div>

      {/* Form card */}
      <div className="bg-surface border border-border rounded-lg p-6 max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {submitError && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-5">
            {/* Name */}
            <div className="space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register('name')} />
              {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
            </div>

            {/* Primary Phone */}
            <div className="space-y-1">
              <Label htmlFor="primary_phone">Primary Phone</Label>
              <Controller
                name="primary_phone"
                control={control}
                render={({ field }) => (
                  <Input
                    id="primary_phone"
                    placeholder="(XXX) XXX-XXXX"
                    value={formatPhoneInput(field.value || '')}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                      field.onChange(digits)
                    }}
                    onBlur={field.onBlur}
                  />
                )}
              />
              {errors.primary_phone && (
                <p className="text-destructive text-sm">{errors.primary_phone.message}</p>
              )}
            </div>

            {/* Secondary Phone */}
            <div className="space-y-1">
              <Label htmlFor="secondary_phone">
                Secondary Phone <span className="text-text-muted font-normal">(optional)</span>
              </Label>
              <Controller
                name="secondary_phone"
                control={control}
                render={({ field }) => (
                  <Input
                    id="secondary_phone"
                    placeholder="(XXX) XXX-XXXX"
                    value={formatPhoneInput(field.value || '')}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                      field.onChange(digits)
                    }}
                    onBlur={field.onBlur}
                  />
                )}
              />
              {errors.secondary_phone && (
                <p className="text-destructive text-sm">{errors.secondary_phone.message}</p>
              )}
            </div>

            {/* PIN */}
            <div className="space-y-1">
              <Label htmlFor="pin">PIN</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="pin"
                  placeholder="4-digit PIN"
                  maxLength={4}
                  className="w-36"
                  {...register('pin')}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleGeneratePin}
                >
                  Generate PIN
                </Button>
              </div>
              {errors.pin && <p className="text-destructive text-sm">{errors.pin.message}</p>}
              {generatedPin && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded p-2 text-sm mt-2">
                  Make note of this PIN — it will not be shown again after saving.
                </div>
              )}
            </div>

            {/* Timezone */}
            <div className="space-y-1">
              <Label htmlFor="timezone">Timezone</Label>
              <Controller
                name="timezone"
                control={control}
                render={({ field }) => (
                  <Select
                    key={field.value}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.timezone && (
                <p className="text-destructive text-sm">{errors.timezone.message}</p>
              )}
            </div>

            {/* Max Retry Attempts */}
            <div className="space-y-1">
              <Label htmlFor="retry_max_attempts">Max Retry Attempts</Label>
              <Input
                id="retry_max_attempts"
                type="number"
                min={1}
                max={10}
                className="w-24"
                {...register('retry_max_attempts')}
              />
              {errors.retry_max_attempts && (
                <p className="text-destructive text-sm">{errors.retry_max_attempts.message}</p>
              )}
            </div>

            {/* Retry Interval */}
            <div className="space-y-1">
              <Label htmlFor="retry_interval_minutes">Retry Interval (minutes)</Label>
              <Input
                id="retry_interval_minutes"
                type="number"
                min={5}
                max={60}
                className="w-24"
                {...register('retry_interval_minutes')}
              />
              {errors.retry_interval_minutes && (
                <p className="text-destructive text-sm">{errors.retry_interval_minutes.message}</p>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label htmlFor="notes">
                Notes <span className="text-text-muted font-normal">(optional)</span>
              </Label>
              <textarea
                id="notes"
                rows={3}
                placeholder="Shared phone shanty, best reached mornings..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                {...register('notes')}
              />
              {errors.notes && <p className="text-destructive text-sm">{errors.notes.message}</p>}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-8">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/users')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-primary text-primary-foreground"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating…' : 'Create User'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
