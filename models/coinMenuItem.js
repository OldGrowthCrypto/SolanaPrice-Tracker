import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Settings from '../settings.js';
import {
  createCoinIconFromCoin,
  resolveIconStem,
} from '../utils/icons.js';
import { formatPrice, formatChange } from '../utils/format.js';
import {
  shortMint,
  isLikelyMint,
  resolveSwapMint,
} from '../api/catalog.js';
import {
  chartUrlForProvider,
  jupiterSwapSolUrl,
  jupiterUrl,
} from '../api/dexscreener.js';
import { isQuoteStale } from '../api/prices.js';
import { openEditCoinDialog } from './editCoinDialog.js';
import { openCoinAlertDialog } from './coinAlertDialog.js';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

function _openUrl(url) {
  try {
    Util.spawnCommandLine(`xdg-open '${String(url).replace(/'/g, "'\\''")}'`);
  } catch (err) {
    Main.notifyError(`Cannot open ${url}`, String(err));
  }
}

function _copyText(text) {
  try {
    const clipboard = St.Clipboard.get_default();
    clipboard.set_text(St.ClipboardType.CLIPBOARD, String(text || ''));
    Main.notify('Solana Crypto Price Tracker', 'Copied to clipboard');
  } catch (e) {
    Main.notifyError('Copy failed', String(e));
  }
}

