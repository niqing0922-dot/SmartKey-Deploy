import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getAppSettings, saveAppSettings } from '../lib/storage.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const settings = getAppSettings(req.user.userId);
    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

router.post('/', async (req, res) => {
  try {
    const settings = saveAppSettings(req.user.userId, req.body || {});
    res.json(settings);
  } catch (error) {
    console.error('Save settings error:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

export default router;
