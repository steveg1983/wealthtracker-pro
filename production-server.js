import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4173;
const DIST_DIR = path.join(__dirname, 'dist');

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript', // Correct MIME type for ES modules
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf'
};

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  // Parse URL
  let filePath = path.join(DIST_DIR, req.url === '/' ? 'index.html' : req.url);
  
  // Check if file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      // File doesn't exist, serve index.html for client-side routing
      filePath = path.join(DIST_DIR, 'index.html');
    }
    
    // Get file extension
    const extname = String(path.extname(filePath)).toLowerCase();
    // Default to JavaScript for files without extension in assets folder
    let contentType = mimeTypes[extname];
    if (!contentType) {
      if (filePath.includes('/assets/') && !extname) {
        contentType = 'application/javascript';
      } else {
        contentType = 'application/octet-stream';
      }
    }
    
    // Read and serve file
    fs.readFile(filePath, (error, content) => {
      if (error) {
        if (error.code === 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end('<h1>404 - File Not Found</h1>', 'utf-8');
        } else {
          res.writeHead(500);
          res.end(`Server Error: ${error.code}`, 'utf-8');
        }
      } else {
        // Set caching headers
        if (extname === '.js' || extname === '.css') {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (extname === '.html') {
          res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=3600');
        }
        
        // Add performance hints for critical resources
        if (req.url === '/' || req.url === '/index.html') {
          res.setHeader('Link', '</assets/index.css>; rel=preload; as=style, </assets/vendor.js>; rel=preload; as=script');
        }
        
        // Check if client accepts compression and file is text-based
        const acceptEncoding = req.headers['accept-encoding'] || '';
        const shouldCompress = /\.(js|css|html|json|xml|svg|txt)$/i.test(extname);
        
        // Ensure proper Content-Type for JavaScript modules
        let finalContentType = contentType;
        if (extname === '.js' || extname === '.mjs') {
          finalContentType = 'application/javascript; charset=UTF-8';
        }
        
        if (shouldCompress && acceptEncoding.includes('gzip')) {
          // Compress with gzip
          res.setHeader('Content-Encoding', 'gzip');
          res.writeHead(200, { 'Content-Type': finalContentType });
          const gzip = zlib.createGzip({ level: 9 });
          gzip.end(content);
          gzip.pipe(res);
        } else if (shouldCompress && acceptEncoding.includes('br')) {
          // Compress with brotli
          res.setHeader('Content-Encoding', 'br');
          res.writeHead(200, { 'Content-Type': finalContentType });
          const br = zlib.createBrotliCompress();
          br.end(content);
          br.pipe(res);
        } else {
          // No compression
          res.writeHead(200, { 'Content-Type': finalContentType });
          res.end(content, 'utf-8');
        }
      }
    });
  });
});

// Set keep-alive to handle multiple connections
server.keepAliveTimeout = 60000;
server.headersTimeout = 65000;

server.listen(PORT, () => {
  console.log(`Production server running at http://localhost:${PORT}`);
  console.log('This server can handle multiple concurrent connections');
  console.log('Press Ctrl+C to stop');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});