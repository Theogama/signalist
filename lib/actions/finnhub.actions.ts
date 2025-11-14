'use server';

import { getDateRange, validateArticle, formatArticle } from '@/lib/utils';
import { POPULAR_STOCK_SYMBOLS } from '@/lib/constants';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { getWatchlistSymbolsByEmail } from '@/lib/actions/watchlist.actions';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const NEXT_PUBLIC_FINNHUB_API_KEY = process.env.NEXT_PUBLIC_FINNHUB_API_KEY ?? '';

async function fetchJSON<T>(url: string, revalidateSeconds?: number): Promise<T> {
  const options: RequestInit & { next?: { revalidate?: number } } = revalidateSeconds
    ? { cache: 'force-cache', next: { revalidate: revalidateSeconds } }
    : { cache: 'no-store' };

  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Fetch failed ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export { fetchJSON };

export async function getNews(symbols?: string[]): Promise<MarketNewsArticle[]> {
  try {
    const range = getDateRange(5);
    const token = process.env.FINNHUB_API_KEY ?? NEXT_PUBLIC_FINNHUB_API_KEY;
    if (!token) {
      throw new Error('FINNHUB API key is not configured');
    }
    const cleanSymbols = (symbols || [])
      .map((s) => s?.trim().toUpperCase())
      .filter((s): s is string => Boolean(s));

    const maxArticles = 6;

    // If we have symbols, try to fetch company news per symbol and round-robin select
    if (cleanSymbols.length > 0) {
      const perSymbolArticles: Record<string, RawNewsArticle[]> = {};

      await Promise.all(
        cleanSymbols.map(async (sym) => {
          try {
            const url = `${FINNHUB_BASE_URL}/company-news?symbol=${encodeURIComponent(sym)}&from=${range.from}&to=${range.to}&token=${token}`;
            const articles = await fetchJSON<RawNewsArticle[]>(url, 300);
            perSymbolArticles[sym] = (articles || []).filter(validateArticle);
          } catch (e) {
            console.error('Error fetching company news for', sym, e);
            perSymbolArticles[sym] = [];
          }
        })
      );

      const collected: MarketNewsArticle[] = [];
      // Round-robin up to 6 picks
      for (let round = 0; round < maxArticles; round++) {
        for (let i = 0; i < cleanSymbols.length; i++) {
          const sym = cleanSymbols[i];
          const list = perSymbolArticles[sym] || [];
          if (list.length === 0) continue;
          const article = list.shift();
          if (!article || !validateArticle(article)) continue;
          collected.push(formatArticle(article, true, sym, round));
          if (collected.length >= maxArticles) break;
        }
        if (collected.length >= maxArticles) break;
      }

      if (collected.length > 0) {
        // Sort by datetime desc
        collected.sort((a, b) => (b.datetime || 0) - (a.datetime || 0));
        return collected.slice(0, maxArticles);
      }
      // If none collected, fall through to general news
    }

    // General market news fallback or when no symbols provided
    const generalUrl = `${FINNHUB_BASE_URL}/news?category=general&token=${token}`;
    const general = await fetchJSON<RawNewsArticle[]>(generalUrl, 300);

    const seen = new Set<string>();
    const unique: RawNewsArticle[] = [];
    for (const art of general || []) {
      if (!validateArticle(art)) continue;
      const key = `${art.id}-${art.url}-${art.headline}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(art);
      if (unique.length >= 20) break; // cap early before final slicing
    }

    const formatted = unique.slice(0, maxArticles).map((a, idx) => formatArticle(a, false, undefined, idx));
    return formatted;
  } catch (err) {
    console.error('getNews error:', err);
    throw new Error('Failed to fetch news');
  }
}

export async function searchStocks(query?: string): Promise<StockWithWatchlistStatus[]> {
  try {
    const token = process.env.FINNHUB_API_KEY ?? NEXT_PUBLIC_FINNHUB_API_KEY;
    if (!token) {
      // If no token, log and return empty to avoid throwing per requirements
      console.error('Error in stock search:', new Error('FINNHUB API key is not configured'));
      return [];
    }

    const trimmed = typeof query === 'string' ? query.trim() : '';

    let results: FinnhubSearchResult[] = [];

    if (!trimmed) {
      // Fetch top 10 popular symbols' profiles
      const top = POPULAR_STOCK_SYMBOLS.slice(0, 10);
      const profiles = await Promise.all(
        top.map(async (sym) => {
          try {
            const url = `${FINNHUB_BASE_URL}/stock/profile2?symbol=${encodeURIComponent(sym)}&token=${token}`;
            // Revalidate every hour
            const profile = await fetchJSON<any>(url, 3600);
            return { sym, profile } as { sym: string; profile: any };
          } catch (e) {
            console.error('Error fetching profile2 for', sym, e);
            return { sym, profile: null } as { sym: string; profile: any };
          }
        })
      );

      results = profiles
        .map(({ sym, profile }) => {
          const symbol = sym.toUpperCase();
          const name: string | undefined = profile?.name || profile?.ticker || undefined;
          const exchange: string | undefined = profile?.exchange || undefined;
          if (!name) return undefined;
          const r: FinnhubSearchResult = {
            symbol,
            description: name,
            displaySymbol: symbol,
            type: 'Common Stock',
          };
          // We don't include exchange in FinnhubSearchResult type, so carry via mapping later using profile
          // To keep pipeline simple, attach exchange via closure map stage
          // We'll reconstruct exchange when mapping to final type
          (r as any).__exchange = exchange; // internal only
          return r;
        })
        .filter((x): x is FinnhubSearchResult => Boolean(x));
    } else {
      const url = `${FINNHUB_BASE_URL}/search?q=${encodeURIComponent(trimmed)}&token=${token}`;
      const data = await fetchJSON<FinnhubSearchResponse>(url, 1800);
      results = Array.isArray(data?.result) ? data.result : [];
    }

    const mapped: StockWithWatchlistStatus[] = results
      .map((r) => {
        const upper = (r.symbol || '').toUpperCase();
        const name = r.description || upper;
        const exchangeFromDisplay = (r.displaySymbol as string | undefined) || undefined;
        const exchangeFromProfile = (r as any).__exchange as string | undefined;
        const exchange = exchangeFromDisplay || exchangeFromProfile || 'US';
        const type = r.type || 'Stock';
        const item: StockWithWatchlistStatus = {
          symbol: upper,
          name,
          exchange,
          type,
          isInWatchlist: false,
        };
        return item;
      })
      .slice(0, 15);

    // Annotate with user's watchlist status
    try {
      const session = await auth.api.getSession({ headers: await headers() });
      const email = session?.user?.email || '';
      if (email) {
        const symbols = await getWatchlistSymbolsByEmail(email);
        const set = new Set(symbols.map((s) => s.toUpperCase()));
        return mapped.map((m) => ({ ...m, isInWatchlist: set.has(m.symbol.toUpperCase()) }));
      }
    } catch (e) {
      // non-fatal
      console.warn('searchStocks: unable to annotate watchlist status', e);
    }

    return mapped;
  } catch (err) {
    console.error('Error in stock search:', err);
    return [];
  }
}

// Get combined stock details (quote, profile, financial metrics)
export async function getStockDetails(symbol: string): Promise<{ symbol: string; profile?: ProfileData; quote?: QuoteData; financials?: FinancialsData; company?: string; currentPrice?: number; changePercent?: number; marketCap?: number; peRatio?: number; }> {
  const token = process.env.FINNHUB_API_KEY ?? NEXT_PUBLIC_FINNHUB_API_KEY;
  if (!token) throw new Error('FINNHUB API key is not configured');
  const sym = symbol.toUpperCase();

  // Fetch each endpoint independently, allowing partial failures
  const [profileResult, quoteResult, financialsResult] = await Promise.allSettled([
    fetchJSON<ProfileData>(`${FINNHUB_BASE_URL}/stock/profile2?symbol=${encodeURIComponent(sym)}&token=${token}`, 600),
    fetchJSON<QuoteData>(`${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(sym)}&token=${token}`, 60),
    fetchJSON<FinancialsData>(`${FINNHUB_BASE_URL}/stock/metric?symbol=${encodeURIComponent(sym)}&metric=all&token=${token}`, 1800),
  ]);

  const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
  const quote = quoteResult.status === 'fulfilled' ? quoteResult.value : null;
  const financials = financialsResult.status === 'fulfilled' ? financialsResult.value : null;

  // Log errors for debugging
  if (profileResult.status === 'rejected') {
    console.error(`Error fetching profile for ${sym}:`, profileResult.reason);
  }
  if (quoteResult.status === 'rejected') {
    console.error(`Error fetching quote for ${sym}:`, quoteResult.reason);
  }
  if (financialsResult.status === 'rejected') {
    console.error(`Error fetching financials for ${sym}:`, financialsResult.reason);
  }

  const marketCap = typeof profile?.marketCapitalization === 'number' ? profile.marketCapitalization : undefined;
  const peRatio = typeof (financials as any)?.metric?.peBasicExclExtraTTM === 'number' ? (financials as any).metric.peBasicExclExtraTTM : undefined;

  return {
    symbol: sym,
    profile: profile || undefined,
    quote: quote || undefined,
    financials: financials || undefined,
    company: profile?.name || sym,
    currentPrice: quote?.c,
    changePercent: quote?.dp,
    marketCap,
    peRatio,
  };
}

// Get user's watchlist with live data for each item
export async function getWatchlistWithData(): Promise<StockWithData[]> {
  try {
    const { getUserWatchlist } = await import('@/lib/actions/watchlist.actions');
    const items = await getUserWatchlist();

    const enriched = await Promise.allSettled(
      items.map(async (it: any) => {
        try {
          const details = await getStockDetails(it.symbol);
          const price = details.currentPrice ?? 0;
          const change = details.changePercent ?? 0;
          const marketCap = details.marketCap;
          const pe = details.peRatio;

          const priceFormatted = typeof price === 'number' ? `$${price.toFixed(2)}` : '-';
          const changeFormatted = typeof change === 'number' ? `${change.toFixed(2)}%` : '-';
          const marketCapFormatted = typeof marketCap === 'number' ? `$${(marketCap >= 1e12 ? (marketCap/1e12).toFixed(2)+'T' : marketCap >= 1e9 ? (marketCap/1e9).toFixed(2)+'B' : marketCap >= 1e6 ? (marketCap/1e6).toFixed(2)+'M' : marketCap.toFixed(0))}` : '-';
          const peFormatted = typeof pe === 'number' ? pe.toFixed(2) : '-';

          const out: StockWithData = {
            userId: it.userId,
            symbol: it.symbol,
            company: details.company || it.company,
            addedAt: it.addedAt,
            currentPrice: price,
            changePercent: change,
            priceFormatted,
            changeFormatted,
            marketCap: marketCapFormatted,
            peRatio: peFormatted,
          };
          return out;
        } catch (e) {
          console.error(`Error fetching details for ${it.symbol}:`, e);
          // Return a fallback entry with minimal data
          return {
            userId: it.userId,
            symbol: it.symbol,
            company: it.company,
            addedAt: it.addedAt,
            currentPrice: 0,
            changePercent: 0,
            priceFormatted: '-',
            changeFormatted: '-',
            marketCap: '-',
            peRatio: '-',
          } as StockWithData;
        }
      })
    );

    // Filter out failed promises and return only successful results
    return enriched
      .filter((result): result is PromiseFulfilledResult<StockWithData> => result.status === 'fulfilled')
      .map((result) => result.value);
  } catch (e) {
    console.error('getWatchlistWithData error:', e);
    // Return empty array instead of throwing to allow page to render
    return [];
  }
}

