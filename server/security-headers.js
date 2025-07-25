/**
 * Production server security headers configuration
 * This file provides middleware for Express/Node.js servers
 */

const crypto = require('crypto');

// Generate a nonce for inline scripts
const generateNonce = () => {
  return crypto.randomBytes(16).toString('base64');
};

// CSP configuration for production
const getCSPHeader = (nonce) => {
  const directives = [
    // Default policy
    "default-src 'self'",
    
    // Scripts: self and nonce for inline scripts
    `script-src 'self' ${nonce ? `'nonce-${nonce}'` : ''} 'strict-dynamic'`,
    
    // Styles: self and unsafe-inline for styled components
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    
    // Images: self, data URIs, and https
    "img-src 'self' data: blob: https:",
    
    // Fonts: self and Google Fonts
    "font-src 'self' https://fonts.gstatic.com",
    
    // Connect: self and API endpoints
    "connect-src 'self' https://api.exchangerate-api.com https://cdn.jsdelivr.net",
    
    // Media: self and blob
    "media-src 'self' blob:",
    
    // Objects: none
    "object-src 'none'",
    
    // Frame ancestors: none (prevent clickjacking)
    "frame-ancestors 'none'",
    
    // Base URI: self only
    "base-uri 'self'",
    
    // Form action: self only
    "form-action 'self'",
    
    // Upgrade insecure requests
    'upgrade-insecure-requests',
  ];

  return directives.join('; ');
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  const nonce = generateNonce();
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', getCSPHeader(nonce));
  
  // Other security headers
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()');
  
  // Make nonce available to templates
  res.locals.nonce = nonce;
  
  next();
};

module.exports = { securityHeaders, generateNonce };