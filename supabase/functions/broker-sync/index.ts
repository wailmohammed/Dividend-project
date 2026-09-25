import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Decrypt credentials using AES-GCM (same logic as encrypt-api-key function)
async function decryptCredentials(encryptedPayload: string, userId: string): Promise<{ apiKey: string; apiSecret: string | null }> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  // Decode base64
  const combined = new Uint8Array(atob(encryptedPayload).split('').map(c => c.charCodeAt(0)));
  
  // Extract salt, iv, and encrypted data
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const encryptedData = combined.slice(28);
  
  // Derive the same key
  const serverSecret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(serverSecret + userId),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encryptedData
  );
  
  return JSON.parse(decoder.decode(decrypted));
}

interface SyncRequest {
  connectionId: string;
  portfolioId: string;
  action: 'sync' | 'test';
}

interface Position {
  symbol: string;
  name: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

interface BrokerData {
  positions: Position[];
  cashBalance: number;
}

// Symbols the account owner confirmed they do not hold; never re-import them.
const EXCLUDED_SYMBOLS = new Set(['ISDUL', 'ISDWL', 'SMHL']);

// Helper to normalize Trading212 symbols (remove _US_EQ suffix)
function normalizeSymbol(symbol: string): string {
  // Trading212 uses format like AAPL_US_EQ, we want just AAPL
  const normalized = symbol.replace(/_[A-Z]{2}_EQ$/i, '').replace(/_[A-Z]{2,3}$/i, '').toUpperCase();

  // Trading 212 still lists Blue Owl Capital under its SPAC ticker ATAC (Altimar).
  // Normalize it to OWL. (ABT arrives separately as ABT_US_EQ.)
  return normalized === 'ATAC' ? 'OWL' : normalized;
}

// Trading 212 API handler
async function fetchTrading212Data(apiKey: string): Promise<BrokerData> {
  try {
    console.log('Fetching Trading 212 data...');
    
    // Fetch positions
    const positionsResponse = await fetch('https://live.trading212.com/api/v0/equity/portfolio', {
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!positionsResponse.ok) {
      const errorText = await positionsResponse.text();
      console.error('Trading 212 API error:', positionsResponse.status, errorText);
      throw new Error(`Trading 212 API returned ${positionsResponse.status}: ${errorText}`);
    }

    const positionsData = await positionsResponse.json();
    console.log(`Trading 212 returned ${positionsData?.length || 0} positions`);
    
    // Fetch cash balance from account info
    let cashBalance = 0;
    try {
      const accountResponse = await fetch('https://live.trading212.com/api/v0/equity/account/cash', {
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      if (accountResponse.ok) {
        const accountData = await accountResponse.json();
        // 'total' is the whole account value (stocks + cash); only 'free' is uninvested cash.
        cashBalance = Number(accountData.free ?? 0) || 0;
        console.log(`Trading 212 cash balance: ${cashBalance}`);
      }
    } catch (cashError) {
      console.error('Failed to fetch Trading 212 cash balance:', cashError);
    }
    
    const positions = positionsData
      .map((pos: any) => {
        const normalizedSymbol = normalizeSymbol(pos.ticker);
        console.log(`Position: ${pos.ticker} -> ${normalizedSymbol}, qty: ${pos.quantity}, avg: ${pos.averagePrice}, current: ${pos.currentPrice}`);
        return {
          symbol: normalizedSymbol,
          originalSymbol: pos.ticker,
          name: normalizedSymbol === 'OWL' ? 'Blue Owl Capital Inc.' : normalizedSymbol,
          quantity: pos.quantity,
          averagePrice: pos.averagePrice,
          currentPrice: pos.currentPrice,
          marketValue: pos.currentPrice * pos.quantity,
          unrealizedPnL: pos.ppl || 0,
          unrealizedPnLPercent: pos.pplPercentage || 0
        };
      })
      // Positions the account owner has confirmed they do not hold (LSE UCITS
      // ETF residue that has no US market data and breaks the price refresh).
      .filter((p: any) => !EXCLUDED_SYMBOLS.has(p.symbol));


    
    return { positions, cashBalance };
  } catch (error) {
    console.error('Trading 212 fetch error:', error);
    throw error;
  }
}

// Binance API handler
async function fetchBinanceData(apiKey: string, apiSecret: string): Promise<BrokerData> {
  try {
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    
    // Create signature using HMAC-SHA256
    const encoder = new TextEncoder();
    const keyData = encoder.encode(apiSecret);
    const messageData = encoder.encode(queryString);
    const key = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    const signatureHex = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    // Fetch account info
    const response = await fetch(
      `https://api.binance.com/api/v3/account?${queryString}&signature=${signatureHex}`,
      {
        headers: {
          'X-MBX-APIKEY': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error('Binance API error:', response.status, await response.text());
      throw new Error(`Binance API returned ${response.status}`);
    }

    const data = await response.json();
    const balances = data.balances?.filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0) || [];

    // Get prices for all assets
    const pricesResponse = await fetch('https://api.binance.com/api/v3/ticker/price');
    const allPrices = await pricesResponse.json();
    const priceMap = new Map(allPrices.map((p: any) => [p.symbol, parseFloat(p.price)]));

    // Calculate cash balance (USDT + BUSD + USD stablecoins)
    let cashBalance = 0;
    const stablecoins = ['USDT', 'BUSD', 'USDC', 'DAI', 'TUSD'];
    
    const positions = balances.map((balance: any) => {
      const total = parseFloat(balance.free) + parseFloat(balance.locked);
      const usdtPair = `${balance.asset}USDT`;
      const priceValue = priceMap.get(usdtPair);
      const price: number = typeof priceValue === 'number' ? priceValue : (stablecoins.includes(balance.asset) ? 1 : 0);
      
      // Add stablecoins to cash balance
      if (stablecoins.includes(balance.asset)) {
        cashBalance += total * price;
      }
      
      return {
        symbol: balance.asset,
        name: balance.asset,
        quantity: total,
        averagePrice: 0,
        currentPrice: price,
        marketValue: total * price,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0
      };
    }).filter((p: Position) => p.marketValue > 0.01 && !stablecoins.includes(p.symbol));
    
    console.log(`Binance cash balance (stablecoins): ${cashBalance}`);
    
    return { positions, cashBalance };
  } catch (error) {
    console.error('Binance fetch error:', error);
    throw error;
  }
}

// IG Markets API handler
async function fetchIGData(apiKey: string, _apiSecret: string): Promise<BrokerData> {
  try {
    const response = await fetch('https://api.ig.com/gateway/deal/positions', {
      headers: {
        'X-IG-API-KEY': apiKey,
        'Content-Type': 'application/json',
        'Version': '2'
      }
    });

    if (!response.ok) {
      throw new Error(`IG API returned ${response.status}`);
    }

    const data = await response.json();
    const positions = data.positions?.map((pos: any) => ({
      symbol: pos.market.epic,
      name: pos.market.instrumentName,
      quantity: pos.position.size,
      averagePrice: pos.position.openLevel,
      currentPrice: pos.market.bid,
      marketValue: pos.position.size * pos.market.bid,
      unrealizedPnL: pos.position.profitLoss,
      unrealizedPnLPercent: (pos.position.profitLoss / (pos.position.size * pos.position.openLevel)) * 100
    })) || [];
    
    // IG: Try to get account balance
    let cashBalance = 0;
    try {
      const accountResponse = await fetch('https://api.ig.com/gateway/deal/accounts', {
        headers: { 'X-IG-API-KEY': apiKey, 'Content-Type': 'application/json', 'Version': '1' }
      });
      if (accountResponse.ok) {
        const accountData = await accountResponse.json();
        cashBalance = accountData.accounts?.[0]?.balance?.available || 0;
      }
    } catch (e) { console.error('IG cash balance fetch failed', e); }
    
    return { positions, cashBalance };
  } catch (error) {
    console.error('IG fetch error:', error);
    throw error;
  }
}

// XTB API handler (requires WebSocket for real implementation)
async function fetchXTBData(_apiKey: string, _apiSecret: string): Promise<BrokerData> {
  console.log('XTB integration requires WebSocket connection');
  return { positions: [], cashBalance: 0 };
}

// Saxo Bank API handler
async function fetchSaxoData(apiKey: string, _apiSecret: string): Promise<BrokerData> {
  try {
    const response = await fetch('https://gateway.saxobank.com/sim/openapi/port/v1/positions/me', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Saxo API returned ${response.status}`);
    }

    const data = await response.json();
    const positions = data.Data?.map((pos: any) => ({
      symbol: pos.AssetType,
      name: pos.DisplayAndFormat?.Description || pos.AssetType,
      quantity: pos.Amount,
      averagePrice: pos.AverageOpenPrice,
      currentPrice: pos.CurrentPrice,
      marketValue: pos.MarketValue,
      unrealizedPnL: pos.ProfitLossOnTrade,
      unrealizedPnLPercent: (pos.ProfitLossOnTrade / (pos.Amount * pos.AverageOpenPrice)) * 100
    })) || [];
    
    // Saxo: Try to fetch cash balance
    let cashBalance = 0;
    try {
      const balanceResponse = await fetch('https://gateway.saxobank.com/sim/openapi/port/v1/balances/me', {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
      });
      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        cashBalance = balanceData.CashBalance || 0;
      }
    } catch (e) { console.error('Saxo cash balance fetch failed', e); }
    
    return { positions, cashBalance };
  } catch (error) {
    console.error('Saxo fetch error:', error);
    throw error;
  }
}

// Capital.com API handler
async function fetchCapitalData(apiKey: string, _apiSecret: string): Promise<BrokerData> {
  try {
    const response = await fetch('https://api-capital.backend-capital.com/api/v1/positions', {
      headers: {
        'X-CAP-API-KEY': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Capital.com API returned ${response.status}`);
    }

    const data = await response.json();
    const positions = data.positions?.map((pos: any) => ({
      symbol: pos.market.epic,
      name: pos.market.instrumentName,
      quantity: pos.position.size,
      averagePrice: pos.position.openLevel,
      currentPrice: pos.market.bid,
      marketValue: pos.position.size * pos.market.bid,
      unrealizedPnL: pos.position.upl,
      unrealizedPnLPercent: (pos.position.upl / (pos.position.size * pos.position.openLevel)) * 100
    })) || [];
    
    // Capital.com: Try to fetch account balance
    let cashBalance = 0;
    try {
      const accountResponse = await fetch('https://api-capital.backend-capital.com/api/v1/accounts', {
        headers: { 'X-CAP-API-KEY': apiKey, 'Content-Type': 'application/json' }
      });
      if (accountResponse.ok) {
        const accountData = await accountResponse.json();
        cashBalance = accountData.accounts?.[0]?.balance?.available || 0;
      }
    } catch (e) { console.error('Capital.com cash balance fetch failed', e); }
    
    return { positions, cashBalance };
  } catch (error) {
    console.error('Capital.com fetch error:', error);
    throw error;
  }
}

// Interactive Brokers API handler (Client Portal API)
async function fetchIBKRData(apiKey: string, _apiSecret: string): Promise<BrokerData> {
  try {
    const response = await fetch('https://localhost:5000/v1/api/portfolio/accounts', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`IBKR API returned ${response.status}`);
    }

    const accounts = await response.json();
    const accountId = accounts[0]?.id;
    const cashBalance = accounts[0]?.fullAvailableFunds || accounts[0]?.cashBalance || 0;
    
    if (!accountId) {
      return { positions: [], cashBalance };
    }

    const positionsResponse = await fetch(`https://localhost:5000/v1/api/portfolio/${accountId}/positions/0`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await positionsResponse.json();
    const positions = data?.map((pos: any) => ({
      symbol: pos.contractDesc,
      name: pos.name || pos.contractDesc,
      quantity: pos.position,
      averagePrice: pos.avgCost,
      currentPrice: pos.mktPrice,
      marketValue: pos.mktValue,
      unrealizedPnL: pos.unrealizedPnL,
      unrealizedPnLPercent: (pos.unrealizedPnL / (pos.position * pos.avgCost)) * 100
    })) || [];
    
    return { positions, cashBalance };
  } catch (error) {
    console.error('IBKR fetch error:', error);
    throw error;
  }
}

// Fidelity API handler (requires OAuth)
async function fetchFidelityData(apiKey: string, _apiSecret: string): Promise<BrokerData> {
  try {
    const response = await fetch('https://api.fidelity.com/v1/accounts/positions', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Fidelity API returned ${response.status}`);
    }

    const data = await response.json();
    const positions = data.positions?.map((pos: any) => ({
      symbol: pos.symbol,
      name: pos.description || pos.symbol,
      quantity: pos.quantity,
      averagePrice: pos.costBasis / pos.quantity,
      currentPrice: pos.currentValue / pos.quantity,
      marketValue: pos.currentValue,
      unrealizedPnL: pos.unrealizedGainLoss,
      unrealizedPnLPercent: (pos.unrealizedGainLoss / pos.costBasis) * 100
    })) || [];
    
    const cashBalance = data.cashBalance || data.account?.availableCash || 0;
    
    return { positions, cashBalance };
  } catch (error) {
    console.error('Fidelity fetch error:', error);
    throw error;
  }
}

// Charles Schwab API handler
async function fetchSchwabData(apiKey: string, _apiSecret: string): Promise<BrokerData> {
  try {
    const response = await fetch('https://api.schwab.com/trader/v1/accounts/positions', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Schwab API returned ${response.status}`);
    }

    const data = await response.json();
    const positions = data.securitiesAccount?.positions?.map((pos: any) => ({
      symbol: pos.instrument.symbol,
      name: pos.instrument.description || pos.instrument.symbol,
      quantity: pos.longQuantity - pos.shortQuantity,
      averagePrice: pos.averagePrice,
      currentPrice: pos.currentDayProfitLoss / pos.longQuantity + pos.averagePrice,
      marketValue: pos.marketValue,
      unrealizedPnL: pos.currentDayProfitLoss,
      unrealizedPnLPercent: (pos.currentDayProfitLoss / (pos.averagePrice * pos.longQuantity)) * 100
    })) || [];
    
    const cashBalance = data.securitiesAccount?.currentBalances?.cashBalance || 
                        data.securitiesAccount?.currentBalances?.availableFunds || 0;
    
    return { positions, cashBalance };
  } catch (error) {
    console.error('Schwab fetch error:', error);
    throw error;
  }
}

// Robinhood API handler
async function fetchRobinhoodData(apiKey: string, _apiSecret: string): Promise<BrokerData> {
  try {
    const response = await fetch('https://api.robinhood.com/positions/', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Robinhood API returned ${response.status}`);
    }

    const data = await response.json();
    const positionsRaw = data.results || [];
    
    // Fetch cash balance from accounts
    let cashBalance = 0;
    try {
      const accountsResponse = await fetch('https://api.robinhood.com/accounts/', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json();
        cashBalance = parseFloat(accountsData.results?.[0]?.cash || '0');
      }
    } catch (e) { console.error('Robinhood cash balance fetch failed', e); }
    
    // Fetch instrument details for each position
    const positionsWithDetails = await Promise.all(
      positionsRaw.filter((pos: any) => parseFloat(pos.quantity) > 0).map(async (pos: any) => {
        try {
          const instrumentResponse = await fetch(pos.instrument, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
          });
          const instrument = await instrumentResponse.json();
          
          const quoteResponse = await fetch(`https://api.robinhood.com/quotes/${instrument.symbol}/`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
          });
          const quote = await quoteResponse.json();
          
          const quantity = parseFloat(pos.quantity);
          const avgPrice = parseFloat(pos.average_buy_price);
          const currentPrice = parseFloat(quote.last_trade_price);
          
          return {
            symbol: instrument.symbol,
            name: instrument.simple_name || instrument.name || instrument.symbol,
            quantity,
            averagePrice: avgPrice,
            currentPrice,
            marketValue: quantity * currentPrice,
            unrealizedPnL: (currentPrice - avgPrice) * quantity,
            unrealizedPnLPercent: ((currentPrice - avgPrice) / avgPrice) * 100
          };
        } catch {
          return null;
        }
      })
    );
    
    const positions = positionsWithDetails.filter((p): p is Position => p !== null);
    
    return { positions, cashBalance };
  } catch (error) {
    console.error('Robinhood fetch error:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { connectionId, portfolioId, action }: SyncRequest = await req.json();

    // Fetch connection details
    const { data: connection, error: connError } = await supabase
      .from('broker_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('user_id', user.id)
      .single();

    if (connError || !connection) {
      return new Response(JSON.stringify({ error: 'Connection not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Decrypt API keys from metadata._encrypted_payload
    let apiKey = '';
    let apiSecret = '';
    
    const metadata = connection.metadata as Record<string, any> || {};
    const encryptedPayload = metadata._encrypted_payload;
    
    if (encryptedPayload) {
      try {
        const decrypted = await decryptCredentials(encryptedPayload, user.id);
        apiKey = decrypted.apiKey;
        apiSecret = decrypted.apiSecret || '';
        console.log('Successfully decrypted API credentials');
      } catch (decryptError) {
        console.error('Failed to decrypt credentials:', decryptError);
        await supabase
          .from('broker_connections')
          .update({ status: 'error', sync_error: 'Failed to decrypt API credentials' })
          .eq('id', connectionId);
        return new Response(JSON.stringify({ error: 'Failed to decrypt API credentials' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else if (connection.api_key_encrypted) {
      // Fallback for old format
      apiKey = connection.api_key_encrypted;
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'No API key found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update status to syncing
    await supabase
      .from('broker_connections')
      .update({ status: 'syncing', sync_error: null })
      .eq('id', connectionId);

    let brokerData: BrokerData = { positions: [], cashBalance: 0 };
    const providerName = connection.provider_name.toLowerCase();

    try {
      if (providerName.includes('trading 212') || providerName.includes('trading212')) {
        brokerData = await fetchTrading212Data(apiKey);
      } else if (providerName.includes('binance')) {
        brokerData = await fetchBinanceData(apiKey, apiSecret);
      } else if (providerName.includes('ig')) {
        brokerData = await fetchIGData(apiKey, apiSecret);
      } else if (providerName.includes('xtb')) {
        brokerData = await fetchXTBData(apiKey, apiSecret);
      } else if (providerName.includes('saxo')) {
        brokerData = await fetchSaxoData(apiKey, apiSecret);
      } else if (providerName.includes('capital')) {
        brokerData = await fetchCapitalData(apiKey, apiSecret);
      } else if (providerName.includes('interactive brokers') || providerName.includes('ibkr')) {
        brokerData = await fetchIBKRData(apiKey, apiSecret);
      } else if (providerName.includes('fidelity')) {
        brokerData = await fetchFidelityData(apiKey, apiSecret);
      } else if (providerName.includes('schwab') || providerName.includes('charles schwab')) {
        brokerData = await fetchSchwabData(apiKey, apiSecret);
      } else if (providerName.includes('robinhood')) {
        brokerData = await fetchRobinhoodData(apiKey, apiSecret);
      } else {
        throw new Error(`Unsupported broker: ${connection.provider_name}`);
      }
      
      const { positions, cashBalance } = brokerData;
      console.log(`Synced ${positions.length} positions with cash balance: $${cashBalance}`);

      // Update portfolio cash balance from broker (0 is a valid value — fully invested)
      if (Number.isFinite(cashBalance) && cashBalance >= 0) {
        const { error: cashUpdateError } = await supabase
          .from('portfolios')
          .update({ 
            cash_balance: cashBalance,
            updated_at: new Date().toISOString() 
          })
          .eq('id', portfolioId);
        
        if (cashUpdateError) {
          console.error('Error updating cash balance:', cashUpdateError);
        } else {
          console.log(`Updated portfolio cash balance to $${cashBalance}`);
        }
      }

      // Store sync data
      const { error: syncDataError } = await supabase
        .from('broker_sync_data')
        .upsert({
          connection_id: connectionId,
          portfolio_id: portfolioId,
          user_id: user.id,
          positions: positions,
          raw_data: { synced_at: new Date().toISOString(), cashBalance },
          last_synced_at: new Date().toISOString()
        }, { 
          onConflict: 'connection_id' 
        });

      if (syncDataError) {
        console.error('Error storing sync data:', syncDataError);
      }

      // Get all current symbols in this sync
      const syncedSymbols = positions.map(p => p.symbol);
      
      // Update holdings in portfolio
      for (const pos of positions) {
        // Also check for old-format symbols (with _US_EQ suffix)
        const { data: existingHoldings } = await supabase
          .from('holdings')
          .select('id, symbol')
          .eq('portfolio_id', portfolioId)
          .or(`symbol.eq.${pos.symbol},symbol.ilike.${pos.symbol}_%`);

        if (existingHoldings && existingHoldings.length > 0) {
          // Update all matching holdings (both old and new format)
          for (const holding of existingHoldings) {
            const needsSymbolFix = holding.symbol !== pos.symbol;
            await supabase
              .from('holdings')
              .update({
                symbol: pos.symbol, // Normalize the symbol
                name: pos.name || pos.symbol,
                shares: pos.quantity,
                avg_price: pos.averagePrice,
                current_price: pos.currentPrice,
                updated_at: new Date().toISOString()
              })
              .eq('id', holding.id);
            
            if (needsSymbolFix) {
              console.log(`Fixed symbol: ${holding.symbol} -> ${pos.symbol}`);
            }
          }
        } else {
          // Insert new holding with clean symbol
          await supabase
            .from('holdings')
            .insert({
              portfolio_id: portfolioId,
              symbol: pos.symbol,
              name: pos.name || pos.symbol,
              shares: pos.quantity,
              avg_price: pos.averagePrice,
              current_price: pos.currentPrice,
              asset_type: connection.provider_type === 'Crypto' ? 'Crypto' : 'Stock'
            });
        }
      }
      
      // SOLD STOCK DETECTION: Find holdings that exist in DB but not in broker positions
      // and mark them as sold (set shares to 0)
      const { data: allHoldings } = await supabase
        .from('holdings')
        .select('id, symbol, shares, avg_price, current_price, name')
        .eq('portfolio_id', portfolioId);
      
      if (allHoldings) {
        const soldStocks: string[] = [];
        const seenSymbols = new Set<string>();
        
        for (const holding of allHoldings) {
          const cleanHoldingSymbol = normalizeSymbol(holding.symbol);
          
          // Check for duplicates
          if (seenSymbols.has(cleanHoldingSymbol)) {
            // Delete duplicate with old format
            await supabase.from('holdings').delete().eq('id', holding.id);
            console.log(`Deleted duplicate holding: ${holding.symbol}`);
            continue;
          }
          seenSymbols.add(cleanHoldingSymbol);
          
          // Check if this holding exists in current broker positions
          const existsInBroker = positions.some(p => 
            normalizeSymbol(p.symbol).toLowerCase() === cleanHoldingSymbol.toLowerCase()
          );
          
          // If not in broker AND has shares > 0, mark as sold
          if (!existsInBroker && holding.shares > 0.0001) {
            console.log(`Detected sold stock: ${holding.symbol} (${holding.shares} shares)`);
            
            // Calculate sale proceeds (use current_price or avg_price as fallback)
            const salePrice = holding.current_price || holding.avg_price || 0;
            const totalValue = holding.shares * salePrice;
            const costBasis = holding.shares * (holding.avg_price || 0);
            const realizedPL = totalValue - costBasis;
            
            // Create SELL transaction
            const { error: txnError } = await supabase
              .from('transactions')
              .insert({
                portfolio_id: portfolioId,
                holding_id: holding.id,
                symbol: holding.symbol,
                type: 'SELL',
                shares: holding.shares,
                price: salePrice,
                total_value: totalValue,
                fees: 0,
                transaction_date: new Date().toISOString(),
                notes: `Auto-detected sold position from broker sync. Realized P/L: $${realizedPL.toFixed(2)}`
              });
            
            if (txnError) {
              console.error(`Failed to create SELL transaction for ${holding.symbol}:`, txnError);
            } else {
              console.log(`Created SELL transaction for ${holding.symbol}: ${holding.shares} shares @ $${salePrice}`);
            }
            
            // Mark holding as sold (set shares to 0)
            await supabase
              .from('holdings')
              .update({
                shares: 0,
                updated_at: new Date().toISOString()
              })
              .eq('id', holding.id);
            
            soldStocks.push(holding.symbol);
          }
        }
        
        if (soldStocks.length > 0) {
          console.log(`Marked ${soldStocks.length} stocks as sold: ${soldStocks.join(', ')}`);
        }
      }

      // Update connection status to connected
      await supabase
        .from('broker_connections')
        .update({ 
          status: 'connected', 
          last_sync: new Date().toISOString(),
          sync_error: null 
        })
        .eq('id', connectionId);

      return new Response(JSON.stringify({ 
        success: true, 
        positions: brokerData.positions,
        cashBalance: brokerData.cashBalance,
        message: `Synced ${brokerData.positions.length} positions and $${brokerData.cashBalance.toFixed(2)} cash balance from ${connection.provider_name}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (syncError: any) {
      // Update connection with error
      await supabase
        .from('broker_connections')
        .update({ 
          status: 'error', 
          sync_error: syncError.message 
        })
        .eq('id', connectionId);

      return new Response(JSON.stringify({ 
        success: false, 
        error: syncError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error: any) {
    console.error('Broker sync error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
