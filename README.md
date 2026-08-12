# Solana Crypto Price Tracker

**Live Solana (and major) desk prices on your GNOME top bar**

By [Old Growth Crypto](https://oldgrowthcrypto.com) · [@OldGrowthCrypto](https://x.com/OldGrowthCrypto)

| | |
|---|---|
| **Website** | [oldgrowthcrypto.com](https://oldgrowthcrypto.com) |
| **GitHub** | [github.com/OldGrowthCrypto/solana-crypto-price-tracker](https://github.com/OldGrowthCrypto/solana-crypto-price-tracker) |
| **GNOME Extensions** | [extensions.gnome.org](https://extensions.gnome.org/) |
| **Shell** | GNOME 46–50 |
| **UUID** | `price-tracker@oldgrowthcrypto.com` |

Open-source contribution to the Solana + Linux desktop ecosystem: glanceable prices for builders, traders, and everyday Solana users.

Forked from [Crypto Price Tracker](https://github.com/alipirpiran/Crypto-Price-Tracker-for-Gnome-Shell) (MIT).

---

## Features

- **Top bar chips** — up to 5 coins with icons, tickers, and live prices (green up / red down)
- **Defaults** — BTC, SOL, JUP, BONK, JTO ready out of the box
- **Solana ecosystem menu** — curated list (Pump, Render, Pengu, Trump, Pyth, WIF, and more)
- **Add by contract address** — paste any Solana mint; prices via Jupiter (+ Coinbase for majors)
- **Add by pair** — pair-style entries for flexible tracking
- **Mint icons** — auto-fetch token logos (DexScreener / token list); custom icon upload
- **Options modal** — toggle bar visibility, show/hide icons, price colors, edit & delete rows
- **Clean Solana desk UI** — high-contrast light popup, purple accent, brand header

---

## Quick install (from source)

```bash
# Clone
git clone https://github.com/OldGrowthCrypto/solana-crypto-price-tracker.git
cd solana-crypto-price-tracker

# Install into ~/.local/share/gnome-shell/extensions/
./setup.sh

# Enable
gnome-extensions enable price-tracker@oldgrowthcrypto.com
```

**Wayland:** log out and back in (or reboot) if the extension does not appear yet.  
**X11:** you can also restart GNOME Shell with `Alt+F2`, type `r`, Enter.

### Install from zip

```bash
./pack.sh
gnome-extensions install -f ./oldgrowth-price-tracker.shell-extension.zip
gnome-extensions enable price-tracker@oldgrowthcrypto.com
```

### GNOME Extensions website

Browse and install from: **[https://extensions.gnome.org/](https://extensions.gnome.org/)**  
(Search for *Solana Crypto Price Tracker* once published.)

---

## Usage

1. Look at the **top bar** for your selected coins and prices.
2. **Click the extension** to open the full menu and Solana ecosystem list.
3. **Options** → manage coins, add by contract address or pair, icon prefs.
4. Use the **switch** on a row to pin that token onto the top bar (max 5).
5. **Trash** removes a coin; **edit** updates ticker / mint / icon.

More detail: see **[HOWTO.txt](./HOWTO.txt)**.

---

## Requirements

- GNOME Shell **46, 47, 48, 49, or 50**
- Internet access (Jupiter / Coinbase / DexScreener price & icon APIs)
- `glib-compile-schemas` (usually via `libglib2.0-bin` on Debian/Ubuntu)
- `rsync`, `zip` for setup/pack scripts

---

## Project layout

```
extension.js          Main indicator + menu
prefs.js              GNOME Extensions prefs window
settings.js           GSettings helpers
stylesheet.css        Popup + panel styles
metadata.json         Extension metadata (UUID, shell versions)
schemas/              GSettings schema + compiled
api/                  Catalog, prices, Jupiter, Coinbase, HTTP
models/               Menu items, options dialog, add/edit flows
utils/                Icons, formatting, crypto helpers
assets/icons/         Bundled coin + brand icons
setup.sh              Install to user extensions dir
pack.sh               Build .shell-extension.zip
HOWTO.txt             Install & usage guide (plain text)
```

---

## Develop / reload

```bash
./setup.sh
# Then reload GNOME Shell (X11: Alt+F2 → r) or log out/in (Wayland)
gnome-extensions enable price-tracker@oldgrowthcrypto.com
journalctl -f -o cat /usr/bin/gnome-shell   # optional: watch errors
```

Rebuild schemas after editing `schemas/*.xml`:

```bash
glib-compile-schemas schemas/
```

---

## Data sources

| Source | Use |
|--------|-----|
| **Jupiter Price API** | Solana mint prices |
| **Coinbase** | Major quotes (e.g. BTC) |
| **DexScreener / token list** | Mint icons |

No API key required for default public endpoints.

---

## License

MIT — see [LICENSE](./LICENSE).  
Upstream: [alipirpiran/Crypto-Price-Tracker-for-Gnome-Shell](https://github.com/alipirpiran/Crypto-Price-Tracker-for-Gnome-Shell).

---

## Contributing to the ecosystem

This extension is free and open source. Stars, issues, PRs, and shares help Linux + Solana users keep prices on-desk without leaving the terminal or browser tabs.

- Report bugs / ideas on **GitHub Issues**
- Follow **[@OldGrowthCrypto](https://x.com/OldGrowthCrypto)** for updates
- Site: **[oldgrowthcrypto.com](https://oldgrowthcrypto.com)**

Built with 🌲 by Old Growth Crypto.
