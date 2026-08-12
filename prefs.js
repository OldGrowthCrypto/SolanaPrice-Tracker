/* prefs.js — Solana Crypto Price Tracker settings window
 * SPDX-License-Identifier: GPL-2.0-or-later
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
    window.set_default_size(520, 480);

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

    // —— Data ——
    const dataPage = new Adw.PreferencesPage({
      title: 'Data',
      icon_name: 'network-transmit-receive-symbolic',
    });
    window.add(dataPage);

    const dataGroup = new Adw.PreferencesGroup({
      title: 'Refresh',
      description: 'How often to pull live prices (Jupiter + Coinbase for BTC).',
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

    // —— Help ——
    const helpPage = new Adw.PreferencesPage({
      title: 'Help',
      icon_name: 'help-about-symbolic',
    });
    window.add(helpPage);

    const help = new Adw.PreferencesGroup({
      title: 'Adding coins',
      description:
        'From the top-bar menu open Options → Add by contract address or Add by pair / ticker. You can paste an optional path to a PNG/JPG icon file for that token.',
    });
    helpPage.add(help);

    const about = new Adw.PreferencesGroup({
      title: 'About',
      description:
        'Solana Crypto Price Tracker by Old Growth Crypto — oldgrowthcrypto.com · @OldGrowthCrypto',
    });
    helpPage.add(about);
  }
}
