import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  listKeywordsByUser,
  getKeywordById,
  insertKeywords,
  updateKeywordRecord,
  deleteKeywordRecord,
} from '../lib/storage.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 50, status, type, keyword, priority } = req.query;
    const { rows, total } = listKeywordsByUser(req.user.userId, {
      page,
      pageSize,
      status,
      type,
      keyword,
      priority,
    });

    res.json({
      keywords: rows,
      pagination: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
      },
    });
  } catch (err) {
    console.error('Keywords list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const keyword = getKeywordById(req.params.id, req.user.userId);
    if (!keyword) {
      return res.status(404).json({ error: 'Keyword not found' });
    }
    res.json(keyword);
  } catch (err) {
    console.error('Get keyword error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const keywords = Array.isArray(req.body) ? req.body : [req.body];
    const created = insertKeywords(req.user.userId, keywords);
    res.status(201).json({
      message: 'Keywords created successfully',
      keywords: created,
    });
  } catch (err) {
    console.error('Create keywords error:', err);
    res.status(500).json({ error: 'Failed to create keywords' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = getKeywordById(req.params.id, req.user.userId);
    if (!existing) {
      return res.status(404).json({ error: 'Keyword not found' });
    }

    const updates = {};
    for (const field of ['keyword', 'type', 'priority', 'status', 'notes', 'position', 'related_article']) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const keyword = updateKeywordRecord(req.params.id, req.user.userId, updates);
    res.json({ message: 'Keyword updated', keyword });
  } catch (err) {
    console.error('Update keyword error:', err);
    res.status(500).json({ error: 'Failed to update keyword' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = getKeywordById(req.params.id, req.user.userId);
    if (!existing) {
      return res.status(404).json({ error: 'Keyword not found' });
    }
    deleteKeywordRecord(req.params.id, req.user.userId);
    res.json({ message: 'Keyword deleted successfully' });
  } catch (err) {
    console.error('Delete keyword error:', err);
    res.status(500).json({ error: 'Failed to delete keyword' });
  }
});

router.post('/batch', async (req, res) => {
  try {
    const { keywords } = req.body;
    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ error: 'Keywords array is required' });
    }

    const created = insertKeywords(req.user.userId, keywords);
    res.status(201).json({
      message: `${created.length} keywords created`,
      keywords: created,
    });
  } catch (err) {
    console.error('Batch create keywords error:', err);
    res.status(500).json({ error: 'Failed to create keywords' });
  }
});

export default router;
