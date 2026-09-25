import React, { useState } from 'react';
import { Shield, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface BackupCodeVerificationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const BackupCodeVerification: React.FC<BackupCodeVerificationProps> = ({
  open,
  onOpenChange,
  userId,
  onSuccess,
  onCancel
}) => {
  const [backupCode, setBackupCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const verifyBackupCode = async () => {
    if (!backupCode.trim()) {
      toast.error('Please enter a backup code');
      return;
    }

    setVerifying(true);
    try {
      // Fetch the user's 2FA record
      const { data: twoFactorData, error: fetchError } = await supabase
        .from('two_factor_auth')
        .select('backup_codes, is_enabled')
        .eq('user_id', userId)
        .single();

      if (fetchError || !twoFactorData) {
        toast.error('2FA not configured for this account');
        return;
      }

      const storedCodes = (twoFactorData.backup_codes as string[]) || [];
      const normalizedInput = backupCode.trim().toUpperCase();
      
      // Check if the entered code matches any backup code
      const codeIndex = storedCodes.findIndex(code => code === normalizedInput);
      
      if (codeIndex === -1) {
        toast.error('Invalid backup code');
        return;
      }

      // Remove the used backup code
      const updatedCodes = storedCodes.filter((_, i) => i !== codeIndex);
      
      const { error: updateError } = await supabase
        .from('two_factor_auth')
        .update({ 
          backup_codes: updatedCodes,
          last_verified_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) {
        throw updateError;
      }

      // Send email notification about backup code usage
      try {
        await supabase.functions.invoke('notifications', {
          body: {
            action: 'send_security_notification',
            type: 'backup_code_used',
            metadata: {
              codesRemaining: updatedCodes.length,
              timestamp: new Date().toISOString()
            }
          }
        });
      } catch (e) {
        console.log('Failed to send backup code notification:', e);
      }

      toast.success('Backup code verified successfully');
      
      if (updatedCodes.length <= 2) {
        toast.warning(`Only ${updatedCodes.length} backup codes remaining. Consider regenerating them.`);
      }
      
      onSuccess();
      onOpenChange(false);
      setBackupCode('');
    } catch (error) {
      console.error('Backup code verification failed:', error);
      toast.error('Failed to verify backup code');
    } finally {
      setVerifying(false);
    }
  };

  const handleCancel = () => {
    setBackupCode('');
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Use Backup Code
          </DialogTitle>
          <DialogDescription>
            Enter one of your backup codes to verify your identity
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="backup-code">Backup Code</Label>
            <Input
              id="backup-code"
              type="text"
              placeholder="Enter backup code"
              value={backupCode}
              onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
              className="text-center text-lg tracking-widest font-mono uppercase"
              maxLength={12}
            />
            <p className="text-xs text-muted-foreground">
              Each backup code can only be used once
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="flex-1"
              disabled={verifying}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={verifyBackupCode}
              disabled={verifying || !backupCode.trim()}
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Verify
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
