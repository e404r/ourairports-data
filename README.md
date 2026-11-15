# World Airports API (EN / KA)

Secure, bilingual (**English / ქართული**) REST API and **Vite + Vue 3** web explorer for all **86,368+** world airports, heliports, seaplane bases, and regional airfields.

- **Live Demo & API:** [https://world-airports-api.onrender.com/](https://world-airports-api.onrender.com/)
- **Repository:** [`e404r/ourairports-data`](https://github.com/e404r/ourairports-data)
- **Maintainer:** [@e404r](https://github.com/e404r)
- **Upstream Data Source:** [`davidmegginson/ourairports-data`](https://github.com/davidmegginson/ourairports-data)

---

## Features / შესაძლებლობები

- **All Airports Included:** Loads every record from `airports.csv` and `countries.csv` (`large_airport`, `medium_airport`, `small_airport`, `heliport`, `seaplane_base`, `balloonport`, `closed`).
- **Bilingual (`?lang=en` / `?lang=ka`):** Localized country names, airport types, Georgian airport/city names, and API messages.
- **Security Hardened:**
  - `X-API-Key` / `Bearer` authentication (constant-time `timingSafeEqual`) on `POST /api/v1/sync` and optionally on all `/api/v1/*` routes (`REQUIRE_API_KEY=true`).
  - Per-IP sliding-window rate limiting, strict CORS allowlist, security headers (`CSP`, `nosniff`, `DENY`), Zod query validation, SSRF host allowlist (`raw.githubusercontent.com`), and CSV formula-injection sanitization.
- **Automated Upstream Sync:**
  - **GitHub Actions** ([`.github/workflows/sync-upstream.yml`](.github/workflows/sync-upstream.yml)) syncs `*.csv` files daily at `03:00 UTC` from `davidmegginson/ourairports-data` without merge conflicts.
  - **Runtime Sync:** Scheduled background refresh (`AUTO_SYNC_HOURS=24`) + protected `POST /api/v1/sync`.
- **Responsive Vite UI:** Tailwind CSS + Lucide icons + searchable Country/Type dropdowns, optimized for desktop, tablet, and mobile.

---

## Quick Start / გაშვება

```bash
npm install
cp .env.example .env
# Edit .env and set a strong API_KEY

# Development (Vite :5173 + API :3001)
npm run dev

# Production Build & Start
npm run build
npm start
```

---

## Environment Variables (`.env`)

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3001` | HTTP server port |
| `API_KEY` | — | Secret key for `POST /api/v1/sync` (and `/api/v1/*` if `REQUIRE_API_KEY=true`) |
| `REQUIRE_API_KEY` | `false` | Set `true` to require API key on all read endpoints |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3001` | Comma-separated CORS allowlist |
| `UPSTREAM_RAW_BASE` | `https://raw.githubusercontent.com/e404r/ourairports-data/main` | Upstream raw CSV base URL |
| `AUTO_SYNC_HOURS` | `24` | Background CSV refresh interval in hours (`0` to disable) |

---

## API Endpoints

- `GET /api/v1/health?lang=en` — Health status, total airports/countries, type breakdown, attribution
- `GET /api/v1/airports?q=Kutaisi&lang=en&country=GE&types=large_airport&exclude_closed=true&limit=25` — Search & filter airports
- `GET /api/v1/airports/:code?lang=en` — Lookup by IATA, ICAO, or `ident` (e.g. `KUT`, `UGKO`, `TBS`)
- `GET /api/v1/countries?lang=en` — List all countries with airport counts
- `POST /api/v1/sync` — Trigger upstream CSV refresh (requires `X-API-Key` header)

---

## Deployment / განთავსება

1. **aaPanel / VPS (Node.js):**
   - Clone `https://github.com/e404r/ourairports-data.git`
   - Run `npm install && npm run build`
   - Configure `.env` and start with `npm start` (or PM2 / aaPanel Node Project Manager).
2. **Railway / Render / Fly.io:**
   - Connect your GitHub repo `e404r/ourairports-data`, set `Build Command: npm install && npm run build`, `Start Command: npm start`, and configure `.env` variables.
