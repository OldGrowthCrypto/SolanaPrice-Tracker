import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { openOptionsDialog } from './optionsDialog.js';

/**
 * Clean single menu row → full modal for options + add token.
 */
export function buildOptionsMenu(panelMenu, extension) {
  const item = new PopupMenu.PopupMenuItem('Options / Add token');
  item.add_style_class_name('og-options-menu-item');
  item.connect('activate', () => {
    try {
      panelMenu.menu.close();
    } catch (_e) {
      /* ignore */
    }
    openOptionsDialog(panelMenu, extension);
  });
  return item;
}
