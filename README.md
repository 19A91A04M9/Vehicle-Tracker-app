# Vehicle Movement on a Map (Frontend Only)

A lightweight, frontend-only demo that simulates a vehicle moving along a route on a Leaflet map using local dummy JSON data. Includes play/pause, reset, speed controls, and live metadata (lat/lng, timestamp, speed, elapsed).

## Tech
- Leaflet (OpenStreetMap tiles)
- Vanilla HTML/CSS/JS

## Run Locally
Because the app fetches a local JSON file, you must serve it via an HTTP server.

- Using Node (recommended):
```bash
npx http-server -p 5173 -c-1 .
# or: npx serve -l 5173
```
Open `http://localhost:5173`.

- Python 3:
```bash
python -m http.server 5173
```
Open `http://localhost:5173`.

- VS Code Live Server or any static server also works.

## Deploy
This is a static site. Deploy the repository root directory.

- Netlify: drag-n-drop the folder or connect repo (build command: none; publish directory: `./`).
- Vercel: import the repo, framework preset: Other; output directory: `./`.
- GitHub Pages: enable Pages (source: `main` branch root).
- Render: Static Site; publish directory: `./`.

## Files
- `index.html` – UI layout, panels, includes Leaflet.
- `styles.css` – Dark theme, responsive layout.
- `app.js` – Loads `data/dummy-route.json`, draws the full route, animates vehicle, updates metadata.
- `data/dummy-route.json` – Dummy coordinates with timestamps.

## Customization
- Replace `data/dummy-route.json` with your own points.
- Add more metadata fields to the sidebar as needed.
- Tune animation timing in `app.js` (`defaultSegmentMs`).

## Notes
- Speed shown is segment distance divided by segment duration (from timestamps when available).
- If timestamps are absent, the app uses a uniform duration per segment.
