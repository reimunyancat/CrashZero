from __future__ import annotations
import json
import math
import random
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
NORM = ROOT / 'ml' / 'data' / 'norm'
PROC = ROOT / 'ml' / 'data' / 'processed'
PROC.mkdir(parents=True, exist_ok=True)

HIGHWAY_BASE_RISK = {
    'motorway': 0.36, 'trunk': 0.34, 'primary': 0.32, 'secondary': 0.28,
    'tertiary': 0.24, 'unclassified': 0.18, 'residential': 0.17,
    'living_street': 0.16, 'service': 0.13, 'pedestrian': 0.12,
    'cycleway': 0.11, 'footway': 0.10, 'path': 0.09, 'steps': 0.08,
}

FEATURES = [
    'highway_class_base',
    'nearest_segment_dist_m',
    'school_zone_count_300m',
    'log_nearest_school_zone_dist',
    'cctv_count_300m',
    'blackspot_count_500m',
    'mean_occrrnc_500m',
    'is_yeongdeungpo',
]


def hav(lat1, lon1, lat2, lon2):
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * R * math.asin(math.sqrt(h))


def seg_centroid(seg):
    g = seg['geometry']
    return g[len(g)//2]


def seg_length_km(seg):
    g = seg['geometry']
    if len(g) < 2:
        return 0.05
    t = 0.0
    for i in range(len(g) - 1):
        t += hav(g[i][1], g[i][0], g[i+1][1], g[i+1][0])
    return t / 1000.0


def nearest_segment(lat, lon, segments):
    best_d = 1e18
    best = None
    for s in segments:
        c = seg_centroid(s)
        d = hav(lat, lon, c[1], c[0])
        if d < best_d:
            best_d = d
            best = s
    return best, best_d


def school_features(lat, lon, schools):
    cnt = 0
    cctv = 0
    widths = []
    nearest = 1e18
    for z in schools:
        d = hav(lat, lon, z['lat'], z['lon'])
        if d <= 300:
            cnt += 1
            cctv += int(z.get('cctv_count') or 0)
            w = z.get('road_width') or 0
            if w:
                widths.append(w)
        if d < nearest:
            nearest = d
    mean_w = (sum(widths) / len(widths)) if widths else 0.0
    return cnt, min(nearest, 5000.0), cctv, mean_w


def blackspot_density(lat, lon, blackspots, exclude_id=None, radius=500.0):
    cnt = 0
    occ_sum = 0
    for b in blackspots:
        if exclude_id is not None and b['id'] == exclude_id:
            continue
        d = hav(lat, lon, b['centroid'][1], b['centroid'][0])
        if d <= radius:
            cnt += 1
            occ_sum += int(b.get('occrrnc_cnt') or 0)
    mean_occ = (occ_sum / cnt) if cnt else 0.0
    return cnt, mean_occ


def build_row(label, sid, year, gugun_cd, lat, lon, segments, schools, blackspots, exclude_id=None, occ=0):
    import math as _m
    seg, seg_d = nearest_segment(lat, lon, segments)
    sc_cnt, sc_d, sc_cctv, sc_w = school_features(lat, lon, schools)
    bs_cnt, bs_mean_occ = blackspot_density(lat, lon, blackspots, exclude_id=exclude_id)
    return {
        'sample_id': sid,
        'y': label,
        'year': year,
        'gugun_cd': gugun_cd,
        'lat': round(lat, 7),
        'lon': round(lon, 7),
        'is_yeongdeungpo': 1 if gugun_cd == '560' else 0,
        'highway_class_base': HIGHWAY_BASE_RISK.get(seg['highway'], 0.18),
        'nearest_segment_dist_m': round(seg_d, 2),
        'segment_length_km': round(seg_length_km(seg), 4),
        'school_zone_count_300m': sc_cnt,
        'nearest_school_zone_dist_m': round(sc_d, 2),
        'log_nearest_school_zone_dist': round(_m.log1p(sc_d), 4),
        'cctv_count_300m': sc_cctv,
        'mean_road_width': round(sc_w, 3),
        'blackspot_count_500m': bs_cnt,
        'mean_occrrnc_500m': round(bs_mean_occ, 3),
        'occrrnc_cnt': occ,
        'link_id': seg['link_id'],
        'highway': seg.get('highway', 'unclassified'),
        'name': seg.get('name', ''),
    }


def main():
    blackspots = json.loads((NORM / 'koroad_blackspots.json').read_text(encoding='utf-8'))
    schools = json.loads((NORM / 'school_zones_seoul.json').read_text(encoding='utf-8'))
    segments = json.loads((NORM / 'road_segments.json').read_text(encoding='utf-8'))

    pos_pts = [(b['centroid'][1], b['centroid'][0]) for b in blackspots]
    rng = random.Random(42)
    rows = []

    for b in blackspots:
        lon, lat = b['centroid']
        rows.append(build_row(1, f"pos-{b['id']}", b['year'], b['gugun_cd'], lat, lon, segments, schools, blackspots, exclude_id=b['id'], occ=b['occrrnc_cnt']))

    skipped = 0
    for b in blackspots:
        plat, plon = b['centroid'][1], b['centroid'][0]
        placed = False
        for k in range(50):
            r = 0.005 + rng.random() * 0.013
            theta = rng.random() * 2 * math.pi
            dlat = r * math.cos(theta)
            dlon = r * math.sin(theta) * 1.2
            nlat, nlon = plat + dlat, plon + dlon
            min_d = min(hav(nlat, nlon, p[0], p[1]) for p in pos_pts)
            if min_d > 450:
                rows.append(build_row(0, f"neg-{b['id']}-{k}", b['year'], b['gugun_cd'], nlat, nlon, segments, schools, blackspots, exclude_id=None, occ=0))
                placed = True
                break
        if not placed:
            skipped += 1

    df = pd.DataFrame(rows)
    df.to_csv(PROC / 'panel.csv', index=False)
    df.head(50).to_csv(PROC / 'panel_head.csv', index=False)

    summary = {
        'rows': int(len(df)),
        'positives': int((df['y'] == 1).sum()),
        'negatives': int((df['y'] == 0).sum()),
        'yeongdeungpo_positives': int(((df['y'] == 1) & (df['is_yeongdeungpo'] == 1)).sum()),
        'years': sorted(int(y) for y in df['year'].unique()),
        'features': FEATURES,
        'neg_skipped': skipped,
    }
    (PROC / 'panel_summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
