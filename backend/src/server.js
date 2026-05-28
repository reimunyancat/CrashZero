// CrashZero backend — Express server.
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { z } from 'zod';
import { env } from './utils/env.js';
import { getFeatures, clearCache } from './services/featureCache.js';
import { runWhatIf } from './services/whatif.js';
import { runBudget } from './services/budget.js';
import { loadCatalog } from './services/cmf.js';
import { scenarioARunner, hasModel, getModelManifest, getModelRiskTable } from './services/scenarioARunner.js';

const app = express();
app.use(cors({ origin: env.allowedOrigins, credentials: true }));
app.use(express.json({ limit: '256kb' }));
app.use(morgan('tiny'));

app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString(), node: process.version });
});

app.get('/model', async (_req, res, next) => {
  try {
    const m = await getModelManifest();
    const table = await getModelRiskTable();
    res.json({
      loaded: Boolean(table && table.size),
      n_links: table ? table.size : 0,
      manifest: m,
    });
  } catch (err) {
    next(err);
  }
});

app.get('/cmf-catalog', async (_req, res, next) => {
  try {
    res.json(await loadCatalog());
  } catch (err) {
    next(err);
  }
});

app.get('/heatmap', async (req, res, next) => {
  try {
    const data = await getFeatures({ force: req.query.refresh === '1' });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

const whatifSchema = z.object({
  link_ids: z.array(z.string()).min(1).max(50),
  interventions: z.array(z.string()).min(1).max(8),
  scenario: z.enum(['A', 'B', 'both']).default('both'),
});

app.post('/whatif', async (req, res, next) => {
  try {
    const body = whatifSchema.parse(req.body);
    const { features } = await getFeatures();
    const results = await runWhatIf({
      segments: features,
      link_ids: body.link_ids,
      interventions: body.interventions,
      scenario: body.scenario,
      scenarioARunner: (await hasModel()) ? scenarioARunner : undefined,
    });
    res.json({ results, scenario: body.scenario });
  } catch (err) {
    next(err);
  }
});

const budgetSchema = z.object({
  budget_billion: z.number().min(1).max(500),
  top_n: z.number().min(10).max(500).default(60),
  scenario: z.enum(['A', 'B']).default('B'),
});

app.post('/budget', async (req, res, next) => {
  try {
    const body = budgetSchema.parse(req.body);
    const { features } = await getFeatures();
    const result = await runBudget({
      segments: features,
      budget_billion: body.budget_billion,
      top_n: body.top_n,
      scenario: body.scenario,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.post('/admin/refresh', async (_req, res) => {
  clearCache();
  const data = await getFeatures({ force: true });
  res.json({ ok: true, source: data.source, count: data.features.length });
});

// Centralized error handler.
app.use((err, _req, res, _next) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({ error: 'invalid_payload', issues: err.issues });
  }
  console.error('[err]', err);
  res.status(500).json({ error: err.message ?? 'internal_error' });
});

app.listen(env.port, () => {
  console.log(`[crashzero] backend on :${env.port} (${env.nodeEnv})`);
});
