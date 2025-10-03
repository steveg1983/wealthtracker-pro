# Security Configuration

This document outlines the security measures implemented in Wealth Tracker.

## Content Security Policy (CSP)

Content Security Policy (CSP) is implemented to prevent XSS attacks and other code injection vulnerabilities.

### Implementation

1. **Development Environment**: CSP headers are applied via Vite plugin (`vite.config.ts`)
2. **Production Environment**: CSP headers are configured in:
   - `public/_headers` (Netlify)
   - `vercel.json` (Vercel)
   - `server/production-server.js` (Node.js/Express)

### CSP Directives

```
default-src 'self'
script-src 'self' 'unsafe-inline' 'unsafe-eval' https:
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
img-src 'self' data: blob: https:
font-src 'self' https://fonts.gstatic.com
connect-src 'self' https://api.exchangerate-api.com https://cdn.jsdelivr.net
media-src 'self' blob:
object-src 'none'
frame-ancestors 'none'
base-uri 'self'
form-action 'self'
upgrade-insecure-requests
```

### Security Headers

The following security headers are implemented:

- **X-XSS-Protection**: `1; mode=block` - Enables XSS filtering
- **X-Content-Type-Options**: `nosniff` - Prevents MIME type sniffing
- **X-Frame-Options**: `DENY` - Prevents clickjacking
- **Strict-Transport-Security**: `max-age=31536000; includeSubDomains` - Enforces HTTPS
- **Referrer-Policy**: `strict-origin-when-cross-origin` - Controls referrer information
- **Permissions-Policy**: Disables unnecessary browser features

### CSP Violation Reporting

CSP violations are logged to the console in development. In production, consider implementing a reporting endpoint:

```javascript
// Example CSP with reporting
Content-Security-Policy: default-src 'self'; report-uri /csp-violation-report
```

### Testing CSP

1. **Browser DevTools**: Check Network tab for CSP headers
2. **Console**: Look for CSP violation errors
3. **Online Tools**: Use CSP evaluators to validate your policy

### Adjusting CSP

If you need to add new external resources:

1. Update `src/security/csp.ts` for development
2. Update deployment configurations (`_headers`, `vercel.json`)
3. Test thoroughly to ensure no legitimate resources are blocked

## XSS Protection

Wealth Tracker implements comprehensive XSS protection using DOMPurify.

### Features

1. **Automatic Input Sanitization**: All user inputs are sanitized
2. **Type-Specific Sanitization**: Different sanitization for text, HTML, URLs, etc.
3. **Validation Integration**: Zod schemas include sanitization
4. **Component Library**: Pre-built sanitized input components

### Usage

See [XSS_PROTECTION.md](./XSS_PROTECTION.md) for detailed implementation guide.

## Data Encryption

Wealth Tracker implements comprehensive encryption for sensitive data.

### Features

1. **Automatic Encryption**: Financial data is automatically encrypted
2. **IndexedDB Storage**: More secure than localStorage
3. **Key Management**: Device-specific key derivation
4. **Migration**: Automatic migration from localStorage

### Usage

See [ENCRYPTION.md](./ENCRYPTION.md) for detailed implementation guide.

## Security Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface                        │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ SanitizedInput│  │  SecureField │  │   SafeHTML   │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                  Validation Layer                        │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │     Zod     │  │   DOMPurify  │  │ Sanitization │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                   Storage Layer                          │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Encryption │  │  IndexedDB   │  │ Compression  │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                  Network Layer                           │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │     CSP     │  │    HTTPS     │  │   Headers    │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Security Resources

- **[Security Audit Report](./SECURITY_AUDIT.md)** - Latest security audit findings and recommendations
- **[XLSX Migration Guide](./XLSX_MIGRATION.md)** - Guide for migrating away from vulnerable xlsx library
- **[Security Checklist](./SECURITY_CHECKLIST.md)** - Comprehensive security checklist for ongoing maintenance
- **[XSS Protection Guide](./XSS_PROTECTION.md)** - Detailed XSS protection implementation
- **[Encryption Guide](./ENCRYPTION.md)** - Comprehensive encryption documentation

## Automated Security

Security scanning is automated via GitHub Actions:
- **Continuous**: Security checks on every PR and push to main
- **Scheduled**: Weekly comprehensive security audits
- **CodeQL**: Static code analysis for vulnerabilities
- **Dependency Scanning**: Automated vulnerability detection

See `.github/workflows/security.yml` for configuration.

## Current Security Status

### ✅ Implemented
- Content Security Policy (CSP) headers
- XSS protection with DOMPurify
- AES-256 encryption for sensitive data
- Security headers (HSTS, X-Frame-Options, etc.)
- Automated security scanning

### ⚠️ In Progress
- Migration from vulnerable xlsx library
- CSP violation reporting endpoint
- Security event logging

### 🔜 Planned
- Rate limiting for sensitive operations
- Comprehensive audit logging
- Penetration testing

## Vulnerability Status

**Last Audit**: 2025-07-23
- **High Severity**: 7 (xlsx library - migration in progress)
- **Moderate Severity**: 4 (vercel dependencies)
- **Critical**: 0

See [Security Audit Report](./SECURITY_AUDIT.md) for details.

## Quick Actions

1. **Run Security Audit**:
   ```bash
   npm audit
   node scripts/fix-vulnerabilities.js
   ```

2. **Fix Vulnerabilities**:
   ```bash
   npm audit fix
   npm install vercel@25.2.0 --save-dev
   ```

3. **Check Security Headers**:
   ```bash
   npm run build
   npm run preview
   # Check network tab for security headers
   ```