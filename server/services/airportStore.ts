import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'csv-parse';
import { getCountryNameKa, KNOWN_AIRPORT_KA } from '../i18n/ka.js';

export interface CountryRecord {
  id: string;
  code: string;
  nameEn: string;
  nameKa: string;
  continent: string;
  airportCount: number;
}

export interface AirportRecord {
  id: string;
  ident: string;
  type: string;
  nameEn: string;
  nameKa: string;
  latitude: number | null;
  longitude: number | null;
  elevationFt: number | null;
  continent: string;
  isoCountry: string;
  countryEn: string;
  countryKa: string;
  isoRegion: string;
  municipalityEn: string;
  municipalityKa: string;
  scheduledService: boolean;
  icaoCode: string;
  iataCode: string;
  gpsCode: string;
  localCode: string;
  keywords: string;
  searchText: string;
}

interface StoreSnapshot {
  airports: AirportRecord[];
  countries: CountryRecord[];
  byIdent: Map<string, AirportRecord>;
  byIata: Map<string, AirportRecord[]>;
  byIcao: Map<string, AirportRecord[]>;
  byCountry: Map<string, AirportRecord[]>;
  typeCounts: Record<string, number>;
  loadedAt: string;
  source: string;
}

const TYPE_PRIORITY: Record<string, number> = {
  large_airport: 1,
  medium_airport: 2,
  small_airport: 3,
  seaplane_base: 4,
  heliport: 5,
  balloonport: 6,
  closed: 7,
};

const ALLOWED_UPSTREAM_HOSTS = new Set(['raw.githubusercontent.com']);
const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024; // 25 MB safety cap

function sanitizeCell(value: unknown): string {
  const str = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  if (!str) return '';
  // Strip leading spreadsheet formula characters for downstream CSV safety
  return str.replace(/^[=+\-@]+/, '');
}

function parseNumberOrNull(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

async function parseCsvFile<T>(filePath: string): Promise<T[]> {
  const records: T[] = [];
  const parser = fs.createReadStream(filePath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    })
  );
  for await (const row of parser) {
    records.push(row as T);
  }
  return records;
}

