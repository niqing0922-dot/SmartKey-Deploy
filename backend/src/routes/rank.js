import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import { authenticateToken } from '../middleware/auth.js';
import { runPythonJson } from '../lib/pythonRunner.js';
import { insertRankJob, listKeywordsByUser, listRankJobs, listRankResults } from '../lib/storage.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../');
const runnerPath = path.join(repoRoot, 'backend/python/run_rank_job.py');

router.use(authenticateToken);

router.post('/jobs/run', async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      keywords,
      domain,
      provider = 'serpapi',
      maxPages = 10,
      resultsPerRequest = 100,
      hl = 'en',
      gl = '',
      reserveCredits = 10,
      source = 'library',
    } = req.body;

    let keywordList = Array.isArray(keywords)
      ? keywords.map((item) => String(item).trim()).filter(Boolean)
      : [];

    if (source === 'library' && keywordList.length === 0) {
      const { rows } = listKeywordsByUser(userId, { page: 1, pageSize: 200 });
      keywordList = rows.map((item) => String(item.keyword || '').trim()).filter(Boolean);
    }

    if (!keywordList.length) {
      return res.status(400).json({ error: 'At least one keyword is required' });
    }
    if (!domain) {
      return res.status(400).json({ error: 'Target domain is required' });
    }

    const payload = {
      keywords: keywordList,
      domain,
      provider,
      maxPages: Number(maxPages) || 10,
      resultsPerRequest: Number(resultsPerRequest) || 100,
      hl,
      gl,
      reserveCredits: Number(reserveCredits) || 10,
      source,
    };

    const result = await runPythonJson(runnerPath, payload, { cwd: repoRoot });
    const jobId = insertRankJob(userId, payload, result);

    res.json({
      jobId,
      persisted: true,
      persistenceError: null,
      ...result,
    });
  } catch (error) {
    console.error('Run rank job error:', error);
    res.status(500).json({ error: error.message || 'Failed to run rank job' });
  }
});

router.get('/jobs', async (req, res) => {
  try {
    res.json({ jobs: listRankJobs(req.user.userId, 20) });
  } catch (error) {
    console.error('List rank jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch rank jobs' });
  }
});

router.get('/jobs/:id/results', async (req, res) => {
  try {
    res.json({ results: listRankResults(req.params.id, req.user.userId) });
  } catch (error) {
    console.error('List rank results error:', error);
    res.status(500).json({ error: 'Failed to fetch rank results' });
  }
});

export default router;
