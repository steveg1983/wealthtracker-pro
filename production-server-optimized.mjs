import compression from 'compression';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 4173;
const DIST_DIR = path.join(__dirname, 'dist');

// Enable aggressive gzip/brotli compression
app.use(compression({
  level: 9, // Maximum compression
  threshold: 0, // Compress everything
  filter: (req, res) => {
    // Compress all text-based responses
    const type = res.getHeader('Content-Type');
    if (type) {
      return /text|javascript|json|css|html|xml|svg/.test(type);
    }
    return true;
  }
}));

// Serve pre-compressed files if available (brotli first, then gzip)
app.get('/*.js', (req, res, next) => {
  const brPath = req.path + '.br';
  const gzPath = req.path + '.gz';
  const brFile = path.join(DIST_DIR, brPath);
  const gzFile = path.join(DIST_DIR, gzPath);
  
  // Try brotli first
  if (fs.existsSync(brFile)) {
    req.url = brPath;
    res.set('Content-Encoding', 'br');
    res.set('Content-Type', 'application/javascript');
  } 
  // Then try gzip
  else if (fs.existsSync(gzFile)) {
    req.url = gzPath;
    res.set('Content-Encoding', 'gzip');
    res.set('Content-Type', 'application/javascript');
  }
  next();
});

app.get('/*.css', (req, res, next) => {
  const brPath = req.path + '.br';
  const gzPath = req.path + '.gz';
  const brFile = path.join(DIST_DIR, brPath);
  const gzFile = path.join(DIST_DIR, gzPath);
  
  if (fs.existsSync(brFile)) {
    req.url = brPath;
    res.set('Content-Encoding', 'br');
    res.set('Content-Type', 'text/css');
  } else if (fs.existsSync(gzFile)) {
    req.url = gzPath;
    res.set('Content-Encoding', 'gzip');
    res.set('Content-Type', 'text/css');
  }
  next();
});

// Set proper cache headers
app.use((req, res, next) => {
  // Immutable caching for hashed assets
  if (req.path.match(/\.(js|css)$/) && req.path.includes('-')) {
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  } 
  // Short cache for HTML
  else if (req.path.match(/\.html$/)) {
    res.set('Cache-Control', 'public, max-age=300');
  }
  // Medium cache for other assets
  else {
    res.set('Cache-Control', 'public, max-age=3600');
  }
  next();
});

// Serve static files
app.use(express.static(DIST_DIR));

// Handle client-side routing - serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Optimized production server running at http://localhost:${PORT}`);
  console.log('Features: Compression, pre-compressed file serving, proper caching');
  console.log('Press Ctrl+C to stop');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, closing server...');
  process.exit(0);
});