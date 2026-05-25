// Create a new reminder on behalf of a user
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { reminderSchema } from '@/lib/validations'
import type { ReminderFormData } from '@/lib/validations'
import { useUsers } from '@/hooks/useUsers'
import type { User } from '@/hooks/useUsers'
import { useCreateReminder } from '@/hooks/useReminders'
import { supabase } from '@/lib/supabase'
import { formatPhone, formatPhoneInput, toUtcIso, ordinal, dateTimeInputClass, cn } from '@/lib/utils'
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


export function ReminderNewPage() {
  const navigate = useNavigate()
  const today = new Date().toISOString().split('T')[0]
  const [searchParams] = useSearchParams()

  // Pre-population from "Create Similar" flow
  const prefillUserId = searchParams.get('user_id') ?? undefined
  const prefillRecordingUrl = searchParams.get('recording_url') ?? undefined
  const prefillCallbackNumber = searchParams.get('callback_number') ?? undefined

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
      user_id: prefillUserId ?? '',
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
    formState: { errors, isSubmitting },
  } = form

  const watchedUserId = watch('user_id')
  const watchedCallbackType = watch('callback_type')
  const watchedIsRepeating = watch('is_repeating')
  const watchedRepeatType = watch('repeat_type')
  const watchedDaysOfWeek = watch('repeat_days_of_week') ?? []
  const watchedScheduledDate = watch('scheduled_date')

  // Update selectedUser when user changes
  useEffect(() => {
    if (watchedUserId && users) {
      const user = users.find((u) => u.id === watchedUserId) ?? null
      setSelectedUser(user)
      // Only reset to primary if not pre-filling a specific callback number
      if (!prefillCallbackNumber) {
        setValue('callback_type', 'primary')
      }
    }
  }, [watchedUserId, users, setValue, prefillCallbackNumber])

  // Pre-populate callback type from prefillCallbackNumber once user is known
  const prefillApplied = useRef(false)
  useEffect(() => {
    if (!selectedUser || !prefillCallbackNumber || prefillApplied.current) return
    prefillApplied.current = true
    if (prefillCallbackNumber === selectedUser.primary_phone) {
      setValue('callback_type', 'primary')
    } else if (selectedUser.secondary_phone && prefillCallbackNumber === selectedUser.secondary_phone) {
      setValue('callback_type', 'secondary')
    } else {
      setValue('callback_type', 'custom')
      setValue('custom_callback', prefillCallbackNumber.replace(/^\+1/, ''))
    }
  }, [selectedUser, prefillCallbackNumber, setValue])

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

    if (!audioBase64 && !prefillRecordingUrl) {
      setSubmitError('Please provide a voice message before submitting.')
      return
    }
    if (!selectedUser) {
      setSubmitError('Please select a user.')
      return
    }

    try {
      // 1. Upload audio to Storage via Edge Function (skip if reusing pre-filled recording)
      let recordingUrl: string
      if (audioBase64) {
        const { data: { session } } = await supabase.auth.getSession()
        const { data: fnData, error: fnError } = await supabase.functions.invoke(
          'admin-upload-audio',
          {
            body: { audio_base64: audioBase64, mime_type: audioMimeType, file_name: audioFileName },
            headers: { Authorization: `Bearer ${session?.access_token}` }
          }
        )
        if (fnError) throw new Error(fnError.message)
        if (fnData?.error) throw new Error(fnData.error)
        recordingUrl = fnData.url
      } else {
        recordingUrl = prefillRecordingUrl!
      }

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
        repeat_type: data.repeat_type,
        repeat_interval_days: data.repeat_type === 'daily' ? data.repeat_interval_days : null,
        repeat_days_of_week: data.repeat_type === 'weekly' ? data.repeat_days_of_week : null,
        repeat_day_of_month: data.repeat_type === 'monthly_date' ? data.repeat_day_of_month : null,
        repeat_week_of_month: data.repeat_type === 'monthly_day' ? data.repeat_week_of_month : null,
        repeat_day_of_week: data.repeat_type === 'monthly_day' ? data.repeat_day_of_week : null,
        repeat_end_date: data.repeat_end_date || null,
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
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger id="user_id">
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users?.filter((u) => !!u.id).map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
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
                className={dateTimeInputClass}
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
                className={dateTimeInputClass}
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

              {/* Pre-filled recording from "Create Similar" */}
              {prefillRecordingUrl && !audioUrl && (
                <div className="space-y-1">
                  <p className="text-text-muted text-xs">Pre-filled recording (replace below if needed):</p>
                  <audio controls src={prefillRecordingUrl} className="w-full h-10" />
                </div>
              )}

              {/* New recording playback */}
              {audioUrl && (
                <div className="mt-3">
                  <audio controls src={audioUrl} className="w-full h-10" />
                </div>
              )}

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
                              onClick={() => {
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
                                  : 'bg-surface border-border text-text hover:bg-muted'
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

                  {/* End date — always visible when repeating */}
                  <div className="space-y-1">
                    <Label htmlFor="repeat_end_date">
                      End date <span className="text-text-muted font-normal">(optional)</span>
                    </Label>
                    <input
                      id="repeat_end_date"
                      type="date"
                      min={watchedScheduledDate || new Date().toISOString().split('T')[0]}
                      className={dateTimeInputClass + ' w-48'}
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
