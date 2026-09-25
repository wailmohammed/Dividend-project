import { useState, useCallback, useRef } from 'react';

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  cooldownMs: number;
}

interface RateLimitState {
  attempts: number;
  windowStart: number;
  cooldownUntil: number | null;
}

export const useRateLimiter = (config: RateLimitConfig) => {
  const { maxAttempts, windowMs, cooldownMs } = config;
  const stateRef = useRef<RateLimitState>({
    attempts: 0,
    windowStart: Date.now(),
    cooldownUntil: null
  });
  const [isLimited, setIsLimited] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState(maxAttempts);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  const checkAndIncrement = useCallback((): { allowed: boolean; message?: string } => {
    const now = Date.now();
    const state = stateRef.current;

    // Check if in cooldown
    if (state.cooldownUntil && now < state.cooldownUntil) {
      const remaining = Math.ceil((state.cooldownUntil - now) / 1000);
      setCooldownRemaining(remaining);
      setIsLimited(true);
      return { 
        allowed: false, 
        message: `Rate limited. Please wait ${remaining} seconds before trying again.` 
      };
    }

    // Reset cooldown if expired
    if (state.cooldownUntil && now >= state.cooldownUntil) {
      state.cooldownUntil = null;
      state.attempts = 0;
      state.windowStart = now;
      setIsLimited(false);
      setCooldownRemaining(0);
    }

    // Reset window if expired
    if (now - state.windowStart > windowMs) {
      state.attempts = 0;
      state.windowStart = now;
    }

    // Check if limit exceeded
    if (state.attempts >= maxAttempts) {
      state.cooldownUntil = now + cooldownMs;
      const remaining = Math.ceil(cooldownMs / 1000);
      setCooldownRemaining(remaining);
      setIsLimited(true);
      return { 
        allowed: false, 
        message: `Too many attempts. Please wait ${remaining} seconds.` 
      };
    }

    // Increment and allow
    state.attempts++;
    setRemainingAttempts(maxAttempts - state.attempts);
    return { allowed: true };
  }, [maxAttempts, windowMs, cooldownMs]);

  const reset = useCallback(() => {
    stateRef.current = {
      attempts: 0,
      windowStart: Date.now(),
      cooldownUntil: null
    };
    setIsLimited(false);
    setRemainingAttempts(maxAttempts);
    setCooldownRemaining(0);
  }, [maxAttempts]);

  return {
    checkAndIncrement,
    reset,
    isLimited,
    remainingAttempts,
    cooldownRemaining
  };
};
