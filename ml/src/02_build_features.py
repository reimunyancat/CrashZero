"""CrashZero ML step 2: build the (link_id, year, season, peak_offpeak) panel.

Features (HSM-inspired):
  * highway_class_base
  * length_km
  * blackspot_proximity
  * peak_flag
  * season_winter / season_summer
  * has_signal_nearby (placeholder, filled from V-World when available)

Target: accident_flag (0/1) per panel row. Simulated from blackspot influence
when real label data is missing in the sandbox.

The processed panel is saved as CSV (always works) and also as parquet when
pyarrow is installed.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'ml' / 'data' / 'raw'
PROC = ROOT / 'ml' / 'data' / 'processed'
PROC.mkdir(parents=True, exist_ok=True)

HIGHWAY_BASE_RISK = {
    'motorway': 0.36, 'trunk': 0.34, 'primary': 0.32, 'secondary': 0.28,
    'tertiary': 0.24, 'unclassified': 0.18, 'residential': 0.17,
    'living_street': 0.16, 'service': 0.13, 'pedestrian': 0.12,
    'cycleway': 0.11, 'footway': 0.10, 'path': 0.09, 'steps': 0.08,
}


def haversine_km(a_lng, a_lat, b_lng, b_lat):
    R = 6371.0
    p1 = math.radians(a_lat)
    p2 = math.radians(b_lat)
    dp = math.radians(b_lat - a_lat)
    dl = math.radians(b_lng - a_lng)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def influence_from_km(km):
    if km <= 0.12:
        return 0.7
    if km <= 0.3:
        return 0.48
    if km <= 0.65:
        return 0.24
    if km <= 1.1:
        return 0.1
    return 0.0


def load_segments():
    overpass_path = RAW / 'overpass.json'
    if overpass_path.exists():
        data = json.loads(overpass_path.read_text(encoding='utf-8'))
        out = []
        for el in data.get('elements', []):
            if el.get('type') != 'way' or not el.get('geometry'):
                continue
            link_id = '35' + str(el['id'])[-5:].rjust(5, '0')
            out.append({
                'link_id': link_id,
                'highway': el.get('tags', {}).get('highway', 'unclassified'),
                'name': el.get('tags', {}).get('name', ''),
                'geometry': [[p['lon'], p['lat']] for p in el.get('geometry', [])],
            })
        return out
    fixture = RAW / 'fixture.json'
    if fixture.exists():
        return json.loads(fixture.read_text(encoding='utf-8'))['segments']
    raise FileNotFoundError('No raw data; run 01_fetch_data.py first')


def load_blackspots():
    koroad = RAW / 'koroad.json'
    if koroad.exists():
        rows = json.loads(koroad.read_text(encoding='utf-8'))
        out = []
        for r in rows:
            try:
                lng = float(r.get('lo_crd') or r.get('x_crd') or 0)
                lat = float(r.get('la_crd') or r.get('y_crd') or 0)
            except (TypeError, ValueError):
                continue
            if not lng or not lat:
                continue
            out.append({
                'id': r.get('spot_nm', ''),
                'centroid': [lng, lat],
                'severity': min(1.0, float(r.get('occrrnc_cnt', 0)) / 30.0),
                'endpoint': r.get('endpoint', ''),
            })
        return out
    fixture = RAW / 'fixture.json'
    if fixture.exists():
        return json.loads(fixture.read_text(encoding='utf-8')).get('blackspots', [])
    return []


def segment_centroid(geometry):
    if not geometry:
        return [0, 0]
    mid = geometry[len(geometry) // 2]
    return [mid[0], mid[1]]


def polyline_len_km(geometry):
    if len(geometry) < 2:
        return 0.0
    total = 0.0
    for i in range(len(geometry) - 1):
        a = geometry[i]
        b = geometry[i + 1]
        total += haversine_km(a[0], a[1], b[0], b[1])
    return total


def build_panel(segments, blackspots):
    rng = np.random.default_rng(42)
    rows = []
    years = [2021, 2022, 2023, 2024, 2025]
    seasons = ['winter', 'spring', 'summer', 'fall']
    peaks = ['peak', 'offpeak']

    for seg in segments:
        base = HIGHWAY_BASE_RISK.get(seg['highway'], 0.18)
        length_km = polyline_len_km(seg['geometry']) or 0.1
        cx, cy = segment_centroid(seg['geometry'])
        prox = 0.0
        for bs in blackspots:
            d = haversine_km(cx, cy, bs['centroid'][0], bs['centroid'][1])
            inf = influence_from_km(d) * bs.get('severity', 0.5)
            if inf > prox:
                prox = inf

        for year in years:
            for season in seasons:
                for peak in peaks:
                    p_flag = 1 if peak == 'peak' else 0
                    s_winter = 1 if season == 'winter' else 0
                    s_summer = 1 if season == 'summer' else 0
                    base_p = (
                        base * 0.35
                        + prox * 0.40
                        + length_km * 0.05
                        + p_flag * 0.10
                        + s_winter * 0.08
                        + s_summer * 0.04
                    )
                    base_p = max(0.01, min(0.95, base_p))
                    label = 1 if rng.random() < base_p * 0.25 else 0
                    rows.append({
                        'link_id': seg['link_id'],
                        'highway': seg['highway'],
                        'name': seg.get('name', ''),
                        'year': year,
                        'season': season,
                        'peak': peak,
                        'highway_class_base': base,
                        'length_km': length_km,
                        'blackspot_proximity': prox,
                        'peak_flag': p_flag,
                        'season_winter': s_winter,
                        'season_summer': s_summer,
                        'has_signal_nearby': 0,
                        'y': label,
                    })
    return pd.DataFrame(rows)


def save_panel(df, base_path):
    csv_path = base_path.with_suffix('.csv')
    df.to_csv(csv_path, index=False)
    try:
        df.to_parquet(base_path.with_suffix('.parquet'), index=False)
    except Exception as exc:
        print(f'[02_build] parquet skipped ({exc.__class__.__name__}); using CSV')


def main():
    segments = load_segments()
    blackspots = load_blackspots()
    df = build_panel(segments, blackspots)
    save_panel(df, PROC / 'panel')
    df.head(50).to_csv(PROC / 'panel_head.csv', index=False)
    summary = {
        'rows': int(len(df)),
        'links': int(df['link_id'].nunique()),
        'positive_rate': float(df['y'].mean()),
        'years': sorted(int(y) for y in df['year'].unique()),
    }
    (PROC / 'panel_summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
