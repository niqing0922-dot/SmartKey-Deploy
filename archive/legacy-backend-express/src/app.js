import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import './lib/db.js';

import authRoutes from './routes/auth.js';
import keywordsRoutes from './routes/keywords.js';
import articlesRoutes from './routes/articles.js';
import aiRoutes from './routes/ai.js';
import dashboardRoutes from './routes/dashboard.js';
import geoWriterRoutes from './routes/geoWriter.js';
import rankRoutes from './routes/rank.js';
import indexingRoutes from './routes/indexing.js';
import localDataRoutes from './routes/localData.js';
import settingsRoutes from './routes/settings.js';

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
const frontendIndexPath = path.join(frontendDistPath, 'index.html');
const hasFrontendBuild = fs.existsSync(frontendIndexPath);

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/keywords', keywordsRoutes);
app.use('/api/articles', articlesRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/geo-writer', geoWriterRoutes);
app.use('/api/rank', rankRoutes);
app.use('/api/indexing', indexingRoutes);
app.use('/api/local-data', localDataRoutes);
app.use('/api/settings', settingsRoutes);

if (hasFrontendBuild) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      next();
      return;
    }
    res.sendFile(frontendIndexPath);
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`SmartKey Backend running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  if (hasFrontendBuild) {
    console.log(`Serving frontend build from ${frontendDistPath}`);
  }
});

// Export for testing
export default app;
