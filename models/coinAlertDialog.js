/* Per-coin alert triggers + chart preference modal
 * SPDX-License-Identifier: MIT
 */

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';

import * as Settings from '../settings.js';
import {
  CHART_PROVIDERS,
  chartUrlForProvider,
  jupiterSwapSolUrl,
} from '../api/dexscreener.js';
import { isLikelyMint, resolveSwapMint } from '../api/catalog.js';
import {
  dialogTitle,
  heading,
  hint,
  entry,
  button,
  switchRow,
} from './dialogWidgets.js';

function _openUrl(url) {
  try {
    Util.spawnCommandLine(`xdg-open '${String(url).replace(/'/g, "'\\''")}'`);
  } catch (err) {
    Main.notifyError(`Cannot open ${url}`, String(err));
  }
}

/**
 * @param {object} panelMenu
 * @param {object} extension
 * @param {object} coinItem CoinMenuItem instance
 */
export function openCoinAlertDialog(panelMenu, extension, coinItem) {
  const dialog = new CoinAlertDialog(panelMenu, extension, coinItem);
  dialog.open();
  return dialog;
}

const CoinAlertDialog = GObject.registerClass(
  class CoinAlertDialog extends ModalDialog.ModalDialog {
    _init(panelMenu, extension, coinItem) {
      super._init({
        styleClass: 'og-options-dialog',
        destroyOnClose: true,
      });

      this._panelMenu = panelMenu;
      this._extension = extension;
      this._coin = coinItem;

      const root = new St.BoxLayout({
        vertical: true,
        style_class: 'og-options-root',
        x_expand: true,
      });
      this.contentLayout.add_child(root);

      const title = coinItem.title || 'Token';
      root.add_child(dialogTitle(`${title} · Alerts & links`));
      root.add_child(
        hint(
          'Set jump alerts for this coin only. Choose chart site. Open Jupiter swap (SOL pair).',
        ),
      );

      // Load stored prefs
      const stored = Settings.getCoins().find(c => c.id === coinItem.id) || {};
      this._alertOn = !!stored.alert_enabled;
      this._upPct =
        stored.alert_up_pct > 0
          ? stored.alert_up_pct
          : Settings.getAlertThresholdPct();
      this._downPct =
        stored.alert_down_pct > 0
          ? stored.alert_down_pct
          : Settings.getAlertThresholdPct();
      this._chart =
        (stored.chart_provider || Settings.getDefaultChartProvider()).toLowerCase();

      // —— Alerts ——
      root.add_child(heading('JUMP ALERTS (THIS COIN)'));
      root.add_child(
        switchRow('Enable alerts for this coin', this._alertOn, state => {
          this._alertOn = state;
          this._paintSummary();
        }).row,
      );

      root.add_child(hint('Alert when price jumps UP by at least (%):'));
      const upRow = new St.BoxLayout({
        vertical: false,
        style_class: 'og-options-row',
      });
      this._upEntry = entry(String(this._upPct));
      this._upEntry.text = String(this._upPct);
      upRow.add_child(this._upEntry);
      for (const p of [1, 2, 3, 5, 8, 10]) {
        upRow.add_child(
          button(`${p}%`, () => {
            this._upPct = p;
            this._upEntry.text = String(p);
            this._paintSummary();
          }),
        );
      }
      root.add_child(upRow);

      root.add_child(hint('Alert when price jumps DOWN by at least (%):'));
      const downRow = new St.BoxLayout({
        vertical: false,
        style_class: 'og-options-row',
      });
      this._downEntry = entry(String(this._downPct));
      this._downEntry.text = String(this._downPct);
      downRow.add_child(this._downEntry);
      for (const p of [1, 2, 3, 5, 8, 10]) {
        downRow.add_child(
          button(`${p}%`, () => {
            this._downPct = p;
            this._downEntry.text = String(p);
            this._paintSummary();
          }),
        );
      }
      root.add_child(downRow);

      this._summary = hint('');
      root.add_child(this._summary);
      this._paintSummary();

      // —— Chart provider ——
      root.add_child(heading('CHART LINK'));
      root.add_child(
        hint('Which site opens when you press the chart button on this coin:'),
      );
      const chartRow = new St.BoxLayout({
        vertical: false,
        style_class: 'og-options-row',
      });
      for (const p of CHART_PROVIDERS) {
        chartRow.add_child(
          button(p.label, () => {
            this._chart = p.id;
            this._paintSummary();
          }),
        );
      }
      root.add_child(chartRow);
      this._chartLbl = hint('');
      root.add_child(this._chartLbl);
      this._paintSummary();

      // —— Quick open ——
      root.add_child(heading('OPEN NOW'));
      const openRow = new St.BoxLayout({
        vertical: false,
        style_class: 'og-options-row',
      });
      openRow.add_child(
        button('Open chart', () => this._openChart(), true),
      );
      openRow.add_child(
        button('Swap on Jupiter (SOL)', () => this._openSwap(), true),
      );
      root.add_child(openRow);

      this.setButtons([
        {
          label: 'Save',
          action: () => this._save(),
          default: true,
        },
        {
          label: 'Cancel',
          action: () => this.close(),
          key: Clutter.KEY_Escape,
        },
      ]);
    }

    _parsePct(entry, fallback) {
      const n = Number(String(entry.text || '').replace('%', '').trim());
      if (Number.isFinite(n) && n > 0) return Math.min(n, 100);
      return fallback;
    }

    _paintSummary() {
      this._upPct = this._parsePct(this._upEntry, this._upPct);
      this._downPct = this._parsePct(this._downEntry, this._downPct);
      const chartName =
        CHART_PROVIDERS.find(p => p.id === this._chart)?.label || 'DexScreener';
      if (this._summary) {
        this._summary.text = this._alertOn
          ? `✓ Alerts ON · pump ≥ +${this._upPct}% · dump ≤ −${this._downPct}%`
          : `Alerts OFF for ${this._coin.title}`;
        this._summary.set_style(
          this._alertOn
            ? 'color: #0a7a3e; font-weight: 700;'
            : 'color: #666; font-weight: 600;',
        );
      }
      if (this._chartLbl)
        this._chartLbl.text = `Chart button → ${chartName}`;
    }

    _openChart() {
      const mint = this._coin.mint || '';
      const url = chartUrlForProvider(
        mint,
        this._chart,
        this._coin.coingecko_id || '',
      );
      _openUrl(url);
    }

    _openSwap() {
      const mint = resolveSwapMint(this._coin);
      if (!mint || !isLikelyMint(mint)) {
        Main.notify(
          'Solana Crypto Price Tracker',
          'Jupiter swap needs a Solana mint',
        );
        return;
      }
      _openUrl(jupiterSwapSolUrl(mint));
    }

    _save() {
      this._paintSummary();
      const ok = Settings.updateCoin({
        id: this._coin.id,
        key: this._coin.key,
        mint: this._coin.mint,
        title: this._coin.title,
        alert_enabled: this._alertOn,
        alert_up_pct: this._upPct,
        alert_down_pct: this._downPct,
        chart_provider: this._chart,
      });
      if (ok) {
        // Mirror onto live menu item
        this._coin.alert_enabled = this._alertOn;
        this._coin.alert_up_pct = this._upPct;
        this._coin.alert_down_pct = this._downPct;
        this._coin.chart_provider = this._chart;
        Main.notify(
          'Solana Crypto Price Tracker',
          `${this._coin.title} alerts saved` +
            (this._alertOn
              ? ` (+${this._upPct}% / −${this._downPct}%)`
              : ' (off)'),
        );
        if (this._panelMenu._refreshStatusText)
          this._panelMenu._refreshStatusText();
        this.close();
      } else {
        Main.notify(
          'Solana Crypto Price Tracker',
          'Could not save coin settings',
        );
      }
    }
  },
);
