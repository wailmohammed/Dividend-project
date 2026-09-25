import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// VAPID public key - in production, generate your own key pair
const VAPID_PUBLIC_KEY = 'BLBXKHCqSqCZB1aJqMzK7qvP0vjNSk5MvG3qOB8YxPGONqWABSrWWNm5tC9oNxJnCq4b6bvHnJvQvW9OPxL8xmo';

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  // Check if push notifications are supported
  useEffect(() => {
    const supported = 'Notification' in window && 
                      'serviceWorker' in navigator && 
                      'PushManager' in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  // Check current subscription status from database
  const checkSubscription = useCallback(async () => {
    if (!isSupported || !user?.id || user.id === 'demo-user') return;

    try {
      // Check local browser subscription
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Verify it exists in database
        const { data } = await supabase
          .from('push_subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint)
          .maybeSingle();
        
        setIsSubscribed(!!data);
      } else {
        setIsSubscribed(false);
      }
    } catch (error) {
      console.error('Error checking push subscription:', error);
      setIsSubscribed(false);
    }
  }, [isSupported, user?.id]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      toast.error('Push notifications are not supported in this browser');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        toast.success('Notification permission granted');
        return true;
      } else if (result === 'denied') {
        toast.error('Notification permission denied');
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error requesting permission:', error);
      toast.error('Failed to request notification permission');
      return false;
    }
  }, [isSupported]);

  // Convert VAPID key to Uint8Array
  const urlBase64ToUint8Array = (base64String: string): ArrayBuffer => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray.buffer as ArrayBuffer;
  };

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !user?.id || user.id === 'demo-user') {
      toast.error('Unable to subscribe - please log in first');
      return false;
    }
    
    setIsLoading(true);
    
    try {
      // First, ensure we have permission
      if (Notification.permission !== 'granted') {
        const granted = await requestPermission();
        if (!granted) {
          setIsLoading(false);
          return false;
        }
      }

      // Register service worker if not already registered
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
      }

      // Subscribe to push with VAPID key
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      // Get the keys from subscription
      const rawKey = subscription.getKey('p256dh');
      const rawAuth = subscription.getKey('auth');
      
      if (!rawKey || !rawAuth) {
        throw new Error('Failed to get subscription keys');
      }

      // Convert to base64 strings
      const p256dhKey = btoa(String.fromCharCode(...new Uint8Array(rawKey)));
      const authKey = btoa(String.fromCharCode(...new Uint8Array(rawAuth)));

      // Store subscription in database
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh_key: p256dhKey,
          auth_key: authKey,
          device_info: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            subscribedAt: new Date().toISOString()
          }
        }, {
          onConflict: 'user_id,endpoint'
        });

      if (error) {
        console.error('Failed to store subscription:', error);
        throw error;
      }

      setIsSubscribed(true);
      toast.success('Push notifications enabled! You\'ll receive alerts for dividends and market updates.');
      
      setIsLoading(false);
      return true;
    } catch (error: any) {
      console.error('Error subscribing to push notifications:', error);
      
      // Handle specific errors
      if (error.name === 'NotAllowedError') {
        toast.error('Notification permission was denied');
      } else if (error.message?.includes('applicationServerKey')) {
        toast.error('Push configuration error - contact support');
      } else {
        toast.error('Failed to enable push notifications');
      }
      
      setIsLoading(false);
      return false;
    }
  }, [isSupported, user?.id, requestPermission]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !user?.id) return false;
    
    setIsLoading(true);
    
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Unsubscribe from browser
        await subscription.unsubscribe();
        
        // Remove from database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint);
      }
      
      setIsSubscribed(false);
      toast.success('Push notifications disabled');
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      toast.error('Failed to disable push notifications');
      setIsLoading(false);
      return false;
    }
  }, [isSupported, user?.id]);

  // Show a local notification (for testing)
  const showNotification = useCallback(async (title: string, options?: NotificationOptions) => {
    if (!isSupported || Notification.permission !== 'granted') {
      toast.info(title);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'wealthos-notification',
        requireInteraction: false,
        ...options
      });
    } catch (error) {
      console.error('Error showing notification:', error);
      // Fallback to toast
      toast.info(title);
    }
  }, [isSupported]);

  // Get subscription count for user (admin feature)
  const getSubscriptionCount = useCallback(async (): Promise<number> => {
    if (!user?.id) return 0;
    
    try {
      const { count, error } = await supabase
        .from('push_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      return count || 0;
    } catch {
      return 0;
    }
  }, [user?.id]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    requestPermission,
    subscribe,
    unsubscribe,
    showNotification,
    checkSubscription,
    getSubscriptionCount
  };
};

export default usePushNotifications;