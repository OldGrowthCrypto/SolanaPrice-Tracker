import Soup from 'gi://Soup';
import GLib from 'gi://GLib';

const _session = new Soup.Session({
  timeout: 20,
  user_agent: 'OldGrowthPriceTracker/1.0 (GNOME Shell; +https://oldgrowthcrypto.com)',
});

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
 * Binary-safe GET (for downloading token icons).
 * @param {string} url
 * @returns {Promise<{code: number, bytes: Uint8Array}>}
 */
export function getRaw(url) {
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

function get_soup_v3(url) {
  return get_soup_v3_raw(url).then(({ code, bytes }) => {
    const decoder = new TextDecoder('utf-8');
    return { code, body: decoder.decode(bytes) };
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
        const enc = typeof body === 'string' ? new TextEncoder().encode(body) : body;
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

function get_soup_v2(url) {
  return get_soup_v2_raw(url).then(({ code, bytes }) => {
    const decoder = new TextDecoder('utf-8');
    return { code, body: decoder.decode(bytes) };
  });
}
