# Reminder Call Service — Product Information File (PIF)

**Version:** 1.2  
**Date:** May 22, 2026  
**Owner:** Burkholder Management LLC

---

## 1. Executive Summary

The Reminder Call Service is a voice-based scheduled reminder system designed for users who do not have access to smartphones, digital calendars, or internet-connected devices. The primary target market is Amish business communities who rely on shared landline phones (phone shanties, shop phones) for communication.

Users call a dedicated phone number, authenticate with a PIN, enter a date and time via keypad, and leave a voice message. The system calls them back at the scheduled time and plays the recorded message. If the call is missed, the system retries according to configurable rules. Users can also call back in to review missed reminders.

All user accounts are provisioned by an administrator through a web-based admin UI. There is no self-registration. The system is designed to be dead simple: no internet, no app, no account creation by the user — just call and punch in numbers on any touch-tone phone.

---

## 2. Product Overview

### 2.1 Core Value Proposition

A phone-based reminder service that works with any landline or basic phone. No smartphone, internet access, or technical literacy required. The user calls a number, enters a date and time, leaves a voice message, and receives a callback at the specified time that plays the message back to them.

### 2.2 Key Features

- PIN-authenticated user accounts tied to one or two phone numbers
- Keypad-based date/time entry (no speech recognition required)
- Voice message recording with confirmation playback
- Automated callback at the scheduled date and time
- Human vs. voicemail detection with appropriate handling for each
- Configurable retry logic for missed calls
- Caller can review upcoming and missed reminders by calling in
- Repeating reminders (configured via admin UI only)
- Web-based admin UI for account and reminder management
- Full reminder editing (reschedule, change callback number, re-record message) via admin UI
- Operational reporting: delivery rates, failure diagnostics, system health monitoring

### 2.3 What This System Is NOT

- Not a voicemail system — messages are played back at a specific scheduled time
- Not a phone tree or IVR for routing calls to people
- Not a mass notification or broadcast system
- Not self-service for account creation — all accounts are admin-provisioned

---

## 3. Target User Profile

### 3.1 Primary User: Amish Business Community

- Operates businesses (manufacturing, retail, agriculture) with real scheduling needs
- Has access to a shared phone (phone shanty, shop phone, community phone)
- Cannot or does not use smartphones, apps, or internet-based calendars
- Comfortable with basic phone keypad entry
- May need to schedule reminders for themselves or for others (drivers, suppliers, customers)

### 3.2 Secondary User: Administrator

- Operates the admin UI via web browser
- Creates and manages user accounts
- Configures repeating reminders on behalf of users
- Edits or reschedules reminders on behalf of users
- Monitors system health, delivery status, and missed reminders
- Diagnoses failures and takes corrective action
- May be the RTO management company staff (Burkholder Management)

---

## 4. System Architecture

### 4.1 High-Level Architecture

The system consists of four primary components:

1. **Twilio Voice Platform** — Handles all telephony: inbound calls, outbound calls, DTMF (keypad) input collection, voice recording, and audio playback.
2. **Application Backend** — Supabase Edge Functions (Deno-based serverless functions) that serve TwiML responses to Twilio webhooks and manage business logic. The Admin UI interacts with Supabase directly via the Supabase JS client and Row Level Security policies.
3. **Database** — Supabase-hosted PostgreSQL database storing user accounts, reminders, call logs, and system configuration. Includes pg_cron for the reminder scheduler.
4. **Admin Web UI** — A React single-page application deployed on Netlify for managing accounts, reminders, system settings, and operational reports.

### 4.2 Infrastructure

- **Code Repository:** GitHub (aligns with existing Burkholder workflow)
- **Database & Backend:** Supabase (hosted PostgreSQL, Edge Functions, Auth, Storage)
- **Webhook Handlers:** Supabase Edge Functions — Deno-based serverless functions that receive Twilio POST requests and return TwiML XML responses
- **Audio Storage:** Twilio-hosted recordings (default). Twilio stores recordings indefinitely and provides a URL for playback. No separate storage needed at launch. If long-term ownership of audio files is desired in the future, Supabase Storage (S3-backed) can be used — at 30 seconds per recording and 1,000 reminders/month, total storage is approximately 50MB/month, well within Supabase limits.
- **Scheduler:** Supabase pg_cron extension — a PostgreSQL cron job that runs every 60 seconds, checks for due reminders, and invokes a Supabase Edge Function via pg_net (HTTP extension) to initiate outbound Twilio calls.
- **Admin UI Hosting:** Netlify (static site deployment from GitHub, consistent with existing Burkholder projects such as Cricket Valley and MORSpace)
- **Admin Authentication:** Supabase Auth with email/password. Row Level Security (RLS) policies enforce access control at the database level.

### 4.3 Data Flow

**Inbound Call Flow:**

1. User dials the Twilio phone number.
2. Twilio sends an HTTP POST to the Supabase Edge Function webhook URL.
3. Edge Function checks the caller ID (From parameter) against the users table.
4. Edge Function returns TwiML instructing Twilio to gather PIN input or prompt for phone number.
5. After authentication, TwiML guides the user through the create/review reminder flow.
6. Reminder data (date, time, callback number, recording URL) is written to the database.

**Outbound Call Flow:**

1. The pg_cron scheduler checks the reminders table every 60 seconds for reminders with status = `pending` and `scheduled_at <= NOW()`.
2. For each due reminder, pg_cron triggers a Supabase Edge Function via pg_net which initiates a Twilio outbound call to the callback number.
3. Twilio calls the number. The webhook response plays a prompt asking the user to press any key.
4. If a key is pressed within 10 seconds (human detected), the system plays the recorded message.
5. If no key is pressed within 10 seconds (voicemail assumed), the system waits for the beep and plays the recorded message into voicemail.
6. The reminder status is updated to `delivered` or `voicemail` accordingly.
7. If the call fails (no answer, busy), the reminder is queued for retry per the retry policy.

---

## 5. Data Model

### 5.1 Users Table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, auto-generated (gen_random_uuid()) | Unique user identifier |
| name | VARCHAR(100) | NOT NULL | User display name (e.g., "Samuel Yoder") |
| primary_phone | VARCHAR(15) | NOT NULL, UNIQUE | Primary phone number (E.164 format, e.g., +17045551234) |
| secondary_phone | VARCHAR(15) | NULLABLE, UNIQUE | Optional second phone number |
| pin_hash | VARCHAR(60) | NOT NULL | bcrypt hash of the 4-digit PIN (pgcrypto) |
| pin_attempts | INTEGER | DEFAULT 0 | Failed PIN attempts counter (resets on success) |
| locked_until | TIMESTAMPTZ | NULLABLE | Account lockout expiry after max failed attempts |
| status | TEXT | NOT NULL, DEFAULT 'active', CHECK (status IN ('active', 'suspended', 'disabled')) | Account status |
| retry_max_attempts | INTEGER | DEFAULT 3 | Max delivery retry attempts for this user |
| retry_interval_minutes | INTEGER | DEFAULT 15 | Minutes between retry attempts |
| timezone | VARCHAR(50) | DEFAULT 'America/New_York' | User timezone for scheduling |
| notes | TEXT | NULLABLE | Admin notes about this user |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Account creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last modification timestamp |

