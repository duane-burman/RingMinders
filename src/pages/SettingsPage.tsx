// Settings — system-wide configuration defaults
import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { settingsSchema } from '@/lib/validations'
import type { SettingsFormData } from '@/lib/validations'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
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

export function SettingsPage() {
  const { data: settings, isLoading, error } = useSettings()
  const updateSettings = useUpdateSettings()

  const form = useForm<SettingsFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(settingsSchema) as any,
    mode: 'onSubmit',
  })

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = form

  useEffect(() => {
    if (settings) {
      reset({
        default_timezone: settings.default_timezone,
        default_retry_max_attempts: settings.default_retry_max_attempts,
        default_retry_interval_minutes: settings.default_retry_interval_minutes,
        max_recording_length_seconds: settings.max_recording_length_seconds,
        account_lockout_threshold: settings.account_lockout_threshold,
        account_lockout_duration_minutes: settings.account_lockout_duration_minutes,
        scheduler_concurrency_limit: settings.scheduler_concurrency_limit,
      })
    }
  }, [settings, reset])

  const onSubmit = async (data: SettingsFormData) => {
    try {
      await updateSettings.mutateAsync(data)
      toast.success('Settings saved.')
    } catch (err) {
      toast.error(`Failed to save settings: ${(err as Error).message}`)
    }
  }

  if (isLoading) {
    return (
      <div className="text-text-muted text-sm py-12 text-center">Loading settings...</div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-lg">
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text">Settings</h1>
        <p className="text-text-muted text-sm">System-wide configuration defaults.</p>
      </div>

      <div className="bg-surface border border-border rounded-lg p-6 max-w-2xl">
        <h2 className="font-medium text-text mb-4">System Defaults</h2>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-5">
            {/* Default Timezone */}
            <div className="space-y-1">
              <Label htmlFor="default_timezone">Default Timezone</Label>
              <Controller
                name="default_timezone"
                control={control}
                render={({ field }) => (
                  <Select
                    key={field.value}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger id="default_timezone">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/New_York">America/New_York</SelectItem>
                      <SelectItem value="America/Chicago">America/Chicago</SelectItem>
                      <SelectItem value="America/Denver">America/Denver</SelectItem>
                      <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                      <SelectItem value="America/Phoenix">America/Phoenix</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.default_timezone && (
                <p className="text-destructive text-sm">{errors.default_timezone.message}</p>
              )}
              <p className="text-text-muted text-xs">Applied to new user accounts on creation.</p>
            </div>

            {/* Default Retry Attempts */}
            <div className="space-y-1">
              <Label htmlFor="default_retry_max_attempts">Default Retry Attempts</Label>
              <Input
                id="default_retry_max_attempts"
                type="number"
                min={1}
                max={10}
                className="w-24"
                {...register('default_retry_max_attempts')}
              />
              {errors.default_retry_max_attempts && (
                <p className="text-destructive text-sm">{errors.default_retry_max_attempts.message}</p>
              )}
              <p className="text-text-muted text-xs">How many times to retry a failed reminder call.</p>
            </div>

            {/* Default Retry Interval */}
            <div className="space-y-1">
              <Label htmlFor="default_retry_interval_minutes">Default Retry Interval (minutes)</Label>
              <Input
                id="default_retry_interval_minutes"
                type="number"
                min={5}
                max={60}
                className="w-24"
                {...register('default_retry_interval_minutes')}
              />
              {errors.default_retry_interval_minutes && (
                <p className="text-destructive text-sm">{errors.default_retry_interval_minutes.message}</p>
              )}
              <p className="text-text-muted text-xs">Minutes between retry attempts.</p>
            </div>

            {/* Max Recording Length */}
            <div className="space-y-1">
              <Label htmlFor="max_recording_length_seconds">Max Recording Length (seconds)</Label>
              <Input
                id="max_recording_length_seconds"
                type="number"
                min={30}
                max={300}
                className="w-24"
                {...register('max_recording_length_seconds')}
              />
              {errors.max_recording_length_seconds && (
                <p className="text-destructive text-sm">{errors.max_recording_length_seconds.message}</p>
              )}
              <p className="text-text-muted text-xs">Maximum voice message duration. Current value applies to new recordings only.</p>
            </div>

            {/* Account Lockout Threshold */}
            <div className="space-y-1">
              <Label htmlFor="account_lockout_threshold">Account Lockout Threshold</Label>
              <Input
                id="account_lockout_threshold"
                type="number"
                min={3}
                max={10}
                className="w-24"
                {...register('account_lockout_threshold')}
              />
              {errors.account_lockout_threshold && (
                <p className="text-destructive text-sm">{errors.account_lockout_threshold.message}</p>
              )}
              <p className="text-text-muted text-xs">Failed PIN attempts before an account is temporarily locked.</p>
            </div>

            {/* Lockout Duration */}
            <div className="space-y-1">
              <Label htmlFor="account_lockout_duration_minutes">Lockout Duration (minutes)</Label>
              <Input
                id="account_lockout_duration_minutes"
                type="number"
                min={5}
                max={1440}
                className="w-24"
                {...register('account_lockout_duration_minutes')}
              />
              {errors.account_lockout_duration_minutes && (
                <p className="text-destructive text-sm">{errors.account_lockout_duration_minutes.message}</p>
              )}
              <p className="text-text-muted text-xs">How long an account stays locked. 1440 = 24 hours.</p>
            </div>

            {/* Scheduler Concurrency Limit */}
            <div className="space-y-1">
              <Label htmlFor="scheduler_concurrency_limit">Scheduler Concurrency Limit</Label>
              <Input
                id="scheduler_concurrency_limit"
                type="number"
                min={1}
                max={50}
                className="w-24"
                {...register('scheduler_concurrency_limit')}
              />
              {errors.scheduler_concurrency_limit && (
                <p className="text-destructive text-sm">{errors.scheduler_concurrency_limit.message}</p>
              )}
              <p className="text-text-muted text-xs">Maximum simultaneous outbound calls per scheduler run. Recommended: 10. Do not exceed your Twilio account's concurrent call limit.</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-8">
            <Button
              type="button"
              variant="ghost"
              onClick={() => reset(settings ? {
                default_timezone: settings.default_timezone,
                default_retry_max_attempts: settings.default_retry_max_attempts,
                default_retry_interval_minutes: settings.default_retry_interval_minutes,
                max_recording_length_seconds: settings.max_recording_length_seconds,
                account_lockout_threshold: settings.account_lockout_threshold,
                account_lockout_duration_minutes: settings.account_lockout_duration_minutes,
                scheduler_concurrency_limit: settings.scheduler_concurrency_limit,
              } : undefined)}
            >
              Discard
            </Button>
            <Button
              type="submit"
              className="bg-primary text-primary-foreground"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving…' : 'Save Settings'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
