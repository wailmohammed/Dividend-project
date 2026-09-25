import { useCallback, useRef } from 'react';

/**
 * Plays a short notification chime and shows a browser desktop notification
 * when a new alert fires.  Gracefully degrades if permissions are denied
 * or the AudioContext is unavailable.
 */
export const useAlertNotifications = () => {
  const audioCtxRef = useRef<AudioContext | null>(null);

  /** Synthesise a short two-tone chime via Web Audio API (no external file). */
  const playSound = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;

      // First tone
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.value = 880;
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1).connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // Second tone (higher)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = 1175;
      gain2.gain.setValueAtTime(0.18, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc2.connect(gain2).connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.4);
    } catch {
      // Audio not available – silently ignore
    }
  }, []);

  /** Show a browser desktop notification if permission is granted. */
  const showDesktopNotification = useCallback(
    (title: string, body: string) => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;

      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'wealthos-alert',
        });
      } catch {
        // Fallback: try service-worker-based notification
        navigator.serviceWorker?.ready
          .then((reg) =>
            reg.showNotification(title, {
              body,
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              tag: 'wealthos-alert',
            })
          )
          .catch(() => {});
      }
    },
    []
  );

  /** Request notification permission from the user (call on user gesture). */
  const requestPermission = useCallback(async (): Promise<NotificationPermission | null> => {
    if (!('Notification' in window)) return null;
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    return Notification.requestPermission();
  }, []);

  /** Combined helper: play sound + show desktop notification. */
  const notifyAlert = useCallback(
    (symbol: string, alertType: string, detail?: string) => {
      playSound();
      const label = alertType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      showDesktopNotification(
        `${symbol} — ${label}`,
        detail || `A ${label} alert triggered for ${symbol}.`
      );
    },
    [playSound, showDesktopNotification]
  );

  return { playSound, showDesktopNotification, requestPermission, notifyAlert };
};
