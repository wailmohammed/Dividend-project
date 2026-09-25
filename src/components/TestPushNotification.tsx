import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export const TestPushNotification = () => {
  const { user } = useAuth();
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const handleTestPush = async () => {
    if (!user?.id) {
      toast.error('You must be logged in to test notifications');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      // Check if user has push subscription stored
      const { data: subscription, error: subError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (subError || !subscription) {
        toast.error('No push subscription found. Please enable push notifications first.');
        setTestResult('error');
        return;
      }

      // Call edge function to send test notification
      const { data, error } = await supabase.functions.invoke('notifications', {
        body: {
          type: 'test',
          userId: user.id,
          title: '🔔 Test Notification',
          body: 'Push notifications are working correctly!',
          data: { test: true }
        }
      });

      if (error) throw error;

      toast.success('Test notification sent! Check your device.');
      setTestResult('success');
    } catch (err: any) {
      console.error('Failed to send test notification:', err);
      toast.error('Failed to send test notification');
      setTestResult('error');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Test Push Notifications
        </CardTitle>
        <CardDescription>
          Verify that push notifications are working correctly with your browser
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button onClick={handleTestPush} disabled={isTesting}>
            {isTesting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Bell className="h-4 w-4 mr-2" />
                Send Test Notification
              </>
            )}
          </Button>

          {testResult === 'success' && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm">Notification sent successfully!</span>
            </div>
          )}

          {testResult === 'error' && (
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              <span className="text-sm">Failed to send notification</span>
            </div>
          )}
        </div>

        <div className="text-sm text-muted-foreground">
          <p>Make sure you have:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Enabled browser notifications in your browser settings</li>
            <li>Granted notification permission for this site</li>
            <li>Subscribed to push notifications using the toggle above</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
