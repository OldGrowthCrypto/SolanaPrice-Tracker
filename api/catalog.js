/**
 * Curated Old Growth catalog: panel defaults + Solana ecosystem list.
 */

/** Default max coins on the top bar (overridden by GSettings max-panel-coins) */
export const DEFAULT_MAX_PANEL_COINS = 5;

/** @deprecated use Settings.getMaxPanelCoins() — kept for callers mid-migration */
export const MAX_PANEL_COINS = DEFAULT_MAX_PANEL_COINS;

/** Wrapped SOL mint used by Jupiter / DexScreener */
export const WSOL_MINT = 'So11111111111111111111111111111111111111112';

/**
 * Portal (wrapped) BTC on Solana — used for Jupiter SOL↔BTC swap deep links.
 * Not used as the CoinGecko price mint (spot BTC still from Coinbase/CG).
 */
export const WBTC_SOL_MINT = '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh';

/**
 * Default top-bar coins (majors for a useful desk glance)
 */
export const PANEL_DEFAULTS = ['btc', 'sol', 'jup', 'bonk', 'jto'];

/** Full curated list shown in the menu */
export const CATALOG = [
  {
    key: 'btc',
    title: 'BTC',
    symbol: 'BTC/USD',
    coingecko_id: 'bitcoin',
    icon: 'btc',
    panelDefault: true,
    subtitle: 'Bitcoin',
    category: 'majors',
    // Solana-wrapped BTC for swap / copy (price still majors path)
    swap_mint: WBTC_SOL_MINT,
  },
  {
    key: 'sol',
    title: 'SOL',
    symbol: 'SOL/USD',
    coingecko_id: 'solana',
    mint: WSOL_MINT,
    icon: 'sol',
    panelDefault: true,
    subtitle: 'Solana',
    category: 'majors',
  },
  {
    key: 'jup',
    title: 'JUP',
    symbol: 'JUP/USD',
    coingecko_id: 'jupiter-exchange-solana',
    mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    icon: 'jup',
    panelDefault: true,
    subtitle: 'Jupiter',
    category: 'defi',
  },
  {
    key: 'bonk',
    title: 'BONK',
    symbol: 'BONK/USD',
    coingecko_id: 'bonk',
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    icon: 'bonk',
    panelDefault: true,
    subtitle: 'Bonk',
    category: 'meme',
  },
  {
    key: 'jto',
    title: 'JTO',
    symbol: 'JTO/USD',
    coingecko_id: 'jito-governance-token',
    mint: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
    icon: 'jto',
    panelDefault: true,
    subtitle: 'Jito',
    category: 'defi',
  },
  {
    key: 'pump',
    title: 'PUMP',
    symbol: 'PUMP/USD',
    coingecko_id: 'pump-fun',
    mint: 'pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn',
    icon: 'pump',
    panelDefault: false,
    subtitle: 'Pump.fun',
    category: 'meme',
  },
  {
    key: 'render',
    title: 'RENDER',
    symbol: 'RENDER/USD',
    coingecko_id: 'render-token',
    mint: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof',
    icon: 'render',
    panelDefault: false,
    subtitle: 'Render',
    category: 'ai',
  },
  {
    key: 'pengu',
    title: 'PENGU',
    symbol: 'PENGU/USD',
    coingecko_id: 'pudgy-penguins',
    mint: '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv',
    icon: 'pengu',
    panelDefault: false,
    subtitle: 'Pudgy Penguins',
    category: 'meme',
  },
  {
    key: 'trump',
    title: 'TRUMP',
    symbol: 'TRUMP/USD',
    coingecko_id: 'official-trump',
    mint: '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN',
    icon: 'trump',
    panelDefault: false,
    subtitle: 'Official Trump',
    category: 'meme',
  },
  {
    key: 'pyth',
    title: 'PYTH',
    symbol: 'PYTH/USD',
    coingecko_id: 'pyth-network',
    mint: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
    icon: 'pyth',
    panelDefault: false,
    subtitle: 'Pyth Network',
    category: 'defi',
  },
  {
    key: 'wif',
    title: 'WIF',
    symbol: 'WIF/USD',
    coingecko_id: 'dogwifcoin',
    mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    icon: 'wif',
    panelDefault: false,
    subtitle: 'dogwifhat',
    category: 'meme',
  },
];

export function catalogByKey(key) {
  return CATALOG.find(t => t.key === key) || null;
}

/**
 * First-run default watchlist (order = array index).
 */
