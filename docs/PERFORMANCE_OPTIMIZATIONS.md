# Performance Optimizations

This document outlines the performance optimizations implemented in the Wealth Tracker application.

## 1. Code Splitting and Lazy Loading ✅

### Route-based Code Splitting
- All route components are lazy-loaded using `React.lazy()`
- Enhanced with `lazyWithPreload` utility for intelligent preloading
- Common routes (Dashboard, Transactions, Accounts, Budget) are preloaded when the browser is idle

### Component-level Code Splitting
- Chart.js components are lazy-loaded only when needed
- XLSX library is dynamically imported only when Excel export is used
- Large vendor libraries have their own chunks

### Bundle Organization
The Vite configuration splits bundles into logical chunks:
- `react-vendor`: Core React dependencies
- `chart-vendor`: Chart.js and visualization libraries
- `ui-vendor`: UI components and icons
- `date-vendor`: Date manipulation utilities
- `form-vendor`: Form handling and validation
- `math-vendor`: Financial calculations (decimal.js)
- `xlsx`: Excel export functionality
- `ocr-vendor`: OCR functionality (tesseract.js)
- `export-vendor`: PDF and HTML export libraries

## 2. Compression Configuration ✅

### Build-time Compression
- Script: `npm run build:compress`
- Generates both Gzip (.gz) and Brotli (.br) versions of all JS/CSS files
- Brotli typically achieves 15-20% better compression than Gzip

### Server Configuration
- Example Nginx configuration provided (`nginx.conf.example`)
- Serves pre-compressed files based on browser support
- Falls back to uncompressed files for older browsers

## 3. HTTP/2 and Caching ✅

### HTTP/2 Benefits
- Multiplexing: Multiple requests over single connection
- Server push for critical resources
- Header compression

### Caching Strategy
- Static assets (JS, CSS): 1 year cache with immutable flag
- Images and fonts: 1 year cache
- HTML: No cache to ensure fresh content
- Service worker: No cache for updates
- API responses: Vary based on endpoint

## 4. Image Optimization 🚧

### Modern Format Support
- Script: `npm run optimize:images`
- Generates WebP versions (85% quality)
- Generates AVIF versions (80% quality) where supported
- Typical savings: 30-50% for WebP, 40-60% for AVIF

### Implementation
```html
<picture>
  <source srcset="image.avif" type="image/avif">
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="Description">
</picture>
```

## 5. Performance Monitoring ✅

### Lighthouse CI
- Configuration: `.lighthouserc.cjs`
- GitHub Actions workflow: `.github/workflows/performance.yml`
- Runs on every PR and push to main

### Performance Budgets
- Performance score: ≥ 80%
- Accessibility score: ≥ 90%
- LCP: ≤ 2.5s
- FCP: ≤ 1.8s
- CLS: ≤ 0.1
- TBT: ≤ 300ms

### Local Testing
- `npm run perf:analyze`: Run performance analysis
- `npm run lighthouse`: Run Lighthouse CI locally

## 6. Runtime Optimizations ✅

### React Optimizations
- Memoization with `React.memo` for expensive components
- `useMemo` and `useCallback` for expensive computations
- Virtual scrolling for large lists (react-window)

### State Management
- Context providers are split to minimize re-renders
- Local storage operations are debounced
- Background sync for non-critical updates

## 7. Bundle Size Analysis

Current bundle breakdown (3.55 MB total):
- Main app code: ~250 KB
- React + Router: ~210 KB
- Charts: ~344 KB (lazy loaded)
- XLSX: ~406 KB (lazy loaded)
- Export libraries: ~534 KB (lazy loaded)
- UI components: ~148 KB

### Recommendations for Further Optimization

1. **Replace heavy libraries**:
   - Consider lighter alternatives to Chart.js (e.g., Recharts or custom D3)
   - Use server-side Excel generation instead of client-side XLSX

2. **Progressive enhancement**:
   - Load advanced features only for users who need them
   - Implement feature flags for enterprise features

3. **Service Worker enhancements**:
   - Implement intelligent caching strategies
   - Background sync for offline support
   - Push notifications for alerts

4. **CDN Integration**:
   - Serve static assets from a CDN
   - Use edge locations for global performance

## Usage

### Development
```bash
npm run dev          # Development server
npm run build        # Production build
npm run perf:analyze # Analyze performance
```

### Production
```bash
npm run build:production  # Build with compression
npm run optimize:images   # Optimize images
```

### Deployment
1. Use the provided `nginx.conf.example` as a starting point
2. Enable HTTP/2 on your server
3. Configure SSL/TLS for security
4. Set up CDN for static assets
5. Monitor with real user metrics (RUM)