import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getDashboardStats } from '../lib/storage.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/stats', async (req, res) => {
  try {
    const { keywords, recentArticles, pendingKeywords } = getDashboardStats(req.user.userId);

    const totalKeywords = keywords.length;
    const pendingCount = keywords.filter((item) => item.status === 'pending').length;
    const plannedCount = keywords.filter((item) => item.status === 'planned').length;
    const doneCount = keywords.filter((item) => item.status === 'done').length;

    const typeDistribution = {};
    const priorityDistribution = {};

    for (const keyword of keywords) {
      typeDistribution[keyword.type] = (typeDistribution[keyword.type] || 0) + 1;
      priorityDistribution[keyword.priority] = (priorityDistribution[keyword.priority] || 0) + 1;
    }

    res.json({
      keywords: {
        total: totalKeywords,
        pending: pendingCount,
        planned: plannedCount,
        done: doneCount,
      },
      typeDistribution,
      priorityDistribution,
      recentArticles,
      unassignedKeywords: pendingKeywords,
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
