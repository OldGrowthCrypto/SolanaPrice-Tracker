import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import {
  defaultWatchlist,
  repairWatchlist,
  DEFAULT_MAX_PANEL_COINS,
} from './api/catalog.js';
import { normalizeCoin, normalizeCoins, reindexOrders } from './utils/coin.js';
import { setDebugLogging } from './utils/log.js';

const UUID = 'price-tracker@oldgrowthcrypto.com';
const SCHEMA = 'org.gnome.shell.extensions.oldgrowth-price-tracker';

function _getSettings() {
  const extensionObject = Extension.lookupByUUID(UUID);
  return extensionObject.getSettings(SCHEMA);
}

export let getSettings = function () {
  return _getSettings();
};

/** Sync debug flag from settings (call on enable / setting change) */
export let applyDebugLogging = function () {
  try {
    setDebugLogging(_getSettings().get_boolean('debug-logging'));
  } catch (_e) {
    setDebugLogging(false);
  }
};

export let getCoins = function () {
  const settings = _getSettings();
  const coinJsonStr = String(settings.get_string('coins'));
  try {
    const coinJson = JSON.parse(coinJsonStr);
    return normalizeCoins(coinJson.coins || []);
  } catch (_e) {
    return [];
  }
};

export let getSeeded = function () {
  try {
    return _getSettings().get_boolean('seeded');
  } catch (_e) {
    return false;
  }
};

export let setSeeded = function (v) {
  try {
    _getSettings().set_boolean('seeded', !!v);
  } catch (_e) {
    /* ignore */
  }
};

/**
 * First-run seed only. Never resurrects after user clears the list.
 * Migrates legacy schema defaults (non-empty without seeded) as already seeded.
 */
export let ensureSeeded = function () {
  const coins = getCoins();
  if (coins.length > 0) {
    if (!getSeeded()) setSeeded(true);
    // Only rewrite settings if order/id fields need migration
    const needsMigrate = coins.some(
      (c, i) => !c.id || typeof c.order !== 'number',
    );
    if (needsMigrate) {
      const withOrder = reindexOrders(coins.map((c, i) => normalizeCoin(c, i)));
      setCoins(withOrder);
      return withOrder;
    }
    return coins;
  }
  if (getSeeded()) return [];
  const seeded = defaultWatchlist();
  setCoins(seeded);
  setSeeded(true);
  return seeded;
};

/**
 * Light repair: icons only; preserves active flags.
 */
export let repairAndGetCoins = function () {
  const max = getMaxPanelCoins();
  const repaired = repairWatchlist(getCoins(), {
    preserveActive: true,
    maxPanel: max,
  });
  const normalized = reindexOrders(normalizeCoins(repaired));
  setCoins(normalized);
  if (!getSeeded()) setSeeded(true);
  return normalized;
};

export let addCoin = function (entry) {
  const settings = _getSettings();
  const coin = normalizeCoin(
    {
      id: entry.id,
      symbol: entry.symbol || entry.title || 'TOKEN',
      active: !!entry.active,
      title: entry.title || entry.symbol || 'TOKEN',
      coingecko_id: entry.coingecko_id || '',
      mint: entry.mint || '',
      icon: entry.icon || 'generic',
      icon_path: entry.icon_path || '',
      subtitle: entry.subtitle || '',
      key: entry.key || '',
      added_at: entry.added_at || Date.now(),
      order: 0,
    },
    0,
  );
  if (_checkIsDuplicate(coin)) return false;

  let originalCoinObj;
  try {
    originalCoinObj = JSON.parse(settings.get_string('coins'));
  } catch (_e) {
    originalCoinObj = { coins: [] };
  }
  if (!Array.isArray(originalCoinObj.coins)) originalCoinObj.coins = [];

  // Prepend so new tokens show first (user order)
  originalCoinObj.coins.unshift(coin);
  originalCoinObj.coins = reindexOrders(
    normalizeCoins(originalCoinObj.coins),
  );
  settings.set_string('coins', JSON.stringify(originalCoinObj));
  return true;
};

