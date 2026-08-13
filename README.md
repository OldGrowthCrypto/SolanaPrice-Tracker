# Solana Crypto Price Tracker

**Version 2.0** — Live Solana & major crypto prices on your GNOME top bar, with a clean watchlist dashboard.

By [Old Growth Crypto](https://oldgrowthcrypto.com) · [@OldGrowthCrypto](https://x.com/OldGrowthCrypto)

| | |
|---|---|
| **Version** | **2.0** |
| **GitHub** | [github.com/OldGrowthCrypto/SolanaPrice-Tracker](https://github.com/OldGrowthCrypto/SolanaPrice-Tracker) |
| **GNOME Extensions** | [extensions.gnome.org](https://extensions.gnome.org/) |
| **Website** | [oldgrowthcrypto.com](https://oldgrowthcrypto.com) |
| **Shell** | GNOME 46–50 |
| **UUID** | `price-tracker@oldgrowthcrypto.com` |
| **License** | MIT |

Open-source contribution to the **Solana × Linux** desktop ecosystem.

---

## Features

### Top bar
- Live chips for your pinned coins (icons, tickers, prices)
- Green / red 24h coloring (optional)
- Configurable max coins on bar (1–8)
- Multi-source prices: **Jupiter → DexScreener → CoinGecko**; BTC via Coinbase + 24h change
- Stale indicator when data is older than ~90s
- HTTP retry + backoff on rate limits

### Watchlist dashboard
- Compact coin rows with price + 24h change
- **Drag ☰** or **↑↓** to reorder (order sets panel priority)
- List height fits content (no empty gap under last coin)
- Action bar: **Add token** · **Options** · **Website**

### Per-coin tools
| Control | Action |
|---------|--------|
| ✏️ Edit | Rename / mint / icon |
| 🔔 Alerts | Per-coin jump alerts (% up / % down) + chart site |
| 🌐 Chart | Opens DexScreener, Birdeye, or Jupiter |
| 🔄 Swap | Jupiter **SOL → token** (BTC uses portal wrapped BTC) |
| 📋 Copy | Copy mint (or wBTC mint for BTC) |
| Switch | Pin to top bar |

### Options (compact)
- Top bar: icons, tickers, colorize, max on bar
- Refresh interval + refresh now
- Default chart site
- Export / import watchlist JSON, reset defaults, debug log

### Add token
- Add by pair/ticker or Solana contract address
- Live mint preview (name, price, 24h)

---

## Install

### From GitHub (source)

```bash
git clone https://github.com/OldGrowthCrypto/SolanaPrice-Tracker.git
cd SolanaPrice-Tracker
./setup.sh
gnome-extensions enable price-tracker@oldgrowthcrypto.com
```

**Wayland:** log out and back in. **X11:** Alt+F2 → `r` → Enter.

### From extension zip

```bash
gnome-extensions install -f ./oldgrowth-price-tracker.shell-extension.zip
gnome-extensions enable price-tracker@oldgrowthcrypto.com
```

### Pack release locally

```bash
./pack.sh
# → oldgrowth-price-tracker.shell-extension.zip  (GNOME install)
# → SolanaPrice-Tracker-v2.0.zip                 (full source + docs + extension zip)
```

---

## Quick usage

1. Click the top-bar prices to open **Solana Crypto Price Tracker**.
2. Toggle switches to pin coins to the bar.
3. **🔔** on a coin → set jump alert % up / down, chart site, open swap.
4. **Add token** → paste a Solana mint or pair.
5. **Options** → bar display, refresh, charts, import/export.

Full guide: **[HOWTO.txt](./HOWTO.txt)** · Release notes: **[RELEASE.md](./RELEASE.md)**  
GNOME website checklist: **[docs/GNOME-EXTENSIONS.md](./docs/GNOME-EXTENSIONS.md)**

---

## Project layout

```
extension.js          Dashboard indicator, panel, alerts, drag
prefs.js              Extension Settings (Display / Data / Alerts / Charts)
settings.js           GSettings + seed + reorder + import/export
stylesheet.css        Panel + dashboard styles
api/                  request (retry), prices, jupiter, dexscreener, coingecko, catalog
models/               coin rows, options, add token, per-coin alerts
utils/                icons, format, coin normalize, log
docs/                 GNOME Extensions packaging notes
HOWTO.txt             Plain-text install & usage
RELEASE.md            v2.0 release notes
pack.sh / setup.sh    Build zip + local install
```

---

## Requirements

- GNOME Shell 46+
- Internet for price APIs
- `glib-compile-schemas`, `rsync`, `zip` (for scripts)

---

## License

MIT — see [LICENSE](./LICENSE).  
Upstream lineage: [Crypto Price Tracker for GNOME Shell](https://github.com/alipirpiran/Crypto-Price-Tracker-for-Gnome-Shell).

Built with 🌲 by **Old Growth Crypto** for Solana users on Linux.
