-- Add total_success field to get_delivery_report (delivered + voicemail)
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

    'total_success',
    (SELECT COUNT(*) FROM public.reminders
     WHERE status IN ('delivered', 'voicemail')
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

GRANT EXECUTE ON FUNCTION public.get_delivery_report(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
