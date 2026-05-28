// Lightweight env loader with explicit error messages.
import 'dotenv/config';

function str(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  return v;
}

function bool(name, fallback = false) {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

function num(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  port: num('PORT', 4000),
  nodeEnv: str('NODE_ENV', 'development'),
  allowedOrigins: str('ALLOWED_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  dataGoKrKey: str('DATA_GO_KR_KEY', ''),
  vworldKey: str('VWORLD_KEY', ''),
  kmaKey: str('KMA_KEY', ''),
  overpassUrl: str('OVERPASS_URL', 'https://overpass-api.de/api/interpreter'),
  useFixtures: bool('USE_FIXTURES', false),
  fixturesDir: str('FIXTURES_DIR', '../frontend/public/fixtures'),
};

export function requireKey(name) {
  const v = process.env[name];
  if (!v) {
    const err = new Error(`Missing required env var: ${name}`);
    err.code = 'ENV_MISSING';
    throw err;
  }
  return v;
}
