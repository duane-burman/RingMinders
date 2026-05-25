-- Migration 007: pg_cron scheduler job for voice-process-due-reminders
-- Adds scheduler_secret column to settings and registers the cron job.
-- The scheduler_secret VALUE is not stored here — set it via:
--   UPDATE public.settings SET scheduler_secret = '<value>' WHERE id = 1;

-- Add scheduler_secret column to settings table (safe if already exists)
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS scheduler_secret TEXT;

-- Register (or replace) the pg_cron job that fires every 60 seconds.
-- pg_cron minimum interval is 1 minute; '* * * * *' runs on every minute boundary.
-- cron.schedule() is idempotent by job name — replaces an existing job with the same name.
SELECT cron.schedule(
  'process-due-reminders',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://dsvcvzbcfnldtxqpmhrn.supabase.co/functions/v1/voice-process-due-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        SELECT scheduler_secret FROM public.settings WHERE id = 1
      )
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
