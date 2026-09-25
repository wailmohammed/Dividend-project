import React, { useState } from 'react';
import { authenticator } from 'otplib';
import { Shield, Loader2, AlertCircle, KeyRound } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { InputOTP, InputOTPGroup, InputOTPSlot } from './ui/input-otp';
import { BackupCodeVerification } from './BackupCodeVerification';

interface TwoFactorVerificationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const TwoFactorVerification: React.FC<TwoFactorVerificationProps> = ({
  open,
  onOpenChange,
  userId,
  onSuccess,
  onCancel
}) => {
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [showBackupCode, setShowBackupCode] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const MAX_ATTEMPTS = 5;

  const verifyCode = async () => {
    if (verificationCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    if (attempts >= MAX_ATTEMPTS) {
      toast.error('Too many failed attempts. Please try again later.');
      return;
    }

    setVerifying(true);
    try {
      // Fetch the user's 2FA secret
      const { data: twoFAData, error: fetchError } = await supabase
        .from('two_factor_auth')
        .select('secret_encrypted, backup_codes')
        .eq('user_id', userId)
        .eq('is_enabled', true)
        .maybeSingle();

      if (fetchError || !twoFAData) {
        console.error('Failed to fetch 2FA data:', fetchError);
        toast.error('Failed to verify 2FA. Please try again.');
        setVerifying(false);
        return;
      }

      // Decode the secret (in production, use proper decryption)
      const secret = atob(twoFAData.secret_encrypted || '');

      // Verify the TOTP code
      const isValid = authenticator.verify({ token: verificationCode, secret });

      if (!isValid) {
        setAttempts(prev => prev + 1);
        const remaining = MAX_ATTEMPTS - attempts - 1;
        toast.error(`Invalid code. ${remaining} attempts remaining.`);
        setVerificationCode('');
        setVerifying(false);
        return;
      }

      // Update last verified timestamp
      await supabase
        .from('two_factor_auth')
        .update({ last_verified_at: new Date().toISOString() })
        .eq('user_id', userId);

      toast.success('Two-factor authentication verified!');
      onSuccess();
    } catch (error) {
      console.error('2FA verification error:', error);
      toast.error('Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleBackupCodeSuccess = () => {
    setShowBackupCode(false);
    onSuccess();
  };

  const handleCancel = () => {
    setVerificationCode('');
    setAttempts(0);
    onCancel();
  };

  if (showBackupCode) {
    return (
      <BackupCodeVerification
        open={open}
        onOpenChange={onOpenChange}
        userId={userId}
        onSuccess={handleBackupCodeSuccess}
        onCancel={() => setShowBackupCode(false)}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleCancel();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Two-Factor Authentication Required
          </DialogTitle>
          <DialogDescription>
            Enter the 6-digit code from your authenticator app to continue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={verificationCode}
              onChange={setVerificationCode}
              onComplete={verifyCode}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {attempts > 0 && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4" />
                <span>{MAX_ATTEMPTS - attempts} attempts remaining</span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button 
              onClick={verifyCode}
              disabled={verifying || verificationCode.length !== 6 || attempts >= MAX_ATTEMPTS}
              className="w-full"
            >
              {verifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Verifying...
                </>
              ) : (
                'Verify'
              )}
            </Button>

            <Button
              variant="ghost"
              onClick={() => setShowBackupCode(true)}
              className="text-sm"
            >
              <KeyRound className="w-4 h-4 mr-2" />
              Use backup code instead
            </Button>

            <Button
              variant="outline"
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
