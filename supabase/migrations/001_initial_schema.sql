-- Enable required extensions
create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";
create extension if not exists "pg_net";

-- Users table
create table public.users (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null,
  primary_phone varchar(15) not null unique,
  secondary_phone varchar(15) unique,
  pin_hash varchar(60) not null,
  pin_attempts integer not null default 0,
  locked_until timestamptz,
  status text not null default 'active' check (status in ('active', 'suspended', 'disabled')),
  retry_max_attempts integer not null default 3,
  retry_interval_minutes integer not null default 15,
  timezone varchar(50) not null default 'America/New_York',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reminders table
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  scheduled_at timestamptz not null,
  callback_number varchar(15) not null,
  recording_url varchar(500) not null,
  recording_duration integer,
  status text not null default 'pending' check (status in ('pending','in_progress','delivered','voicemail','missed','heard','cancelled','expired')),
  source text not null check (source in ('ivr','admin')),
  is_repeating boolean not null default false,
  repeat_interval_days integer,
  repeat_end_date date,
  parent_reminder_id uuid references public.reminders(id),
  delivery_attempts integer not null default 0,
  last_attempt_at timestamptz,
  next_retry_at timestamptz,
  delivered_at timestamptz,
  delivery_method text check (delivery_method in ('human','voicemail')),
  heard_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Call log table
create table public.call_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  reminder_id uuid references public.reminders(id),
  direction text not null check (direction in ('inbound','outbound')),
  from_number varchar(15) not null,
  to_number varchar(15) not null,
  twilio_call_sid varchar(40) not null,
  call_status text not null,
  duration_seconds integer,
  outcome text,
  error_message text,
  created_at timestamptz not null default now()
);

-- Scheduler log table
create table public.scheduler_log (
  id bigserial primary key,
  executed_at timestamptz not null default now(),
  reminders_due integer not null,
  reminders_processed integer not null,
  reminders_failed integer not null,
  edge_function_status integer,
  error_message text,
  duration_ms integer
);

-- Indexes
create index idx_users_primary_phone on public.users(primary_phone);
create index idx_users_secondary_phone on public.users(secondary_phone) where secondary_phone is not null;
create index idx_reminders_status_scheduled on public.reminders(status, scheduled_at);
create index idx_reminders_user_status on public.reminders(user_id, status);
create index idx_reminders_status_retry on public.reminders(status, next_retry_at);
create index idx_call_log_user_created on public.call_log(user_id, created_at);
create index idx_call_log_twilio_sid on public.call_log(twilio_call_sid);
create index idx_scheduler_log_executed on public.scheduler_log(executed_at);

-- Updated_at trigger function
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger users_updated_at before update on public.users
  for each row execute function public.handle_updated_at();

create trigger reminders_updated_at before update on public.reminders
  for each row execute function public.handle_updated_at();

-- Enable RLS
alter table public.users enable row level security;
alter table public.reminders enable row level security;
alter table public.call_log enable row level security;
alter table public.scheduler_log enable row level security;

-- RLS policies (admin access only — authenticated users can read/write everything)
create policy "Admin full access" on public.users
  for all using (auth.role() = 'authenticated');

create policy "Admin full access" on public.reminders
  for all using (auth.role() = 'authenticated');

create policy "Admin full access" on public.call_log
  for all using (auth.role() = 'authenticated');

create policy "Admin full access" on public.scheduler_log
  for all using (auth.role() = 'authenticated');
