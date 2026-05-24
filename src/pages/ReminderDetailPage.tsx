// Reminder detail — view and edit a single reminder
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { reminderUpdateSchema } from '@/lib/validations'
import type { ReminderUpdateFormData } from '@/lib/validations'
import { useReminder, useUpdateReminder, useCancelReminder } from '@/hooks/useReminders'
import { supabase } from '@/lib/supabase'
import { formatPhone, formatDateTime, cn } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// Shared input className to match shadcn Input
const inputClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

// Convert raw 10-digit input to E.164. Never apply to values already from the database.
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('1') && digits.length === 11) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  return phone // already E.164 or unrecognized — return as-is
}

// Convert UTC ISO string to local date and time strings in a given timezone
function utcToLocal(isoStr: string, timezone: string): { date: string; time: string } {
  const date = new Date(isoStr)
  const datePart = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date) // "YYYY-MM-DD"

  const timePart = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date) // "HH:MM"

  return { date: datePart, time: timePart }
}

// Convert local date+time in a given timezone to a UTC ISO string
function toUtcIso(dateStr: string, timeStr: string, timezone: string): string {
  const naiveUtc = new Date(`${dateStr}T${timeStr}:00Z`)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const formatted = formatter.format(naiveUtc)
  const [localDate, localTime] = formatted.split(', ')
  const displayedMs = new Date(`${localDate}T${localTime}:00Z`).getTime()
  const correction = naiveUtc.getTime() - displayedMs
  return new Date(naiveUtc.getTime() + correction).toISOString()
}