function _checkIsDuplicate(coin) {
  for (const _coin of getCoins()) {
    if (coin.mint && _coin.mint && coin.mint === _coin.mint) return true;
    if (
      coin.coingecko_id &&
      _coin.coingecko_id &&
      coin.coingecko_id === _coin.coingecko_id
    )
      return true;
    if (
      coin.symbol &&
      _coin.symbol &&
      coin.symbol.toUpperCase() === (_coin.symbol || '').toUpperCase() &&
      (coin.mint || '') === (_coin.mint || '') &&
      (coin.coingecko_id || '') === (_coin.coingecko_id || '')
    )
      return true;
  }
  return false;
}

export let delCoin = function (ref) {
  const settings = _getSettings();
  let coinJson;
  try {
    coinJson = JSON.parse(String(settings.get_string('coins')));
  } catch (_e) {
    coinJson = { coins: [] };
  }
  const coins = coinJson.coins || [];
  if (!coins.length) return false;

  const index = _findCoinIndex(coins, ref || {});
  if (index === -1) {
    console.warn(
      'OldGrowthPriceTracker: delCoin — not found',
      ref && (ref.id || ref.title || ref.symbol),
    );
    return false;
  }

  coins.splice(index, 1);
  coinJson.coins = reindexOrders(normalizeCoins(coins));
  settings.set_string('coins', JSON.stringify(coinJson));
  return true;
};

function _findCoinIndex(coins, ref) {
  let i = coins.findIndex(c => c.id && ref.id && c.id === ref.id);
  if (i !== -1) return i;
  if (ref.key) {
    i = coins.findIndex(c => c.key && c.key === ref.key);
    if (i !== -1) return i;
  }
  if (ref.mint) {
    i = coins.findIndex(c => c.mint && c.mint === ref.mint);
    if (i !== -1) return i;
  }
  if (ref.coingecko_id) {
    i = coins.findIndex(
      c => c.coingecko_id && c.coingecko_id === ref.coingecko_id,
    );
    if (i !== -1) return i;
  }
  if (ref.symbol) {
    i = coins.findIndex(
      c =>
        (c.symbol || '').toUpperCase() === (ref.symbol || '').toUpperCase(),
    );
    if (i !== -1) return i;
  }
  if (ref.title) {
    i = coins.findIndex(
      c => (c.title || '').toUpperCase() === (ref.title || '').toUpperCase(),
    );
    if (i !== -1) return i;
  }
  return -1;
}

export let updateCoin = function (coin) {
  const coins = getCoins();
  const i = _findCoinIndex(coins, coin);
  if (i === -1) {
    console.warn(
      'OldGrowthPriceTracker: updateCoin — coin not found',
      coin.id,
      coin.title,
    );
    return false;
  }
  const _coin = coins[i];
  if (coin.active !== undefined) _coin.active = !!coin.active;
  if (coin.title !== undefined) _coin.title = coin.title;
  if (coin.symbol !== undefined) _coin.symbol = coin.symbol;
  if (coin.coingecko_id !== undefined) _coin.coingecko_id = coin.coingecko_id;
  if (coin.mint !== undefined) _coin.mint = coin.mint;
  if (coin.swap_mint !== undefined) _coin.swap_mint = coin.swap_mint;
  if (coin.icon !== undefined) _coin.icon = coin.icon;
  if (coin.icon_path !== undefined) _coin.icon_path = coin.icon_path;
  if (coin.subtitle !== undefined) _coin.subtitle = coin.subtitle;
  if (coin.key !== undefined) _coin.key = coin.key;
  if (coin.order !== undefined) _coin.order = coin.order;
  if (coin.chart_provider !== undefined)
    _coin.chart_provider = coin.chart_provider || '';
  if (coin.alert_enabled !== undefined) _coin.alert_enabled = !!coin.alert_enabled;
  if (coin.alert_up_pct !== undefined) _coin.alert_up_pct = coin.alert_up_pct;
  if (coin.alert_down_pct !== undefined)
    _coin.alert_down_pct = coin.alert_down_pct;
  if (!_coin.id && coin.id) _coin.id = coin.id;
  setCoins(coins);
  return true;
};