### 5.2 Reminders Table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique reminder identifier |
| user_id | UUID | FK → users.id, NOT NULL, ON DELETE CASCADE | The user who owns this reminder |
| scheduled_at | TIMESTAMPTZ | NOT NULL | When the reminder should fire |
| callback_number | VARCHAR(15) | NOT NULL | Phone number to call (E.164) |
| recording_url | VARCHAR(500) | NOT NULL | URL to the recorded voice message (Twilio hosted) |
| recording_duration | INTEGER | NULLABLE | Duration of recording in seconds |
| status | TEXT | NOT NULL, DEFAULT 'pending', CHECK (status IN ('pending', 'in_progress', 'delivered', 'voicemail', 'missed', 'heard', 'cancelled', 'expired')) | Current reminder status |
| source | TEXT | NOT NULL, CHECK (source IN ('ivr', 'admin')) | How the reminder was created |
| is_repeating | BOOLEAN | DEFAULT false | Whether this reminder repeats |
| repeat_type | TEXT | NULLABLE, CHECK (repeat_type IN ('daily', 'weekly', 'monthly_date', 'monthly_day')) | Repeat frequency type. NULL when is_repeating = false. |
| repeat_interval_days | INTEGER | NULLABLE | Days between repetitions. Used only when repeat_type = 'daily'. |
| repeat_days_of_week | INTEGER[] | NULLABLE | Array of weekday integers (0=Sunday, 6=Saturday). Used only when repeat_type = 'weekly'. |
| repeat_day_of_month | INTEGER | NULLABLE | Day of month 1–28. Used only when repeat_type = 'monthly_date'. |
| repeat_week_of_month | INTEGER | NULLABLE | Week of month 1–4 (First/Second/Third/Fourth). Used only when repeat_type = 'monthly_day'. |
| repeat_day_of_week | INTEGER | NULLABLE | Weekday integer 0–6. Used only when repeat_type = 'monthly_day'. Combined with repeat_week_of_month to express e.g. 'First Monday'. |
| repeat_end_date | DATE | NULLABLE | When the repeating series ends. NULL = indefinite. Applies to all repeat types. |
| parent_reminder_id | UUID | FK → reminders.id, NULLABLE | Links to the original repeating reminder |
| delivery_attempts | INTEGER | DEFAULT 0 | Number of call attempts made |
| last_attempt_at | TIMESTAMPTZ | NULLABLE | When the last delivery attempt occurred |
| next_retry_at | TIMESTAMPTZ | NULLABLE | When the next retry should occur |
| delivered_at | TIMESTAMPTZ | NULLABLE | When the reminder was successfully delivered |
| delivery_method | TEXT | NULLABLE, CHECK (delivery_method IN ('human', 'voicemail')) | How it was delivered |
| heard_at | TIMESTAMPTZ | NULLABLE | When the user reviewed this reminder via IVR |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last modification timestamp |

### 5.3 Reminder Status Values

| Status | Description | Set By |
|--------|-------------|--------|
| pending | Scheduled but not yet due. The scheduler has not attempted delivery. | System (on creation) |
| in_progress | Currently being delivered (call is in progress). | Scheduler (when call initiated) |
| delivered | Human answered the call and pressed a key to hear the message. | Outbound webhook |
| voicemail | No keypress detected; message was played into voicemail after beep. | Outbound webhook |
| missed | All retry attempts exhausted. Call was never answered and no voicemail detected. | Scheduler (after final retry) |
| heard | User reviewed this reminder via the IVR missed reminders menu. | Inbound IVR webhook |
| cancelled | Reminder was cancelled before delivery (by admin or by user). | Admin UI or IVR |
| expired | Scheduled time passed but system was unable to process (edge case: system downtime). | System health check |

### 5.4 Call Log Table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique log entry identifier |
| user_id | UUID | FK → users.id, NULLABLE | Associated user (NULL if caller not identified) |
| reminder_id | UUID | FK → reminders.id, NULLABLE | Associated reminder (for outbound calls) |
| direction | TEXT | NOT NULL, CHECK (direction IN ('inbound', 'outbound')) | Call direction |
| from_number | VARCHAR(15) | NOT NULL | Originating phone number |
| to_number | VARCHAR(15) | NOT NULL | Destination phone number |
| twilio_call_sid | VARCHAR(40) | NOT NULL | Twilio Call SID for reference |
| call_status | TEXT | NOT NULL | completed, no-answer, busy, failed, canceled |
| duration_seconds | INTEGER | NULLABLE | Call duration |
| outcome | TEXT | NULLABLE | authenticated, auth_failed, reminder_created, reminder_delivered, reminder_voicemail, reminder_missed |
| error_message | TEXT | NULLABLE | Error details when call_status is failed (Twilio error code and message) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | When the call occurred |

### 5.5 Scheduler Log Table

This table tracks every execution of the pg_cron scheduler for diagnostics.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PK | Auto-incrementing log ID |
| executed_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | When the scheduler ran |
| reminders_due | INTEGER | NOT NULL | Number of reminders found due |
| reminders_processed | INTEGER | NOT NULL | Number of reminders successfully dispatched to Edge Function |
| reminders_failed | INTEGER | NOT NULL | Number of reminders that failed to dispatch |
| edge_function_status | INTEGER | NULLABLE | HTTP status code returned by the Edge Function |
| error_message | TEXT | NULLABLE | Error details if the Edge Function call failed |
| duration_ms | INTEGER | NULLABLE | How long the scheduler execution took |

### 5.6 Database Indexes

- **users:** UNIQUE index on `primary_phone`; UNIQUE index on `secondary_phone` (where not null)
- **reminders:** index on `(status, scheduled_at)` for scheduler queries; index on `(user_id, status)` for user reminder lookups; index on `(status, next_retry_at)` for retry processing
- **call_log:** index on `(user_id, created_at)` for call history; index on `twilio_call_sid` for Twilio webhook correlation
- **scheduler_log:** index on `executed_at` for time-range queries

### 5.7 Database Functions

The following PostgreSQL functions should be created:

**`get_dashboard_stats()`** — Returns aggregated counts for the dashboard (active users, reminders due today, delivered today, missed today, failed calls last 24h, upcoming next 24h).

**`get_delivery_report(start_date TIMESTAMPTZ, end_date TIMESTAMPTZ)`** — Returns delivery metrics for a date range: total reminders due, delivered count, voicemail count, missed count, average attempts before delivery, average latency (minutes between scheduled_at and delivered_at).

**`get_failure_report(start_date TIMESTAMPTZ, end_date TIMESTAMPTZ)`** — Returns failure details: failed call count grouped by call_status (no-answer, busy, failed), failed calls grouped by user, reminders that exceeded max retries.

**`check_scheduler_health()`** — Returns the last 10 scheduler_log entries and flags if any gap between consecutive executions exceeds 5 minutes (indicates scheduler may have stalled).

**`cleanup_expired_reminders()`** — Finds reminders with status = `pending` where `scheduled_at` is more than 24 hours in the past and no delivery attempts were made (system was down), sets their status to `expired`.

### 5.8 Settings Table

Single-row table. Always exactly one row with id = 1. Never inserted or deleted after initial seed.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | INTEGER | 1 | Always 1. CHECK constraint enforces single row. |
| default_timezone | VARCHAR(50) | America/New_York | Default timezone applied to new user accounts |
| default_retry_max_attempts | INTEGER | 3 | Default max delivery retry attempts for new users |
| default_retry_interval_minutes | INTEGER | 15 | Default minutes between retries for new users |
| max_recording_length_seconds | INTEGER | 120 | Maximum voice message recording length |
| account_lockout_threshold | INTEGER | 5 | Failed PIN attempts before account lockout |
| account_lockout_duration_minutes | INTEGER | 30 | Minutes an account stays locked after threshold |
| scheduler_concurrency_limit | INTEGER | 10 | Max simultaneous outbound calls per scheduler run |
| updated_at | TIMESTAMPTZ | now() | Last modified timestamp |

---

## 6. User Account Management

### 6.1 Account Provisioning

All user accounts are created by an administrator through the Admin UI. There is no self-registration, no sign-up flow, and no way for a caller to create their own account via the phone system. This is by design — the target user base does not have internet access and the service operator needs to control who has access.

### 6.2 Account Creation Process (Admin)

The administrator navigates to the Admin UI and fills out the following form:

