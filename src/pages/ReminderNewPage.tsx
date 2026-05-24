// Create a new reminder on behalf of a user
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { reminderSchema } from '@/lib/validations'
import type { ReminderFormData } from '@/lib/validations'
import { useUsers } from '@/hooks/useUsers'
import type { User } from '@/hooks/useUsers'
import { useCreateReminder } from '@/hooks/useReminders'
import { supabase } from '@/lib/supabase'
import { formatPhone } from '@/lib/utils'
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

// Shared input className to match shadcn Input
const inputClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

// Convert local date+time in a given timezone to a UTC ISO string
function toUtcIso(dateStr: string, timeStr: string, timezone: string): string {
  // Treat the input as UTC to use as a reference, then find the offset
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
  const formatted = formatter.format(naiveUtc) // e.g. "2026-05-25, 05:00"
  const [localDate, localTime] = formatted.split(', ')
  const displayedMs = new Date(`${localDate}T${localTime}:00Z`).getTime()
  const correction = naiveUtc.getTime() - displayedMs
  return new Date(naiveUtc.getTime() + correction).toISOString()
}

const today = new Date().toISOString().split('T')[0]

export function ReminderNewPage() {
  const navigate = useNavigate()

  // Audio state
  const [audioBase64, setAudioBase64] = useState<string | null>(null)
  const [audioMimeType, setAudioMimeType] = useState<string>('audio/webm')
  const [audioFileName, setAudioFileName] = useState<string>('recording.webm')
  const [audioDisplayName, setAudioDisplayName] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  // Form state
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { data: users } = useUsers()
  const createReminder = useCreateReminder()

  const form = useForm<ReminderFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(reminderSchema) as any,
    defaultValues: {
      callback_type: 'primary',
      is_repeating: false,
      custom_callback: '',
    },
  })

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = form

  const watchedUserId = watch('user_id')
  const watchedCallbackType = watch('callback_type')
  const watchedIsRepeating = watch('is_repeating')

  // Update selectedUser when user changes
  useEffect(() => {
    if (watchedUserId && users) {
      const user = users.find((u) => u.id === watchedUserId) ?? null
      setSelectedUser(user)
      setValue('callback_type', 'primary')
    }
  }, [watchedUserId, users, setValue])

  // Create blob URL for audio playback, revoke on change
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

  const onSubmit = async (data: ReminderFormData) => {
    setSubmitError(null)

    if (!audioBase64) {
      setSubmitError('Please provide a voice message before submitting.')
      return
    }
    if (!selectedUser) {
      setSubmitError('Please select a user.')
      return
    }

    try {
      // 1. Upload audio to Storage via Edge Function
      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        'admin-upload-audio',
        { body: { audio_base64: audioBase64, mime_type: audioMimeType, file_name: audioFileName } }
      )
      if (fnError) throw new Error(fnError.message)
      if (fnData?.error) throw new Error(fnData.error)
      const recordingUrl: string = fnData.url

      // 2. Resolve callback number
      let callbackNumber: string
      if (data.callback_type === 'primary') {
        callbackNumber = selectedUser.primary_phone
      } else if (data.callback_type === 'secondary') {
        callbackNumber = selectedUser.secondary_phone!
      } else {
        callbackNumber = `+1${data.custom_callback}`
      }

      // 3. Convert local date+time to UTC using user's timezone
      const scheduledAt = toUtcIso(data.scheduled_date, data.scheduled_time, selectedUser.timezone)

      // 4. Create reminder
      await createReminder.mutateAsync({
        user_id: data.user_id,
        scheduled_at: scheduledAt,
        callback_number: callbackNumber,
        recording_url: recordingUrl,
        is_repeating: data.is_repeating,
        repeat_interval_days: data.is_repeating ? data.repeat_interval_days : undefined,
        repeat_end_date: data.is_repeating && data.repeat_end_date ? data.repeat_end_date : undefined,
      })

      navigate('/reminders')
    } catch (err) {
      setSubmitError((err as Error).message)
    }
  }

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
        <h1 className="text-2xl font-semibold text-text">New Reminder</h1>
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
            {/* User */}
            <div className="space-y-1">
              <Label htmlFor="user_id">User</Label>
              <Controller
                name="user_id"
                control={control}
                render={({ field }) => (
                  <Select
                    key={field.value}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger id="user_id">
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users?.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.user_id && (
                <p className="text-destructive text-sm">{errors.user_id.message}</p>
              )}
            </div>

            {/* Scheduled Date */}
            <div className="space-y-1">
              <Label htmlFor="scheduled_date">Scheduled Date</Label>
              <input
                id="scheduled_date"
                type="date"
                min={today}
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
                className={inputClass}
                {...register('scheduled_time')}
              />
              {errors.scheduled_time && (
                <p className="text-destructive text-sm">{errors.scheduled_time.message}</p>
              )}
              {selectedUser && (
                <p className="text-text-muted text-xs">
                  Time is interpreted in {selectedUser.timezone}
                </p>
              )}
            </div>

            {/* Callback Number */}
            <div className="space-y-2">
              <Label>Callback Number</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="primary"
                    className="accent-primary"
                    {...register('callback_type')}
                  />
                  <span className="text-sm text-text">
                    Primary phone:{' '}
                    {selectedUser
                      ? formatPhone(selectedUser.primary_phone)
                      : <span className="text-text-muted">— select a user first</span>}
                  </span>
                </label>

                {selectedUser?.secondary_phone && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="secondary"
                      className="accent-primary"
                      {...register('callback_type')}
                    />
                    <span className="text-sm text-text">
                      Secondary phone: {formatPhone(selectedUser.secondary_phone)}
                    </span>
                  </label>
                )}

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="custom"
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
                        Recording...
                      </span>
                    )}
                    {!isRecording && audioDisplayName === 'recording.webm' && (
                      <span className="text-text-muted text-sm">Recording captured</span>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              {/* Playback — shown regardless of which tab captured the audio */}
              {audioUrl && (
                <div className="mt-3">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio controls src={audioUrl} className="w-full h-10" />
                </div>
              )}
            </div>

            {/* Repeating */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Controller
                  name="is_repeating"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      id="is_repeating"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label htmlFor="is_repeating" className="cursor-pointer">
                  Repeating reminder
                </Label>
              </div>

              {watchedIsRepeating && (
                <div className="pl-2 space-y-4 border-l-2 border-border ml-2">
                  <div className="space-y-1 pl-4">
                    <Label htmlFor="repeat_interval_days">Repeat every (days)</Label>
                    <Input
                      id="repeat_interval_days"
                      type="number"
                      min={1}
                      max={365}
                      className="w-28"
                      {...register('repeat_interval_days')}
                    />
                    {errors.repeat_interval_days && (
                      <p className="text-destructive text-sm">
                        {errors.repeat_interval_days.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1 pl-4">
                    <Label htmlFor="repeat_end_date">
                      End date <span className="text-text-muted font-normal">(optional)</span>
                    </Label>
                    <input
                      id="repeat_end_date"
                      type="date"
                      min={today}
                      className={inputClass + ' w-48'}
                      {...register('repeat_end_date')}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
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
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating…' : 'Create Reminder'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
