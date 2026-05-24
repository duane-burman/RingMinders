-- System-wide configuration settings
-- Single row, always exists, never inserted or deleted after seeding

CREATE TABLE public.settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  default_timezone VARCHAR(50) NOT NULL DEFAULT 'America/New_York',
  default_retry_max_attempts INTEGER NOT NULL DEFAULT 3,
  default_retry_interval_minutes INTEGER NOT NULL DEFAULT 15,
  max_recording_length_seconds INTEGER NOT NULL DEFAULT 120,
  account_lockout_threshold INTEGER NOT NULL DEFAULT 5,
  account_lockout_duration_minutes INTEGER NOT NULL DEFAULT 30,
  scheduler_concurrency_limit INTEGER NOT NULL DEFAULT 10,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the single row
INSERT INTO public.settings (id) VALUES (1);

-- Trigger to update updated_at
CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access" ON public.settings
  FOR ALL USING (auth.role() = 'authenticated');
