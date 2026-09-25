-- Add position column for drag-and-drop ordering
ALTER TABLE public.watchlist ADD COLUMN IF NOT EXISTS position integer DEFAULT 0;

-- Update existing rows with sequential positions
DO $$
DECLARE
  r RECORD;
  pos INTEGER := 0;
BEGIN
  FOR r IN (SELECT id, user_id FROM public.watchlist ORDER BY added_at DESC)
  LOOP
    UPDATE public.watchlist SET position = pos WHERE id = r.id;
    pos := pos + 1;
  END LOOP;
END $$;