export class AirportStore {
  private rootDir: string;
  private snapshot: StoreSnapshot | null = null;
  private syncLock = false;
  private lastSyncError: string | null = null;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  async loadFromDisk(source = 'local-csv'): Promise<StoreSnapshot> {
    const countriesPath = path.join(this.rootDir, 'countries.csv');
    const airportsPath = path.join(this.rootDir, 'airports.csv');

    const rawCountries = await parseCsvFile<Record<string, string>>(countriesPath);
    const countryMap = new Map<string, CountryRecord>();

    for (const c of rawCountries) {
      const code = sanitizeCell(c.code).toUpperCase();
      if (!code) continue;
      const nameEn = sanitizeCell(c.name) || code;
      countryMap.set(code, {
        id: sanitizeCell(c.id),
        code,
        nameEn,
        nameKa: getCountryNameKa(code, nameEn),
        continent: sanitizeCell(c.continent),
        airportCount: 0,
      });
    }

    const rawAirports = await parseCsvFile<Record<string, string>>(airportsPath);
    const airports: AirportRecord[] = [];
    const byIdent = new Map<string, AirportRecord>();
    const byIata = new Map<string, AirportRecord[]>();
    const byIcao = new Map<string, AirportRecord[]>();
    const byCountry = new Map<string, AirportRecord[]>();
    const typeCounts: Record<string, number> = {};

    for (const row of rawAirports) {
      const ident = sanitizeCell(row.ident).toUpperCase();
      if (!ident) continue;

      const type = sanitizeCell(row.type) || 'small_airport';
      const nameEn = sanitizeCell(row.name) || ident;
      const isoCountry = sanitizeCell(row.iso_country).toUpperCase();
      const iataCode = sanitizeCell(row.iata_code).toUpperCase();
      const icaoCode = sanitizeCell(row.icao_code).toUpperCase();
      const gpsCode = sanitizeCell(row.gps_code).toUpperCase();
      const localCode = sanitizeCell(row.local_code).toUpperCase();
      const municipalityEn = sanitizeCell(row.municipality);
      const keywords = sanitizeCell(row.keywords);

      const countryInfo = countryMap.get(isoCountry);
      const countryEn = countryInfo?.nameEn || isoCountry;
      const countryKa = countryInfo?.nameKa || getCountryNameKa(isoCountry, isoCountry);
      if (countryInfo) {
        countryInfo.airportCount += 1;
      }

      const kaOverride = KNOWN_AIRPORT_KA[icaoCode] || KNOWN_AIRPORT_KA[ident];
      const nameKa = kaOverride?.name_ka || nameEn;
      const municipalityKa = kaOverride?.city_ka || municipalityEn;

      const lat = parseNumberOrNull(row.latitude_deg);
      const lon = parseNumberOrNull(row.longitude_deg);

      const record: AirportRecord = {
        id: sanitizeCell(row.id),
        ident,
        type,
        nameEn,
        nameKa,
        latitude: lat !== null && lat >= -90 && lat <= 90 ? lat : null,
        longitude: lon !== null && lon >= -180 && lon <= 180 ? lon : null,
        elevationFt: parseNumberOrNull(row.elevation_ft),
        continent: sanitizeCell(row.continent),
        isoCountry,
        countryEn,
        countryKa,
        isoRegion: sanitizeCell(row.iso_region),
        municipalityEn,
        municipalityKa,
        scheduledService: sanitizeCell(row.scheduled_service).toLowerCase() === 'yes',
        icaoCode,
        iataCode,
        gpsCode,
        localCode,
        keywords,
        searchText: [
          ident,
          iataCode,
          icaoCode,
          gpsCode,
          nameEn,
          nameKa,
          municipalityEn,
          municipalityKa,
          isoCountry,
          countryEn,
          countryKa,
          keywords,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
      };

      airports.push(record);
      byIdent.set(ident, record);
      typeCounts[type] = (typeCounts[type] || 0) + 1;

      if (iataCode) {
        const list = byIata.get(iataCode) || [];
        list.push(record);
        byIata.set(iataCode, list);
      }
      if (icaoCode) {
        const list = byIcao.get(icaoCode) || [];
        list.push(record);
        byIcao.set(icaoCode, list);
      }
      if (isoCountry) {
        const list = byCountry.get(isoCountry) || [];
        list.push(record);
        byCountry.set(isoCountry, list);
      }
    }

    airports.sort((a, b) => {
      const pa = TYPE_PRIORITY[a.type] ?? 99;
      const pb = TYPE_PRIORITY[b.type] ?? 99;
      if (pa !== pb) return pa - pb;
      if (a.iataCode && !b.iataCode) return -1;
      if (!a.iataCode && b.iataCode) return 1;
      return a.nameEn.localeCompare(b.nameEn);
    });

    const countries = Array.from(countryMap.values()).sort((a, b) =>
      a.nameEn.localeCompare(b.nameEn)
    );

    this.snapshot = {
      airports,
      countries,
      byIdent,
      byIata,
      byIcao,
      byCountry,
      typeCounts,
      loadedAt: new Date().toISOString(),
      source,
    };

    return this.snapshot;
  }

  getSnapshot(): StoreSnapshot {
    if (!this.snapshot) {
      throw new Error('AirportStore not initialized');
    }
    return this.snapshot;
  }

  isSyncing(): boolean {
    return this.syncLock;
  }

  getLastSyncError(): string | null {
    return this.lastSyncError;
  }

  private async downloadSafeCsv(urlStr: string): Promise<string> {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:' || !ALLOWED_UPSTREAM_HOSTS.has(parsed.hostname)) {
      throw new Error(`Blocked upstream URL host: ${parsed.hostname}`);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(parsed.toString(), { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`Upstream HTTP ${res.status}`);
      }
      const contentLength = Number(res.headers.get('content-length') || 0);
      if (contentLength > MAX_DOWNLOAD_BYTES) {
        throw new Error('Upstream file exceeds 25MB limit');
      }
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_DOWNLOAD_BYTES) {
        throw new Error('Downloaded payload exceeds 25MB limit');
      }
      return new TextDecoder('utf-8').decode(buf);
    } finally {
      clearTimeout(timer);
    }
  }

  async syncFromUpstream(rawBaseUrl: string): Promise<{ totalAirports: number; loadedAt: string }> {
    if (this.syncLock) {
      throw new Error('SYNC_IN_PROGRESS');
    }
    this.syncLock = true;
    this.lastSyncError = null;

    const base = rawBaseUrl.replace(/\/+$/, '');
    try {
      const [airportsCsv, countriesCsv] = await Promise.all([
        this.downloadSafeCsv(`${base}/airports.csv`),
        this.downloadSafeCsv(`${base}/countries.csv`),
      ]);

      if (!airportsCsv.includes('"ident"') || !countriesCsv.includes('"code"')) {
        throw new Error('Invalid CSV header received from upstream');
      }

      const airportsTmp = path.join(this.rootDir, 'airports.csv.tmp');
      const countriesTmp = path.join(this.rootDir, 'countries.csv.tmp');

      await Promise.all([
        fsp.writeFile(airportsTmp, airportsCsv, 'utf8'),
        fsp.writeFile(countriesTmp, countriesCsv, 'utf8'),
      ]);

      await Promise.all([
        fsp.rename(airportsTmp, path.join(this.rootDir, 'airports.csv')),
        fsp.rename(countriesTmp, path.join(this.rootDir, 'countries.csv')),
      ]);

      const snap = await this.loadFromDisk(`upstream:${base}`);
      return { totalAirports: snap.airports.length, loadedAt: snap.loadedAt };
    } catch (err: any) {
      this.lastSyncError = err?.message || 'Unknown sync error';
      throw err;
    } finally {
      this.syncLock = false;
    }
  }

  findByCode(code: string): AirportRecord[] {
    const snap = this.getSnapshot();
    const norm = code.trim().toUpperCase();
    if (!norm) return [];

    const results: AirportRecord[] = [];
    const seen = new Set<string>();

    const pushUnique = (a?: AirportRecord) => {
      if (a && !seen.has(a.ident)) {
        seen.add(a.ident);
        results.push(a);
      }
    };

    for (const a of snap.byIata.get(norm) || []) pushUnique(a);
    for (const a of snap.byIcao.get(norm) || []) pushUnique(a);
    pushUnique(snap.byIdent.get(norm));

    return results;
  }

  search(params: {
    q?: string;
    country?: string;
    types?: string[];
    excludeClosed?: boolean;
    limit: number;
    offset: number;
  }): { total: number; items: AirportRecord[] } {
    const snap = this.getSnapshot();
    const q = (params.q || '').trim().toLowerCase();
    const country = (params.country || '').trim().toUpperCase();
    const typeSet = params.types && params.types.length > 0 ? new Set(params.types) : null;

    let pool: AirportRecord[];
    if (country) {
      pool = snap.byCountry.get(country) || [];
    } else {
      pool = snap.airports;
    }

    const qUpper = q.toUpperCase();
    const exactMatches: AirportRecord[] = [];
    const otherMatches: AirportRecord[] = [];

    for (const a of pool) {
      if (params.excludeClosed && a.type === 'closed') continue;
      if (typeSet && !typeSet.has(a.type)) continue;

      if (!q) {
        otherMatches.push(a);
        continue;
      }

      if (!a.searchText.includes(q)) continue;

      if (a.iataCode === qUpper || a.icaoCode === qUpper || a.ident === qUpper) {
        exactMatches.push(a);
      } else {
        otherMatches.push(a);
      }
    }

    const combined = exactMatches.length > 0 ? [...exactMatches, ...otherMatches] : otherMatches;
    return {
      total: combined.length,
      items: combined.slice(params.offset, params.offset + params.limit),
    };
  }
}
