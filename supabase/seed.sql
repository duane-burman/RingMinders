-- ============================================================
-- TEST DATA SEED — DELETE BEFORE GO-LIVE
-- This file is for UI development and testing only.
-- Run manually: supabase db reset --linked (caution: resets schema too)
-- Or apply just the seed: psql $DATABASE_URL < supabase/seed.sql
-- To remove test data before go-live, run:
--   DELETE FROM public.call_log;
--   DELETE FROM public.scheduler_log;
--   DELETE FROM public.reminders WHERE source = 'admin' AND recording_url LIKE '%twilio.com/test%';
--   DELETE FROM public.users WHERE name IN ('Eli Stoltzfus','Amos Beiler','Jacob Miller','Levi Yoder','Samuel Troyer');
-- ============================================================

-- Additional test users
INSERT INTO public.users (name, primary_phone, secondary_phone, pin_hash, timezone, retry_max_attempts, retry_interval_minutes, notes, status)
VALUES
  ('Eli Stoltzfus',  '+13305550187', NULL,           '$2a$10$placeholder.hash.for.testing.only.1', 'America/New_York', 3, 15, 'Phone shanty at end of lane, best reached 7-9am', 'active'),
  ('Amos Beiler',    '+17405550231', '+17405550232',  '$2a$10$placeholder.hash.for.testing.only.2', 'America/New_York', 3, 15, 'Shop phone, rings through to house after 5pm',    'active'),
  ('Jacob Miller',   '+13305550109', NULL,            '$2a$10$placeholder.hash.for.testing.only.3', 'America/Chicago',  5, 10, 'Hard of hearing — increase retry attempts',       'active'),
  ('Levi Yoder',     '+12605550344', NULL,            '$2a$10$placeholder.hash.for.testing.only.4', 'America/New_York', 3, 15, NULL,                                              'active'),
  ('Samuel Troyer',  '+13305550412', NULL,            '$2a$10$placeholder.hash.for.testing.only.5', 'America/New_York', 3, 15, NULL,                                              'suspended')
ON CONFLICT (primary_phone) DO NOTHING;

-- Delivered reminders — spread across last 30 days
INSERT INTO public.reminders (user_id, scheduled_at, callback_number, recording_url, status, source, delivery_attempts, delivered_at, delivery_method)
SELECT id, NOW() - INTERVAL '28 days', primary_phone, 'https://api.twilio.com/test/recording1.mp3',  'delivered', 'admin', 1, NOW() - INTERVAL '28 days' + INTERVAL '2 minutes',  'human'    FROM public.users WHERE name = 'Eli Stoltzfus'
UNION ALL SELECT id, NOW() - INTERVAL '25 days', primary_phone, 'https://api.twilio.com/test/recording2.mp3',  'delivered', 'admin', 1, NOW() - INTERVAL '25 days' + INTERVAL '1 minute',   'human'    FROM public.users WHERE name = 'Amos Beiler'
UNION ALL SELECT id, NOW() - INTERVAL '22 days', primary_phone, 'https://api.twilio.com/test/recording3.mp3',  'delivered', 'admin', 2, NOW() - INTERVAL '22 days' + INTERVAL '17 minutes', 'voicemail' FROM public.users WHERE name = 'Jacob Miller'
UNION ALL SELECT id, NOW() - INTERVAL '20 days', primary_phone, 'https://api.twilio.com/test/recording4.mp3',  'delivered', 'admin', 1, NOW() - INTERVAL '20 days' + INTERVAL '3 minutes',  'human'    FROM public.users WHERE name = 'Levi Yoder'
UNION ALL SELECT id, NOW() - INTERVAL '18 days', primary_phone, 'https://api.twilio.com/test/recording5.mp3',  'delivered', 'admin', 1, NOW() - INTERVAL '18 days' + INTERVAL '1 minute',   'human'    FROM public.users WHERE name = 'Eli Stoltzfus'
UNION ALL SELECT id, NOW() - INTERVAL '15 days', primary_phone, 'https://api.twilio.com/test/recording6.mp3',  'delivered', 'admin', 3, NOW() - INTERVAL '15 days' + INTERVAL '32 minutes', 'voicemail' FROM public.users WHERE name = 'Amos Beiler'
UNION ALL SELECT id, NOW() - INTERVAL '12 days', primary_phone, 'https://api.twilio.com/test/recording7.mp3',  'delivered', 'admin', 1, NOW() - INTERVAL '12 days' + INTERVAL '2 minutes',  'human'    FROM public.users WHERE name = 'Jacob Miller'
UNION ALL SELECT id, NOW() - INTERVAL '10 days', primary_phone, 'https://api.twilio.com/test/recording8.mp3',  'delivered', 'admin', 1, NOW() - INTERVAL '10 days' + INTERVAL '1 minute',   'human'    FROM public.users WHERE name = 'Levi Yoder'
UNION ALL SELECT id, NOW() - INTERVAL '7 days',  primary_phone, 'https://api.twilio.com/test/recording9.mp3',  'delivered', 'admin', 2, NOW() - INTERVAL '7 days'  + INTERVAL '16 minutes', 'human'    FROM public.users WHERE name = 'Eli Stoltzfus'
UNION ALL SELECT id, NOW() - INTERVAL '5 days',  primary_phone, 'https://api.twilio.com/test/recording10.mp3', 'delivered', 'admin', 1, NOW() - INTERVAL '5 days'  + INTERVAL '1 minute',   'human'    FROM public.users WHERE name = 'Amos Beiler'
UNION ALL SELECT id, NOW() - INTERVAL '3 days',  primary_phone, 'https://api.twilio.com/test/recording11.mp3', 'delivered', 'admin', 1, NOW() - INTERVAL '3 days'  + INTERVAL '2 minutes',  'human'    FROM public.users WHERE name = 'Levi Yoder'
UNION ALL SELECT id, NOW() - INTERVAL '1 day',   primary_phone, 'https://api.twilio.com/test/recording12.mp3', 'delivered', 'admin', 1, NOW() - INTERVAL '1 day'   + INTERVAL '1 minute',   'human'    FROM public.users WHERE name = 'Jacob Miller';

