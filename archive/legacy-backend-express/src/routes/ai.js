import express from 'express';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// POST /api/ai/recommend - Keyword recommendation
router.post('/recommend', async (req, res) => {
  try {
    const { title, industry, coverageTypes, count } = req.body;

    if (!title || !industry) {
      return res.status(400).json({ error: 'Title and industry are required' });
    }

    const coverageTypesStr = (coverageTypes || ['核心词', '长尾词']).join('、');
    const countNum = count || 12;

    const prompt = `你是一个SEO关键词专家。请为以下文章标题和行业背景，推荐合适的关键词。

文章标题：${title}
行业背景：${industry}
推荐类型：${coverageTypesStr}
推荐数量：${countNum}个

请以JSON格式返回，包含groups数组，每个group有type（类型）、keywords（关键词数组，每个关键词包含word搜索量competition意图）`;

    const response = await fetch(process.env.MINIMAX_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.7-highspeed',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('MiniMax API error:', response.status, errorText);
      return res.status(502).json({ error: 'AI service request failed' });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';

    // Try to parse JSON from response
    let keywords;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\n?([\s\S]*?)\n?```/) || [null, content];
      const jsonStr = jsonMatch[1] || content;
      const parsed = JSON.parse(jsonStr.trim());
      keywords = parsed.groups || parsed;
    } catch (parseErr) {
      // If parsing fails, return raw content
      console.error('Parse AI response error:', parseErr);
      return res.json({ raw: content });
    }

    res.json({ keywords });
  } catch (err) {
    console.error('AI recommend error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/ai/analyze - Keyword analysis
router.post('/analyze', async (req, res) => {
  try {
    const { keyword, industry } = req.body;

    if (!keyword || !industry) {
      return res.status(400).json({ error: 'Keyword and industry are required' });
    }

    const prompt = `你是一个SEO关键词分析师。请对以下关键词进行深度分析：

关键词：${keyword}
行业背景：${industry}

请分析并返回JSON格式：
{
  "searchVolume": "估算月搜索量",
  "competition": "竞争难度（低/中/高）",
  "searchIntent": "搜索意图（信息型/导航型/商业型/交易型）",
  "targetAudience": "目标受众描述",
  "relatedKeywords": ["相关关键词列表"],
  "contentSuggestions": {
    "titles": ["建议标题"],
    "h2Suggestions": ["建议H2标题"],
    "densityAdvice": "密度建议"
  },
  "notes": "注意事项"
}`;

    const response = await fetch(process.env.MINIMAX_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.7-highspeed',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('MiniMax API error:', response.status, errorText);
      return res.status(502).json({ error: 'AI service request failed' });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';

    // Try to parse JSON
    let analysis;
    try {
      const jsonMatch = content.match(/```(?:json)?\n?([\s\S]*?)\n?```/) || [null, content];
      const jsonStr = jsonMatch[1] || content;
      analysis = JSON.parse(jsonStr.trim());
    } catch (parseErr) {
      console.error('Parse AI response error:', parseErr);
      return res.json({ raw: content });
    }

    res.json(analysis);
  } catch (err) {
    console.error('AI analyze error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
