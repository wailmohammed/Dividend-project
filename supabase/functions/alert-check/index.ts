import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const ALPHA_VANTAGE_API_KEY = Deno.env.get('ALPHA_VANTAGE_API_KEY');

interface TriggeredAlert {
  id: string;
  user_id: string;
  symbol: string;
  alert_type: string;
  threshold_percent: number | null;
  notes: string | null;
  currentPrice: number;
  changePercent: number;
  triggerDetail: string;
  email?: string;
}

interface TechnicalData {
  rsi?: number;
  sma50?: number;
  sma200?: number;
  avgVolume?: number;
}

// ── Supabase REST helper ──────────────────────────────────────────────

async function supabaseQuery(endpoint: string, options: RequestInit = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    ...options.headers as Record<string, string>,
  };
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase error: ${error}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// ── Alpha Vantage helpers ─────────────────────────────────────────────

async function fetchRSI(symbol: string): Promise<number | null> {
  if (!ALPHA_VANTAGE_API_KEY) return null;
  try {
    const url = `https://www.alphavantage.co/query?function=RSI&symbol=${symbol}&interval=daily&time_period=14&series_type=close&apikey=${ALPHA_VANTAGE_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) { await res.text(); return null; }
    const data = await res.json();
    const series = data['Technical Analysis: RSI'];
    if (!series) { console.log(`[Alert Check] No RSI data for ${symbol}`); return null; }
    const latestDate = Object.keys(series)[0];
    return parseFloat(series[latestDate]['RSI']);
  } catch (e) {
    console.error(`[Alert Check] RSI fetch failed for ${symbol}:`, e);
    return null;
  }
}

async function fetchSMA(symbol: string, period: number): Promise<number | null> {
  if (!ALPHA_VANTAGE_API_KEY) return null;
  try {
    const url = `https://www.alphavantage.co/query?function=SMA&symbol=${symbol}&interval=daily&time_period=${period}&series_type=close&apikey=${ALPHA_VANTAGE_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) { await res.text(); return null; }
    const data = await res.json();
    const series = data['Technical Analysis: SMA'];
    if (!series) { console.log(`[Alert Check] No SMA(${period}) data for ${symbol}`); return null; }
    const latestDate = Object.keys(series)[0];
    return parseFloat(series[latestDate]['SMA']);
  } catch (e) {
    console.error(`[Alert Check] SMA(${period}) fetch failed for ${symbol}:`, e);
    return null;
  }
}

async function fetchOverview(symbol: string): Promise<{ avgVolume: number | null }> {
  if (!ALPHA_VANTAGE_API_KEY) return { avgVolume: null };
  try {
    const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) { await res.text(); return { avgVolume: null }; }
    const data = await res.json();
    const avg = data['200DayMovingAverage'] ? null : null; // not in OVERVIEW
    // Use AnalystRatingStrongBuy field presence to confirm valid response
    const vol = data['SharesOutstanding'] ? parseFloat(data['SharesOutstanding']) : null;
    // OVERVIEW doesn't have avg daily volume directly; use a quote approach instead
    return { avgVolume: null };
  } catch (e) {
    console.error(`[Alert Check] Overview fetch failed for ${symbol}:`, e);
    return { avgVolume: null };
  }
}

async function fetchQuote(symbol: string): Promise<{ avgVolume: number | null; volume: number | null }> {
  if (!ALPHA_VANTAGE_API_KEY) return { avgVolume: null, volume: null };
  try {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) { await res.text(); return { avgVolume: null, volume: null }; }
    const data = await res.json();
    const quote = data['Global Quote'];
    if (!quote) return { avgVolume: null, volume: null };
    const volume = parseFloat(quote['06. volume']) || null;
    // Alpha Vantage GLOBAL_QUOTE doesn't have avg volume; we'll use a heuristic
    return { avgVolume: null, volume };
  } catch (e) {
    console.error(`[Alert Check] Quote fetch failed for ${symbol}:`, e);
    return { avgVolume: null, volume: null };
  }
}

/**
 * Fetch all needed technical indicators for a set of symbols.
 * Batches API calls with small delays to respect rate limits (~5/min free tier).
 */
