-- Expand repeating reminder columns to support daily, weekly, and monthly patterns

ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS repeat_type TEXT CHECK (repeat_type IN ('daily', 'weekly', 'monthly_date', 'monthly_day')),
  ADD COLUMN IF NOT EXISTS repeat_days_of_week INTEGER[],
  ADD COLUMN IF NOT EXISTS repeat_day_of_month INTEGER CHECK (repeat_day_of_month BETWEEN 1 AND 28),
  ADD COLUMN IF NOT EXISTS repeat_week_of_month INTEGER CHECK (repeat_week_of_month BETWEEN 1 AND 4),
  ADD COLUMN IF NOT EXISTS repeat_day_of_week INTEGER CHECK (repeat_day_of_week BETWEEN 0 AND 6);

-- repeat_interval_days stays for daily type
-- repeat_end_date stays for all types
-- is_repeating stays as the top-level boolean flag

COMMENT ON COLUMN public.reminders.repeat_type IS 'daily | weekly | monthly_date | monthly_day';
COMMENT ON COLUMN public.reminders.repeat_days_of_week IS '0=Sunday through 6=Saturday, used for weekly type';
COMMENT ON COLUMN public.reminders.repeat_day_of_month IS '1-28, used for monthly_date type';
COMMENT ON COLUMN public.reminders.repeat_week_of_month IS '1=First, 2=Second, 3=Third, 4=Fourth, used for monthly_day type';
COMMENT ON COLUMN public.reminders.repeat_day_of_week IS '0=Sunday through 6=Saturday, used for monthly_day type';
