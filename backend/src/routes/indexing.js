import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import { authenticateToken } from '../middleware/auth.js';
import { runPythonJson } from '../lib/pythonRunner.js';
import { insertIndexingJob, listIndexingJobs, listIndexingPages } from '../lib/storage.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../');
const runnerPath = path.join(repoRoot, 'backend/python/run_indexing_job.py');

router.use(authenticateToken);

function resolveRepoPath(targetPath) {
  if (!targetPath) {
    return null;
  }
  return path.isAbsolute(targetPath) ? targetPath : path.join(repoRoot, targetPath);
}

router.post('/jobs/run', async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      action = 'inspect',
      siteUrl,
      urls = [],
      maxPages = 50,
      crawlDelay = 0.5,
      checkDelay = 0.3,
      useProxy = false,
      proxyHost = '127.0.0.1',
      proxyPort = 7890,
      credentialsPath,
      indexingKeyFile,
      submissionType = 'URL_UPDATED',
      maxRetries = 3,
    } = req.body;

    if (!['inspect', 'submit'].includes(action)) {
      return res.status(400).json({ error: 'Unsupported indexing action' });
    }
    if (action === 'inspect' && !siteUrl) {
      return res.status(400).json({ error: 'Site URL is required for inspect action' });
    }

    const normalizedUrls = Array.isArray(urls)
      ? urls.map((item) => String(item).trim()).filter(Boolean)
      : [];

    if (action === 'submit' && !normalizedUrls.length) {
      return res.status(400).json({ error: 'At least one URL is required for submit action' });
    }

    const payload = {
      action,
      siteUrl,
      urls: normalizedUrls,
      maxPages: Number(maxPages) || 50,
      crawlDelay: Number(crawlDelay) || 0.5,
      checkDelay: Number(checkDelay) || 0.3,
      useProxy: Boolean(useProxy),
      proxyHost,
      proxyPort: Number(proxyPort) || 7890,
      credentialsPath: resolveRepoPath(
        credentialsPath || 'tools/google-indexing/config/service_account.json'
      ),
      indexingKeyFile: resolveRepoPath(
        indexingKeyFile || 'tools/google-indexing/config/service_account.json'
      ),
      submissionType,
      maxRetries: Number(maxRetries) || 3,
    };

    const result = await runPythonJson(runnerPath, payload, { cwd: repoRoot });
    const jobId = insertIndexingJob(userId, payload, result);

    res.json({
      jobId,
      persisted: true,
      persistenceError: null,
      ...result,
    });
  } catch (error) {
    console.error('Run indexing job error:', error);
    res.status(500).json({ error: error.message || 'Failed to run indexing job' });
  }
});

router.get('/jobs', async (req, res) => {
  try {
    res.json({ jobs: listIndexingJobs(req.user.userId, 20) });
  } catch (error) {
    console.error('List indexing jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch indexing jobs' });
  }
});

router.get('/jobs/:id/pages', async (req, res) => {
  try {
    res.json({ pages: listIndexingPages(req.params.id, req.user.userId) });
  } catch (error) {
    console.error('List indexing pages error:', error);
    res.status(500).json({ error: 'Failed to fetch indexing pages' });
  }
});

export default router;
