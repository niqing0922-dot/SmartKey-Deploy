import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  listGeoDraftsByUser,
  getGeoDraftById,
  insertGeoDraftRecord,
  updateGeoDraftRecord,
  insertArticleRecord,
  getAppSettings,
} from '../lib/storage.js';

const router = express.Router();
router.use(authenticateToken);

function slugify(value = '') {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function splitSecondaryKeywords(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function buildDraftFromInput(input, settings) {
  const primaryKeyword = String(input.primaryKeyword || '').trim();
  const secondaryKeywords = splitSecondaryKeywords(input.secondaryKeywords);
  const industry = String(input.industry || '').trim() || 'General business';
  const targetMarket = String(input.targetMarket || '').trim() || settings.defaultMarket || 'Global / English';
  const articleType = String(input.articleType || '').trim() || settings.defaultArticleType || 'How-to guide';
  const tone = String(input.tone || '').trim() || settings.defaultTone || 'Professional and clear';
  const audience = String(input.audience || '').trim() || `Teams researching ${industry}`;
  const searchIntent = String(input.searchIntent || '').trim() || 'Informational and commercial investigation';
  const outcome = String(input.outcome || '').trim() || 'Help the reader understand the topic and take the next step.';
  const targetLength = Number(input.targetLength || 1400);
  const title = `${primaryKeyword}: ${articleType}`;
  const h1 = `${primaryKeyword} guide for ${targetMarket}`;
  const sections = [
    {
      heading: `What ${primaryKeyword} means in practice`,
      bullets: [
        `Define ${primaryKeyword} in a clear, direct way.`,
        `Explain why it matters in ${industry}.`,
        `Position the topic for ${audience}.`,
      ],
    },
    {
      heading: `How to plan ${primaryKeyword} content`,
      bullets: [
        `Match the article to ${searchIntent}.`,
        `Use secondary terms such as ${secondaryKeywords.join(', ') || 'supporting entities and user questions'}.`,
        'Turn each section into one clear answer block.',
      ],
    },
    {
      heading: `Common mistakes and optimization ideas`,
      bullets: [
        'Avoid thin introductions and generic filler.',
        'Use concise subheads and direct explanations.',
        'Finish with a practical next step or CTA.',
      ],
    },
  ];

  return {
    title,
    primary_keyword: primaryKeyword,
    secondary_keywords: secondaryKeywords,
    industry,
    target_market: targetMarket,
    article_type: articleType,
    tone,
    target_length: targetLength,
    brief: {
      audience,
      searchIntent,
      outcome,
      angles: [
        `How ${primaryKeyword} fits ${industry}`,
        'What users need to understand first',
        'What to do next after reading',
      ],
    },
    seo: {
      metaTitle: `${primaryKeyword} guide for ${targetMarket}`,
      metaDescription: `Learn how to approach ${primaryKeyword} with a ${tone.toLowerCase()} article structure designed for modern search and answer engines.`,
      slug: slugify(primaryKeyword),
    },
    outline: {
      h1,
      sections,
    },
    article: {
      introduction: `${primaryKeyword} is easier to rank and easier to reuse in answer engines when the article opens with a direct definition, clear market context, and a short promise of what the reader will learn.`,
      sections: sections.map((section) => ({
        heading: section.heading,
        content: `${section.bullets.join(' ')} Keep the tone ${tone.toLowerCase()} and use concrete examples that reflect ${industry}.`,
      })),
      conclusion: `Summarize the strongest takeaway, then invite the reader to apply ${primaryKeyword} with a focused next step.`,
      faq: [
        {
          question: `What is the main goal of a ${primaryKeyword} article?`,
          answer: `The main goal is to answer the reader's question quickly while still offering enough structure and depth to support ranking, summaries, and conversion.`,
        },
        {
          question: `How long should a ${primaryKeyword} article be?`,
          answer: `Use a length that fully covers the intent. In this workspace the starting target is ${targetLength} words, then refine based on competition and audience needs.`,
        },
      ],
    },
    status: 'draft',
  };
}

router.get('/drafts', async (req, res) => {
  try {
    const drafts = listGeoDraftsByUser(req.user.userId);
    res.json({ drafts });
  } catch (error) {
    console.error('Geo drafts list error:', error);
    res.status(500).json({ error: 'Failed to load GEO drafts' });
  }
});

router.post('/draft', async (req, res) => {
  try {
    if (!req.body.primaryKeyword) {
      return res.status(400).json({ error: 'Primary keyword is required' });
    }

    const settings = getAppSettings(req.user.userId);
    const draftPayload = buildDraftFromInput(req.body, settings);
    const draft = insertGeoDraftRecord(req.user.userId, draftPayload);
    res.status(201).json({ message: 'GEO draft created', draft });
  } catch (error) {
    console.error('Create GEO draft error:', error);
    res.status(500).json({ error: 'Failed to create GEO draft' });
  }
});

router.post('/save', async (req, res) => {
  try {
    const draftId = req.body.draftId;
    if (!draftId) {
      return res.status(400).json({ error: 'Draft id is required' });
    }

    const draft = getGeoDraftById(draftId, req.user.userId);
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    const contentParts = [
      draft.article?.introduction || '',
      ...(draft.article?.sections || []).map((section) => `${section.heading}\n\n${section.content}`),
      draft.article?.conclusion || '',
      ...(draft.article?.faq || []).map((item) => `Q: ${item.question}\nA: ${item.answer}`),
    ].filter(Boolean);

    const article = insertArticleRecord(req.user.userId, {
      title: draft.title,
      content: contentParts.join('\n\n'),
      status: 'draft',
      keyword_ids: [],
    });

    const updatedDraft = updateGeoDraftRecord(draftId, req.user.userId, { status: 'saved' });
    res.json({ message: 'Draft saved as article', article, draft: updatedDraft });
  } catch (error) {
    console.error('Save GEO draft error:', error);
    res.status(500).json({ error: 'Failed to save GEO draft' });
  }
});

export default router;
