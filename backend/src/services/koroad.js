// KOROAD frequent-zone (사고다발구역) loader — data.go.kr.
// Always tries the live API; on failure (or USE_FIXTURES=true) falls back to fixtures.
import { request } from 'undici';
import { env } from '../utils/env.js';

const BASE = 'https://apis.data.go.kr/B552061';
// FrequentzoneLg (일반 사고다발구역) + FrequentzoneChild (어린이 사고다발구역)
const ENDPOINTS = {
  general: '/frequentzoneLg/getRestFrequentzoneLg',
  child: '/frequentzoneChild/getRestFrequentzoneChild',
};
// Target: 서울특별시(11) / 영등포구(560)
export const YEONGDEUNGPO = { siDo: '11', guGun: '560', name: '서울특별시 영등포구' };

async function fetchEndpoint(path, year) {
  const url = new URL(BASE + path);
  url.searchParams.set('ServiceKey', env.dataGoKrKey);
  url.searchParams.set('searchYearCd', String(year));
  url.searchParams.set('siDo', YEONGDEUNGPO.siDo);
  url.searchParams.set('guGun', YEONGDEUNGPO.guGun);
  url.searchParams.set('type', 'json');
  url.searchParams.set('numOfRows', '1000');
  url.searchParams.set('pageNo', '1');
  const res = await request(url.toString(), { headers: { Accept: 'application/json' } });
  if (res.statusCode >= 400) throw new Error(`KOROAD ${path} HTTP ${res.statusCode}`);
  const text = await res.body.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`KOROAD ${path} non-JSON response`);
  }
  const items = body?.items?.item ?? body?.response?.body?.items?.item ?? [];
  return Array.isArray(items) ? items : items ? [items] : [];
}

function normalize(item, kind, sourceWeight, year) {
  // KOROAD fields: spot_nm, sido_sgg_nm, occrrnc_cnt, caslt_cnt, dth_dnv_cnt,
  // se_dnv_cnt, sl_dnv_cnt, polygon (geojson string), geom_json.
  const lng = Number(item.lo_crd ?? item.x_crd ?? 0);
  const lat = Number(item.la_crd ?? item.y_crd ?? 0);
  return {
    id: `${item.afos_id ?? item.afos_fid ?? item.bjd_cd ?? ''}-${item.spot_nm ?? ''}`,
    type: kind === 'child' ? 'frequentzone_child' : 'frequentzone_general',
    label: item.spot_nm ?? '—',
    centroid: [lng, lat],
    radius_m: 160,
    source_year: year,
    severity: clamp01(
      Number(item.dth_dnv_cnt ?? 0) * 0.5 + Number(item.se_dnv_cnt ?? 0) * 0.3 + Number(item.sl_dnv_cnt ?? 0) * 0.1,
    ),
    crashes: Number(item.occrrnc_cnt ?? 0),
    crash_count_3y: Number(item.occrrnc_cnt ?? 0),
    source_weight: sourceWeight,
    vulnerable_weight: sourceWeight,
  };
}

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x / 10));
}

/** Returns hydrated blackspots, year filtered to the latest 3 years. */
export async function fetchBlackspots({ years = [2022, 2023, 2024] } = {}) {
  if (env.useFixtures || !env.dataGoKrKey) return null; // signal fallback
  const collected = [];
  for (const year of years) {
    for (const [kind, path] of Object.entries(ENDPOINTS)) {
      try {
        const items = await fetchEndpoint(path, year);
        const weight = kind === 'child' ? 0.16 : 0.08;
        for (const it of items) collected.push(normalize(it, kind, weight, year));
      } catch (err) {
        // Continue — partial data is still useful.
        console.warn('[koroad]', kind, year, err.message);
      }
    }
  }
  return collected;
}
