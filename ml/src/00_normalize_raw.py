from __future__ import annotations
import csv
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'ml' / 'data' / 'raw'
NORM = ROOT / 'ml' / 'data' / 'norm'
NORM.mkdir(parents=True, exist_ok=True)

YD_BBOX = (37.4915, 126.8780, 37.5470, 126.9430)
SEOUL_GUGUN = {
    '110': 'Jongno', '140': 'Jung', '170': 'Yongsan', '200': 'Seongdong',
    '215': 'Gwangjin', '230': 'Dongdaemun', '260': 'Jungnang', '290': 'Seongbuk',
    '305': 'Gangbuk', '320': 'Dobong', '350': 'Nowon', '380': 'Eunpyeong',
    '410': 'Seodaemun', '440': 'Mapo', '470': 'Yangcheon', '500': 'Gangseo',
    '530': 'Guro', '545': 'Geumcheon', '560': 'Yeongdeungpo', '590': 'Dongjak',
    '620': 'Gwanak', '650': 'Seocho', '680': 'Gangnam', '710': 'Songpa', '740': 'Gangdong',
}


def centroid_of_polygon(coords):
    n = len(coords)
    if n == 0:
        return None
    sx = sum(p[0] for p in coords) / n
    sy = sum(p[1] for p in coords) / n
    return [round(sx, 7), round(sy, 7)]


def parse_koroad_year(path, year):
    raw = json.loads(path.read_text(encoding='utf-8'))
    out = []
    for gugun_cd, gugun_block in (raw.get('byGugun') or {}).items():
        items = ((gugun_block.get('items') or {}).get('item')) or []
        if isinstance(items, dict):
            items = [items]
        for it in items:
            geom = it.get('geom_json')
            if not geom:
                continue
            try:
                g = json.loads(geom)
                ring = g['coordinates'][0]
            except Exception:
                continue
            c = centroid_of_polygon(ring)
            if c is None:
                continue
            out.append({
                'id': f"{year}-{it.get('afos_fid') or it.get('spot_cd')}",
                'year': year,
                'gugun_cd': gugun_cd,
                'gugun_name': SEOUL_GUGUN.get(gugun_cd, gugun_cd),
                'spot_nm': (it.get('spot_nm') or '').strip(),
                'sido_sgg_nm': (it.get('sido_sgg_nm') or '').strip(),
                'centroid': c,
                'polygon': ring,
                'occrrnc_cnt': int(it.get('occrrnc_cnt') or 0),
                'caslt_cnt': int(it.get('caslt_cnt') or 0),
                'dth_dnv_cnt': int(it.get('dth_dnv_cnt') or 0),
                'se_dnv_cnt': int(it.get('se_dnv_cnt') or 0),
                'sl_dnv_cnt': int(it.get('sl_dnv_cnt') or 0),
                'wnd_dnv_cnt': int(it.get('wnd_dnv_cnt') or 0),
            })
    return out


def build_koroad():
    rows = []
    for y in (2022, 2023, 2024):
        p = RAW / f'koroad_lg_seoul_{y}.json'
        if not p.exists():
            print(f'[norm] miss {p.name}')
            continue
        rows.extend(parse_koroad_year(p, y))
    (NORM / 'koroad_blackspots.json').write_text(
        json.dumps(rows, ensure_ascii=False), encoding='utf-8'
    )
    yd = [r for r in rows if r['gugun_cd'] == '560']
    print(f'[norm] koroad total={len(rows)} yeongdeungpo={len(yd)}')
    return rows


def _parse_width(v):
    if v is None:
        return 0.0
    s = str(v).strip()
    if not s:
        return 0.0
    if '~' in s:
        parts = s.split('~')
        try:
            return (float(parts[0]) + float(parts[1])) / 2.0
        except ValueError:
            return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def build_school_zones():
    src = RAW / 'school_zone.csv'
    if not src.exists():
        print('[norm] miss school_zone.csv')
        return []
    text = src.read_bytes().decode('cp949', errors='replace')
    reader = csv.DictReader(text.splitlines())
    rows = []
    for r in reader:
        addr = (r.get('소재지도로명주소') or r.get('소재지지번주소') or '').strip()
        if not addr.startswith('서울'):
            continue
        try:
            lat = float(r.get('위도') or '')
            lon = float(r.get('경도') or '')
        except ValueError:
            continue
        rows.append({
            'facility_type': (r.get('시설종류') or '').strip(),
            'facility_name': (r.get('대상시설명') or '').strip(),
            'address': addr,
            'lat': lat,
            'lon': lon,
            'agency': (r.get('관리기관명') or '').strip(),
            'police': (r.get('관할경찰서명') or '').strip(),
            'cctv_installed': (r.get('CCTV설치여부') or '').strip() in ('Y', 'y', '1', 'true'),
            'cctv_count': int(float(r.get('CCTV설치대수') or 0) or 0),
            'road_width': _parse_width(r.get('보호구역도로폭')),
        })
    (NORM / 'school_zones_seoul.json').write_text(
        json.dumps(rows, ensure_ascii=False), encoding='utf-8'
    )
    yd = [r for r in rows if YD_BBOX[0] <= r['lat'] <= YD_BBOX[2] and YD_BBOX[1] <= r['lon'] <= YD_BBOX[3]]
    print(f'[norm] school_zone seoul={len(rows)} yeongdeungpo_bbox={len(yd)}')
    return rows


def haversine_m(a, b):
    lat1, lon1 = a[1], a[0]
    lat2, lon2 = b[1], b[0]
    R = 6371000.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(h))


def build_segments(koroad_rows):
    FIX = ROOT / 'frontend' / 'public' / 'fixtures' / 'heatmap_sample.json'
    base_segments = []
    if FIX.exists():
        h = json.loads(FIX.read_text(encoding='utf-8'))
        for f in h.get('features', []):
            base_segments.append({
                'link_id': f['link_id'],
                'name': f.get('name', ''),
                'highway': f.get('highway', 'residential'),
                'geometry': f['geometry'],
                'source': 'fixture',
            })
    yd_koroad = [r for r in koroad_rows if r['gugun_cd'] == '560']
    synth = []
    for r in yd_koroad:
        c = r['centroid']
        lon, lat = c
        dlon = 0.0030
        synth.append({
            'link_id': f"syn-yd-{r['id']}",
            'name': r['spot_nm'] or f"YD-{r['id']}",
            'highway': 'secondary',
            'geometry': [[round(lon-dlon, 7), lat], [lon, lat], [round(lon+dlon, 7), lat]],
            'source': 'koroad_centroid',
            'koroad_id': r['id'],
            'koroad_year': r['year'],
        })
    dedup = []
    for s in synth:
        cx, cy = s['geometry'][1]
        dup = False
        for b in base_segments + dedup:
            bx, by = b['geometry'][len(b['geometry'])//2]
            if haversine_m([cx, cy], [bx, by]) < 60:
                dup = True
                break
        if not dup:
            dedup.append(s)
    out = base_segments + dedup
    (NORM / 'road_segments.json').write_text(
        json.dumps(out, ensure_ascii=False), encoding='utf-8'
    )
    print(f'[norm] segments base={len(base_segments)} synth_added={len(dedup)} total={len(out)}')
    return out


def main():
    k = build_koroad()
    build_school_zones()
    build_segments(k)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
