// Navigation
export const NAV = {
  recommend: 'a[href="/keywords/recommend"]',
  analyze: 'a[href="/keywords/analyze"]',
  library: 'a[href="/keywords"]',
  articles: 'a[href="/articles"]',
  import: 'a[href="/import"]',
  dashboard: 'a[href="/"]',
  matrix: 'a[href="/matrix"]',
};

// Library page
export const LIBRARY = {
  searchInput: 'input[placeholder*="鎼滅储"]',
  typeFilter: 'select[id*="type"]',
  kwList: '[class*="keyword-list"]',
  addPanel: '[class*="add-panel"]',
};

// Modals
export const MODALS = {
  editModal: '[role="dialog"]',
};

// Articles page
export const ARTICLES = {
  list: '[class*="article-list"]',
  empty: '[class*="empty"]',
};

// AI pages
export const AI = {
  recommend: {
    titleInput: 'input[id*="title"]',
    ctxInput: 'textarea[id*="context"]',
    countInput: 'input[id*="count"]',
    recBtn: 'button[id*="rec"]',
    output: '[class*="output"]',
  },
  analyze: {
    kwInput: 'input[id*="keyword"]',
    ctxInput: 'textarea[id*="context"]',
    anaBtn: 'button[id*="ana"]',
    output: '[class*="output"]',
  },
};

// Import page
export const IMPORT = {
  textArea: 'textarea[id*="import"]',
  resultText: '[class*="result"]',
};

// Dashboard
export const DASHBOARD = {
  stats: '[class*="stats"]',
  typeProgress: '[class*="progress"]',
  recentArts: '[class*="recent"]',
};

// Matrix
export const MATRIX = {
  view: '[class*="matrix"]',
};

// Toast
export const TOAST = '[class*="toast"]';

export default { NAV, LIBRARY, MODALS, ARTICLES, AI, IMPORT, DASHBOARD, MATRIX, TOAST };