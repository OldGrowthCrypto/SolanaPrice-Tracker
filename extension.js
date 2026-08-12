/* extension.js — Solana Crypto Price Tracker (Old Growth)
 *
 * Forked from Crypto Price Tracker (GPL-2.0-or-later).
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';

import { Extension as Ex } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';

import * as Settings from './settings.js';
import * as CryptoUtil from './utils/cryptoUtil.js';
import {
  createCoinIcon,
  createCoinIconFromCoin,
  resolveIconStem,
} from './utils/icons.js';
import { formatPanelPrice, priceColor } from './utils/format.js';
import { fetchQuotesForCoins } from './api/prices.js';
import { MAX_PANEL_COINS } from './api/catalog.js';
import { CoinMenuItem } from './models/coinMenuItem.js';
import { buildOptionsMenu } from './models/optionsMenu.js';

const APP_VERSION = 10;

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
      this._lastOkAt = 0; // seconds (monotonic-ish via real_time/1e6)
      this._lastOkHadQuotes = false;
      this._panelChips = new Map();
      this._panelStructureKey = '';
      this._settings = Settings.getSettings();
      this._settingsSignals = [];

      this._panelBox = new St.BoxLayout({
        style_class: 'og-panel-box',
        vertical: false,
        y_align: Clutter.ActorAlign.CENTER,
        x_expand: false,
        x_align: Clutter.ActorAlign.START,
      });
      this.add_child(this._panelBox);
      this._renderPanelPlaceholder();

      this._buildHeader();
      this.menu.addMenuItem(buildOptionsMenu(this, extension));
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      this._buildCoinList();
      this._buildStatus();
      this._buildFooter();

      for (const key of [
        'show-icons',
        'show-tickers',
        'colorize-prices',
        'auto-compact',
        'refresh-interval',
      ]) {
        this._settingsSignals.push(
          this._settings.connect(`changed::${key}`, () => {
            if (key === 'refresh-interval') this._startRefreshLoop();
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
        style_class: 'og-header-title-row',
      });

      const logo = createCoinIcon(this._extension.path, 'brand', 48);
      logo.style_class = 'coin-icon og-brand-icon';
      logo.y_align = Clutter.ActorAlign.CENTER;
      titleRow.add_child(logo);

      const titles = new St.BoxLayout({
        vertical: true,
        x_expand: true,
        style_class: 'og-header-titles',
      });

      const titleLbl = new St.Label({
        text: 'Solana Crypto Price Tracker',
        style_class: 'og-header-title',
      });
      titleLbl.set_style('color: #111111; font-weight: 800;');
      titles.add_child(titleLbl);

      const subLbl = new St.Label({
        text: 'Old Growth Crypto',
        style_class: 'og-header-subtitle',
      });
      subLbl.set_style('color: #333333; font-weight: 600;');
      titles.add_child(subLbl);
      titleRow.add_child(titles);

      const refreshIcon = new St.Icon({
        icon_name: 'view-refresh-symbolic',
        icon_size: 14,
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
      this._statusRow.set_style('color: #333333;');
      const statusItem = new PopupMenu.PopupBaseMenuItem({
        reactive: false,
        can_focus: false,
        style_class: 'og-status-item',
      });
      statusItem.add_child(this._statusRow);
      this.menu.addMenuItem(statusItem);
    }

    _buildFooter() {
      const footerItem = new PopupMenu.PopupBaseMenuItem({
        reactive: true,
        can_focus: true,
        style_class: 'og-footer-item',
      });
      footerItem.add_child(
        new St.Label({
          text: 'oldgrowthcrypto.com',
          style_class: 'og-footer-link',
          y_align: Clutter.ActorAlign.CENTER,
          x_expand: true,
        }),
      );
      footerItem.connect('activate', () => {
        Util.spawnCommandLine('xdg-open https://oldgrowthcrypto.com');
      });
      this.menu.addMenuItem(footerItem);
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
      if (this._refreshing) {
        this._statusRow.text = 'Refreshing…';
        this._statusRow.set_style('color: #333333;');
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
        this._statusRow.set_style('color: #c62828;');
        return;
      }
      if (!this._lastOkAt) {
        this._statusRow.text = 'Waiting for prices…';
        this._statusRow.set_style('color: #333333;');
        return;
      }
      const ago = this._formatAgo(this._nowSec() - this._lastOkAt);
      const onBar = this.coins.filter(c => c.activeCoin).length;
      const stale = this._nowSec() - this._lastOkAt > 90;
      this._statusRow.text = stale
        ? `Updated ${ago} · stale · bar ${onBar}/${MAX_PANEL_COINS}`
        : `Updated ${ago} · bar ${onBar}/${MAX_PANEL_COINS}`;
      this._statusRow.set_style(
        stale ? 'color: #b36b00; font-weight: 600;' : 'color: #333333;',
      );
    }

    _startStatusTicker() {
      this._stopStatusTicker();
      this._statusTickSource = GLib.timeout_add_seconds(
        GLib.PRIORITY_DEFAULT,
        5,
        () => {
          this._refreshStatusText();
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

      // First-run seed only; never resurrect after user clears list
      let stored = Settings.ensureSeeded
        ? Settings.ensureSeeded()
        : Settings.getCoins();

      const sorted = [...stored].sort((a, b) => {
        if (!!b.active !== !!a.active) return a.active ? -1 : 1;
        const at = a.added_at || 0;
        const bt = b.added_at || 0;
        if (bt !== at) return bt - at;
        return 0;
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

      const rowH = 50;
      const want = Math.max(sorted.length * rowH, rowH * 3);
      this._coinsScrollview.set_height(CryptoUtil.getHeight(want));
      this._updatePanelLabel(true);
      this.setBusy(false);
      this.refreshPrices(true);
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
        }));
        const vs = Settings.getVsCurrency();
        const quotes = await fetchQuotesForCoins(payload, vs);

        for (const coin of this.coins) {
          if (quotes[coin.id]) coin.applyQuote(quotes[coin.id]);
        }

        this._lastError = null;
        this._lastOkAt = this._nowSec();
        this._lastOkHadQuotes = Object.keys(quotes).length > 0;

        // In-place panel price update when structure unchanged
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

    _activeSorted() {
      let active = this.coins.filter(c => c.activeCoin);
      const order = { BTC: 0, SOL: 1, JUP: 2, BONK: 3, JTO: 4 };
      active = [...active].sort((a, b) => {
        const ao = order[a.title] !== undefined ? order[a.title] : 50;
        const bo = order[b.title] !== undefined ? order[b.title] : 50;
        if (ao !== bo) return ao - bo;
        return 0;
      });
      if (active.length > MAX_PANEL_COINS)
        active = active.slice(0, MAX_PANEL_COINS);
      return active;
    }

    _structureKey(active) {
      return active.map(c => c.id).join('|');
    }

    /**
     * @param {boolean} forceStructure rebuild chips even if same coins
     */
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
        chip.priceLbl.text =
          price === null ? '…' : formatPanelPrice(price);
        chip.priceLbl.set_style(
          `color: ${priceColor(change, colorize)}; font-weight: 700;`,
        );
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
      // Auto-compact: hide tickers when 4+ coins on bar
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
          nameLbl.set_style('color: #ffffff; font-weight: 700;');
          chip.add_child(nameLbl);
        }

        const q = coin.getQuote();
        const price =
          q && q.price !== null && q.price !== undefined ? q.price : null;
        const change = q ? q.change24h : null;
        const priceLbl = new St.Label({
          text: price === null ? '…' : formatPanelPrice(price),
          y_align: Clutter.ActorAlign.CENTER,
          style_class: 'og-panel-price',
        });
        priceLbl.set_style(
          `color: ${priceColor(change, colorize)}; font-weight: 700;`,
        );
        chip.add_child(priceLbl);

        this._panelBox.add_child(chip);
        this._panelChips.set(coin.id, { chip, priceLbl, coin });

        if (i < active.length - 1) {
          const sep = new St.Label({
            text: '·',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'og-panel-sep',
          });
          sep.set_style('color: #cccccc; padding: 0 4px; opacity: 0.75;');
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
      this._stopRefreshLoop();
      this._stopStatusTicker();
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
    console.log(
      `Solana Crypto Price Tracker v${APP_VERSION} ready (${this.uuid})`,
    );
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
