/**
 * Normalize coin objects to a stable shape used everywhere.
 */

function _uuid() {
  let dt = Date.now();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (dt + Math.random() * 16) % 16 | 0;
    dt = Math.floor(dt / 16);
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const CHART_OK = new Set(['dexscreener', 'birdeye', 'jupiter']);

/**
 * @param {object} raw
 * @param {number} [index] used as default order
 * @returns {object}
 */
export function normalizeCoin(raw, index = 0) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const title = String(c.title || c.symbol?.split?.('/')[0] || 'TOKEN')
    .toUpperCase()
    .slice(0, 16);
  const symbol = String(c.symbol || `${title}/USD`).toUpperCase();
  const order =
    typeof c.order === 'number' && Number.isFinite(c.order)
      ? c.order
      : index;

  let chart_provider = (c.chart_provider || '').toLowerCase().trim();
  if (chart_provider && !CHART_OK.has(chart_provider)) chart_provider = '';

  const alert_up_pct =
    c.alert_up_pct !== undefined && c.alert_up_pct !== null && c.alert_up_pct !== ''
      ? Number(c.alert_up_pct)
      : null;
  const alert_down_pct =
    c.alert_down_pct !== undefined &&
    c.alert_down_pct !== null &&
    c.alert_down_pct !== ''
      ? Number(c.alert_down_pct)
      : null;

  return {
    id: c.id || _uuid(),
    title,
    symbol,
    mint: (c.mint || '').trim(),
    swap_mint: (c.swap_mint || '').trim(),
    coingecko_id: (c.coingecko_id || '').trim(),
    active: !!c.active,
    icon: c.icon || 'generic',
    icon_path: c.icon_path || '',
    added_at: c.added_at || Date.now(),
    order,
    key: c.key || '',
    subtitle: c.subtitle || '',
    pinned: false,
    // Chart preference (empty = global default)
    chart_provider,
    // Per-coin jump alerts
    alert_enabled: !!c.alert_enabled,
    alert_up_pct:
      alert_up_pct !== null && Number.isFinite(alert_up_pct) && alert_up_pct > 0
        ? alert_up_pct
        : null,
    alert_down_pct:
      alert_down_pct !== null &&
      Number.isFinite(alert_down_pct) &&
      alert_down_pct > 0
        ? alert_down_pct
        : null,
  };
}

/**
 * @param {object[]} coins
 * @returns {object[]}
 */
export function normalizeCoins(coins) {
  if (!Array.isArray(coins)) return [];
  return coins.map((c, i) => normalizeCoin(c, i));
}

/**
 * Re-assign order 0..n-1 from array position.
 * @param {object[]} coins
 */
export function reindexOrders(coins) {
  for (let i = 0; i < coins.length; i++) coins[i].order = i;
  return coins;
}
