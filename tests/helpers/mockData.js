// Mock keyword factory
function createMockKeyword(overrides = {}) {
  return {
    _uid: 'test-' + Math.random().toString(36).substr(2, 9),
    id: null,
    kw: 'test keyword ' + Date.now(),
    type: '鏍稿績璇?,
    status: 'pending',
    article: '',
    position: '',
    priority: '涓?,
    note: 'test note',
    ...overrides
  };
}

// Mock article factory
function createMockArticle(overrides = {}) {
  return {
    id: null,
    title: 'Test Article ' + Date.now(),
    keywords: ['test keyword 1', 'test keyword 2'],
    status: 'planned',
    ...overrides
  };
}

// Sample keyword set for bulk operations
function getSampleKeywords() {
  return [
    createMockKeyword({ kw: 'industrial router', type: '鏍稿績璇?, priority: '楂? }),
    createMockKeyword({ kw: '5G industrial router', type: '鏍稿績璇?, priority: '楂? }),
    createMockKeyword({ kw: 'IoT gateway', type: '鍦烘櫙璇?, priority: '涓? }),
    createMockKeyword({ kw: 'M2M router', type: '闀垮熬璇?, priority: '浣? }),
    createMockKeyword({ kw: 'router for remote monitoring', type: '闀垮熬璇?, priority: '涓? }),
  ];
}

module.exports = { createMockKeyword, createMockArticle, getSampleKeywords };