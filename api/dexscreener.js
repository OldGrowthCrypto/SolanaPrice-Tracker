import { get } from './request.js';
import { logDebug, logWarn } from '../utils/log.js';
import { WSOL_MINT } from './catalog.js';

/**
 * Normalize a quote object.
 * @param {number} price
 * @param {number|null} change24h
 * @param {string} source
 * @param {number} [timestamp]
 */
export function makeQuote(price, change24h, source, timestamp = Date.now()) {
  return {
    price: Number(price),
    change24h:
      change24h === undefined || change24h === null || Number.isNaN(change24h)
        ? null
        : Number(change24h),
    source: source || 'unknown',
    timestamp: timestamp || Date.now(),
  };
}

/**
 * Fetch USD prices for Solana mints via DexScreener (fallback for Jupiter).
 * Uses latest/dex/tokens which accepts comma-separated addresses.
 *
 * @param {string[]} mints
 * @returns {Promise<Record<string, {price: number, change24h: number|null, source: string, timestamp: number}>>}
 */
export async function fetchMintPricesDex(mints) {
  const unique = [...new Set(mints.filter(Boolean))];
  if (!unique.length) return {};

  const out = {};
  const now = Date.now();

  // DexScreener accepts multiple addresses; chunk to avoid huge URLs
  const chunkSize = 20;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    try {
      const url = `https://api.dexscreener.com/latest/dex/tokens/${chunk.map(encodeURIComponent).join(',')}`;
      const res = await get(url);
      const json = JSON.parse(res.body);
      const pairs = Array.isArray(json.pairs) ? json.pairs : [];

      // Best liquidity pair per mint
      const best = new Map();
      for (const p of pairs) {
        if (p.chainId && p.chainId !== 'solana') continue;
        const base = (p.baseToken?.address || '').trim();
        const quote = (p.quoteToken?.address || '').trim();
        const price = p.priceUsd != null ? Number(p.priceUsd) : NaN;
        if (!Number.isFinite(price) || price <= 0) continue;
        const change =
          p.priceChange?.h24 === undefined || p.priceChange?.h24 === null
            ? null
            : Number(p.priceChange.h24);
        const liq = p.liquidity?.usd || 0;

        for (const mint of [base, quote]) {
          if (!mint || !chunk.includes(mint)) continue;
          // Prefer pair where mint is base (priceUsd is usually for base)
          const isBase = mint === base;
          const prev = best.get(mint);
          if (!prev || (isBase && !prev.isBase) || liq > prev.liq) {
            best.set(mint, { price, change, liq, isBase });
          }
        }
      }

      for (const [mint, row] of best) {
        out[mint] = makeQuote(row.price, row.change, 'dexscreener', now);
      }
      logDebug(`DexScreener prices: ${best.size}/${chunk.length} mints`);
    } catch (e) {
      logWarn('DexScreener price fetch failed', e.message || e);
    }
  }

  return out;
}

export function birdeyeUrl(mint) {
  return mint
    ? `https://birdeye.so/token/${mint}?chain=solana`
    : 'https://birdeye.so/';
}

export function dexscreenerUrl(mint) {
  return mint
    ? `https://dexscreener.com/solana/${mint}`
    : 'https://dexscreener.com/solana';
}

/** Jupiter swap SOL → token (path form) */
export function jupiterUrl(mint) {
  return mint
    ? `https://jup.ag/swap/SOL-${mint}`
    : 'https://jup.ag/swap/SOL-USDC';
}

/**
 * Jupiter swap deep link: sell WSOL, buy target mint.
 * Uses query form so wrapped BTC / any mint works consistently.
 * @param {string} mint buy-side mint
 */
export function jupiterSwapSolUrl(mint) {
  if (!mint) return 'https://jup.ag/swap/SOL-USDC';
  // Explicit sell=WSOL & buy=mint (user BTC link style)
  return (
    'https://jup.ag/swap?buy=' +
    encodeURIComponent(mint) +
    '&sell=' +
    encodeURIComponent(WSOL_MINT)
  );
}

/** Jupiter token / market page (chart-ish) */
export function jupiterTokenUrl(mint) {
  return mint ? `https://jup.ag/tokens/${mint}` : 'https://jup.ag/';
}

/**
 * Chart URL by provider preference.
 * @param {string} mint
 * @param {'dexscreener'|'birdeye'|'jupiter'} provider
 * @param {string} [coingeckoId] fallback without mint
 */
export function chartUrlForProvider(mint, provider, coingeckoId = '') {
  const p = (provider || 'dexscreener').toLowerCase();
  if (mint) {
    if (p === 'birdeye') return birdeyeUrl(mint);
    if (p === 'jupiter') return jupiterTokenUrl(mint);
    return dexscreenerUrl(mint);
  }
  if (coingeckoId)
    return `https://www.coingecko.com/en/coins/${coingeckoId}`;
  return 'https://dexscreener.com/solana';
}

export const CHART_PROVIDERS = [
  { id: 'dexscreener', label: 'DexScreener' },
  { id: 'birdeye', label: 'Birdeye' },
  { id: 'jupiter', label: 'Jupiter' },
];
