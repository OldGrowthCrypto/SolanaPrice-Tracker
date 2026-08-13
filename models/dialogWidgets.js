/* Shared UI widgets for modal dialogs */

import Clutter from 'gi://Clutter';
import St from 'gi://St';

/**
 * @param {string} text
 * @param {{compact?: boolean}} [opts]
 */
export function heading(text, opts = {}) {
  const compact = !!opts.compact;
  const l = new St.Label({
    text,
    style_class: compact
      ? 'og-options-heading og-options-heading-compact'
      : 'og-options-heading',
  });
  l.set_style(
    compact
      ? 'font-size: 0.65em; font-weight: 800; letter-spacing: 0.08em; color: #555; padding: 8px 0 2px 0;'
      : 'font-size: 0.72em; font-weight: 800; letter-spacing: 0.1em; color: #444; padding: 12px 0 4px 0;',
  );
  return l;
}

/**
 * @param {string} text
 * @param {{compact?: boolean}} [opts]
 */
export function hint(text, opts = {}) {
  const compact = !!opts.compact;
  const l = new St.Label({
    text: text || ' ',
    style_class: compact
      ? 'og-options-hint og-options-hint-compact'
      : 'og-options-hint',
  });
  l.set_style(
    compact
      ? 'font-size: 0.7em; color: #666; padding: 0 0 2px 0;'
      : 'font-size: 0.8em; color: #444; padding: 2px 0 6px 0;',
  );
  l.clutter_text.line_wrap = true;
  return l;
}

/**
 * @param {string} hintText
 * @param {boolean} [expand=true]
 * @param {{compact?: boolean}} [opts]
 */
export function entry(hintText, expand = true, opts = {}) {
  const compact = !!opts.compact;
  const e = new St.Entry({
    hint_text: hintText,
    can_focus: true,
    x_expand: expand,
    style_class: 'og-input',
    track_hover: true,
  });
  e.set_style(
    compact
      ? 'background-color: #ffffff; color: #111111; border: 1px solid #bbb; border-radius: 6px; padding: 5px 8px; min-width: 120px; margin: 1px;'
      : 'background-color: #ffffff; color: #111111; border: 1px solid #999; border-radius: 8px; padding: 8px 10px; min-width: 160px; margin: 2px;',
  );
  return e;
}

/**
 * @param {string} label
 * @param {Function} cb
 * @param {boolean} [primary=false]
 * @param {{compact?: boolean, selected?: boolean}} [opts]
 */
export function button(label, cb, primary = false, opts = {}) {
  const compact = !!opts.compact;
  const selected = !!opts.selected;
  const lbl = new St.Label({
    text: compact ? ` ${label} ` : `  ${label}  `,
    y_align: Clutter.ActorAlign.CENTER,
  });
  if (primary) {
    lbl.set_style('color: #04140e; font-weight: 800; font-size: 0.82em;');
  } else if (selected) {
    lbl.set_style('color: #04140e; font-weight: 800; font-size: 0.78em;');
  } else {
    lbl.set_style(
      compact
        ? 'color: #111; font-weight: 700; font-size: 0.78em;'
        : 'color: #111; font-weight: 700;',
    );
  }
  const btn = new St.Button({
    child: lbl,
    reactive: true,
    can_focus: true,
    style_class: primary ? 'og-add-btn' : 'og-icon-btn',
  });
  const pad = compact ? '4px 8px' : '8px 14px';
  const margin = compact ? '1px' : '4px';
  const radius = compact ? '6px' : '8px';
  let bg = primary
    ? '#14f195'
    : selected
      ? 'rgba(20,241,149,0.45)'
      : 'rgba(153,69,255,0.18)';
  btn.set_style(
    `background-color: ${bg}; border-radius: ${radius}; padding: ${pad}; margin: ${margin};`,
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

/**
 * @param {string} label
 * @param {boolean} initial
 * @param {Function} onToggle
 * @param {{compact?: boolean}} [opts]
 */
export function switchRow(label, initial, onToggle, opts = {}) {
  const compact = !!opts.compact;
  const row = new St.BoxLayout({
    vertical: false,
    x_expand: true,
    style_class: compact
      ? 'og-options-switch-row og-options-switch-row-compact'
      : 'og-options-switch-row',
  });
  const lbl = new St.Label({
    text: label,
    x_expand: true,
    y_align: Clutter.ActorAlign.CENTER,
  });
  lbl.set_style(
    compact
      ? 'color: #111; font-weight: 600; font-size: 0.82em; padding: 2px 0;'
      : 'color: #111; font-weight: 600; padding: 6px 0;',
  );
  row.add_child(lbl);

  let state = !!initial;
  const tLbl = new St.Label({
    text: state ? ' ON ' : ' OFF ',
    y_align: Clutter.ActorAlign.CENTER,
  });
  tLbl.set_style(
    state
      ? 'color: #04140e; font-weight: 800; font-size: 0.72em;'
      : 'color: #fff; font-weight: 800; font-size: 0.72em;',
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
        ? 'background-color: #14f195; border-radius: 999px; padding: 2px 8px;'
        : 'background-color: #888; border-radius: 999px; padding: 2px 8px;',
    );
    tLbl.set_style(
      state
        ? 'color: #04140e; font-weight: 800; font-size: 0.72em;'
        : 'color: #fff; font-weight: 800; font-size: 0.72em;',
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

/**
 * @param {string} text
 * @param {{compact?: boolean}} [opts]
 */
export function dialogTitle(text, opts = {}) {
  const compact = !!opts.compact;
  const title = new St.Label({
    text,
    style_class: 'og-options-title',
  });
  title.set_style(
    compact
      ? 'font-size: 1em; font-weight: 800; color: #111111; padding-bottom: 2px;'
      : 'font-size: 1.15em; font-weight: 800; color: #111111; padding-bottom: 4px;',
  );
  return title;
}

/** Horizontal chip row helper */
export function chipRow() {
  return new St.BoxLayout({
    vertical: false,
    x_expand: true,
    style_class: 'og-options-row og-options-chip-row',
  });
}
