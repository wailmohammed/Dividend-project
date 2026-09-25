import React, { useState, useEffect } from 'react';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { Shield, Copy, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface TwoFactorSetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({ open, onOpenChange, onSuccess }) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'generate' | 'verify' | 'backup'>('generate');
  const [secret, setSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && step === 'generate') {
      generateSecret();
    }
  }, [open]);

  const generateSecret = async () => {
    setLoading(true);
    try {
      // Generate a new secret
      const newSecret = authenticator.generateSecret();
      setSecret(newSecret);

      // Generate QR code
      const userEmail = user?.email || 'user';
      const otpauth = authenticator.keyuri(userEmail, 'WealthOS', newSecret);
      const qrUrl = await QRCode.toDataURL(otpauth);
      setQrCodeUrl(qrUrl);

      // Generate backup codes
      const codes = Array.from({ length: 8 }, () => 
        Math.random().toString(36).substring(2, 8).toUpperCase()
      );
      setBackupCodes(codes);
    } catch (error) {
      console.error('Failed to generate 2FA secret:', error);
      toast.error('Failed to generate 2FA setup');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (verificationCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    setVerifying(true);
    try {
      // Verify the TOTP code
      const isValid = authenticator.verify({ token: verificationCode, secret });

      if (!isValid) {
        toast.error('Invalid verification code. Please try again.');
        setVerifying(false);
        return;
      }

      // Save to database
      const { error } = await supabase
        .from('two_factor_auth')
        .upsert({
          user_id: user?.id,
          secret_encrypted: btoa(secret), // Simple encoding - use proper encryption in production
          backup_codes: backupCodes,
          is_enabled: true,
          last_verified_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;

      setStep('backup');
    } catch (error) {
      console.error('Failed to verify 2FA:', error);
      toast.error('Failed to enable 2FA');
    } finally {
      setVerifying(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    toast.success('Secret copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    toast.success('Backup codes copied to clipboard');
  };

  const handleComplete = async () => {
    // Send security notification email
    try {
      await supabase.functions.invoke('notifications', {
        body: {
          action: 'send_security_notification',
          type: 'two_factor_enabled'
        }
      });
    } catch (e) {
      console.log('Failed to send 2FA enabled notification:', e);
    }
    
    onSuccess();
    onOpenChange(false);
    setStep('generate');
    setVerificationCode('');
    toast.success('Two-factor authentication enabled successfully!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            {step === 'generate' && 'Set Up Two-Factor Authentication'}
            {step === 'verify' && 'Verify Your Setup'}
            {step === 'backup' && 'Save Your Backup Codes'}
          </DialogTitle>
          <DialogDescription>
            {step === 'generate' && 'Scan the QR code with your authenticator app'}
            {step === 'verify' && 'Enter the 6-digit code from your authenticator app'}
            {step === 'backup' && 'Save these codes in a safe place'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {step === 'generate' && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="p-4 bg-white rounded-lg">
                    <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    Can't scan? Enter this code manually:
                  </Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-muted rounded text-sm font-mono break-all">
                      {secret}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={copySecret}
                    >
                      {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  onClick={() => setStep('verify')}
                >
                  I've scanned the QR code
                </Button>
              </div>
            )}

            {step === 'verify' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="verification-code">Verification Code</Label>
                  <Input
                    id="verification-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    className="text-center text-2xl tracking-widest font-mono"
                  />
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setStep('generate')}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button 
                    className="flex-1" 
                    onClick={verifyCode}
                    disabled={verifying || verificationCode.length !== 6}
                  >
                    {verifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Verify
                  </Button>
                </div>
              </div>
            )}

            {step === 'backup' && (
              <div className="space-y-4">
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">
                      Save these backup codes securely. Each code can only be used once if you lose access to your authenticator app.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code, i) => (
                    <code 
                      key={i} 
                      className="p-2 bg-muted rounded text-center text-sm font-mono"
                    >
                      {code}
                    </code>
                  ))}
                </div>

                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={copyBackupCodes}
                >
                  <Copy className="w-4 h-4 mr-2" /> Copy All Codes
                </Button>

                <Button 
                  className="w-full" 
                  onClick={handleComplete}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" /> I've Saved My Codes
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