function ordinal(n: number): string {
  if (n >= 11 && n <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

// Determine callback_type by comparing E.164 values directly (all three are already E.164 from DB)
function inferCallbackType(
  callbackNumber: string,
  primaryPhone: string,
  secondaryPhone: string | null
): 'primary' | 'secondary' | 'custom' {
  if (callbackNumber === primaryPhone) return 'primary'
  if (secondaryPhone && callbackNumber === secondaryPhone) return 'secondary'
  return 'custom'
}

export function ReminderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: reminder, isLoading, error } = useReminder(id!)
  const updateReminder = useUpdateReminder()
  const cancelReminder = useCancelReminder()

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Audio state
  const [audioBase64, setAudioBase64] = useState<string | null>(null)
  const [audioMimeType, setAudioMimeType] = useState<string>('audio/webm')
  const [audioFileName, setAudioFileName] = useState<string>('recording.webm')
  const [audioDisplayName, setAudioDisplayName] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  const initialPopulated = useRef(false)

  const isPending = reminder?.status === 'pending'

  // Resolve user phones from joined data
  const userRecord = reminder?.users as { name: string; timezone: string; primary_phone: string; secondary_phone: string | null } | null

  const form = useForm<ReminderUpdateFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(reminderUpdateSchema) as any,
    defaultValues: {
      callback_type: 'primary',
      is_repeating: false,
      custom_callback: '',
      repeat_days_of_week: [],
    },
  })

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = form

  const watchedCallbackType = watch('callback_type')
  const watchedIsRepeating = watch('is_repeating')
  const watchedRepeatType = watch('repeat_type')
  const watchedDaysOfWeek = watch('repeat_days_of_week') ?? []
  const watchedScheduledDate = watch('scheduled_date')

  // Populate form from fetched reminder (once only)
  useEffect(() => {
    if (!reminder || !userRecord || initialPopulated.current) return
    initialPopulated.current = true

    const { date, time } = utcToLocal(reminder.scheduled_at, userRecord.timezone)
    const callbackType = inferCallbackType(
      reminder.callback_number,
      userRecord.primary_phone,
      userRecord.secondary_phone
    )
    const customCallback =
      callbackType === 'custom'
        ? reminder.callback_number.replace(/^\+1/, '')
        : ''

    reset({
      scheduled_date: date,
      scheduled_time: time,
      callback_type: callbackType,
      custom_callback: customCallback,
      is_repeating: reminder.is_repeating,
      repeat_type: (reminder.repeat_type as ReminderUpdateFormData['repeat_type']) ?? undefined,
      repeat_interval_days: reminder.repeat_interval_days ?? undefined,
      repeat_days_of_week: (reminder.repeat_days_of_week as number[]) ?? [],
      repeat_day_of_month: reminder.repeat_day_of_month ?? undefined,
      repeat_week_of_month: reminder.repeat_week_of_month ?? undefined,
      repeat_day_of_week: reminder.repeat_day_of_week ?? undefined,
      repeat_end_date: reminder.repeat_end_date ?? '',
    })
  }, [reminder, userRecord, reset])

  // Blob URL for audio playback
  useEffect(() => {
    if (!audioBase64 || !audioMimeType) {
      setAudioUrl(null)
      return
    }
    const bytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0))
    const blob = new Blob([bytes], { type: audioMimeType })
    const url = URL.createObjectURL(blob)
    setAudioUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [audioBase64, audioMimeType])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      setAudioBase64(base64)
      setAudioMimeType(file.type || 'audio/webm')
      setAudioFileName(file.name)
      setAudioDisplayName(file.name)
    }
    reader.readAsDataURL(file)
  }

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks: BlobPart[] = []

      recorder.ondataavailable = (e) => chunks.push(e.data)
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1]
          setAudioBase64(base64)
          setAudioMimeType('audio/webm')
          setAudioFileName('recording.webm')
          setAudioDisplayName('recording.webm')
        }
        reader.readAsDataURL(blob)
        stream.getTracks().forEach((t) => t.stop())
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
      setAudioBase64(null)
      setAudioDisplayName(null)
    } catch {
      setSubmitError('Microphone access denied')
    }
  }

  const handleStopRecording = () => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    setIsRecording(false)
  }

  const onSubmit = async (data: ReminderUpdateFormData) => {
    if (!reminder || !userRecord) return
    setSubmitError(null)
    setSaveSuccess(false)

    try {
      // Resolve callback number — DB values are already E.164; only custom input needs conversion
      let callbackNumber: string
      if (data.callback_type === 'primary') {
        callbackNumber = userRecord.primary_phone
      } else if (data.callback_type === 'secondary') {
        callbackNumber = userRecord.secondary_phone!
      } else {
        callbackNumber = toE164(data.custom_callback!)
      }

      // Convert local date+time to UTC
      const scheduledAt = toUtcIso(data.scheduled_date, data.scheduled_time, userRecord.timezone)

      // If a new recording was provided, upload it first
      let recordingUrl = reminder.recording_url
      if (audioBase64) {
        const { data: fnData, error: fnError } = await supabase.functions.invoke(
          'admin-upload-audio',
          { body: { audio_base64: audioBase64, mime_type: audioMimeType, file_name: audioFileName } }
        )
        if (fnError) throw new Error(fnError.message)
        if (fnData?.error) throw new Error(fnData.error)
        recordingUrl = fnData.url
      }

      await updateReminder.mutateAsync({
        id: reminder.id,
        scheduled_at: scheduledAt,
        callback_number: callbackNumber,
        recording_url: recordingUrl,
        is_repeating: data.is_repeating,
        repeat_type: data.is_repeating ? data.repeat_type ?? null : null,
        repeat_interval_days: data.repeat_type === 'daily' ? (data.repeat_interval_days ?? null) : null,
        repeat_days_of_week: data.repeat_type === 'weekly' ? (data.repeat_days_of_week ?? null) : null,
        repeat_day_of_month: data.repeat_type === 'monthly_date' ? (data.repeat_day_of_month ?? null) : null,
        repeat_week_of_month: data.repeat_type === 'monthly_day' ? (data.repeat_week_of_month ?? null) : null,
        repeat_day_of_week: data.repeat_type === 'monthly_day' ? (data.repeat_day_of_week ?? null) : null,
        repeat_end_date: data.repeat_end_date || null,
      })

      setSaveSuccess(true)
      // Reset dirty state — re-derive values from saved data
      initialPopulated.current = false
      setAudioBase64(null)
      setAudioDisplayName(null)
    } catch (err) {
      setSubmitError((err as Error).message)
    }
  }

  const handleConfirmCancel = async () => {
    if (!reminder) return
    await cancelReminder.mutateAsync(reminder.id)
    setShowCancelDialog(false)
    navigate('/reminders')
  }

  if (isLoading) {
    return (
      <div className="text-text-muted text-sm py-12 text-center">Loading reminder…</div>
    )
  }

  if (error || !reminder) {
    return (
      <Alert variant="destructive" className="max-w-lg">
        <AlertDescription>{error ? (error as Error).message : 'Reminder not found.'}</AlertDescription>
      </Alert>
    )
  }

  const timezone = userRecord?.timezone ?? 'America/New_York'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/reminders')}
          className="text-text-muted hover:text-text transition-colors"
        >
          <i className="ti ti-arrow-left text-xl" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-text">Reminder Detail</h1>
          <p className="text-text-muted text-sm">{userRecord?.name ?? 'Unknown user'}</p>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* Left column — main edit form */}
        <div className="flex-1 min-w-0">
          <div className="bg-surface border border-border rounded-lg p-6">

            {/* Read-only banner for non-pending reminders */}
            {!isPending && (
              <Alert className="mb-6">
                <AlertDescription>
                  This reminder has already been processed and cannot be edited.
                </AlertDescription>
              </Alert>
            )}

            {submitError && (
              <Alert variant="destructive" className="mb-6">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            {saveSuccess && (
              <Alert className="mb-6">
                <AlertDescription>Reminder saved successfully.</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="space-y-5">
                {/* Scheduled Date */}
                <div className="space-y-1">
                  <Label htmlFor="scheduled_date">Scheduled Date</Label>
                  <input
                    id="scheduled_date"
                    type="date"
                    disabled={!isPending}
                    className={inputClass}
                    {...register('scheduled_date')}
                  />
                  {errors.scheduled_date && (
                    <p className="text-destructive text-sm">{errors.scheduled_date.message}</p>
                  )}
                </div>

                {/* Scheduled Time */}
                <div className="space-y-1">
                  <Label htmlFor="scheduled_time">Scheduled Time</Label>
                  <input
                    id="scheduled_time"
                    type="time"
                    disabled={!isPending}
                    className={inputClass}
                    {...register('scheduled_time')}
                  />
                  {errors.scheduled_time && (
                    <p className="text-destructive text-sm">{errors.scheduled_time.message}</p>
                  )}
                  <p className="text-text-muted text-xs">Time is interpreted in {timezone}</p>
                </div>

                {/* Callback Number */}
                <div className="space-y-2">
                  <Label>Callback Number</Label>
                  <div className="space-y-2">
                    <label className={cn('flex items-center gap-2', isPending ? 'cursor-pointer' : 'opacity-60')}>
                      <input
                        type="radio"
                        value="primary"
                        disabled={!isPending}
                        className="accent-primary"
                        {...register('callback_type')}
                      />
                      <span className="text-sm text-text">
                        Primary phone:{' '}
                        {userRecord ? formatPhone(userRecord.primary_phone) : '—'}
                      </span>
                    </label>

                    {userRecord?.secondary_phone && (
                      <label className={cn('flex items-center gap-2', isPending ? 'cursor-pointer' : 'opacity-60')}>
                        <input
                          type="radio"
                          value="secondary"
                          disabled={!isPending}
                          className="accent-primary"
                          {...register('callback_type')}
                        />
                        <span className="text-sm text-text">
                          Secondary phone: {formatPhone(userRecord.secondary_phone)}
                        </span>
                      </label>
                    )}

                    <label className={cn('flex items-center gap-2', isPending ? 'cursor-pointer' : 'opacity-60')}>
                      <input
                        type="radio"
                        value="custom"
                        disabled={!isPending}
                        className="accent-primary"
                        {...register('callback_type')}
                      />
                      <span className="text-sm text-text">Custom number</span>
                    </label>

                    {watchedCallbackType === 'custom' && (
                      <div className="pl-6">
                        <Controller
                          name="custom_callback"
                          control={control}
                          render={({ field }) => (
                            <Input
                              placeholder="(XXX) XXX-XXXX"
                              disabled={!isPending}
                              value={formatPhoneInput(field.value || '')}
                              onChange={(e) => {
                                const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                                field.onChange(digits)
                              }}
                              onBlur={field.onBlur}
                            />
                          )}
                        />
                        {errors.custom_callback && (
                          <p className="text-destructive text-sm mt-1">
                            {errors.custom_callback.message}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Voice Message */}
                <div className="space-y-2">
                  <Label>Voice Message</Label>

                  {/* Existing recording */}
                  {reminder.recording_url && !audioUrl && (
                    <div className="space-y-1">
                      <p className="text-text-muted text-xs">Current recording:</p>
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <audio controls src={reminder.recording_url} className="w-full h-10" />
                    </div>
                  )}

                  {/* New recording playback */}
                  {audioUrl && (
                    <div className="space-y-1">
                      <p className="text-text-muted text-xs">New recording (will replace current):</p>
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <audio controls src={audioUrl} className="w-full h-10" />
                    </div>
                  )}

                  {isPending && (
                    <Tabs defaultValue="upload">
                      <TabsList>
                        <TabsTrigger value="upload">Upload File</TabsTrigger>
                        <TabsTrigger value="record">Record</TabsTrigger>
                      </TabsList>

                      <TabsContent value="upload" className="pt-3">
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={handleFileUpload}
                          className="block w-full text-sm text-text-muted
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-md file:border-0
                            file:text-sm file:font-medium
                            file:bg-primary file:text-primary-foreground
                            hover:file:bg-primary/90 cursor-pointer"
                        />
                        {audioDisplayName && (
                          <p className="text-text-muted text-xs mt-2">
                            <i className="ti ti-music mr-1" />
                            {audioDisplayName}
                          </p>
                        )}
                      </TabsContent>

                      <TabsContent value="record" className="pt-3">
                        <div className="flex items-center gap-3">
                          {!isRecording ? (
                            <Button
                              type="button"
                              onClick={handleStartRecording}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              <i className="ti ti-microphone mr-2" />
                              {audioDisplayName === 'recording.webm' ? 'Re-record' : 'Start Recording'}
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleStopRecording}
                            >
                              <i className="ti ti-player-stop mr-2" />
                              Stop Recording
                            </Button>
                          )}
                          {isRecording && (
                            <span className="text-destructive text-sm font-medium animate-pulse">
                              Recording…
                            </span>
                          )}
                          {!isRecording && audioDisplayName === 'recording.webm' && (
                            <span className="text-text-muted text-sm">Recording captured</span>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>
                  )}
                </div>

                {/* Repeating */}
                <div className="space-y-3">
                  <Controller
                    name="is_repeating"
                    control={form.control}
                    render={({ field }) => (
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={field.value}
                          disabled={!isPending}
                          onCheckedChange={(checked) => {
                            field.onChange(checked)
                            if (!checked) {
                              form.setValue('repeat_type', undefined)
                              form.setValue('repeat_interval_days', undefined)
                              form.setValue('repeat_days_of_week', [])
                              form.setValue('repeat_day_of_month', undefined)
                              form.setValue('repeat_week_of_month', undefined)
                              form.setValue('repeat_day_of_week', undefined)
                              form.setValue('repeat_end_date', '')
                            }
                          }}
                        />
                        <Label>Repeating reminder</Label>
                      </div>
                    )}
                  />

                  {watchedIsRepeating && (
                    <div className="ml-2 pl-4 space-y-4 border-l-2 border-border">
                      {/* Repeat type */}
                      <div className="space-y-1">
                        <Label>Repeat type</Label>
                        <Controller
                          name="repeat_type"
                          control={control}
                          render={({ field }) => (
                            <Select
                              value={field.value ?? ''}
                              disabled={!isPending}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select repeat type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly_date">Monthly — specific date</SelectItem>
                                <SelectItem value="monthly_day">Monthly — day pattern</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(errors as any).repeat_type && (
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          <p className="text-destructive text-sm">{(errors as any).repeat_type.message}</p>
                        )}
                      </div>

                      {/* Daily: interval */}
                      {watchedRepeatType === 'daily' && (
                        <div className="space-y-1">
                          <Label htmlFor="repeat_interval_days">Repeat every (days)</Label>
                          <Input
                            id="repeat_interval_days"
                            type="number"
                            min={1}
                            max={365}
                            disabled={!isPending}
                            placeholder="e.g. 7 for weekly"
                            className="w-40"
                            {...register('repeat_interval_days')}
                          />
                          {errors.repeat_interval_days && (
                            <p className="text-destructive text-sm">{errors.repeat_interval_days.message}</p>
                          )}
                        </div>
                      )}

                      {/* Weekly: day pills */}
                      {watchedRepeatType === 'weekly' && (
                        <div className="space-y-2">
                          <Label>Repeat on</Label>
                          <div className="flex flex-wrap gap-2">
                            {(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const).map((label, i) => {
                              const active = watchedDaysOfWeek.includes(i)
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  disabled={!isPending}
                                  onClick={() => {
                                    if (!isPending) return
                                    setValue(
                                      'repeat_days_of_week',
                                      active
                                        ? watchedDaysOfWeek.filter((d) => d !== i)
                                        : [...watchedDaysOfWeek, i]
                                    )
                                  }}
                                  className={cn(
                                    'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                                    active
                                      ? 'bg-primary text-primary-foreground border-primary'
                                      : 'bg-surface border-border text-text hover:bg-muted',
                                    !isPending && 'opacity-60 cursor-not-allowed'
                                  )}
                                >
                                  {label}
                                </button>
                              )
                            })}
                          </div>
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {(errors as any).repeat_days_of_week && (
                            <p className="text-destructive text-sm">Select at least one day of the week</p>
                          )}
                        </div>
                      )}

                      {/* Monthly — specific date */}
                      {watchedRepeatType === 'monthly_date' && (
                        <div className="space-y-1">
                          <Label>Day of month</Label>
                          <Controller
                            name="repeat_day_of_month"
                            control={control}
                            render={({ field }) => (
                              <Select
                                value={field.value != null ? String(field.value) : ''}
                                disabled={!isPending}
                                onValueChange={(v) => field.onChange(Number(v))}
                              >
                                <SelectTrigger className="w-36">
                                  <SelectValue placeholder="Select day" />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                                    <SelectItem key={d} value={String(d)}>
                                      {ordinal(d)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {(errors as any).repeat_day_of_month && (
                            <p className="text-destructive text-sm">Select a day of the month</p>
                          )}
                        </div>
                      )}

                      {/* Monthly — day pattern */}
                      {watchedRepeatType === 'monthly_day' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label>Week</Label>
                            <Controller
                              name="repeat_week_of_month"
                              control={control}
                              render={({ field }) => (
                                <Select
                                  value={field.value != null ? String(field.value) : ''}
                                  disabled={!isPending}
                                  onValueChange={(v) => field.onChange(Number(v))}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select week" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1">First</SelectItem>
                                    <SelectItem value="2">Second</SelectItem>
                                    <SelectItem value="3">Third</SelectItem>
                                    <SelectItem value="4">Fourth</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            />
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {(errors as any).repeat_week_of_month && (
                              <p className="text-destructive text-sm">Select a week and day</p>
                            )}
                          </div>
                          <div className="space-y-1">
                            <Label>Day</Label>
                            <Controller
                              name="repeat_day_of_week"
                              control={control}
                              render={({ field }) => (
                                <Select
                                  value={field.value != null ? String(field.value) : ''}
                                  disabled={!isPending}
                                  onValueChange={(v) => field.onChange(Number(v))}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select day" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="0">Sunday</SelectItem>
                                    <SelectItem value="1">Monday</SelectItem>
                                    <SelectItem value="2">Tuesday</SelectItem>
                                    <SelectItem value="3">Wednesday</SelectItem>
                                    <SelectItem value="4">Thursday</SelectItem>
                                    <SelectItem value="5">Friday</SelectItem>
                                    <SelectItem value="6">Saturday</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>
                        </div>
                      )}

                      {/* End date */}
                      <div className="space-y-1">
                        <Label htmlFor="repeat_end_date">
                          End date <span className="text-text-muted font-normal">(optional)</span>
                        </Label>
                        <input
                          id="repeat_end_date"
                          type="date"
                          min={watchedScheduledDate || new Date().toISOString().split('T')[0]}
                          disabled={!isPending}
                          className={inputClass + ' w-48'}
                          {...register('repeat_end_date')}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Form actions — only for pending */}
              {isPending && (
                <div className="flex items-center gap-3 mt-8">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => navigate('/reminders')}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-primary text-primary-foreground"
                    disabled={isSubmitting || !isDirty && !audioBase64}
                  >
                    {isSubmitting ? 'Saving…' : 'Save Changes'}
                  </Button>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Right column — status, cancel, create similar */}
        <div className="w-72 shrink-0 space-y-4">
          {/* Status card */}
          <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
            <h2 className="text-sm font-semibold text-text">Status</h2>
            <div className="flex items-center gap-2">
              <StatusBadge status={reminder.status as Parameters<typeof StatusBadge>[0]['status']} />
            </div>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-muted">Scheduled</dt>
                <dd className="text-text text-right">
                  {formatDateTime(reminder.scheduled_at, timezone)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Source</dt>
                <dd className="text-text">{reminder.source === 'ivr' ? 'IVR' : 'Admin'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">Attempts</dt>
                <dd className="text-text">{reminder.delivery_attempts}</dd>
              </div>
              {reminder.delivery_method && (
                <div className="flex justify-between">
                  <dt className="text-text-muted">Delivered via</dt>
                  <dd className="text-text">
                    {reminder.delivery_method === 'human' ? 'Human' : 'Voicemail'}
                  </dd>
                </div>
              )}
              {reminder.delivered_at && (
                <div className="flex justify-between">
                  <dt className="text-text-muted">Delivered at</dt>
                  <dd className="text-text text-right">
                    {formatDateTime(reminder.delivered_at, timezone)}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Cancel card — only for pending */}
          {isPending && (
            <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
              <h2 className="text-sm font-semibold text-text">Cancel Reminder</h2>
              <p className="text-text-muted text-sm">
                Cancelling will permanently stop this reminder from being delivered.
              </p>
              <Button
                variant="outline"
                className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => setShowCancelDialog(true)}
              >
                Cancel Reminder
              </Button>
            </div>
          )}

          {/* Create Similar card — for delivered, missed, cancelled */}
          {!isPending && (
            <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
              <h2 className="text-sm font-semibold text-text">Create Similar</h2>
              <p className="text-text-muted text-sm">
                Pre-fill a new reminder with the same user, callback number, and recording. You only need to set a new date and time.
              </p>
              <Button
                className="w-full bg-primary text-primary-foreground"
                onClick={() => {
                  const params = new URLSearchParams({
                    user_id: reminder.user_id,
                    recording_url: reminder.recording_url,
                    callback_number: reminder.callback_number,
                  })
                  navigate(`/reminders/new?${params.toString()}`)
                }}
              >
                <i className="ti ti-copy mr-2" />
                Create Similar
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Cancel confirmation dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={(open: boolean) => { if (!open) setShowCancelDialog(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this reminder?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the reminder for{' '}
              <strong>{userRecord?.name ?? 'this user'}</strong> scheduled for{' '}
              <strong>{formatDateTime(reminder.scheduled_at, timezone)}</strong>?
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmCancel}
            >
              Cancel Reminder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
