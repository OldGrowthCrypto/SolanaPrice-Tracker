import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Gio from 'gi://Gio';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import { KNOWN_COINS } from '../api/coingecko.js';

let coingecko_data = null;

let _get_coingecko_data = async Me => {
  if (coingecko_data) return coingecko_data;

  const file = Gio.File.new_for_path(`${Me.path}/assets/coingecko.json`);
  const [, contents] = await new Promise((resolve, reject) => {
    file.load_contents_async(null, (_file, result) => {
      try {
        resolve(file.load_contents_finish(result));
      } catch (e) {
        reject(e);
      }
    });
  });

  let contentsString = '';
  if (+Config.PACKAGE_VERSION >= 41) {
    const decoder = new TextDecoder('utf-8');
    contentsString = decoder.decode(contents);
  }

  coingecko_data = JSON.parse(contentsString);
  return coingecko_data;
};

/**
 * Resolve CoinGecko id from a symbol like SOL or solana.
 */
export let coingecko_symbol_to_id = async (symbol, Me) => {
  const key = symbol.toLowerCase().trim();
  if (KNOWN_COINS[key]) return KNOWN_COINS[key].id;

  try {
    const data = await _get_coingecko_data(Me);
    for (const item of data) {
      if (item.symbol?.toLowerCase() === key) return item.id;
      if (item.id?.toLowerCase() === key) return item.id;
    }
  } catch (error) {
    console.error('OldGrowthPriceTracker: coingecko lookup failed', error);
  }
  return '';
};

export let getHeight = vboxHeight => {
  const ratio = 0.45;
  const monitor = global.display.get_primary_monitor();
  const workAreaHeight =
    Main.layoutManager.getWorkAreaForMonitor(monitor).height;
  const maxHeight = ratio * workAreaHeight;
  return Math.min(vboxHeight, maxHeight);
};

export let createUUID = () => {
  let dt = new Date().getTime();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (dt + Math.random() * 16) % 16 | 0;
    dt = Math.floor(dt / 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

export let destroy = () => {
  coingecko_data = null;
};
