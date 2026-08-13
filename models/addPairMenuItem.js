import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as CryptoUtil from '../utils/cryptoUtil.js';
import * as Settings from '../settings.js';
import { KNOWN_COINS } from '../api/coingecko.js';
import { isLikelyMint, shortMint } from '../api/catalog.js';
import { lookupMint } from '../api/jupiter.js';
import { installCustomIcon } from '../utils/icons.js';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

/**
 * Add a token by trading pair (e.g. SOL/USD, BONK/USD) or coingecko id.
 * Optional: path to a custom icon image file.
 */
export const AddPairMenuItem = GObject.registerClass(
  class AddPairMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(panelMenu, Me) {
      super({
        reactive: false,
        can_focus: false,
        activate: false,
      });
      this.panelMenu = panelMenu;
      this.Me = Me;
      this.add_style_class_name('og-add-coin');

      const vbox = new St.BoxLayout({
        style_class: 'og-add-coin-vbox',
        vertical: true,
        x_expand: true,
      });
      this.add_child(vbox);

      vbox.add_child(
        this._hint('Pair like SOL/USD or ticker like BONK, then Add'),
      );

      const row = new St.BoxLayout({
        x_expand: true,
        style_class: 'og-add-row',
        y_align: Clutter.ActorAlign.CENTER,
      });
      vbox.add_child(row);

      this.pairEntry = this._entry('Pair or ticker', true);
      row.add_child(this.pairEntry);

      this.labelEntry = this._entry('Label', false);
      this.labelEntry.set_style(
        'background-color: #ffffff; color: #111111; border: 1px solid #999; padding: 8px; width: 70px;',
      );
      row.add_child(this.labelEntry);

      row.add_child(this._addButton(() => this._addPair()));

      this.iconEntry = this._entry('Optional icon file path…', true);
      vbox.add_child(this.iconEntry);

      this.statusLbl = this._hint('');
      vbox.add_child(this.statusLbl);

      this.pairEntry.clutter_text.connect('activate', () => this._addPair());
    }

    _hint(text) {
      const l = new St.Label({ text, style_class: 'og-hint' });
      l.set_style('color: #333333;');
      return l;
    }

    _entry(hint, expand) {
      const e = new St.Entry({
        hint_text: hint,
        can_focus: true,
        x_expand: expand,
        style_class: 'og-input',
        track_hover: true,
      });
      e.set_style(
        'background-color: #ffffff; color: #111111; border: 1px solid #999; padding: 8px; min-width: 140px;',
      );
      return e;
    }

    _addButton(cb) {
      const addLbl = new St.Label({
        text: '  ADD  ',
        y_align: Clutter.ActorAlign.CENTER,
      });
      addLbl.set_style('color: #04140e; font-weight: 800;');
      const addBtn = new St.Button({
        child: addLbl,
        style_class: 'og-add-btn',
        reactive: true,
        can_focus: true,
      });
      addBtn.set_style(
        'background-color: #14f195; border-radius: 8px; padding: 8px 12px;',
      );
      addBtn.connect('clicked', cb);
      return addBtn;
    }

    async _addPair() {
      let text = (this.pairEntry.text || '').trim();
      if (!text) {
        this.statusLbl.text = 'Enter a pair like SOL/USD or a ticker';
        this.statusLbl.set_style('color: #c62828; font-weight: 700;');
        return;
      }

      // Allow bare ticker
      if (!text.includes('/')) text = `${text}/USD`;

      const base = text.split('/')[0].trim();
      const key = base.toLowerCase();
      let title = (this.labelEntry.text || '').trim();
      let coingecko_id = '';
      let mint = '';
      let icon = 'generic';

      if (KNOWN_COINS[key]) {
        coingecko_id = KNOWN_COINS[key].id;
        icon = KNOWN_COINS[key].icon || 'generic';
        if (!title) title = KNOWN_COINS[key].title;
      } else if (isLikelyMint(base)) {
        this.statusLbl.text = 'Looking up mint…';
        try {
          const meta = await lookupMint(base);
          mint = base;
          if (!title) title = meta.symbol || 'TOKEN';
          coingecko_id = '';
        } catch (e) {
          this.statusLbl.text = `Lookup failed — ${String(e.message || e).slice(0, 50)}`;
          this.statusLbl.set_style('color: #c62828; font-weight: 700;');
          return;
        }
      } else {
        this.statusLbl.text = 'Looking up ticker…';
        try {
          coingecko_id = await CryptoUtil.coingecko_symbol_to_id(
            base,
            this.Me,
          );
        } catch (e) {
          console.error(e);
        }
        if (!coingecko_id) {
          this.statusLbl.text = `Could not find “${base}” — try contract address instead`;
          this.statusLbl.set_style('color: #c62828; font-weight: 700;');
          return;
        }
        if (!title) title = base.toUpperCase();
      }

      if (!title) title = base.toUpperCase();

      const id = CryptoUtil.createUUID();
      let icon_path = '';
      const iconSrc = (this.iconEntry.text || '').trim();
      if (iconSrc) {
        icon_path = installCustomIcon(this.Me.path, iconSrc, id);
        if (!icon_path) {
          this.statusLbl.text =
            'Could not load icon file — check the path (png/jpg)';
          this.statusLbl.set_style('color: #c62828; font-weight: 700;');
          // still allow add without custom icon
        }
      }

      const maxPanel = Settings.getMaxPanelCoins();
      const activeCount = Settings.getCoins().filter(c => c.active).length;
      const putOnPanel = activeCount < maxPanel;

      const coin = {
        id,
        symbol: text.toUpperCase(),
        active: putOnPanel,
        title: title.toUpperCase().slice(0, 12),
        coingecko_id,
        mint,
        icon,
        icon_path: icon_path || '',
        pinned: false,
        subtitle: coingecko_id || (mint ? shortMint(mint) : text.toUpperCase()),
        key: '',
        added_at: Date.now(),
      };

      try {
        if (Settings.addCoin(coin)) {
          this.statusLbl.text = `✓ Added ${coin.title} — use the switch in the list`;
          this.statusLbl.set_style('color: #0a7a3e; font-weight: 700;');
          this.pairEntry.text = '';
          this.labelEntry.text = '';
          this.iconEntry.text = '';
          if (this.panelMenu.onCoinAdded)
            this.panelMenu.onCoinAdded(coin.title);
          else this.panelMenu.rebuildCoins();
        } else {
          this.statusLbl.text = 'Already in watchlist';
          this.statusLbl.set_style('color: #c62828; font-weight: 700;');
        }
      } catch (e) {
        console.error(e);
        this.statusLbl.text = 'Failed to save';
        this.statusLbl.set_style('color: #c62828; font-weight: 700;');
      }
    }
  },
);
