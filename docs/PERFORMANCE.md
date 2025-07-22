# Performance Monitoring Guide

This document outlines the performance monitoring setup for WealthTracker, including Core Web Vitals tracking, bundle size monitoring, and continuous performance testing.

## Overview

WealthTracker implements comprehensive performance monitoring to ensure a fast, responsive user experience. We track:

- **Core Web Vitals**: FCP, LCP, CLS, FID, INP, TTFB
- **Bundle Size**: JavaScript, CSS, and total asset sizes
- **Runtime Performance**: Memory usage, long tasks, component render times
- **Custom Metrics**: App-specific performance indicators

## Performance Budgets

### Core Web Vitals Targets

| Metric | Good | Poor | Description |
|--------|------|------|-------------|
| FCP | ≤ 1.8s | > 3.0s | First Contentful Paint |
| LCP | ≤ 2.5s | > 4.0s | Largest Contentful Paint |
| CLS | ≤ 0.1 | > 0.25 | Cumulative Layout Shift |
| FID | ≤ 100ms | > 300ms | First Input Delay |
| INP | ≤ 200ms | > 500ms | Interaction to Next Paint |
| TTFB | ≤ 800ms | > 1.8s | Time to First Byte |

### Bundle Size Budgets

- **Total Bundle**: < 1MB
- **Main Bundle**: < 300KB
- **Lazy Chunks**: < 200KB each
- **CSS**: < 100KB
- **Images**: < 500KB total

## Usage

### 1. Performance Hook

Use the `usePerformanceMonitoring` hook to track custom metrics:

```typescript
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';

function MyComponent() {
  const { trackCustomMetric, measureComponentRender } = usePerformanceMonitoring();
  
  // Track component render time
  const measure = measureComponentRender('MyComponent');
  
  useEffect(() => {
    measure.start();
    // Component logic...
    measure.end();
  }, []);
  
  // Track custom metric
  const handleDataLoad = (loadTime: number) => {
    trackCustomMetric('data-load-time', loadTime);
  };
}
```

### 2. Performance Dashboard

Access the performance dashboard in development at `/performance`:

- View Core Web Vitals in real-time
- Monitor bundle sizes
- Check memory usage
- See performance recommendations

### 3. CI/CD Integration

Performance checks run automatically on:
- Every push to `main`
- All pull requests

Failed performance budgets will block merges.

## Local Testing

### Run Lighthouse

```bash
# Install Lighthouse CI
npm install -g @lhci/cli

# Run Lighthouse tests
npm run build
lhci autorun
```

### Check Bundle Size

```bash
# Build and analyze
npm run build
npx vite-bundle-visualizer

# View bundle stats
open dist/stats.html
```

### Test Web Vitals

```bash
# Install Web Vitals CLI
npm install -g web-vitals-cli

# Start preview server
npm run preview

# Measure Web Vitals
web-vitals http://localhost:4173
```

## Performance Optimization Tips

### 1. Code Splitting

Use dynamic imports for large components:

```typescript
const HeavyChart = lazy(() => import('./components/HeavyChart'));
```

### 2. Image Optimization

- Use WebP format when possible
- Implement lazy loading for images
- Compress images before committing

### 3. Bundle Optimization

- Tree-shake unused code
- Use production builds for testing
- Monitor dependency sizes

### 4. Runtime Performance

- Virtualize long lists
- Debounce search inputs
- Memoize expensive calculations
- Use Web Workers for heavy processing

## Monitoring in Production

### 1. Real User Monitoring (RUM)

Configure RUM by setting the performance endpoint:

```env
VITE_PERFORMANCE_ENDPOINT=https://your-rum-endpoint.com
```

### 2. Sampling Rates

Adjust sampling in `performance.config.js`:

```javascript
sampling: {
  webVitals: 0.1,      // 10% of users
  customMetrics: 0.05, // 5% of users
  errors: 1.0,         // 100% of errors
}
```

### 3. Custom Dashboards

Create custom performance dashboards using:
- Google Analytics
- Sentry Performance
- Custom backend analytics

## Troubleshooting

### High LCP

1. Optimize critical rendering path
2. Preload key resources
3. Reduce server response time

### High CLS

1. Set explicit dimensions on images/videos
2. Avoid inserting content above existing content
3. Use CSS transforms for animations

### Large Bundle Size

1. Run bundle analyzer: `npx vite-bundle-visualizer`
2. Check for duplicate dependencies
3. Use dynamic imports for large features

### Memory Leaks

1. Check Performance Dashboard memory usage
2. Use Chrome DevTools Memory Profiler
3. Look for event listener cleanup issues

## Performance Checklist

Before deploying:

- [ ] Run Lighthouse CI locally
- [ ] Check bundle size is under budget
- [ ] Test on slow 3G network
- [ ] Verify no console errors
- [ ] Test on low-end devices
- [ ] Check memory usage over time
- [ ] Validate Core Web Vitals

## Resources

- [Web.dev Performance Guide](https://web.dev/performance/)
- [Core Web Vitals](https://web.dev/vitals/)
- [Lighthouse CI Documentation](https://github.com/GoogleChrome/lighthouse-ci)
- [Vite Performance Guide](https://vitejs.dev/guide/performance.html)