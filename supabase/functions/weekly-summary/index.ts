import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PortfolioSummary {
  userId: string;
  email: string;
  fullName?: string;
  portfolios: Array<{
    name: string;
    totalValue: number;
    weeklyChange: number;
    weeklyChangePercent: number;
    topGainers: Array<{ symbol: string; change: number }>;
    topLosers: Array<{ symbol: string; change: number }>;
    dividendsReceived: number;
  }>;
}

const generateEmailHtml = (summary: PortfolioSummary): string => {
  const portfolioSections = summary.portfolios.map(p => `
    <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
      <h3 style="margin: 0 0 12px 0; color: #1e293b; font-size: 18px;">${p.name}</h3>
      
      <div style="display: flex; gap: 20px; margin-bottom: 16px;">
        <div>
          <div style="color: #64748b; font-size: 12px;">Total Value</div>
          <div style="font-size: 24px; font-weight: bold; color: #1e293b;">$${p.totalValue.toLocaleString()}</div>
        </div>
        <div>
          <div style="color: #64748b; font-size: 12px;">Weekly Change</div>
          <div style="font-size: 24px; font-weight: bold; color: ${p.weeklyChange >= 0 ? '#10b981' : '#ef4444'};">
            ${p.weeklyChange >= 0 ? '+' : ''}${p.weeklyChangePercent.toFixed(2)}%
          </div>
        </div>
      </div>

      ${p.dividendsReceived > 0 ? `
        <div style="background: #ecfdf5; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
          <span style="color: #10b981; font-weight: bold;">💰 Dividends Received: $${p.dividendsReceived.toFixed(2)}</span>
        </div>
      ` : ''}

      ${p.topGainers.length > 0 ? `
        <div style="margin-bottom: 8px;">
          <div style="color: #10b981; font-size: 12px; font-weight: bold; margin-bottom: 4px;">📈 Top Gainers</div>
          ${p.topGainers.map(g => `<span style="background: #d1fae5; color: #065f46; padding: 2px 8px; border-radius: 4px; margin-right: 4px; font-size: 12px;">${g.symbol} +${g.change.toFixed(1)}%</span>`).join('')}
        </div>
      ` : ''}

      ${p.topLosers.length > 0 ? `
        <div>
          <div style="color: #ef4444; font-size: 12px; font-weight: bold; margin-bottom: 4px;">📉 Top Losers</div>
          ${p.topLosers.map(l => `<span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; margin-right: 4px; font-size: 12px;">${l.symbol} ${l.change.toFixed(1)}%</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px; text-align: center;">
          <h1 style="margin: 0; color: white; font-size: 28px;">📊 Weekly Portfolio Summary</h1>
          <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">
            ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <div style="padding: 24px;">
          <p style="color: #475569; margin: 0 0 20px 0;">
            Hi${summary.fullName ? ` ${summary.fullName}` : ''},<br><br>
            Here's your weekly portfolio performance summary:
          </p>

          ${portfolioSections}

          <div style="text-align: center; margin-top: 24px;">
            <a href="https://wealthos.app/dashboard" style="display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: bold;">
              View Full Dashboard →
            </a>
          </div>
        </div>

        <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0; color: #64748b; font-size: 12px;">
            You're receiving this because you enabled weekly email summaries.<br>
            <a href="https://wealthos.app/settings" style="color: #6366f1;">Manage preferences</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get users who have weekly summary enabled
    const { data: preferences, error: prefError } = await supabase
      .from("notification_preferences")
      .select("user_id")
      .eq("email_weekly_summary", true);

    if (prefError) {
      throw new Error(`Failed to fetch preferences: ${prefError.message}`);
    }

    if (!preferences || preferences.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No users opted in for weekly summary" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = preferences.map(p => p.user_id);
    const results: Array<{ userId: string; status: string; error?: string }> = [];

    for (const userId of userIds) {
      try {
        // Get user profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", userId)
          .single();

        if (!profile?.email) {
          results.push({ userId, status: "skipped", error: "No email found" });
          continue;
        }

        // Get user's portfolios
        const { data: portfolios } = await supabase
          .from("portfolios")
          .select("id, name")
          .eq("user_id", userId);

        if (!portfolios || portfolios.length === 0) {
          results.push({ userId, status: "skipped", error: "No portfolios" });
          continue;
        }

        const portfolioSummaries = [];

        for (const portfolio of portfolios) {
          // Get holdings
          const { data: holdings } = await supabase
            .from("holdings")
            .select("symbol, shares, avg_price, current_price")
            .eq("portfolio_id", portfolio.id);

          if (!holdings || holdings.length === 0) continue;

          // Calculate totals
          const totalValue = holdings.reduce((sum, h) => 
            sum + (h.shares * (h.current_price || h.avg_price)), 0);
          
          // Get last week's snapshot for comparison
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          
          const { data: snapshot } = await supabase
            .from("portfolio_snapshots")
            .select("total_value")
            .eq("portfolio_id", portfolio.id)
            .lte("snapshot_date", oneWeekAgo.toISOString().split("T")[0])
            .order("snapshot_date", { ascending: false })
            .limit(1)
            .single();

          const previousValue = snapshot?.total_value || totalValue;
          const weeklyChange = totalValue - previousValue;
          const weeklyChangePercent = previousValue > 0 ? (weeklyChange / previousValue) * 100 : 0;

          // Get dividends for this week
          const { data: dividends } = await supabase
            .from("dividends")
            .select("amount")
            .eq("portfolio_id", portfolio.id)
            .gte("pay_date", oneWeekAgo.toISOString().split("T")[0]);

          const dividendsReceived = dividends?.reduce((sum, d) => sum + Number(d.amount), 0) || 0;

          // Calculate individual stock changes (mock for now - would need price history)
          const stockChanges = holdings.map(h => ({
            symbol: h.symbol,
            change: ((h.current_price || h.avg_price) - h.avg_price) / h.avg_price * 100
          }));

          const topGainers = stockChanges.filter(s => s.change > 0)
            .sort((a, b) => b.change - a.change)
            .slice(0, 3);
          
          const topLosers = stockChanges.filter(s => s.change < 0)
            .sort((a, b) => a.change - b.change)
            .slice(0, 3);

          portfolioSummaries.push({
            name: portfolio.name,
            totalValue,
            weeklyChange,
            weeklyChangePercent,
            topGainers,
            topLosers,
            dividendsReceived
          });
        }

        if (portfolioSummaries.length === 0) {
          results.push({ userId, status: "skipped", error: "No holdings data" });
          continue;
        }

        const summary: PortfolioSummary = {
          userId,
          email: profile.email,
          fullName: profile.full_name || undefined,
          portfolios: portfolioSummaries
        };

        // Send email via Resend if configured
        if (resendApiKey) {
          const emailHtml = generateEmailHtml(summary);
          
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              from: "WealthOS <noreply@wealthos.app>",
              to: [profile.email],
              subject: `📊 Your Weekly Portfolio Summary - ${new Date().toLocaleDateString()}`,
              html: emailHtml
            })
          });

          if (!emailResponse.ok) {
            const error = await emailResponse.text();
            results.push({ userId, status: "failed", error: `Email send failed: ${error}` });
            continue;
          }
        }

        results.push({ userId, status: "sent" });

      } catch (err) {
        results.push({ userId, status: "error", error: String(err) });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length,
        sent: results.filter(r => r.status === "sent").length,
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Weekly summary error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
