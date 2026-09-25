import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RateLimitConfig {
  actionType: string;
  maxAttempts?: number;
  windowSeconds?: number;
  cooldownSeconds?: number;
}

interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  cooldownRemaining?: number;
  attempts?: number;
  remaining?: number;
  error?: string;
}

export const useServerRateLimiter = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [lastResult, setLastResult] = useState<RateLimitResult | null>(null);

  const checkRateLimit = useCallback(async (config: RateLimitConfig): Promise<RateLimitResult> => {
    setIsChecking(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('check-rate-limit', {
        body: {
          action_type: config.actionType,
          max_attempts: config.maxAttempts ?? 3,
          window_seconds: config.windowSeconds ?? 300,
          cooldown_seconds: config.cooldownSeconds ?? 120
        }
      });

      if (error) {
        console.error('Rate limit check failed:', error);
        // On error, allow the action but log it
        const result: RateLimitResult = { 
          allowed: true, 
          error: error.message 
        };
        setLastResult(result);
        return result;
      }

      const result: RateLimitResult = {
        allowed: data.allowed,
        reason: data.reason,
        cooldownRemaining: data.cooldown_remaining,
        attempts: data.attempts,
        remaining: data.remaining
      };
      
      setLastResult(result);
      return result;
    } catch (err: any) {
      console.error('Rate limit check error:', err);
      // On error, allow the action but log it
      const result: RateLimitResult = { 
        allowed: true, 
        error: err.message 
      };
      setLastResult(result);
      return result;
    } finally {
      setIsChecking(false);
    }
  }, []);

  return {
    checkRateLimit,
    isChecking,
    lastResult
  };
};
