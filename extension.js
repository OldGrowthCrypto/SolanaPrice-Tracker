/* extension.js — Solana Crypto Price Tracker (Old Growth)
 *
 * Forked from Crypto Price Tracker.
 * SPDX-License-Identifier: MIT
 */

import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';

import { Extension as Ex } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Settings from './settings.js';
import * as CryptoUtil from './utils/cryptoUtil.js';
import {
  createCoinIcon,
  createCoinIconFromCoin,
  resolveIconStem,
} from './utils/icons.js';
import {
  formatPanelPrice,
  priceColor,
  panelStructureKey,
} from './utils/format.js';
import { fetchQuotesForCoins, isQuoteStale, STALE_MS } from './api/prices.js';
import { CoinMenuItem } from './models/coinMenuItem.js';
import { buildActionBar } from './models/optionsMenu.js';
import { logInfo } from './utils/log.js';

const APP_VERSION = '2.0';

const Indicator = GObject.registerClass(
  class Indicator extends PanelMenu.Button {
    constructor(extension) {
      super(0.0, `${extension.metadata.name} Indicator`, false);
      this._extension = extension;
      this.coins = [];
      this._refreshSource = 0;
      this._statusTickSource = 0;
      this._refreshing = false;
      this._busy = false;
      this._lastError = null;
      this._lastOkAt = 0;
      this._lastOkHadQuotes = false;
      this._panelChips = new Map();
      this._panelStructureKey = '';
      this._settings = Settings.getSettings();
      this._settingsSignals = [];
      this._flashSources = new Map();
      this._dragSource = null;
      this._dragStageId = 0;
      this._dragDropIndex = -1;

      Settings.applyDebugLogging();

      this._panelBox = new St.BoxLayout({
        style_class: 'og-panel-box',
        vertical: false,
        y_align: Clutter.ActorAlign.CENTER,
        x_expand: false,
        x_align: Clutter.ActorAlign.START,
      });
      this.add_child(this._panelBox);
      this._renderPanelPlaceholder();

      // Dashboard: header → section → coins → status → compact action bar
      this._buildHeader();
      this._buildDashboardSection();
      this._buildCoinList();
      this._buildStatus();
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      this.menu.addMenuItem(buildActionBar(this, extension));

      for (const key of [
        'show-icons',
        'show-tickers',
        'colorize-prices',
        'auto-compact',
        'refresh-interval',
        'max-panel-coins',
        'move-flash-threshold',
        'alerts-enabled',
        'alert-threshold-pct',
        'alert-up-enabled',
        'alert-down-enabled',
        'alert-cooldown-sec',
        'debug-logging',
      ]) {
        this._settingsSignals.push(
          this._settings.connect(`changed::${key}`, () => {
            if (key === 'refresh-interval') this._startRefreshLoop();
            else if (key === 'debug-logging') Settings.applyDebugLogging();
            else if (
              key === 'alerts-enabled' ||
              key === 'alert-threshold-pct' ||
              key === 'alert-up-enabled' ||
              key === 'alert-down-enabled'
            )
              this._refreshStatusText();
            else this._updatePanelLabel(true);
          }),
        );
      }

      this.rebuildCoins();
      this._startRefreshLoop();
      this._startStatusTicker();
    }

    get busy() {
      return this._busy;
    }

    setBusy(v) {
      this._busy = !!v;
      for (const c of this.coins) {
        if (c.setActionsEnabled) c.setActionsEnabled(!this._busy);
      }
    }

    _maxPanel() {
      return Settings.getMaxPanelCoins();
    }

    _renderPanelPlaceholder() {
      this._panelBox.destroy_all_children();
      this._panelChips.clear();
      this._panelStructureKey = '';
      this._panelBox.add_child(
        new St.Label({
          text: 'Loading…',
          y_align: Clutter.ActorAlign.CENTER,
          style_class: 'og-panel-text og-panel-placeholder',
        }),
      );
    }

    _buildHeader() {
      const headerItem = new PopupMenu.PopupBaseMenuItem({
        reactive: false,
        can_focus: false,
        style_class: 'og-header-item',
      });

      const titleRow = new St.BoxLayout({
        vertical: false,
        x_expand: true,
        y_expand: false,
        style_class: 'og-header-title-row',
      });

      // Brand mark (square corners)
      const logo = createCoinIcon(this._extension.path, 'brand', 64);
      logo.style_class = 'coin-icon og-brand-icon';
      logo.y_align = Clutter.ActorAlign.CENTER;
      logo.x_align = Clutter.ActorAlign.CENTER;
      const logoWrap = new St.Bin({
        child: logo,
        style_class: 'og-brand-icon-wrap',
        y_align: Clutter.ActorAlign.CENTER,
        x_align: Clutter.ActorAlign.CENTER,
      });
      titleRow.add_child(logoWrap);

      const titles = new St.BoxLayout({
        vertical: true,
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
        style_class: 'og-header-titles',
      });

      const titleLbl = new St.Label({
        text: 'Solana Crypto Price Tracker',
        style_class: 'og-header-title',
      });
      titles.add_child(titleLbl);

      const subLbl = new St.Label({
        text: 'Tracking your favorite Solana tokens',
        style_class: 'og-header-subtitle',
      });
      titles.add_child(subLbl);
      titleRow.add_child(titles);

      const refreshIcon = new St.Icon({
        icon_name: 'view-refresh-symbolic',
        icon_size: 16,
        style_class: 'popup-menu-icon',
      });
      const refreshBtn = new St.Button({
        child: refreshIcon,
        style_class: 'og-icon-btn og-refresh-btn',
        y_align: Clutter.ActorAlign.CENTER,
      });
      refreshBtn.connect('clicked', () => this.refreshPrices(true));
      titleRow.add_child(refreshBtn);

      headerItem.add_child(titleRow);
      this.menu.addMenuItem(headerItem);
    }

    _buildDashboardSection() {
      const sectionItem = new PopupMenu.PopupBaseMenuItem({
        reactive: false,
        can_focus: false,
        style_class: 'og-section-item',
      });
      const col = new St.BoxLayout({
        vertical: true,
        x_expand: true,
        style_class: 'og-section-col',
      });
      col.add_child(
        new St.Label({
          text: 'WATCHLIST',
          style_class: 'og-section-label',
        }),
      );
      col.add_child(
        new St.Label({
          text: 'Drag ☰ or ↑↓ to reorder · switch = top bar',
          style_class: 'og-section-hint',
        }),
      );
      sectionItem.add_child(col);
      this.menu.addMenuItem(sectionItem);
    }

    _buildCoinList() {
      this.coinSection = new PopupMenu.PopupMenuSection();
      this.menu.addMenuItem(this.coinSection);

      this.coinsScrollViewVbox = new St.BoxLayout({
        vertical: true,
        x_expand: true,
        style_class: 'og-coins-list',
      });

      const baseMenuItem = new PopupMenu.PopupBaseMenuItem({
        hover: false,
        can_focus: false,
        activate: false,
        reactive: false,
        style_class: 'og-coins-base',
      });
      this.coinSection.addMenuItem(baseMenuItem);

      this._coinsScrollview = new St.ScrollView({
        enable_mouse_scrolling: true,
        style_class: 'og-coins-scroll',
        overlay_scrollbars: true,
      });
      this._coinsScrollview.set_policy(
        St.PolicyType.NEVER,
        St.PolicyType.AUTOMATIC,
      );
      this._coinsScrollview.add_child(this.coinsScrollViewVbox);
      baseMenuItem.add_child(this._coinsScrollview);
    }

    _buildStatus() {
      this._statusRow = new St.Label({
        text: 'Fetching prices…',
        style_class: 'og-status-row',
        x_expand: true,
      });
      const statusItem = new PopupMenu.PopupBaseMenuItem({
        reactive: false,
        can_focus: false,
        style_class: 'og-status-item',
      });
      statusItem.add_child(this._statusRow);
      this.menu.addMenuItem(statusItem);
    }

    _nowSec() {
      return GLib.get_real_time() / 1000000;
    }

    _formatAgo(secondsAgo) {
      const s = Math.max(0, Math.floor(secondsAgo));
      if (s < 5) return 'just now';
      if (s < 60) return `${s}s ago`;
      const m = Math.floor(s / 60);
      if (m < 60) return `${m}m ago`;
      const h = Math.floor(m / 60);
      return `${h}h ago`;
    }

    _refreshStatusText() {
      if (!this._statusRow) return;
      const maxP = this._maxPanel();
      if (this._refreshing) {
        this._statusRow.text = 'Refreshing…';
        this._statusRow.remove_style_class_name('og-status-stale');
        this._statusRow.remove_style_class_name('og-status-error');
        return;
      }
      if (this._lastError) {
        const msg = String(this._lastError.message || this._lastError).slice(
          0,
          48,
        );
        const ago = this._lastOkAt
          ? ` · last good ${this._formatAgo(this._nowSec() - this._lastOkAt)}`
          : '';
        this._statusRow.text = `Offline — ${msg}${ago}`;
        this._statusRow.add_style_class_name('og-status-error');
        this._statusRow.remove_style_class_name('og-status-stale');
        return;
      }
      if (!this._lastOkAt) {
        this._statusRow.text = 'Waiting for prices…';
        this._statusRow.remove_style_class_name('og-status-stale');
        this._statusRow.remove_style_class_name('og-status-error');
        return;
      }
      const ago = this._formatAgo(this._nowSec() - this._lastOkAt);
      const onBar = this.coins.filter(c => c.activeCoin).length;
      const total = this.coins.length;
      const stale = this._nowSec() - this._lastOkAt > STALE_MS / 1000;
      const alertsOn = Settings.getAlertsEnabled();
      const jump = Settings.getAlertThresholdPct();
      const alertBit = alertsOn ? `alerts ±${jump}%` : 'alerts off';
      this._statusRow.text = stale
        ? `Updated ${ago} · STALE · ${total} coins · bar ${onBar}/${maxP} · ${alertBit}`
        : `Updated ${ago} · ${total} coins · bar ${onBar}/${maxP} · ${alertBit}`;
      if (stale) this._statusRow.add_style_class_name('og-status-stale');
      else this._statusRow.remove_style_class_name('og-status-stale');
      this._statusRow.remove_style_class_name('og-status-error');
    }

    _startStatusTicker() {
      this._stopStatusTicker();
      this._statusTickSource = GLib.timeout_add_seconds(
        GLib.PRIORITY_DEFAULT,
        5,
        () => {
          this._refreshStatusText();
          // Re-tint panel if quotes aged into stale
          this._updatePanelPricesOnly(this._activeSorted());
          return GLib.SOURCE_CONTINUE;
        },
      );
    }

    _stopStatusTicker() {
      if (this._statusTickSource) {
        GLib.source_remove(this._statusTickSource);
        this._statusTickSource = 0;
      }
    }

    rebuildCoins() {
      this.setBusy(true);
      const quoteCache = new Map();
      for (const c of this.coins) {
        const q = c.getQuote && c.getQuote();
        if (q && q.price != null) quoteCache.set(c.id, q);
        try {
          c.destroy();
        } catch (_e) {
          /* ignore */
        }
      }
      this.coins = [];
      this.coinsScrollViewVbox.destroy_all_children();

      let stored = Settings.ensureSeeded
        ? Settings.ensureSeeded()
        : Settings.getCoins();

      // Pure user order (drag/↑↓) — dashboard list matches panel priority
      const sorted = [...stored].sort((a, b) => {
        const ao = typeof a.order === 'number' ? a.order : 0;
        const bo = typeof b.order === 'number' ? b.order : 0;
        if (ao !== bo) return ao - bo;
        return (a.added_at || 0) - (b.added_at || 0);
      });

      for (const coin of sorted) {
        if (!coin.id) coin.id = CryptoUtil.createUUID();
        coin.active = !!coin.active;
        coin.pinned = false;
        if (coin.mint) {
          if (!coin.icon_path) coin.icon = 'generic';
        } else if (!coin.icon_path) {
          coin.icon = resolveIconStem(coin);
        }
        const row = new CoinMenuItem(
          coin,
          this,
          this._extension.path,
          this._extension,
        );
        const cached = quoteCache.get(coin.id);
        if (cached) row.applyQuote(cached);
        this.coins.push(row);
        this.coinsScrollViewVbox.add_child(row);
      }

      this._fitCoinListHeight(sorted.length);
      this._updatePanelLabel(true);
      this.setBusy(false);
      this.refreshPrices(true);
    }

    /**
     * Size coin list tightly to real content — no empty gap under last coin.
     * ≤5 coins: exact content height, no scrollbar.
     * >5 coins: viewport for 5 rows + scroll.
     * @param {number} count
     */
    _fitCoinListHeight(count) {
      const VISIBLE = 5;
      // Conservative first estimate (compact rows ~36–40px)
      const ROW_H = 40;
      const SPACING = 4;
      const PAD = 4;

      const rowsForHeight = n => {
        if (n <= 0) return ROW_H + PAD;
        return n * ROW_H + Math.max(0, n - 1) * SPACING + PAD;
      };

      const n = Math.max(count, 0);
      const estimate =
        n <= VISIBLE ? rowsForHeight(Math.max(n, 1)) : rowsForHeight(VISIBLE);

      try {
        this._coinsScrollview.set_policy(
          St.PolicyType.NEVER,
          n <= VISIBLE ? St.PolicyType.NEVER : St.PolicyType.AUTOMATIC,
        );
      } catch (_e) {
        /* ignore */
      }

      this._coinsScrollview.set_height(estimate);

      // Measure after layout (twice — preferred height is reliable after allocate)
      const measure = () => {
        try {
          this._measureAndFitCoinList(n, VISIBLE);
        } catch (_e) {
          /* ignore */
        }
      };
      GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
        measure();
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
          measure();
          return GLib.SOURCE_REMOVE;
        });
        return GLib.SOURCE_REMOVE;
      });
    }

    /**
     * Snap scrollview height to actual list content (kills empty bottom gap).
     * @param {number} count
     * @param {number} visibleMax
     */
    _measureAndFitCoinList(count, visibleMax) {
      if (!this._coinsScrollview || !this.coinsScrollViewVbox) return;

      // Prefer natural height of the whole list box (includes spacing + padding)
      let contentH = 0;
      try {
        const w =
          this._coinsScrollview.width > 0
            ? this._coinsScrollview.width
            : -1;
        const [, nat] = this.coinsScrollViewVbox.get_preferred_height(w);
        if (nat > 0) contentH = nat;
      } catch (_e) {
        /* fall through */
      }

      // Fallback: sum children
      if (contentH < 8 && this.coins?.length) {
        const spacing = 4;
        let total = 4;
        for (let i = 0; i < this.coins.length; i++) {
          try {
            const row = this.coins[i];
            let h = row.height > 0 ? row.height : 0;
            if (h < 8) {
              const [, nat] = row.get_preferred_height(-1);
              h = nat || 38;
            }
            total += h;
            if (i > 0) total += spacing;
          } catch (_e) {
            total += 38;
          }
        }
        contentH = total;
      }

      if (contentH < 8) return;

      if (count <= visibleMax) {
        // Exact fit — no phantom empty row under the list
        this._coinsScrollview.set_height(Math.ceil(contentH));
        try {
          this._coinsScrollview.set_policy(
            St.PolicyType.NEVER,
            St.PolicyType.NEVER,
          );
        } catch (_e) {
          /* ignore */
        }
      } else {
        // Cap at ~5 rows worth of measured content
        const ratio = visibleMax / Math.max(count, 1);
        const view = Math.ceil(contentH * ratio);
        // Better: measure first visibleMax children only
        let viewH = 4;
        const spacing = 4;
        for (let i = 0; i < visibleMax && i < this.coins.length; i++) {
          try {
            const row = this.coins[i];
            let h = row.height > 0 ? row.height : 0;
            if (h < 8) {
              const [, nat] = row.get_preferred_height(-1);
              h = nat || 38;
            }
            viewH += h;
            if (i > 0) viewH += spacing;
          } catch (_e) {
            viewH += 38;
          }
        }
        this._coinsScrollview.set_height(Math.max(viewH, view));
        try {
          this._coinsScrollview.set_policy(
            St.PolicyType.NEVER,
            St.PolicyType.AUTOMATIC,
          );
        } catch (_e) {
          /* ignore */
        }
      }
    }

    onCoinAdded(coinTitle) {
      this.rebuildCoins();
      this._refreshStatusText();
      if (this._statusRow)
        this._statusRow.text = `Added ${coinTitle} — toggle switch for top bar`;
      GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
        try {
          this.menu.open();
        } catch (_e) {
          /* ignore */
        }
        return GLib.SOURCE_REMOVE;
      });
    }

    onListChanged(message) {
      this.rebuildCoins();
      if (message && this._statusRow) this._statusRow.text = message;
      GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
        try {
          this.menu.open();
        } catch (_e) {
          /* ignore */
        }
        return GLib.SOURCE_REMOVE;
      });
    }

    _startRefreshLoop() {
      this._stopRefreshLoop();
      const intervalSec = Settings.getRefreshInterval();
      this._refreshSource = GLib.timeout_add_seconds(
        GLib.PRIORITY_DEFAULT,
        intervalSec,
        () => {
          this.refreshPrices(false);
          return GLib.SOURCE_CONTINUE;
        },
      );
    }

    _stopRefreshLoop() {
      if (this._refreshSource) {
        GLib.source_remove(this._refreshSource);
        this._refreshSource = 0;
      }
    }

    async refreshPrices(manual = false) {
      if (this._refreshing) return;
      this._refreshing = true;
      this._refreshStatusText();

      try {
        const payload = this.coins.map(c => ({
          id: c.id,
          coingecko_id: c.coingecko_id,
          mint: c.mint,
          title: c.title,
          key: c.key,
          symbol: c.symbol,
        }));
        const vs = Settings.getVsCurrency();
        const quotes = await fetchQuotesForCoins(payload, vs);

        for (const coin of this.coins) {
          if (quotes[coin.id]) {
            const prev = coin.getQuote && coin.getQuote();
            coin.applyQuote(quotes[coin.id]);
            this._maybeFlash(coin, prev, quotes[coin.id]);
          }
        }

        this._checkPriceAlerts(quotes);

        this._lastError = null;
        this._lastOkAt = this._nowSec();
        this._lastOkHadQuotes = Object.keys(quotes).length > 0;

        this._updatePanelLabel(false);
        this._refreshStatusText();
      } catch (e) {
        this._lastError = e;
        console.error('OldGrowthPriceTracker: refresh failed', e);
        this._refreshStatusText();
        this._updatePanelLabel(false);
      } finally {
        this._refreshing = false;
        this._refreshStatusText();
      }
    }

    _maybeFlash(coin, prev, next) {
      const thr = Settings.getMoveFlashThreshold();
      if (!thr || thr <= 0) return;
      if (!next || next.change24h === null || next.change24h === undefined)
        return;
      if (Math.abs(next.change24h) < thr) return;
      // Only flash when we got a fresh non-stale quote
      if (isQuoteStale(next)) return;
      this._flashPanelChip(coin.id, next.change24h > 0);
    }

    _flashPanelChip(coinId, up) {
      const chip = this._panelChips.get(coinId);
      if (!chip || !chip.chip) return;
      const prevId = this._flashSources.get(coinId);
      if (prevId) {
        GLib.source_remove(prevId);
        this._flashSources.delete(coinId);
      }
      chip.chip.add_style_class_name(up ? 'og-chip-flash-up' : 'og-chip-flash-down');
      const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 900, () => {
        try {
          chip.chip.remove_style_class_name('og-chip-flash-up');
          chip.chip.remove_style_class_name('og-chip-flash-down');
        } catch (_e) {
          /* ignore */
        }
        this._flashSources.delete(coinId);
        return GLib.SOURCE_REMOVE;
      });
      this._flashSources.set(coinId, id);
    }

    /**
     * Jump alerts between refresh samples.
     * Per-coin: alert_enabled + alert_up_pct / alert_down_pct (from coin alert popup).
     * Global master switch must be ON; global thresholds apply when coin has no custom %.
     */
    _checkPriceAlerts(quotes) {
      const globalOn = Settings.getAlertsEnabled();
      const globalThr = Settings.getAlertThresholdPct() || 3;
      const globalUp = Settings.getAlertUpEnabled();
      const globalDown = Settings.getAlertDownEnabled();
      const cooldownMs = (Settings.getAlertCooldownSec() || 120) * 1000;
      const now = Date.now();
      const state = Settings.getAlertState() || {};
      let changed = false;

      // Snapshot latest stored prefs (alert flags live on settings coins)
      const storedById = new Map(
        Settings.getCoins().map(c => [c.id, c]),
      );

      for (const coin of this.coins) {
        const q = quotes[coin.id];
        if (!q || !q.price || !Number.isFinite(q.price) || q.price <= 0)
          continue;
        if (isQuoteStale(q)) continue;

        const stored = storedById.get(coin.id) || {};
        // Per-coin enable takes priority; else global master for all
        const coinEnabled = stored.alert_enabled === true;
        const useGlobal = !coinEnabled && globalOn;
        if (!coinEnabled && !useGlobal) {
          // Still track price baseline when disabled so enabling later is clean
          let entry = state[coin.id];
          if (typeof entry === 'number') entry = { price: entry, lastNotify: 0 };
          state[coin.id] = {
            price: q.price,
            lastNotify: (entry && entry.lastNotify) || 0,
          };
          changed = true;
          continue;
        }

        const upThr =
          stored.alert_up_pct > 0 ? Number(stored.alert_up_pct) : globalThr;
        const downThr =
          stored.alert_down_pct > 0
            ? Number(stored.alert_down_pct)
            : globalThr;
        const allowUp = coinEnabled ? upThr > 0 : globalUp;
        const allowDown = coinEnabled ? downThr > 0 : globalDown;

        let entry = state[coin.id];
        if (typeof entry === 'number') entry = { price: entry, lastNotify: 0 };
        if (!entry || entry.price == null) {
          state[coin.id] = { price: q.price, lastNotify: 0 };
          changed = true;
          continue;
        }

        const prev = Number(entry.price);
        if (!prev || prev <= 0) {
          state[coin.id] = {
            price: q.price,
            lastNotify: entry.lastNotify || 0,
          };
          changed = true;
          continue;
        }

        const pct = ((q.price - prev) / prev) * 100;
        const isUp = allowUp && pct >= upThr;
        const isDown = allowDown && pct <= -downThr;

        if (isUp || isDown) {
          const lastN = entry.lastNotify || 0;
          if (now - lastN >= cooldownMs) {
            const dir = isUp ? '▲ pump' : '▼ dump';
            const thrUsed = isUp ? upThr : downThr;
            const sign = pct > 0 ? '+' : '';
            const priceTxt = formatPanelPrice(q.price);
            Main.notify(
              `${coin.title} ${dir} ${sign}${pct.toFixed(2)}%`,
              `${priceTxt} · trigger ${isUp ? '+' : '−'}${thrUsed}%`,
            );
            this._flashPanelChip(coin.id, isUp);
            entry.lastNotify = now;
          }
        }

        entry.price = q.price;
        state[coin.id] = entry;
        changed = true;
      }
      if (changed) Settings.setAlertState(state);
    }

    // —— Drag-to-reorder ——
    beginCoinDrag(coinItem, _event) {
      this._endCoinDrag(false);
      this._dragSource = coinItem;
      this._dragDropIndex = this.coins.indexOf(coinItem);
      if (coinItem.setDragging) coinItem.setDragging(true);
      try {
        this._dragStageId = global.stage.connect(
          'captured-event',
          (_actor, ev) => this._onDragCaptured(ev),
        );
      } catch (e) {
        console.warn('OldGrowthPriceTracker: drag capture failed', e);
      }
    }

    _onDragCaptured(ev) {
      if (!this._dragSource) return Clutter.EVENT_PROPAGATE;
      const type = ev.type();
      if (type === Clutter.EventType.MOTION) {
        const [, y] = ev.get_coords();
        this._updateDropTargetAtY(y);
        return Clutter.EVENT_STOP;
      }
      if (
        type === Clutter.EventType.BUTTON_RELEASE ||
        type === Clutter.EventType.TOUCH_END
      ) {
        this._endCoinDrag(true);
        return Clutter.EVENT_STOP;
      }
      if (type === Clutter.EventType.KEY_PRESS) {
        // Escape cancel
        try {
          if (ev.get_key_symbol() === Clutter.KEY_Escape) {
            this._endCoinDrag(false);
            return Clutter.EVENT_STOP;
          }
        } catch (_e) {
          /* ignore */
        }
      }
      return Clutter.EVENT_PROPAGATE;
    }

    _updateDropTargetAtY(y) {
      let best = -1;
      let bestDist = Infinity;
      for (let i = 0; i < this.coins.length; i++) {
        const row = this.coins[i];
        try {
          const [, ry] = row.get_transformed_position();
          const h = row.height || 56;
          const mid = ry + h / 2;
          const d = Math.abs(y - mid);
          if (d < bestDist) {
            bestDist = d;
            best = i;
          }
          if (row.setDropTarget) row.setDropTarget(false);
        } catch (_e) {
          /* ignore */
        }
      }
      this._dragDropIndex = best;
      if (best >= 0 && this.coins[best] && this.coins[best].setDropTarget)
        this.coins[best].setDropTarget(true);
    }

    _endCoinDrag(commit) {
      if (this._dragStageId) {
        try {
          global.stage.disconnect(this._dragStageId);
        } catch (_e) {
          /* ignore */
        }
        this._dragStageId = 0;
      }
      const source = this._dragSource;
      const dropIdx = this._dragDropIndex;
      this._dragSource = null;
      this._dragDropIndex = -1;

      for (const c of this.coins) {
        if (c.setDropTarget) c.setDropTarget(false);
        if (c.setDragging) c.setDragging(false);
      }

      if (!commit || !source || dropIdx < 0) return;
      const fromIdx = this.coins.findIndex(c => c.id === source.id);
      if (fromIdx === -1 || fromIdx === dropIdx) return;

      if (Settings.reorderCoin(source.id, dropIdx)) {
        if (this._statusRow) this._statusRow.text = `Moved ${source.title}`;
        this.rebuildCoins();
      }
    }

    /**
     * Active coins sorted by user order (settings list order field).
     */
    _activeSorted() {
      const maxP = this._maxPanel();
      let active = this.coins.filter(c => c.activeCoin);
      active = [...active].sort((a, b) => {
        const ao = typeof a.order === 'number' ? a.order : 999;
        const bo = typeof b.order === 'number' ? b.order : 999;
        if (ao !== bo) return ao - bo;
        return 0;
      });
      if (active.length > maxP) active = active.slice(0, maxP);
      return active;
    }

    _structureKey(active) {
      return panelStructureKey(active);
    }

    _updatePanelLabel(forceStructure = true) {
      const active = this._activeSorted();
      const key = this._structureKey(active);

      if (
        !forceStructure &&
        key &&
        key === this._panelStructureKey &&
        this._panelChips.size > 0
      ) {
        this._updatePanelPricesOnly(active);
        this._relayoutPanelWidth();
        return;
      }

      this._rebuildPanelStructure(active);
    }

    _updatePanelPricesOnly(active) {
      const colorize = Settings.getColorizePrices();
      for (const coin of active) {
        const chip = this._panelChips.get(coin.id);
        if (!chip || !chip.priceLbl) continue;
        const q = coin.getQuote();
        const price =
          q && q.price !== null && q.price !== undefined ? q.price : null;
        const change = q ? q.change24h : null;
        const stale = q ? isQuoteStale(q) : false;
        chip.priceLbl.text =
          price === null ? '…' : formatPanelPrice(price);
        chip.priceLbl.set_style(
          `color: ${priceColor(change, colorize, stale)}; font-weight: 700;`,
        );
        if (stale) chip.chip.add_style_class_name('og-panel-chip-stale');
        else chip.chip.remove_style_class_name('og-panel-chip-stale');
      }
    }

    _rebuildPanelStructure(active) {
      this._panelBox.destroy_all_children();
      this._panelChips.clear();
      this._panelStructureKey = this._structureKey(active);

      if (active.length === 0) {
        this._panelBox.add_child(
          new St.Label({
            text: 'Solana',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'og-panel-text og-panel-placeholder',
          }),
        );
        this._relayoutPanelWidth();
        return;
      }

      const showIcons = Settings.getShowIcons();
      let showTickers = Settings.getShowTickers();
      // Auto-compact: with 4+ coins prefer icon + price only
      if (
        Settings.getAutoCompact &&
        Settings.getAutoCompact() &&
        active.length >= 4
      )
        showTickers = false;

      const colorize = Settings.getColorizePrices();

      for (let i = 0; i < active.length; i++) {
        const coin = active[i];
        const chip = new St.BoxLayout({
          style_class: 'og-panel-chip',
          vertical: false,
          y_align: Clutter.ActorAlign.CENTER,
          x_expand: false,
        });

        if (showIcons) {
          const icon = createCoinIconFromCoin(
            this._extension.path,
            {
              icon: coin.iconStem,
              icon_path: coin.icon_path || coin._icon_path || '',
              title: coin.title,
              coingecko_id: coin.coingecko_id,
              symbol: coin.symbol,
              key: coin.key,
              mint: coin.mint,
            },
            14,
          );
          icon.y_align = Clutter.ActorAlign.CENTER;
          icon.style_class = 'og-panel-coin-icon';
          chip.add_child(icon);
        }

        if (showTickers) {
          const nameLbl = new St.Label({
            text: coin.title,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'og-panel-ticker',
          });
          chip.add_child(nameLbl);
        }

        const q = coin.getQuote();
        const price =
          q && q.price !== null && q.price !== undefined ? q.price : null;
        const change = q ? q.change24h : null;
        const stale = q ? isQuoteStale(q) : false;
        const priceLbl = new St.Label({
          text: price === null ? '…' : formatPanelPrice(price),
          y_align: Clutter.ActorAlign.CENTER,
          style_class: 'og-panel-price',
        });
        priceLbl.set_style(
          `color: ${priceColor(change, colorize, stale)}; font-weight: 700;`,
        );
        chip.add_child(priceLbl);
        if (stale) chip.add_style_class_name('og-panel-chip-stale');

        this._panelBox.add_child(chip);
        this._panelChips.set(coin.id, { chip, priceLbl, coin });

        if (i < active.length - 1) {
          const sep = new St.Label({
            text: '·',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'og-panel-sep',
          });
          this._panelBox.add_child(sep);
        }
      }

      this._relayoutPanelWidth();
    }

    _relayoutPanelWidth() {
      try {
        this._panelBox.set_width(-1);
        this.set_width(-1);
      } catch (_e) {
        /* ignore */
      }

      GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
        try {
          this._panelBox.queue_relayout();
          const [, natBox] = this._panelBox.get_preferred_width(-1);
          const pad = 16;
          const w = Math.max(natBox + pad, 48);
          this._panelBox.set_width(Math.max(natBox, 1));
          this.set_width(w);
          this.queue_relayout();
        } catch (_e) {
          /* ignore */
        }
        return GLib.SOURCE_REMOVE;
      });
    }

    destroy() {
      this._endCoinDrag(false);
      this._stopRefreshLoop();
      this._stopStatusTicker();
      for (const id of this._flashSources.values()) {
        try {
          GLib.source_remove(id);
        } catch (_e) {
          /* ignore */
        }
      }
      this._flashSources.clear();
      if (this._settings && this._settingsSignals) {
        for (const id of this._settingsSignals) {
          try {
            this._settings.disconnect(id);
          } catch (_e) {
            /* ignore */
          }
        }
      }
      this._settingsSignals = [];
      for (const c of this.coins) {
        try {
          c.destroy();
        } catch (_e) {
          /* ignore */
        }
      }
      this.coins = [];
      this._panelChips.clear();
      super.destroy();
    }
  },
);

export default class Extension extends Ex {
  enable() {
    logInfo(`v${APP_VERSION} enable (${this.uuid})`);
    this._indicator = new Indicator(this);
    Main.panel.addToStatusArea(this.uuid, this._indicator);
  }

  disable() {
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }
    CryptoUtil.destroy();
  }
}