async function fetchTechnicalDataBatch(
  symbols: string[],
  alertTypes: Map<string, Set<string>>
): Promise<Map<string, TechnicalData>> {
  const result = new Map<string, TechnicalData>();

  for (const symbol of symbols) {
    const types = alertTypes.get(symbol) || new Set();
    const data: TechnicalData = {};

    if (types.has('rsi_threshold')) {
      data.rsi = (await fetchRSI(symbol)) ?? undefined;
      await delay(1200); // rate limit
    }

    if (types.has('ma_crossover')) {
      data.sma50 = (await fetchSMA(symbol, 50)) ?? undefined;
      await delay(1200);
      data.sma200 = (await fetchSMA(symbol, 200)) ?? undefined;
      await delay(1200);
    }

    // volume_spike: we compare cache volume against a threshold multiplier
    // No additional API call needed; we use the volume from market_data_cache
    // The threshold_percent represents the minimum volume (e.g., 200% means current volume
    // must be >= 2x the average). Since we don't have historical avg volume easily,
    // we'll use a simple approach: compare current volume from the cache with the
    // threshold as an absolute percentage of average. We'll fetch avg volume from
    // Alpha Vantage's SMA if available, or fall back to comparing against a baseline.

    result.set(symbol, data);
  }

  return result;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Email sender ──────────────────────────────────────────────────────

async function sendAlertEmail(email: string, alerts: TriggeredAlert[]) {
  if (!RESEND_API_KEY) {
    console.log('[Alert Check] No RESEND_API_KEY configured');
    return false;
  }

  const alertsHtml = alerts.map(alert => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #333; color: #fff;">
        <strong>${alert.symbol}</strong>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #333; color: #fff;">
        ${alert.alert_type.replace(/_/g, ' ').toUpperCase()}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #333; color: #fff;">
        $${alert.currentPrice.toFixed(2)}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #333; color: ${alert.changePercent >= 0 ? '#4ade80' : '#f87171'};">
        ${alert.changePercent >= 0 ? '+' : ''}${alert.changePercent.toFixed(2)}%
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #333; color: #888;">
        ${alert.triggerDetail}
      </td>
    </tr>
  `).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><title>Portfolio Alerts</title></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #0a0a0a;">
        <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="margin: 0; color: #fff; font-size: 24px;">🔔 Portfolio Alerts Triggered</h1>
          </div>
          <p style="font-size: 16px; line-height: 1.6; color: #ccc; margin-bottom: 24px;">
            ${alerts.length} alert${alerts.length > 1 ? 's have' : ' has'} been triggered:
          </p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: rgba(0,0,0,0.2); border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background: rgba(255,255,255,0.1);">
                <th style="padding: 12px; text-align: left; color: #fff; font-weight: 600;">Symbol</th>
                <th style="padding: 12px; text-align: left; color: #fff; font-weight: 600;">Type</th>
                <th style="padding: 12px; text-align: left; color: #fff; font-weight: 600;">Price</th>
                <th style="padding: 12px; text-align: left; color: #fff; font-weight: 600;">Change</th>
                <th style="padding: 12px; text-align: left; color: #fff; font-weight: 600;">Detail</th>
              </tr>
            </thead>
            <tbody>${alertsHtml}</tbody>
          </table>
          <div style="margin-top: 24px; padding: 16px; background: rgba(255,255,255,0.05); border-radius: 8px;">
            <p style="font-size: 14px; color: #888; margin: 0;">
              Triggered at ${new Date().toLocaleString('en-US', {
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
              })}
            </p>
          </div>
          <p style="font-size: 12px; color: #666; margin-top: 20px; text-align: center;">
            Manage your alerts in the Analytics → Alerts section of your WealthOS dashboard.
          </p>
        </div>
      </body>
    </html>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "WealthOS Alerts <alerts@resend.dev>",
        to: [email],
        subject: `🔔 ${alerts.length} Alert${alerts.length > 1 ? 's' : ''} Triggered – ${alerts.map(a => a.symbol).join(', ')}`,
        html: htmlContent,
      }),
    });

    if (response.ok) {
      console.log(`[Alert Check] Email sent to ${email}`);
      return true;
    } else {
      console.error(`[Alert Check] Email failed:`, await response.text());
      return false;
    }
  } catch (error) {
    console.error(`[Alert Check] Email error:`, error);
    return false;
  }
}

// ── Alert evaluation logic ────────────────────────────────────────────

interface EvalContext {
  price: number;
  changePercent: number;
  volume: number | null;
  technical: TechnicalData;
}

interface EvalResult {
  triggered: boolean;
  detail: string;
}

function evaluateAlert(alert: any, ctx: EvalContext): EvalResult {
  switch (alert.alert_type) {
    // ── Price movement ──
    case 'price_movement': {
      if (alert.threshold_percent && Math.abs(ctx.changePercent) >= alert.threshold_percent) {
        return {
          triggered: true,
          detail: `Price moved ${ctx.changePercent >= 0 ? '+' : ''}${ctx.changePercent.toFixed(2)}% (threshold ±${alert.threshold_percent}%)`,
        };
      }
      return { triggered: false, detail: '' };
    }

    // ── Volume spike ──
    case 'volume_spike': {
      // threshold_percent represents multiplier (e.g., 200 = 2x normal volume)
      // We compare current volume against the alert's trigger_value (last known avg volume)
      // or against a reasonable baseline if no trigger_value exists
      if (!ctx.volume || ctx.volume === 0) {
        console.log(`[Alert Check] No volume data for ${alert.symbol}`);
        return { triggered: false, detail: 'No volume data' };
      }
      // Use threshold_percent as a raw volume threshold check:
      // If threshold_percent is e.g. 200, we check if volume > 200% of a reference
      // Since we may not have historical avg volume, we use a simpler approach:
      // If the alert has a trigger_value set (from previous run), compare against it
      // Otherwise, store current volume as baseline for future comparisons
      const baselineVolume = alert.trigger_value || 0;
      if (baselineVolume > 0 && alert.threshold_percent) {
        const multiplier = alert.threshold_percent / 100;
        if (ctx.volume >= baselineVolume * multiplier) {
          return {
            triggered: true,
            detail: `Volume ${(ctx.volume / 1000000).toFixed(1)}M is ${(ctx.volume / baselineVolume * 100).toFixed(0)}% of avg (threshold ${alert.threshold_percent}%)`,
          };
        }
      }
      return { triggered: false, detail: '' };
    }

    // ── RSI threshold ──
    case 'rsi_threshold': {
      if (ctx.technical.rsi == null) {
        console.log(`[Alert Check] No RSI data for ${alert.symbol}`);
        return { triggered: false, detail: 'No RSI data' };
      }
      const threshold = alert.threshold_percent || 70;
      // RSI > threshold → overbought; RSI < (100 - threshold) → oversold
      if (ctx.technical.rsi >= threshold) {
        return {
          triggered: true,
          detail: `RSI at ${ctx.technical.rsi.toFixed(1)} (overbought ≥${threshold})`,
        };
      }
      const oversoldLevel = 100 - threshold;
      if (ctx.technical.rsi <= oversoldLevel) {
        return {
          triggered: true,
          detail: `RSI at ${ctx.technical.rsi.toFixed(1)} (oversold ≤${oversoldLevel})`,
        };
      }
      return { triggered: false, detail: '' };
    }

    // ── MA crossover ──
    case 'ma_crossover': {
      const { sma50, sma200 } = ctx.technical;
      if (sma50 == null || sma200 == null) {
        console.log(`[Alert Check] Missing MA data for ${alert.symbol} (SMA50=${sma50}, SMA200=${sma200})`);
        return { triggered: false, detail: 'Missing MA data' };
      }
      // Golden cross: price above both MAs, SMA50 > SMA200
      if (sma50 > sma200 && ctx.price > sma50) {
        return {
          triggered: true,
          detail: `Golden Cross! SMA50 ($${sma50.toFixed(2)}) > SMA200 ($${sma200.toFixed(2)}), Price $${ctx.price.toFixed(2)}`,
        };
      }
      // Death cross: SMA50 < SMA200 and price below both
      if (sma50 < sma200 && ctx.price < sma50) {
        return {
          triggered: true,
          detail: `Death Cross! SMA50 ($${sma50.toFixed(2)}) < SMA200 ($${sma200.toFixed(2)}), Price $${ctx.price.toFixed(2)}`,
        };
      }
      return { triggered: false, detail: '' };
    }

    // Stub types (no evaluation yet)
    case 'dividend_cut':
    case 'dividend_increase':
    case 'earnings_surprise':
      return { triggered: false, detail: '' };

    default:
      return { triggered: false, detail: '' };
  }
}

// ── Main handler ──────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[Alert Check] Starting portfolio alert check...');

    // 1. Get all active alerts
    const alerts = await supabaseQuery('portfolio_alerts?is_active=eq.true&select=*');
    if (!alerts || alerts.length === 0) {
      console.log('[Alert Check] No active alerts to check');
      return new Response(
        JSON.stringify({ success: true, message: 'No active alerts', triggered: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log(`[Alert Check] Found ${alerts.length} active alerts`);

    // 2. Get unique symbols and determine which technical indicators are needed
    const symbols = [...new Set(alerts.map((a: any) => a.symbol.toUpperCase()))];
    const alertTypesBySymbol = new Map<string, Set<string>>();
    for (const alert of alerts) {
      const sym = alert.symbol.toUpperCase();
      if (!alertTypesBySymbol.has(sym)) alertTypesBySymbol.set(sym, new Set());
      alertTypesBySymbol.get(sym)!.add(alert.alert_type);
    }

    // 3. Fetch cached market data
    const symbolList = symbols.map(s => `"${s}"`).join(',');
    const priceData = await supabaseQuery(
      `market_data_cache?symbol=in.(${symbolList})&select=symbol,price,change_percent,volume`
    );

    type PricePoint = { price: number; changePercent: number | null; volume: number | null };
    const priceMap = new Map<string, PricePoint>(
      (priceData || []).map((p: any) => [
        String(p.symbol).toUpperCase(),
        {
          price: Number(p.price),
          changePercent: p.change_percent == null ? null : Number(p.change_percent),
          volume: p.volume == null ? null : Number(p.volume),
        },
      ])
    );

    // 4. Determine if we need technical data for any alert types
    const needsTechnical = alerts.some((a: any) =>
      ['rsi_threshold', 'ma_crossover'].includes(a.alert_type)
    );

    // Only fetch technical data for symbols that actually need it
    const technicalSymbols = symbols.filter(sym => {
      const types = alertTypesBySymbol.get(sym) || new Set();
      return types.has('rsi_threshold') || types.has('ma_crossover');
    });

    let technicalData = new Map<string, TechnicalData>();
    if (needsTechnical && technicalSymbols.length > 0) {
      console.log(`[Alert Check] Fetching technical data for: ${technicalSymbols.join(', ')}`);
      technicalData = await fetchTechnicalDataBatch(technicalSymbols, alertTypesBySymbol);
    }

    // 5. For volume_spike alerts without a baseline, set the current volume as baseline
    const volumeSpikeAlerts = alerts.filter(
      (a: any) => a.alert_type === 'volume_spike' && !a.trigger_value
    );
    for (const alert of volumeSpikeAlerts) {
      const symData = priceMap.get(alert.symbol.toUpperCase());
      if (symData?.volume) {
        console.log(`[Alert Check] Setting volume baseline for ${alert.symbol}: ${symData.volume}`);
        await supabaseQuery(`portfolio_alerts?id=eq.${alert.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ trigger_value: symData.volume }),
          headers: { 'Prefer': 'return=minimal' },
        });
        // Update the alert object so the evaluation uses it
        alert.trigger_value = symData.volume;
      }
    }

    // 6. Evaluate each alert
    const triggeredAlerts: TriggeredAlert[] = [];

    for (const alert of alerts) {
      const sym = alert.symbol.toUpperCase();
      const symData = priceMap.get(sym);
      if (!symData) continue;

      const ctx: EvalContext = {
        price: symData.price,
        changePercent: symData.changePercent ?? 0,
        volume: symData.volume,
        technical: technicalData.get(sym) || {},
      };

      const result = evaluateAlert(alert, ctx);

      if (result.triggered) {
        console.log(`[Alert Check] TRIGGERED: ${alert.symbol} ${alert.alert_type} – ${result.detail}`);

        // Get user email
        const profiles = await supabaseQuery(`profiles?id=eq.${alert.user_id}&select=email`);
        const profile = profiles?.[0];

        triggeredAlerts.push({
          ...alert,
          currentPrice: ctx.price,
          changePercent: ctx.changePercent,
          triggerDetail: result.detail,
          email: profile?.email,
        });

        // Update alert as triggered
        await supabaseQuery(`portfolio_alerts?id=eq.${alert.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            triggered_at: new Date().toISOString(),
            trigger_value: ctx.price,
          }),
          headers: { 'Prefer': 'return=minimal' },
        });
      }
    }

    console.log(`[Alert Check] ${triggeredAlerts.length} alerts triggered`);

    // 7. Group alerts by user → send emails + webhooks
    const alertsByUser = new Map<string, TriggeredAlert[]>();
    for (const alert of triggeredAlerts) {
      if (!alertsByUser.has(alert.user_id)) alertsByUser.set(alert.user_id, []);
      alertsByUser.get(alert.user_id)!.push(alert);
    }

    let emailsSent = 0;
    let webhooksSent = 0;

    for (const [userId, userAlerts] of alertsByUser) {
      // Send email
      let emailSuccess = false;
      const emailAlert = userAlerts.find(a => a.email);
      if (emailAlert?.email) {
        emailSuccess = await sendAlertEmail(emailAlert.email, userAlerts);
        if (emailSuccess) emailsSent++;
      }

      // Send webhook notifications
      let webhookSuccess = false;
      for (const alert of userAlerts) {
        try {
          const webhookPayload = {
            type: 'portfolio_alert',
            userId,
            data: {
              symbol: alert.symbol,
              alertType: alert.alert_type,
              currentPrice: alert.currentPrice,
              changePercent: alert.changePercent,
              message: `${alert.symbol} – ${alert.triggerDetail}`,
              triggeredAt: new Date().toISOString(),
            },
          };

          const webhookResponse = await fetch(
            `${SUPABASE_URL}/functions/v1/webhook-notify`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify(webhookPayload),
            }
          );

          if (webhookResponse.ok) {
            const res = await webhookResponse.json();
            const sent = res.sent || 0;
            webhooksSent += sent;
            if (sent > 0) webhookSuccess = true;
          } else {
            await webhookResponse.text();
          }
        } catch (webhookError) {
          console.error('[Alert Check] Webhook error:', webhookError);
        }
      }

      // Log each triggered alert to alert_history
      for (const alert of userAlerts) {
        try {
          await supabaseQuery('alert_history', {
            method: 'POST',
            body: JSON.stringify({
              user_id: userId,
              alert_id: alert.id,
              symbol: alert.symbol,
              alert_type: alert.alert_type,
              threshold_percent: alert.threshold_percent,
              trigger_value: alert.currentPrice,
              trigger_details: alert.triggerDetail,
              triggered_at: new Date().toISOString(),
              notification_email_sent: emailSuccess,
              notification_webhook_sent: webhookSuccess,
              notification_push_sent: false,
              notification_sms_sent: false,
            }),
            headers: { 'Prefer': 'return=minimal' },
          });
          console.log(`[Alert Check] Logged history for ${alert.symbol} ${alert.alert_type}`);
        } catch (historyError) {
          console.error('[Alert Check] Failed to log alert history:', historyError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        alertsChecked: alerts.length,
        triggered: triggeredAlerts.length,
        emailsSent,
        webhooksSent,
        triggeredSymbols: triggeredAlerts.map(a => a.symbol),
        details: triggeredAlerts.map(a => ({
          symbol: a.symbol,
          type: a.alert_type,
          detail: a.triggerDetail,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Alert Check] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
