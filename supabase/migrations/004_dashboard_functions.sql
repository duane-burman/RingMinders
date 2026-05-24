-- Dashboard summary statistics function
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_active_users',
    (SELECT COUNT(*) FROM public.users WHERE status = 'active'),

    'total_pending_reminders',
    (SELECT COUNT(*) FROM public.reminders WHERE status = 'pending'),

    'reminders_due_today',
    (SELECT COUNT(*) FROM public.reminders
     WHERE status = 'pending'
     AND scheduled_at::date = CURRENT_DATE),

    'delivered_today',
    (SELECT COUNT(*) FROM public.reminders
     WHERE status = 'delivered'
     AND delivered_at::date = CURRENT_DATE),

    'missed_today',
    (SELECT COUNT(*) FROM public.reminders
     WHERE status = 'missed'
     AND scheduled_at::date = CURRENT_DATE),

    'failed_calls_24h',
    (SELECT COUNT(*) FROM public.call_log
     WHERE call_status IN ('no-answer', 'busy', 'failed')
     AND created_at >= NOW() - INTERVAL '24 hours')
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;
