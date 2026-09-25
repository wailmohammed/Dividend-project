import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface LotApproachingLongTerm {
  id: string;
  symbol: string;
  shares: number;
  costBasis: number;
  purchaseDate: Date;
  daysToLongTerm: number;
  longTermDate: Date;
  unrealizedLoss: number;
  currentPrice: number;
  potentialSavings: number;
}

interface UserNotificationData {
  userId: string;
  email: string;
  fullName: string | null;
  lotsApproaching: LotApproachingLongTerm[];
  totalPotentialSavings: number;
}

// Get market prices from cache
async function getMarketPrices(supabase: any, symbols: string[]): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();
  
  if (symbols.length === 0) return priceMap;
  
  const { data } = await supabase
    .from('market_data_cache')
    .select('symbol, price')
    .in('symbol', symbols);
  
  for (const item of (data || [])) {
    priceMap.set(item.symbol, Number(item.price));
  }
  
  return priceMap;
}

// Send email notification
async function sendLongTermApproachingEmail(userData: UserNotificationData): Promise<boolean> {
  if (!RESEND_API_KEY || !userData.email) return false;

  const lotsHtml = userData.lotsApproaching
    .slice(0, 10)
    .map(lot => `
      <tr style="border-bottom: 1px solid #333;">
        <td style="padding: 12px; color: #fff;"><strong>${lot.symbol}</strong></td>
        <td style="padding: 12px; text-align: right; color: #fff;">${lot.shares}</td>
        <td style="padding: 12px; text-align: right; color: #ef4444;">
          -$${Math.abs(lot.unrealizedLoss).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
        <td style="padding: 12px; text-align: center;">
          <span style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">
            ${lot.daysToLongTerm} days
          </span>
        </td>
        <td style="padding: 12px; text-align: right; color: #22c55e;">
          +$${lot.potentialSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
      </tr>
    `).join('');

  const htmlContent = `
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; background: #0a0a0a; color: #fff;">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 10px;">
          <h1 style="margin-bottom: 10px; color: #fff;">⏰ Positions Approaching Long-Term Status</h1>
          <p style="color: #ccc; margin-bottom: 20px;">
            ${userData.fullName ? `Hi ${userData.fullName},` : 'Hi,'} ${userData.lotsApproaching.length} of your losing position${userData.lotsApproaching.length === 1 ? ' is' : 's are'} 
            approaching long-term capital gains treatment (1 year holding period).
          </p>
          
          <div style="background: rgba(34, 197, 94, 0.1); padding: 20px; border-radius: 8px; border: 1px solid rgba(34, 197, 94, 0.3); margin-bottom: 25px;">
            <p style="color: #22c55e; font-size: 14px; margin: 0 0 5px 0;">Potential Tax Savings by Waiting</p>
            <p style="color: #fff; font-size: 28px; font-weight: bold; margin: 0;">
              $${userData.totalPotentialSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p style="color: #888; font-size: 12px; margin: 8px 0 0 0;">
              Difference between short-term (up to 37%) and long-term (0-20%) tax rates
            </p>
          </div>
          
          <h2 style="color: #fff; font-size: 16px; margin-bottom: 15px;">Positions Approaching Long-Term Status</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: rgba(255, 255, 255, 0.1);">
                <th style="padding: 12px; text-align: left; color: #ccc;">Symbol</th>
                <th style="padding: 12px; text-align: right; color: #ccc;">Shares</th>
                <th style="padding: 12px; text-align: right; color: #ccc;">Unrealized Loss</th>
                <th style="padding: 12px; text-align: center; color: #ccc;">Days Left</th>
                <th style="padding: 12px; text-align: right; color: #ccc;">Savings if Wait</th>
              </tr>
            </thead>
            <tbody>
              ${lotsHtml}
            </tbody>
          </table>

          ${userData.lotsApproaching.length > 10 ? `
            <p style="color: #666; font-size: 12px; margin-top: 10px;">
              And ${userData.lotsApproaching.length - 10} more positions...
            </p>
          ` : ''}

          <div style="margin-top: 25px; padding: 15px; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3);">
            <h3 style="color: #3b82f6; font-size: 14px; margin: 0 0 10px 0;">💡 Why This Matters</h3>
            <ul style="color: #ccc; font-size: 12px; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 5px;">Short-term losses (held &lt;1 year) are taxed at ordinary income rates (up to 37%)</li>
              <li style="margin-bottom: 5px;">Long-term losses (held ≥1 year) qualify for preferential rates (0%, 15%, or 20%)</li>
              <li style="margin-bottom: 5px;">Waiting a few more days could significantly increase your tax benefit</li>
              <li>Consider your overall tax situation before making any decisions</li>
            </ul>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #333;">
            <p style="font-size: 11px; color: #666;">
              Tax savings estimated based on the difference between a 35% marginal rate (short-term) and 20% (long-term).
              Your actual savings depend on your tax bracket and situation.
            </p>
            <p style="font-size: 11px; color: #666;">
              This is for informational purposes only and does not constitute tax advice. Please consult a tax professional.
            </p>
          </div>
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
        from: "WealthOS <tax@resend.dev>",
        to: [userData.email],
        subject: `⏰ ${userData.lotsApproaching.length} Position${userData.lotsApproaching.length === 1 ? '' : 's'} Approaching Long-Term Status - Potential $${userData.totalPotentialSavings.toLocaleString()} Savings`,
        html: htmlContent,
      }),
    });

    if (response.ok) {
      console.log(`[Tax Status] Email sent to ${userData.email}`);
      return true;
    } else {
      console.error(`[Tax Status] Email failed:`, await response.text());
      return false;
    }
  } catch (error) {
    console.error(`[Tax Status] Email error:`, error);
    return false;
  }
}

// Create in-app notifications
async function createInAppNotifications(supabase: any, userDataList: UserNotificationData[]): Promise<number> {
  if (userDataList.length === 0) return 0;

  const inserts = userDataList.map(userData => {
    const firstLot = userData.lotsApproaching[0];
    const moreCount = userData.lotsApproaching.length - 1;
    
    return {
      user_id: userData.userId,
      actor_id: userData.userId,
      type: 'tax_alert',
      target_id: null,
      content: moreCount > 0 
        ? `${firstLot.symbol} and ${moreCount} other position${moreCount === 1 ? '' : 's'} approaching long-term status. Wait ${firstLot.daysToLongTerm} days for potential $${userData.totalPotentialSavings.toLocaleString()} in tax savings.`
        : `${firstLot.symbol} is ${firstLot.daysToLongTerm} days from long-term status. Waiting could save ~$${firstLot.potentialSavings.toLocaleString()} in taxes.`,
      is_read: false,
    };
  });

  const { error } = await supabase.from('notifications').insert(inserts);
  if (error) {
    console.error('[Tax Status] Failed to create in-app notifications:', error.message);
    return 0;
  }

  return inserts.length;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Check for test mode
    let testMode = false;
    let testUserId: string | null = null;
    
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        testMode = body.testMode === true;
        testUserId = body.userId || null;
      } catch {
        // No body or invalid JSON, continue with normal mode
      }
    }

    console.log(`[Tax Status] Starting position status check... ${testMode ? '(TEST MODE)' : ''}`);

    // Get all open tax lots (filter by user in test mode)
    let lotsQuery = supabase
      .from('tax_lots')
      .select('*')
      .eq('is_closed', false);

    if (testMode && testUserId) {
      lotsQuery = lotsQuery.eq('user_id', testUserId);
    }

    const { data: taxLots, error: lotsError } = await lotsQuery;

    if (lotsError) {
      throw new Error(`Tax lots query error: ${lotsError.message}`);
    }

    // Get unique symbols for price lookup
    const symbols = [...new Set((taxLots || []).map(l => l.symbol))];
    const priceMap = await getMarketPrices(supabase, symbols);

    // Get user profiles and notification preferences
    const userIds = [...new Set((taxLots || []).map(l => l.user_id))];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds);

    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('user_id, email_tax_alerts, push_tax_alerts')
      .in('user_id', userIds);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    const prefsMap = new Map((prefs || []).map(p => [p.user_id, p]));

    // Analyze lots approaching long-term status
    const today = new Date();
    const oneYear = 365;
    const SHORT_TERM_RATE = 0.35;
    const LONG_TERM_RATE = 0.20;
    // In test mode, include all positions regardless of days threshold
    const NOTIFICATION_THRESHOLD_DAYS = testMode ? 365 : 30;

    const userNotificationDataMap = new Map<string, UserNotificationData>();

    for (const lot of (taxLots || [])) {
      const userId = lot.user_id;
      const pref = prefsMap.get(userId);

      // Skip if user has disabled tax alerts (unless in test mode)
      if (!testMode) {
        const emailEnabled = pref?.email_tax_alerts ?? true;
        const pushEnabled = pref?.push_tax_alerts ?? true;
        if (!emailEnabled && !pushEnabled) continue;
      }

      const profile = profileMap.get(userId);
      if (!profile?.email) continue;

      const currentPrice = priceMap.get(lot.symbol) || 0;
      const costPerShare = Number(lot.cost_basis) / Number(lot.shares);
      const unrealizedLoss = (currentPrice - costPerShare) * Number(lot.shares);

      // Only consider losing positions (skip this check in test mode with no losses)
      if (unrealizedLoss >= 0 && !testMode) continue;

      const purchaseDate = new Date(lot.purchase_date);
      const daysHeld = Math.floor((today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysToLongTerm = Math.max(0, oneYear - daysHeld);

      // Only notify if approaching long-term (within threshold) and not yet long-term
      if (!testMode && (daysToLongTerm <= 0 || daysToLongTerm > NOTIFICATION_THRESHOLD_DAYS)) continue;

      const longTermDate = new Date(purchaseDate.getTime() + oneYear * 24 * 60 * 60 * 1000);
      const absLoss = Math.abs(unrealizedLoss);
      const potentialSavings = absLoss * (SHORT_TERM_RATE - LONG_TERM_RATE);

      if (!userNotificationDataMap.has(userId)) {
        userNotificationDataMap.set(userId, {
          userId,
          email: profile.email,
          fullName: profile.full_name,
          lotsApproaching: [],
          totalPotentialSavings: 0,
        });
      }

      const userData = userNotificationDataMap.get(userId)!;
      userData.lotsApproaching.push({
        id: lot.id,
        symbol: lot.symbol,
        shares: Number(lot.shares),
        costBasis: Number(lot.cost_basis),
        purchaseDate,
        daysToLongTerm,
        longTermDate,
        unrealizedLoss,
        currentPrice,
        potentialSavings,
      });
      userData.totalPotentialSavings += potentialSavings;
    }

    // Sort each user's lots by days to long-term
    // In test mode, skip the $50 minimum savings threshold
    const usersToNotify = Array.from(userNotificationDataMap.values())
      .filter(u => u.lotsApproaching.length > 0 && (testMode || u.totalPotentialSavings >= 50))
      .map(u => ({
        ...u,
        lotsApproaching: u.lotsApproaching.sort((a, b) => a.daysToLongTerm - b.daysToLongTerm),
      }));

    console.log(`[Tax Status] Found ${usersToNotify.length} users with positions approaching long-term`);

    // If test mode but no positions found, create a test notification anyway
    if (testMode && usersToNotify.length === 0 && testUserId) {
      const profile = profileMap.get(testUserId);
      if (profile?.email) {
        // Create a simple test in-app notification
        await supabase.from('notifications').insert({
          user_id: testUserId,
          actor_id: testUserId,
          type: 'tax_alert',
          target_id: null,
          content: '🧪 Test notification: Tax status monitoring is working correctly. You will be notified when positions approach long-term status.',
          is_read: false,
        });

        return new Response(
          JSON.stringify({
            success: true,
            testMode: true,
            message: 'Test notification created. No positions currently approaching long-term status.',
            usersNotified: 0,
            emailsSent: 0,
            inAppNotificationsCreated: 1,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Send emails
    let emailsSent = 0;
    let emailsFailed = 0;

    for (const userData of usersToNotify) {
      const pref = prefsMap.get(userData.userId);
      if (testMode || pref?.email_tax_alerts !== false) {
        const success = await sendLongTermApproachingEmail(userData);
        if (success) emailsSent++;
        else emailsFailed++;
      }
    }

    // Create in-app notifications
    const usersForPush = usersToNotify.filter(u => {
      if (testMode) return true;
      const pref = prefsMap.get(u.userId);
      return pref?.push_tax_alerts !== false;
    });
    const inAppCreated = await createInAppNotifications(supabase, usersForPush);

    console.log(`[Tax Status] Complete: ${emailsSent} emails sent, ${emailsFailed} failed, ${inAppCreated} in-app notifications`);

    return new Response(
      JSON.stringify({
        success: true,
        testMode,
        usersNotified: usersToNotify.length,
        emailsSent,
        emailsFailed,
        inAppNotificationsCreated: inAppCreated,
        totalPotentialSavings: usersToNotify.reduce((sum, u) => sum + u.totalPotentialSavings, 0),
        message: testMode 
          ? `Test complete. ${emailsSent} email(s) sent, ${inAppCreated} in-app notification(s) created.`
          : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Tax Status] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
