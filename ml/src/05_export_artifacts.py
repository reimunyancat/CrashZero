from __future__ import annotations
import hashlib
import json
import time
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
PROC = ROOT / 'ml' / 'data' / 'processed'
NORM = ROOT / 'ml' / 'data' / 'norm'
ART = ROOT / 'ml' / 'artifacts'
ART.mkdir(parents=True, exist_ok=True)
FEATURES = json.loads((ART / 'feature_names.json').read_text(encoding='utf-8'))

HIGHWAY_BASE_RISK = {
    'motorway': 0.36, 'trunk': 0.34, 'primary': 0.32, 'secondary': 0.28,
    'tertiary': 0.24, 'unclassified': 0.18, 'residential': 0.17,
    'living_street': 0.16, 'service': 0.13, 'pedestrian': 0.12,
    'cycleway': 0.11, 'footway': 0.10, 'path': 0.09, 'steps': 0.08,
}


def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-np.clip(z, -50, 50)))


def predict_all(X):
    npz = np.load(ART / 'model.npz')
    z = X @ npz['logistic_w'] + npz['logistic_b'][0]
    lr = npz['stump_lr'][0]
    for j in range(len(npz['stump_feature'])):
        feat = int(npz['stump_feature'][j])
        thr = npz['stump_threshold'][j]
        left = npz['stump_left'][j]
        right = npz['stump_right'][j]
        z = z + lr * np.where(X[:, feat] <= thr, left, right)
    return sigmoid(z)


def sha(path):
    h = hashlib.sha256()
    h.update(Path(path).read_bytes())
    return h.hexdigest()[:16]


def hav(lat1, lon1, lat2, lon2):
    import math
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * R * math.asin(math.sqrt(h))


def seg_features(seg, blackspots, schools, year):
    import math
    g = seg['geometry']
    mid = g[len(g)//2]
    lon, lat = mid[0], mid[1]
    bs_cnt = 0
    occ_sum = 0
    for b in blackspots:
        if int(b.get('year') or 0) != year:
            continue
        d = hav(lat, lon, b['centroid'][1], b['centroid'][0])
        if d <= 500:
            bs_cnt += 1
            occ_sum += int(b.get('occrrnc_cnt') or 0)
    mean_occ = (occ_sum / bs_cnt) if bs_cnt else 0.0

    sc_cnt = 0
    sc_cctv = 0
    nearest = 1e18
    for z in schools:
        d = hav(lat, lon, z['lat'], z['lon'])
        if d <= 300:
            sc_cnt += 1
            sc_cctv += int(z.get('cctv_count') or 0)
        if d < nearest:
            nearest = d
    is_yd = 1 if (37.4915 <= lat <= 37.547 and 126.878 <= lon <= 126.943) else 0
    return {
        'highway_class_base': HIGHWAY_BASE_RISK.get(seg.get('highway', 'unclassified'), 0.18),
        'nearest_segment_dist_m': 0.0,
        'school_zone_count_300m': sc_cnt,
        'log_nearest_school_zone_dist': float(np.log1p(min(nearest, 5000.0))),
        'cctv_count_300m': sc_cctv,
        'blackspot_count_500m': bs_cnt,
        'mean_occrrnc_500m': float(mean_occ),
        'is_yeongdeungpo': is_yd,
    }


def band(r):
    if r >= 0.75: return 'very_high'
    if r >= 0.55: return 'high'
    if r >= 0.35: return 'medium'
    if r >= 0.20: return 'low'
    return 'very_low'


def main():
    segments = json.loads((NORM / 'road_segments.json').read_text(encoding='utf-8'))
    blackspots = json.loads((NORM / 'koroad_blackspots.json').read_text(encoding='utf-8'))
    schools = json.loads((NORM / 'school_zones_seoul.json').read_text(encoding='utf-8'))

    latest_year = max(int(b.get('year') or 0) for b in blackspots) if blackspots else 2024

    rows = []
    for seg in segments:
        feats = seg_features(seg, blackspots, schools, latest_year)
        rows.append({
            'link_id': seg['link_id'],
            'name': seg.get('name', ''),
            'highway': seg.get('highway', 'unclassified'),
            'geometry': seg['geometry'],
            'source': seg.get('source', 'fixture'),
            **feats,
        })

    df = pd.DataFrame(rows)
    X = df[FEATURES].to_numpy(dtype=float)
    df['risk'] = predict_all(X)
    df['risk_band'] = df['risk'].apply(band)

    predictions = []
    for _, r in df.sort_values('risk', ascending=False).iterrows():
        predictions.append({
            'link_id': r['link_id'],
            'name': r['name'],
            'highway': r['highway'],
            'source': r['source'],
            'geometry': r['geometry'],
            'risk': float(r['risk']),
            'risk_band': r['risk_band'],
            'blackspot_count_500m': int(r['blackspot_count_500m']),
            'mean_occrrnc_500m': float(r['mean_occrrnc_500m']),
            'school_zone_count_300m': int(r['school_zone_count_300m']),
            'cctv_count_300m': int(r['cctv_count_300m']),
        })
    (ART / 'predictions.json').write_text(
        json.dumps(predictions, ensure_ascii=False, indent=2), encoding='utf-8'
    )

    manifest = {
        'generated_at': int(time.time()),
        'feature_names': FEATURES,
        'n_links': int(df.shape[0]),
        'latest_year': latest_year,
        'model_hash': sha(ART / 'model.npz'),
        'metrics': json.loads((ART / 'metrics.json').read_text(encoding='utf-8')),
        'data_sources': {
            'koroad_blackspots': len(blackspots),
            'school_zones_seoul': len(schools),
            'segments': len(segments),
        },
    }
    (ART / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({
        'n_links': manifest['n_links'],
        'latest_year': latest_year,
        'top3': [{'link_id': p['link_id'], 'name': p['name'], 'risk': round(p['risk'], 3)} for p in predictions[:3]],
    }, indent=2, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
