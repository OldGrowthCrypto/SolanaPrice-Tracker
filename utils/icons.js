import Gio from 'gi://Gio';
import St from 'gi://St';
import GLib from 'gi://GLib';

import { getRaw } from '../api/request.js';

/** Bundled icons only used for known keys without a custom Solana mint icon */
const ICON_STEMS = new Set([
  'btc',
  'sol',
  'jup',
  'pump',
  'render',
  'pengu',
  'trump',
  'pyth',
  'jto',
  'bonk',
  'wif',
  'ada',
  'avax',
  'sui',
  'generic',
  'brand',
]);

/** Exact mint → bundled stem (only these mints may use catalog art) */
const MINT_TO_STEM = {
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: 'bonk',
  jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL: 'jto',
  pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn: 'pump',
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: 'jup',
  So11111111111111111111111111111111111111112: 'sol',
  EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm: 'wif',
  HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3: 'pyth',
  rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof: 'render',
  '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv': 'pengu',
  '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN': 'trump',
};

/**
 * Resolve bundled icon stem.
 * IMPORTANT: if coin has a Solana mint that is NOT in MINT_TO_STEM, never map
 * by ticker name (e.g. title "ADA" must NOT load Cardano art).
 *
 * @param {{icon?: string, icon_path?: string, title?: string, coingecko_id?: string, symbol?: string, key?: string, mint?: string}} coin
 */
export function resolveIconStem(coin) {
  const mint = (coin.mint || '').trim();

  // 1) Exact mint match for catalog Solana tokens
  if (mint && MINT_TO_STEM[mint]) return MINT_TO_STEM[mint];

  // 2) Custom path handled elsewhere — stem unused
  if (coin.icon_path) return 'generic';

  // 3) Explicit catalog key (btc, sol, …) without a foreign mint
  if (!mint && coin.key && ICON_STEMS.has(coin.key)) return coin.key;

  // 4) Explicit icon field only if no foreign mint
  if (
    !mint &&
    coin.icon &&
    coin.icon !== 'generic' &&
    ICON_STEMS.has(coin.icon)
  )
    return coin.icon;

  // 5) Coingecko id mapping only when there is NO Solana mint
  //    (mint tokens must use mint-specific icon_path, not L1 ticker art)
  if (!mint) {
    const id = (coin.coingecko_id || '').toLowerCase();
    if (id === 'bitcoin' || id.includes('bitcoin')) return 'btc';
    if (id.includes('solana') || id === 'sol') return 'sol';
    if (id.includes('jupiter')) return 'jup';
    if (id.includes('pump')) return 'pump';
    if (id.includes('render')) return 'render';
    if (id.includes('pudgy') || id.includes('pengu')) return 'pengu';
    if (id.includes('trump')) return 'trump';
    if (id.includes('pyth')) return 'pyth';
    if (id.includes('jito')) return 'jto';
    if (id.includes('bonk')) return 'bonk';
    if (id.includes('dogwif') || id === 'dogwifcoin') return 'wif';
    if (id.includes('cardano')) return 'ada';
    if (id.includes('avalanche')) return 'avax';
    if (id === 'sui' || id.includes('sui-')) return 'sui';

    const title = (coin.title || '').toLowerCase();
    if (ICON_STEMS.has(title)) return title;

    const base = (coin.symbol || '').split('/')[0].toLowerCase();
    if (ICON_STEMS.has(base)) return base;
  }

  // Solana CA with no downloaded icon → generic (never Cardano ADA etc.)
  return 'generic';
}

export function iconPath(extensionPath, stem) {
  const file = GLib.build_filenamev([
    extensionPath,
    'assets',
    'icons',
    `${stem}.png`,
  ]);
  if (GLib.file_test(file, GLib.FileTest.EXISTS)) return file;
  return GLib.build_filenamev([
    extensionPath,
    'assets',
    'icons',
    'generic.png',
  ]);
}

function _customIconDir(extensionPath) {
  const dir = GLib.build_filenamev([
    extensionPath,
    'assets',
    'icons',
    'custom',
  ]);
  GLib.mkdir_with_parents(dir, 0o755);
  return dir;
}

/**
 * Look for an already-downloaded icon for this mint (any extension).
 */
export function findCachedMintIcon(extensionPath, mint) {
  if (!mint) return '';
  const dir = _customIconDir(extensionPath);
  const safe = mint.replace(/[^1-9A-HJ-NP-Za-km-z]/g, '').slice(0, 44);
  for (const ext of ['png', 'jpg', 'webp', 'jpeg']) {
    const p = GLib.build_filenamev([dir, `mint-${safe}.${ext}`]);
    if (GLib.file_test(p, GLib.FileTest.EXISTS)) return p;
  }
  return '';
}

/**
 * Resolve absolute path for a coin icon (custom file or bundled stem).
 */
