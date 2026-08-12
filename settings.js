import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { defaultWatchlist, repairWatchlist } from './api/catalog.js';

const UUID = 'price-tracker@oldgrowthcrypto.com';
const SCHEMA = 'org.gnome.shell.extensions.oldgrowth-price-tracker';

function _getSettings() {
  const extensionObject = Extension.lookupByUUID(UUID);
  return extensionObject.getSettings(SCHEMA);
}

export let getSettings = function () {
  return _getSettings();
};

export let getCoins = function () {
  const settings = _getSettings();
  const coinJsonStr = String(settings.get_string('coins'));
  try {
    const coinJson = JSON.parse(coinJsonStr);
    return coinJson.coins || [];
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
 */
export let ensureSeeded = function () {
  const coins = getCoins();
  if (coins.length > 0) {
    if (!getSeeded()) setSeeded(true);
    return coins;
  }
  if (getSeeded()) return []; // user deleted everything — stay empty
  const seeded = defaultWatchlist();
  setCoins(seeded);
  setSeeded(true);
  return seeded;
};

/**
 * Light repair: icons only; preserves active flags.
 */
export let repairAndGetCoins = function () {
  const repaired = repairWatchlist(getCoins(), { preserveActive: true });
  setCoins(repaired);
  if (!getSeeded()) setSeeded(true);
  return repaired;
};

export let addCoin = function (entry) {
  const settings = _getSettings();
  const coin = {
    id: entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    symbol: (entry.symbol || entry.title || 'TOKEN').toUpperCase(),
    active: !!entry.active,
    title: (entry.title || entry.symbol || 'TOKEN').toString().toUpperCase(),
    coingecko_id: entry.coingecko_id || '',
    mint: entry.mint || '',
    icon: entry.icon || 'generic',
    icon_path: entry.icon_path || '',
    pinned: false,
    subtitle: entry.subtitle || '',
    key: entry.key || '',
    added_at: entry.added_at || Date.now(),
  };
  if (_checkIsDuplicate(coin)) return false;

  let originalCoinObj;
  try {
    originalCoinObj = JSON.parse(settings.get_string('coins'));
  } catch (_e) {
    originalCoinObj = { coins: [] };
  }
  if (!Array.isArray(originalCoinObj.coins)) originalCoinObj.coins = [];

  // Prepend so new tokens show at the top of the dropdown (easy to find + toggle)
  originalCoinObj.coins.unshift(coin);
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
    // Same symbol only counts as dup if neither has a distinct mint
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

/**
 * Remove a coin from the watchlist.
 * @param {{id?: string, key?: string, mint?: string, coingecko_id?: string, symbol?: string, title?: string}} ref
 * @returns {boolean} true if something was removed
 */
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
  coinJson.coins = coins;
  settings.set_string('coins', JSON.stringify(coinJson));
  return true;
};

/**
 * Find coin by id, then key, mint, coingecko_id, or symbol.
 */
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
  if (coin.icon !== undefined) _coin.icon = coin.icon;
  if (coin.icon_path !== undefined) _coin.icon_path = coin.icon_path;
  if (coin.subtitle !== undefined) _coin.subtitle = coin.subtitle;
  if (coin.key !== undefined) _coin.key = coin.key;
  if (!_coin.id && coin.id) _coin.id = coin.id;
  setCoins(coins);
  return true;
};

/** Fast path: only flip active flag for panel toggle */
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

export let setCoins = function (coins) {
  const settings = _getSettings();
  let originalCoinObj;
  try {
    originalCoinObj = JSON.parse(settings.get_string('coins'));
  } catch (_e) {
    originalCoinObj = { coins: [] };
  }
  originalCoinObj.coins = coins;
  settings.set_string('coins', JSON.stringify(originalCoinObj));
};

export let getVsCurrency = function () {
  return _getSettings().get_string('vs-currency') || 'usd';
};

export let getRefreshInterval = function () {
  const n = _getSettings().get_int('refresh-interval');
  return n >= 20 ? n : 30;
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

export let resetToDefaults = function () {
  setCoins(defaultWatchlist());
  setSeeded(true);
};
