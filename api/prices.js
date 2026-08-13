import { fetchMintPrices } from './jupiter.js';
import { fetchMintPricesDex, makeQuote } from './dexscreener.js';
import { fetchPrices as fetchCoinGecko } from './coingecko.js';
import { get } from './request.js';
import { logDebug, logWarn, logInfo } from '../utils/log.js';

/** Sticky last-good quotes: coinId → full normalized quote */
let _cache = {};

/** Age (ms) after which a quote is considered stale for UI */
export const STALE_MS = 90 * 1000;

/**
 * @param {object|null} quote
 * @param {number} [now]
 * @returns {boolean}
 */
export function isQuoteStale(quote, now = Date.now()) {
  if (!quote || !quote.timestamp) return true;
  return now - quote.timestamp > STALE_MS;
}

/**
 * Merge two quotes: prefer primary price; fill missing change from fallback.
 * @param {object|null} primary
 * @param {object|null} fallback
 * @returns {object|null}
 */
export function mergeQuotes(primary, fallback) {
  if (!primary && !fallback) return null;
  if (!primary) return fallback ? { ...fallback } : null;
  if (!fallback) return { ...primary };
  return {
    price: primary.price,
    change24h:
      primary.change24h !== null && primary.change24h !== undefined
        ? primary.change24h
        : fallback.change24h,
    source:
      primary.change24h !== null && primary.change24h !== undefined
        ? primary.source
        : `${primary.source}+${fallback.source}`,
    timestamp: Math.max(primary.timestamp || 0, fallback.timestamp || 0) || Date.now(),
  };
}

/**
 * BTC spot via Coinbase (no API key, reliable).
 * @returns {Promise<{price: number, change24h: null, source: string, timestamp: number}|null>}
 */
async function fetchBtcCoinbaseSpot() {
  try {
    const res = await get('https://api.coinbase.com/v2/prices/BTC-USD/spot');
    const json = JSON.parse(res.body);
    const amount = Number(
      json && json.data && json.data.amount != null ? json.data.amount : NaN,
    );
    if (!Number.isNaN(amount) && amount > 0)
      return makeQuote(amount, null, 'coinbase', Date.now());
  } catch (e) {
    logWarn('Coinbase BTC spot failed', e.message || e);
  }
  return null;
}

/**
 * BTC 24h change from Coinbase exchange product stats (open → last).
 * @returns {Promise<number|null>}
 */
async function fetchBtcCoinbaseChange() {
  try {
    const res = await get(
      'https://api.exchange.coinbase.com/products/BTC-USD/stats',
    );
    const json = JSON.parse(res.body);
    const open = Number(json.open);
    const last = Number(json.last);
    if (open > 0 && last > 0) {
      const ch = ((last - open) / open) * 100;
      if (Number.isFinite(ch)) return ch;
    }
  } catch (e) {
    logDebug('Coinbase BTC stats failed', e.message || e);
  }
  return null;
}

/**
 * @param {object} coin
 * @returns {boolean}
 */
function isBtcCoin(coin) {
  return (
    coin.coingecko_id === 'bitcoin' ||
    (coin.title || '').toUpperCase() === 'BTC' ||
    (coin.key || '') === 'btc' ||
    (coin.symbol || '').toUpperCase().startsWith('BTC')
  );
}

/**
 * Unified quote fetch.
 * Solana mints: Jupiter → DexScreener → CoinGecko (if coingecko_id)
 * BTC: Coinbase spot + Coinbase stats / CoinGecko for 24h change
 * Majors with coingecko_id: CoinGecko as secondary for 24h change
 *
 * Never throws; returns best effort + sticky cache with full quote objects.
 *
 * @param {Array<{id: string, coingecko_id?: string, mint?: string, title?: string, key?: string, symbol?: string}>} coins
 * @param {string} [vsCurrency]
 * @returns {Promise<Record<string, {price: number, change24h: number|null, source: string, timestamp: number}>>}
 */
