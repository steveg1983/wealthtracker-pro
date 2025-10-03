import compression from 'compression';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 4173;
const DIST_DIR = path.join(__dirname, 'dist');

// Enable aggressive gzip compression
app.use(compression({
  level: 9, // Maximum compression
  threshold: 0 // Compress everything
}));

// Set proper cache headers for static assets
app.use((req, res, next) => {
  // Immutable caching for hashed assets
  if (req.path.match(/\-[a-zA-Z0-9]{8}\.(js|css)$/)) {
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  } 
  // Short cache for HTML
  else if (req.path.endsWith('.html') || req.path === '/') {
    res.set('Cache-Control', 'public, max-age=300');
  }
  // Medium cache for other assets
  else {
    res.set('Cache-Control', 'public, max-age=3600');
  }
  next();
});

// Serve static files with compression
app.use(express.static(DIST_DIR, {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Set correct MIME types
    if (filePath.endsWith('.js')) {
      res.set('Content-Type', 'application/javascript');
    } else if (filePath.endsWith('.css')) {
      res.set('Content-Type', 'text/css');
    }
  }
}));

// Handle client-side routing - serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Optimized production server running at http://localhost:${PORT}`);
  console.log('✨ Features: Text compression (gzip level 9), optimal caching');
  console.log('📊 This should significantly improve Lighthouse scores');
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