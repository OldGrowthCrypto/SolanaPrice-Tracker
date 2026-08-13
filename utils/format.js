/**
 * Format a price for display.
 * @param {number} price
 * @returns {string}
 */
export function formatPrice(price) {
  if (price === null || price === undefined || Number.isNaN(price))
    return '—';

  let maximumFractionDigits = 0;
  let minimumFractionDigits = 0;

  if (price >= 1000) {
    maximumFractionDigits = 0;
    minimumFractionDigits = 0;
  } else if (price < 1000 && price >= 100) {
    maximumFractionDigits = 1;
    minimumFractionDigits = 1;
  } else if (price < 100 && price >= 10) {
    maximumFractionDigits = 2;
    minimumFractionDigits = 2;
  } else if (price < 10 && price >= 1) {
    maximumFractionDigits = 3;
    minimumFractionDigits = 2;
  } else if (price < 1 && price >= 0.1) {
    maximumFractionDigits = 4;
    minimumFractionDigits = 3;
  } else if (price < 0.1 && price >= 0.01) {
    maximumFractionDigits = 5;
    minimumFractionDigits = 4;
  } else if (price < 0.01 && price >= 0.0001) {
    maximumFractionDigits = 6;
    minimumFractionDigits = 5;
  } else if (price < 0.0001) {
    return price.toPrecision(3);
  }

  return price.toLocaleString('en-US', {
    maximumFractionDigits,
    minimumFractionDigits,
  });
}

/**
 * @param {number|null} change
 * @returns {{text: string, css: string, color: string}}
 */
export function formatChange(change) {
  if (change === null || change === undefined || Number.isNaN(change))
    return { text: '—', css: 'change-flat', color: '#ffffff' };

  const sign = change > 0 ? '+' : '';
  const text = `${sign}${change.toFixed(2)}%`;
  if (change > 0.005)
    return { text, css: 'change-up', color: '#14f195' };
  if (change < -0.005)
    return { text, css: 'change-down', color: '#ff6b7a' };
  return { text, css: 'change-flat', color: '#ffffff' };
}

export function formatPanelPrice(price) {
  const p = formatPrice(price);
  if (p === '—') return '…';
  return `$${p}`;
}

export function escapeMarkup(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Always-safe panel white — never black */
export const PRICE_COLOR_WHITE = '#ffffff';
export const PRICE_COLOR_UP = '#14f195';
export const PRICE_COLOR_DOWN = '#ff6b7a';
export const PRICE_COLOR_STALE = '#f0c674';

/**
 * Panel price color. Never returns black.
 * @param {number|null|undefined} change
 * @param {boolean} colorize when false, always white
 * @param {boolean} [stale]
 */
export function priceColor(change, colorize = false, stale = false) {
  if (stale) return PRICE_COLOR_STALE;
  if (!colorize) return PRICE_COLOR_WHITE;
  if (change === null || change === undefined || Number.isNaN(change))
    return PRICE_COLOR_WHITE;
  if (change > 0.005) return PRICE_COLOR_UP;
  if (change < -0.005) return PRICE_COLOR_DOWN;
  return PRICE_COLOR_WHITE;
}

/**
 * Structure key for panel chip set.
 * @param {Array<{id: string}>} active
 */
export function panelStructureKey(active) {
  return (active || []).map(c => c.id).join('|');
}

/**
 * Name white + price white (or green/red if colorize).
 */
export function formatPanelSegmentMarkup(
  title,
  price,
  change24h,
  colorize = false,
) {
  const name = escapeMarkup(title);
  const nameSpan = `<span foreground="#ffffff" font_weight="700">${name}</span>`;
  if (price === null || price === undefined || Number.isNaN(price))
    return `${nameSpan} <span foreground="#ffffff">…</span>`;

  const color = priceColor(change24h, colorize);
  const p = escapeMarkup(formatPanelPrice(price));
  return `${nameSpan} <span foreground="${color}" font_weight="700">${p}</span>`;
}
