/* Compact Options modal — top bar, refresh, chart, watchlist
 * Per-coin alerts: bell icon on each coin row.
 * SPDX-License-Identifier: MIT
 */

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';

import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as Settings from '../settings.js';
import {
  dialogTitle,
  heading,
  hint,
  entry,
  button,
  switchRow,
  chipRow,
} from './dialogWidgets.js';

const C = { compact: true };

/**
 * @param {object} panelMenu
 * @param {object} extension
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
        styleClass: 'og-options-dialog og-options-dialog-compact',
        destroyOnClose: true,
      });

      this._panelMenu = panelMenu;
      this._extension = extension;
      this._chipButtons = { max: [], refresh: [], chart: [] };

      const root = new St.BoxLayout({
        vertical: true,
        style_class: 'og-options-root og-options-root-compact',
        x_expand: true,
      });
      this.contentLayout.add_child(root);

      // Title + one-line subtitle
      root.add_child(dialogTitle('Options', C));
      root.add_child(
        hint('Alerts per coin → 🔔 on each row', C),
      );

      // —— Top bar switches (tight) ——
      root.add_child(heading('TOP BAR', C));

      root.add_child(
        switchRow('Icons', Settings.getShowIcons(), state => {
          Settings.setShowIcons(state);
          this._panelMenu._updatePanelLabel(true);
        }, C).row,
      );
      root.add_child(
        switchRow('Tickers', Settings.getShowTickers(), state => {
          Settings.setShowTickers(state);
          this._panelMenu._updatePanelLabel(true);
        }, C).row,
      );
      root.add_child(
        switchRow('Colorize prices', Settings.getColorizePrices(), state => {
          Settings.setColorizePrices(state);
          this._panelMenu._updatePanelLabel(true);
        }, C).row,
      );

      // Max on bar as chips
      const maxLabel = hint('Max on bar', C);
      root.add_child(maxLabel);
      const maxRow = chipRow();
      this._maxVal = Settings.getMaxPanelCoins();
      for (const n of [3, 4, 5, 6, 8]) {
        const b = button(
          String(n),
          () => {
            Settings.setMaxPanelCoins(n);
            this._maxVal = n;
            this._panelMenu._updatePanelLabel(true);
            if (this._panelMenu._refreshStatusText)
              this._panelMenu._refreshStatusText();
            this._paintChips();
            this._syncStatus();
          },
          false,
          { compact: true, selected: n === this._maxVal },
        );
        this._chipButtons.max.push({ n, b });
        maxRow.add_child(b);
      }
      root.add_child(maxRow);

      // —— Refresh ——
      root.add_child(heading('REFRESH', C));
      const refRow = chipRow();
      this._refVal = Settings.getRefreshInterval();
      for (const sec of [20, 30, 45, 60, 90]) {
        const b = button(
          `${sec}s`,
          () => {
            Settings.setRefreshInterval(sec);
            this._refVal = sec;
            if (this._panelMenu._startRefreshLoop)
              this._panelMenu._startRefreshLoop();
            this._paintChips();
            this._syncStatus();
          },
          false,
          { compact: true, selected: sec === this._refVal },
        );
        this._chipButtons.refresh.push({ sec, b });
        refRow.add_child(b);
      }
      refRow.add_child(
        button(
          'Now',
          () => {
            if (this._panelMenu.refreshPrices)
              this._panelMenu.refreshPrices(true);
          },
          true,
          C,
        ),
      );
      root.add_child(refRow);

      // —— Chart ——
      root.add_child(heading('CHART', C));
      const chartRow = chipRow();
      this._chartVal = Settings.getDefaultChartProvider();
      for (const p of [
        { id: 'dexscreener', label: 'Dex' },
        { id: 'birdeye', label: 'Birdeye' },
        { id: 'jupiter', label: 'Jup' },
      ]) {
        const b = button(
          p.label,
          () => {
            Settings.setDefaultChartProvider(p.id);
            this._chartVal = p.id;
            this._paintChips();
            this._syncStatus();
          },
          false,
          { compact: true, selected: p.id === this._chartVal },
        );
        this._chipButtons.chart.push({ id: p.id, b });
        chartRow.add_child(b);
      }
      root.add_child(chartRow);

      // —— Status strip ——
      this._statusLine = hint('', C);
      root.add_child(this._statusLine);
      this._syncStatus();

      // —— Watchlist tools (one tight row + path) ——
      root.add_child(heading('WATCHLIST', C));
      const ioRow = chipRow();
      ioRow.add_child(button('Export', () => this._exportWatchlist(), false, C));
      ioRow.add_child(button('Import', () => this._importWatchlist(), false, C));
      ioRow.add_child(
        button('Reset', () => this._resetDefaults(), false, C),
      );
      ioRow.add_child(
        button(
          'Debug',
          () => {
            const on = !(Settings.getDebugLogging && Settings.getDebugLogging());
            if (Settings.setDebugLoggingFlag) Settings.setDebugLoggingFlag(on);
            this._syncStatus();
          },
          false,
          C,
        ),
      );
      root.add_child(ioRow);

      this._ioPath = entry('~/solana-price-tracker-watchlist.json', true, C);
      root.add_child(this._ioPath);
      this._ioStatus = hint(' ', C);
      root.add_child(this._ioStatus);

      this.setButtons([
        {
          label: 'Settings',
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

    _paintChips() {
      // Rebuild visual selected state by recreating styles on known buttons
      for (const { n, b } of this._chipButtons.max) {
        const on = n === this._maxVal;
        b.set_style(
          on
            ? 'background-color: rgba(20,241,149,0.45); border-radius: 6px; padding: 4px 8px; margin: 1px;'
            : 'background-color: rgba(153,69,255,0.18); border-radius: 6px; padding: 4px 8px; margin: 1px;',
        );
      }
      for (const { sec, b } of this._chipButtons.refresh) {
        const on = sec === this._refVal;
        b.set_style(
          on
            ? 'background-color: rgba(20,241,149,0.45); border-radius: 6px; padding: 4px 8px; margin: 1px;'
            : 'background-color: rgba(153,69,255,0.18); border-radius: 6px; padding: 4px 8px; margin: 1px;',
        );
      }
      for (const { id, b } of this._chipButtons.chart) {
        const on = id === this._chartVal;
        b.set_style(
          on
            ? 'background-color: rgba(20,241,149,0.45); border-radius: 6px; padding: 4px 8px; margin: 1px;'
            : 'background-color: rgba(153,69,255,0.18); border-radius: 6px; padding: 4px 8px; margin: 1px;',
        );
      }
    }

    _syncStatus() {
      const chart =
        {
          dexscreener: 'DexScreener',
          birdeye: 'Birdeye',
          jupiter: 'Jupiter',
        }[this._chartVal] || this._chartVal;
      const dbg =
        Settings.getDebugLogging && Settings.getDebugLogging() ? ' · debug' : '';
      this._statusLine.text = `Bar max ${this._maxVal} · every ${this._refVal}s · chart ${chart}${dbg}`;
    }

    _resetDefaults() {
      try {
        Settings.resetToDefaults();
        this._ioStatus.text = '✓ Defaults restored';
        this._ioStatus.set_style('color: #0a7a3e; font-weight: 700; font-size: 0.7em;');
        this.close();
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
          try {
            this._panelMenu.onListChanged('Defaults restored');
          } catch (_e) {
            this._panelMenu.rebuildCoins();
          }
          return GLib.SOURCE_REMOVE;
        });
      } catch (e) {
        this._ioStatus.text = `Reset failed — ${String(e.message || e).slice(0, 40)}`;
        this._ioStatus.set_style('color: #c62828; font-weight: 700; font-size: 0.7em;');
      }
    }

    _exportWatchlist() {
      try {
        const json = Settings.exportWatchlistJson();
        let path = (this._ioPath.text || '').trim();
        if (!path)
          path = `${GLib.get_home_dir()}/solana-price-tracker-watchlist.json`;
        if (path.startsWith('~/')) path = GLib.get_home_dir() + path.slice(1);
        const file = Gio.File.new_for_path(path);
        const bytes = new TextEncoder().encode(json);
        file.replace_contents(
          bytes,
          null,
          false,
          Gio.FileCreateFlags.REPLACE_DESTINATION,
          null,
        );
        this._ioPath.text = path;
        this._ioStatus.text = `✓ Exported ${Settings.getCoins().length} coins`;
        this._ioStatus.set_style('color: #0a7a3e; font-weight: 700; font-size: 0.7em;');
      } catch (e) {
        this._ioStatus.text = `Export failed — ${String(e.message || e).slice(0, 40)}`;
        this._ioStatus.set_style('color: #c62828; font-weight: 700; font-size: 0.7em;');
      }
    }

    _importWatchlist() {
      try {
        let path = (this._ioPath.text || '').trim();
        if (!path) {
          this._ioStatus.text = 'Set a JSON path first';
          this._ioStatus.set_style('color: #c62828; font-weight: 700; font-size: 0.7em;');
          return;
        }
        if (path.startsWith('~/')) path = GLib.get_home_dir() + path.slice(1);
        const file = Gio.File.new_for_path(path);
        const [, contents] = file.load_contents(null);
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(contents);
        const result = Settings.importWatchlistJson(text);
        if (!result.ok) {
          this._ioStatus.text = `Import failed — ${result.error}`;
          this._ioStatus.set_style('color: #c62828; font-weight: 700; font-size: 0.7em;');
          return;
        }
        this._ioStatus.text = `✓ Imported ${result.count} coins`;
        this._ioStatus.set_style('color: #0a7a3e; font-weight: 700; font-size: 0.7em;');
        this.close();
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
          try {
            this._panelMenu.onListChanged(`Imported ${result.count} coins`);
          } catch (_e) {
            this._panelMenu.rebuildCoins();
          }
          return GLib.SOURCE_REMOVE;
        });
      } catch (e) {
        this._ioStatus.text = `Import failed — ${String(e.message || e).slice(0, 40)}`;
        this._ioStatus.set_style('color: #c62828; font-weight: 700; font-size: 0.7em;');
      }
    }
  },
);
