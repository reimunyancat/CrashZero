import { request } from 'undici';
const BBOX = '37.4915,126.8780,37.5470,126.9430'; 
const QUERY = `[out:json][timeout:30];
way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|pedestrian|cycleway|footway|path|steps)$"](${BBOX});
out geom;`;
async function test() {
  const res = await request('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(QUERY)}`,
  });
  console.log(res.statusCode);
  const text = await res.body.text();
  console.log(text.slice(0, 200));
}
test();
