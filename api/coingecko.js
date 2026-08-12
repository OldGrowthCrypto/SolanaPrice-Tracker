import { get } from './request.js';

/**
 * Batch-fetch prices + 24h change for CoinGecko IDs.
 *
 * @param {string[]} ids
 * @param {string} vsCurrency
 * @returns {Promise<Record<string, {price: number, change24h: number|null}>>}
 */
export async function fetchPrices(ids, vsCurrency = 'usd') {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};

  const vs = (vsCurrency || 'usd').toLowerCase();
  const url =
    'https://api.coingecko.com/api/v3/simple/price' +
    `?ids=${encodeURIComponent(unique.join(','))}` +
    `&vs_currencies=${encodeURIComponent(vs)}` +
    '&include_24hr_change=true';

  const res = await get(url);
  const json = JSON.parse(res.body);
  const out = {};

  for (const id of unique) {
    const row = json[id];
    if (!row || row[vs] === undefined || row[vs] === null) continue;
    const changeKey = `${vs}_24h_change`;
    out[id] = {
      price: Number(row[vs]),
      change24h:
        row[changeKey] === undefined || row[changeKey] === null
          ? null
          : Number(row[changeKey]),
    };
  }

  return out;
}

export function chartUrl(coingeckoId) {
  if (!coingeckoId) return 'https://www.coingecko.com/';
  return `https://www.coingecko.com/en/coins/${coingeckoId}`;
}

/** Built-in map: short title/symbol → coingecko id + icon stem */
export const KNOWN_COINS = {
  btc: { id: 'bitcoin', icon: 'btc', title: 'BTC' },
  bitcoin: { id: 'bitcoin', icon: 'btc', title: 'BTC' },
  sol: { id: 'solana', icon: 'sol', title: 'SOL' },
  solana: { id: 'solana', icon: 'sol', title: 'SOL' },
  jup: { id: 'jupiter-exchange-solana', icon: 'jup', title: 'JUP' },
  jupiter: { id: 'jupiter-exchange-solana', icon: 'jup', title: 'JUP' },
  pump: { id: 'pump-fun', icon: 'pump', title: 'PUMP' },
  render: { id: 'render-token', icon: 'render', title: 'RENDER' },
  rndr: { id: 'render-token', icon: 'render', title: 'RENDER' },
  pengu: { id: 'pudgy-penguins', icon: 'pengu', title: 'PENGU' },
  trump: { id: 'official-trump', icon: 'trump', title: 'TRUMP' },
  pyth: { id: 'pyth-network', icon: 'pyth', title: 'PYTH' },
  jto: { id: 'jito-governance-token', icon: 'jto', title: 'JTO' },
  jito: { id: 'jito-governance-token', icon: 'jto', title: 'JTO' },
  bonk: { id: 'bonk', icon: 'bonk', title: 'BONK' },
  wif: { id: 'dogwifcoin', icon: 'wif', title: 'WIF' },
  dogwifhat: { id: 'dogwifcoin', icon: 'wif', title: 'WIF' },
};
