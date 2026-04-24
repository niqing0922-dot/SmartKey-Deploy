import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configuredDataDir = process.env.SMARTKEY_DATA_DIR;
const configuredBackupDir = process.env.SMARTKEY_BACKUP_DIR;
const dataDir = configuredDataDir ? path.resolve(configuredDataDir) : path.resolve(__dirname, '../../data');
const dbPath = path.join(dataDir, 'app.db');
const backupDir = configuredBackupDir ? path.resolve(configuredBackupDir) : path.resolve(dataDir, '../backups');

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(backupDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function now() {
  return new Date().toISOString();
}

export function createId() {
  return randomUUID();
}

export function fromJson(value, fallback) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toJson(value, fallback) {
  if (value === undefined) {
    return JSON.stringify(fallback);
  }
  return JSON.stringify(value);
}

function mapArticle(row) {
  if (!row) return null;
  return { ...row, keyword_ids: fromJson(row.keyword_ids, []) };
}

function mapGeoDraft(row) {
  if (!row) return null;
  return {
    ...row,
    secondary_keywords: fromJson(row.secondary_keywords, []),
    brief: fromJson(row.brief_json, {}),
    seo: fromJson(row.seo_json, {}),
    outline: fromJson(row.outline_json, {}),
    article: fromJson(row.article_json, {}),
  };
}

const DEFAULT_SETTINGS = {
  language: 'zh',
  defaultMarket: 'Global / English',
  defaultTone: 'Professional and clear',
  defaultArticleType: 'How-to guide',
  aiProvider: 'OpenAI',
  openaiApiKey: '',
  serpApiKey: '',
  pythonPath: '',
  googleCredentialsPath: '',
};

export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS keywords (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      type TEXT DEFAULT 'general',
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'pending',
      notes TEXT DEFAULT '',
      position TEXT DEFAULT '',
      related_article TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      status TEXT DEFAULT 'draft',
      keyword_ids TEXT DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS geo_article_drafts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      primary_keyword TEXT NOT NULL,
      secondary_keywords TEXT DEFAULT '[]',
      industry TEXT DEFAULT '',
      target_market TEXT DEFAULT '',
      article_type TEXT DEFAULT '',
      tone TEXT DEFAULT '',
      target_length INTEGER DEFAULT 1200,
      brief_json TEXT DEFAULT '{}',
      seo_json TEXT DEFAULT '{}',
      outline_json TEXT DEFAULT '{}',
      article_json TEXT DEFAULT '{}',
      status TEXT DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      settings_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rank_check_jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      source TEXT DEFAULT 'manual',
      domain TEXT NOT NULL,
      provider TEXT DEFAULT 'serpapi',
      status TEXT DEFAULT 'completed',
      params TEXT DEFAULT '{}',
      keyword_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      started_at TEXT,
      finished_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rank_check_results (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      found INTEGER DEFAULT 0,
      page INTEGER,
      position INTEGER,
      url TEXT,
      provider TEXT DEFAULT '',
      error TEXT DEFAULT '',
      queried_at TEXT,
      raw TEXT DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES rank_check_jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS indexing_jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      site_url TEXT,
      action TEXT NOT NULL,
      status TEXT DEFAULT 'completed',
      params TEXT DEFAULT '{}',
      total_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      started_at TEXT,
      finished_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS indexing_pages (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      url TEXT NOT NULL,
      indexed INTEGER,
      coverage TEXT DEFAULT '',
      indexing_state TEXT DEFAULT '',
      last_crawl TEXT,
      error TEXT DEFAULT '',
      checked_at TEXT,
      submission_success INTEGER,
      status_code INTEGER,
      status_message TEXT DEFAULT '',
      retry_count INTEGER,
      raw TEXT DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES indexing_jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

initializeDatabase();

export function insertUser({ email, username, passwordHash }) {
  const id = createId();
  const timestamp = now();
  db.prepare(
    `INSERT INTO users (id, email, username, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, email, username, passwordHash, timestamp, timestamp);

  return db.prepare('SELECT id, email, username, created_at FROM users WHERE id = ?').get(id);
}

export function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

export function listKeywordsByUser(userId, filters = {}) {
  const conditions = ['user_id = ?'];
  const params = [userId];

  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.type) {
    conditions.push('type = ?');
    params.push(filters.type);
  }
  if (filters.priority) {
    conditions.push('priority = ?');
    params.push(filters.priority);
  }
  if (filters.keyword) {
    conditions.push('keyword LIKE ?');
    params.push(`%${filters.keyword}%`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const total = db.prepare(`SELECT COUNT(*) as count FROM keywords ${whereClause}`).get(...params).count;
  const page = Number(filters.page || 1);
  const pageSize = Number(filters.pageSize || 50);
  const offset = (page - 1) * pageSize;
  const rows = db
    .prepare(
      `SELECT * FROM keywords ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, offset);

  return { rows, total };
}

export function getKeywordById(id, userId) {
  return db.prepare('SELECT * FROM keywords WHERE id = ? AND user_id = ?').get(id, userId);
}

export function insertKeywords(userId, keywords) {
  const insert = db.prepare(
    `INSERT INTO keywords (
      id, user_id, keyword, type, priority, status, notes, position, related_article, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction((items) => {
    const created = [];
    for (const item of items) {
      const id = createId();
      const timestamp = now();
      insert.run(
        id,
        userId,
        item.keyword,
        item.type || 'general',
        item.priority || 'medium',
        item.status || 'pending',
        item.notes || '',
        item.position || '',
        item.related_article || '',
        timestamp,
        timestamp
      );
      created.push(getKeywordById(id, userId));
    }
    return created;
  });

  return tx(keywords);
}

export function updateKeywordRecord(id, userId, updates) {
  const entries = Object.entries(updates);
  const fields = entries.map(([key]) => `${key} = ?`);
  const values = entries.map(([, value]) => value);
  fields.push('updated_at = ?');
  values.push(now(), id, userId);
  db.prepare(`UPDATE keywords SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
  return getKeywordById(id, userId);
}

export function deleteKeywordRecord(id, userId) {
  db.prepare('DELETE FROM keywords WHERE id = ? AND user_id = ?').run(id, userId);
}

export function listArticlesByUser(userId, filters = {}) {
  const conditions = ['user_id = ?'];
  const params = [userId];
  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const total = db.prepare(`SELECT COUNT(*) as count FROM articles ${whereClause}`).get(...params).count;
  const page = Number(filters.page || 1);
  const pageSize = Number(filters.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const rows = db
    .prepare(
      `SELECT * FROM articles ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, offset)
    .map(mapArticle);

  return { rows, total };
}

export function getArticleById(id, userId) {
  return mapArticle(db.prepare('SELECT * FROM articles WHERE id = ? AND user_id = ?').get(id, userId));
}

export function insertArticleRecord(userId, article) {
  const id = createId();
  const timestamp = now();
  db.prepare(
    `INSERT INTO articles (id, user_id, title, content, status, keyword_ids, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    userId,
    article.title,
    article.content || '',
    article.status || 'draft',
    toJson(article.keyword_ids || [], []),
    timestamp,
    timestamp
  );
  return getArticleById(id, userId);
}

export function updateArticleRecord(id, userId, updates) {
  const entries = Object.entries(updates);
  const fields = entries.map(([key]) => `${key} = ?`);
  const values = entries.map(([key, value]) => (key === 'keyword_ids' ? toJson(value, []) : value));
  fields.push('updated_at = ?');
  values.push(now(), id, userId);
  db.prepare(`UPDATE articles SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
  return getArticleById(id, userId);
}

export function deleteArticleRecord(id, userId) {
  db.prepare('DELETE FROM articles WHERE id = ? AND user_id = ?').run(id, userId);
}

export function getKeywordsByIds(ids) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(', ');
  return db.prepare(`SELECT * FROM keywords WHERE id IN (${placeholders})`).all(...ids);
}

export function updateKeywordsForArticle(ids, userId, updates) {
  if (!ids.length) return;
  const fields = Object.keys(updates).map((key) => `${key} = ?`);
  const values = Object.values(updates);
  fields.push('updated_at = ?');
  values.push(now(), userId, ...ids);
  const placeholders = ids.map(() => '?').join(', ');
  db.prepare(
    `UPDATE keywords SET ${fields.join(', ')}
     WHERE user_id = ? AND id IN (${placeholders})`
  ).run(...values);
}

export function clearKeywordsByRelatedArticle(articleId, userId) {
  db.prepare(
    `UPDATE keywords
     SET status = 'pending', related_article = '', updated_at = ?
     WHERE user_id = ? AND related_article = ?`
  ).run(now(), userId, articleId);
}

export function getDashboardStats(userId) {
  const keywords = db.prepare('SELECT status, type, priority FROM keywords WHERE user_id = ?').all(userId);
  const recentArticles = db
    .prepare('SELECT id, title, status, keyword_ids, created_at FROM articles WHERE user_id = ? ORDER BY created_at DESC LIMIT 5')
    .all(userId)
    .map(mapArticle);
  const pendingKeywords = db
    .prepare(
      `SELECT id, keyword, type, priority, status, notes, position, related_article, created_at, updated_at, user_id
       FROM keywords WHERE user_id = ? AND status = 'pending'
       ORDER BY created_at ASC LIMIT 10`
    )
    .all(userId);

  return { keywords, recentArticles, pendingKeywords };
}

export function listGeoDraftsByUser(userId, limit = 12) {
  return db
    .prepare('SELECT * FROM geo_article_drafts WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?')
    .all(userId, limit)
    .map(mapGeoDraft);
}

export function getGeoDraftById(id, userId) {
  return mapGeoDraft(db.prepare('SELECT * FROM geo_article_drafts WHERE id = ? AND user_id = ?').get(id, userId));
}

export function insertGeoDraftRecord(userId, draft) {
  const id = createId();
  const timestamp = now();
  db.prepare(
    `INSERT INTO geo_article_drafts (
      id, user_id, title, primary_keyword, secondary_keywords, industry, target_market, article_type, tone,
      target_length, brief_json, seo_json, outline_json, article_json, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    userId,
    draft.title,
    draft.primary_keyword,
    toJson(draft.secondary_keywords || [], []),
    draft.industry || '',
    draft.target_market || '',
    draft.article_type || '',
    draft.tone || '',
    draft.target_length || 1200,
    toJson(draft.brief || {}, {}),
    toJson(draft.seo || {}, {}),
    toJson(draft.outline || {}, {}),
    toJson(draft.article || {}, {}),
    draft.status || 'draft',
    timestamp,
    timestamp
  );
  return getGeoDraftById(id, userId);
}

export function updateGeoDraftRecord(id, userId, updates) {
  const entries = Object.entries(updates).map(([key, value]) => {
    if (['secondary_keywords', 'brief', 'seo', 'outline', 'article'].includes(key)) {
      const fieldMap = {
        secondary_keywords: 'secondary_keywords',
        brief: 'brief_json',
        seo: 'seo_json',
        outline: 'outline_json',
        article: 'article_json',
      };
      return [fieldMap[key], key === 'secondary_keywords' ? toJson(value, []) : toJson(value, {})];
    }
    return [key, value];
  });

  const fields = entries.map(([key]) => `${key} = ?`);
  const values = entries.map(([, value]) => value);
  fields.push('updated_at = ?');
  values.push(now(), id, userId);
  db.prepare(`UPDATE geo_article_drafts SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
  return getGeoDraftById(id, userId);
}

export function getAppSettings(userId) {
  const row = db.prepare('SELECT * FROM app_settings WHERE user_id = ? LIMIT 1').get(userId);
  if (!row) {
    return { ...DEFAULT_SETTINGS };
  }
  return { ...DEFAULT_SETTINGS, ...fromJson(row.settings_json, {}) };
}

export function saveAppSettings(userId, settings) {
  const existing = db.prepare('SELECT id FROM app_settings WHERE user_id = ? LIMIT 1').get(userId);
  const timestamp = now();
  const nextSettings = { ...DEFAULT_SETTINGS, ...settings };

  if (existing) {
    db.prepare(
      `UPDATE app_settings
       SET settings_json = ?, updated_at = ?
       WHERE id = ?`
    ).run(toJson(nextSettings, DEFAULT_SETTINGS), timestamp, existing.id);
    return nextSettings;
  }

  db.prepare(
    `INSERT INTO app_settings (id, user_id, settings_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(createId(), userId, toJson(nextSettings, DEFAULT_SETTINGS), timestamp, timestamp);
  return nextSettings;
}

export function insertRankJob(userId, payload, result) {
  const jobId = createId();
  db.prepare(
    `INSERT INTO rank_check_jobs (
      id, user_id, source, domain, provider, status, params, keyword_count, success_count, failed_count,
      started_at, finished_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    jobId,
    userId,
    payload.source || 'manual',
    payload.domain,
    payload.provider,
    'completed',
    toJson(payload, {}),
    result.summary.total,
    result.summary.found,
    result.summary.errors,
    result.started_at,
    result.finished_at,
    now()
  );

  const insert = db.prepare(
    `INSERT INTO rank_check_results (
      id, job_id, user_id, keyword, found, page, position, url, provider, error, queried_at, raw, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction((rows) => {
    for (const row of rows) {
      insert.run(
        createId(),
        jobId,
        userId,
        row.keyword,
        row.found ? 1 : 0,
        row.page ?? null,
        row.position ?? null,
        row.url ?? null,
        row.provider ?? '',
        row.error ?? '',
        row.queried_at ?? null,
        toJson(row, {}),
        now()
      );
    }
  });
  tx(result.results);
  return jobId;
}

export function listRankJobs(userId, limit = 20) {
  return db
    .prepare('SELECT * FROM rank_check_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, limit)
    .map((row) => ({ ...row, params: fromJson(row.params, {}) }));
}

export function listRankResults(jobId, userId) {
  return db
    .prepare(
      `SELECT * FROM rank_check_results
       WHERE job_id = ? AND user_id = ?
       ORDER BY CASE WHEN position IS NULL THEN 1 ELSE 0 END, position ASC`
    )
    .all(jobId, userId)
    .map((row) => ({ ...row, found: Boolean(row.found), raw: fromJson(row.raw, {}) }));
}

export function insertIndexingJob(userId, payload, result) {
  const jobId = createId();
  db.prepare(
    `INSERT INTO indexing_jobs (
      id, user_id, site_url, action, status, params, total_count, success_count, failed_count,
      started_at, finished_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    jobId,
    userId,
    payload.siteUrl || null,
    payload.action,
    'completed',
    toJson(payload, {}),
    result.summary.total,
    result.summary.success,
    result.summary.failed,
    result.started_at,
    result.finished_at,
    now()
  );

  const insert = db.prepare(
    `INSERT INTO indexing_pages (
      id, job_id, user_id, url, indexed, coverage, indexing_state, last_crawl, error, checked_at,
      submission_success, status_code, status_message, retry_count, raw, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction((rows) => {
    for (const row of rows) {
      insert.run(
        createId(),
        jobId,
        userId,
        row.url,
        row.indexed === undefined || row.indexed === null ? null : row.indexed ? 1 : 0,
        row.coverage ?? '',
        row.indexing_state ?? '',
        row.last_crawl ?? null,
        row.error ?? '',
        row.checked_at ?? null,
        row.success === undefined || row.success === null ? null : row.success ? 1 : 0,
        row.status_code ?? null,
        row.status_message ?? '',
        row.retry_count ?? null,
        toJson(row, {}),
        now()
      );
    }
  });
  tx(result.pages);
  return jobId;
}

export function listIndexingJobs(userId, limit = 20) {
  return db
    .prepare('SELECT * FROM indexing_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, limit)
    .map((row) => ({ ...row, params: fromJson(row.params, {}) }));
}

export function listIndexingPages(jobId, userId) {
  return db
    .prepare('SELECT * FROM indexing_pages WHERE job_id = ? AND user_id = ? ORDER BY created_at DESC')
    .all(jobId, userId)
    .map((row) => ({
      ...row,
      indexed: row.indexed === null || row.indexed === undefined ? null : Boolean(row.indexed),
      submission_success:
        row.submission_success === null || row.submission_success === undefined
          ? null
          : Boolean(row.submission_success),
      raw: fromJson(row.raw, {}),
    }));
}

export function getLocalDataSummary() {
  const tableCounts = {
    users: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
    keywords: db.prepare('SELECT COUNT(*) as count FROM keywords').get().count,
    articles: db.prepare('SELECT COUNT(*) as count FROM articles').get().count,
    geoDrafts: db.prepare('SELECT COUNT(*) as count FROM geo_article_drafts').get().count,
    rankJobs: db.prepare('SELECT COUNT(*) as count FROM rank_check_jobs').get().count,
    rankResults: db.prepare('SELECT COUNT(*) as count FROM rank_check_results').get().count,
    indexingJobs: db.prepare('SELECT COUNT(*) as count FROM indexing_jobs').get().count,
    indexingPages: db.prepare('SELECT COUNT(*) as count FROM indexing_pages').get().count,
    appSettings: db.prepare('SELECT COUNT(*) as count FROM app_settings').get().count,
  };

  let dbSizeBytes = 0;
  try {
    dbSizeBytes = fs.statSync(dbPath).size;
  } catch {
    dbSizeBytes = 0;
  }

  return { dbPath, dbSizeBytes, tableCounts };
}

export function exportLocalData() {
  return exportAllLocalData();
}

export function exportAllLocalData() {
  return {
    exportedAt: now(),
    users: db.prepare('SELECT * FROM users ORDER BY created_at DESC').all(),
    keywords: db.prepare('SELECT * FROM keywords ORDER BY created_at DESC').all(),
    articles: db.prepare('SELECT * FROM articles ORDER BY created_at DESC').all().map(mapArticle),
    geoDrafts: db.prepare('SELECT * FROM geo_article_drafts ORDER BY created_at DESC').all().map(mapGeoDraft),
    appSettings: db.prepare('SELECT * FROM app_settings ORDER BY created_at DESC').all().map((row) => ({
      ...row,
      settings_json: fromJson(row.settings_json, {}),
    })),
    rankJobs: db.prepare('SELECT * FROM rank_check_jobs ORDER BY created_at DESC').all().map((row) => ({
      ...row,
      params: fromJson(row.params, {}),
    })),
    rankResults: db.prepare('SELECT * FROM rank_check_results ORDER BY created_at DESC').all().map((row) => ({
      ...row,
      found: Boolean(row.found),
      raw: fromJson(row.raw, {}),
    })),
    indexingJobs: db.prepare('SELECT * FROM indexing_jobs ORDER BY created_at DESC').all().map((row) => ({
      ...row,
      params: fromJson(row.params, {}),
    })),
    indexingPages: db.prepare('SELECT * FROM indexing_pages ORDER BY created_at DESC').all().map((row) => ({
      ...row,
      indexed: row.indexed === null || row.indexed === undefined ? null : Boolean(row.indexed),
      submission_success:
        row.submission_success === null || row.submission_success === undefined
          ? null
          : Boolean(row.submission_success),
      raw: fromJson(row.raw, {}),
    })),
  };
}

export function createDatabaseBackup() {
  const filename = `smartkey-backup-${now().replace(/[:.]/g, '-').replace('T', '_')}.db`;
  const targetPath = path.join(backupDir, filename);
  db.pragma('wal_checkpoint(TRUNCATE)');
  fs.copyFileSync(dbPath, targetPath);
  return targetPath;
}

export function listDatabaseBackups(limit = 20) {
  if (!fs.existsSync(backupDir)) {
    return [];
  }

  return fs
    .readdirSync(backupDir)
    .filter((name) => name.endsWith('.db'))
    .map((name) => {
      const fullPath = path.join(backupDir, name);
      const stat = fs.statSync(fullPath);
      return {
        name,
        path: fullPath,
        sizeBytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
    .slice(0, limit);
}

export function resetLocalData(mode = 'content') {
  const clearContent = db.transaction(() => {
    db.prepare('DELETE FROM indexing_pages').run();
    db.prepare('DELETE FROM indexing_jobs').run();
    db.prepare('DELETE FROM rank_check_results').run();
    db.prepare('DELETE FROM rank_check_jobs').run();
    db.prepare('DELETE FROM geo_article_drafts').run();
    db.prepare('DELETE FROM articles').run();
    db.prepare('DELETE FROM keywords').run();
    if (mode === 'all') {
      db.prepare('DELETE FROM app_settings').run();
      db.prepare('DELETE FROM users').run();
    }
  });

  clearContent();
}

export function importAllLocalData(snapshot) {
  const payload = snapshot || {};
  const users = Array.isArray(payload.users) ? payload.users : [];
  const keywords = Array.isArray(payload.keywords) ? payload.keywords : [];
  const articles = Array.isArray(payload.articles) ? payload.articles : [];
  const geoDrafts = Array.isArray(payload.geoDrafts) ? payload.geoDrafts : [];
  const appSettings = Array.isArray(payload.appSettings) ? payload.appSettings : [];
  const rankJobs = Array.isArray(payload.rankJobs) ? payload.rankJobs : [];
  const rankResults = Array.isArray(payload.rankResults) ? payload.rankResults : [];
  const indexingJobs = Array.isArray(payload.indexingJobs) ? payload.indexingJobs : [];
  const indexingPages = Array.isArray(payload.indexingPages) ? payload.indexingPages : [];

  const insertUserStmt = db.prepare(
    `INSERT INTO users (id, email, username, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insertKeywordStmt = db.prepare(
    `INSERT INTO keywords (id, user_id, keyword, type, priority, status, notes, position, related_article, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertArticleStmt = db.prepare(
    `INSERT INTO articles (id, user_id, title, content, status, keyword_ids, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertGeoDraftStmt = db.prepare(
    `INSERT INTO geo_article_drafts (
      id, user_id, title, primary_keyword, secondary_keywords, industry, target_market, article_type, tone,
      target_length, brief_json, seo_json, outline_json, article_json, status, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertSettingsStmt = db.prepare(
    `INSERT INTO app_settings (id, user_id, settings_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  );
  const insertRankJobStmt = db.prepare(
    `INSERT INTO rank_check_jobs (
      id, user_id, source, domain, provider, status, params, keyword_count, success_count, failed_count,
      started_at, finished_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertRankResultStmt = db.prepare(
    `INSERT INTO rank_check_results (
      id, job_id, user_id, keyword, found, page, position, url, provider, error, queried_at, raw, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertIndexingJobStmt = db.prepare(
    `INSERT INTO indexing_jobs (
      id, user_id, site_url, action, status, params, total_count, success_count, failed_count,
      started_at, finished_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertIndexingPageStmt = db.prepare(
    `INSERT INTO indexing_pages (
      id, job_id, user_id, url, indexed, coverage, indexing_state, last_crawl, error, checked_at,
      submission_success, status_code, status_message, retry_count, raw, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    resetLocalData('all');

    for (const user of users) {
      if (!user.id || !user.email || !user.password_hash) continue;
      insertUserStmt.run(
        user.id,
        user.email,
        user.username || user.email,
        user.password_hash,
        user.created_at || now(),
        user.updated_at || user.created_at || now()
      );
    }

    for (const keyword of keywords) {
      insertKeywordStmt.run(
        keyword.id || createId(),
        keyword.user_id,
        keyword.keyword,
        keyword.type || 'general',
        keyword.priority || 'medium',
        keyword.status || 'pending',
        keyword.notes || '',
        keyword.position || '',
        keyword.related_article || '',
        keyword.created_at || now(),
        keyword.updated_at || keyword.created_at || now()
      );
    }

    for (const article of articles) {
      insertArticleStmt.run(
        article.id || createId(),
        article.user_id,
        article.title,
        article.content || '',
        article.status || 'draft',
        toJson(article.keyword_ids || [], []),
        article.created_at || now(),
        article.updated_at || article.created_at || now()
      );
    }

    for (const draft of geoDrafts) {
      insertGeoDraftStmt.run(
        draft.id || createId(),
        draft.user_id,
        draft.title,
        draft.primary_keyword,
        toJson(draft.secondary_keywords || [], []),
        draft.industry || '',
        draft.target_market || '',
        draft.article_type || '',
        draft.tone || '',
        draft.target_length || 1200,
        toJson(draft.brief || {}, {}),
        toJson(draft.seo || {}, {}),
        toJson(draft.outline || {}, {}),
        toJson(draft.article || {}, {}),
        draft.status || 'draft',
        draft.created_at || now(),
        draft.updated_at || draft.created_at || now()
      );
    }

    for (const item of appSettings) {
      insertSettingsStmt.run(
        item.id || createId(),
        item.user_id,
        toJson(item.settings_json || item.settings || DEFAULT_SETTINGS, DEFAULT_SETTINGS),
        item.created_at || now(),
        item.updated_at || item.created_at || now()
      );
    }

    for (const job of rankJobs) {
      insertRankJobStmt.run(
        job.id || createId(),
        job.user_id,
        job.source || 'manual',
        job.domain,
        job.provider || 'serpapi',
        job.status || 'completed',
        toJson(job.params || {}, {}),
        job.keyword_count || 0,
        job.success_count || 0,
        job.failed_count || 0,
        job.started_at || null,
        job.finished_at || null,
        job.created_at || now()
      );
    }

    for (const row of rankResults) {
      insertRankResultStmt.run(
        row.id || createId(),
        row.job_id,
        row.user_id,
        row.keyword,
        row.found ? 1 : 0,
        row.page ?? null,
        row.position ?? null,
        row.url ?? null,
        row.provider || '',
        row.error || '',
        row.queried_at || null,
        toJson(row.raw || {}, {}),
        row.created_at || now()
      );
    }

    for (const job of indexingJobs) {
      insertIndexingJobStmt.run(
        job.id || createId(),
        job.user_id,
        job.site_url || null,
        job.action,
        job.status || 'completed',
        toJson(job.params || {}, {}),
        job.total_count || 0,
        job.success_count || 0,
        job.failed_count || 0,
        job.started_at || null,
        job.finished_at || null,
        job.created_at || now()
      );
    }

    for (const row of indexingPages) {
      insertIndexingPageStmt.run(
        row.id || createId(),
        row.job_id,
        row.user_id,
        row.url,
        row.indexed === undefined || row.indexed === null ? null : row.indexed ? 1 : 0,
        row.coverage || '',
        row.indexing_state || '',
        row.last_crawl || null,
        row.error || '',
        row.checked_at || null,
        row.submission_success === undefined || row.submission_success === null
          ? null
          : row.submission_success ? 1 : 0,
        row.status_code ?? null,
        row.status_message || '',
        row.retry_count ?? null,
        toJson(row.raw || {}, {}),
        row.created_at || now()
      );
    }
  });

  tx();
}

export { backupDir, dbPath, DEFAULT_SETTINGS };
