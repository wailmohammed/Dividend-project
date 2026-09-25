import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface DividendReminder {
  id: string;
  symbol: string;
  amount: number;
  ex_date: string;
  pay_date: string | null;
  portfolio_id: string;
  user_id: string;
  email: string;
  type: 'ex_date' | 'pay_date';
  days_until: number;
}

// Send dividend reminder emails
async function sendDividendReminderEmails(reminders: DividendReminder[]) {
  if (!RESEND_API_KEY || reminders.length === 0) {
    console.log('[Dividend Reminders] No API key or no reminders to send');
    return { sent: 0, failed: 0 };
  }

  // Group reminders by user
  const remindersByUser = new Map<string, DividendReminder[]>();
  for (const reminder of reminders) {
    if (!remindersByUser.has(reminder.user_id)) {
      remindersByUser.set(reminder.user_id, []);
    }
    remindersByUser.get(reminder.user_id)!.push(reminder);
  }

  let sent = 0;
  let failed = 0;

  for (const [userId, userReminders] of remindersByUser) {
    const email = userReminders[0].email;
    if (!email) {
      console.log(`[Dividend Reminders] No email for user ${userId}`);
      continue;
    }

    const exDateReminders = userReminders.filter(r => r.type === 'ex_date');
    const payDateReminders = userReminders.filter(r => r.type === 'pay_date');

    const exDateHtml = exDateReminders.length > 0 ? `
      <div style="margin: 20px 0;">
        <h2 style="color: #f59e0b; margin-bottom: 15px;">📅 Upcoming Ex-Dividend Dates</h2>
        <p style="color: #ccc; margin-bottom: 10px;">Buy before these dates to receive the dividend:</p>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: rgba(245, 158, 11, 0.2);">
              <th style="padding: 12px; text-align: left; color: #fff;">Symbol</th>
              <th style="padding: 12px; text-align: left; color: #fff;">Ex-Date</th>
              <th style="padding: 12px; text-align: left; color: #fff;">Days Until</th>
              <th style="padding: 12px; text-align: right; color: #fff;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${exDateReminders.map(r => `
              <tr style="border-bottom: 1px solid #333;">
                <td style="padding: 12px; color: #fff;"><strong>${r.symbol}</strong></td>
                <td style="padding: 12px; color: #ccc;">${new Date(r.ex_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                <td style="padding: 12px; color: #f59e0b;">${r.days_until} days</td>
                <td style="padding: 12px; text-align: right; color: #4ade80;">$${r.amount.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '';

    const payDateHtml = payDateReminders.length > 0 ? `
      <div style="margin: 20px 0;">
        <h2 style="color: #4ade80; margin-bottom: 15px;">💰 Upcoming Dividend Payments</h2>
        <p style="color: #ccc; margin-bottom: 10px;">These dividends will be credited to your account:</p>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: rgba(74, 222, 128, 0.2);">
              <th style="padding: 12px; text-align: left; color: #fff;">Symbol</th>
              <th style="padding: 12px; text-align: left; color: #fff;">Pay Date</th>
              <th style="padding: 12px; text-align: left; color: #fff;">Days Until</th>
              <th style="padding: 12px; text-align: right; color: #fff;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${payDateReminders.map(r => `
              <tr style="border-bottom: 1px solid #333;">
                <td style="padding: 12px; color: #fff;"><strong>${r.symbol}</strong></td>
                <td style="padding: 12px; color: #ccc;">${r.pay_date ? new Date(r.pay_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}</td>
                <td style="padding: 12px; color: #4ade80;">${r.days_until} days</td>
                <td style="padding: 12px; text-align: right; color: #4ade80;">$${r.amount.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '';

    const totalAmount = userReminders.reduce((sum, r) => sum + r.amount, 0);

    const htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; background: #0a0a0a; color: #fff;">
          <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 10px;">
            <h1 style="margin-bottom: 10px; color: #fff;">📊 Dividend Reminder</h1>
            <p style="color: #ccc; margin-bottom: 20px;">
              You have ${userReminders.length} upcoming dividend event${userReminders.length > 1 ? 's' : ''} in the next 3 days.
            </p>
            
            <div style="background: rgba(74, 222, 128, 0.1); padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid rgba(74, 222, 128, 0.3);">
              <p style="margin: 0; font-size: 18px; color: #fff;">
                💵 Total Expected: <strong style="color: #4ade80;">$${totalAmount.toFixed(2)}</strong>
              </p>
            </div>
            
            ${exDateHtml}
            ${payDateHtml}
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #333;">
              <p style="font-size: 12px; color: #666;">
                This is an automated reminder from WealthOS. Dividend amounts are estimates and may vary.
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
          from: "WealthOS <dividends@resend.dev>",
          to: [email],
          subject: `💰 Dividend Reminder: ${userReminders.length} event${userReminders.length > 1 ? 's' : ''} in the next 3 days - $${totalAmount.toFixed(2)} expected`,
          html: htmlContent,
        }),
      });

      if (response.ok) {
        console.log(`[Dividend Reminders] Email sent to ${email}`);
        sent++;
      } else {
        console.error(`[Dividend Reminders] Email failed:`, await response.text());
        failed++;
      }
    } catch (error) {
      console.error(`[Dividend Reminders] Email error:`, error);
      failed++;
    }
  }

  return { sent, failed };
}

