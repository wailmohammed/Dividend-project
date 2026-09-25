-- Enable realtime for market_data_cache table
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_data_cache;

-- Set replica identity to full for complete row data in realtime updates
ALTER TABLE public.market_data_cache REPLICA IDENTITY FULL;