export let getDefaultChartProvider = function () {
  try {
    const p = (_getSettings().get_string('default-chart-provider') || '')
      .toLowerCase()
      .trim();
    if (p === 'birdeye' || p === 'jupiter' || p === 'dexscreener') return p;
  } catch (_e) {
    /* ignore */
  }
  return 'dexscreener';
};

export let setDefaultChartProvider = function (p) {
  const v = String(p || 'dexscreener').toLowerCase();
  const ok =
    v === 'birdeye' || v === 'jupiter' || v === 'dexscreener'
      ? v
      : 'dexscreener';
  try {
    _getSettings().set_string('default-chart-provider', ok);
  } catch (_e) {
    /* ignore */
  }
};

export let setCoinActive = function (ref, active) {
  const coins = getCoins();
  const i = _findCoinIndex(coins, ref);
  if (i === -1) {
    console.warn(
      'OldGrowthPriceTracker: setCoinActive — not found',
      ref.id,
      ref.title,
    );
    return false;
  }
  coins[i].active = !!active;
  setCoins(coins);
  return true;
};

/**
 * Move coin up/down in list order.
 * @param {object} ref
 * @param {-1|1} delta
 */
export let moveCoin = function (ref, delta) {
  const coins = getCoins();
  const i = _findCoinIndex(coins, ref);
  if (i === -1) return false;
  const j = i + delta;
  if (j < 0 || j >= coins.length) return false;
  const tmp = coins[i];
  coins[i] = coins[j];
  coins[j] = tmp;
  setCoins(reindexOrders(coins));
  return true;
};

/**
 * Drag-drop reorder: place coinId at newIndex in the watchlist.
 * @param {string} coinId
 * @param {number} newIndex
 * @returns {boolean}
 */
export let reorderCoin = function (coinId, newIndex) {
  const coins = getCoins();
  const from = _findCoinIndex(coins, { id: coinId });
  if (from === -1) return false;
  const [item] = coins.splice(from, 1);
  let idx = Math.floor(Number(newIndex));
  if (!Number.isFinite(idx)) idx = coins.length;
  idx = Math.max(0, Math.min(idx, coins.length));
  coins.splice(idx, 0, item);
  setCoins(reindexOrders(coins));
  return true;
};

export let setCoins = function (coins) {
  const settings = _getSettings();
  let originalCoinObj;
  try {
    originalCoinObj = JSON.parse(settings.get_string('coins'));
  } catch (_e) {
    originalCoinObj = { coins: [] };
  }
  originalCoinObj.coins = reindexOrders(normalizeCoins(coins || []));
  settings.set_string('coins', JSON.stringify(originalCoinObj));
};

export let exportWatchlistJson = function () {
  return JSON.stringify({ coins: getCoins(), version: 1 }, null, 2);
};

/**
 * @param {string} jsonStr
 * @returns {{ok: boolean, count?: number, error?: string}}
 */
export let importWatchlistJson = function (jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    const list = Array.isArray(data) ? data : data.coins;
    if (!Array.isArray(list))
      return { ok: false, error: 'JSON must be { coins: [...] } or an array' };
    const normalized = reindexOrders(normalizeCoins(list));
    setCoins(normalized);
    setSeeded(true);
    return { ok: true, count: normalized.length };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
};

export let getVsCurrency = function () {
  return _getSettings().get_string('vs-currency') || 'usd';
};

export let getRefreshInterval = function () {
  const n = _getSettings().get_int('refresh-interval');
  return n >= 20 ? n : 30;
};

export let setRefreshInterval = function (n) {
  const v = Math.max(20, Math.min(300, Math.floor(Number(n) || 30)));
  try {
    _getSettings().set_int('refresh-interval', v);
  } catch (_e) {
    /* ignore */
  }
};

export let getMaxPanelCoins = function () {
  try {
    const n = _getSettings().get_int('max-panel-coins');
    if (n >= 1 && n <= 8) return n;
  } catch (_e) {
    /* ignore */
  }
  return DEFAULT_MAX_PANEL_COINS;
};

export let setMaxPanelCoins = function (n) {
  const v = Math.max(1, Math.min(8, Math.floor(Number(n) || 5)));
  _getSettings().set_int('max-panel-coins', v);
};

