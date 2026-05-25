-- Migration 008: Repeating reminder trigger + parent_reminder_id column
-- When a repeating reminder reaches a terminal status (delivered/voicemail/missed),
-- this trigger automatically schedules the next occurrence.

-- Add parent_reminder_id column (links next occurrence back to its source)
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS parent_reminder_id UUID REFERENCES public.reminders(id);

CREATE INDEX IF NOT EXISTS idx_reminders_parent_reminder_id
  ON public.reminders(parent_reminder_id)
  WHERE parent_reminder_id IS NOT NULL;

-- ─── Trigger function ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.schedule_next_reminder_occurrence()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_timezone           TEXT;
  v_next_scheduled_at  TIMESTAMPTZ;
  v_repeat_type        TEXT;
  v_interval_days      INT;
  v_repeat_day_of_week INT;   -- 0=Sun..6=Sat
  v_repeat_week_of_month INT;
  v_repeat_end_date    DATE;
  v_base_local         TIMESTAMPTZ;
  v_local_date         DATE;
  v_local_time         TIME;
  -- weekly search variables
  check_date           DATE;
  check_dow            INT;
  occurrence_found     BOOLEAN;
  iterations           INT;
  -- monthly_day variables
  first_of_next_month  DATE;
  first_day_dow        INT;
  target_dow           INT;
  days_until_target    INT;
  target_date_val      DATE;
BEGIN
  -- Guard 1: only process repeating reminders
  IF NEW.is_repeating IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Guard 2: only fire when reaching a terminal delivery status
  IF NEW.status NOT IN ('delivered', 'voicemail', 'missed') THEN
    RETURN NEW;
  END IF;

  -- Guard 3: skip if a child already exists (idempotency)
  IF EXISTS (
    SELECT 1 FROM public.reminders WHERE parent_reminder_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Fetch user timezone and repeat settings
  SELECT
    COALESCE(u.timezone, 'America/New_York'),
    r.repeat_type,
    r.interval_days,
    r.repeat_day_of_week,
    r.repeat_week_of_month,
    r.repeat_end_date
  INTO
    v_timezone,
    v_repeat_type,
    v_interval_days,
    v_repeat_day_of_week,
    v_repeat_week_of_month,
    v_repeat_end_date
  FROM public.reminders r
  JOIN public.users u ON u.id = r.user_id
  WHERE r.id = NEW.id;

  -- Express the original scheduled_at in the user's local timezone
  v_base_local := NEW.scheduled_at AT TIME ZONE v_timezone;
  v_local_date := v_base_local::DATE;
  v_local_time := v_base_local::TIME;

  -- ── Calculate next occurrence ───────────────────────────────────────────────
  IF v_repeat_type = 'daily' THEN
    -- Every interval_days days
    v_next_scheduled_at := (
      (v_local_date + COALESCE(v_interval_days, 1))::TIMESTAMP + v_local_time
    ) AT TIME ZONE v_timezone;

  ELSIF v_repeat_type = 'weekly' THEN
    -- Next occurrence of the target day-of-week (0=Sun..6=Sat)
    check_date       := v_local_date + 1;
    occurrence_found := FALSE;
    iterations       := 0;

    WHILE NOT occurrence_found AND iterations < 14 LOOP
      -- EXTRACT DOW: 0=Sun..6=Sat
      check_dow := EXTRACT(DOW FROM check_date)::INT;
      IF check_dow = v_repeat_day_of_week THEN
        occurrence_found := TRUE;
      ELSE
        check_date := check_date + 1;
        iterations := iterations + 1;
      END IF;
    END LOOP;

    IF occurrence_found THEN
      v_next_scheduled_at := (
        check_date::TIMESTAMP + v_local_time
      ) AT TIME ZONE v_timezone;
    ELSE
      RETURN NEW;  -- should never happen within 14 iterations
    END IF;

  ELSIF v_repeat_type = 'monthly_date' THEN
    -- Same calendar date, next month — preserve time of day
    v_next_scheduled_at := (
      (DATE_TRUNC('month', v_local_date) + INTERVAL '1 month'
        + (EXTRACT(DAY FROM v_local_date) - 1) * INTERVAL '1 day')::TIMESTAMP
      + v_local_time
    ) AT TIME ZONE v_timezone;

  ELSIF v_repeat_type = 'monthly_day' THEN
    -- Nth occurrence of a specific DOW in the next month
    -- e.g., 2nd Tuesday = repeat_week_of_month=2, repeat_day_of_week=2

    first_of_next_month := DATE_TRUNC('month', v_local_date) + INTERVAL '1 month';
    first_day_dow       := EXTRACT(DOW FROM first_of_next_month)::INT;
    target_dow          := COALESCE(v_repeat_day_of_week, 0);

    -- Days from the 1st of the month to the first occurrence of target_dow
    days_until_target := (target_dow - first_day_dow + 7) % 7;

    -- Advance by (week_of_month - 1) additional weeks
    target_date_val := first_of_next_month
      + days_until_target
      + (COALESCE(v_repeat_week_of_month, 1) - 1) * 7;

    v_next_scheduled_at := (
      target_date_val::TIMESTAMP + v_local_time
    ) AT TIME ZONE v_timezone;

  ELSE
    -- Unknown repeat_type — do nothing
    RETURN NEW;
  END IF;

  -- Guard 4: respect repeat_end_date
  IF v_repeat_end_date IS NOT NULL
     AND (v_next_scheduled_at AT TIME ZONE v_timezone)::DATE > v_repeat_end_date THEN
    RETURN NEW;
  END IF;

  -- Insert next occurrence
  INSERT INTO public.reminders (
    user_id,
    callback_number,
    recording_url,
    recording_duration,
    scheduled_at,
    status,
    source,
    is_repeating,
    repeat_type,
    interval_days,
    repeat_day_of_week,
    repeat_week_of_month,
    repeat_end_date,
    parent_reminder_id
  )
  SELECT
    user_id,
    callback_number,
    recording_url,
    recording_duration,
    v_next_scheduled_at,
    'pending',
    source,
    is_repeating,
    repeat_type,
    interval_days,
    repeat_day_of_week,
    repeat_week_of_month,
    repeat_end_date,
    NEW.id
  FROM public.reminders
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- ─── Trigger ──────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trigger_next_reminder_occurrence ON public.reminders;

CREATE TRIGGER trigger_next_reminder_occurrence
  AFTER UPDATE ON public.reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.schedule_next_reminder_occurrence();
