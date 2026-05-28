// Smoke test — runs without needing the full server.
import { loadCatalog, combineReductions } from '../src/services/cmf.js';
import { applyScenarioBSegment } from '../src/services/dualScenario.js';
import { runBudget } from '../src/services/budget.js';

const segments = [
  { link_id: 'A', name: '테스트 구간 A', highway: 'primary', risk: 0.82 },
  { link_id: 'B', name: '테스트 구간 B', highway: 'secondary', risk: 0.55 },
  { link_id: 'C', name: '테스트 구간 C', highway: 'tertiary', risk: 0.32 },
];

const catalog = await loadCatalog();
console.log('catalog interventions:', catalog.interventions.map((i) => i.id));

const pred = await applyScenarioBSegment(segments[0], ['traffic_signal', 'crosswalk']);
console.log('scenarioB pred:', pred);

const capCheck = combineReductions([0.5, 0.5, 0.5]);
console.log('combine cap (must be 0.62):', capCheck);

const budget = await runBudget({ segments, budget_billion: 5, top_n: 3 });
console.log('budget rows:', budget.rows.length, 'spent:', budget.spent_billion);

console.log('OK');
