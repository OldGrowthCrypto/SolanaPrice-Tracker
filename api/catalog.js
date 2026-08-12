/**
 * Curated Old Growth catalog: panel defaults + Solana ecosystem list.
 */

/** Max coins shown at once on the GNOME top bar */
export const MAX_PANEL_COINS = 5;

/** Wrapped SOL mint used by Jupiter / DexScreener */
export const WSOL_MINT = 'So11111111111111111111111111111111111111112';

/**
 * Default top-bar coins (5 majors for a useful desk glance)
 * BTC, SOL, JUP, BONK, JTO
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
    pinned: true,
    subtitle: 'Bitcoin',
  },
  {
    key: 'sol',
    title: 'SOL',
    symbol: 'SOL/USD',
    coingecko_id: 'solana',
    mint: WSOL_MINT,
    icon: 'sol',
    panelDefault: true,
    pinned: true,
    subtitle: 'Solana',
  },
  {
    key: 'jup',
    title: 'JUP',
    symbol: 'JUP/USD',
    coingecko_id: 'jupiter-exchange-solana',
    mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    icon: 'jup',
    panelDefault: true,
    pinned: true,
    subtitle: 'Jupiter',
  },
  {
    key: 'bonk',
    title: 'BONK',
    symbol: 'BONK/USD',
    coingecko_id: 'bonk',
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    icon: 'bonk',
    panelDefault: true,
    pinned: false,
    subtitle: 'Bonk',
  },
  {
    key: 'jto',
    title: 'JTO',
    symbol: 'JTO/USD',
    coingecko_id: 'jito-governance-token',
    mint: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
    icon: 'jto',
    panelDefault: true,
    pinned: false,
    subtitle: 'Jito',
  },
  {
    key: 'pump',
    title: 'PUMP',
    symbol: 'PUMP/USD',
    coingecko_id: 'pump-fun',
    mint: 'pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn',
    icon: 'pump',
    panelDefault: false,
    pinned: false,
    subtitle: 'Pump.fun',
  },
  {
    key: 'render',
    title: 'RENDER',
    symbol: 'RENDER/USD',
    coingecko_id: 'render-token',
    mint: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof',
    icon: 'render',
    panelDefault: false,
    pinned: false,
    subtitle: 'Render',
  },
  {
    key: 'pengu',
    title: 'PENGU',
    symbol: 'PENGU/USD',
    coingecko_id: 'pudgy-penguins',
    mint: '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv',
    icon: 'pengu',
    panelDefault: false,
    pinned: false,
    subtitle: 'Pudgy Penguins',
  },
  {
    key: 'trump',
    title: 'TRUMP',
    symbol: 'TRUMP/USD',
    coingecko_id: 'official-trump',
    mint: '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN',
    icon: 'trump',
    panelDefault: false,
    pinned: false,
    subtitle: 'Official Trump',
  },
  {
    key: 'pyth',
    title: 'PYTH',
    symbol: 'PYTH/USD',
    coingecko_id: 'pyth-network',
    mint: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
    icon: 'pyth',
    panelDefault: false,
    pinned: false,
    subtitle: 'Pyth Network',
  },
  {
    key: 'wif',
    title: 'WIF',
    symbol: 'WIF/USD',
    coingecko_id: 'dogwifcoin',
    mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    icon: 'wif',
    panelDefault: false,
    pinned: false,
    subtitle: 'dogwifhat',
  },
];

export function catalogByKey(key) {
  return CATALOG.find(t => t.key === key) || null;
}

export function defaultWatchlist() {
  return CATALOG.map((t, i) => ({
    id: `og-${t.key}-${String(i + 1).padStart(3, '0')}`,
    symbol: t.symbol,
    active: !!t.panelDefault,
    title: t.title,
    coingecko_id: t.coingecko_id || '',
    mint: t.mint || '',
    icon: t.icon,
    pinned: !!t.pinned,
    subtitle: t.subtitle || '',
    key: t.key,
  }));
}

/**
 * Repair stored coins: icons + missing catalog entries.
 * @param {object[]} coins
 * @param {{preserveActive?: boolean}} [opts]
 *   preserveActive (default true): never rewrite user's on-bar toggles
 *   except when zero coins are active (then apply PANEL_DEFAULTS).
 */
export function repairWatchlist(coins, opts = {}) {
  const preserveActive = opts.preserveActive !== false;
  const list = Array.isArray(coins) ? coins.map(c => ({ ...c })) : [];
  const byKey = new Map(CATALOG.map(t => [t.key, t]));
  const byGecko = new Map(
    CATALOG.filter(t => t.coingecko_id).map(t => [t.coingecko_id, t]),
  );
  const byMint = new Map(
    CATALOG.filter(t => t.mint).map(t => [t.mint, t]),
  );

  for (const c of list) {
    // Snapshot user's active choice before any repair
    const userActive = !!c.active;

    const cat =
      (c.key && byKey.get(c.key)) ||
      (c.coingecko_id && byGecko.get(c.coingecko_id)) ||
      (c.mint && byMint.get(c.mint)) ||
      null;
    if (cat) {
      c.key = cat.key;
      // Don't clobber custom icons
      if (!c.icon_path) c.icon = cat.icon;
      if (!c.mint && cat.mint) c.mint = cat.mint;
      if (!c.coingecko_id && cat.coingecko_id) c.coingecko_id = cat.coingecko_id;
      if (!c.subtitle) c.subtitle = cat.subtitle;
    } else if (c.icon === 'generic' || !c.icon) {
      c.icon = c.icon || 'generic';
    }

    if (preserveActive) c.active = userActive;
    // Ensure every coin has a stable id
    if (!c.id)
      c.id = `og-fix-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // Seed full catalog ONLY when the list is empty (first install).
  // Never re-add tokens the user deleted — that made trash look broken.
  const wasEmpty = list.length === 0;
  if (wasEmpty) {
    let i = 0;
    for (const t of CATALOG) {
      i += 1;
      list.push({
        id: `og-${t.key}-${String(i).padStart(3, '0')}`,
        symbol: t.symbol,
        active: !!t.panelDefault,
        title: t.title,
        coingecko_id: t.coingecko_id || '',
        mint: t.mint || '',
        icon: t.icon,
        icon_path: '',
        pinned: false, // user can remove any token
        subtitle: t.subtitle || '',
        key: t.key,
      });
    }
  }

  // If nothing is on the bar, restore defaults (first run / user cleared all)
  let activeCount = list.filter(c => c.active).length;
  if (activeCount === 0) {
    for (const key of PANEL_DEFAULTS) {
      const c = list.find(x => x.key === key);
      if (c) c.active = true;
    }
  }

  // Soft cap: if somehow more than max are active, keep first MAX in list order
  // (user toggles should prevent this; only a safety net)
  activeCount = 0;
  for (const c of list) {
    if (!c.active) continue;
    activeCount += 1;
    if (activeCount > MAX_PANEL_COINS) c.active = false;
  }

  return list;
}

/** Loose Solana base58 mint check (32–44 chars, no 0/O/I/l). */
export function isLikelyMint(address) {
  if (!address || typeof address !== 'string') return false;
  const a = address.trim();
  if (a.length < 32 || a.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(a);
}

export function shortMint(mint) {
  if (!mint || mint.length < 10) return mint || '';
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}