-- Missed reminders — past
INSERT INTO public.reminders (user_id, scheduled_at, callback_number, recording_url, status, source, delivery_attempts, last_attempt_at)
SELECT id, NOW() - INTERVAL '26 days', primary_phone, 'https://api.twilio.com/test/recording13.mp3', 'missed', 'admin', 3, NOW() - INTERVAL '26 days' + INTERVAL '31 minutes' FROM public.users WHERE name = 'Jacob Miller'
UNION ALL SELECT id, NOW() - INTERVAL '14 days', primary_phone, 'https://api.twilio.com/test/recording14.mp3', 'missed', 'admin', 3, NOW() - INTERVAL '14 days' + INTERVAL '31 minutes' FROM public.users WHERE name = 'Levi Yoder'
UNION ALL SELECT id, NOW() - INTERVAL '6 days',  primary_phone, 'https://api.twilio.com/test/recording15.mp3', 'missed', 'admin', 3, NOW() - INTERVAL '6 days'  + INTERVAL '31 minutes' FROM public.users WHERE name = 'Eli Stoltzfus';

-- Today's reminders — delivered and missed so dashboard shows non-zero counts
INSERT INTO public.reminders (user_id, scheduled_at, callback_number, recording_url, status, source, delivery_attempts, delivered_at, delivery_method)
SELECT id, NOW() - INTERVAL '3 hours', primary_phone, 'https://api.twilio.com/test/recording16.mp3', 'delivered', 'admin', 1, NOW() - INTERVAL '3 hours' + INTERVAL '1 minute',   'human'    FROM public.users WHERE name = 'Eli Stoltzfus'
UNION ALL SELECT id, NOW() - INTERVAL '2 hours', primary_phone, 'https://api.twilio.com/test/recording17.mp3', 'delivered', 'admin', 1, NOW() - INTERVAL '2 hours' + INTERVAL '2 minutes',  'voicemail' FROM public.users WHERE name = 'Amos Beiler'
UNION ALL SELECT id, NOW() - INTERVAL '1 hour',  primary_phone, 'https://api.twilio.com/test/recording18.mp3', 'delivered', 'admin', 2, NOW() - INTERVAL '1 hour'  + INTERVAL '16 minutes', 'human'    FROM public.users WHERE name = 'Levi Yoder';

INSERT INTO public.reminders (user_id, scheduled_at, callback_number, recording_url, status, source, delivery_attempts, last_attempt_at)
SELECT id, NOW() - INTERVAL '4 hours', primary_phone, 'https://api.twilio.com/test/recording19.mp3', 'missed', 'admin', 3, NOW() - INTERVAL '4 hours' + INTERVAL '31 minutes' FROM public.users WHERE name = 'Jacob Miller'
UNION ALL SELECT id, NOW() - INTERVAL '30 minutes', primary_phone, 'https://api.twilio.com/test/recording20.mp3', 'missed', 'admin', 3, NOW() - INTERVAL '30 minutes' + INTERVAL '31 minutes' FROM public.users WHERE name = 'Eli Stoltzfus';

