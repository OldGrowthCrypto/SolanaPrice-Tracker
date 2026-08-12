import { fetchMintPrices } from './jupiter.js';
import { get } from './request.js';

/** Last good quotes (survives temporary API blips) */
let _cache = {};

/**
 * BTC spot via Coinbase (no API key, reliable).
 * @returns {Promise<{price: number, change24h: null}|null>}
 */
async function fetchBtcCoinbase() {
  try {
    const res = await get('https://api.coinbase.com/v2/prices/BTC-USD/spot');
    const json = JSON.parse(res.body);
    const amount = Number(
      json && json.data && json.data.amount != null
        ? json.data.amount
        : NaN,
    );
    if (!Number.isNaN(amount) && amount > 0)
      return { price: amount, change24h: null };
  } catch (e) {
    console.warn(
      'OldGrowthPriceTracker: Coinbase BTC failed',
      e.message || e,
    );
  }
  return null;
}

/**
 * Unified quote fetch — Jupiter for Solana mints, Coinbase for BTC.
 * Never throws; returns best effort + sticky cache.
 *
 * @param {Array<{id: string, coingecko_id?: string, mint?: string}>} coins
 * @param {string} [_vsCurrency]
 * @returns {Promise<Record<string, {price: number, change24h: number|null}>>}
 */
export async function fetchQuotesForCoins(coins, _vsCurrency = 'usd') {
  const byId = {};
  if (!coins?.length) return { ..._cache };

  const mintList = [...new Set(coins.map(c => c.mint).filter(Boolean))];
  const needsBtc = coins.some(
    c =>
      !c.mint &&
      (c.coingecko_id === 'bitcoin' ||
        (c.title || '').toUpperCase() === 'BTC' ||
        (c.key || '') === 'btc'),
  );

  let jup = {};
  let btcQuote = null;

  const tasks = [];

  if (mintList.length) {
    tasks.push(
      fetchMintPrices(mintList)
        .then(r => {
          jup = r || {};
        })
        .catch(e => {
          console.warn(
            'OldGrowthPriceTracker: Jupiter failed',
            e.message || e,
          );
        }),
    );
  }

  if (needsBtc) {
    tasks.push(
      fetchBtcCoinbase().then(r => {
        btcQuote = r;
      }),
    );
  }

  try {
    await Promise.all(tasks);
  } catch (e) {
    console.warn('OldGrowthPriceTracker: price fetch partial failure', e);
  }

  for (const coin of coins) {
    let quote = null;

    if (coin.mint && jup[coin.mint]) quote = jup[coin.mint];

    if (
      !quote &&
      btcQuote &&
      (coin.coingecko_id === 'bitcoin' ||
        (coin.title || '').toUpperCase() === 'BTC' ||
        coin.key === 'btc')
    )
      quote = btcQuote;

    if (!quote && _cache[coin.id]) quote = _cache[coin.id];

    if (quote) {
      byId[coin.id] = quote;
      _cache[coin.id] = quote;
    }
  }

  return byId;
}

export function clearPriceCache() {
  _cache = {};
}
