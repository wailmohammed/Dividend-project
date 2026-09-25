-- Add social notification preferences to notification_preferences table
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS email_new_followers boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS email_new_likes boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS email_new_comments boolean DEFAULT true;