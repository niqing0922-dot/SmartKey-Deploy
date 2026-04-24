import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from src/
app.use(express.static('src'));

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'keyword-matrix-glass.html'));
});

// API proxy to backend (if backend is on same server, different port)
const API_BASE = process.env.API_BASE || 'http://localhost:3000';

// Proxy API requests to backend
app.use('/api', async (req, res) => {
  try {
    const url = `${API_BASE}${req.url}`;
    const options = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.authorization && { 'Authorization': req.headers.authorization })
      }
    };
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      options.body = JSON.stringify(req.body);
    }
    const response = await fetch(url, options);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(502).json({ error: 'Backend unavailable' });
  }
});

app.listen(PORT, () => {
  console.log(`SmartKey Web App: http://localhost:${PORT}`);
});
