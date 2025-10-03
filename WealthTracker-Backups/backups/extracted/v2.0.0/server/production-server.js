/**
 * Production server configuration with security headers
 * Example Express server for serving the built React app with proper CSP
 */

const express = require('express');
const path = require('path');
const compression = require('compression');
const { securityHeaders } = require('./security-headers');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable gzip compression
app.use(compression());

// Apply security headers middleware
app.use(securityHeaders);

// Serve static files from the build directory
app.use(express.static(path.join(__dirname, '../dist'), {
  // Cache static assets for 1 year
  maxAge: '1y',
  // Don't cache HTML files
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// Handle all routes by serving the index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Production server running on port ${PORT}`);
  console.log('Security headers enabled:');
  console.log('- Content Security Policy (CSP)');
  console.log('- XSS Protection');
  console.log('- Content Type Options');
  console.log('- Frame Options');
  console.log('- HSTS');
  console.log('- Referrer Policy');
  console.log('- Permissions Policy');
});