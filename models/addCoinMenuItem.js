import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as CryptoUtil from '../utils/cryptoUtil.js';
import * as Settings from '../settings.js';
import {
  isLikelyMint,
  shortMint,
} from '../api/catalog.js';
import { lookupMint } from '../api/jupiter.js';
import { installCustomIcon } from '../utils/icons.js';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

/**
 * Add-by-contract form (Options → Add by contract address).
 */
export const AddCoinMenuItem = GObject.registerClass(
  class AddCoinMenuItem extends PopupMenu.PopupBaseMenuItem {
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

      const hint = new St.Label({
        text: 'Paste Solana mint, optional label + icon file path',
        style_class: 'og-hint',
      });
      hint.set_style('color: #333333;');
      vbox.add_child(hint);

      const hbox = new St.BoxLayout({
        x_expand: true,
        style_class: 'og-add-row',
        y_align: Clutter.ActorAlign.CENTER,
      });
      vbox.add_child(hbox);

      this.mintEntry = new St.Entry({
        name: 'mint',
        hint_text: 'Solana contract address…',
        can_focus: true,
        x_expand: true,
        style_class: 'og-input',
        track_hover: true,
      });
      this.mintEntry.set_style(
        'background-color: #ffffff; color: #111111; border: 1px solid #999; padding: 8px; min-width: 200px;',
      );
      hbox.add_child(this.mintEntry);

      this.coinTitle = new St.Entry({
        name: 'title',
        hint_text: 'Label',
        can_focus: true,
        style_class: 'og-input og-input-sm',
        track_hover: true,
      });
      this.coinTitle.set_style(
        'background-color: #ffffff; color: #111111; border: 1px solid #999; padding: 8px; width: 70px;',
      );
      hbox.add_child(this.coinTitle);

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
      addBtn.connect('clicked', () => this._addMint());
      hbox.add_child(addBtn);

      this.iconEntry = new St.Entry({
        name: 'icon',
        hint_text: 'Optional icon path (png/jpg)…',
        can_focus: true,
        x_expand: true,
        style_class: 'og-input',
        track_hover: true,
      });
      this.iconEntry.set_style(
        'background-color: #ffffff; color: #111111; border: 1px solid #999; padding: 8px;',
      );
      vbox.add_child(this.iconEntry);

      this.mintEntry.clutter_text.connect('activate', () => this._addMint());

      this.statusLbl = new St.Label({
        text: '',
        style_class: 'og-hint',
      });
      this.statusLbl.set_style('color: #444444; font-size: 0.72em;');
      vbox.add_child(this.statusLbl);
    }

    async _addMint() {
      const mint = (this.mintEntry.text || '').trim();
      if (!isLikelyMint(mint)) {
        this.statusLbl.text =
          'Enter a valid Solana mint (base58, about 32–44 characters)';
        this.statusLbl.set_style('color: #c62828; font-weight: 700;');
        return;
      }

      this.statusLbl.text = 'Looking up contract on Solana…';
      this.statusLbl.set_style('color: #333333;');
      let meta;
      try {
        meta = await lookupMint(mint);
      } catch (e) {
        console.error(e);
        this.statusLbl.text = `Could not resolve mint — ${String(e.message || e).slice(0, 60)}`;
        this.statusLbl.set_style('color: #c62828; font-weight: 700;');
        return;
      }

      let title = (this.coinTitle.text || '').trim();
      if (!title) title = meta.symbol || 'TOKEN';

      const id = CryptoUtil.createUUID();
      let icon_path = '';
      const iconSrc = (this.iconEntry.text || '').trim();
      if (iconSrc) {
        icon_path = installCustomIcon(this.Me.path, iconSrc, id) || '';
      }

      const maxPanel = Settings.getMaxPanelCoins();
      const activeCount = Settings.getCoins().filter(c => c.active).length;
      const putOnPanel = activeCount < maxPanel;

      const coin = {
        id,
        symbol: `${(meta.symbol || title).toUpperCase()}/USD`,
        active: putOnPanel,
        title: title.toUpperCase().slice(0, 12),
        coingecko_id: '',
        mint,
        icon: 'generic',
        icon_path,
        pinned: false,
        subtitle: meta.name || shortMint(mint),
        key: '',
        added_at: Date.now(),
      };

      try {
        const result = Settings.addCoin(coin);
        if (result) {
          this.statusLbl.text = putOnPanel
            ? `✓ Added ${coin.title} — toggle on/off in the list`
            : `✓ Added ${coin.title} — toggle it on in the list`;
          this.statusLbl.set_style('color: #0a7a3e; font-weight: 700;');
          this.mintEntry.text = '';
          this.coinTitle.text = '';
          this.iconEntry.text = '';
          if (this.panelMenu.onCoinAdded)
            this.panelMenu.onCoinAdded(coin.title);
          else this.panelMenu.rebuildCoins();
        } else {
          this.statusLbl.text = 'Already in your watchlist';
          this.statusLbl.set_style('color: #c62828; font-weight: 700;');
        }
      } catch (error) {
        console.error(error);
        this.statusLbl.text = 'Failed to save token';
        this.statusLbl.set_style('color: #c62828; font-weight: 700;');
      }
    }
  },
);
