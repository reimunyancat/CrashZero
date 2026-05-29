const BBOX = '37.4915,126.8780,37.5470,126.9430'; 
const QUERY = `[out:json][timeout:30];
way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|pedestrian|cycleway|footway|path|steps)$"](${BBOX});
out geom;`;
async function test() {
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'test' },
    body: `data=${encodeURIComponent(QUERY)}`,
  });
  const data = await res.json();
  const ways = data.elements.filter(e => e.type === 'way');
  if (ways.length) {
    console.log(JSON.stringify(ways[0], null, 2));
  }
}
test();
