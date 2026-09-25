import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface HarvestCandidate {
  symbol: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedLoss: number;
  unrealizedLossPercent: number;
  potentialTaxSavings: number;
  isLongTerm: boolean;
}

interface UserHarvestData {
  userId: string;
  email: string;
  fullName: string | null;
  candidates: HarvestCandidate[];
  totalLoss: number;
  totalTaxSavings: number;
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

// Send tax-loss harvesting reminder email
async function sendHarvestReminderEmail(userData: UserHarvestData): Promise<boolean> {
  if (!RESEND_API_KEY || !userData.email) return false;

  const candidatesHtml = userData.candidates
    .slice(0, 10) // Limit to top 10
    .map(c => `
      <tr style="border-bottom: 1px solid #333;">
        <td style="padding: 12px; color: #fff;"><strong>${c.symbol}</strong></td>
        <td style="padding: 12px; text-align: right; color: #ef4444;">-$${Math.abs(c.unrealizedLoss).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="padding: 12px; text-align: right; color: #ef4444;">${c.unrealizedLossPercent.toFixed(1)}%</td>
        <td style="padding: 12px; text-align: right; color: #22c55e;">$${c.potentialTaxSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="padding: 12px; text-align: center;">
          <span style="background: ${c.isLongTerm ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)'}; color: ${c.isLongTerm ? '#3b82f6' : '#f59e0b'}; padding: 4px 8px; border-radius: 4px; font-size: 11px;">
            ${c.isLongTerm ? 'Long-term' : 'Short-term'}
          </span>
        </td>
      </tr>
    `).join('');

  const daysUntilYearEnd = Math.ceil((new Date(new Date().getFullYear(), 11, 31).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const htmlContent = `
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; background: #0a0a0a; color: #fff;">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 10px;">
          <h1 style="margin-bottom: 10px; color: #fff;">✂️ Tax-Loss Harvesting Opportunity</h1>
          <p style="color: #ccc; margin-bottom: 20px;">
            ${userData.fullName ? `Hi ${userData.fullName},` : 'Hi,'} you have ${userData.candidates.length} position${userData.candidates.length === 1 ? '' : 's'} with unrealized losses that could be harvested before year-end.
          </p>
          
          <div style="display: flex; gap: 15px; margin-bottom: 25px;">
            <div style="flex: 1; background: rgba(239, 68, 68, 0.1); padding: 15px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.3);">
              <p style="color: #ef4444; font-size: 12px; margin: 0 0 5px 0;">Total Harvestable Loss</p>
              <p style="color: #fff; font-size: 24px; font-weight: bold; margin: 0;">-$${Math.abs(userData.totalLoss).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div style="flex: 1; background: rgba(34, 197, 94, 0.1); padding: 15px; border-radius: 8px; border: 1px solid rgba(34, 197, 94, 0.3);">
              <p style="color: #22c55e; font-size: 12px; margin: 0 0 5px 0;">Potential Tax Savings</p>
              <p style="color: #fff; font-size: 24px; font-weight: bold; margin: 0;">$${userData.totalTaxSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>

          <div style="background: rgba(245, 158, 11, 0.1); padding: 12px 15px; border-radius: 8px; border: 1px solid rgba(245, 158, 11, 0.3); margin-bottom: 20px;">
            <p style="margin: 0; color: #f59e0b; font-size: 14px;">
              ⏰ <strong>${daysUntilYearEnd} days</strong> remaining until year-end. Act soon to realize losses in this tax year!
            </p>
          </div>
          
          <h2 style="color: #fff; font-size: 16px; margin-bottom: 15px;">Top Harvest Candidates</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: rgba(255, 255, 255, 0.1);">
                <th style="padding: 12px; text-align: left; color: #ccc;">Symbol</th>
                <th style="padding: 12px; text-align: right; color: #ccc;">Unrealized Loss</th>
                <th style="padding: 12px; text-align: right; color: #ccc;">Loss %</th>
                <th style="padding: 12px; text-align: right; color: #ccc;">Tax Savings*</th>
                <th style="padding: 12px; text-align: center; color: #ccc;">Term</th>
              </tr>
            </thead>
            <tbody>
              ${candidatesHtml}
            </tbody>
          </table>
          
          ${userData.candidates.length > 10 ? `
            <p style="color: #666; font-size: 12px; margin-top: 10px;">
              And ${userData.candidates.length - 10} more positions...
            </p>
          ` : ''}

          <div style="margin-top: 25px; padding: 15px; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3);">
            <h3 style="color: #3b82f6; font-size: 14px; margin: 0 0 10px 0;">💡 Tax-Loss Harvesting Tips</h3>
            <ul style="color: #ccc; font-size: 12px; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 5px;">Realized losses can offset capital gains dollar-for-dollar</li>
              <li style="margin-bottom: 5px;">Up to $3,000 of net losses can offset ordinary income annually</li>
              <li style="margin-bottom: 5px;">Beware of wash sale rule: avoid repurchasing same security within 30 days</li>
              <li>Consider replacing sold positions with similar (not identical) investments</li>
            </ul>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #333;">
            <p style="font-size: 11px; color: #666;">
              *Tax savings estimated at 35% marginal rate (22% for long-term gains). Actual savings depend on your tax situation.
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
        subject: `✂️ Tax-Loss Harvesting Alert: $${Math.abs(userData.totalLoss).toLocaleString()} in harvestable losses (${daysUntilYearEnd} days left)`,
        html: htmlContent,
      }),
    });

    if (response.ok) {
      console.log(`[Tax-Loss Reminders] Email sent to ${userData.email}`);
      return true;
    } else {
      console.error(`[Tax-Loss Reminders] Email failed:`, await response.text());
      return false;
    }
  } catch (error) {
    console.error(`[Tax-Loss Reminders] Email error:`, error);
    return false;
  }
}

// Create in-app notifications
async function createInAppNotifications(supabase: any, userDataList: UserHarvestData[]): Promise<number> {
  if (userDataList.length === 0) return 0;

  const inserts = userDataList.map(userData => ({
    user_id: userData.userId,
    actor_id: userData.userId,
    type: 'tax_alert',
    target_id: null,
    content: `Tax-loss harvesting opportunity: ${userData.candidates.length} position${userData.candidates.length === 1 ? '' : 's'} with $${Math.abs(userData.totalLoss).toLocaleString()} in harvestable losses (~$${userData.totalTaxSavings.toLocaleString()} potential tax savings).`,
    is_read: false,
  }));

  const { error } = await supabase.from('notifications').insert(inserts);
  if (error) {
    console.error('[Tax-Loss Reminders] Failed to create in-app notifications:', error.message);
    return 0;
  }

  return inserts.length;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    console.log('[Tax-Loss Reminders] Starting tax-loss harvesting reminder check...');

    // Check if we're in Q4 (October-December) - prime tax-loss harvesting season
    const now = new Date();
    const month = now.getMonth();
    const isQ4 = month >= 9; // October = 9, November = 10, December = 11
    
    // Also run in late September
    const isLateSeptember = month === 8 && now.getDate() >= 20;
    
    if (!isQ4 && !isLateSeptember) {
      console.log('[Tax-Loss Reminders] Not in tax-loss harvesting season (Q4). Skipping.');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Not in tax-loss harvesting season',
          currentMonth: month + 1,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all users with their portfolios and holdings
    const { data: portfolios, error: portfolioError } = await supabase
      .from('portfolios')
      .select(`
        id,
        user_id,
        holdings(id, symbol, shares, avg_price, current_price, created_at)
      `);

    if (portfolioError) {
      throw new Error(`Portfolio query error: ${portfolioError.message}`);
    }

    // Get all unique symbols to fetch current prices
    const allSymbols = new Set<string>();
    for (const portfolio of (portfolios || [])) {
      for (const holding of (portfolio.holdings || [])) {
        allSymbols.add(holding.symbol);
      }
    }

    // Get current market prices
    const priceMap = await getMarketPrices(supabase, Array.from(allSymbols));
    console.log(`[Tax-Loss Reminders] Got prices for ${priceMap.size} symbols`);

    // Get user profiles and notification preferences
    const userIds = [...new Set((portfolios || []).map(p => p.user_id))];
    
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds);

    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('user_id, email_price_alerts')
      .in('user_id', userIds);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    const prefsMap = new Map((prefs || []).map(p => [p.user_id, p]));

    // Calculate harvest candidates for each user
    const userHarvestDataMap = new Map<string, UserHarvestData>();
    const TAX_RATE_SHORT = 0.35;
    const TAX_RATE_LONG = 0.22;

    for (const portfolio of (portfolios || [])) {
      const userId = portfolio.user_id;
      const pref = prefsMap.get(userId);
      
      // Skip if user has disabled alerts
      if (!pref?.email_price_alerts) continue;
      
      const profile = profileMap.get(userId);
      if (!profile?.email) continue;

      if (!userHarvestDataMap.has(userId)) {
        userHarvestDataMap.set(userId, {
          userId,
          email: profile.email,
          fullName: profile.full_name,
          candidates: [],
          totalLoss: 0,
          totalTaxSavings: 0,
        });
      }

      const userData = userHarvestDataMap.get(userId)!;

      for (const holding of (portfolio.holdings || [])) {
        const currentPrice = priceMap.get(holding.symbol) || holding.current_price || holding.avg_price;
        const avgPrice = Number(holding.avg_price) || 0;
        const shares = Number(holding.shares) || 0;
        
        if (avgPrice === 0 || shares === 0) continue;

        const currentValue = shares * currentPrice;
        const costBasis = shares * avgPrice;
        const unrealizedPL = currentValue - costBasis;

        // Only consider losses greater than $100
        if (unrealizedPL >= -100) continue;

        // Calculate holding period
        const purchaseDate = new Date(holding.created_at);
        const holdingDays = Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
        const isLongTerm = holdingDays > 365;

        const taxRate = isLongTerm ? TAX_RATE_LONG : TAX_RATE_SHORT;
        const potentialTaxSavings = Math.abs(unrealizedPL) * taxRate;

        const candidate: HarvestCandidate = {
          symbol: holding.symbol,
          shares,
          avgPrice,
          currentPrice,
          unrealizedLoss: unrealizedPL,
          unrealizedLossPercent: ((avgPrice - currentPrice) / avgPrice) * 100,
          potentialTaxSavings,
          isLongTerm,
        };

        // Check if candidate already exists (from another portfolio)
        const existingIdx = userData.candidates.findIndex(c => c.symbol === holding.symbol);
        if (existingIdx >= 0) {
          // Combine if same symbol in multiple portfolios
          const existing = userData.candidates[existingIdx];
          existing.shares += candidate.shares;
          existing.unrealizedLoss += candidate.unrealizedLoss;
          existing.potentialTaxSavings += candidate.potentialTaxSavings;
        } else {
          userData.candidates.push(candidate);
        }

        userData.totalLoss += unrealizedPL;
        userData.totalTaxSavings += potentialTaxSavings;
      }
    }

    // Filter users with significant harvest opportunities ($500+ in harvestable losses)
    const usersWithOpportunities = Array.from(userHarvestDataMap.values())
      .filter(u => Math.abs(u.totalLoss) >= 500)
      .map(u => ({
        ...u,
        candidates: u.candidates.sort((a, b) => a.unrealizedLoss - b.unrealizedLoss), // Sort by loss (most negative first)
      }));

    console.log(`[Tax-Loss Reminders] Found ${usersWithOpportunities.length} users with significant harvest opportunities`);

    // Send emails and create notifications
    let emailsSent = 0;
    let emailsFailed = 0;

    for (const userData of usersWithOpportunities) {
      const success = await sendHarvestReminderEmail(userData);
      if (success) {
        emailsSent++;
      } else {
        emailsFailed++;
      }
    }

    const inAppCreated = await createInAppNotifications(supabase, usersWithOpportunities);

    console.log(`[Tax-Loss Reminders] Complete: ${emailsSent} emails sent, ${emailsFailed} failed, ${inAppCreated} in-app notifications`);

    return new Response(
      JSON.stringify({
        success: true,
        usersWithOpportunities: usersWithOpportunities.length,
        emailsSent,
        emailsFailed,
        inAppNotificationsCreated: inAppCreated,
        totalHarvestableAmount: usersWithOpportunities.reduce((sum, u) => sum + Math.abs(u.totalLoss), 0),
        totalPotentialSavings: usersWithOpportunities.reduce((sum, u) => sum + u.totalTaxSavings, 0),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Tax-Loss Reminders] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