-- Pending reminders — future
INSERT INTO public.reminders (user_id, scheduled_at, callback_number, recording_url, status, source, is_repeating, repeat_type, repeat_days_of_week, repeat_day_of_month)
SELECT id, NOW() + INTERVAL '2 hours',  primary_phone, 'https://api.twilio.com/test/recording21.mp3', 'pending', 'admin', false, NULL,      NULL::integer[],       NULL::integer FROM public.users WHERE name = 'Eli Stoltzfus'
UNION ALL SELECT id, NOW() + INTERVAL '5 hours',  primary_phone, 'https://api.twilio.com/test/recording22.mp3', 'pending', 'admin', false, NULL,      NULL::integer[],       NULL::integer FROM public.users WHERE name = 'Amos Beiler'
UNION ALL SELECT id, NOW() + INTERVAL '1 day',    primary_phone, 'https://api.twilio.com/test/recording23.mp3', 'pending', 'admin', true,  'weekly',  ARRAY[1,3,5], NULL::integer FROM public.users WHERE name = 'Levi Yoder'
UNION ALL SELECT id, NOW() + INTERVAL '3 days',   primary_phone, 'https://api.twilio.com/test/recording24.mp3', 'pending', 'admin', true,  'monthly_date', NULL::integer[], 15   FROM public.users WHERE name = 'Jacob Miller';

-- Call log — outbound delivered
INSERT INTO public.call_log (user_id, reminder_id, direction, from_number, to_number, twilio_call_sid, call_status, duration_seconds, outcome, created_at)
SELECT u.id, r.id, 'outbound', '+18005551234', u.primary_phone,
  'CA' || SUBSTR(MD5(r.id::TEXT), 1, 32),
  'completed',
  CASE WHEN r.delivery_method = 'human' THEN 65 ELSE 45 END,
  CASE WHEN r.delivery_method = 'human' THEN 'reminder_delivered' ELSE 'reminder_voicemail' END,
  r.delivered_at
FROM public.reminders r
JOIN public.users u ON r.user_id = u.id
WHERE r.status = 'delivered';

-- Call log — outbound missed (no-answer)
INSERT INTO public.call_log (user_id, reminder_id, direction, from_number, to_number, twilio_call_sid, call_status, duration_seconds, outcome, created_at)
SELECT u.id, r.id, 'outbound', '+18005551234', u.primary_phone,
  'CA' || SUBSTR(MD5(r.id::TEXT || '1'), 1, 32),
  'no-answer', 30, 'reminder_missed',
  r.last_attempt_at
FROM public.reminders r
JOIN public.users u ON r.user_id = u.id
WHERE r.status = 'missed';

-- Call log — some busy and failed calls for failure report
INSERT INTO public.call_log (user_id, reminder_id, direction, from_number, to_number, twilio_call_sid, call_status, duration_seconds, outcome, error_message, created_at)
SELECT * FROM (
  SELECT u.id, r.id, 'outbound', '+18005551234', u.primary_phone,
    'CA' || SUBSTR(MD5(r.id::TEXT || '2'), 1, 32),
    'busy', 0, 'reminder_missed', NULL,
    r.scheduled_at + INTERVAL '1 minute'
  FROM public.reminders r
  JOIN public.users u ON r.user_id = u.id
  WHERE r.status = 'missed'
  LIMIT 2
) busy_calls
UNION ALL
SELECT * FROM (
  SELECT u.id, r.id, 'outbound', '+18005551234', u.primary_phone,
    'CA' || SUBSTR(MD5(r.id::TEXT || '3'), 1, 32),
    'failed', 0, 'reminder_missed', 'Twilio error 21211: Invalid To phone number',
    r.scheduled_at + INTERVAL '2 minutes'
  FROM public.reminders r
  JOIN public.users u ON r.user_id = u.id
  WHERE r.status = 'missed'
  LIMIT 1
) failed_calls;

-- Inbound call log — users calling in to create reminders
INSERT INTO public.call_log (user_id, direction, from_number, to_number, twilio_call_sid, call_status, duration_seconds, outcome, created_at)
SELECT u.id, 'inbound', u.primary_phone, '+18005551234',
  'CA' || SUBSTR(MD5(u.id::TEXT || 'inbound'), 1, 32),
  'completed', FLOOR(90 + RANDOM() * 60)::INT, 'reminder_created',
  NOW() - (FLOOR(RANDOM() * 20) || ' days')::INTERVAL
FROM public.users u
WHERE u.name IN ('Eli Stoltzfus', 'Amos Beiler', 'Jacob Miller', 'Levi Yoder');

-- Scheduler log — 3 weeks of healthy hourly samples
INSERT INTO public.scheduler_log (executed_at, reminders_due, reminders_processed, reminders_failed, edge_function_status, duration_ms)
SELECT
  NOW() - (n || ' hours')::INTERVAL,
  FLOOR(RANDOM() * 3)::INT,
  FLOOR(RANDOM() * 3)::INT,
  0,
  200,
  FLOOR(80 + RANDOM() * 40)::INT
FROM GENERATE_SERIES(1, 504) AS n;

-- Two scheduler error entries for realism
INSERT INTO public.scheduler_log (executed_at, reminders_due, reminders_processed, reminders_failed, edge_function_status, error_message, duration_ms)
VALUES
  (NOW() - INTERVAL '8 days', 2, 0, 2, 500, 'Edge Function timeout after 30s', 31000),
  (NOW() - INTERVAL '3 days', 1, 0, 1, 503, 'Service temporarily unavailable', 5000);
