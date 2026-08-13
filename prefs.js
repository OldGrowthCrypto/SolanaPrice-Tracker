/* prefs.js — Solana Crypto Price Tracker settings window
 * SPDX-License-Identifier: MIT
 */

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

import {
  ExtensionPreferences,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class OldGrowthPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings(
      'org.gnome.shell.extensions.oldgrowth-price-tracker',
    );

    window.title = 'Solana Crypto Price Tracker';
    window.set_default_size(520, 560);

    // —— Display ——
    const display = new Adw.PreferencesPage({
      title: 'Display',
      icon_name: 'preferences-desktop-display-symbolic',
    });
    window.add(display);

    const appearance = new Adw.PreferencesGroup({
      title: 'Top bar appearance',
      description:
        'Control how prices appear on the GNOME top bar. Prices are never black.',
    });
    display.add(appearance);

    const showIcons = new Adw.SwitchRow({
      title: 'Show coin icons',
      subtitle: 'Hide icons for a text-only price strip',
    });
    settings.bind(
      'show-icons',
      showIcons,
      'active',
      Gio.SettingsBindFlags.DEFAULT,
    );
    appearance.add(showIcons);

    const showTickers = new Adw.SwitchRow({
      title: 'Show ticker names',
      subtitle: 'BTC, SOL, JUP, etc. next to each price',
    });
    settings.bind(
      'show-tickers',
      showTickers,
      'active',
      Gio.SettingsBindFlags.DEFAULT,
    );
    appearance.add(showTickers);

    const colorize = new Adw.SwitchRow({
      title: 'Color prices by 24h change',
      subtitle:
        'Off = all prices white. On = green when up, red when down. Never black.',
    });
    settings.bind(
      'colorize-prices',
      colorize,
      'active',
      Gio.SettingsBindFlags.DEFAULT,
    );
    appearance.add(colorize);

    const compact = new Adw.SwitchRow({
      title: 'Auto-compact with 4+ coins',
      subtitle: 'Hides ticker names on the top bar when many coins are shown',
    });
    settings.bind(
      'auto-compact',
      compact,
      'active',
      Gio.SettingsBindFlags.DEFAULT,
    );
    appearance.add(compact);

    const maxPanel = new Adw.SpinRow({
      title: 'Max coins on top bar',
      subtitle: 'How many tokens can be pinned at once (1–8)',
      adjustment: new Gtk.Adjustment({
        lower: 1,
        upper: 8,
        step_increment: 1,
        page_increment: 1,
        value: 5,
      }),
    });
    settings.bind(
      'max-panel-coins',
      maxPanel,
      'value',
      Gio.SettingsBindFlags.DEFAULT,
    );
    appearance.add(maxPanel);

    const flash = new Adw.SpinRow({
      title: 'Move flash threshold (%)',
      subtitle:
        'Flash panel chip when |24h change| exceeds this. 0 = disabled (quiet).',
      adjustment: new Gtk.Adjustment({
        lower: 0,
        upper: 50,
        step_increment: 0.5,
        page_increment: 2,
        value: 0,
      }),
      digits: 1,
    });
    settings.bind(
      'move-flash-threshold',
      flash,
      'value',
      Gio.SettingsBindFlags.DEFAULT,
    );
    appearance.add(flash);

    // —— Data ——
    const dataPage = new Adw.PreferencesPage({
      title: 'Data',
      icon_name: 'network-transmit-receive-symbolic',
    });
    window.add(dataPage);

    const dataGroup = new Adw.PreferencesGroup({
      title: 'Refresh & sources',
      description:
        'Jupiter (Solana) → DexScreener → CoinGecko. BTC via Coinbase + 24h change.',
    });
    dataPage.add(dataGroup);

    const refresh = new Adw.SpinRow({
      title: 'Refresh interval (seconds)',
      subtitle: 'Minimum 20 to avoid rate limits',
      adjustment: new Gtk.Adjustment({
        lower: 20,
        upper: 300,
        step_increment: 5,
        page_increment: 30,
        value: 30,
      }),
    });
    settings.bind(
      'refresh-interval',
      refresh,
      'value',
      Gio.SettingsBindFlags.DEFAULT,
    );
    dataGroup.add(refresh);

    const debug = new Adw.SwitchRow({
      title: 'Debug logging',
      subtitle: 'Verbose API/cache logs in journalctl (OldGrowthPriceTracker)',
    });
    settings.bind(
      'debug-logging',
      debug,
      'active',
      Gio.SettingsBindFlags.DEFAULT,
    );
    dataGroup.add(debug);

    // —— Alerts ——
    const alertsPage = new Adw.PreferencesPage({
      title: 'Alerts',
      icon_name: 'preferences-system-notifications-symbolic',
    });
    window.add(alertsPage);

    const alertsGroup = new Adw.PreferencesGroup({
      title: 'Quick jump alerts',
      description:
        'GNOME notifications when a coin pumps or dumps quickly between price refreshes (not 24h change).',
    });
    alertsPage.add(alertsGroup);

    const alertsOn = new Adw.SwitchRow({
      title: 'Enable global jump alerts',
      subtitle:
        'Master switch for coins without per-coin alerts. Per-coin alerts: bell icon on each row.',
    });
    settings.bind(
      'alerts-enabled',
      alertsOn,
      'active',
      Gio.SettingsBindFlags.DEFAULT,
    );
    alertsGroup.add(alertsOn);

    const alertUp = new Adw.SwitchRow({
      title: 'Alert on pumps (up)',
      subtitle: 'Notify when price jumps upward past the threshold',
    });
    settings.bind(
      'alert-up-enabled',
      alertUp,
      'active',
      Gio.SettingsBindFlags.DEFAULT,
    );
    alertsGroup.add(alertUp);

    const alertDown = new Adw.SwitchRow({
      title: 'Alert on dumps (down)',
      subtitle: 'Notify when price jumps downward past the threshold',
    });
    settings.bind(
      'alert-down-enabled',
      alertDown,
      'active',
      Gio.SettingsBindFlags.DEFAULT,
    );
    alertsGroup.add(alertDown);

    const alertThr = new Adw.SpinRow({
      title: 'Jump threshold (%)',
      subtitle:
        'Notify when |move since last sample| exceeds this (try 2–5% for active markets)',
      adjustment: new Gtk.Adjustment({
        lower: 0.5,
        upper: 50,
        step_increment: 0.5,
        page_increment: 2,
        value: 3,
      }),
      digits: 1,
    });
    settings.bind(
      'alert-threshold-pct',
      alertThr,
      'value',
      Gio.SettingsBindFlags.DEFAULT,
    );
    alertsGroup.add(alertThr);

    const cooldown = new Adw.SpinRow({
      title: 'Cooldown (seconds)',
      subtitle: 'Minimum time between alerts for the same coin',
      adjustment: new Gtk.Adjustment({
        lower: 30,
        upper: 3600,
        step_increment: 30,
        page_increment: 60,
        value: 120,
      }),
    });
    settings.bind(
      'alert-cooldown-sec',
      cooldown,
      'value',
      Gio.SettingsBindFlags.DEFAULT,
    );
    alertsGroup.add(cooldown);

    // —— Charts ——
    const chartsPage = new Adw.PreferencesPage({
      title: 'Charts',
      icon_name: 'web-browser-symbolic',
    });
    window.add(chartsPage);

    const chartsGroup = new Adw.PreferencesGroup({
      title: 'Default chart site',
      description:
        'Used when a coin has no override. Per-coin: open the bell/alerts popup on a row and pick DexScreener, Birdeye, or Jupiter. Swap button always opens jup.ag SOL pair.',
    });
    chartsPage.add(chartsGroup);

    const chartModel = new Gtk.StringList();
    chartModel.append('dexscreener');
    chartModel.append('birdeye');
    chartModel.append('jupiter');
    const chartRow = new Adw.ComboRow({
      title: 'Default chart provider',
      subtitle: 'dexscreener · birdeye · jupiter',
      model: chartModel,
    });
    const cur = settings.get_string('default-chart-provider') || 'dexscreener';
    const idx = ['dexscreener', 'birdeye', 'jupiter'].indexOf(cur);
    chartRow.selected = idx >= 0 ? idx : 0;
    chartRow.connect('notify::selected', () => {
      const id = chartModel.get_string(chartRow.selected);
      if (id) settings.set_string('default-chart-provider', id);
    });
    chartsGroup.add(chartRow);

    // —— Help ——
    const helpPage = new Adw.PreferencesPage({
      title: 'Help',
      icon_name: 'help-about-symbolic',
    });
    window.add(helpPage);

    const help = new Adw.PreferencesGroup({
      title: 'Dashboard & watchlist',
      description:
        'Solana Crypto Price Tracker. Drag ☰ / ↑↓ to reorder. Bell icon = per-coin alerts (% up/down) + chart site. Browser = open chart. Sync icon = Jupiter SOL swap. Add token / Options / Website on the action bar.',
    });
    helpPage.add(help);

    const about = new Adw.PreferencesGroup({
      title: 'About',
      description:
        'Solana Crypto Price Tracker by Old Growth Crypto — oldgrowthcrypto.com · github.com/OldGrowthCrypto/SolanaPrice-Tracker · @OldGrowthCrypto',
    });
    helpPage.add(about);
  }
}
