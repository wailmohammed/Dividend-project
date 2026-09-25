-- Create rate limit tracking table
CREATE TABLE public.rate_limit_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  cooldown_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, action_type)
);

-- Enable RLS
ALTER TABLE public.rate_limit_attempts ENABLE ROW LEVEL SECURITY;

-- Users can view their own rate limit status
CREATE POLICY "Users can view their own rate limits"
ON public.rate_limit_attempts
FOR SELECT
USING (user_id = auth.uid());

-- Service role can manage all rate limits (for edge functions)
CREATE POLICY "Service role can manage rate limits"
ON public.rate_limit_attempts
FOR ALL
USING (true)
WITH CHECK (true);

-- Add 2FA requirement flag to user_roles (for future enforcement)
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS requires_2fa BOOLEAN DEFAULT false;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS enforce_2fa_after TIMESTAMP WITH TIME ZONE;

-- Create function to check and update rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID,
  p_action_type TEXT,
  p_max_attempts INTEGER DEFAULT 3,
  p_window_seconds INTEGER DEFAULT 300,
  p_cooldown_seconds INTEGER DEFAULT 120
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record rate_limit_attempts%ROWTYPE;
  v_now TIMESTAMP WITH TIME ZONE := now();
  v_window_start TIMESTAMP WITH TIME ZONE;
  v_result JSON;
BEGIN
  -- Get existing record
  SELECT * INTO v_record
  FROM rate_limit_attempts
  WHERE user_id = p_user_id AND action_type = p_action_type;
  
  -- Check if in cooldown
  IF v_record.cooldown_until IS NOT NULL AND v_now < v_record.cooldown_until THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'cooldown',
      'cooldown_remaining', EXTRACT(EPOCH FROM (v_record.cooldown_until - v_now))::INTEGER,
      'attempts', v_record.attempt_count
    );
  END IF;
  
  -- Calculate window start
  v_window_start := v_now - (p_window_seconds || ' seconds')::INTERVAL;
  
  -- If no record or window expired, reset
  IF v_record.id IS NULL THEN
    INSERT INTO rate_limit_attempts (user_id, action_type, attempt_count, window_start)
    VALUES (p_user_id, p_action_type, 1, v_now);
    
    RETURN json_build_object(
      'allowed', true,
      'attempts', 1,
      'remaining', p_max_attempts - 1
    );
  END IF;
  
  -- If window expired, reset
  IF v_record.window_start < v_window_start THEN
    UPDATE rate_limit_attempts
    SET attempt_count = 1, window_start = v_now, cooldown_until = NULL, updated_at = v_now
    WHERE id = v_record.id;
    
    RETURN json_build_object(
      'allowed', true,
      'attempts', 1,
      'remaining', p_max_attempts - 1
    );
  END IF;
  
  -- Check if limit exceeded
  IF v_record.attempt_count >= p_max_attempts THEN
    UPDATE rate_limit_attempts
    SET cooldown_until = v_now + (p_cooldown_seconds || ' seconds')::INTERVAL, updated_at = v_now
    WHERE id = v_record.id;
    
    RETURN json_build_object(
      'allowed', false,
      'reason', 'limit_exceeded',
      'cooldown_remaining', p_cooldown_seconds,
      'attempts', v_record.attempt_count
    );
  END IF;
  
  -- Increment and allow
  UPDATE rate_limit_attempts
  SET attempt_count = attempt_count + 1, updated_at = v_now
  WHERE id = v_record.id;
  
  RETURN json_build_object(
    'allowed', true,
    'attempts', v_record.attempt_count + 1,
    'remaining', p_max_attempts - v_record.attempt_count - 1
  );
END;
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_rate_limit_attempts_updated_at
BEFORE UPDATE ON public.rate_limit_attempts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();