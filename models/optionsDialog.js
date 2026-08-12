/* Full-screen modal Options dialog — not a nested popdown.
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as Settings from '../settings.js';
import * as CryptoUtil from '../utils/cryptoUtil.js';
import {
  isLikelyMint,
  shortMint,
  MAX_PANEL_COINS,
} from '../api/catalog.js';
import { KNOWN_COINS } from '../api/coingecko.js';
import { lookupMint } from '../api/jupiter.js';
import {
  installCustomIcon,
  fetchAndInstallIcon,
  fetchIconForMint,
} from '../utils/icons.js';

/**
 * Open the full Options modal.
 * @param {object} panelMenu Indicator instance
 * @param {object} extension Extension instance
 */
export function openOptionsDialog(panelMenu, extension) {
  const dialog = new OptionsDialog(panelMenu, extension);
  dialog.open();
  return dialog;
}

const OptionsDialog = GObject.registerClass(
  class OptionsDialog extends ModalDialog.ModalDialog {
    _init(panelMenu, extension) {
      super._init({
        styleClass: 'og-options-dialog',
        destroyOnClose: true,
      });

      this._panelMenu = panelMenu;
      this._extension = extension;

      const root = new St.BoxLayout({
        vertical: true,
        style_class: 'og-options-root',
        x_expand: true,
      });
      this.contentLayout.add_child(root);

      // Title — matches menu button label
      const title = new St.Label({
        text: 'Options / Add token',
        style_class: 'og-options-title',
      });
      title.set_style(
        'font-size: 1.15em; font-weight: 800; color: #111111; padding-bottom: 4px;',
      );
      root.add_child(title);
      root.add_child(
        this._hint('Display settings, then add a pair or Solana contract.'),
      );

      // —— Display toggles ——
      root.add_child(this._heading('1 · DISPLAY'));

      this._iconsSwitch = this._switchRow(
        'Show icons on top bar',
        Settings.getShowIcons(),
        state => {
          Settings.setShowIcons(state);
          this._panelMenu._updatePanelLabel(true);
        },
      );
      root.add_child(this._iconsSwitch.row);

      this._tickersSwitch = this._switchRow(
        'Show ticker names (BTC, SOL…)',
        Settings.getShowTickers(),
        state => {
          Settings.setShowTickers(state);
          this._panelMenu._updatePanelLabel(true);
        },
      );
      root.add_child(this._tickersSwitch.row);

      this._colorSwitch = this._switchRow(
        'Color prices green/red (else white)',
        Settings.getColorizePrices(),
        state => {
          Settings.setColorizePrices(state);
          this._panelMenu._updatePanelLabel(true);
        },
      );
      root.add_child(this._colorSwitch.row);

      this._compactSwitch = this._switchRow(
        'Auto-compact bar with 4+ coins (hide tickers)',
        Settings.getAutoCompact ? Settings.getAutoCompact() : true,
        state => {
          if (Settings.setAutoCompact) Settings.setAutoCompact(state);
          this._panelMenu._updatePanelLabel(true);
        },
      );
      root.add_child(this._compactSwitch.row);

      // —— Add by pair (primary) ——
      root.add_child(this._heading('2 · ADD BY PAIR'));
      root.add_child(
        this._hint('Examples: SOL/USD, BONK, JUP — optional icon path'),
      );

      this._pairEntry = this._entry('Pair or ticker (e.g. BONK/USD)…');
      root.add_child(this._pairEntry);

      const pairRow = new St.BoxLayout({
        vertical: false,
        style_class: 'og-options-row',
        x_expand: true,
      });
      this._pairLabel = this._entry('Label', false);
      this._pairIcon = this._entry('Icon path (optional)…', true);
      pairRow.add_child(this._pairLabel);
      pairRow.add_child(this._pairIcon);
      root.add_child(pairRow);

      const pairBtns = new St.BoxLayout({
        vertical: false,
        style_class: 'og-options-row',
      });
      pairBtns.add_child(
        this._button('Add pair', () => this._addPair(), true),
      );
      root.add_child(pairBtns);
      this._pairStatus = this._hint('');
      root.add_child(this._pairStatus);

      // —— Add by contract ——
      root.add_child(this._heading('3 · ADD BY CONTRACT (CA)'));
      root.add_child(
        this._hint(
          'Paste Solana mint. Fetch icon uses this CA (not ticker name).',
        ),
      );

      this._mintEntry = this._entry('Solana contract / mint address…');
      root.add_child(this._mintEntry);

      const mintRow = new St.BoxLayout({
        vertical: false,
        style_class: 'og-options-row',
        x_expand: true,
      });
      this._mintLabel = this._entry('Label (optional)', false);
      this._mintIcon = this._entry('Icon file path (optional)…', true);
      mintRow.add_child(this._mintLabel);
      mintRow.add_child(this._mintIcon);
      root.add_child(mintRow);

      const mintBtns = new St.BoxLayout({
        vertical: false,
        style_class: 'og-options-row',
      });
      mintBtns.add_child(
        this._button('Fetch icon', () => this._fetchMintIcon()),
      );
      mintBtns.add_child(
        this._button('Add contract', () => this._addMint(), true),
      );
      root.add_child(mintBtns);

      this._mintStatus = this._hint('');
      root.add_child(this._mintStatus);

      // —— Footer actions ——
      this.setButtons([
        {
          label: 'Settings window',
          action: () => {
            try {
              this._extension.openPreferences();
            } catch (_e) {
              Main.notify(
                'Solana Crypto Price Tracker',
                'Open Extensions app → Settings',
              );
            }
          },
        },
        {
          label: 'Close',
          action: () => this.close(),
          key: Clutter.KEY_Escape,
          default: true,
        },
      ]);
    }

    _heading(text) {
      const l = new St.Label({
        text,
        style_class: 'og-options-heading',
      });
      l.set_style(
        'font-size: 0.72em; font-weight: 800; letter-spacing: 0.1em; color: #444; padding: 12px 0 4px 0;',
      );
      return l;
    }

    _hint(text) {
      const l = new St.Label({
        text: text || ' ',
        style_class: 'og-options-hint',
      });
      l.set_style('font-size: 0.8em; color: #444; padding: 2px 0 6px 0;');
      l.clutter_text.line_wrap = true;
      return l;
    }

    _entry(hint, expand = true) {
      const e = new St.Entry({
        hint_text: hint,
        can_focus: true,
        x_expand: expand,
        style_class: 'og-input',
        track_hover: true,
      });
      e.set_style(
        'background-color: #ffffff; color: #111111; border: 1px solid #999; border-radius: 8px; padding: 8px 10px; min-width: 160px; margin: 2px;',
      );
      return e;
    }

    _button(label, cb, primary = false) {
      const lbl = new St.Label({
        text: `  ${label}  `,
        y_align: 2,
      });
      lbl.set_style(
        primary
          ? 'color: #04140e; font-weight: 800;'
          : 'color: #111; font-weight: 700;',
      );
      const btn = new St.Button({
        child: lbl,
        reactive: true,
        can_focus: true,
        style_class: primary ? 'og-add-btn' : 'og-icon-btn',
      });
      btn.set_style(
        primary
          ? 'background-color: #14f195; border-radius: 8px; padding: 8px 14px; margin: 4px;'
          : 'background-color: rgba(153,69,255,0.2); border-radius: 8px; padding: 8px 14px; margin: 4px;',
      );
      btn.connect('clicked', () => {
        try {
          cb();
        } catch (e) {
          console.error(e);
        }
      });
      return btn;
    }

    _switchRow(label, initial, onToggle) {
      const row = new St.BoxLayout({
        vertical: false,
        x_expand: true,
        style_class: 'og-options-switch-row',
      });
      const lbl = new St.Label({
        text: label,
        x_expand: true,
        y_align: 2,
      });
      lbl.set_style('color: #111; font-weight: 600; padding: 6px 0;');
      row.add_child(lbl);

      // Simple toggle button (ModalDialog has no PopupMenu.Switch reliably styled)
      let state = !!initial;
      const tLbl = new St.Label({
        text: state ? ' ON ' : ' OFF ',
        y_align: 2,
      });
      tLbl.set_style(
        state
          ? 'color: #04140e; font-weight: 800;'
          : 'color: #fff; font-weight: 800;',
      );
      const tBtn = new St.Button({
        child: tLbl,
        reactive: true,
        style_class: 'og-toggle-btn',
      });
      const paint = () => {
        tLbl.text = state ? ' ON ' : ' OFF ';
        tBtn.set_style(
          state
            ? 'background-color: #14f195; border-radius: 999px; padding: 4px 10px;'
            : 'background-color: #888; border-radius: 999px; padding: 4px 10px;',
        );
        tLbl.set_style(
          state
            ? 'color: #04140e; font-weight: 800;'
            : 'color: #fff; font-weight: 800;',
        );
      };
      paint();
      tBtn.connect('clicked', () => {
        state = !state;
        paint();
        onToggle(state);
      });
      row.add_child(tBtn);
      return { row, getState: () => state };
    }

    async _fetchMintIcon() {
      const mint = (this._mintEntry.text || '').trim();
      if (!isLikelyMint(mint)) {
        this._mintStatus.text = 'Enter a valid mint first to fetch its icon';
        this._mintStatus.set_style('color: #c62828; font-weight: 700;');
        return;
      }
      this._mintStatus.text = 'Fetching icon for this CA (mint)…';
      this._mintStatus.set_style('color: #333;');
      try {
        const meta = await lookupMint(mint);
        if (!this._mintLabel.text) this._mintLabel.text = meta.symbol || '';
        // Icon is always resolved from the mint CA, never ticker name (e.g. ADA→Cardano)
        const tempId = `tmp-${mint.slice(0, 12)}`;
        const path = await fetchIconForMint(
          this._extension.path,
          mint,
          tempId,
          meta.imageUrl || '',
        );
        if (path) {
          this._mintIcon.text = path;
          this._mintStatus.text = `✓ Mint icon saved for ${mint.slice(0, 4)}…${mint.slice(-4)}`;
          this._mintStatus.set_style('color: #0a7a3e; font-weight: 700;');
        } else {
          this._mintStatus.text =
            'Could not download mint icon — paste a file path instead';
          this._mintStatus.set_style('color: #c62828; font-weight: 700;');
        }
      } catch (e) {
        console.error(e);
        this._mintStatus.text = `Fetch failed — ${String(e.message || e).slice(0, 60)}`;
        this._mintStatus.set_style('color: #c62828; font-weight: 700;');
      }
    }

    async _addMint() {
      const mint = (this._mintEntry.text || '').trim();
      if (!isLikelyMint(mint)) {
        this._mintStatus.text =
          'Enter a valid Solana mint (base58, ~32–44 characters)';
        this._mintStatus.set_style('color: #c62828; font-weight: 700;');
        return;
      }

      this._mintStatus.text = 'Looking up contract…';
      this._mintStatus.set_style('color: #333;');

      let meta;
      try {
        meta = await lookupMint(mint);
      } catch (e) {
        this._mintStatus.text = `Lookup failed — ${String(e.message || e).slice(0, 60)}`;
        this._mintStatus.set_style('color: #c62828; font-weight: 700;');
        return;
      }

      let title = (this._mintLabel.text || '').trim();
      if (!title) title = meta.symbol || 'TOKEN';

      const id = CryptoUtil.createUUID();
      let icon_path = '';

      // 1) Local file path if user provided one
      const iconSrc = (this._mintIcon.text || '').trim();
      if (iconSrc && !iconSrc.startsWith('http')) {
        icon_path = installCustomIcon(this._extension.path, iconSrc, id) || '';
      }
      // 2) Always try mint-CA icon sources (DexScreener keyed by this mint)
      if (!icon_path) {
        icon_path =
          (await fetchIconForMint(
            this._extension.path,
            mint,
            id,
            meta.imageUrl || (iconSrc.startsWith('http') ? iconSrc : ''),
          )) || '';
      }

      const activeCount = Settings.getCoins().filter(c => c.active).length;
      const putOnPanel = activeCount < MAX_PANEL_COINS;

      // Never set icon to ticker stem (e.g. "ada") — mint tokens use icon_path only
      const coin = {
        id,
        symbol: `${(meta.symbol || title).toUpperCase()}/USD`,
        active: putOnPanel,
        title: title.toUpperCase().slice(0, 12),
        coingecko_id: '', // do not map Solana CA → coingecko L1 (Cardano etc.)
        mint,
        icon: 'generic',
        icon_path,
        pinned: false,
        subtitle: meta.name || shortMint(mint),
        key: '',
        added_at: Date.now(),
      };

      const ok = Settings.addCoin(coin);
      if (ok) {
        this._mintStatus.text = putOnPanel
          ? `✓ Added ${coin.title} — on top bar (toggle in list anytime)`
          : `✓ Added ${coin.title} — toggle it on in the list (panel full)`;
        this._mintStatus.set_style('color: #0a7a3e; font-weight: 700;');
        this._mintEntry.text = '';
        this._mintLabel.text = '';
        this._mintIcon.text = '';
        // Close modal and open dropdown so the new row is visible + toggleable
        this.close();
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
          try {
            this._panelMenu.onCoinAdded(coin.title);
          } catch (_e) {
            this._panelMenu.rebuildCoins();
          }
          return GLib.SOURCE_REMOVE;
        });
      } else {
        this._mintStatus.text = 'Already in watchlist';
        this._mintStatus.set_style('color: #c62828; font-weight: 700;');
      }
    }

    async _addPair() {
      let text = (this._pairEntry.text || '').trim();
      if (!text) {
        this._pairStatus.text = 'Enter a pair like SOL/USD or a ticker';
        this._pairStatus.set_style('color: #c62828; font-weight: 700;');
        return;
      }
      if (!text.includes('/')) text = `${text}/USD`;

      const base = text.split('/')[0].trim();
      const key = base.toLowerCase();
      let title = (this._pairLabel.text || '').trim();
      let coingecko_id = '';
      let mint = '';
      let icon = 'generic';
      let imageUrl = '';

      this._pairStatus.text = 'Looking up…';
      this._pairStatus.set_style('color: #333;');

      if (KNOWN_COINS[key]) {
        coingecko_id = KNOWN_COINS[key].id;
        icon = KNOWN_COINS[key].icon || 'generic';
        if (!title) title = KNOWN_COINS[key].title;
      } else if (isLikelyMint(base)) {
        try {
          const meta = await lookupMint(base);
          mint = base;
          if (!title) title = meta.symbol || 'TOKEN';
          imageUrl = meta.imageUrl || '';
        } catch (e) {
          this._pairStatus.text = `Mint lookup failed — ${String(e.message || e).slice(0, 50)}`;
          this._pairStatus.set_style('color: #c62828; font-weight: 700;');
          return;
        }
      } else {
        try {
          coingecko_id = await CryptoUtil.coingecko_symbol_to_id(
            base,
            this._extension,
          );
        } catch (e) {
          console.error(e);
        }
        if (!coingecko_id) {
          this._pairStatus.text = `Could not find “${base}” — try a contract address`;
          this._pairStatus.set_style('color: #c62828; font-weight: 700;');
          return;
        }
        if (!title) title = base.toUpperCase();
      }

      if (!title) title = base.toUpperCase();
      const id = CryptoUtil.createUUID();
      let icon_path = '';

      const iconSrc = (this._pairIcon.text || '').trim();
      if (iconSrc && !iconSrc.startsWith('http')) {
        icon_path = installCustomIcon(this._extension.path, iconSrc, id) || '';
      }
      // If this is a Solana mint, always resolve icon from that CA
      if (!icon_path && mint) {
        icon_path =
          (await fetchIconForMint(
            this._extension.path,
            mint,
            id,
            imageUrl || (iconSrc.startsWith('http') ? iconSrc : ''),
          )) || '';
      } else if (!icon_path && imageUrl) {
        icon_path =
          (await fetchAndInstallIcon(
            this._extension.path,
            imageUrl,
            id,
            mint,
          )) || '';
      } else if (!icon_path && iconSrc.startsWith('http')) {
        icon_path =
          (await fetchAndInstallIcon(
            this._extension.path,
            iconSrc,
            id,
            mint,
          )) || '';
      }

      const activeCount = Settings.getCoins().filter(c => c.active).length;
      const putOnPanel = activeCount < MAX_PANEL_COINS;

      // If we have a mint, force generic stem so title "ADA" never loads Cardano art
      const coin = {
        id,
        symbol: text.toUpperCase(),
        active: putOnPanel,
        title: title.toUpperCase().slice(0, 12),
        coingecko_id: mint ? '' : coingecko_id,
        mint,
        icon: mint ? 'generic' : icon,
        icon_path,
        pinned: false,
        subtitle: coingecko_id || (mint ? shortMint(mint) : text.toUpperCase()),
        key: mint ? '' : key && KNOWN_COINS[key] ? key : '',
        added_at: Date.now(),
      };

      if (Settings.addCoin(coin)) {
        this._pairStatus.text = putOnPanel
          ? `✓ Added ${coin.title} — on top bar (toggle in list anytime)`
          : `✓ Added ${coin.title} — toggle it on in the list (panel full)`;
        this._pairStatus.set_style('color: #0a7a3e; font-weight: 700;');
        this._pairEntry.text = '';
        this._pairLabel.text = '';
        this._pairIcon.text = '';
        this.close();
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
          try {
            this._panelMenu.onCoinAdded(coin.title);
          } catch (_e) {
            this._panelMenu.rebuildCoins();
          }
          return GLib.SOURCE_REMOVE;
        });
      } else {
        this._pairStatus.text = 'Already in watchlist';
        this._pairStatus.set_style('color: #c62828; font-weight: 700;');
      }
    }
  },
);
