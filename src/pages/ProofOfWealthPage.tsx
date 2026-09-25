import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface HoldingSnapshot {
  symbol: string;
  name: string;
  value: number;
  assetType: string;
  sector: string | null;
  source: 'verified' | 'self_reported';
}

interface ProofData {
  id: string;
  share_code: string;
  full_name: string;
  net_worth: number;
  total_assets: number;
  total_liabilities: number;
  holdings_snapshot: HoldingSnapshot[];
  currency: string;
  is_active: boolean;
  views_count: number;
  expires_at: string | null;
  generated_at: string;
}

const ProofOfWealthPage = () => {
  const { shareCode } = useParams<{ shareCode: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proof, setProof] = useState<ProofData | null>(null);

  useEffect(() => {
    const fetchProof = async () => {
      if (!shareCode) {
        setError('Invalid link');
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('proof_of_wealth')
          .select('*')
          .eq('share_code', shareCode)
          .eq('is_active', true)
          .maybeSingle() as any;

        if (fetchError) throw fetchError;

        if (!data) {
          setError('This proof has been revoked or does not exist.');
          setLoading(false);
          return;
        }

        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          setError('This proof has expired.');
          setLoading(false);
          return;
        }

        await supabase
          .from('proof_of_wealth')
          .update({ views_count: (data.views_count || 0) + 1 } as any)
          .eq('id', data.id);

        setProof({
          ...data,
          holdings_snapshot: Array.isArray(data.holdings_snapshot) ? data.holdings_snapshot : [],
        });
      } catch (err) {
        console.error('Error:', err);
        setError('Failed to load proof.');
      } finally {
        setLoading(false);
      }
    };

    fetchProof();
  }, [shareCode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-neutral-400 animate-spin" />
      </div>
    );
  }

  if (error || !proof) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-neutral-200">
          <CardContent className="pt-8 text-center space-y-3">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold text-neutral-900">Proof Not Available</h2>
            <p className="text-neutral-500">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fmt = (val: number) =>
    `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const generatedDate = new Date(proof.generated_at);
  const expiryDate = proof.expires_at ? new Date(proof.expires_at) : null;
  const daysDiff = expiryDate
    ? Math.ceil((expiryDate.getTime() - generatedDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4 py-12 print:bg-white print:p-0">
      <div className="w-full max-w-[640px]">
        {/* Document */}
        <div className="bg-white border border-neutral-200 shadow-sm print:shadow-none print:border-0">
          {/* Content area with padding */}
          <div className="px-12 pt-12 pb-8">
            {/* Header - Name & Badge */}
            <div className="flex items-start justify-between mb-1">
              <h1 className="text-3xl font-bold text-neutral-900 tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
                {proof.full_name}
              </h1>
              <span className="text-[10px] font-semibold tracking-wider uppercase border border-neutral-300 text-neutral-500 px-2 py-0.5 rounded-sm">
                PDF
              </span>
            </div>

            {/* Subtitle */}
            <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-semibold mb-4">
              Self Attested Proof of Wealth
            </p>

            {/* Meta info */}
            <div className="text-[11px] text-neutral-400 space-y-0.5 mb-8">
              <p>ID: <span className="font-mono">{proof.share_code.toUpperCase().replace(/(.{4})/g, '$1-').slice(0, -1)}</span></p>
              <p>GENERATED: {format(generatedDate, "d MMMM yyyy 'AT' h:mm a zzz").toUpperCase()}</p>
              {expiryDate && (
                <p>EXPIRES: {format(expiryDate, 'd MMM yyyy').toUpperCase()} ({daysDiff} DAYS)</p>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-neutral-200 mb-8" />

            {/* Net Worth */}
            <div className="mb-8">
              <p className="text-[10px] uppercase tracking-[0.15em] text-neutral-400 font-semibold mb-1">Net Worth</p>
              <p className="text-4xl font-bold text-neutral-900 tracking-tight">
                USD {proof.net_worth.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>

            {/* Assets & Liabilities */}
            <div className="flex gap-16 mb-8">
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-neutral-400 font-semibold mb-1">Assets</p>
                <p className="text-xl font-bold text-neutral-900">{fmt(Number(proof.total_assets))}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-neutral-400 font-semibold mb-1">Liabilities</p>
                <p className="text-xl font-bold text-neutral-900">{fmt(Number(proof.total_liabilities))}</p>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-neutral-200 mb-8" />

            {/* Attestation Text */}
            <div className="text-[12px] text-neutral-600 leading-relaxed space-y-4 mb-10">
              <p>
                I, {proof.full_name}, certify that the assets and debts included in this statement are
                owned by me.
              </p>
              <p>
                Data labeled <em>"Verified by WealthOS"</em> was retrieved directly from the accounts I
                authenticated and connected in WealthOS.
              </p>
              <p>
                Data labeled <em>"Self Reported"</em> reflects asset values I have provided and has not been
                independently verified by WealthOS.
              </p>
              <p>For additional details, please refer to the annexures below.</p>
            </div>

            {/* Signature & Seal Section */}
            <div className="flex items-end justify-between mt-10">
              {/* Signature */}
              <div className="flex-1">
                <p
                  className="text-2xl text-neutral-700 mb-2"
                  style={{ fontFamily: "'Segoe Script', 'Brush Script MT', 'Dancing Script', cursive" }}
                >
                  {proof.full_name}
                </p>
                <div className="border-t border-neutral-300 w-48 mb-1" />
                <p className="text-[10px] text-neutral-400 uppercase tracking-wider">
                  SIGNED BY {proof.full_name.toUpperCase()}
                </p>
                <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                  VIA WEALTHOS ON {format(generatedDate, 'dd MMMM yyyy').toUpperCase()} AT {format(generatedDate, 'hh:mm a zzz').toUpperCase()}
                </p>
              </div>

              {/* Official Seal */}
              <div className="flex-shrink-0 ml-6">
                <div className="w-20 h-20 rounded-full border-[3px] border-neutral-800 flex items-center justify-center relative">
                  {/* Outer decorative ring */}
                  <div className="absolute inset-0 rounded-full border border-neutral-400" style={{ margin: '3px' }} />
                  {/* Inner ring with teeth */}
                  <div className="w-14 h-14 rounded-full border-2 border-neutral-700 flex items-center justify-center">
                    <span className="text-[10px] font-bold tracking-[0.15em] text-neutral-800 uppercase">
                      WealthOS
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Annexure: Holdings Breakdown */}
        {proof.holdings_snapshot.length > 0 && (
          <div className="bg-white border border-neutral-200 shadow-sm mt-4 print:shadow-none print:border-0 print:mt-0 print:border-t">
            <div className="px-12 py-8">
              <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-semibold mb-6">
                Annexure — Assets Breakdown
              </p>

              <div className="space-y-0">
                {proof.holdings_snapshot
                  .sort((a, b) => b.value - a.value)
                  .map((h, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2.5 border-b border-dashed border-neutral-200 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-neutral-800">{h.name}</span>
                        {h.source === 'self_reported' && (
                          <span className="text-[9px] uppercase tracking-wider bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded font-semibold">
                            Self Reported
                          </span>
                        )}
                        {h.source === 'verified' && (
                          <span className="text-[9px] uppercase tracking-wider bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-semibold">
                            Verified
                          </span>
                        )}
                      </div>
                      <span className="text-[13px] font-semibold text-neutral-800 tabular-nums">
                        {fmt(h.value)}
                      </span>
                    </div>
                  ))}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between pt-3 mt-1 border-t border-neutral-300">
                <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Total Assets</span>
                <span className="text-sm font-bold text-neutral-900">{fmt(Number(proof.total_assets))}</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-6 space-y-1 print:hidden">
          <p className="text-[11px] text-neutral-400">
            This document was generated by WealthOS. Verify authenticity at{' '}
            <a href="/" className="text-neutral-600 hover:underline font-medium">wealthos.app</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProofOfWealthPage;
