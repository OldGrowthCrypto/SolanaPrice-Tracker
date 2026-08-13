/* Add Token modal — pair + Solana contract only
 * SPDX-License-Identifier: MIT
 */

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';

import * as Settings from '../settings.js';
import * as CryptoUtil from '../utils/cryptoUtil.js';
import { isLikelyMint, shortMint } from '../api/catalog.js';
import { KNOWN_COINS } from '../api/coingecko.js';
import { lookupMint } from '../api/jupiter.js';
import { formatPrice, formatChange } from '../utils/format.js';
import {
  installCustomIcon,
  fetchAndInstallIcon,
  fetchIconForMint,
} from '../utils/icons.js';
import {
  dialogTitle,
  heading,
  hint,
  entry,
  button,
} from './dialogWidgets.js';

/**
 * Open the Add Token modal.
 * @param {object} panelMenu
 * @param {object} extension
 */
export function openAddTokenDialog(panelMenu, extension) {
  const dialog = new AddTokenDialog(panelMenu, extension);
  dialog.open();
  return dialog;
}

const AddTokenDialog = GObject.registerClass(
  class AddTokenDialog extends ModalDialog.ModalDialog {
    _init(panelMenu, extension) {
      super._init({
        styleClass: 'og-options-dialog',
        destroyOnClose: true,
      });

      this._panelMenu = panelMenu;
      this._extension = extension;
      this._previewMeta = null;
      this._previewTimer = 0;

      const root = new St.BoxLayout({
        vertical: true,
        style_class: 'og-options-root',
        x_expand: true,
      });
      this.contentLayout.add_child(root);

      root.add_child(dialogTitle('Add token'));
      root.add_child(
        hint('Add a trading pair/ticker or paste a Solana contract address.'),
      );

      // —— Add by pair ——
      root.add_child(heading('ADD BY PAIR'));
      root.add_child(
        hint('Examples: SOL/USD, BONK, JUP — optional label and icon path'),
      );

      this._pairEntry = entry('Pair or ticker (e.g. BONK/USD)…');
      root.add_child(this._pairEntry);

      const pairRow = new St.BoxLayout({
        vertical: false,
        style_class: 'og-options-row',
        x_expand: true,
      });
      this._pairLabel = entry('Label', false);
      this._pairIcon = entry('Icon path (optional)…', true);
      pairRow.add_child(this._pairLabel);
      pairRow.add_child(this._pairIcon);
      root.add_child(pairRow);

      const pairBtns = new St.BoxLayout({
        vertical: false,
        style_class: 'og-options-row',
      });
      pairBtns.add_child(button('Add pair', () => this._addPair(), true));
      root.add_child(pairBtns);
      this._pairStatus = hint('');
      root.add_child(this._pairStatus);

      // —— Add by contract ——
      root.add_child(heading('ADD BY CONTRACT (CA)'));
      root.add_child(
        hint(
          'Paste a Solana mint — preview shows name, symbol, price & 24h before you add.',
        ),
      );

      this._mintEntry = entry('Solana contract / mint address…');
      root.add_child(this._mintEntry);
      this._mintPreview = hint('Mint preview will appear here…');
      this._mintPreview.add_style_class_name('og-mint-preview');
      root.add_child(this._mintPreview);
      this._mintEntry.clutter_text.connect('text-changed', () =>
        this._scheduleMintPreview(),
      );

      const mintRow = new St.BoxLayout({
        vertical: false,
        style_class: 'og-options-row',
        x_expand: true,
      });
      this._mintLabel = entry('Label (optional)', false);
      this._mintIcon = entry('Icon file path (optional)…', true);
      mintRow.add_child(this._mintLabel);
      mintRow.add_child(this._mintIcon);
      root.add_child(mintRow);

      const mintBtns = new St.BoxLayout({
        vertical: false,
        style_class: 'og-options-row',
      });
      mintBtns.add_child(button('Fetch icon', () => this._fetchMintIcon()));
      mintBtns.add_child(
        button('Add contract', () => this._addMint(), true),
      );
      root.add_child(mintBtns);

      this._mintStatus = hint('');
      root.add_child(this._mintStatus);

      this.setButtons([
        {
          label: 'Close',
          action: () => this.close(),
          key: Clutter.KEY_Escape,
          default: true,
        },
      ]);
    }

    _scheduleMintPreview() {
      if (this._previewTimer) {
        GLib.source_remove(this._previewTimer);
        this._previewTimer = 0;
      }
      this._previewTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 450, () => {
        this._previewTimer = 0;
        this._runMintPreview();
        return GLib.SOURCE_REMOVE;
      });
    }

    async _runMintPreview() {
      const mint = (this._mintEntry.text || '').trim();
      this._previewMeta = null;
      if (!mint) {
        this._mintPreview.text = 'Mint preview will appear here…';
        return;
      }
      if (!isLikelyMint(mint)) {
        this._mintPreview.text =
          'Invalid mint — need base58, 32–44 chars (no 0/O/I/l)';
        this._mintPreview.set_style('color: #c62828; font-weight: 700;');
        return;
      }
      this._mintPreview.text = 'Looking up mint…';
      this._mintPreview.set_style('color: inherit; opacity: 0.85;');
      try {
        const meta = await lookupMint(mint);
        if ((this._mintEntry.text || '').trim() !== mint) return;
        this._previewMeta = meta;
        const ch = formatChange(meta.change24h);
        const price =
          meta.price != null ? `$${formatPrice(meta.price)}` : 'price n/a';
        this._mintPreview.text = `${meta.symbol} · ${meta.name} · ${price} · 24h ${ch.text}`;
        this._mintPreview.set_style('color: #0a7a3e; font-weight: 700;');
        if (!this._mintLabel.text) this._mintLabel.text = meta.symbol || '';
      } catch (e) {
        this._mintPreview.text = `Preview failed — ${String(e.message || e).slice(0, 50)}`;
        this._mintPreview.set_style('color: #c62828; font-weight: 700;');
      }
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

      const iconSrc = (this._mintIcon.text || '').trim();
      if (iconSrc && !iconSrc.startsWith('http')) {
        icon_path = installCustomIcon(this._extension.path, iconSrc, id) || '';
      }
      if (!icon_path) {
        icon_path =
          (await fetchIconForMint(
            this._extension.path,
            mint,
            id,
            meta.imageUrl || (iconSrc.startsWith('http') ? iconSrc : ''),
          )) || '';
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
        order: 0,
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
        this._previewMeta = null;
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

      const maxPanel = Settings.getMaxPanelCoins();
      const activeCount = Settings.getCoins().filter(c => c.active).length;
      const putOnPanel = activeCount < maxPanel;

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
        order: 0,
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
