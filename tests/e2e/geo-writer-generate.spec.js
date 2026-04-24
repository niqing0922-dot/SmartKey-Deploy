import { test, expect } from '@playwright/test'

test('geo writer can generate and save a mocked draft', async ({ page }) => {
  await page.route('**/api/geo-writer/draft', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        request_id: 'req_mocked',
        item: {
          id: 'draft-1',
          title: 'Mocked GEO Draft',
          primary_keyword: '5g industrial router',
          secondary_keywords: [],
          audience: '',
          industry: '',
          target_market: 'Global / English',
          article_type: 'guide',
          tone: 'Professional and clear',
          target_length: 1000,
          brief: { content_language: 'en' },
          title_options: ['Mocked GEO Draft'],
          meta_title: 'Mocked Meta Title',
          meta_description: 'Mocked description',
          outline: ['Intro', 'Applications'],
          draft_sections: [{ heading: 'Intro', content: 'Body copy' }],
          faq: [{ question: 'What is it?', answer: 'A router.' }],
          suggestions: [],
          provider: 'system',
          status: 'draft',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      }),
    })
  })

  await page.route('**/api/geo-writer/drafts', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        request_id: 'req_mocked',
        items: [{
          id: 'draft-1',
          title: 'Mocked GEO Draft',
          primary_keyword: '5g industrial router',
          secondary_keywords: [],
          audience: '',
          industry: '',
          target_market: 'Global / English',
          article_type: 'guide',
          tone: 'Professional and clear',
          target_length: 1000,
          brief: { content_language: 'en' },
          title_options: ['Mocked GEO Draft'],
          meta_title: 'Mocked Meta Title',
          meta_description: 'Mocked description',
          outline: ['Intro', 'Applications'],
          draft_sections: [{ heading: 'Intro', content: 'Body copy' }],
          faq: [{ question: 'What is it?', answer: 'A router.' }],
          suggestions: [],
          provider: 'system',
          status: 'draft',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }],
      }),
    })
  })

  await page.route('**/api/geo-writer/save', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        request_id: 'req_mocked',
        article: {
          id: 'article-1',
          title: 'Mocked GEO Draft',
          content: 'Body copy',
          status: 'draft',
          keyword_ids: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        draft: {
          id: 'draft-1',
          title: 'Mocked GEO Draft',
          primary_keyword: '5g industrial router',
          secondary_keywords: [],
          audience: '',
          industry: '',
          target_market: 'Global / English',
          article_type: 'guide',
          tone: 'Professional and clear',
          target_length: 1000,
          brief: { content_language: 'en' },
          title_options: ['Mocked GEO Draft'],
          meta_title: 'Mocked Meta Title',
          meta_description: 'Mocked description',
          outline: ['Intro', 'Applications'],
          draft_sections: [{ heading: 'Intro', content: 'Body copy' }],
          faq: [{ question: 'What is it?', answer: 'A router.' }],
          suggestions: [],
          provider: 'system',
          status: 'saved',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      }),
    })
  })

  await page.goto('/articles/geo-writer')
  await page.getByTestId('geo.title-input').fill('5g industrial router')
  await page.getByTestId('geo.generate-button').click()
  await expect(page.locator('#aw-output')).toContainText('Mocked Meta Title')
  await page.getByTestId('geo.save-button').click()
  await expect(page.locator('.alert-success')).toContainText(/Saved to articles|已存入文章追踪/)
})