export function defaultWatchlist() {
  return CATALOG.map((t, i) => ({
    id: `og-${t.key}-${String(i + 1).padStart(3, '0')}`,
    symbol: t.symbol,
    active: !!t.panelDefault,
    title: t.title,
    coingecko_id: t.coingecko_id || '',
    mint: t.mint || '',
    swap_mint: t.swap_mint || '',
    icon: t.icon,
    icon_path: '',
    pinned: false,
    subtitle: t.subtitle || '',
    key: t.key,
    added_at: Date.now() + i,
    order: i,
  }));
}

/**
 * Resolve Solana mint used for Jupiter swap / copy.
 * Prefer explicit mint, then swap_mint (e.g. BTC → portal wBTC).
 * @param {{mint?: string, swap_mint?: string, key?: string, coingecko_id?: string, title?: string}} coin
 */
export function resolveSwapMint(coin) {
  if (!coin) return '';
  const m = (coin.mint || '').trim();
  if (m) return m;
  const sm = (coin.swap_mint || '').trim();
  if (sm) return sm;
  // Known majors without mint on the coin object (legacy BTC installs)
  const key = (coin.key || '').toLowerCase();
  const title = (coin.title || '').toUpperCase();
  const gecko = (coin.coingecko_id || '').toLowerCase();
  if (key === 'btc' || title === 'BTC' || gecko === 'bitcoin')
    return WBTC_SOL_MINT;
  return '';
}

/**
 * Repair stored coins: icons + missing fields. Never re-add deleted tokens.
 * @param {object[]} coins
 * @param {{preserveActive?: boolean, maxPanel?: number}} [opts]
 */
export function repairWatchlist(coins, opts = {}) {
  const preserveActive = opts.preserveActive !== false;
  const maxPanel =
    typeof opts.maxPanel === 'number' ? opts.maxPanel : DEFAULT_MAX_PANEL_COINS;
  const list = Array.isArray(coins) ? coins.map(c => ({ ...c })) : [];
  const byKey = new Map(CATALOG.map(t => [t.key, t]));
  const byGecko = new Map(
    CATALOG.filter(t => t.coingecko_id).map(t => [t.coingecko_id, t]),
  );
  const byMint = new Map(
    CATALOG.filter(t => t.mint).map(t => [t.mint, t]),
  );

  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    const userActive = !!c.active;

    const cat =
      (c.key && byKey.get(c.key)) ||
      (c.coingecko_id && byGecko.get(c.coingecko_id)) ||
      (c.mint && byMint.get(c.mint)) ||
      null;
    if (cat) {
      c.key = cat.key;
      if (!c.icon_path) c.icon = cat.icon;
      if (!c.mint && cat.mint) c.mint = cat.mint;
      if (!c.swap_mint && cat.swap_mint) c.swap_mint = cat.swap_mint;
      if (!c.coingecko_id && cat.coingecko_id) c.coingecko_id = cat.coingecko_id;
      if (!c.subtitle) c.subtitle = cat.subtitle;
    } else if (c.icon === 'generic' || !c.icon) {
      c.icon = c.icon || 'generic';
    }

    if (preserveActive) c.active = userActive;
    if (!c.id)
      c.id = `og-fix-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    if (typeof c.order !== 'number') c.order = i;
    if (!c.added_at) c.added_at = Date.now() + i;
  }

  // Soft cap active coins
  let activeCount = 0;
  for (const c of list) {
    if (!c.active) continue;
    activeCount += 1;
    if (activeCount > maxPanel) c.active = false;
  }

  return list;
}

/**
 * Solana base58 mint check (32–44 chars, no 0/O/I/l).
 * @param {string} address
 * @returns {boolean}
 */
export function isLikelyMint(address) {
  if (!address || typeof address !== 'string') return false;
  const a = address.trim();
  // Solana pubkeys are 32 bytes → base58 typically 32–44 chars
  if (a.length < 32 || a.length > 44) return false;
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(a)) return false;
  return true;
}

export function shortMint(mint) {
  if (!mint || mint.length < 10) return mint || '';
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

/**
 * Filter catalog by free-text query.
 * @param {string} query
 */
export function searchCatalog(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [...CATALOG];
  return CATALOG.filter(
    t =>
      t.title.toLowerCase().includes(q) ||
      t.key.includes(q) ||
      (t.subtitle || '').toLowerCase().includes(q) ||
      (t.category || '').includes(q) ||
      (t.mint || '').toLowerCase().includes(q),
  );
}