async function createInAppDividendNotifications(supabaseClient: any, reminders: DividendReminder[]) {
  if (!reminders.length) return 0;

  const remindersByUser = new Map<string, DividendReminder[]>();
  for (const reminder of reminders) {
    if (!remindersByUser.has(reminder.user_id)) remindersByUser.set(reminder.user_id, []);
    remindersByUser.get(reminder.user_id)!.push(reminder);
  }

  const inserts = Array.from(remindersByUser.entries()).map(([userId, userReminders]) => {
    const totalAmount = userReminders.reduce((sum, r) => sum + r.amount, 0);
    const count = userReminders.length;

    return {
      user_id: userId,
      actor_id: userId,
      type: 'dividend',
      target_id: null,
      content: `Dividend reminder: ${count} event${count === 1 ? '' : 's'} in the next 3 days (~$${totalAmount.toFixed(2)}).`,
      is_read: false,
    };
  });

  const { error } = await supabaseClient.from('notifications').insert(inserts);
  if (error) {
    console.error('[Dividend Reminders] Failed to create in-app notifications:', error.message);
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
    console.log('[Dividend Reminders] Starting dividend reminder check...');

    const today = new Date();
    const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
    const todayStr = today.toISOString().split('T')[0];
    const threeDaysStr = threeDaysFromNow.toISOString().split('T')[0];

    console.log(`[Dividend Reminders] Checking dates from ${todayStr} to ${threeDaysStr}`);

    // Get all dividends with ex_date in the next 3 days
    const { data: exDateDividends, error: exError } = await supabase
      .from('dividends')
      .select(`
        id, symbol, amount, ex_date, pay_date, portfolio_id,
        portfolios!inner(user_id, profiles:user_id(email))
      `)
      .gte('ex_date', todayStr)
      .lte('ex_date', threeDaysStr);

    if (exError) {
      console.error('[Dividend Reminders] Ex-date query error:', exError.message);
    }

    // Get all dividends with pay_date in the next 3 days
    const { data: payDateDividends, error: payError } = await supabase
      .from('dividends')
      .select(`
        id, symbol, amount, ex_date, pay_date, portfolio_id,
        portfolios!inner(user_id, profiles:user_id(email))
      `)
      .gte('pay_date', todayStr)
      .lte('pay_date', threeDaysStr);

    if (payError) {
      console.error('[Dividend Reminders] Pay-date query error:', payError.message);
    }

    // Get users who have dividend email alerts enabled
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('user_id, email_dividend_alerts')
      .eq('email_dividend_alerts', true);

    const enabledUsers = new Set(prefs?.map(p => p.user_id) || []);
    console.log(`[Dividend Reminders] ${enabledUsers.size} users have dividend alerts enabled`);

    const reminders: DividendReminder[] = [];

    // Process ex-date reminders
    for (const div of (exDateDividends || [])) {
      const userId = (div.portfolios as any)?.user_id;
      const email = (div.portfolios as any)?.profiles?.email;
      
      if (!userId || !enabledUsers.has(userId)) continue;
      
      const exDate = new Date(div.ex_date);
      const daysUntil = Math.ceil((exDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
      
      reminders.push({
        id: div.id,
        symbol: div.symbol,
        amount: Number(div.amount),
        ex_date: div.ex_date,
        pay_date: div.pay_date,
        portfolio_id: div.portfolio_id,
        user_id: userId,
        email: email,
        type: 'ex_date',
        days_until: daysUntil,
      });
    }

    // Process pay-date reminders
    for (const div of (payDateDividends || [])) {
      const userId = (div.portfolios as any)?.user_id;
      const email = (div.portfolios as any)?.profiles?.email;
      
      if (!userId || !enabledUsers.has(userId)) continue;
      if (!div.pay_date) continue;
      
      const payDate = new Date(div.pay_date);
      const daysUntil = Math.ceil((payDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
      
      // Don't duplicate if already added as ex-date reminder
      const existingReminder = reminders.find(r => r.id === div.id);
      if (!existingReminder) {
        reminders.push({
          id: div.id,
          symbol: div.symbol,
          amount: Number(div.amount),
          ex_date: div.ex_date,
          pay_date: div.pay_date,
          portfolio_id: div.portfolio_id,
          user_id: userId,
          email: email,
          type: 'pay_date',
          days_until: daysUntil,
        });
      }
    }

    console.log(`[Dividend Reminders] Found ${reminders.length} reminders to send`);

    const result = await sendDividendReminderEmails(reminders);
    const inAppCreated = await createInAppDividendNotifications(supabase, reminders);

    console.log(`[Dividend Reminders] Complete: ${result.sent} sent, ${result.failed} failed, ${inAppCreated} in-app created`);

    return new Response(
      JSON.stringify({
        success: true,
        remindersFound: reminders.length,
        emailsSent: result.sent,
        emailsFailed: result.failed,
        inAppNotificationsCreated: inAppCreated,
        checkedDate: todayStr,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Dividend Reminders] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});