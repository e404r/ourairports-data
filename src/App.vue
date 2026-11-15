<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
  Plane,
  Search,
  Globe,
  Database,
  Clock,
  Languages,
  ShieldCheck,
  Terminal,
  MapPin,
  Loader2,
  Github,
  ExternalLink,
} from 'lucide-vue-next';
import SearchableSelect, { type SelectOption } from './components/SearchableSelect.vue';

type Lang = 'ka' | 'en';

interface HealthData {
  status: string;
  total_airports: number;
  total_countries: number;
  type_counts: Record<string, number>;
  loaded_at: string;
  source: string;
}

interface AirportItem {
  id: string;
  ident: string;
  iata_code: string | null;
  icao_code: string | null;
  type: string;
  type_label: string;
  name: string;
  name_en: string;
  name_ka: string;
  city: string | null;
  iso_country: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

interface CountryItem {
  code: string;
  name: string;
  airport_count: number;
}

const lang = ref<Lang>('en');
const health = ref<HealthData | null>(null);
const countries = ref<CountryItem[]>([]);
const items = ref<AirportItem[]>([]);
const totalResults = ref(0);
const loading = ref(false);
const errorMsg = ref('');

const query = ref('Kutaisi');
const selectedCountry = ref('');
const selectedType = ref('');
const excludeClosed = ref(false);

const t = computed(() =>
  lang.value === 'ka'
    ? {
        title: 'მსოფლიო აეროპორტების API',
        subtitle: 'დაცული REST API + ავტომატური სინქრონიზაცია e404r/ourairports-data ფორკიდან',
        totalAirports: 'სულ აეროპორტი',
        countriesCount: 'ქვეყანა',
        lastSync: 'ბოლო ჩატვირთვა',
        searchPlaceholder: 'ძებნა: IATA (KUT), ICAO (UGKO), ქალაქი ან სახელი...',
        allCountries: 'ყველა ქვეყანა',
        searchCountry: 'ქვეყნის ძებნა...',
        allTypes: 'ყველა ტიპი',
        searchType: 'ტიპის ძებნა...',
        excludeClosed: 'დახურულების გამორიცხვა',
        found: 'ნაპოვნია',
        code: 'კოდი (IATA / ICAO)',
        name: 'აეროპორტი',
        location: 'ქალაქი / ქვეყანა',
        type: 'ტიპი',
        coords: 'კოორდინატები',
        endpointsTitle: 'API ენდპოინტები და უსაფრთხოება',
        syncNote: 'POST /api/v1/sync დაცულია X-API-Key ჰედერით, rate-limit-ით და SSRF allowlist-ით.',
        noResults: 'აეროპორტი ვერ მოიძებნა',
      }
    : {
        title: 'World Airports API',
        subtitle: 'Secure REST API + Automated Upstream Sync via e404r/ourairports-data',
        totalAirports: 'Total Airports',
        countriesCount: 'Countries',
        lastSync: 'Last Loaded',
        searchPlaceholder: 'Search IATA (KUT), ICAO (UGKO), city or airport name...',
        allCountries: 'All Countries',
        searchCountry: 'Search country...',
        allTypes: 'All Types',
        searchType: 'Search type...',
        excludeClosed: 'Exclude Closed',
        found: 'Found',
        code: 'Code (IATA / ICAO)',
        name: 'Airport',
        location: 'City / Country',
        type: 'Type',
        coords: 'Coordinates',
        endpointsTitle: 'API Endpoints & Security',
        syncNote: 'POST /api/v1/sync is protected with X-API-Key, rate limiting & SSRF allowlist.',
        noResults: 'No airports found',
      }
);

const countryOptions = computed<SelectOption[]>(() =>
  countries.value.map((c) => ({
    value: c.code,
    label: `${c.code} — ${c.name}`,
    sublabel: String(c.airport_count),
  }))
);

const typeOptions = computed<SelectOption[]>(() => {
  const isKa = lang.value === 'ka';
  return [
    { value: 'large_airport', label: isKa ? 'დიდი აეროპორტი' : 'Large Airport', sublabel: 'large_airport' },
    { value: 'medium_airport', label: isKa ? 'საშუალო აეროპორტი' : 'Medium Airport', sublabel: 'medium_airport' },
    { value: 'small_airport', label: isKa ? 'მცირე აეროპორტი' : 'Small Airport', sublabel: 'small_airport' },
    { value: 'heliport', label: isKa ? 'ვერტოდრომი' : 'Heliport', sublabel: 'heliport' },
    { value: 'seaplane_base', label: isKa ? 'ჰიდროაეროდრომი' : 'Seaplane Base', sublabel: 'seaplane_base' },
    { value: 'balloonport', label: isKa ? 'აეროსტატის სადგური' : 'Balloonport', sublabel: 'balloonport' },
    { value: 'closed', label: isKa ? 'დახურული' : 'Closed', sublabel: 'closed' },
  ];
});

async function fetchHealthAndCountries() {
  try {
    const [hRes, cRes] = await Promise.all([
      fetch(`/api/v1/health?lang=${lang.value}`),
      fetch(`/api/v1/countries?lang=${lang.value}`),
    ]);
    if (hRes.ok) health.value = await hRes.json();
    if (cRes.ok) {
      const cData = await cRes.json();
      countries.value = cData.items || [];
    }
  } catch (err: any) {
    errorMsg.value = err?.message || 'Connection error';
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function searchAirports() {
  loading.value = true;
  errorMsg.value = '';
  try {
    const params = new URLSearchParams({
      lang: lang.value,
      limit: '25',
      exclude_closed: String(excludeClosed.value),
    });
    if (query.value.trim()) params.set('q', query.value.trim());
    if (selectedCountry.value) params.set('country', selectedCountry.value);
    if (selectedType.value) params.set('types', selectedType.value);

    const res = await fetch(`/api/v1/airports?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    items.value = data.items || [];
    totalResults.value = data.total || 0;
  } catch (err: any) {
    errorMsg.value = err?.message || 'Search failed';
  } finally {
    loading.value = false;
  }
}

function scheduleSearch() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(searchAirports, 200);
}

watch([query, selectedCountry, selectedType, excludeClosed], scheduleSearch);
watch(lang, () => {
  fetchHealthAndCountries();
  searchAirports();
});

onMounted(() => {
  fetchHealthAndCountries();
  searchAirports();
});
</script>

<template>
  <div class="relative min-h-screen bg-[#060b18] text-slate-100 overflow-x-hidden">
    <!-- Aviation Radar & Flight-Path Atmospheric Background -->
    <div class="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden="true">
      <div class="absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full bg-blue-600/15 blur-[130px]"></div>
      <div class="absolute top-1/3 -right-40 w-[480px] h-[480px] rounded-full bg-cyan-500/10 blur-[130px]"></div>
      <div class="absolute -bottom-40 left-1/3 w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[140px]"></div>

      <!-- Subtle Aviation Radar Rings & Flight Arcs -->
      <svg
        class="absolute inset-0 w-full h-full opacity-[0.14]"
        viewBox="0 0 1440 900"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="aviation-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" stroke="#38bdf8" stroke-width="0.4" stroke-opacity="0.35" />
          </pattern>
        </defs>
        <rect width="1440" height="900" fill="url(#aviation-grid)" />
        <circle cx="1180" cy="220" r="140" stroke="#38bdf8" stroke-width="0.8" stroke-dasharray="4 6" />
        <circle cx="1180" cy="220" r="240" stroke="#38bdf8" stroke-width="0.7" stroke-dasharray="6 8" />
        <circle cx="1180" cy="220" r="350" stroke="#3b82f6" stroke-width="0.6" stroke-opacity="0.6" />
        <path
          d="M -60 640 Q 420 260 1180 220"
          stroke="#60a5fa"
          stroke-width="1.4"
          stroke-dasharray="6 6"
        />
        <path
          d="M 180 880 Q 680 420 1380 340"
          stroke="#34d399"
          stroke-width="1.1"
          stroke-dasharray="4 6"
        />
        <circle cx="1180" cy="220" r="4" fill="#38bdf8" />
        <circle cx="420" cy="400" r="3" fill="#60a5fa" />
      </svg>
    </div>

    <div class="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-16">
      <!-- Header -->
      <header class="flex flex-wrap items-start justify-between gap-4 mb-7">
        <div class="flex items-start gap-3.5">
          <div class="w-11 h-11 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Plane class="w-5 h-5" />
          </div>
          <div>
            <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {{ t.title }}
            </h1>
            <p class="text-sm text-slate-400 mt-0.5">{{ t.subtitle }}</p>
          </div>
        </div>

        <div class="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <Languages class="w-4 h-4 text-slate-400 ml-2 mr-1" />
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
            :class="lang === 'en' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'"
            @click="lang = 'en'"
          >
            ENG (EN)
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
            :class="lang === 'ka' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'"
            @click="lang = 'ka'"
          >
            ქარ (KA)
          </button>
        </div>
      </header>

      <!-- Stats -->
      <section v-if="health" class="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
        <div class="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 flex items-center gap-3.5">
          <div class="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
            <Database class="w-5 h-5" />
          </div>
          <div>
            <span class="text-xs text-slate-400 block">{{ t.totalAirports }}</span>
            <strong class="text-xl font-bold text-white">{{ health.total_airports.toLocaleString() }}</strong>
          </div>
        </div>

        <div class="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 flex items-center gap-3.5">
          <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <Globe class="w-5 h-5" />
          </div>
          <div>
            <span class="text-xs text-slate-400 block">{{ t.countriesCount }}</span>
            <strong class="text-xl font-bold text-white">{{ health.total_countries.toLocaleString() }}</strong>
          </div>
        </div>

        <div class="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 flex items-center gap-3.5">
          <div class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
            <Clock class="w-5 h-5" />
          </div>
          <div>
            <span class="text-xs text-slate-400 block">{{ t.lastSync }}</span>
            <strong class="text-sm font-semibold text-slate-200">{{ new Date(health.loaded_at).toLocaleString() }}</strong>
          </div>
        </div>
      </section>

      <!-- Search & Searchable Dropdown Controls -->
      <section class="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center gap-3 mb-3">
        <div class="relative sm:col-span-2 lg:flex-1 lg:min-w-[260px]">
          <Search class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            v-model="query"
            type="text"
            :placeholder="t.searchPlaceholder"
            class="w-full rounded-xl border border-slate-700/80 bg-slate-900/80 backdrop-blur-md pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition"
          />
        </div>

        <SearchableSelect
          v-model="selectedCountry"
          :options="countryOptions"
          :placeholder="t.allCountries"
          :search-placeholder="t.searchCountry"
        />

        <SearchableSelect
          v-model="selectedType"
          :options="typeOptions"
          :placeholder="t.allTypes"
          :search-placeholder="t.searchType"
        />

        <label class="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none px-2 py-1 sm:col-span-2 lg:col-span-1">
          <input
            v-model="excludeClosed"
            type="checkbox"
            class="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500/50"
          />
          <span>{{ t.excludeClosed }}</span>
        </label>
      </section>

      <!-- Meta Bar -->
      <div class="flex items-center justify-between text-sm text-slate-400 mb-3 px-1">
        <span class="flex items-center gap-2">
          <span>{{ t.found }}: <strong class="text-slate-100">{{ totalResults.toLocaleString() }}</strong></span>
          <Loader2 v-if="loading" class="w-4 h-4 animate-spin text-blue-400" />
        </span>
        <span v-if="errorMsg" class="text-rose-400 font-medium">{{ errorMsg }}</span>
      </div>

      <!-- Mobile Card View (< md) -->
      <div class="md:hidden space-y-3">
        <div
          v-if="!loading && items.length === 0"
          class="rounded-2xl border border-slate-800/80 bg-slate-900/75 backdrop-blur-md p-8 text-center text-slate-500 text-sm"
        >
          {{ t.noResults }}
        </div>
        <div
          v-for="a in items"
          :key="`card-${a.ident}`"
          class="rounded-2xl border border-slate-800/80 bg-slate-900/75 backdrop-blur-md p-4 space-y-2.5 shadow-lg"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="font-mono flex items-center gap-1.5">
              <span v-if="a.iata_code" class="px-2 py-0.5 rounded-md text-xs font-bold bg-blue-600 text-white">
                {{ a.iata_code }}
              </span>
              <span class="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-800 text-slate-300">
                {{ a.icao_code || a.ident }}
              </span>
            </div>
            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
              {{ a.type_label }}
            </span>
          </div>
          <div>
            <div class="font-semibold text-slate-100 text-sm">{{ a.name }}</div>
            <div v-if="lang === 'ka' && a.name_ka !== a.name_en" class="text-xs text-slate-400 mt-0.5">
              {{ a.name_en }}
            </div>
          </div>
          <div class="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/70 text-xs text-slate-400">
            <span class="inline-flex items-center gap-1.5 text-slate-300">
              <MapPin class="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>{{ a.city ? `${a.city}, ` : '' }}{{ a.country }} ({{ a.iso_country }})</span>
            </span>
            <span class="font-mono">
              {{
                a.latitude !== null && a.longitude !== null
                  ? `${a.latitude.toFixed(3)}, ${a.longitude.toFixed(3)}`
                  : '—'
              }}
            </span>
          </div>
        </div>
      </div>

      <!-- Desktop / Tablet Table View (>= md) -->
      <div class="hidden md:block overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-900/75 backdrop-blur-md shadow-xl">
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-slate-800 bg-slate-950/50 text-left text-xs uppercase tracking-wider text-slate-400">
              <th class="px-4 py-3 font-semibold">{{ t.code }}</th>
              <th class="px-4 py-3 font-semibold">{{ t.name }}</th>
              <th class="px-4 py-3 font-semibold">{{ t.location }}</th>
              <th class="px-4 py-3 font-semibold">{{ t.type }}</th>
              <th class="px-4 py-3 font-semibold">{{ t.coords }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/70">
            <tr v-if="!loading && items.length === 0">
              <td colspan="5" class="px-4 py-10 text-center text-slate-500">
                {{ t.noResults }}
              </td>
            </tr>
            <tr v-for="a in items" :key="a.ident" class="hover:bg-slate-800/40 transition-colors">
              <td class="px-4 py-3 font-mono whitespace-nowrap">
                <span
                  v-if="a.iata_code"
                  class="inline-block px-2 py-0.5 rounded-md text-xs font-bold bg-blue-600 text-white mr-1.5"
                >
                  {{ a.iata_code }}
                </span>
                <span class="inline-block px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-800 text-slate-300">
                  {{ a.icao_code || a.ident }}
                </span>
              </td>
              <td class="px-4 py-3">
                <div class="font-semibold text-slate-100">{{ a.name }}</div>
                <div v-if="lang === 'ka' && a.name_ka !== a.name_en" class="text-xs text-slate-400 mt-0.5">
                  {{ a.name_en }}
                </div>
              </td>
              <td class="px-4 py-3 text-slate-300">
                <span class="inline-flex items-center gap-1.5">
                  <MapPin class="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{{ a.city ? `${a.city}, ` : '' }}{{ a.country }} ({{ a.iso_country }})</span>
                </span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                  {{ a.type_label }}
                </span>
              </td>
              <td class="px-4 py-3 font-mono text-xs text-slate-400 whitespace-nowrap">
                {{
                  a.latitude !== null && a.longitude !== null
                    ? `${a.latitude.toFixed(4)}, ${a.longitude.toFixed(4)}`
                    : '—'
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- API Endpoints -->
      <section class="mt-7 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
        <div class="flex items-center gap-2 mb-3">
          <Terminal class="w-4 h-4 text-blue-400" />
          <h2 class="text-base font-semibold text-white">{{ t.endpointsTitle }}</h2>
        </div>
        <ul class="space-y-2 text-sm">
          <li>
            <code class="px-2 py-1 rounded-md bg-slate-950 text-blue-300 font-mono text-xs">
              GET /api/v1/health?lang={{ lang }}
            </code>
          </li>
          <li>
            <code class="px-2 py-1 rounded-md bg-slate-950 text-blue-300 font-mono text-xs">
              GET /api/v1/airports?q=kutaisi&amp;lang={{ lang }}&amp;limit=25
            </code>
          </li>
          <li>
            <code class="px-2 py-1 rounded-md bg-slate-950 text-blue-300 font-mono text-xs">
              GET /api/v1/airports/KUT?lang={{ lang }}
            </code>
          </li>
          <li>
            <code class="px-2 py-1 rounded-md bg-slate-950 text-blue-300 font-mono text-xs">
              GET /api/v1/countries?lang={{ lang }}
            </code>
          </li>
          <li class="flex flex-wrap items-center gap-2 pt-1">
            <code class="px-2 py-1 rounded-md bg-slate-950 text-emerald-300 font-mono text-xs">
              POST /api/v1/sync
            </code>
            <span class="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <ShieldCheck class="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              {{ t.syncNote }}
            </span>
          </li>
        </ul>
      </section>

      <!-- Footer Attribution -->
      <footer class="mt-6 flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-slate-400">
        <div class="flex flex-wrap items-center gap-4">
          <a
            href="https://github.com/e404r/ourairports-data"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 hover:text-blue-400 transition"
          >
            <Github class="w-4 h-4" />
            <span>e404r/ourairports-data</span>
            <ExternalLink class="w-3 h-3" />
          </a>
          <a
            href="https://github.com/davidmegginson/ourairports-data"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 hover:text-emerald-400 transition"
          >
            <span>Upstream: davidmegginson/ourairports-data</span>
            <ExternalLink class="w-3 h-3" />
          </a>
        </div>
        <a
          href="https://github.com/e404r"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 hover:text-blue-400 transition font-mono"
        >
          <span>@e404r</span>
        </a>
      </footer>
    </div>
  </div>
</template>
