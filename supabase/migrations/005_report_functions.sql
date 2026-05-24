-- Delivery report function
CREATE OR REPLACE FUNCTION public.get_delivery_report(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_due',
    (SELECT COUNT(*) FROM public.reminders
     WHERE scheduled_at BETWEEN start_date AND end_date),

    'total_delivered',
    (SELECT COUNT(*) FROM public.reminders
     WHERE status = 'delivered'
     AND scheduled_at BETWEEN start_date AND end_date),

    'total_voicemail',
    (SELECT COUNT(*) FROM public.reminders
     WHERE status = 'voicemail'
     AND scheduled_at BETWEEN start_date AND end_date),

    'total_missed',
    (SELECT COUNT(*) FROM public.reminders
     WHERE status = 'missed'
     AND scheduled_at BETWEEN start_date AND end_date),

    'avg_attempts',
    (SELECT ROUND(AVG(delivery_attempts), 2) FROM public.reminders
     WHERE status IN ('delivered', 'voicemail')
     AND scheduled_at BETWEEN start_date AND end_date),

    'avg_latency_minutes',
    (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (delivered_at - scheduled_at)) / 60), 2)
     FROM public.reminders
     WHERE status = 'delivered'
     AND delivered_at IS NOT NULL
     AND scheduled_at BETWEEN start_date AND end_date),

    'daily_breakdown',
    (SELECT json_agg(day_data ORDER BY day)
     FROM (
       SELECT
         DATE(scheduled_at AT TIME ZONE 'America/New_York') AS day,
         COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
         COUNT(*) FILTER (WHERE status = 'voicemail') AS voicemail,
         COUNT(*) FILTER (WHERE status = 'missed') AS missed,
         COUNT(*) AS total
       FROM public.reminders
       WHERE scheduled_at BETWEEN start_date AND end_date
       GROUP BY DATE(scheduled_at AT TIME ZONE 'America/New_York')
     ) day_data),

    'top_users',
    (SELECT json_agg(user_data ORDER BY total DESC)
     FROM (
       SELECT
         u.name,
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE r.status = 'delivered') AS delivered,
         COUNT(*) FILTER (WHERE r.status = 'missed') AS missed
       FROM public.reminders r
       JOIN public.users u ON r.user_id = u.id
       WHERE r.scheduled_at BETWEEN start_date AND end_date
       GROUP BY u.name
       ORDER BY total DESC
       LIMIT 10
     ) user_data)
  ) INTO result;

  RETURN result;
END;
$$;

-- Failure report function
CREATE OR REPLACE FUNCTION public.get_failure_report(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'by_status',
    (SELECT json_agg(s)
     FROM (
       SELECT call_status, COUNT(*) AS count
       FROM public.call_log
       WHERE call_status IN ('no-answer', 'busy', 'failed')
       AND created_at BETWEEN start_date AND end_date
       GROUP BY call_status
       ORDER BY count DESC
     ) s),

    'top_failing_users',
    (SELECT json_agg(u)
     FROM (
       SELECT
         us.name,
         COUNT(*) AS failed_calls
       FROM public.call_log cl
       JOIN public.users us ON cl.user_id = us.id
       WHERE cl.call_status IN ('no-answer', 'busy', 'failed')
       AND cl.created_at BETWEEN start_date AND end_date
       GROUP BY us.name
       ORDER BY failed_calls DESC
       LIMIT 10
     ) u),

    'top_failing_numbers',
    (SELECT json_agg(n)
     FROM (
       SELECT
         to_number,
         COUNT(*) AS failed_calls
       FROM public.call_log
       WHERE call_status IN ('no-answer', 'busy', 'failed')
       AND created_at BETWEEN start_date AND end_date
       GROUP BY to_number
       ORDER BY failed_calls DESC
       LIMIT 10
     ) n),

    'error_codes',
    (SELECT json_agg(e)
     FROM (
       SELECT
         error_message,
         COUNT(*) AS count
       FROM public.call_log
       WHERE error_message IS NOT NULL
       AND created_at BETWEEN start_date AND end_date
       GROUP BY error_message
       ORDER BY count DESC
       LIMIT 20
     ) e)
  ) INTO result;

  RETURN result;
END;
$$;

-- Scheduler health function
CREATE OR REPLACE FUNCTION public.check_scheduler_health()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'last_run',
    (SELECT executed_at FROM public.scheduler_log ORDER BY executed_at DESC LIMIT 1),

    'last_10_runs',
    (SELECT json_agg(r ORDER BY executed_at DESC)
     FROM (
       SELECT executed_at, reminders_due, reminders_processed,
              reminders_failed, edge_function_status, error_message, duration_ms
       FROM public.scheduler_log
       ORDER BY executed_at DESC
       LIMIT 10
     ) r),

    'errors_last_24h',
    (SELECT COUNT(*) FROM public.scheduler_log
     WHERE error_message IS NOT NULL
     AND executed_at >= NOW() - INTERVAL '24 hours'),

    'gaps',
    (SELECT json_agg(g)
     FROM (
       SELECT
         executed_at,
         LAG(executed_at) OVER (ORDER BY executed_at) AS prev_run,
         EXTRACT(EPOCH FROM (executed_at - LAG(executed_at) OVER (ORDER BY executed_at))) / 60 AS gap_minutes
       FROM public.scheduler_log
       WHERE executed_at >= NOW() - INTERVAL '24 hours'
     ) g
     WHERE gap_minutes > 5),

    'queue_depth',
    (SELECT COUNT(*) FROM public.reminders
     WHERE status = 'pending'
     AND scheduled_at < NOW())
  ) INTO result;

  RETURN result;
END;
$$;

-- User activity report function
CREATE OR REPLACE FUNCTION public.get_user_activity_report()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(u ORDER BY total_reminders DESC)
  INTO result
  FROM (
    SELECT
      us.id,
      us.name,
      us.status,
      COUNT(r.id) AS total_reminders,
      COUNT(r.id) FILTER (WHERE r.source = 'ivr') AS ivr_reminders,
      COUNT(r.id) FILTER (WHERE r.source = 'admin') AS admin_reminders,
      COUNT(r.id) FILTER (WHERE r.status = 'delivered') AS delivered,
      COUNT(r.id) FILTER (WHERE r.status = 'missed') AS missed,
      COUNT(r.id) FILTER (WHERE r.status = 'pending') AS pending,
      ROUND(
        CASE WHEN COUNT(r.id) FILTER (WHERE r.status IN ('delivered','missed')) > 0
        THEN COUNT(r.id) FILTER (WHERE r.status = 'delivered')::NUMERIC /
             COUNT(r.id) FILTER (WHERE r.status IN ('delivered','missed')) * 100
        ELSE 0 END, 1
      ) AS success_rate,
      MAX(cl.created_at) AS last_call_in,
      MAX(r.delivered_at) AS last_delivered
    FROM public.users us
    LEFT JOIN public.reminders r ON r.user_id = us.id
    LEFT JOIN public.call_log cl ON cl.user_id = us.id AND cl.direction = 'inbound'
    GROUP BY us.id, us.name, us.status
  ) u;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_delivery_report(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_failure_report(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_scheduler_health() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_activity_report() TO authenticated;
