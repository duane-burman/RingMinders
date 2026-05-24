// User detail — view and edit a user account, manage PIN and status
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { userUpdateSchema } from '@/lib/validations'
import type { UserUpdateFormData } from '@/lib/validations'
import {
  useUser,
  useUpdateUser,
  useUpdateUserStatus,
  useUnlockUser,
  useResetPin,
} from '@/hooks/useUsers'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDateTime } from '@/lib/utils'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

// Strip E.164 prefix to get raw 10 digits for the form
function toRawDigits(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10)
}

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: user, isLoading, error } = useUser(id!)
  const updateUser = useUpdateUser()
  const updateStatus = useUpdateUserStatus()
  const unlockUser = useUnlockUser()
  const resetPin = useResetPin()

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [newPin, setNewPin] = useState<string | null>(null)
  const [pinModalOpen, setPinModalOpen] = useState(false)
  const initialPopulated = useRef(false)

  const form = useForm<UserUpdateFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(userUpdateSchema) as any,
    mode: 'onSubmit',
  })

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = form

  // Populate form on first load only — do not re-populate on background refetches
  // so unsaved changes (including timezone) aren't wiped
  useEffect(() => {
    if (user && !initialPopulated.current) {
      initialPopulated.current = true
      reset({
        name: user.name,
        primary_phone: toRawDigits(user.primary_phone),
        secondary_phone: user.secondary_phone ? toRawDigits(user.secondary_phone) : '',
        timezone: user.timezone,
        retry_max_attempts: user.retry_max_attempts,
        retry_interval_minutes: user.retry_interval_minutes,
        notes: user.notes ?? '',
      })
    }
  }, [user, reset])

  const onSubmit = async (data: UserUpdateFormData) => {
    setSubmitError(null)
    try {
      const phone = (p: string) => `+1${p}`
      await updateUser.mutateAsync({
        id: id!,
        name: data.name,
        primary_phone: phone(data.primary_phone),
        secondary_phone: data.secondary_phone ? phone(data.secondary_phone) : null,
        timezone: data.timezone,
        retry_max_attempts: data.retry_max_attempts,
        retry_interval_minutes: data.retry_interval_minutes,
        notes: data.notes || null,
      })
      reset(data)
      toast.success('User updated successfully')
    } catch (err) {
      setSubmitError((err as Error).message)
      toast.error(`Failed to save changes: ${(err as Error).message}`)
    }
  }

  const handleStatusChange = async (status: string) => {
    try {
      await updateStatus.mutateAsync({ id: id!, status })
      toast.success(`Account ${status}`)
    } catch (err) {
      toast.error(`Failed to update status: ${(err as Error).message}`)
    }
  }

  const handleUnlock = async () => {
    try {
      await unlockUser.mutateAsync(id!)
      toast.success('Account unlocked')
    } catch (err) {
      toast.error(`Failed to unlock account: ${(err as Error).message}`)
    }
  }

  const handleResetPin = async () => {
    try {
      const result = await resetPin.mutateAsync(id!)
      setNewPin(result.pin)
      setPinModalOpen(true)
    } catch (err) {
      toast.error(`Failed to reset PIN: ${(err as Error).message}`)
    }
  }

  const isLocked = user?.locked_until
    ? new Date(user.locked_until) > new Date()
    : false

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-text-muted text-sm">Loading...</p>
      </div>
    )
  }

  if (error || !user) {
    return (
      <Alert variant="destructive" className="max-w-lg">
        <AlertDescription>{(error as Error)?.message ?? 'User not found.'}</AlertDescription>
      </Alert>
    )
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
        <h1 className="text-2xl font-semibold text-text">{user.name}</h1>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left column — edit form */}
        <div className="col-span-2">
          <div className="bg-surface border border-border rounded-lg p-6">
            <h2 className="font-medium text-text mb-5">Account Details</h2>

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              {submitError && (
                <Alert variant="destructive" className="mb-5">
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

                {/* Timezone */}
                <div className="space-y-1">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Controller
                    name="timezone"
                    control={form.control}
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
                          <SelectItem value="America/New_York">America/New_York</SelectItem>
                          <SelectItem value="America/Chicago">America/Chicago</SelectItem>
                          <SelectItem value="America/Denver">America/Denver</SelectItem>
                          <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                          <SelectItem value="America/Phoenix">America/Phoenix</SelectItem>
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

              <div className="flex items-center gap-3 mt-8">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => reset()}
                >
                  Discard
                </Button>
                <Button
                  type="submit"
                  className="bg-primary text-primary-foreground"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Card 1: Account Status */}
          <div className="bg-surface border border-border rounded-lg p-5">
            <h2 className="font-medium text-text mb-3">Account Status</h2>
            <div className="mb-4">
              <StatusBadge status={user.status as 'active' | 'suspended' | 'disabled'} />
            </div>
            <div className="space-y-2">
              <Button
                className="w-full bg-success text-white hover:bg-success/90"
                disabled={user.status === 'active' || updateStatus.isPending}
                onClick={() => handleStatusChange('active')}
              >
                Activate
              </Button>
              <Button
                className="w-full bg-warning text-white hover:bg-warning/90"
                disabled={user.status === 'suspended' || updateStatus.isPending}
                onClick={() => handleStatusChange('suspended')}
              >
                Suspend
              </Button>
              <Button
                className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={user.status === 'disabled' || updateStatus.isPending}
                onClick={() => handleStatusChange('disabled')}
              >
                Disable
              </Button>
            </div>
          </div>

          {/* Card 2: PIN Management */}
          <div className="bg-surface border border-border rounded-lg p-5">
            <h2 className="font-medium text-text mb-2">PIN Management</h2>
            <p className="text-text-muted text-sm mb-4">
              Reset the user's PIN. The new PIN will be shown once — record it before closing.
            </p>
            <Button
              variant="outline"
              className="w-full"
              disabled={resetPin.isPending}
              onClick={handleResetPin}
            >
              {resetPin.isPending ? 'Resetting…' : 'Reset PIN'}
            </Button>
          </div>

          {/* Card 3: Account Security */}
          <div className="bg-surface border border-border rounded-lg p-5">
            <h2 className="font-medium text-text mb-3">Account Security</h2>
            <div className="space-y-2 text-sm mb-4">
              <p className="text-text-muted">
                Failed PIN attempts: <span className="text-text font-medium">{user.pin_attempts}</span>
              </p>
              {isLocked ? (
                <p className="text-destructive">
                  Locked until {formatDateTime(user.locked_until!, user.timezone)}
                </p>
              ) : (
                <p className="text-success text-sm">Account is not locked</p>
              )}
            </div>
            <Button
              variant="outline"
              className="w-full"
              disabled={!isLocked || unlockUser.isPending}
              onClick={handleUnlock}
            >
              Unlock Account
            </Button>
          </div>
        </div>
      </div>

      {/* PIN Reset Modal */}
      <Dialog open={pinModalOpen} onOpenChange={setPinModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New PIN</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between bg-background border border-border rounded-lg px-6 py-4">
              <span className="font-mono text-2xl tracking-widest text-text">{newPin}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigator.clipboard.writeText(newPin ?? '')}
              >
                <i className="ti ti-copy text-base" />
              </Button>
            </div>
            <p className="text-destructive text-sm">
              This PIN will not be shown again.
            </p>
            <Button
              className="w-full bg-primary text-primary-foreground"
              onClick={() => setPinModalOpen(false)}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
