import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  url: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  relatedSymbols: string[];
  category: string;
  image?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbols = [] } = await req.json();
    const FINNHUB_API_KEY = Deno.env.get('FINNHUB_API_KEY');

    if (!FINNHUB_API_KEY) {
      console.error('FINNHUB_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'News API not configured', news: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const allNews: NewsItem[] = [];
    const seenIds = new Set<string>();

    // Fetch general market news
    try {
      const generalUrl = `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_API_KEY}`;
      console.log('Fetching general market news');
      
      const generalRes = await fetch(generalUrl);
      if (generalRes.ok) {
        const generalData = await generalRes.json();
        console.log(`Got ${generalData?.length || 0} general news items`);
        
        if (Array.isArray(generalData)) {
          generalData.slice(0, 10).forEach((item: any) => {
            const id = `general-${item.id || item.datetime}`;
            if (!seenIds.has(id)) {
              seenIds.add(id);
              allNews.push({
                id,
                title: item.headline || 'No title',
                summary: item.summary || '',
                source: item.source || 'Finnhub',
                publishedAt: new Date(item.datetime * 1000).toISOString(),
                url: item.url || '#',
                sentiment: analyzeSentiment(item.headline + ' ' + item.summary),
                relatedSymbols: [],
                category: item.category || 'General',
                image: item.image
              });
            }
          });
        }
      }
    } catch (err) {
      console.error('Error fetching general news:', err);
    }

    // Fetch company-specific news for each symbol
    const uniqueSymbols: string[] = [...new Set(symbols as string[])].slice(0, 5); // Limit to 5 symbols
    
    for (const symbol of uniqueSymbols) {
      try {
        const today = new Date();
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const fromDate = weekAgo.toISOString().split('T')[0];
        const toDate = today.toISOString().split('T')[0];
        
        const companyUrl = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${FINNHUB_API_KEY}`;
        console.log(`Fetching news for ${symbol}`);
        
        const companyRes = await fetch(companyUrl);
        if (companyRes.ok) {
          const companyData = await companyRes.json();
          console.log(`Got ${companyData?.length || 0} news items for ${symbol}`);
          
          if (Array.isArray(companyData)) {
            companyData.slice(0, 5).forEach((item: any) => {
              const id = `${symbol}-${item.id || item.datetime}`;
              if (!seenIds.has(id)) {
                seenIds.add(id);
                allNews.push({
                  id,
                  title: item.headline || 'No title',
                  summary: item.summary || '',
                  source: item.source || 'Finnhub',
                  publishedAt: new Date(item.datetime * 1000).toISOString(),
                  url: item.url || '#',
                  sentiment: analyzeSentiment(item.headline + ' ' + item.summary),
                  relatedSymbols: [symbol],
                  category: item.category || 'Company News',
                  image: item.image
                });
              }
            });
          }
        }
        
        // Small delay to respect rate limits
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        console.error(`Error fetching news for ${symbol}:`, err);
      }
    }

    // Sort by date
    allNews.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    console.log(`Returning ${allNews.length} total news items`);

    return new Response(
      JSON.stringify({ news: allNews }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in fetch-news:', error);
    return new Response(
      JSON.stringify({ error: errorMessage, news: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});

function analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const lowerText = text.toLowerCase();
  
  const positiveWords = [
    'surge', 'soar', 'jump', 'gain', 'rally', 'bull', 'growth', 'profit',
    'beat', 'exceed', 'upgrade', 'buy', 'outperform', 'record', 'high',
    'strong', 'boost', 'positive', 'optimistic', 'success', 'win', 'rise'
  ];
  
  const negativeWords = [
    'fall', 'drop', 'plunge', 'crash', 'bear', 'loss', 'decline', 'miss',
    'downgrade', 'sell', 'underperform', 'low', 'weak', 'concern', 'risk',
    'warning', 'negative', 'pessimistic', 'fail', 'cut', 'layoff', 'debt'
  ];
  
  let positiveCount = 0;
  let negativeCount = 0;
  
  positiveWords.forEach(word => {
    if (lowerText.includes(word)) positiveCount++;
  });
  
  negativeWords.forEach(word => {
    if (lowerText.includes(word)) negativeCount++;
  });
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}
