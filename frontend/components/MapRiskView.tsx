'use client';

import { useEffect, useMemo, useRef } from 'react';
import maplibregl, { type Map as MLMap, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { RoadSegment } from '@/lib/types';
import type { CSSProperties } from 'react';
import { colorForScore, RISK_BAND_COLOR } from '@/lib/risk';

const containerStyle: CSSProperties = { background: '#070b12' };
const pingDotStyle: CSSProperties = { backgroundColor: RISK_BAND_COLOR.very_high };

interface Props {
  segments: RoadSegment[];
  onSelect?: (segment: RoadSegment) => void;
  selectedLinkId?: string | null;
}

const YEONGDEUNGPO_CENTER: [number, number] = [126.9042, 37.5223];
const DEFAULT_ZOOM = 13.4;

function baseStyle(vworldKey: string | undefined): StyleSpecification {
  // V-World tiles need a key. Without one we fall back to a dark Carto basemap so the
  // dashboard still renders for demos.
  const tiles = vworldKey
    ? [
        `https://api.vworld.kr/req/wmts/1.0.0/${vworldKey}/midnight/{z}/{y}/{x}.png`,
      ]
    : ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'];
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      base: {
        type: 'raster',
        tiles,
        tileSize: 256,
        attribution: vworldKey ? '© V-World' : '© OpenStreetMap, © CARTO',
      },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#070b12' } },
      { id: 'base', type: 'raster', source: 'base', minzoom: 0, maxzoom: 22 },
    ],
  };
}

function segmentsToGeoJSON(segments: RoadSegment[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: segments.map((s) => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: s.geometry,
      },
      properties: {
        link_id: s.link_id,
        name: s.name ?? '',
        risk: s.risk,
        risk_band: s.risk_band,
        highway: s.highway,
        color: colorForScore(s.risk),
      },
    })),
  };
}

export function MapRiskView({ segments, onSelect, selectedLinkId }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const vworldKey = process.env.NEXT_PUBLIC_VWORLD_KEY;

  // Initialize map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: baseStyle(vworldKey),
      center: YEONGDEUNGPO_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: { compact: true },
      pitch: 0,
      maxBounds: [
        [126.84, 37.46],
        [126.96, 37.58],
      ],
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right');
    mapRef.current = map;

    map.on('load', () => {
      map.addSource('risk-segments', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        promoteId: 'link_id',
      });
      // Outer glow stroke for high-risk roads (very_high / high only).
      map.addLayer({
        id: 'risk-glow',
        type: 'line',
        source: 'risk-segments',
        filter: ['in', ['get', 'risk_band'], ['literal', ['very_high', 'high']]],
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 8,
          'line-opacity': 0.22,
          'line-blur': 4,
        },
      });
      // Main risk line.
      map.addLayer({
        id: 'risk-line',
        type: 'line',
        source: 'risk-segments',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': [
            'interpolate',
            ['linear'],
            ['get', 'risk'],
            0, 1.2,
            0.4, 2.1,
            0.7, 3.6,
            1.0, 5.2,
          ],
          'line-opacity': 0.92,
        },
      });
      // Selected segment highlight (dashed white overlay).
      map.addLayer({
        id: 'risk-selected',
        type: 'line',
        source: 'risk-segments',
        filter: ['==', ['get', 'link_id'], ''],
        paint: {
          'line-color': '#ffffff',
          'line-width': 3,
          'line-dasharray': [2, 2],
          'line-opacity': 0.9,
        },
      });
      // Hover → cursor + popup.
      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });
      map.on('mousemove', 'risk-line', (e) => {
        if (!e.features?.[0]) return;
        const f = e.features[0];
        map.getCanvas().style.cursor = 'pointer';
        const props = f.properties as Record<string, string | number>;
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="min-width:160px">
              <div style="font-size:11px;color:rgba(229,237,248,0.6);letter-spacing:0.08em;text-transform:uppercase">LINK ${props.link_id}</div>
              <div style="font-weight:600;margin:2px 0 4px">${props.name || props.highway}</div>
              <div style="display:flex;gap:6px;align-items:center">
                <span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:${props.color}"></span>
                <span>위험도 ${(Number(props.risk) * 100).toFixed(1)}%</span>
              </div>
            </div>`,
          )
          .addTo(map);
      });
      map.on('mouseleave', 'risk-line', () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
      });
      map.on('click', 'risk-line', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const linkId = String((f.properties as { link_id: string }).link_id);
        const target = (segmentsRef.current ?? []).find((s) => s.link_id === linkId);
        if (target && onSelectRef.current) onSelectRef.current(target);
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep current segments accessible inside event handlers.
  const segmentsRef = useRef<RoadSegment[]>(segments);
  segmentsRef.current = segments;

  const segmentsGeoJson = useMemo(() => segmentsToGeoJSON(segments), [segments]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource('risk-segments') as maplibregl.GeoJSONSource | undefined;
      src?.setData(segmentsGeoJson);
    };
    if (map.isStyleLoaded()) apply();
    else map.once('idle', apply);
  }, [segmentsGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (!map.getLayer('risk-selected')) return;
      map.setFilter('risk-selected', ['==', ['get', 'link_id'], selectedLinkId ?? '']);
    };
    if (map.isStyleLoaded()) apply();
    else map.once('idle', apply);
  }, [selectedLinkId]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[420px] rounded-panel overflow-hidden border border-[var(--border)] shadow-glow"
      style={containerStyle}
    >
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 glass-panel-strong px-3 py-2 text-[11px] uppercase tracking-widest text-[var(--ink-muted)]">
        영등포구 · 위험도 히트맵 v1.0
        <span
          className="ml-2 inline-block h-1.5 w-1.5 rounded-full"
          style={pingDotStyle}
        />
      </div>
    </div>
  );
}
