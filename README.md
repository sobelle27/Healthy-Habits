# PointsPlus Tracker (Light Theme)

Simple, no-frills PointsPlus-style tracker you can upload to GitHub Pages.

## Files
- `index.html` — app shell with tabs (Today, Exercise, Recipes, Measurements, Settings)
- `style.css` — light theme styles
- `script.js` — vanilla JS for logging food/exercise, recipes, measurements, settings, and rollover logic
- `README.md` — this guide

## Features
- **Today:** log foods, see Daily/Weekly remaining, **End Day & Rollover** (up to 4 pts).
- **Exercise:** add exercise points (adds back to daily first, then weekly).
- **Recipes:** build & save recipes, quick-use 1 serving.
- **Measurements:** track weight and measurements over time.
- **Settings:** set daily/weekly allowances, export/import backup, reset data.
- **Saves locally** in your browser (no accounts).

## How to Use
1. Upload all four files to a new GitHub repo.
2. Enable GitHub Pages (Settings → Pages → Deploy from branch → `main`/`root`).
3. Visit your Pages URL to use the tracker.

### Local
Just double‑click `index.html`.

## Notes
- This is a personal tool; not affiliated with WW®.
- Rollover: up to **4** unused daily points move to your **Rollover Bank** either automatically on a new day or when you click **End Day & Rollover**.
- Data stays on your device (localStorage). Clearing site data resets it.
