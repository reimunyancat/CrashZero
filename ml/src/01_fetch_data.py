"""CrashZero ML step 1: fetch raw inputs.

In production this script hits KOROAD + OSM Overpass + KMA APIs. When the
sandbox is offline (or USE_FIXTURES=1) it falls back to the frontend fixtures
so the pipeline still produces deterministic artifacts for the demo build.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import URLError

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'ml' / 'data' / 'raw'
FIXTURES = ROOT / 'frontend' / 'public' / 'fixtures'
RAW.mkdir(parents=True, exist_ok=True)

USE_FIXTURES = os.environ.get('USE_FIXTURES', '0') in {'1', 'true', 'yes'}
DATA_KEY = os.environ.get('DATA_GO_KR_KEY', '')
OVERPASS_URL = os.environ.get('OVERPASS_URL', 'https://overpass-api.de/api/interpreter')

BBOX = (37.4915, 126.8780, 37.5470, 126.9430)
QUERY = (
    '[out:json][timeout:30];'
    'way["highway"~"^(motorway|trunk|primary|secondary|tertiary|'
    'unclassified|residential|living_street|service|pedestrian|cycleway|'
    'footway|path|steps)$"]'
    f'({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});out geom;'
)


def _http(url, *, data=None, headers=None):
    req = Request(url, data=data, headers=headers or {})
    with urlopen(req, timeout=30) as resp:
        return resp.read()


def fetch_overpass():
    if USE_FIXTURES:
        return None
    try:
        body = _http(
            OVERPASS_URL,
            data=('data=' + QUERY).encode('utf-8'),
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
        )
        return json.loads(body)
    except (URLError, TimeoutError, ValueError) as exc:
        print(f'[01_fetch] overpass failed: {exc}', file=sys.stderr)
        return None


def fetch_koroad(year, endpoint):
    if USE_FIXTURES or not DATA_KEY:
        return None
    base = 'https://apis.data.go.kr/B552061/' + endpoint
    params = {
        'ServiceKey': DATA_KEY,
        'searchYearCd': str(year),
        'siDo': '11',
        'guGun': '560',
        'type': 'json',
        'numOfRows': '1000',
        'pageNo': '1',
    }
    url = base + '?' + urlencode(params)
    try:
        body = _http(url, headers={'Accept': 'application/json'})
        data = json.loads(body)
        items = (
            data.get('items', {}).get('item')
            or data.get('response', {}).get('body', {}).get('items', {}).get('item')
            or []
        )
        return items if isinstance(items, list) else [items]
    except (URLError, TimeoutError, ValueError) as exc:
        print(f'[01_fetch] koroad {endpoint} {year} failed: {exc}', file=sys.stderr)
        return None


def fallback_from_fixture():
    with open(FIXTURES / 'heatmap_sample.json', encoding='utf-8') as f:
        heat = json.load(f)
    return {
        'source': 'fixture',
        'segments': heat['features'],
        'blackspots': heat['blackspots'],
    }


def main():
    overpass = fetch_overpass()
    if overpass and overpass.get('elements'):
        (RAW / 'overpass.json').write_text(json.dumps(overpass), encoding='utf-8')
        print(f'[01_fetch] overpass elements={len(overpass["elements"])}')

    blackspots = []
    for year in (2022, 2023, 2024):
        for endpoint in ('frequentzoneLg/getRestFrequentzoneLg', 'frequentzoneChild/getRestFrequentzoneChild'):
            items = fetch_koroad(year, endpoint)
            if items:
                blackspots.extend({'year': year, 'endpoint': endpoint, **it} for it in items)
    if blackspots:
        (RAW / 'koroad.json').write_text(json.dumps(blackspots, ensure_ascii=False), encoding='utf-8')
        print(f'[01_fetch] koroad rows={len(blackspots)}')

    if not (overpass and blackspots):
        fb = fallback_from_fixture()
        (RAW / 'fixture.json').write_text(json.dumps(fb, ensure_ascii=False), encoding='utf-8')
        print('[01_fetch] using fixture fallback')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