export let getShowIcons = function () {
  try {
    return _getSettings().get_boolean('show-icons');
  } catch (_e) {
    return true;
  }
};

export let setShowIcons = function (v) {
  _getSettings().set_boolean('show-icons', !!v);
};

export let getShowTickers = function () {
  try {
    return _getSettings().get_boolean('show-tickers');
  } catch (_e) {
    return true;
  }
};

export let setShowTickers = function (v) {
  _getSettings().set_boolean('show-tickers', !!v);
};

export let getColorizePrices = function () {
  try {
    return _getSettings().get_boolean('colorize-prices');
  } catch (_e) {
    return false;
  }
};

export let setColorizePrices = function (v) {
  _getSettings().set_boolean('colorize-prices', !!v);
};

export let getAutoCompact = function () {
  try {
    return _getSettings().get_boolean('auto-compact');
  } catch (_e) {
    return true;
  }
};

export let setAutoCompact = function (v) {
  _getSettings().set_boolean('auto-compact', !!v);
};

/** 0 = flash disabled */
export let getMoveFlashThreshold = function () {
  try {
    const n = _getSettings().get_double('move-flash-threshold');
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch (_e) {
    return 0;
  }
};

export let setMoveFlashThreshold = function (n) {
  _getSettings().set_double('move-flash-threshold', Math.max(0, Number(n) || 0));
};

export let getAlertsEnabled = function () {
  try {
    return _getSettings().get_boolean('alerts-enabled');
  } catch (_e) {
    return false;
  }
};

export let setAlertsEnabled = function (v) {
  _getSettings().set_boolean('alerts-enabled', !!v);
};

/** Jump % between consecutive price samples (quick pump/dump). */
export let getAlertThresholdPct = function () {
  try {
    const n = _getSettings().get_double('alert-threshold-pct');
    return Number.isFinite(n) && n > 0 ? n : 3;
  } catch (_e) {
    return 3;
  }
};

export let setAlertThresholdPct = function (n) {
  _getSettings().set_double(
    'alert-threshold-pct',
    Math.max(0.1, Number(n) || 3),
  );
};

export let getAlertUpEnabled = function () {
  try {
    return _getSettings().get_boolean('alert-up-enabled');
  } catch (_e) {
    return true;
  }
};

export let setAlertUpEnabled = function (v) {
  try {
    _getSettings().set_boolean('alert-up-enabled', !!v);
  } catch (_e) {
    /* ignore */
  }
};

export let getAlertDownEnabled = function () {
  try {
    return _getSettings().get_boolean('alert-down-enabled');
  } catch (_e) {
    return true;
  }
};

export let setAlertDownEnabled = function (v) {
  try {
    _getSettings().set_boolean('alert-down-enabled', !!v);
  } catch (_e) {
    /* ignore */
  }
};

export let getAlertCooldownSec = function () {
  try {
    const n = _getSettings().get_int('alert-cooldown-sec');
    return n >= 30 ? n : 120;
  } catch (_e) {
    return 120;
  }
};

export let setAlertCooldownSec = function (n) {
  try {
    _getSettings().set_int(
      'alert-cooldown-sec',
      Math.max(30, Math.min(3600, Math.floor(Number(n) || 120))),
    );
  } catch (_e) {
    /* ignore */
  }
};

/**
 * alert-state shape: { [coinId]: { price: number, lastNotify: number } }
 */
export let getAlertState = function () {
  try {
    return JSON.parse(_getSettings().get_string('alert-state') || '{}');
  } catch (_e) {
    return {};
  }
};

export let setAlertState = function (obj) {
  try {
    _getSettings().set_string('alert-state', JSON.stringify(obj || {}));
  } catch (_e) {
    /* ignore */
  }
};

export let getDebugLogging = function () {
  try {
    return _getSettings().get_boolean('debug-logging');
  } catch (_e) {
    return false;
  }
};

export let setDebugLoggingFlag = function (v) {
  _getSettings().set_boolean('debug-logging', !!v);
  setDebugLogging(!!v);
};

export let resetToDefaults = function () {
  setCoins(defaultWatchlist());
  setSeeded(true);
};
