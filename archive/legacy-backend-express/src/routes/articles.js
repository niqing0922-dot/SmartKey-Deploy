import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  listArticlesByUser,
  getArticleById,
  insertArticleRecord,
  updateArticleRecord,
  deleteArticleRecord,
  getKeywordsByIds,
  updateKeywordsForArticle,
  clearKeywordsByRelatedArticle,
} from '../lib/storage.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status } = req.query;
    const { rows, total } = listArticlesByUser(req.user.userId, { page, pageSize, status });

    const articles = rows.map((article) => {
      if (!article.keyword_ids.length) {
        return { ...article, cover_progress: 0 };
      }
      const keywords = getKeywordsByIds(article.keyword_ids);
      const doneCount = keywords.filter((item) => item.status === 'done').length;
      return {
        ...article,
        cover_progress: keywords.length ? Math.round((doneCount / keywords.length) * 100) : 0,
      };
    });

    res.json({
      articles,
      pagination: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
      },
    });
  } catch (err) {
    console.error('Articles list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const article = getArticleById(req.params.id, req.user.userId);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    article.keywords = article.keyword_ids.length ? getKeywordsByIds(article.keyword_ids) : [];
    res.json(article);
  } catch (err) {
    console.error('Get article error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, content, status, keyword_ids } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const article = insertArticleRecord(req.user.userId, {
      title,
      content,
      status,
      keyword_ids,
    });

    res.status(201).json({
      message: 'Article created successfully',
      article,
    });
  } catch (err) {
    console.error('Create article error:', err);
    res.status(500).json({ error: 'Failed to create article' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = getArticleById(req.params.id, req.user.userId);
    if (!existing) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const updates = {};
    for (const field of ['title', 'content', 'status', 'keyword_ids']) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (updates.status === 'published') {
      const keywordIds = Array.isArray(updates.keyword_ids) ? updates.keyword_ids : existing.keyword_ids;
      if (keywordIds.length) {
        updateKeywordsForArticle(keywordIds, req.user.userId, {
          status: 'done',
          related_article: req.params.id,
        });
      }
    }

    const article = updateArticleRecord(req.params.id, req.user.userId, updates);
    res.json({ message: 'Article updated', article });
  } catch (err) {
    console.error('Update article error:', err);
    res.status(500).json({ error: 'Failed to update article' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = getArticleById(req.params.id, req.user.userId);
    if (!existing) {
      return res.status(404).json({ error: 'Article not found' });
    }

    clearKeywordsByRelatedArticle(req.params.id, req.user.userId);
    deleteArticleRecord(req.params.id, req.user.userId);
    res.json({ message: 'Article deleted successfully' });
  } catch (err) {
    console.error('Delete article error:', err);
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

export default router;
