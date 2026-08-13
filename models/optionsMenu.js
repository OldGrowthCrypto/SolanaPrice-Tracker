import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';

import { openOptionsDialog } from './optionsDialog.js';
import { openAddTokenDialog } from './addTokenDialog.js';

function _closeThen(panelMenu, openFn) {
  try {
    panelMenu.menu.close();
  } catch (_e) {
    /* ignore */
  }
  openFn();
}

/**
 * One compact action bar: [ Add token ] [ Options ] [ Website ]
 * @param {object} panelMenu
 * @param {object} extension
 * @returns {PopupMenu.PopupBaseMenuItem}
 */
export function buildActionBar(panelMenu, extension) {
  const item = new PopupMenu.PopupBaseMenuItem({
    reactive: false,
    can_focus: false,
    activate: false,
    style_class: 'og-action-bar-item',
  });

  const row = new St.BoxLayout({
    vertical: false,
    x_expand: true,
    style_class: 'og-action-bar',
    y_align: Clutter.ActorAlign.CENTER,
  });

  const mkBtn = (label, primary, onClick) => {
    const lbl = new St.Label({
      text: label,
      y_align: Clutter.ActorAlign.CENTER,
    });
    lbl.add_style_class_name(
      primary ? 'og-action-btn-label og-action-btn-label-primary' : 'og-action-btn-label',
    );
    const btn = new St.Button({
      child: lbl,
      style_class: primary
        ? 'og-action-btn og-action-btn-primary'
        : 'og-action-btn',
      reactive: true,
      can_focus: true,
      track_hover: true,
      x_expand: true,
    });
    btn.connect('clicked', () => {
      try {
        onClick();
      } catch (e) {
        console.error('OldGrowthPriceTracker: action bar', e);
      }
    });
    return btn;
  };

  row.add_child(
    mkBtn('Add token', true, () =>
      _closeThen(panelMenu, () => openAddTokenDialog(panelMenu, extension)),
    ),
  );
  row.add_child(
    mkBtn('Options', false, () =>
      _closeThen(panelMenu, () => openOptionsDialog(panelMenu, extension)),
    ),
  );
  row.add_child(
    mkBtn('Website', false, () => {
      try {
        panelMenu.menu.close();
      } catch (_e) {
        /* ignore */
      }
      Util.spawnCommandLine('xdg-open https://oldgrowthcrypto.com');
    }),
  );

  item.add_child(row);
  return item;
}

/** @deprecated */
export function buildActionMenus(panelMenu, extension) {
  return [buildActionBar(panelMenu, extension)];
}

/** @deprecated */
export function buildOptionsMenu(panelMenu, extension) {
  return buildActionBar(panelMenu, extension);
}
