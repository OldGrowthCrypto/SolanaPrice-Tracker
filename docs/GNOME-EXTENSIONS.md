# Publishing on extensions.gnome.org — v2.0

## Package

```bash
./pack.sh
# Upload: oldgrowth-price-tracker.shell-extension.zip
```

## Metadata

| Field | Value |
|-------|--------|
| uuid | `price-tracker@oldgrowthcrypto.com` |
| name | Solana Crypto Price Tracker |
| version | 20 (maps to product **2.0**) |
| shell-version | 46–50 |
| url | https://github.com/OldGrowthCrypto/SolanaPrice-Tracker |

## Listing text (suggested)

**Short**

> Live Solana prices on your GNOME top bar. Watchlist dashboard, drag reorder, per-coin jump alerts, Jupiter swap links.

**Long**

```
Solana Crypto Price Tracker (v2.0) for GNOME Shell.

• Top-bar price chips with optional green/red 24h colors
• Dashboard watchlist — drag to reorder, pin to bar
• Per-coin jump alerts (% up / % down) via the bell icon
• Chart links: DexScreener, Birdeye, or Jupiter
• One-click Jupiter swap (SOL pair); BTC uses wrapped BTC on Solana
• Add any Solana mint with live preview
• Prices: Jupiter → DexScreener → CoinGecko; BTC via Coinbase
• Compact Options + Add token modals

By Old Growth Crypto — free & open source for Solana on Linux.
https://oldgrowthcrypto.com
https://github.com/OldGrowthCrypto/SolanaPrice-Tracker
```

## Screenshots

See `docs/screenshots/README.md`. Capture panel, dashboard, options, and per-coin alerts.

## Checklist

- [ ] `./pack.sh` succeeds  
- [ ] Install zip on a clean user  
- [ ] Tested on at least one GNOME 46–50 session  
- [ ] No secrets in the zip  
- [ ] LICENSE + README present  
