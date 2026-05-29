const ICON_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '/icons/traffic-signal.svg': { width: 10, height: 16 },
  '/icons/traffic-cone.svg': { width: 19, height: 16 },
  '/icons/crosswalk.svg': { width: 18, height: 18 },
  '/icons/child-zone.svg': { width: 15, height: 17 },
  '/icons/road-risk.svg': { width: 16, height: 14 },
  '/icons/median-barrier.svg': { width: 14, height: 15 },
};

export function iconDimensions(src?: string): { width: number; height: number } {
  return ICON_DIMENSIONS[src ?? ''] ?? { width: 16, height: 16 };
}
