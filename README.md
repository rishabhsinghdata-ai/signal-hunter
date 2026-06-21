# Signal Hunter — an interactive data-analyst portfolio

**Signal Hunter** is a browser-based "portfolio game" where visitors act as the analyst. Over five short levels they filter outliers, sort bars, trace trends, cluster domain dots, and detect an anomaly — and every puzzle they solve unlocks a real insight about [Rishabh Singh](mailto:rishabhsinghdata@gmail.com).

## How to run locally

Any static file server works:

```bash
python3 -m http.server 8080
# or: npx serve .
```

Then open `http://localhost:8080`.

## Files

| File | Purpose |
|---|---|
| `index.html` | All markup + CSS (self-contained, no framework) |
| `game.js` | Canvas game engine — five levels + orchestration |
| `Rishabh_Singh_CV.pdf` | CV — served as a download from the final screen |

## Deploy

Hosted on **GitHub Pages** from the `main` branch root. Push to `main` and Pages rebuilds automatically (usually within 60 seconds).

## Tech

Vanilla JS · Canvas 2D · Zero dependencies · Zero build step
