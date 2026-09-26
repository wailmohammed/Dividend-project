const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const FINNHUB_API = 'https://finnhub.io/api/v1';
const TRADING212_API = 'https://live.trading212.com/api/v0';

// Mock Exchange Rates
export const EXCHANGE_RATES: Record<string, number> = {
    'USD': 1,
    'EUR': 1.08,
    'GBP': 1.26,
    'JPY': 0.0067,
    'CAD': 0.73,
    'AUD': 0.65,
    'CHF': 1.10,
    'CNY': 0.14
};

export const convertToUSD = (amount: number, currency: string): number => {
    return amount * (EXCHANGE_RATES[currency] || 1);
};

// Map common symbols to CoinGecko IDs
const CRYPTO_MAP: Record<string, string> = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'SOL': 'solana',
    'DOGE': 'dogecoin',
    'ADA': 'cardano',
    'XRP': 'ripple',
    'DOT': 'polkadot',
    'USDT': 'tether',
    'BNB': 'binancecoin',
    'MATIC': 'matic-network'
};

export const fetchCryptoPrice = async (symbol: string): Promise<number | null> => {
    try {
        const id = CRYPTO_MAP[symbol.toUpperCase()];
        if (!id) return null;

        const res = await fetch(`${COINGECKO_API}/simple/price?ids=${id}&vs_currencies=usd`);
        if (!res.ok) throw new Error("CoinGecko API Error");

        const data = await res.json();
        return data[id]?.usd || null;
    } catch (e) {
        console.warn("CoinGecko fetch failed:", e);
        return null;
    }
};

export const fetchStockPrice = async (symbol: string, apiKey: string): Promise<number | null> => {
    // Finnhub API
    if (!apiKey) return null;

    try {
        const res = await fetch(`${FINNHUB_API}/quote?symbol=${symbol}&token=${apiKey}`);

        if (res.status === 429) {
            console.warn(`Finnhub rate limited for ${symbol}.`);
            return null;
        }
        if (res.status === 401 || res.status === 403) {
            console.warn("Finnhub API key is invalid.");
            return null;
        }
        if (!res.ok) return null;

        const data = await res.json();
        // Finnhub 'c' is current price. Ensure it's not 0.
        return data.c && data.c > 0 ? data.c : null;
    } catch (e) {
        console.warn("Finnhub fetch failed:", e);
        return null;
    }
};

export const fetchTrading212Positions = async (apiKey: string): Promise<any[]> => {
    if (!apiKey) {
        console.warn("Trading 212: No API Key provided.");
        return [];
    }

    try {
        console.log("Fetching Trading 212 Portfolio...");
        const res = await fetch(`${TRADING212_API}/equity/portfolio`, {
            headers: { 'Authorization': apiKey }
        });

        if (res.status === 401) {
            console.error("Trading 212 Error: Unauthorized (401). Check API Key.");
            return [];
        }

        if (!res.ok) {
            console.warn(`Trading 212 Fetch Error: ${res.status} ${res.statusText}`);
            return [];
        }

        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch (e) {
        console.warn("Trading 212 fetch failed.");
        return [];
    }
};
