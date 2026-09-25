import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const fmpKey = Deno.env.get('FMP_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, user_id, symbols } = await req.json();

    // Auto-check: fetch all users' holdings and check for updates
    if (action === 'auto_check_all') {
      const { data: allPortfolios } = await supabase
        .from('portfolios')
        .select('user_id, id');
      
      if (!allPortfolios?.length) {
        return new Response(JSON.stringify({ message: 'No portfolios found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Group holdings by user
      const userSymbols: Record<string, string[]> = {};
      for (const p of allPortfolios) {
        const { data: holdings } = await supabase
          .from('holdings')
          .select('symbol')
          .eq('portfolio_id', p.id);
        if (holdings?.length) {
          if (!userSymbols[p.user_id]) userSymbols[p.user_id] = [];
          for (const h of holdings) {
            if (!userSymbols[p.user_id].includes(h.symbol)) {
              userSymbols[p.user_id].push(h.symbol);
            }
          }
        }
      }

      let totalInserted = 0;
      for (const [uid, syms] of Object.entries(userSymbols)) {
        // Process in small chunks so a large portfolio can't exceed the request timeout
        for (let i = 0; i < syms.length; i += 6) {
          const chunk = syms.slice(i, i + 6);
          try {
            const res = await fetch(`${supabaseUrl}/functions/v1/portfolio-updates`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': req.headers.get('Authorization') || `Bearer ${supabaseKey}`,
                'apikey': req.headers.get('apikey') || supabaseKey,
              },
              body: JSON.stringify({ action: 'check_updates', user_id: uid, symbols: chunk }),
            });
            const text = await res.text();
            let result: any = null;
            try { result = JSON.parse(text); } catch { /* ignore */ }
            console.log(`Auto-check ${uid} [${chunk.join(',')}] -> ${res.status} ${text.slice(0, 200)}`);
            totalInserted += result?.inserted || 0;
          } catch (e) {
            console.error(`Auto-check failed for user ${uid} chunk ${chunk.join(',')}:`, e);
          }
        }
      }


      return new Response(JSON.stringify({ message: 'Auto-check complete', total_inserted: totalInserted, users_checked: Object.keys(userSymbols).length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'check_updates' && user_id && symbols?.length) {
      const updates: any[] = [];

      // FMP moved most endpoints to /stable/. Try stable first, fall back to legacy v3.
      const fmpJson = async (paths: string[]): Promise<any> => {
        for (const path of paths) {
          try {
            const url = `https://financialmodelingprep.com${path}${path.includes('?') ? '&' : '?'}apikey=${fmpKey}`;
            const res = await fetch(url);
            const text = await res.text();
            if (!res.ok) {
              console.error(`FMP ${path} -> HTTP ${res.status}: ${text.slice(0, 200)}`);
              continue;
            }
            let json: any;
            try { json = JSON.parse(text); } catch { console.error(`FMP ${path} -> non-JSON: ${text.slice(0, 200)}`); continue; }
            if (json?.["Error Message"] || json?.error) {
              console.error(`FMP ${path} -> error: ${JSON.stringify(json).slice(0, 200)}`);
              continue;
            }
            const arr = Array.isArray(json) ? json : json?.historical;
            if (Array.isArray(arr) && arr.length > 0) return arr;
            console.log(`FMP ${path} -> empty result`);
          } catch (e) {
            console.error(`FMP ${path} -> fetch failed:`, e);
          }
        }
        return null;
      };

      // ---- Free fallback: Yahoo Finance (no API key required) ----
      let yahooCrumb: string | null = null;
      let yahooCookie = '';
      const YAHOO_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

      const initYahoo = async (): Promise<boolean> => {
        if (yahooCrumb) return true;
        try {
          const res = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': YAHOO_UA } });
          const setCookie = res.headers.get('set-cookie') || '';
          yahooCookie = setCookie.split(',').map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
          const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
            headers: { 'User-Agent': YAHOO_UA, ...(yahooCookie ? { Cookie: yahooCookie } : {}) },
          });
          const crumb = (await crumbRes.text()).trim();
          if (crumb && crumb.length < 40 && !crumb.startsWith('<')) {
            yahooCrumb = crumb;
            return true;
          }
          console.error('Yahoo crumb unavailable');
        } catch (e) {
          console.error('Yahoo init failed:', e);
        }
        return false;
      };

      const yahooQuoteSummary = async (symbol: string, modules: string): Promise<any | null> => {
        if (!(await initYahoo())) return null;
        try {
          const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&crumb=${encodeURIComponent(yahooCrumb!)}`;
          const res = await fetch(url, { headers: { 'User-Agent': YAHOO_UA, ...(yahooCookie ? { Cookie: yahooCookie } : {}) } });
          if (!res.ok) {
            console.error(`Yahoo quoteSummary ${symbol} -> HTTP ${res.status}`);
            return null;
          }
          const json = await res.json();
          if (json?.finance?.error) {
            console.error(`Yahoo quoteSummary ${symbol} -> ${JSON.stringify(json.finance.error).slice(0, 150)}`);
            yahooCrumb = null;
            return null;
          }
          return json?.quoteSummary?.result?.[0] ?? null;
        } catch (e) {
          console.error(`Yahoo quoteSummary ${symbol} failed:`, e);
          return null;
        }
      };

      // Yahoo upgrade/downgrade history, newest first
      const yahooGrades = async (symbol: string): Promise<any[] | null> => {
        const result = await yahooQuoteSummary(symbol, 'upgradeDowngradeHistory');
        const history = result?.upgradeDowngradeHistory?.history;
        if (!Array.isArray(history) || history.length === 0) return null;
        return [...history]
          .sort((a, b) => (b.epochGradeDate || 0) - (a.epochGradeDate || 0))
          .map((h: any) => ({
            gradingCompany: h.firm,
            newGrade: h.toGrade,
            previousGrade: h.fromGrade,
            date: h.epochGradeDate ? new Date(h.epochGradeDate * 1000).toISOString().slice(0, 10) : '',
            currentPriceTarget: h.currentPriceTarget,
            priorPriceTarget: h.priorPriceTarget,
          }));
      };

      // Yahoo dividend history from the free chart endpoint, newest first
      const yahooDividends = async (symbol: string): Promise<any[] | null> => {
        try {
          const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2y&events=div`,
            { headers: { 'User-Agent': YAHOO_UA } }
          );
          if (!res.ok) return null;
          const json = await res.json();
          const divs = json?.chart?.result?.[0]?.events?.dividends;
          if (!divs) return null;
          const list = Object.values(divs as Record<string, any>)
            .map((d: any) => ({ dividend: Number(d.amount), date: new Date(d.date * 1000).toISOString().slice(0, 10), ts: d.date }))
            .filter(d => Number.isFinite(d.dividend) && d.dividend > 0)
            .sort((a, b) => b.ts - a.ts);
          return list.length ? list : null;
        } catch (e) {
          console.error(`Yahoo dividends ${symbol} failed:`, e);
          return null;
        }
      };

      for (const symbol of symbols.slice(0, 20)) {
        await new Promise(r => setTimeout(r, 300));

        try {
          // Earnings surprises
          const earnings = await fmpJson([
            `/stable/earnings-surprises?symbol=${symbol}`,
            `/stable/earnings?symbol=${symbol}&limit=4`,
            `/api/v3/earnings-surprises/${symbol}`,
          ]);
          if (earnings?.[0]) {
            const latest = earnings[0];
            const actual = Number(latest.actualEarningResult ?? latest.epsActual);
            const estimated = Number(latest.estimatedEarning ?? latest.epsEstimated);
            if (Number.isFinite(actual) && Number.isFinite(estimated) && estimated !== 0) {
              const surprisePct = ((actual - estimated) / Math.abs(estimated)) * 100;
              if (Math.abs(surprisePct) >= 5) {
                updates.push({
                  user_id,
                  symbol,
                  update_type: 'earnings_surprise',
                  title: `${symbol} ${surprisePct > 0 ? 'Beat' : 'Missed'} Earnings by ${Math.abs(surprisePct).toFixed(1)}%`,
                  summary: `Actual EPS: $${actual.toFixed(2)} vs Est: $${estimated.toFixed(2)} (${latest.date})`,
                  significance: Math.abs(surprisePct) >= 15 ? 'high' : 'medium',
                  details: { actual, estimated, date: latest.date, surprise_pct: Number(surprisePct.toFixed(1)) },
                });
              }
            }
          }

          // Analyst ratings / upgrades / downgrades
          await new Promise(r => setTimeout(r, 300));
          const grades = (await fmpJson([
            `/stable/grades?symbol=${symbol}`,
            `/api/v3/grade/${symbol}?limit=3`,
          ])) || (await yahooGrades(symbol));
          if (grades?.[0]) {
            const latest = grades[0];
            const positive = ['Buy', 'Strong Buy', 'Outperform', 'Overweight'];
            const negative = ['Hold', 'Neutral', 'Underperform', 'Sell', 'Underweight', 'Equal Weight', 'Market Perform', 'Sector Perform'];
            const isUpgrade = latest.newGrade && latest.previousGrade &&
              positive.includes(latest.newGrade) && negative.includes(latest.previousGrade);
            const isDowngrade = latest.newGrade && latest.previousGrade &&
              negative.includes(latest.newGrade) && positive.includes(latest.previousGrade);

            if (isUpgrade || isDowngrade) {
              updates.push({
                user_id,
                symbol,
                update_type: isUpgrade ? 'rating_upgrade' : 'rating_downgrade',
                title: `${symbol} ${isUpgrade ? 'Upgraded' : 'Downgraded'} by ${latest.gradingCompany}`,
                summary: `${latest.previousGrade} → ${latest.newGrade} (${latest.date})`,
                significance: 'high',
                details: { company: latest.gradingCompany, from: latest.previousGrade, to: latest.newGrade, date: latest.date },
              });
            }
          }

          // Dividend changes
          await new Promise(r => setTimeout(r, 300));
          const history = (await fmpJson([
            `/stable/dividends?symbol=${symbol}&limit=4`,
            `/api/v3/historical-price-full/stock_dividend/${symbol}`,
          ])) || (await yahooDividends(symbol));
          if (history && history.length >= 2) {
            const current = Number(history[0].dividend);
            const previous = Number(history[1].dividend);
            if (previous > 0 && Number.isFinite(current)) {
              const changePct = ((current - previous) / previous) * 100;
              if (Math.abs(changePct) >= 3) {
                updates.push({
                  user_id,
                  symbol,
                  update_type: 'dividend_change',
                  title: `${symbol} Dividend ${changePct > 0 ? 'Increased' : 'Cut'} by ${Math.abs(changePct).toFixed(1)}%`,
                  summary: `$${previous.toFixed(4)} → $${current.toFixed(4)} per share`,
                  significance: changePct < -10 ? 'high' : 'medium',
                  details: { previous, current, change_pct: Number(changePct.toFixed(1)), date: history[0].date },
                });
              }
            }
          }

          // Price target changes
          await new Promise(r => setTimeout(r, 300));
          const yahooTargets = async () => {
            const g = await yahooGrades(symbol);
            const hit = g?.find((h: any) => Number(h.currentPriceTarget) > 0);
            if (!hit) return null;
            return [{
              priceTarget: Number(hit.currentPriceTarget),
              adjPriceTarget: Number(hit.priorPriceTarget) || Number(hit.currentPriceTarget),
              analystCompany: hit.gradingCompany,
              publishedDate: hit.date,
            }];
          };
          const targets = (await fmpJson([
            `/stable/price-target-news?symbol=${symbol}&limit=1`,
            `/stable/price-target-summary?symbol=${symbol}`,
            `/api/v3/price-target/${symbol}`,
          ])) || (await yahooTargets());
          if (targets?.[0]) {
            const latest = targets[0];
            const newTarget = Number(latest.priceTarget ?? latest.lastMonthAvgPriceTarget);
            if (Number.isFinite(newTarget) && newTarget > 0) {
              const oldTarget = Number(latest.adjPriceTarget ?? latest.priceWhenPosted ?? newTarget);
              const analyst = latest.analystName || latest.analystCompany || latest.newsPublisher || 'Analyst';
              const company = latest.analystCompany || latest.newsPublisher || '';

              updates.push({
                user_id,
                symbol,
                update_type: 'price_target_change',
                title: `${symbol} Price Target Set to $${newTarget} by ${company || analyst}`,
                summary: `${analyst}${company && company !== analyst ? ` (${company})` : ''} — Target: $${newTarget} (${latest.publishedDate || ''})`,
                significance: 'medium',
                details: {
                  analyst,
                  company,
                  price_target: newTarget,
                  adj_price_target: oldTarget,
                  published_date: latest.publishedDate,
                },
              });
            }
          }
        } catch (e) {
          console.error(`Error checking ${symbol}:`, e);
        }
      }


      // Deduplicate: skip updates already stored in last 7 days
      if (updates.length > 0) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const { data: existing } = await supabase
          .from('portfolio_updates')
          .select('symbol, update_type, title')
          .eq('user_id', user_id)
          .gte('created_at', sevenDaysAgo);

        const existingSet = new Set(existing?.map(e => `${e.symbol}|${e.update_type}|${e.title}`) || []);
        const newUpdates = updates.filter(u => !existingSet.has(`${u.symbol}|${u.update_type}|${u.title}`));

        if (newUpdates.length > 0) {
          await supabase.from('portfolio_updates').insert(newUpdates);

          // Send email for high-significance updates
          const highImpact = newUpdates.filter(u =>
            u.significance === 'high' ||
            (u.update_type === 'earnings_surprise' && Math.abs(u.details?.surprise_pct || 0) >= 15) ||
            u.update_type === 'rating_downgrade'
          );

          if (highImpact.length > 0) {
            const resendKey = Deno.env.get('RESEND_API_KEY');
            if (resendKey) {
              // Get user email
              const { data: profile } = await supabase
                .from('profiles')
                .select('email, full_name')
                .eq('id', user_id)
                .single();

              // Check notification preferences
              const { data: prefs } = await supabase
                .from('notification_preferences')
                .select('email_portfolio_alerts')
                .eq('user_id', user_id)
                .single();

              if (profile?.email && (prefs?.email_portfolio_alerts !== false)) {
                const userName = profile.full_name || 'Investor';
                const updatesList = highImpact.map(u =>
                  `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600">${u.symbol}</td><td style="padding:8px;border-bottom:1px solid #eee">${u.title}</td><td style="padding:8px;border-bottom:1px solid #eee;color:#666">${u.summary || ''}</td></tr>`
                ).join('');

                try {
                  await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      from: 'WealthOS <alerts@updates.wealthos.app>',
                      to: [profile.email],
                      subject: `🔔 ${highImpact.length} High-Impact Portfolio Update${highImpact.length > 1 ? 's' : ''}`,
                      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#1a1a2e">Hi ${userName},</h2><p>We detected <strong>${highImpact.length} high-impact event${highImpact.length > 1 ? 's' : ''}</strong> affecting your holdings:</p><table style="width:100%;border-collapse:collapse;margin:16px 0"><thead><tr style="background:#f5f5f5"><th style="padding:8px;text-align:left">Symbol</th><th style="padding:8px;text-align:left">Event</th><th style="padding:8px;text-align:left">Details</th></tr></thead><tbody>${updatesList}</tbody></table><p style="color:#666;font-size:13px">You can manage these alerts in your <a href="https://wealthos.app">WealthOS dashboard</a>.</p></div>`,
                    }),
                  });
                  console.log(`Portfolio update email sent to ${profile.email}`);
                } catch (emailErr) {
                  console.error('Failed to send portfolio update email:', emailErr);
                }
              }
            }
          }
        }

        return new Response(JSON.stringify({ inserted: newUpdates.length, total_found: updates.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ inserted: 0, total_found: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_updates' && user_id) {
      const { data, error } = await supabase
        .from('portfolio_updates')
        .select('*')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return new Response(JSON.stringify(data || []), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Portfolio updates error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
