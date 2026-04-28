import express from 'express';
import path from 'path';
import { spawn } from 'child_process';
import { authenticateToken } from '../middleware/auth.js';
import {
  getLocalDataSummary,
  exportAllLocalData,
  createDatabaseBackup,
  listDatabaseBackups,
  resetLocalData,
  importAllLocalData,
  dbPath,
  backupDir,
} from '../lib/storage.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/summary', async (req, res) => {
  try {
    res.json(getLocalDataSummary());
  } catch (error) {
    console.error('Local data summary error:', error);
    res.status(500).json({ error: 'Failed to load local data summary' });
  }
});

router.get('/export', async (req, res) => {
  try {
    res.json(exportAllLocalData());
  } catch (error) {
    console.error('Local data export error:', error);
    res.status(500).json({ error: 'Failed to export local data' });
  }
});

router.get('/backups', async (req, res) => {
  try {
    res.json({ backups: listDatabaseBackups(20), backupDir });
  } catch (error) {
    console.error('Local data backups error:', error);
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

router.post('/backup', async (req, res) => {
  try {
    const backupPath = createDatabaseBackup();
    res.json({
      message: 'Backup created',
      backupPath,
    });
  } catch (error) {
    console.error('Local data backup error:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

router.post('/open-folder', async (req, res) => {
  try {
    const { target = 'db' } = req.body;
    const folderPath = target === 'backup' ? backupDir : path.dirname(dbPath);
    spawn('explorer.exe', [folderPath], {
      detached: true,
      stdio: 'ignore',
    }).unref();

    res.json({
      message: 'Folder opened',
      target,
      path: folderPath,
    });
  } catch (error) {
    console.error('Open folder error:', error);
    res.status(500).json({ error: 'Failed to open folder' });
  }
});

router.post('/reset', async (req, res) => {
  try {
    const { mode = 'content' } = req.body;
    if (!['content', 'all'].includes(mode)) {
      return res.status(400).json({ error: 'Unsupported reset mode' });
    }

    resetLocalData(mode);
    res.json({
      message: mode === 'all' ? 'All local data reset' : 'Content data reset',
      mode,
    });
  } catch (error) {
    console.error('Local data reset error:', error);
    res.status(500).json({ error: 'Failed to reset local data' });
  }
});

router.post('/import', async (req, res) => {
  try {
    const { snapshot } = req.body;
    if (!snapshot || typeof snapshot !== 'object') {
      return res.status(400).json({ error: 'Snapshot payload is required' });
    }

    importAllLocalData(snapshot);
    res.json({
      message: 'Local data imported successfully',
    });
  } catch (error) {
    console.error('Local data import error:', error);
    res.status(500).json({ error: 'Failed to import local data' });
  }
});

export default router;
