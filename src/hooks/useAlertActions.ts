import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export const useAlertActions = (onSuccess?: () => void) => {
  const { user } = useAuth();

  const acknowledgeAlert = useCallback(
    async (alertId: string) => {
      if (!user?.id) return;
      try {
        const { error } = await supabase
          .from('alert_history')
          .update({
            is_acknowledged: true,
            acknowledged_at: new Date().toISOString(),
          })
          .eq('id', alertId)
          .eq('user_id', user.id);

        if (error) throw error;
        toast.success('Alert acknowledged');
        onSuccess?.();
      } catch (err) {
        console.error('Failed to acknowledge alert:', err);
        toast.error('Failed to acknowledge alert');
      }
    },
    [user?.id, onSuccess]
  );

  const unacknowledgeAlert = useCallback(
    async (alertId: string) => {
      if (!user?.id) return;
      try {
        const { error } = await supabase
          .from('alert_history')
          .update({
            is_acknowledged: false,
            acknowledged_at: null,
          })
          .eq('id', alertId)
          .eq('user_id', user.id);

        if (error) throw error;
        toast.success('Alert unacknowledged');
        onSuccess?.();
      } catch (err) {
        console.error('Failed to unacknowledge alert:', err);
        toast.error('Failed to unacknowledge alert');
      }
    },
    [user?.id, onSuccess]
  );

  const snoozeAlert = useCallback(
    async (alertId: string, durationMinutes: number, reason: string) => {
      if (!user?.id) return;
      const snoozedUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
      try {
        const { error } = await supabase
          .from('alert_history')
          .update({
            is_snoozed: true,
            snoozed_until: snoozedUntil,
            snooze_reason: reason || null,
          })
          .eq('id', alertId)
          .eq('user_id', user.id);

        if (error) throw error;
        toast.success(`Alert snoozed for ${formatDuration(durationMinutes)}`);
        onSuccess?.();
      } catch (err) {
        console.error('Failed to snooze alert:', err);
        toast.error('Failed to snooze alert');
      }
    },
    [user?.id, onSuccess]
  );

  const unsnoozeAlert = useCallback(
    async (alertId: string) => {
      if (!user?.id) return;
      try {
        const { error } = await supabase
          .from('alert_history')
          .update({
            is_snoozed: false,
            snoozed_until: null,
            snooze_reason: null,
          })
          .eq('id', alertId)
          .eq('user_id', user.id);

        if (error) throw error;
        toast.success('Alert unsnoozed');
        onSuccess?.();
      } catch (err) {
        console.error('Failed to unsnooze alert:', err);
        toast.error('Failed to unsnooze alert');
      }
    },
    [user?.id, onSuccess]
  );

  const batchAcknowledge = useCallback(
    async (alertIds: string[]) => {
      if (!user?.id || alertIds.length === 0) return;
      try {
        const { error } = await supabase
          .from('alert_history')
          .update({ is_acknowledged: true, acknowledged_at: new Date().toISOString() })
          .in('id', alertIds)
          .eq('user_id', user.id);
        if (error) throw error;
        toast.success(`${alertIds.length} alerts acknowledged`);
        onSuccess?.();
      } catch (err) {
        console.error('Batch acknowledge failed:', err);
        toast.error('Failed to acknowledge alerts');
      }
    },
    [user?.id, onSuccess]
  );

  const batchUnacknowledge = useCallback(
    async (alertIds: string[]) => {
      if (!user?.id || alertIds.length === 0) return;
      try {
        const { error } = await supabase
          .from('alert_history')
          .update({ is_acknowledged: false, acknowledged_at: null })
          .in('id', alertIds)
          .eq('user_id', user.id);
        if (error) throw error;
        toast.success(`${alertIds.length} alerts unacknowledged`);
        onSuccess?.();
      } catch (err) {
        console.error('Batch unacknowledge failed:', err);
        toast.error('Failed to unacknowledge alerts');
      }
    },
    [user?.id, onSuccess]
  );

  const batchSnooze = useCallback(
    async (alertIds: string[], durationMinutes: number, reason: string) => {
      if (!user?.id || alertIds.length === 0) return;
      const snoozedUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
      try {
        const { error } = await supabase
          .from('alert_history')
          .update({ is_snoozed: true, snoozed_until: snoozedUntil, snooze_reason: reason || null })
          .in('id', alertIds)
          .eq('user_id', user.id);
        if (error) throw error;
        toast.success(`${alertIds.length} alerts snoozed`);
        onSuccess?.();
      } catch (err) {
        console.error('Batch snooze failed:', err);
        toast.error('Failed to snooze alerts');
      }
    },
    [user?.id, onSuccess]
  );

  const batchUnsnooze = useCallback(
    async (alertIds: string[]) => {
      if (!user?.id || alertIds.length === 0) return;
      try {
        const { error } = await supabase
          .from('alert_history')
          .update({ is_snoozed: false, snoozed_until: null, snooze_reason: null })
          .in('id', alertIds)
          .eq('user_id', user.id);
        if (error) throw error;
        toast.success(`${alertIds.length} alerts unsnoozed`);
        onSuccess?.();
      } catch (err) {
        console.error('Batch unsnooze failed:', err);
        toast.error('Failed to unsnooze alerts');
      }
    },
    [user?.id, onSuccess]
  );

  const deleteAlert = useCallback(
    async (alertId: string) => {
      if (!user?.id) return;
      try {
        const { error } = await supabase
          .from('alert_history')
          .delete()
          .eq('id', alertId);
        if (error) throw error;
        toast.success('Alert deleted');
        onSuccess?.();
      } catch (err) {
        console.error('Failed to delete alert:', err);
        toast.error('Failed to delete alert');
      }
    },
    [user?.id, onSuccess]
  );

  const batchDelete = useCallback(
    async (alertIds: string[]) => {
      if (!user?.id || alertIds.length === 0) return;
      try {
        const { error } = await supabase
          .from('alert_history')
          .delete()
          .in('id', alertIds);
        if (error) throw error;
        toast.success(`${alertIds.length} alerts deleted`);
        onSuccess?.();
      } catch (err) {
        console.error('Batch delete failed:', err);
        toast.error('Failed to delete alerts');
      }
    },
    [user?.id, onSuccess]
  );

  return {
    acknowledgeAlert, unacknowledgeAlert, snoozeAlert, unsnoozeAlert,
    batchAcknowledge, batchUnacknowledge, batchSnooze, batchUnsnooze,
    deleteAlert, batchDelete,
  };
};


function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hour(s)`;
  if (minutes < 10080) return `${Math.round(minutes / 1440)} day(s)`;
  return `${Math.round(minutes / 10080)} week(s)`;
}
