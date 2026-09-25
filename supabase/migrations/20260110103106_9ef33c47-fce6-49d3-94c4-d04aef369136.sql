-- Add unique constraint on connection_id for broker_sync_data to fix upsert
ALTER TABLE public.broker_sync_data ADD CONSTRAINT broker_sync_data_connection_id_unique UNIQUE (connection_id);

-- Enable realtime for market_sync_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_sync_logs;