1. **Name:** The user's full name as it should appear in the system and be spoken by the IVR (e.g., "Samuel Yoder"). This is used in the greeting when the user calls in: "Welcome, Samuel."
2. **Primary Phone Number:** The main phone number associated with this user. Must be a valid 10-digit US phone number. This is checked against caller ID for authentication. Stored in E.164 format (+1XXXXXXXXXX). Must be unique across all users.
3. **Secondary Phone Number:** An optional second phone number. Same validation rules as primary. Also checked against caller ID. Allows the user to call from either number. Must be unique across all users (cannot overlap with any other user's primary or secondary).
4. **PIN:** A 4-digit numeric PIN (0000–9999). The admin sets the initial PIN. The system should suggest a random 4-digit PIN but allow the admin to override. The PIN is stored as a bcrypt hash via pgcrypto, never in plaintext. The admin can reset the PIN at any time (generates a new one, invalidates the old). There is no way for the user to reset their own PIN via the phone system — they must contact the administrator.
5. **Timezone:** Defaults to America/New_York. The admin can change it if the user is in a different timezone. All scheduled times entered by the user via IVR are interpreted in this timezone.
6. **Retry Settings:** Max retry attempts (default: 3) and retry interval in minutes (default: 15). These can be adjusted per user. Some users may want aggressive retry (every 5 minutes, 5 attempts); others may want a single attempt.
7. **Notes:** Free-text field for the admin to record any relevant information (e.g., "Shared phone shanty on Route 152, best reached mornings before 7am").

### 6.3 Account Status Values

- **active:** User can call in and receive reminders. Default status on creation.
- **suspended:** Temporarily blocked. Caller hears: "Your account has been suspended. Please contact your administrator." Existing pending reminders are paused (not deleted). Used for non-payment, abuse, or temporary holds.
- **disabled:** Permanently deactivated. Same caller experience as suspended. Pending reminders are cancelled. Account can be re-enabled by admin if needed.

### 6.4 Account Lockout Policy

After 3 consecutive failed PIN attempts in a single call, the call is terminated with: "Too many incorrect attempts. Please try again later or contact your administrator."

After 5 cumulative failed PIN attempts across calls (tracked by `pin_attempts` counter), the account is locked for 30 minutes (`locked_until` is set). During lockout, the caller hears: "Your account is temporarily locked. Please try again later or contact your administrator."

The `pin_attempts` counter resets to 0 on any successful authentication. The admin can manually unlock an account and reset the counter via the Admin UI.

### 6.5 Phone Number Matching Logic

When a call comes in, the system extracts the caller ID (Twilio's `From` parameter) and queries the users table:

```sql
SELECT id, name, pin_hash, status, pin_attempts, locked_until
FROM users
WHERE (primary_phone = :callerNumber OR secondary_phone = :callerNumber)
  AND status != 'disabled'
LIMIT 1;
```

If a match is found, the system proceeds to PIN entry. If no match is found, the system prompts the caller to enter their phone number manually (see IVR flow section 7).

---

## 7. IVR Call Flow — Inbound

This section defines every step of the inbound call experience. Each step includes the exact TwiML verb to use, the spoken prompt text, and the expected user input. This is the authoritative specification for building the Twilio webhook handlers (Supabase Edge Functions).

### 7.1 Step 1: Initial Greeting & Caller ID Check

**Trigger:** Twilio POST to the `voice-inbound` Edge Function

**System action:** Extract `From` (caller ID) from Twilio request. Query users table for matching `primary_phone` or `secondary_phone`.

**Before any branching logic — played to every caller:**
- Prompt: "Thank you for calling the Reminder Service. This call may be recorded."
- TwiML: `<Say>` (no gather — plays unconditionally before caller ID check branching)

**If match found and account active:**
- Prompt: "Welcome to the Reminder Service. Please enter your four-digit PIN."
- TwiML: `<Gather input="dtmf" numDigits="4" action="[voice-verify-pin URL]" method="POST">`

**If match found but account suspended:**
- Prompt: "Your account has been suspended. Please contact your administrator. Goodbye."
- TwiML: `<Say>` followed by `<Hangup>`

**If match found but account locked:**
- Prompt: "Your account is temporarily locked due to too many incorrect PIN attempts. Please try again later or contact your administrator. Goodbye."
- TwiML: `<Say>` followed by `<Hangup>`

**If no match found:**
- Prompt: "Your phone number was not recognized. If you have an account, please enter your ten-digit phone number followed by the pound key."
- TwiML: `<Gather input="dtmf" finishOnKey="#" action="[voice-lookup-number URL]" method="POST">`

**If no input received (timeout):**
- Prompt: "We did not receive any input. Goodbye."
- TwiML: `<Say>` followed by `<Hangup>`

### 7.2 Step 2: Manual Phone Number Entry (if caller ID did not match)

**Endpoint:** `voice-lookup-number` Edge Function

**System action:** Take the digits entered, format as E.164 (+1XXXXXXXXXX), and query the users table.

**If match found and account active:**
- Prompt: "Thank you. Please enter your four-digit PIN."
- TwiML: `<Gather input="dtmf" numDigits="4" action="[voice-verify-pin URL]" method="POST">`

**If no match found:**
- Prompt: "No account was found for that number. Please check with your administrator. Goodbye."
- TwiML: `<Say>` followed by `<Hangup>`

### 7.3 Step 3: PIN Verification

**Endpoint:** `voice-verify-pin` Edge Function

**System action:** Compare entered PIN (bcrypt) against stored hash for the identified user. Increment `pin_attempts` on failure; reset to 0 on success.

**If PIN correct:**
- Prompt: "Welcome, [name]. Press 1 to create a new reminder. Press 2 to review your upcoming reminders. Press 3 to hear missed reminders."
- TwiML: `<Gather input="dtmf" numDigits="1" action="[voice-main-menu URL]" method="POST">`

**If PIN incorrect (attempts < 3 in this call):**
- Prompt: "Incorrect PIN. Please try again. Enter your four-digit PIN."
- TwiML: `<Gather input="dtmf" numDigits="4" action="[voice-verify-pin URL]" method="POST">`

**If PIN incorrect (3rd attempt in this call):**
- Prompt: "Too many incorrect attempts. Please try again later or contact your administrator. Goodbye."
- System action: If cumulative `pin_attempts` >= 5, set `locked_until` = NOW() + 30 minutes.
- TwiML: `<Say>` followed by `<Hangup>`

### 7.4 Step 4: Main Menu

**Endpoint:** `voice-main-menu` Edge Function

User presses 1, 2, or 3.

- **Press 1:** Route to Create Reminder flow (Step 5).
- **Press 2:** Route to Review Upcoming Reminders flow (Step 10).
- **Press 3:** Route to Review Missed Reminders flow (Step 11).
- **Invalid input:** "Sorry, that was not a valid option. Press 1 to create a new reminder. Press 2 to review your upcoming reminders. Press 3 to hear missed reminders."

### 7.5 Step 5: Enter Reminder Date/Time

**Endpoint:** `voice-enter-datetime` Edge Function

**Prompt:** "Please enter the date and time for your reminder. Enter the month, then press star, the day, then press star, the four-digit year, then press star, then the time using up to four digits. For example, for May first, twenty twenty-six at five fifteen, enter 5 star 1 star 2026 star 515. Then press pound when finished."

**TwiML:** `<Gather input="dtmf" finishOnKey="#" action="[voice-parse-datetime URL]" method="POST">`

The digits collected will look like: `5*1*2026*515`

The system parses this by splitting on `*` to get: month=5, day=1, year=2026, time=515.

**Time parsing rules:**
- 1–2 digits: treated as hour only (e.g., `5` = 5:00)
- 3 digits: first digit is hour, last two are minutes (e.g., `515` = 5:15)
- 4 digits: first two digits are hour, last two are minutes (e.g., `1030` = 10:30)

### 7.6 Step 6: Enter AM/PM

**Endpoint:** `voice-enter-ampm` Edge Function

**Prompt:** "Press 1 for A.M. or press 2 for P.M."

**TwiML:** `<Gather input="dtmf" numDigits="1" action="[voice-confirm-datetime URL]" method="POST">`

### 7.7 Step 7: Confirm Date/Time

**Endpoint:** `voice-confirm-datetime` Edge Function

**System action:** Validate the parsed date/time. Check that it is a valid calendar date and that it is in the future (relative to the user's timezone).

**If valid:**
- Prompt: "You entered [month name] [day], [year] at [time] [AM/PM]. Press pound to confirm or press star to re-enter."
- TwiML: `<Gather input="dtmf" numDigits="1" finishOnKey="" action="[voice-datetime-confirmed URL]" method="POST">`
- (Note: `finishOnKey=""` means # and * are captured as regular digits. The handler checks if the digit is `#` or `*`.)

**If invalid date:**
- Prompt: "That does not appear to be a valid date. Please try again." Route back to Step 5.

**If date is in the past:**
- Prompt: "That date and time has already passed. Please enter a future date and time." Route back to Step 5.

### 7.8 Step 8: Choose Callback Number

**Endpoint:** `voice-choose-callback` Edge Function

**Prompt:** "Press 1 to receive the reminder on the number you are calling from. Press 2 to enter a different number."

**TwiML:** `<Gather input="dtmf" numDigits="1" action="[voice-callback-selected URL]" method="POST">`

**If press 1:** Use the caller's phone number (or the manually entered number from Step 2) as the callback number. Proceed to Step 9.

**If press 2:** Prompt: "Please enter the ten-digit phone number you would like us to call, followed by the pound key." Gather the number, read it back digit by digit: "The reminder will be sent to [number]. Press pound to confirm or press star to re-enter."

### 7.9 Step 9: Record Reminder Message

**Endpoint:** `voice-record-message` Edge Function

**Prompt:** "Please leave your reminder message after the tone. Press pound when you are finished, or simply hang up."

**TwiML:** `<Record maxLength="120" finishOnKey="#" action="[voice-confirm-reminder URL]" method="POST" playBeep="true">`

Twilio will POST the `RecordingUrl` and `RecordingDuration` to the action URL when the recording completes.

Maximum recording length: 120 seconds (2 minutes). This is configurable.

### 7.10 Step 10: Final Confirmation

**Endpoint:** `voice-confirm-reminder` Edge Function

**Prompt:** "Your reminder is set for [month name] [day], [year] at [time] [AM/PM]. Here is your message:"

[System plays back the recording]

"Press pound to confirm and save this reminder. Press star to start over."

**TwiML:** `<Gather>` wrapping `<Say>` and `<Play url="[RecordingUrl]">`

**If pound pressed:** Save reminder to database with status = `pending`. Prompt: "Your reminder has been saved. You will receive a call at [callback number] on [date] at [time] [AM/PM]. Press 1 to create another reminder, or hang up to end the call. Thank you for using the Reminder Service."

**If star pressed:** Route back to Step 5 (enter date/time). Delete the recording if Twilio recording storage is used, or simply don't store the URL.

### 7.11 Review Upcoming Reminders

**Endpoint:** `voice-review-upcoming` Edge Function

**System action:** Query reminders where `user_id` = authenticated user AND `status` = `pending`, ordered by `scheduled_at` ascending.

**If no reminders:**
- Prompt: "You have no upcoming reminders. Press 1 to create a new reminder, or hang up to end the call."

**If reminders exist:**
- Prompt: "You have [count] upcoming reminders."
- For each reminder, read: "Reminder [N]: [month name] [day], [year] at [time] [AM/PM]. Press [N] to hear this message."
- Limit the IVR to a maximum of 9 reminders per listing (keypad digits 1–9). If the user has more than 9, the system reads the first 9 and says: "Press 0 to hear more reminders."

When the user presses a number to select a reminder:
- Play the recorded message. Then: "Press pound to return to your reminders. Press star and then pound to delete this reminder."

**If star pressed (delete):** "This reminder for [date] at [time] has been cancelled. Press pound to return to your reminders." Set reminder status to `cancelled`.

### 7.12 Review Missed Reminders

**Endpoint:** `voice-review-missed` Edge Function

**System action:** Query reminders where `user_id` = authenticated user AND `status` IN (`missed`, `voicemail`), ordered by `scheduled_at` ascending.

**If no missed reminders:**
- Prompt: "You have no missed reminders. Press 1 to create a new reminder, or hang up to end the call."

**If missed reminders exist:**
- Prompt: "You have [count] missed reminders."
- Same navigation pattern as upcoming reminders. After playing a missed reminder's message:
- "Press pound to mark as heard and return to your reminders. Press star to keep it as unheard."

**If pound pressed:** Set reminder status to `heard`, set `heard_at` = NOW().

**If star pressed:** Leave status unchanged. Return to missed reminders list.

---

## 8. IVR Call Flow — Outbound (Reminder Delivery)

### 8.1 Initiating the Call

The scheduler identifies a due reminder and calls the Twilio REST API to initiate an outbound call:

```
POST /2010-04-01/Accounts/{AccountSid}/Calls
To: {reminder.callback_number}
From: {twilio_phone_number}
Url: [voice-outbound-greeting Edge Function URL]?reminder_id={reminder.id}
StatusCallback: [voice-outbound-status Edge Function URL]?reminder_id={reminder.id}
StatusCallbackEvent: initiated ringing answered completed
Timeout: 30
```

Before initiating the call, set reminder status to `in_progress` and increment `delivery_attempts`.

### 8.2 Call Answered — Human vs. Voicemail Detection

**Endpoint:** `voice-outbound-greeting` Edge Function

**Prompt:** "This is the Reminder Service. Press any key to hear your message."

**TwiML:** `<Gather input="dtmf" numDigits="1" timeout="10" action="[voice-outbound-play-message URL]" method="POST">`

**If keypress received within 10 seconds (human):**
- Route to `voice-outbound-play-message`. Set `delivery_method` = `human`.

**If no keypress within 10 seconds (voicemail assumed):**
- TwiML falls through to nested content after `<Gather>`:
- `<Pause length="3"/>` (wait for voicemail beep)
- `<Say>` "This is a reminder for [user name]."
- `<Play url="[RecordingUrl]"/>`
- `<Say>` "This message was sent by the Reminder Service. Goodbye."
- `<Hangup/>`
- Set `delivery_method` = `voicemail`. Set status = `voicemail`.

### 8.3 Playing the Message (Human Path)

**Endpoint:** `voice-outbound-play-message` Edge Function

**Prompt:** "Here is your reminder:"

[Play the recorded message]

"Press 1 to repeat this message. Press 2 to hear the message one more time and then end the call. Or simply hang up when finished."

**TwiML:** `<Gather>` wrapping `<Say>` and `<Play>`

**If press 1:** Replay the message. Return to same prompt.
**If press 2:** Replay the message one final time, then `<Hangup>`.
**If no input or hangup:** Call ends.

After this step, set status = `delivered` and `delivered_at` = NOW().

### 8.4 Call Status Callback

**Endpoint:** `voice-outbound-status` Edge Function

Twilio sends status updates for every call. The handler should process:

- **completed:** Call was answered (human or voicemail path already handled status).
- **no-answer:** Phone rang but nobody picked up. Queue for retry.
- **busy:** Line was busy. Queue for retry.
- **failed:** Call could not be placed (invalid number, carrier issue). Log error with Twilio error code and message. Queue for retry.
- **canceled:** Call was canceled before connection. Queue for retry.

For all non-completed statuses, set `last_attempt_at` = NOW() and calculate `next_retry_at` based on the user's `retry_interval_minutes`. If `delivery_attempts` >= the user's `retry_max_attempts`, set status = `missed`.

Log every status callback to the `call_log` table with the `error_message` field populated for failed calls.

---

## 9. Retry & Missed Reminder Logic

### 9.1 Retry Policy

Each user has configurable retry settings (`retry_max_attempts` and `retry_interval_minutes`). Defaults are 3 attempts and 15 minutes between attempts.

The retry flow is:

1. First attempt: at the `scheduled_at` time.
2. If call fails (no answer, busy, failed): set `next_retry_at` = NOW() + `retry_interval_minutes`.
3. Scheduler picks up the reminder again when `next_retry_at` <= NOW() and status is still `pending`.
4. Repeat until `delivery_attempts` >= `retry_max_attempts`.
5. After final failed attempt: set status = `missed`.

### 9.2 Scheduler Processing Logic

The pg_cron job runs every 60 seconds. It calls a PostgreSQL function that:

1. Queries for due reminders:

```sql
SELECT r.*, u.retry_max_attempts, u.retry_interval_minutes
FROM reminders r
JOIN users u ON r.user_id = u.id
WHERE r.status = 'pending'
  AND (r.scheduled_at <= NOW() OR r.next_retry_at <= NOW())
  AND r.delivery_attempts < u.retry_max_attempts
  AND u.status = 'active'
ORDER BY r.scheduled_at ASC
LIMIT 10;
```

2. For each reminder, calls the `voice-process-due-reminders` Edge Function via pg_net with the reminder IDs.
3. Logs the execution to `scheduler_log` (reminders found, processed, failed, duration).

The LIMIT 10 prevents the scheduler from overwhelming Twilio with simultaneous calls. If more than 10 reminders are due, they will be picked up on the next scheduler run (60 seconds later). This is a configurable concurrency limit.

### 9.3 Repeating Reminders

Repeating reminders are configured only through the Admin UI (not via IVR). The following repeat types are supported:

- **Daily:** Fires every X days. X is stored in `repeat_interval_days`. Range: 1–365.
- **Weekly:** Fires on selected days of the week. Selected days stored as an integer array in `repeat_days_of_week` (0=Sunday, 6=Saturday). Multiple days allowed (e.g., [1,3,5] = Mon/Wed/Fri).
- **Monthly — specific date:** Fires on a specific day of the month. Day stored in `repeat_day_of_month`. Range: 1–28 only (avoids February and short-month edge cases).
- **Monthly — day pattern:** Fires on a specific week/day combination each month (e.g., "First Monday"). Week stored in `repeat_week_of_month` (1–4), day stored in `repeat_day_of_week` (0–6).

All repeat types support an optional `repeat_end_date`. When NULL the series repeats indefinitely.

When a repeating reminder is delivered or reaches final status, the system calculates the next occurrence based on `repeat_type` and creates a new reminder record with `parent_reminder_id` pointing to the original. The new reminder inherits `callback_number`, `recording_url`, and all repeat configuration from the parent.

**Next occurrence calculation rules:**
- Daily: `scheduled_at + repeat_interval_days days`
- Weekly: next occurrence of any day in `repeat_days_of_week` after current `scheduled_at`
- Monthly date: same `repeat_day_of_month` in the next month
- Monthly day pattern: calculate the Nth weekday of the next month using `repeat_week_of_month` and `repeat_day_of_week`

---

## 10. Admin UI Specification

### 10.1 Authentication

Supabase Auth handles admin login with email/password. Admin users are created directly in Supabase Auth (or via an initial seed script). The React app uses `supabase.auth.signInWithPassword()` and checks for an active session on every protected route. RLS policies ensure only authenticated users can access any data.

### 10.2 Dashboard

The dashboard provides an at-a-glance view of system health:

- Total active users
- Reminders due today
- Reminders delivered today (count and percentage)
- Missed reminders today
- Failed calls (last 24 hours)
- Upcoming reminders (next 24 hours)
- Scheduler health indicator (green/yellow/red based on `check_scheduler_health()`)

### 10.3 User Management

**User List View:**
- Sortable, searchable table of all users
- Columns: Name, Primary Phone, Secondary Phone, Status, Active Reminders (count), Last Call-In (timestamp)
- Bulk actions: suspend, activate, disable

**User Detail / Edit View:**
- All fields described in Section 6.2 (name, primary phone, secondary phone, timezone, retry settings, notes)
- PIN reset button (calls Edge Function, generates new random PIN, shows it once to admin for communication to user — display in a modal with a "copy" button and a warning that it won't be shown again)
- Account status toggle (active/suspended/disabled)
- Manual unlock button (clears `locked_until` and resets `pin_attempts`)
- Call history for this user (from `call_log` table)
- All reminders for this user (filterable by status)

### 10.4 Reminder Management

**All Reminders View:**
- Filterable by: status, user, date range, source (IVR/Admin)
- Sortable by: scheduled date, created date, status
- Columns: User Name, Scheduled Date/Time, Callback Number, Status, Delivery Method, Attempts, Source (IVR/Admin)

**Create Reminder (Admin):**
- Select user from dropdown
- Enter date and time (date picker + time picker)
- Select callback number (user's primary, secondary, or enter custom number)
- Upload or record audio message (admin can upload an audio file or record via browser microphone using the MediaRecorder API)
- Toggle repeating: if enabled, enter repeat interval (days) and optional end date
- Source is automatically set to `admin`

**Edit Reminder (Admin):**

The admin can fully edit any reminder with status = `pending`. This handles the case where a user calls in and asks the admin to change their reminder. Editable fields:

- **Scheduled date/time:** Change when the reminder fires. The new date/time must be in the future.
- **Callback number:** Change which number gets called. Dropdown of user's primary/secondary or enter a custom number.
- **Recording:** Replace the voice message. Admin can upload a new audio file or record via browser microphone. The old Twilio recording URL is replaced with the new one.
- **Repeating settings:** Toggle repeating on/off. Change interval or end date.

Non-editable fields on a pending reminder: user (cannot reassign), source, status (use cancel instead), delivery history.

Reminders with status other than `pending` are read-only. The admin can view all details including delivery history, attempts, and timestamps, but cannot modify them.

**Cancel Reminder:**
- Admin can cancel any `pending` reminder. Sets status to `cancelled`.
- Confirmation dialog: "Are you sure you want to cancel the reminder for [user] scheduled for [date/time]?"

**Re-create from Existing:**
- On any delivered, missed, or cancelled reminder, provide a "Create Similar" button that pre-fills a new reminder form with the same user, callback number, and recording. The admin only needs to set a new date/time. This is useful when a user calls and says "I need that same reminder again for next Tuesday."

### 10.5 Reporting & Diagnostics

This section is critical for operational visibility. When something goes wrong — calls aren't being delivered, the scheduler stalls, a user's number stops working — the admin needs to find and fix the problem without digging through raw database queries.

#### 10.5.1 Delivery Report

A date-range filterable report showing:

- **Total reminders due** in the period
- **Delivery rate:** percentage delivered (human + voicemail) vs total due
- **Breakdown by delivery method:** human answered vs voicemail vs missed
- **Average delivery attempts** before successful delivery
- **Average delivery latency:** minutes between `scheduled_at` and `delivered_at` (indicates whether the scheduler is keeping up)
- **Chart:** daily delivery rate over time (line chart, success rate percentage on Y axis)
- **Chart:** daily volume (bar chart, reminders due vs delivered vs missed)

Filterable by user or all users.

#### 10.5.2 Failure Report

A date-range filterable report showing:

- **Failed calls** grouped by failure reason (no-answer, busy, failed/carrier error)
- **Top failing users** — users with the highest missed reminder rate (may indicate a bad phone number, disconnected line, or user who is simply never near the phone)
- **Top failing phone numbers** — callback numbers with the highest failure rate (may indicate a number that is no longer valid)
- **Carrier errors** — calls with Twilio error codes, grouped by error code with descriptions
- **Retry exhaustion** — reminders that used all retry attempts without delivery, with timeline of each attempt

Each row in the failure report should be clickable to drill into the specific call log entries and reminder details.

#### 10.5.3 Scheduler Health Monitor

A real-time (or near-real-time, refreshing every 60 seconds) display showing:

- **Last scheduler run:** timestamp and "X seconds ago" relative display
- **Status indicator:** Green (last run < 2 minutes ago), Yellow (2–5 minutes ago), Red (> 5 minutes ago or last run had errors)
- **Last 24 hours:** chart showing scheduler executions over time with reminders processed per run
- **Gaps:** any gaps > 5 minutes between consecutive scheduler runs, highlighted in red
- **Error log:** last 10 scheduler errors (from `scheduler_log` where `error_message` is not null)
- **Queue depth:** number of reminders currently in `pending` status with `scheduled_at` in the past (backlog indicator)

#### 10.5.4 Call Log Viewer

A searchable, filterable view of the `call_log` table:

- Filterable by: user, direction (inbound/outbound), call status, date range, outcome
- Sortable by: date, duration
- Columns: Date/Time, User, Direction, From → To, Status, Duration, Outcome, Error
- Click into any row for full details including Twilio Call SID (linkable to Twilio console)

#### 10.5.5 User Activity Report

Per-user report showing:

- Total reminders created (IVR vs admin)
- Total reminders delivered / missed / cancelled
- Delivery success rate
- Average reminders per month
- Last call-in date
- Last reminder delivered date
- Call-in frequency (calls per week/month)

### 10.6 System Settings

- Twilio phone number display (read-only, configured in environment)
- Default timezone for new users
- Default retry settings for new users
- Maximum recording length (seconds)
- Concurrent outbound call limit (scheduler batch size)
- Account lockout threshold and duration

---

## 11. Technology Stack

| Component | Technology | Notes |
|-----------|-----------|-------|
| Telephony | Twilio Programmable Voice | Handles all inbound/outbound calls, DTMF, recording |
| Backend Runtime | Supabase Edge Functions (Deno) | Serverless functions for Twilio webhooks |
| Database | Supabase (PostgreSQL 15+) | Managed PostgreSQL with built-in auth, RLS, pg_cron |
| Data Access | Supabase JS Client | Direct database access with Row Level Security |
| Scheduler | pg_cron + pg_net (Supabase extensions) | pg_cron runs every 60s, pg_net calls Edge Function to trigger outbound calls |
| Audio Storage | Twilio Recording Storage | Twilio stores recordings by default; migrate to Supabase Storage only if needed |
| Admin UI Framework | React 18+ with TypeScript | Vite for build tooling |
| Admin UI Styling | Tailwind CSS | Consistent with existing Burkholder projects |
| Admin Authentication | Supabase Auth (email/password) | Built-in auth with JWT, RLS policies for access control |
| Admin UI Hosting | Netlify | Static site deployment from GitHub |
| Code Repository | GitHub | Source control and CI/CD trigger |
| CI/CD | Netlify Build / GitHub integration | Auto-deploy admin UI on push; Supabase CLI for Edge Function deploys |
| Environment Config | Supabase Secrets (Edge Functions) / Netlify env vars | Twilio credentials, Supabase keys |

---

## 12. Frontend Architecture & Constraints

This section is the authoritative specification for all frontend development. Do not add libraries, patterns, abstractions, or features not listed here. When in doubt, do less and ask.

### 12.1 Brand & Design System

Product name: **RingMinder**
Tagline: *It actually calls you back.*
**Theme:** Light with dark navy sidebar

Color palette — use these exact hex values, no deviations:

```
--color-background:      #F4F6F9   (page background)
--color-surface:         #FFFFFF   (cards, panels, modals)
--color-border:          #E2E6EC   (borders, dividers)
--color-sidebar-bg:      #152438   (sidebar background)
--color-sidebar-text:    #8899AA   (inactive nav items)
--color-sidebar-active:  #4ECDC4   (active nav item accent)
--color-primary:         #4ECDC4   (buttons, active states, brand accent)
--color-primary-fg:      #1A2B42   (text on primary backgrounds)
--color-text:            #1A2B42   (primary text)
--color-text-muted:      #6B7A90   (secondary text, labels, placeholders)
--color-destructive:     #E05555   (delete, cancel, error states)
--color-success:         #3DBE6E   (delivered status, confirmations)
--color-warning:         #E8A838   (voicemail status, retrying states)
```

Typography:

- Font family: **Inter** (loaded via Fontsource: `@fontsource/inter`)
- No other fonts. Do not use system fonts, Geist, or any other typeface.

Status badge color mapping — use consistently across all views:

| Status | Color |
|--------|-------|
| pending | --color-text-muted |
| in_progress | --color-primary |
| delivered | --color-success |
| voicemail | --color-warning |
| missed | --color-destructive |
| heard | --color-text-muted |
| cancelled | --color-text-muted |
| expired | --color-destructive |

### 12.2 Technology Stack — Frontend

| Concern | Library | Version |
|---------|---------|---------|
| Framework | React | 18 |
| Language | TypeScript | 5+ (strict mode on) |
| Build tool | Vite | Latest stable |
| Styling | Tailwind CSS | 3 |
| Component library | shadcn/ui | Latest (copied into repo, not imported as package) |
| Routing | React Router | v6 |
| Forms | React Hook Form | Latest |
| Validation | Zod | Latest |
| Data fetching | TanStack Query (React Query) | v5 |
| Charts | Recharts | Latest |
| Supabase client | @supabase/supabase-js | v2 |
| Supabase types | Generated via `supabase gen types typescript` | Regenerate after any schema change |

No other libraries may be added without explicit instruction. If a need arises that seems to require a new library, stop and ask.

### 12.3 Project Structure

The following structure is mandatory. Do not create folders or files outside this structure without explicit instruction.

```
src/
  components/
    ui/           ← shadcn/ui components only. Never modify these directly.
    shared/       ← Reusable app-level components (StatusBadge, PageHeader, ConfirmDialog, etc.)
  pages/          ← One file per route. Named to match the route (e.g., UsersPage.tsx, RemindersPage.tsx)
  hooks/          ← Custom hooks only. One concern per hook. Named useXxx.ts.
  lib/
    supabase.ts   ← Supabase client initialization. Nothing else.
    utils.ts      ← General utility functions (formatPhone, formatDateTime, etc.)
    validations.ts← Zod schemas
  types/
    database.ts   ← Generated Supabase types (do not hand-edit)
    index.ts      ← Any additional custom TypeScript types
```

### 12.4 Data Fetching Rules

- Every Supabase query lives in a custom hook in `src/hooks/`. Never query Supabase directly inside a component.
- All hooks use TanStack Query (`useQuery`, `useMutation`). No raw `useEffect` data fetching.
- Hook naming convention: `useUsers`, `useReminders`, `useCallLog`, `useSchedulerHealth`, etc.
- Mutations must invalidate the relevant query on success so the UI stays in sync.

Example pattern (follow exactly):

```typescript
// src/hooks/useUsers.ts
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('*').order('name');
      if (error) throw error;
      return data;
    }
  });
}
```

### 12.5 Component Rules

- shadcn/ui components live in `src/components/ui/` and are never modified directly.
- App-level shared components live in `src/components/shared/`.
- Page components live in `src/pages/` and are responsible for layout and data hookup only — no inline business logic.
- No inline styles. No `style={{}}` props anywhere. Use Tailwind classes only.
- No magic numbers in `className` strings. If a value needs explanation, extract it to a variable or comment.
- All components are typed with explicit TypeScript interfaces. No `any`.

### 12.6 Forms

- All forms use React Hook Form with a Zod resolver.
- Validation schemas are defined in `src/lib/validations.ts`, not inline in components.
- Form submission errors from Supabase are displayed inline below the relevant field, not in a toast.
- Non-field errors (e.g., network failure) display in a shadcn `Alert` component at the top of the form.

### 12.7 Routing Structure

```
/                     → redirect to /dashboard
/login                → LoginPage
/dashboard            → DashboardPage
/users                → UsersPage (list)
/users/:id            → UserDetailPage (view + edit)
/users/new            → UserNewPage (create)
/reminders            → RemindersPage (list, all users)
/reminders/:id        → ReminderDetailPage (view + edit)
/call-log             → CallLogPage
/reports              → ReportsPage (delivery, failure, user activity)
/reports/scheduler    → SchedulerHealthPage
/settings             → SettingsPage
```

All routes except `/login` require an authenticated Supabase session. Unauthenticated users are redirected to `/login`.

### 12.8 Naming Conventions

- **Files:** PascalCase for components and pages (`UserDetailPage.tsx`), camelCase for hooks and utilities (`useUsers.ts`, `formatPhone.ts`)
- **Variables and functions:** camelCase
- **Types and interfaces:** PascalCase, prefixed with nothing (no `IUser`, no `TUser` — just `User`)
- **Database types:** use the generated Supabase types directly, aliased if needed for clarity
- **Constants:** SCREAMING_SNAKE_CASE

### 12.9 Code Quality

- TypeScript strict mode is on. No `any`, no `@ts-ignore`.
- ESLint and Prettier are configured at project init and run on every file.
- No commented-out code committed to the repo.
- No `console.log` left in committed code. Use a comment `// TODO:` if something needs follow-up.
- Every page and shared component gets a single-line comment at the top describing what it does.

### 12.10 What Claude Code Must Not Do

- Do not install libraries not listed in Section 12.2.
- Do not create files or folders outside the structure in Section 12.3.
- Do not add features, pages, or components not described in this document.
- Do not use `any` in TypeScript.
- Do not fetch data directly in components — all queries go through hooks.
- Do not modify files in `src/components/ui/` — these are shadcn originals.
- Do not make visual design decisions not covered by the design system in Section 12.1. If something is not specified, ask before building.
- Do not refactor working code while building a feature. Surgical changes only.

---

## 13. Twilio Configuration

### 13.1 Account Setup

1. Create a Twilio account (or use existing Burkholder account).
2. Purchase a local phone number in the appropriate area code. Consider a toll-free number (1-800/1-888) for user convenience — the cost difference is minimal and eliminates long-distance charges for callers.
3. Configure the phone number's Voice webhook to point to the Supabase Edge Function: `https://[project-ref].supabase.co/functions/v1/voice-inbound` (HTTP POST).
4. Configure the Status Callback URL: `https://[project-ref].supabase.co/functions/v1/voice-outbound-status` (HTTP POST).
5. Note the Account SID, Auth Token, and Phone Number SID for environment configuration.

### 13.2 Environment Variables

```
# Twilio (set as Supabase Edge Function secrets via: supabase secrets set)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+18005551234
TWILIO_PHONE_NUMBER_SID=PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Supabase (set as Netlify env vars for admin UI)
VITE_SUPABASE_URL=https://[project-ref].supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxxxxxxxxxxxxxxxxxxxxxxxx

# Supabase (available automatically in Edge Functions)
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 13.3 Webhook Security

All Twilio webhook Edge Functions must validate the `X-Twilio-Signature` header to ensure requests originate from Twilio. In Supabase Edge Functions (Deno runtime), use the Twilio helper library or implement the HMAC-SHA1 signature validation manually. Reject any webhook request that fails signature validation.

---

## 14. API Endpoints

### 14.1 Twilio Webhook Endpoints (Supabase Edge Functions)

Each webhook endpoint is implemented as a Supabase Edge Function. The function name maps to the path. All functions receive Twilio POST data and return TwiML XML. Edge Functions are deployed via the Supabase CLI (`supabase functions deploy [function-name]`).

| Method | Path (Edge Function) | Purpose |
|--------|---------------------|---------|
| POST | voice-inbound | Initial call handler — caller ID check and routing |
| POST | voice-lookup-number | Manual phone number entry and lookup |
| POST | voice-verify-pin | PIN verification |
| POST | voice-main-menu | Main menu routing (create/review/missed) |
| POST | voice-enter-datetime | Date/time entry prompt |
| POST | voice-parse-datetime | Parse DTMF date/time input |
| POST | voice-enter-ampm | AM/PM selection |
| POST | voice-confirm-datetime | Read back and confirm date/time |
| POST | voice-datetime-confirmed | Handle confirm/re-enter response |
| POST | voice-choose-callback | Callback number selection |
| POST | voice-callback-selected | Handle callback number choice |
| POST | voice-record-message | Record voice message |
| POST | voice-confirm-reminder | Final confirmation with playback |
| POST | voice-review-upcoming | List and navigate upcoming reminders |
| POST | voice-review-missed | List and navigate missed reminders |
| POST | voice-outbound-greeting | Outbound call greeting and human detection |
| POST | voice-outbound-play-message | Play reminder message to human |
| POST | voice-outbound-status | Call status callback handler |
| POST | voice-process-due-reminders | Called by pg_cron via pg_net to process due reminders |
| POST | admin-reset-pin | Generate new PIN, hash, update user, return plaintext once |
| POST | admin-upload-audio | Handle audio file upload for admin-created reminders |

### 14.2 Admin UI Data Access (Supabase Direct)

The Admin UI does not use a custom REST API. Instead, it communicates directly with the Supabase PostgreSQL database using the Supabase JS client (`@supabase/supabase-js`). Authentication is handled by Supabase Auth (email/password). Row Level Security (RLS) policies enforce that only authenticated admin users can read and write data.

The Admin UI performs the following operations directly via Supabase client:

- **Auth:** `supabase.auth.signInWithPassword()`, `supabase.auth.signOut()`, `supabase.auth.getSession()`
- **Users:** `supabase.from('users').select()` / `.insert()` / `.update()` / `.delete()`
- **Reminders:** `supabase.from('reminders').select()` / `.insert()` / `.update()` / `.delete()`
- **Call Log:** `supabase.from('call_log').select()` with filters and pagination
- **Scheduler Log:** `supabase.from('scheduler_log').select()` with filters
- **Dashboard:** `supabase.rpc('get_dashboard_stats')` — a PostgreSQL function that returns aggregated counts
- **Delivery Report:** `supabase.rpc('get_delivery_report', { start_date, end_date })`
- **Failure Report:** `supabase.rpc('get_failure_report', { start_date, end_date })`
- **Scheduler Health:** `supabase.rpc('check_scheduler_health')`

Two operations require Edge Functions because they involve server-side logic beyond simple CRUD:

- **PIN Reset:** An Edge Function generates a random 4-digit PIN, hashes it with bcrypt, updates the user record, and returns the plaintext PIN once to the admin.
- **Admin-Created Reminder with Audio:** If the admin uploads an audio file, an Edge Function handles the upload to Supabase Storage and stores the resulting URL.

---

## 15. Security Considerations

- **PIN Storage:** All user PINs are stored as bcrypt hashes (cost factor 10) using pgcrypto extension in Supabase. Plaintext PINs are never stored or logged.
- **Webhook Validation:** All Twilio webhook Edge Functions validate `X-Twilio-Signature` using HMAC-SHA1. Unsigned or invalid requests are rejected with 403.
- **Admin Authentication:** Supabase Auth handles admin login with email/password. JWTs are issued automatically. Row Level Security (RLS) policies enforce that only authenticated users with admin role can access data.
- **Rate Limiting:** Supabase Auth has built-in rate limiting for login attempts. Additional rate limiting can be added via Supabase Edge Function middleware if needed.
- **HTTPS:** All communication between Twilio and Supabase Edge Functions is over HTTPS. Netlify serves the Admin UI over HTTPS. Supabase endpoints are HTTPS by default.
- **Credentials Management:** Twilio credentials are stored as Supabase Edge Function secrets (`supabase secrets set`). Supabase keys for the Admin UI are stored as Netlify environment variables. No credentials in source code.
- **Audio Recording Access:** Twilio recording URLs require Twilio account credentials to access, providing implicit access control. If migrated to Supabase Storage, files are stored in a private bucket with RLS policies and pre-signed URLs for playback.
- **Account Lockout:** Automatic lockout after 5 failed PIN attempts (configurable). Admin can manually unlock via the Admin UI.
- **Input Validation:** All DTMF input is validated server-side in Edge Functions. Phone numbers are validated as 10-digit US numbers and stored in E.164 format. Dates are validated as real calendar dates in the future.
- **Row Level Security:** All database tables have RLS policies enabled. Edge Functions use the `service_role` key (server-side only). The Admin UI uses the `anon` key, and RLS policies ensure only authenticated admin users can access data.
- **No PII in Logs:** Edge Function logs do not store message content or PINs. Phone numbers in logs are acceptable for operational purposes but should be considered sensitive.

---

## 16. Cost Projections

### 16.1 Twilio Costs

| Item | Unit Cost | Notes |
|------|-----------|-------|
| Phone Number (local) | $1.15/month | One number needed; toll-free is $2.15/month |
| Inbound Voice | $0.0085/min | Per-minute rate for incoming calls |
| Outbound Voice | $0.014/min | Per-minute rate for outgoing reminder calls |
| Recording Storage | $0.0005/min stored | Per minute of stored recording per month |
| Speech-to-Text | Not applicable | System uses DTMF only, no speech recognition needed |

### 16.2 Per-Reminder Cost Estimate

A typical reminder lifecycle involves one inbound call (approximately 2 minutes to authenticate, enter date/time, and record message) and one outbound call (approximately 1 minute for greeting plus message playback). Estimated cost per reminder: $0.031 ($0.017 inbound + $0.014 outbound).

### 16.3 Monthly Cost Scenarios

| Scenario | Users | Reminders/Month | Twilio Cost | Supabase/Netlify | Total |
|----------|-------|-----------------|-------------|-----------------|-------|
| Pilot | 10 | 50 | ~$3 | $0 (free tiers) | ~$3 |
| Small | 25 | 200 | ~$8 | $0 (free tiers) | ~$8 |
| Medium | 100 | 1,000 | ~$33 | $25 (Supabase Pro) | ~$58 |
| Large | 500 | 5,000 | ~$157 | $25 (Supabase Pro) | ~$182 |

Supabase Free tier includes 500MB database, 1GB storage, 500K Edge Function invocations, and 50K monthly active users. This comfortably covers the Pilot and Small scenarios. Supabase Pro ($25/month) adds 8GB database, 100GB storage, 2M Edge Function invocations, and removes the monthly active user cap. Netlify Free tier includes 100GB bandwidth and 300 build minutes per month, which is more than sufficient for the Admin UI. The primary ongoing cost is Twilio voice minutes.

---

## 17. Development Phases

### Phase 1: Foundation (Week 1–2)

- Supabase project creation and configuration (enable pg_cron, pg_net, pgcrypto extensions)
- Database schema creation via Supabase SQL editor or migrations
- Row Level Security (RLS) policies for all tables
- Supabase Auth setup for admin users
- Twilio account setup and phone number provisioning
- First Edge Function: `voice-inbound` — answer call, check caller ID, gather PIN, authenticate
- First outbound test: manually trigger an Edge Function that calls Twilio API to place a call and play a test recording
- GitHub repository setup; Netlify site connected to repo
- Supabase CLI installed and configured for Edge Function deployment

### Phase 2: Core IVR Flow (Week 3–4)

- Complete inbound IVR Edge Functions: date/time entry, AM/PM, confirmation, callback number selection, message recording, final confirmation
- Reminder storage in Supabase database
- pg_cron job: runs every 60 seconds, calls Edge Function via pg_net to process due reminders — **DONE** (migration 007_pg_cron_scheduler.sql; job name `process-due-reminders`, schedule `* * * * *`; scheduler_secret stored in settings table)
- Outbound call Edge Function with human/voicemail detection
- Retry logic on failed delivery
- Status tracking through full lifecycle
- Scheduler log table and logging

### Phase 3: Review & Missed Reminders (Week 5)

- Review upcoming reminders IVR flow
- Review missed reminders IVR flow with mark-as-heard functionality
- Delete/cancel reminder via IVR
- Call logging to `call_log` table with error details

### Phase 4: Admin UI (Week 6–7)

- React/TypeScript/Vite project scaffolding with Tailwind CSS
- Supabase Auth integration (login, session management, protected routes)
- Dashboard with summary stats (Supabase RPC function for aggregations)
- User CRUD (create, read, update, status changes) via Supabase JS client
- PIN reset Edge Function
- Reminder management (list, filter, create admin reminders, cancel)
- Full reminder editing (reschedule, change callback, re-record/upload audio)
- "Create Similar" button for re-creating past reminders
- Repeating reminder configuration
- Call log viewer
- System settings management
- Deploy to Netlify

### Phase 5: Reporting & Diagnostics (Week 8)

- Delivery report with date-range filtering and charts
- Failure report with drill-down into specific calls
- Scheduler health monitor with real-time status
- User activity report
- Database functions: `get_dashboard_stats()`, `get_delivery_report()`, `get_failure_report()`, `check_scheduler_health()`, `cleanup_expired_reminders()`

### Phase 6: Polish & Deploy (Week 9)

- End-to-end testing with real phone calls
- IVR prompt refinement based on test calls
- Error handling hardening across all Edge Functions
- Production Supabase project setup (if using separate dev/prod)
- Final Netlify deployment configuration and custom domain
- Twilio production phone number configuration pointing to production Edge Functions
- Monitoring: Supabase dashboard for database and Edge Function logs; Twilio console for call logs
- Documentation

---

## 18. Testing Plan

### 18.1 Unit Tests

- Date/time parsing from DTMF input (all valid formats, edge cases, invalid inputs)
- Phone number validation and E.164 formatting
- PIN hashing and verification
- Scheduler query logic
- Retry policy calculations
- Repeating reminder next-occurrence generation
- Scheduling a reminder across a DST boundary (e.g., November first at 2:00 AM in America/New_York) — verify the correct UTC offset is applied and the callback fires at the intended local time

### 18.2 Integration Tests

- Twilio webhook signature validation (valid and invalid signatures)
- Complete inbound call flow with mocked Twilio requests to Edge Functions
- Complete outbound call flow with mocked Twilio API
- Supabase database operations for all CRUD paths
- Supabase Auth and RLS policy verification
- pg_cron scheduler firing and Edge Function invocation via pg_net

### 18.3 End-to-End Tests (Manual)

- Call in from a known number → authenticate → create reminder → receive callback
- Call in from an unknown number → enter phone number manually → authenticate
- Enter invalid date → system rejects and re-prompts
- Enter past date → system rejects and re-prompts
- Create reminder, then call back to review upcoming reminders
- Miss a reminder call → verify retry attempts → call in to hear missed reminder
- Test voicemail path (let call go to voicemail)
- Test wrong PIN → lockout after threshold
- Test suspended and disabled account behavior
- Test admin UI: create user, reset PIN, create reminder, cancel reminder
- Test admin UI: edit a pending reminder (change date, change callback number, re-record message)
- Test admin UI: "Create Similar" from a delivered reminder
- Test repeating reminder: verify next occurrence is auto-created after delivery
- Test reporting: verify delivery report numbers match actual call outcomes
- Test scheduler health monitor: stop pg_cron, verify red indicator, restart, verify recovery
- Schedule a reminder from a timezone that is currently observing DST for a date after the DST transition — verify delivery at the correct local time

### 18.4 Load Testing

Not required for initial launch given the expected user base (10–50 users). Revisit if scaling beyond 500 users or 5,000 reminders per month.

---

## 19. Open Questions & Future Enhancements

### 19.1 Open Questions

1. **Product Name:** What should this service be called? Needs a name for the IVR greeting, admin UI branding, and marketing. Working title: "Reminder Call Service."
2. **Toll-Free vs. Local Number:** A toll-free number (1-800/1-888) eliminates long-distance charges for callers but costs slightly more ($2.15 vs $1.15/month). Given the target market (Amish users on landlines), toll-free is likely worth it.
3. **Recording Retention:** How long should recorded voice messages be retained after delivery? Options: indefinite, 90 days, 30 days after delivery. Storage cost is minimal but there may be privacy considerations.
4. **Multi-Tenant:** Is this a single-operator system (Burkholder Management only) or should it support multiple operators/organizations, each with their own users? Start single-tenant, architect for future multi-tenant.
5. **Billing Model:** How will users be charged? Monthly subscription per user? Per-reminder fee? Bundled with RTO management services? Not a technical question but affects admin UI design (billing/invoice features).
6. **Maximum Reminders Per User:** Should there be a cap on how many active reminders a single user can have? Suggested default: 25.

### 19.2 Future Enhancements (Not in V1)

- SMS confirmation after reminder creation (for users with text-capable phones)
- Multi-language IVR support (e.g., Pennsylvania Dutch greeting option)
- User self-service PIN change via IVR
- Reminder categories or labels
- Send reminder to a different person's number ("remind my driver to pick me up")
- Web portal for users who do have internet access (supplements but does not replace IVR)
- Mobile app companion
- Integration with OWNLY RTO Software (automated payment reminders, delivery scheduling)
- Batch reminder creation via CSV upload in admin UI
- Usage analytics and reporting
- Alerting: email/SMS notifications to admin when failure rates exceed threshold or scheduler stalls
