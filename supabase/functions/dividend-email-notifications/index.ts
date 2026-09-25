import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const results = { dividendAlerts: 0, refreshFailureAlerts: 0, errors: [] as string[] };

    // 1. Check for upcoming dividends (next 7 days)
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { data: upcomingDividends, error: divError } = await supabase
      .from('dividends')
      .select(`
        *,
        holdings!inner(name, symbol, shares, portfolio_id, portfolios!inner(user_id))
      `)
      .gte('ex_date', today.toISOString().split('T')[0])
      .lte('ex_date', nextWeek.toISOString().split('T')[0]);

    if (divError) {
      results.errors.push(`Dividend fetch error: ${divError.message}`);
    }

    // Group dividends by user
    const userDividends = new Map<string, any[]>();
    if (upcomingDividends) {
      for (const div of upcomingDividends) {
        const userId = div.holdings?.portfolios?.user_id;
        if (userId) {
          if (!userDividends.has(userId)) {
            userDividends.set(userId, []);
          }
          userDividends.get(userId)!.push(div);
        }
      }
    }

    // Send dividend alerts to users who have email_dividend_alerts enabled
    for (const [userId, dividends] of userDividends) {
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('email_dividend_alerts')
        .eq('user_id', userId)
        .single();

      if (!prefs?.email_dividend_alerts) continue;

      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', userId)
        .single();

      if (!profile?.email) continue;

      // Build email content
      const dividendList = dividends.map(d => 
        `• ${d.symbol}: $${d.amount.toFixed(2)} (Ex-date: ${d.ex_date})`
      ).join('\n');

      const totalAmount = dividends.reduce((sum, d) => sum + d.amount, 0);

      if (resendApiKey) {
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: 'Portfolio Tracker <notifications@resend.dev>',
              to: [profile.email],
              subject: `📈 ${dividends.length} Upcoming Dividend Payment${dividends.length > 1 ? 's' : ''}`,
              html: `
                <h2>Hello ${profile.full_name || 'Investor'}!</h2>
                <p>You have upcoming dividend payments in the next 7 days:</p>
                <pre style="background: #f4f4f4; padding: 16px; border-radius: 8px;">${dividendList}</pre>
                <p><strong>Total Expected: $${totalAmount.toFixed(2)}</strong></p>
                <p>Log in to your portfolio to see more details.</p>
              `,
            }),
          });

          if (res.ok) {
            results.dividendAlerts++;
          } else {
            const error = await res.text();
            results.errors.push(`Resend error for ${userId}: ${error}`);
          }
        } catch (e: any) {
          results.errors.push(`Email send error: ${e.message}`);
        }
      }
    }

    // 2. Check for recent market refresh failures
    const { data: recentFailures } = await supabase
      .from('market_sync_logs')
      .select('*')
      .gt('error_count', 0)
      .gte('created_at', new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentFailures && recentFailures.length > 0) {
      // Get all users with security alerts enabled
      const { data: usersWithAlerts } = await supabase
        .from('notification_preferences')
        .select('user_id')
        .eq('email_security_alerts', true);

      if (usersWithAlerts && resendApiKey) {
        for (const { user_id } of usersWithAlerts) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', user_id)
            .single();

          if (!profile?.email) continue;

          const failureList = recentFailures.map(f =>
            `• ${new Date(f.created_at).toLocaleString()}: ${f.error_count} errors - ${f.error_message || 'Unknown error'}`
          ).join('\n');

          try {
            const res = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resendApiKey}`,
              },
              body: JSON.stringify({
                from: 'Portfolio Tracker <notifications@resend.dev>',
                to: [profile.email],
                subject: '⚠️ Market Data Refresh Failures Detected',
                html: `
                  <h2>Hello ${profile.full_name || 'Admin'}!</h2>
                  <p>There have been market data refresh failures in the last 24 hours:</p>
                  <pre style="background: #fff3cd; padding: 16px; border-radius: 8px; color: #856404;">${failureList}</pre>
                  <p>Please check the Market Sync dashboard for more details.</p>
                `,
              }),
            });

            if (res.ok) {
              results.refreshFailureAlerts++;
            }
          } catch (e: any) {
            results.errors.push(`Failure alert error: ${e.message}`);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Email notification error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
