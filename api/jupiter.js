import { get } from './request.js';
import { makeQuote } from './dexscreener.js';
import { logDebug, logWarn } from '../utils/log.js';

/**
 * Fetch USD prices (+ 24h change when available) for Solana mint addresses
 * via Jupiter Price API v3.
 *
 * @param {string[]} mints
 * @returns {Promise<Record<string, {price: number, change24h: number|null, source: string, timestamp: number}>>}
 */
export async function fetchMintPrices(mints) {
  const unique = [...new Set(mints.filter(Boolean))];
  if (unique.length === 0) return {};

  const url =
    'https://api.jup.ag/price/v3?ids=' +
    unique.map(encodeURIComponent).join(',');
  const res = await get(url);
  const json = JSON.parse(res.body);
  const out = {};
  const now = Date.now();

  for (const mint of unique) {
    const row = json[mint];
    if (!row || row.usdPrice === undefined || row.usdPrice === null) continue;
    const price = Number(row.usdPrice);
    if (!Number.isFinite(price) || price <= 0) continue;
    out[mint] = makeQuote(
      price,
      row.priceChange24h === undefined || row.priceChange24h === null
        ? null
        : Number(row.priceChange24h),
      'jupiter',
      now,
    );
  }

  logDebug(`Jupiter prices: ${Object.keys(out).length}/${unique.length} mints`);
  return out;
}

/**
 * Resolve symbol/name/icon for a mint via DexScreener (no API key).
 * @param {string} mint
 * @returns {Promise<{symbol: string, name: string, price: number|null, change24h: number|null, imageUrl: string, mint: string}>}
 */
export async function lookupMint(mint) {
  let pairs = [];
  try {
    const url = `https://api.dexscreener.com/token-pairs/v1/solana/${encodeURIComponent(mint)}`;
    const res = await get(url);
    const json = JSON.parse(res.body);
    if (Array.isArray(json)) pairs = json;
  } catch (e) {
    logDebug('lookupMint token-pairs failed', e.message || e);
  }

  if (!pairs.length) {
    try {
      const url = `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`;
      const res = await get(url);
      const json = JSON.parse(res.body);
      pairs = Array.isArray(json.pairs) ? json.pairs : [];
    } catch (e) {
      logDebug('lookupMint latest/tokens failed', e.message || e);
    }
  }

  if (pairs.length === 0) {
    try {
      const prices = await fetchMintPrices([mint]);
      const q = prices[mint];
      if (!q) throw new Error('Mint not found on Solana DEXes');
      return {
        symbol: 'TOKEN',
        name: 'Custom token',
        price: q.price,
        change24h: q.change24h,
        imageUrl: `https://dd.dexscreener.com/ds-data/tokens/solana/${mint}.png`,
        mint,
      };
    } catch (e) {
      logWarn('lookupMint fallback failed', e.message || e);
      throw e;
    }
  }

  const solPairs = pairs.filter(p => !p.chainId || p.chainId === 'solana');
  const pool = (solPairs.length ? solPairs : pairs).sort(
    (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0),
  )[0];

  const mintLc = mint.toLowerCase();
  let token = pool.baseToken || {};
  if ((token.address || '').toLowerCase() !== mintLc) {
    if ((pool.quoteToken?.address || '').toLowerCase() === mintLc)
      token = pool.quoteToken;
  }

  let imageUrl = '';
  if (pool.info && pool.info.imageUrl) imageUrl = String(pool.info.imageUrl);

  if (!imageUrl) {
    for (const p of solPairs.length ? solPairs : pairs) {
      const bt = p.baseToken || {};
      const qt = p.quoteToken || {};
      const match =
        (bt.address || '').toLowerCase() === mintLc ||
        (qt.address || '').toLowerCase() === mintLc;
      if (match && p.info && p.info.imageUrl) {
        imageUrl = String(p.info.imageUrl);
        break;
      }
    }
  }

  if (!imageUrl)
    imageUrl = `https://dd.dexscreener.com/ds-data/tokens/solana/${mint}.png`;

  return {
    symbol: (token.symbol || 'TOKEN').toUpperCase(),
    name: token.name || token.symbol || 'Custom token',
    price: pool.priceUsd ? Number(pool.priceUsd) : null,
    change24h:
      pool.priceChange?.h24 === undefined || pool.priceChange?.h24 === null
        ? null
        : Number(pool.priceChange.h24),
    imageUrl,
    mint,
  };
}