export const CoinMenuItem = GObject.registerClass(
  class CoinMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(coin, panelMenu, extensionPath, extension) {
      super({
        reactive: true,
        activate: false,
        hover: true,
        can_focus: true,
      });

      this.id = coin.id;
      this.symbol = coin.symbol;
      this.coingecko_id = coin.coingecko_id || '';
      this.mint = coin.mint || '';
      this.swap_mint = coin.swap_mint || '';
      this.activeCoin = !!coin.active;
      this.title = coin.title || coin.symbol?.split('/')[0] || '?';
      this.subtitle = coin.subtitle || '';
      this.pinned = false;
      this.key = coin.key || '';
      this.order = typeof coin.order === 'number' ? coin.order : 0;
      this.icon_path = coin.icon_path || '';
      this.chart_provider = coin.chart_provider || '';
      this.alert_enabled = !!coin.alert_enabled;
      this.alert_up_pct = coin.alert_up_pct > 0 ? coin.alert_up_pct : null;
      this.alert_down_pct = coin.alert_down_pct > 0 ? coin.alert_down_pct : null;
      this.iconStem = resolveIconStem(coin);
      this._icon_path = this.icon_path;
      this.panelMenu = panelMenu;
      this.extensionPath = extensionPath;
      this._extension = extension || panelMenu._extension;
      this._toggling = false;

      this.add_style_class_name('og-coin-row');
      if (this.activeCoin) this.add_style_class_name('og-coin-row-active');

      this._switch = new PopupMenu.Switch(!!this.activeCoin);
      this.accessible_role = Atk.Role.CHECK_MENU_ITEM;
      this.checkAccessibleState();

      // Compact reorder strip: drag handle + up/down (horizontal = shorter rows)
      const orderCol = new St.BoxLayout({
        vertical: false,
        y_align: Clutter.ActorAlign.CENTER,
        style_class: 'og-order-col',
      });
      const gripIcon = new St.Icon({
        icon_name: 'open-menu-symbolic',
        style_class: 'popup-menu-icon',
        icon_size: 12,
      });
      this._gripBtn = new St.Button({
        child: gripIcon,
        style_class: 'og-icon-btn og-drag-handle',
        reactive: true,
        can_focus: true,
        track_hover: true,
      });
      this._gripBtn.connect('button-press-event', (_a, event) => {
        if (this.panelMenu && this.panelMenu.busy) return Clutter.EVENT_STOP;
        if (this.panelMenu && this.panelMenu.beginCoinDrag)
          this.panelMenu.beginCoinDrag(this, event);
        return Clutter.EVENT_STOP;
      });
      this._upBtn = this._actionBtn('go-up-symbolic', () => this._move(-1));
      this._downBtn = this._actionBtn('go-down-symbolic', () => this._move(1));
      orderCol.add_child(this._gripBtn);
      orderCol.add_child(this._upBtn);
      orderCol.add_child(this._downBtn);
      this.add_child(orderCol);

      const coinIcon = createCoinIconFromCoin(extensionPath, coin, 20);
      coinIcon.y_align = Clutter.ActorAlign.CENTER;
      this.add_child(coinIcon);

      const nameCol = new St.BoxLayout({
        vertical: true,
        y_align: Clutter.ActorAlign.CENTER,
        style_class: 'og-coin-name-col',
        x_expand: true,
      });
      this._titleRow = new St.BoxLayout({
        vertical: false,
        style_class: 'og-coin-title-row',
      });
      this.nameLbl = new St.Label({
        text: this.title,
        style_class: 'og-coin-name',
      });
      this._titleRow.add_child(this.nameLbl);
      nameCol.add_child(this._titleRow);

      const sub =
        this.subtitle ||
        (this.mint ? shortMint(this.mint) : (this.symbol || '').toUpperCase());
      this.subLbl = new St.Label({
        text: sub,
        style_class: 'og-coin-pair',
      });
      nameCol.add_child(this.subLbl);
      this.add_child(nameCol);

      const quoteCol = new St.BoxLayout({
        vertical: true,
        y_align: Clutter.ActorAlign.CENTER,
        x_align: Clutter.ActorAlign.END,
        style_class: 'og-coin-quote-col',
      });
      this.priceLbl = new St.Label({
        text: '…',
        style_class: 'og-coin-price',
        x_align: Clutter.ActorAlign.END,
      });
      this.changeLbl = new St.Label({
        text: '—',
        style_class: 'og-coin-change change-flat',
        x_align: Clutter.ActorAlign.END,
      });
      quoteCol.add_child(this.priceLbl);
      quoteCol.add_child(this.changeLbl);
      this.add_child(quoteCol);

      const actions = new St.BoxLayout({
        style_class: 'og-coin-actions',
        y_align: Clutter.ActorAlign.CENTER,
      });

      this._editBtn = this._actionBtn('document-edit-symbolic', () =>
        this._editCoin(),
      );
      actions.add_child(this._editBtn);

      // Per-coin alerts / chart preference popup
      this._alertBtn = this._actionBtn(
        'preferences-system-notifications-symbolic',
        () => this._openAlertDialog(),
      );
      actions.add_child(this._alertBtn);

      // Chart (provider: DexScreener / Birdeye / Jupiter — set in alert popup)
      this._chartBtn = this._actionBtn('web-browser-symbolic', () =>
        this._openChart(),
      );
      actions.add_child(this._chartBtn);

      // Swap + copy: price mint or swap_mint (e.g. BTC → portal wBTC on Solana)
      const swapMint = resolveSwapMint(this) || '';
      const hasSwap = !!(swapMint && isLikelyMint(swapMint));
      const copyMint =
        this.mint && isLikelyMint(this.mint)
          ? this.mint
          : hasSwap
            ? swapMint
            : '';
      const hasCopy = !!copyMint;

      this._swapBtn = this._actionBtn(
        'emblem-synchronizing-symbolic',
        () => this._openSwap(),
        hasSwap,
      );
      actions.add_child(this._swapBtn);

      this._copyBtn = this._actionBtn(
        'edit-copy-symbolic',
        () => {
          if (hasCopy) _copyText(copyMint);
        },
        hasCopy,
      );
      actions.add_child(this._copyBtn);

      const switchBin = new St.Bin({
        child: this._switch,
        y_align: Clutter.ActorAlign.CENTER,
        style_class: 'og-switch-btn',
      });
      actions.add_child(switchBin);
      // Compact “full” hint shown via status row; keep tiny label only when needed
      this._fullHint = new St.Label({
        text: '',
        style_class: 'og-full-hint',
      });
      this._fullHint.set_style(
        'font-size: 0.58em; font-weight: 700; color: #c62828; min-height: 0;',
      );
      // not stacked under switch — keeps row short
      this._switch.connect('notify::state', () => {
        if (this._toggling) return;
        this._onSwitchChanged();
      });

      this._delBtn = this._actionBtn('user-trash-symbolic', () =>
        this._delCoin(),
      );
      actions.add_child(this._delBtn);

      this.add_child(actions);
      this._actionButtons = [
        this._gripBtn,
        this._upBtn,
        this._downBtn,
        this._editBtn,
        this._alertBtn,
        this._chartBtn,
        this._swapBtn,
        this._copyBtn,
        this._delBtn,
      ].filter(Boolean);

      this._price = null;
      this._change24h = null;
      this._quoteSource = '';
      this._quoteTs = 0;
      this._dropHighlight = false;
    }

    _move(delta) {
      if (this.panelMenu && this.panelMenu.busy) return;
      const ok = Settings.moveCoin(
        {
          id: this.id,
          key: this.key,
          mint: this.mint,
          coingecko_id: this.coingecko_id,
          symbol: this.symbol,
          title: this.title,
        },
        delta,
      );
      if (ok) {
        if (this.panelMenu.onListChanged)
          this.panelMenu.onListChanged('Order updated');
        else this.panelMenu.rebuildCoins();
      }
    }

    setDropTarget(on) {
      this._dropHighlight = !!on;
      if (on) this.add_style_class_name('og-coin-row-drop');
      else this.remove_style_class_name('og-coin-row-drop');
    }

    setDragging(on) {
      if (on) this.add_style_class_name('og-coin-row-dragging');
      else this.remove_style_class_name('og-coin-row-dragging');
    }

    /**
     * @param {string} iconName
     * @param {Function} cb
     * @param {boolean} [active=true] when false: dimmed, no action (layout spacer)
     */
    _actionBtn(iconName, cb, active = true) {
      const icon = new St.Icon({
        icon_name: iconName,
        style_class: 'popup-menu-icon',
        icon_size: 12,
      });
      const btn = new St.Button({
        child: icon,
        style_class: active ? 'og-icon-btn' : 'og-icon-btn og-icon-btn-inactive',
        reactive: !!active,
        can_focus: !!active,
        track_hover: !!active,
        opacity: active ? 255 : 90,
      });
      btn._ogInactive = !active;
      if (active) {
        btn.connect('button-press-event', (_a, _event) => {
          if (this.panelMenu && this.panelMenu.busy) return Clutter.EVENT_STOP;
          try {
            cb();
          } catch (e) {
            console.error('OldGrowthPriceTracker: action failed', e);
          }
          return Clutter.EVENT_STOP;
        });
      }
      return btn;
    }

    setActionsEnabled(enabled) {
      const on = !!enabled;
      for (const b of this._actionButtons || []) {
        // Keep layout-only placeholders non-reactive
        if (b._ogInactive) {
          b.reactive = false;
          continue;
        }
        b.reactive = on;
      }
      if (this._switch) this._switch.reactive = on;
    }

    _syncActiveUi() {
      if (this.activeCoin) this.add_style_class_name('og-coin-row-active');
      else this.remove_style_class_name('og-coin-row-active');
      this.checkAccessibleState();
    }

    _onSwitchChanged() {
      if (this.panelMenu && this.panelMenu.busy) {
        this._toggling = true;
        this._switch.state = this.activeCoin;
        this._toggling = false;
        return;
      }

      const wantOn = !!this._switch.state;
      if (wantOn === this.activeCoin) {
        if (this._fullHint) this._fullHint.text = '';
        return;
      }

      const maxPanel = Settings.getMaxPanelCoins();

      if (wantOn) {
        const othersOn = this.panelMenu.coins.filter(
          c => c !== this && c.activeCoin,
        ).length;
        if (othersOn >= maxPanel) {
          this._toggling = true;
          this._switch.state = false;
          this._toggling = false;
          if (this._fullHint) this._fullHint.text = `Full ${maxPanel}/${maxPanel}`;
          if (this.panelMenu._statusRow) {
            this.panelMenu._statusRow.text = `Bar full (${maxPanel}/${maxPanel}) — turn one off first`;
          }
          Main.notify(
            'Solana Crypto Price Tracker',
            `Top bar can show at most ${maxPanel} coins.`,
          );
          return;
        }
      }

      if (this._fullHint) this._fullHint.text = '';
      this.activeCoin = wantOn;
      this._syncActiveUi();

      Settings.setCoinActive(
        {
          id: this.id,
          key: this.key,
          mint: this.mint,
          coingecko_id: this.coingecko_id,
          symbol: this.symbol,
          title: this.title,
        },
        this.activeCoin,
      );

      this.panelMenu._updatePanelLabel(true);
      if (this.panelMenu._refreshStatusText)
        this.panelMenu._refreshStatusText();
    }

    applyQuote(data) {
      if (!data) {
        this.priceLbl.text = '—';
        this.changeLbl.text = '—';
        this.changeLbl.style_class = 'og-coin-change change-flat';
        this.priceLbl.style_class = 'og-coin-price';
        this.priceLbl.remove_style_class_name('og-stale');
        this._price = null;
        this._change24h = null;
        this._quoteSource = '';
        this._quoteTs = 0;
        return;
      }

      this._price = data.price;
      this._change24h = data.change24h;
      this._quoteSource = data.source || '';
      this._quoteTs = data.timestamp || 0;

      const stale = isQuoteStale(data);
      this.priceLbl.text = `$${formatPrice(data.price)}`;

      const c = formatChange(data.change24h);
      this.changeLbl.text = stale ? `${c.text} · stale` : c.text;
      this.changeLbl.style_class = `og-coin-change ${c.css}`;
      this.priceLbl.style_class = stale
        ? 'og-coin-price og-stale'
        : `og-coin-price ${c.css}`;

      const colorize = Settings.getColorizePrices();
      let pCol = 'inherit';
      let cCol = 'inherit';
      if (stale) {
        pCol = '#b36b00';
        cCol = '#b36b00';
      } else if (colorize) {
        if (data.change24h > 0.005) {
          pCol = '#0a7a3e';
          cCol = '#0a7a3e';
        } else if (data.change24h < -0.005) {
          pCol = '#c62828';
          cCol = '#c62828';
        }
      }
      this.priceLbl.set_style(
        pCol === 'inherit'
          ? 'font-weight: 800;'
          : `color: ${pCol}; font-weight: 800;`,
      );
      this.changeLbl.set_style(
        cCol === 'inherit'
          ? 'font-weight: 700;'
          : `color: ${cCol}; font-weight: 700;`,
      );
    }

    getQuote() {
      return {
        price: this._price,
        change24h: this._change24h,
        source: this._quoteSource,
        timestamp: this._quoteTs,
      };
    }

    get state() {
      return this._switch.state;
    }

    setToggleState(state) {
      this._toggling = true;
      this._switch.state = !!state;
      this.activeCoin = !!state;
      this._toggling = false;
      this._syncActiveUi();
    }

    activate(event) {
      if (
        event &&
        event.type() === Clutter.EventType.KEY_PRESS &&
        event.get_key_symbol() === Clutter.KEY_space
      ) {
        this._toggling = true;
        this._switch.state = !this._switch.state;
        this._toggling = false;
        this._onSwitchChanged();
      }
    }

    checkAccessibleState() {
      switch (this.accessible_role) {
        case Atk.Role.CHECK_MENU_ITEM:
          if (this._switch.state)
            this.add_accessible_state(Atk.StateType.CHECKED);
          else this.remove_accessible_state(Atk.StateType.CHECKED);
          break;
        default:
          this.remove_accessible_state(Atk.StateType.CHECKED);
      }
    }

    _editCoin() {
      try {
        this.panelMenu.menu.close();
      } catch (_e) {
        /* ignore */
      }
      openEditCoinDialog(this.panelMenu, this._extension, this);
    }

    _openAlertDialog() {
      try {
        this.panelMenu.menu.close();
      } catch (_e) {
        /* ignore */
      }
      openCoinAlertDialog(this.panelMenu, this._extension, this);
    }

    _resolvedChartProvider() {
      if (this.chart_provider) return this.chart_provider;
      try {
        return Settings.getDefaultChartProvider();
      } catch (_e) {
        return 'dexscreener';
      }
    }

    _openChart() {
      const provider = this._resolvedChartProvider();
      const url = chartUrlForProvider(
        this.mint || '',
        provider,
        this.coingecko_id || '',
      );
      _openUrl(url);
    }

    _openSwap() {
      const mint = resolveSwapMint(this);
      if (mint && isLikelyMint(mint))
        _openUrl(jupiterSwapSolUrl(mint) || jupiterUrl(mint));
      else
        Main.notify(
          'Solana Crypto Price Tracker',
          'Jupiter swap needs a Solana mint',
        );
    }

    _delCoin() {
      if (this.panelMenu && this.panelMenu.busy) return;

      const ref = {
        id: this.id,
        key: this.key,
        mint: this.mint,
        coingecko_id: this.coingecko_id,
        symbol: this.symbol,
        title: this.title,
      };

      let removed = Settings.delCoin(ref);
      if (!removed) {
        const coins = Settings.getCoins();
        const i = coins.findIndex(
          c =>
            (c.id && c.id === this.id) ||
            (c.title || '').toUpperCase() === (this.title || '').toUpperCase(),
        );
        if (i !== -1) {
          coins.splice(i, 1);
          Settings.setCoins(coins);
          removed = true;
        }
      }

      if (!removed) {
        Main.notify(
          'Solana Crypto Price Tracker',
          `Could not remove ${this.title}`,
        );
        return;
      }

      try {
        this.panelMenu.coins = this.panelMenu.coins.filter(c => c !== this);
      } catch (_e) {
        /* ignore */
      }

      if (this.panelMenu.onListChanged)
        this.panelMenu.onListChanged(`Removed ${ref.title}`);
      else {
        this.panelMenu.rebuildCoins();
        if (this.panelMenu._statusRow)
          this.panelMenu._statusRow.text = `Removed ${ref.title}`;
      }
    }

    copyMint() {
      if (this.mint) _copyText(this.mint);
    }

    destroy() {
      super.destroy();
    }
  },
);
