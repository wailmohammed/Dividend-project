UPDATE public.broker_connections
SET status = 'connected', updated_at = now()
WHERE status = 'syncing'
  AND updated_at < now() - interval '1 hour';