export function resolveIconFilePath(extensionPath, coin) {
  // 1) Explicit custom path
  const custom = (coin.icon_path || '').trim();
  if (custom) {
    let path = custom;
    if (path.startsWith('file://')) path = path.slice(7);
    if (GLib.file_test(path, GLib.FileTest.EXISTS)) return path;
  }

  // 2) Cache by mint CA (mint-specific art — never ticker-based)
  const mint = (coin.mint || '').trim();
  if (mint) {
    const cached = findCachedMintIcon(extensionPath, mint);
    if (cached) return cached;
  }

  // 3) Bundled stem (safe mapping only)
  const stem = resolveIconStem(coin);
  return iconPath(extensionPath, stem);
}

export function createCoinIcon(extensionPath, stem, size = 22) {
  const path = iconPath(extensionPath, stem);
  const gicon = Gio.FileIcon.new(Gio.File.new_for_path(path));
  return new St.Icon({
    gicon,
    icon_size: size,
    style_class: 'coin-icon',
  });
}

export function createCoinIconFromCoin(extensionPath, coin, size = 22) {
  const path = resolveIconFilePath(extensionPath, coin);
  const gicon = Gio.FileIcon.new(Gio.File.new_for_path(path));
  return new St.Icon({
    gicon,
    icon_size: size,
    style_class: 'coin-icon',
  });
}

export function installCustomIcon(extensionPath, sourcePath, coinId) {
  try {
    let src = (sourcePath || '').trim();
    if (src.startsWith('file://')) src = src.slice(7);
    if (!src || !GLib.file_test(src, GLib.FileTest.EXISTS)) return '';

    const dir = _customIconDir(extensionPath);
    const ext =
      src.toLowerCase().endsWith('.jpg') || src.toLowerCase().endsWith('.jpeg')
        ? 'jpg'
        : src.toLowerCase().endsWith('.webp')
          ? 'webp'
          : 'png';
    const dest = GLib.build_filenamev([dir, `${coinId}.${ext}`]);
    const srcFile = Gio.File.new_for_path(src);
    const destFile = Gio.File.new_for_path(dest);
    srcFile.copy(destFile, Gio.FileCopyFlags.OVERWRITE, null, null);
    return dest;
  } catch (e) {
    console.error('OldGrowthPriceTracker: installCustomIcon failed', e);
    return '';
  }
}

function _writeIconBytes(extensionPath, coinId, mint, bytes) {
  if (!bytes || bytes.length < 32) return '';

  const dir = _customIconDir(extensionPath);
  let ext = 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) ext = 'jpg';
  else if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  )
    ext = 'webp';
  else if (bytes[0] === 0x3c || (bytes[0] === 0xef && bytes[1] === 0xbb))
    return ''; // skip svg/html

  const names = [];
  if (mint) {
    const safe = mint.replace(/[^1-9A-HJ-NP-Za-km-z]/g, '').slice(0, 44);
    names.push(`mint-${safe}.${ext}`);
  }
  names.push(`${coinId}.${ext}`);

  let first = '';
  for (const name of names) {
    const dest = GLib.build_filenamev([dir, name]);
    try {
      const file = Gio.File.new_for_path(dest);
      const stream = file.replace(
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null,
      );
      stream.write_bytes(GLib.Bytes.new(bytes), null);
      stream.close(null);
      if (!first) first = dest;
    } catch (e) {
      console.error('OldGrowthPriceTracker: write icon failed', dest, e);
    }
  }
  return first;
}

/**
 * Download a remote token icon URL and store it.
 */
export async function fetchAndInstallIcon(
  extensionPath,
  imageUrl,
  coinId,
  mint = '',
) {
  if (!imageUrl) return '';
  try {
    const { bytes } = await getRaw(imageUrl);
    return _writeIconBytes(extensionPath, coinId, mint, bytes);
  } catch (e) {
    console.error('OldGrowthPriceTracker: fetchAndInstallIcon failed', e);
    return '';
  }
}

/**
 * Fetch the icon that belongs to this Solana mint (CA), trying several CDNs.
 * Never uses ticker-name fallbacks like Cardano for "ADA".
 *
 * @param {string} extensionPath
 * @param {string} mint
 * @param {string} coinId
 * @param {string} [preferredUrl] from DexScreener lookup
 * @returns {Promise<string>} local path or ''
 */
export async function fetchIconForMint(
  extensionPath,
  mint,
  coinId,
  preferredUrl = '',
) {
  if (!mint) return '';

  // Already cached for this CA?
  const cached = findCachedMintIcon(extensionPath, mint);
  if (cached) return cached;

  const urls = [];
  if (preferredUrl) urls.push(preferredUrl);
  // DexScreener mint-keyed art (always CA-specific)
  urls.push(`https://dd.dexscreener.com/ds-data/tokens/solana/${mint}.png`);
  urls.push(
    `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${mint}/logo.png`,
  );

  for (const url of urls) {
    try {
      const path = await fetchAndInstallIcon(
        extensionPath,
        url,
        coinId,
        mint,
      );
      if (path) return path;
    } catch (_e) {
      /* try next */
    }
  }
  return '';
}
