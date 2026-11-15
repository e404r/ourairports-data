import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { z } from 'zod';
import { AirportStore, type AirportRecord } from './services/airportStore.js';
import { getApiMessage, getTypeLabel, type Lang } from './i18n/ka.js';
import {
  createRateLimiter,
  requireApiKey,
  resolveLang,
  securityHeadersMiddleware,
} from './middleware/security.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const PORT = Number(process.env.PORT || 3001);
const API_KEY = process.env.API_KEY;
const UPSTREAM_RAW_BASE =
  process.env.UPSTREAM_RAW_BASE || 'https://raw.githubusercontent.com/e404r/ourairports-data/main';
const AUTO_SYNC_HOURS = Number(process.env.AUTO_SYNC_HOURS || 24);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3001')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const store = new AirportStore(ROOT_DIR);

function formatAirport(a: AirportRecord, lang: Lang) {
  return {
    id: a.id,
    ident: a.ident,
    iata_code: a.iataCode || null,
    icao_code: a.icaoCode || null,
    type: a.type,
    type_label: getTypeLabel(a.type, lang),
    name: lang === 'ka' ? a.nameKa : a.nameEn,
    name_en: a.nameEn,
    name_ka: a.nameKa,
    city: lang === 'ka' ? a.municipalityKa || null : a.municipalityEn || null,
    city_en: a.municipalityEn || null,
    city_ka: a.municipalityKa || null,
    iso_country: a.isoCountry,
    country: lang === 'ka' ? a.countryKa : a.countryEn,
    country_en: a.countryEn,
    country_ka: a.countryKa,
    iso_region: a.isoRegion || null,
    continent: a.continent || null,
    latitude: a.latitude,
    longitude: a.longitude,
    elevation_ft: a.elevationFt,
    scheduled_service: a.scheduledService,
  };
}

const searchQuerySchema = z.object({
  q: z.string().max(64).optional(),
  country: z.string().regex(/^[A-Za-z]{2}$/).optional(),
  types: z.string().max(200).optional(),
  exclude_closed: z.enum(['true', 'false']).optional(),
  lang: z.enum(['ka', 'en']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

const app = new Hono();

app.use('*', securityHeadersMiddleware);
app.use(
  '/api/*',
  cors({
    origin: (origin) => (ALLOWED_ORIGINS.includes(origin) ? origin : ''),
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'Accept-Language'],
  })
);

const readLimiter = createRateLimiter(120, 60_000);
const syncLimiter = createRateLimiter(5, 60_000);

app.get('/api/v1/health', (c) => {
  const snap = store.getSnapshot();
  const lang = resolveLang(c.req.query('lang'), c.req.header('accept-language'));
  return c.json({
    status: 'ok',
    lang,
    maintainer: 'e404r',
    github: 'https://github.com/e404r',
    repository: 'https://github.com/e404r/ourairports-data',
    upstream: 'https://github.com/davidmegginson/ourairports-data',
    total_airports: snap.airports.length,
    total_countries: snap.countries.length,
    type_counts: snap.typeCounts,
    loaded_at: snap.loadedAt,
    source: snap.source,
    sync_in_progress: store.isSyncing(),
    last_sync_error: store.getLastSyncError(),
  });
});

app.get('/api/v1/airports', readLimiter, requireApiKey(API_KEY, false), (c) => {
  const lang = resolveLang(c.req.query('lang'), c.req.header('accept-language'));
  const parsed = searchQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json(
      { error: getApiMessage('bad_request', lang), details: parsed.error.flatten() },
      400
    );
  }

  const { q, country, types, exclude_closed, limit, offset } = parsed.data;
  const typeList = types
    ? types
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : undefined;

  const result = store.search({
    q,
    country,
    types: typeList,
    excludeClosed: exclude_closed === 'true',
    limit,
    offset,
  });

  return c.json({
    lang,
    total: result.total,
    limit,
    offset,
    items: result.items.map((a) => formatAirport(a, lang)),
  });
});

app.get('/api/v1/airports/:code', readLimiter, requireApiKey(API_KEY, false), (c) => {
  const lang = resolveLang(c.req.query('lang'), c.req.header('accept-language'));
  const code = c.req.param('code');
  if (!code || code.length > 12 || !/^[A-Za-z0-9-]+$/.test(code)) {
    return c.json({ error: getApiMessage('bad_request', lang) }, 400);
  }

  const matches = store.findByCode(code);
  if (matches.length === 0) {
    return c.json({ error: getApiMessage('not_found', lang) }, 404);
  }

  return c.json({
    lang,
    count: matches.length,
    airport: formatAirport(matches[0], lang),
    matches: matches.map((m) => formatAirport(m, lang)),
  });
});

app.get('/api/v1/countries', readLimiter, requireApiKey(API_KEY, false), (c) => {
  const lang = resolveLang(c.req.query('lang'), c.req.header('accept-language'));
  const snap = store.getSnapshot();
  return c.json({
    lang,
    total: snap.countries.length,
    items: snap.countries.map((country) => ({
      code: country.code,
      name: lang === 'ka' ? country.nameKa : country.nameEn,
      name_en: country.nameEn,
      name_ka: country.nameKa,
      continent: country.continent,
      airport_count: country.airportCount,
    })),
  });
});

app.post('/api/v1/sync', syncLimiter, requireApiKey(API_KEY, true), async (c) => {
  const lang = resolveLang(c.req.query('lang'), c.req.header('accept-language'));
  if (store.isSyncing()) {
    return c.json({ error: getApiMessage('sync_in_progress', lang) }, 409);
  }
  try {
    const result = await store.syncFromUpstream(UPSTREAM_RAW_BASE);
    return c.json({
      message: getApiMessage('sync_success', lang),
      total_airports: result.totalAirports,
      loaded_at: result.loadedAt,
    });
  } catch (err: any) {
    return c.json({ error: err?.message || 'Sync failed' }, 502);
  }
});

// Serve built Vite SPA in production
app.use('/*', serveStatic({ root: './dist' }));

async function bootstrap() {
  const snap = await store.loadFromDisk('local-csv');
  console.log(`[AirportsAPI] Loaded ${snap.airports.length} airports & ${snap.countries.length} countries.`);

  if (AUTO_SYNC_HOURS > 0) {
    setInterval(() => {
      store
        .syncFromUpstream(UPSTREAM_RAW_BASE)
        .then((r) => console.log(`[AirportsAPI] Auto-sync completed: ${r.totalAirports} airports.`))
        .catch((err) => console.error('[AirportsAPI] Auto-sync failed:', err?.message));
    }, AUTO_SYNC_HOURS * 3600_000).unref();
  }

  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`[AirportsAPI] Listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('[AirportsAPI] Fatal startup error:', err);
  process.exit(1);
});
