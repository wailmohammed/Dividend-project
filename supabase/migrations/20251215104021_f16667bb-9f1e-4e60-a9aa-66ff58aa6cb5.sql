-- Add phone_number field to profiles table for SMS notifications
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number text;

-- Add index for phone lookups
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON public.profiles(phone_number) WHERE phone_number IS NOT NULL;