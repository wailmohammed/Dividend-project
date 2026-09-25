import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!resendKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    // Get all users who have updates in the last 7 days
    const { data: recentUpdates, error: updatesError } = await supabase
      .from('portfolio_updates')
      .select('*')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false });

    if (updatesError) throw updatesError;
    if (!recentUpdates?.length) {
      return new Response(JSON.stringify({ message: 'No updates in the last 7 days' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Group updates by user
    const userUpdates: Record<string, typeof recentUpdates> = {};
    for (const u of recentUpdates) {
      if (!userUpdates[u.user_id]) userUpdates[u.user_id] = [];
      userUpdates[u.user_id].push(u);
    }

    let emailsSent = 0;

    for (const [userId, updates] of Object.entries(userUpdates)) {
      // Check notification preferences
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('email_portfolio_alerts, email_weekly_summary')
        .eq('user_id', userId)
        .single();

      if (prefs?.email_portfolio_alerts === false && prefs?.email_weekly_summary === false) continue;

      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', userId)
        .single();

      if (!profile?.email) continue;

      const userName = profile.full_name || 'Investor';

      // Build summary counts
      const counts: Record<string, number> = {};
      const highImpact: typeof updates = [];
      for (const u of updates) {
        counts[u.update_type] = (counts[u.update_type] || 0) + 1;
        if (u.significance === 'high') highImpact.push(u);
      }

      const typeLabels: Record<string, string> = {
        earnings_surprise: '📊 Earnings Surprises',
        dividend_change: '💰 Dividend Changes',
        rating_upgrade: '⬆️ Rating Upgrades',
        rating_downgrade: '⬇️ Rating Downgrades',
        price_target_change: '🎯 Price Target Changes',
      };

      const summaryRows = Object.entries(counts)
        .map(([type, count]) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">${typeLabels[type] || type}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:600;text-align:right">${count}</td></tr>`)
        .join('');

      const detailRows = updates.slice(0, 15).map(u =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:600">${u.symbol}</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${u.title}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666;font-size:12px">${u.summary || ''}</td></tr>`
      ).join('');

      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#1a1a2e">Weekly Portfolio Digest</h2>
          <p>Hi ${userName},</p>
          <p>Here's your portfolio activity summary for the past 7 days:</p>
          
          <h3 style="margin-top:24px;color:#333">📋 Summary</h3>
          <table style="width:100%;border-collapse:collapse;margin:12px 0">
            <thead><tr style="background:#f5f5f5"><th style="padding:8px 12px;text-align:left">Category</th><th style="padding:8px 12px;text-align:right">Count</th></tr></thead>
            <tbody>${summaryRows}</tbody>
            <tfoot><tr style="background:#f0f0f0;font-weight:700"><td style="padding:8px 12px">Total Events</td><td style="padding:8px 12px;text-align:right">${updates.length}</td></tr></tfoot>
          </table>

          ${highImpact.length > 0 ? `<h3 style="margin-top:24px;color:#c0392b">🔴 High-Impact Events (${highImpact.length})</h3>
          <ul style="padding-left:20px">${highImpact.map(h => `<li style="margin-bottom:6px"><strong>${h.symbol}</strong>: ${h.title}</li>`).join('')}</ul>` : ''}

          <h3 style="margin-top:24px;color:#333">📝 All Events</h3>
          <table style="width:100%;border-collapse:collapse;margin:12px 0">
            <thead><tr style="background:#f5f5f5"><th style="padding:6px 8px;text-align:left">Symbol</th><th style="padding:6px 8px;text-align:left">Event</th><th style="padding:6px 8px;text-align:left">Details</th></tr></thead>
            <tbody>${detailRows}</tbody>
          </table>
          ${updates.length > 15 ? `<p style="color:#888;font-size:13px">...and ${updates.length - 15} more events. View all in your <a href="https://wealthos.app">dashboard</a>.</p>` : ''}

          <hr style="margin:24px 0;border:none;border-top:1px solid #eee" />
          <p style="color:#888;font-size:12px">You're receiving this because you have portfolio update emails enabled. Manage preferences in your <a href="https://wealthos.app">WealthOS settings</a>.</p>
        </div>
      `;

      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'WealthOS <digest@updates.wealthos.app>',
            to: [profile.email],
            subject: `📊 Weekly Portfolio Digest — ${updates.length} event${updates.length > 1 ? 's' : ''} this week`,
            html,
          }),
        });
        emailsSent++;
        console.log(`Weekly digest sent to ${profile.email}`);
      } catch (emailErr) {
        console.error(`Failed to send digest to ${profile.email}:`, emailErr);
      }
    }

    return new Response(JSON.stringify({
      message: 'Weekly digest complete',
      users_processed: Object.keys(userUpdates).length,
      emails_sent: emailsSent,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Weekly digest error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