export async function fetchQuotesForCoins(coins, vsCurrency = 'usd') {
  const byId = {};
  if (!coins?.length) return { ..._cache };

  const mintList = [...new Set(coins.map(c => c.mint).filter(Boolean))];
  const geckoIds = [
    ...new Set(
      coins
        .map(c => c.coingecko_id)
        .filter(Boolean)
        .concat(coins.some(isBtcCoin) ? ['bitcoin'] : []),
    ),
  ];
  const needsBtc = coins.some(c => isBtcCoin(c) && !c.mint);

  let jup = {};
  let dex = {};
  let gecko = {};
  let btcSpot = null;
  let btcChange = null;

  const tasks = [];

  if (mintList.length) {
    tasks.push(
      fetchMintPrices(mintList)
        .then(r => {
          jup = r || {};
        })
        .catch(e => {
          logWarn('Jupiter failed', e.message || e);
        }),
    );
  }

  if (needsBtc) {
    tasks.push(
      fetchBtcCoinbaseSpot().then(r => {
        btcSpot = r;
      }),
    );
    tasks.push(
      fetchBtcCoinbaseChange().then(r => {
        btcChange = r;
      }),
    );
  }

  if (geckoIds.length) {
    tasks.push(
      fetchCoinGecko(geckoIds, vsCurrency)
        .then(r => {
          gecko = r || {};
        })
        .catch(e => {
          logWarn('CoinGecko failed', e.message || e);
        }),
    );
  }

  try {
    await Promise.all(tasks);
  } catch (e) {
    logWarn('price fetch partial failure', e.message || e);
  }

  // DexScreener only for mints still missing after Jupiter
  const missingMints = mintList.filter(m => !jup[m]);
  if (missingMints.length) {
    try {
      dex = await fetchMintPricesDex(missingMints);
    } catch (e) {
      logWarn('DexScreener fallback failed', e.message || e);
    }
  }

  for (const coin of coins) {
    let quote = null;

    // 1) Solana mint path
    if (coin.mint) {
      quote = jup[coin.mint] || dex[coin.mint] || null;
      // CoinGecko can fill 24h change for known majors
      if (coin.coingecko_id && gecko[coin.coingecko_id]) {
        quote = mergeQuotes(quote, gecko[coin.coingecko_id]);
      }
    }

    // 2) BTC fast path
    if (!quote && needsBtc && isBtcCoin(coin)) {
      if (btcSpot) {
        let ch = btcChange;
        if (
          (ch === null || ch === undefined) &&
          gecko.bitcoin &&
          gecko.bitcoin.change24h != null
        )
          ch = gecko.bitcoin.change24h;
        quote = makeQuote(
          btcSpot.price,
          ch,
          ch != null
            ? btcChange != null
              ? 'coinbase'
              : 'coinbase+coingecko'
            : 'coinbase',
          Date.now(),
        );
      } else if (gecko.bitcoin) {
        quote = gecko.bitcoin;
      }
    }

    // 3) CoinGecko-only majors (no mint)
    if (!quote && coin.coingecko_id && gecko[coin.coingecko_id])
      quote = gecko[coin.coingecko_id];

    // 4) Sticky cache (preserve original timestamp)
    if (!quote && _cache[coin.id]) {
      quote = { ..._cache[coin.id] };
      logDebug(`cache hit ${coin.title || coin.id} @ ${quote.timestamp}`);
    }

    if (quote && quote.price != null && Number.isFinite(quote.price)) {
      // Ensure normalized shape
      const full = makeQuote(
        quote.price,
        quote.change24h,
        quote.source || 'cache',
        quote.timestamp || Date.now(),
      );
      byId[coin.id] = full;
      // Only refresh cache timestamp when we got fresh data (not pure cache)
      if (quote.source !== 'cache' || !_cache[coin.id])
        _cache[coin.id] = full;
      else _cache[coin.id] = full; // keep as-is including old timestamp
    }
  }

  logInfo(
    `quotes ${Object.keys(byId).length}/${coins.length}` +
      ` jup=${Object.keys(jup).length} dex=${Object.keys(dex).length}` +
      ` gecko=${Object.keys(gecko).length}`,
  );

  return byId;
}

export function clearPriceCache() {
  _cache = {};
}

export function getCachedQuote(coinId) {
  return _cache[coinId] || null;
}
