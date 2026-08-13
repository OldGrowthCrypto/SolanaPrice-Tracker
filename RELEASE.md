# Solana Crypto Price Tracker — Release 2.0

**Product version:** 2.0  
**metadata version:** 20 (GNOME integer)  
**UUID:** `price-tracker@oldgrowthcrypto.com`  
**GitHub:** https://github.com/OldGrowthCrypto/SolanaPrice-Tracker  

## Packages

| File | Purpose |
|------|---------|
| `SolanaPrice-Tracker-v2.0.zip` | **Full release** — source, docs, scripts, plus extension zip |
| `oldgrowth-price-tracker.shell-extension.zip` | GNOME install / extensions.gnome.org |

Build both with:

```bash
./pack.sh
```

## What’s in 2.0

- Solana Crypto Price Tracker branding and polished dashboard UI  
- Compact coin rows; list height snaps to content (no phantom gap)  
- Drag-to-reorder + ↑↓; panel order follows watchlist  
- Split **Add token** and **Options** modals + **Website** action bar  
- Per-coin **alerts** popup: % up / % down, chart site, Jupiter swap  
- BTC Jupiter swap → portal wrapped BTC on Solana  
- Multi-source prices, retry/backoff, stale state  
- Compact Options: bar, refresh, chart default, import/export  
- GNOME Shell **46–50**

## Install

```bash
# Full clone
./setup.sh
gnome-extensions enable price-tracker@oldgrowthcrypto.com

# Or extension zip only
gnome-extensions install -f ./oldgrowth-price-tracker.shell-extension.zip
gnome-extensions enable price-tracker@oldgrowthcrypto.com
```

Reload GNOME Shell after install.

## Docs included

- `README.md` — overview  
- `HOWTO.txt` — install & usage  
- `RELEASE.md` — this file  
- `docs/GNOME-EXTENSIONS.md` — e.g.o checklist  
- `docs/screenshots/README.md` — screenshot guide  
- `LICENSE` — MIT  

## Credits

Old Growth Crypto · MIT  
Upstream: Crypto Price Tracker for GNOME Shell (Ali Pirpiran)  
