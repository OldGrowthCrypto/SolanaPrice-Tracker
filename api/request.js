import Soup from 'gi://Soup';
import GLib from 'gi://GLib';

import { logDebug, logWarn } from '../utils/log.js';

const _session = new Soup.Session({
  timeout: 20,
  user_agent:
    'OldGrowthPriceTracker/1.0 (GNOME Shell; +https://oldgrowthcrypto.com)',
});

const DEFAULT_RETRIES = 2;
const BASE_DELAY_MS = 800;

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
      resolve();
      return GLib.SOURCE_REMOVE;
    });
  });
}

/**
 * @param {Error|string} err
 * @returns {number} HTTP status or 0
 */
function httpStatusFromError(err) {
  const msg = String(err && err.message ? err.message : err);
  const m = msg.match(/HTTP\s+(\d{3})/i);
  return m ? Number(m[1]) : 0;
}

/**
 * @param {number} code
 * @returns {boolean}
 */
function isRetryable(code) {
  if (code === 429) return true;
  if (code >= 500 && code < 600) return true;
  // 0 = network / parse / unknown — retry once path
  if (code === 0) return true;
  return false;
}

/**
 * @param {string} url
 * @returns {Promise<{code: number, body: string}>}
 */
export function get(url) {
  return getRaw(url).then(({ code, bytes }) => {
    const decoder = new TextDecoder('utf-8');
    const body = decoder.decode(bytes);
    return { code, body };
  });
}

/**
 * Binary-safe GET with retry + exponential backoff on 429 / 5xx.
 * @param {string} url
 * @param {{retries?: number, baseDelayMs?: number}} [opts]
 * @returns {Promise<{code: number, bytes: Uint8Array}>}
 */
export async function getRaw(url, opts = {}) {
  const maxRetries =
    opts.retries !== undefined ? opts.retries : DEFAULT_RETRIES;
  const baseDelay =
    opts.baseDelayMs !== undefined ? opts.baseDelayMs : BASE_DELAY_MS;

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await _getRawOnce(url);
      if (attempt > 0)
        logDebug(`GET ok after ${attempt} retr(y/ies): ${url.slice(0, 80)}`);
      return result;
    } catch (e) {
      lastError = e;
      const code = httpStatusFromError(e);
      const retryable = isRetryable(code);
      if (!retryable || attempt >= maxRetries) {
        logWarn(
          `GET failed (${code || 'net'}) attempt ${attempt + 1}/${maxRetries + 1}:`,
          String(e.message || e).slice(0, 120),
        );
        throw e;
      }
      const delay = baseDelay * Math.pow(2, attempt);
      logDebug(
        `GET retry ${attempt + 1}/${maxRetries} in ${delay}ms (HTTP ${code}): ${url.slice(0, 80)}`,
      );
      await sleep(delay);
    }
  }
  throw lastError;
}

function _getRawOnce(url) {
  switch (Soup.MAJOR_VERSION) {
    case 2:
      return get_soup_v2_raw(url);
    case 3:
      return get_soup_v3_raw(url);
    default:
      return Promise.reject(
        new Error(`Unsupported Soup version: ${Soup.MAJOR_VERSION}`),
      );
  }
}

function get_soup_v3_raw(url) {
  return new Promise((resolve, reject) => {
    const message = Soup.Message.new('GET', url);
    if (!message) {
      reject(new Error(`Invalid URL: ${url}`));
      return;
    }

    _session.send_and_read_async(
      message,
      GLib.PRIORITY_DEFAULT,
      null,
      (session, result) => {
        try {
          const statusCode = message.status_code;
          const gbytes = session.send_and_read_finish(result);
          const data = gbytes.get_data();
          const bytes =
            data instanceof Uint8Array ? data : new Uint8Array(data || []);

          if (statusCode < 200 || statusCode >= 300) {
            const decoder = new TextDecoder('utf-8');
            const body = decoder.decode(bytes);
            reject(new Error(`HTTP ${statusCode}: ${body.slice(0, 200)}`));
            return;
          }

          resolve({ code: statusCode, bytes });
        } catch (e) {
          reject(e);
        }
      },
    );
  });
}

function get_soup_v2_raw(url) {
  return new Promise((resolve, reject) => {
    const session = new Soup.SessionAsync();
    Soup.Session.prototype.add_feature.call(
      session,
      new Soup.ProxyResolverDefault(),
    );

    const message = Soup.Message.new('GET', url);
    if (!message) {
      reject(new Error(`Invalid URL: ${url}`));
      return;
    }

    session.queue_message(message, (_httpSession, msg) => {
      try {
        const statusCode = msg.status_code;
        const body = msg.response_body?.data ?? '';
        if (statusCode < 200 || statusCode >= 300) {
          reject(
            new Error(`HTTP ${statusCode}: ${String(body).slice(0, 200)}`),
          );
          return;
        }
        const enc =
          typeof body === 'string' ? new TextEncoder().encode(body) : body;
        resolve({
          code: statusCode,
          bytes: enc instanceof Uint8Array ? enc : new Uint8Array(enc || []),
        });
      } catch (e) {
        reject(e);
      }
    });
  });
}
