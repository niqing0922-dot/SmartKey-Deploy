// Mock response factories
export const mockRecommendResponse = {
  groups: [
    {
      type: '鏍稿績璇?,
      keywords: [
        { kw: 'industrial router', volume: '5000', difficulty: 'low', intent: 'commercial' },
        { kw: '5G industrial router', volume: '3000', difficulty: 'mid', intent: 'transactional' },
        { kw: 'IoT gateway', volume: '2500', difficulty: 'high', intent: 'informational' }
      ]
    },
    {
      type: '闀垮熬璇?,
      keywords: [
        { kw: 'best industrial router for factory', volume: '800', difficulty: 'mid', intent: 'commercial' }
      ]
    }
  ]
};

export const mockAnalyzeResponse = {
  volume: '5000',
  difficulty: 'mid',
  intent: 'The user is looking for industrial router products for B2B manufacturing applications',
  audience: 'Industrial engineers, factory managers, IoT system integrators',
  deploy: {
    title: 'Best Industrial Router for Factory Automation in 2024',
    h2: 'What is an Industrial Router and Why Do Factories Need It?',
    density: '1.5-2% recommended density for SEO optimization',
    avoid: 'Avoid keyword stuffing and repetitive content'
  },
  related: ['IoT gateway', 'M2M router', 'industrial ethernet switch', 'PLC connectivity'],
  ideas: [
    'Complete guide to industrial router selection',
    'Comparison: Industrial router vs consumer router',
    'Case study: Industrial IoT deployment using cellular routers'
  ]
};

// Setup mock for MiniMax API
export function setupMiniMaxMock(page, response = mockRecommendResponse, delay = 0) {
  return page.route('https://api.minimaxi.chat/v1/text/chatcompletion_v2', async (route) => {
    if (delay > 0) {
      await page.waitForTimeout(delay);
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify(response)
          }
        }]
      })
    });
  });
}

// Mock API error
export function setupMiniMaxError(page, errorMessage = 'Network error') {
  return page.route('https://api.minimaxi.chat/v1/text/chatcompletion_v2', (route) => {
    route.abort('failed');
  });
}

// Mock API timeout
export function setupMiniMaxTimeout(page, delay = 30000) {
  return page.route('https://api.minimaxi.chat/v1/text/chatcompletion_v2', async (route) => {
    await page.waitForTimeout(delay);
    await route.abort('timedout');
  });
}

export default {
  mockRecommendResponse,
  mockAnalyzeResponse,
  setupMiniMaxMock,
  setupMiniMaxError,
  setupMiniMaxTimeout
};