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
import { chartUrl } from '../api/coingecko.js';
import { shortMint, MAX_PANEL_COINS } from '../api/catalog.js';
import { openEditCoinDialog } from './editCoinDialog.js';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

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
      this.activeCoin = !!coin.active;
      this.title = coin.title || coin.symbol?.split('/')[0] || '?';
      this.subtitle = coin.subtitle || '';
      this.pinned = false;
      this.key = coin.key || '';
      this.icon_path = coin.icon_path || '';
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

      const coinIcon = createCoinIconFromCoin(extensionPath, coin, 28);
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

      // Edit
      this._editBtn = this._actionBtn('document-edit-symbolic', () =>
        this._editCoin(),
      );
      actions.add_child(this._editBtn);

      // Chart
      this._chartBtn = this._actionBtn('web-browser-symbolic', () =>
        this._openChart(),
      );
      actions.add_child(this._chartBtn);

      // Switch (on bar) + optional full hint
      const switchCol = new St.BoxLayout({
        vertical: true,
        y_align: Clutter.ActorAlign.CENTER,
        style_class: 'og-switch-col',
      });
      const switchBin = new St.Bin({
        child: this._switch,
        y_align: Clutter.ActorAlign.CENTER,
        style_class: 'og-switch-btn',
      });
      switchCol.add_child(switchBin);
      this._fullHint = new St.Label({
        text: '',
        style_class: 'og-full-hint',
      });
      this._fullHint.set_style(
        'font-size: 0.65em; font-weight: 700; color: #c62828; min-height: 0;',
      );
      switchCol.add_child(this._fullHint);
      actions.add_child(switchCol);
      this._switch.connect('notify::state', () => {
        if (this._toggling) return;
        this._onSwitchChanged();
      });

      // Trash — button-press so it always fires
      this._delBtn = this._actionBtn('user-trash-symbolic', () =>
        this._delCoin(),
      );
      actions.add_child(this._delBtn);

      this.add_child(actions);
      this._actionButtons = [this._editBtn, this._chartBtn, this._delBtn].filter(
        Boolean,
      );

      this._price = null;
      this._change24h = null;
    }

    _actionBtn(iconName, cb) {
      const icon = new St.Icon({
        icon_name: iconName,
        style_class: 'popup-menu-icon',
        icon_size: 14,
      });
      const btn = new St.Button({
        child: icon,
        style_class: 'og-icon-btn',
        reactive: true,
        can_focus: true,
        track_hover: true,
      });
      btn.connect('button-press-event', (_a, _event) => {
        if (this.panelMenu && this.panelMenu.busy) return Clutter.EVENT_STOP;
        try {
          cb();
        } catch (e) {
          console.error('OldGrowthPriceTracker: action failed', e);
        }
        return Clutter.EVENT_STOP;
      });
      return btn;
    }

    setActionsEnabled(enabled) {
      const on = !!enabled;
      if (this._editBtn) this._editBtn.reactive = on;
      if (this._chartBtn) this._chartBtn.reactive = on;
      if (this._delBtn) this._delBtn.reactive = on;
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

      if (wantOn) {
        const othersOn = this.panelMenu.coins.filter(
          c => c !== this && c.activeCoin,
        ).length;
        if (othersOn >= MAX_PANEL_COINS) {
          this._toggling = true;
          this._switch.state = false;
          this._toggling = false;
          if (this._fullHint) this._fullHint.text = `Full ${MAX_PANEL_COINS}/${MAX_PANEL_COINS}`;
          if (this.panelMenu._statusRow) {
            this.panelMenu._statusRow.text = `Bar full (${MAX_PANEL_COINS}/${MAX_PANEL_COINS}) — turn one off first`;
          }
          Main.notify(
            'Solana Crypto Price Tracker',
            `Top bar can show at most ${MAX_PANEL_COINS} coins.`,
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

      // Force structure rebuild so width adjusts
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
        this.priceLbl.set_style('color: #222222; font-weight: 800;');
        this.changeLbl.set_style('color: #555555;');
        this._price = null;
        this._change24h = null;
        return;
      }

      this._price = data.price;
      this._change24h = data.change24h;
      this.priceLbl.text = `$${formatPrice(data.price)}`;

      const c = formatChange(data.change24h);
      this.changeLbl.text = c.text;
      this.changeLbl.style_class = `og-coin-change ${c.css}`;
      this.priceLbl.style_class = `og-coin-price ${c.css}`;

      const colorize = Settings.getColorizePrices();
      let pCol = '#222222';
      let cCol = '#555555';
      if (colorize) {
        if (data.change24h > 0.005) {
          pCol = '#0a7a3e';
          cCol = '#0a7a3e';
        } else if (data.change24h < -0.005) {
          pCol = '#c62828';
          cCol = '#c62828';
        }
      }
      this.priceLbl.set_style(`color: ${pCol}; font-weight: 800;`);
      this.changeLbl.set_style(`color: ${cCol}; font-weight: 700;`);
    }

    getQuote() {
      return { price: this._price, change24h: this._change24h };
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
      // Don't toggle when interacting with action buttons area — only empty row body
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
      // Mouse: only toggle via the switch (avoid accidental toggles when editing/deleting)
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

      // Immediate UI drop + rebuild (keeps menu usable)
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

    _openChart() {
      let url;
      if (this.mint) {
        url = `https://dexscreener.com/solana/${this.mint}`;
      } else {
        url = chartUrl(this.coingecko_id);
      }
      try {
        Util.spawnCommandLine(`xdg-open '${url.replace(/'/g, "'\\''")}'`);
      } catch (err) {
        Main.notifyError(`Cannot open ${url}`, String(err));
      }
    }

    destroy() {
      super.destroy();
    }
  },
);
