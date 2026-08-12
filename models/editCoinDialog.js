/* Edit token dialog — label, pair, mint, icon
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as Settings from '../settings.js';
import { isLikelyMint, shortMint } from '../api/catalog.js';
import { lookupMint } from '../api/jupiter.js';
import {
  installCustomIcon,
  fetchIconForMint,
} from '../utils/icons.js';

/**
 * @param {object} panelMenu
 * @param {object} extension
 * @param {object} coinRow CoinMenuItem
 */
export function openEditCoinDialog(panelMenu, extension, coinRow) {
  const d = new EditCoinDialog(panelMenu, extension, coinRow);
  d.open();
  return d;
}

const EditCoinDialog = GObject.registerClass(
  class EditCoinDialog extends ModalDialog.ModalDialog {
    _init(panelMenu, extension, coinRow) {
      super._init({
        styleClass: 'og-options-dialog',
        destroyOnClose: true,
      });
      this._panelMenu = panelMenu;
      this._extension = extension;
      this._row = coinRow;

      const root = new St.BoxLayout({
        vertical: true,
        style_class: 'og-options-root',
        x_expand: true,
      });
      this.contentLayout.add_child(root);

      const title = new St.Label({
        text: `Edit ${coinRow.title || 'token'}`,
      });
      title.set_style(
        'font-size: 1.1em; font-weight: 800; color: #111; padding-bottom: 8px;',
      );
      root.add_child(title);

      root.add_child(this._label('Display name / ticker'));
      this._titleEntry = this._entry(coinRow.title || '');
      root.add_child(this._titleEntry);

      root.add_child(this._label('Pair (e.g. BONK/USD)'));
      this._symbolEntry = this._entry(coinRow.symbol || '');
      root.add_child(this._symbolEntry);

      root.add_child(this._label('Solana contract address (mint)'));
      this._mintEntry = this._entry(coinRow.mint || '');
      root.add_child(this._mintEntry);

      root.add_child(this._label('Icon file path (optional)'));
      this._iconEntry = this._entry(coinRow.icon_path || '');
      root.add_child(this._iconEntry);

      const btnRow = new St.BoxLayout({ vertical: false, style_class: 'og-options-row' });
      btnRow.add_child(
        this._btn('Retry / fetch mint icon', () => this._fetchIcon(), false),
      );
      root.add_child(btnRow);
      root.add_child(
        this._label(
          coinRow.mint && !coinRow.icon_path
            ? 'No custom icon yet — use Retry to fetch from this CA'
            : coinRow.icon_path
              ? 'Custom icon loaded for this token'
              : 'Optional custom icon',
        ),
      );

      this._status = new St.Label({ text: ' ' });
      this._status.set_style('color: #444; font-size: 0.8em; padding-top: 6px;');
      root.add_child(this._status);

      this.setButtons([
        {
          label: 'Delete token',
          action: () => this._delete(),
        },
        {
          label: 'Cancel',
          action: () => this.close(),
          key: Clutter.KEY_Escape,
        },
        {
          label: 'Save',
          action: () => this._save(),
          default: true,
        },
      ]);
    }

    _label(t) {
      const l = new St.Label({ text: t });
      l.set_style(
        'font-size: 0.75em; font-weight: 700; color: #555; padding: 8px 0 2px 0;',
      );
      return l;
    }

    _entry(text) {
      const e = new St.Entry({
        text: text || '',
        can_focus: true,
        x_expand: true,
        style_class: 'og-input',
      });
      e.set_style(
        'background-color: #fff; color: #111; border: 1px solid #999; border-radius: 8px; padding: 8px; min-width: 360px;',
      );
      return e;
    }

    _btn(label, cb, primary) {
      const lbl = new St.Label({ text: `  ${label}  ` });
      lbl.set_style(
        primary
          ? 'color: #04140e; font-weight: 800;'
          : 'color: #111; font-weight: 700;',
      );
      const b = new St.Button({ child: lbl, reactive: true });
      b.set_style(
        primary
          ? 'background-color: #14f195; border-radius: 8px; padding: 8px 12px; margin: 4px;'
          : 'background-color: rgba(153,69,255,0.22); border-radius: 8px; padding: 8px 12px; margin: 4px;',
      );
      b.connect('clicked', () => {
        try {
          cb();
        } catch (e) {
          console.error(e);
        }
      });
      return b;
    }

    async _fetchIcon() {
      const mint = (this._mintEntry.text || '').trim();
      if (!isLikelyMint(mint)) {
        this._status.text = 'Set a valid Solana mint to fetch its icon';
        this._status.set_style('color: #c62828; font-weight: 700;');
        return;
      }
      this._status.text = 'Fetching icon for this CA…';
      this._status.set_style('color: #333;');
      try {
        const meta = await lookupMint(mint);
        const path = await fetchIconForMint(
          this._extension.path,
          mint,
          this._row.id || 'edit',
          meta.imageUrl || '',
        );
        if (path) {
          this._iconEntry.text = path;
          this._status.text = `✓ Icon for ${shortMint(mint)} saved`;
          this._status.set_style('color: #0a7a3e; font-weight: 700;');
        } else {
          this._status.text = 'Could not fetch icon';
          this._status.set_style('color: #c62828; font-weight: 700;');
        }
      } catch (e) {
        this._status.text = String(e.message || e).slice(0, 80);
        this._status.set_style('color: #c62828; font-weight: 700;');
      }
    }

    _save() {
      const title = (this._titleEntry.text || '').trim().toUpperCase() || this._row.title;
      let symbol = (this._symbolEntry.text || '').trim().toUpperCase();
      if (symbol && !symbol.includes('/')) symbol = `${symbol}/USD`;
      if (!symbol) symbol = `${title}/USD`;

      let mint = (this._mintEntry.text || '').trim();
      if (mint && !isLikelyMint(mint)) {
        this._status.text = 'Mint address is not valid base58';
        this._status.set_style('color: #c62828; font-weight: 700;');
        return;
      }

      let icon_path = (this._iconEntry.text || '').trim();
      if (icon_path && !icon_path.startsWith('http') && !icon_path.startsWith('/')) {
        // leave as-is; install if local file exists happens below
      }
      if (
        icon_path &&
        !icon_path.startsWith('http') &&
        icon_path !== (this._row.icon_path || '')
      ) {
        const installed = installCustomIcon(
          this._extension.path,
          icon_path,
          this._row.id,
        );
        if (installed) icon_path = installed;
      }

      const ok = Settings.updateCoin({
        // identity for lookup
        id: this._row.id,
        key: this._row.key,
        mint: this._row.mint,
        coingecko_id: this._row.coingecko_id,
        symbol: this._row.symbol,
        title: this._row.title,
        // updates
        active: this._row.activeCoin,
        title,
        symbol,
        mint: mint || '',
        coingecko_id: mint ? '' : this._row.coingecko_id || '',
        icon_path: icon_path || '',
        icon: mint ? 'generic' : this._row.iconStem || 'generic',
        subtitle: mint ? shortMint(mint) : symbol,
        key: mint ? '' : this._row.key || '',
      });

      if (!ok) {
        this._status.text = 'Could not save changes';
        this._status.set_style('color: #c62828; font-weight: 700;');
        return;
      }

      this.close();
      GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
        this._panelMenu.rebuildCoins();
        if (this._panelMenu._statusRow)
          this._panelMenu._statusRow.text = `Updated ${title}`;
        try {
          this._panelMenu.menu.open();
        } catch (_e) {
          /* ignore */
        }
        return GLib.SOURCE_REMOVE;
      });
    }

    _delete() {
      const ref = {
        id: this._row.id,
        key: this._row.key,
        mint: this._row.mint,
        coingecko_id: this._row.coingecko_id,
        symbol: this._row.symbol,
        title: this._row.title,
      };
      const removed = Settings.delCoin(ref);
      this.close();
      GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
        this._panelMenu.rebuildCoins();
        if (this._panelMenu._statusRow) {
          this._panelMenu._statusRow.text = removed
            ? `Removed ${ref.title}`
            : `Could not remove ${ref.title}`;
        }
        try {
          this._panelMenu.menu.open();
        } catch (_e) {
          /* ignore */
        }
        return GLib.SOURCE_REMOVE;
      });
    }
  },
);
