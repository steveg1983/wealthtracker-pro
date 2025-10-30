import { lazyLogger } from '../services/serviceFactory';
import { toDecimal } from '@wealthtracker/utils';

const logger = lazyLogger.getLogger('DynamicImports');

/**
 * Dynamic Import Utilities
 * Lazy load heavy dependencies only when needed
 */

// Cache for loaded modules
const moduleCache = new Map<string, unknown>();

// Excel/Spreadsheet functionality
export async function importXLSX(): Promise<typeof import('xlsx')> {
  if (!moduleCache.has('xlsx')) {
    const module = await import('xlsx');
    moduleCache.set('xlsx', module);
  }
  return moduleCache.get('xlsx') as typeof import('xlsx');
}

// PDF functionality
export async function importPDFLibraries(): Promise<{ jsPDF: typeof import('jspdf').jsPDF; html2canvas: typeof import('html2canvas').default }> {
  if (!moduleCache.has('pdf-libs')) {
    const [{ jsPDF }, html2canvasModule] = await Promise.all([
      import('jspdf'),
      import('html2canvas')
    ]);
    moduleCache.set('pdf-libs', { jsPDF, html2canvas: html2canvasModule.default });
  }
  return moduleCache.get('pdf-libs') as { jsPDF: typeof import('jspdf').jsPDF; html2canvas: typeof import('html2canvas').default };
}

// Chart components
export async function importCharts(): Promise<typeof import('recharts')> {
  if (!moduleCache.has('recharts')) {
    const module = await import('recharts');
    moduleCache.set('recharts', module);
  }
  return moduleCache.get('recharts') as typeof import('recharts');
}

// OCR functionality
export async function importTesseract(): Promise<typeof import('tesseract.js')> {
  if (!moduleCache.has('tesseract')) {
    const module = await import('tesseract.js');
    moduleCache.set('tesseract', module);
  }
  return moduleCache.get('tesseract') as typeof import('tesseract.js');
}

// Search functionality
export async function importFuse(): Promise<typeof import('fuse.js')['default']> {
  if (!moduleCache.has('fuse')) {
    const module = await import('fuse.js');
    moduleCache.set('fuse', module.default);
  }
  return moduleCache.get('fuse') as typeof import('fuse.js')['default'];
}

// Animation library
export async function importFramerMotion(): Promise<typeof import('framer-motion')> {
  if (!moduleCache.has('framer-motion')) {
    const module = await import('framer-motion');
    moduleCache.set('framer-motion', module);
  }
  return moduleCache.get('framer-motion') as typeof import('framer-motion');
}

// Preload critical modules when browser is idle
export function preloadCriticalModules() {
  if ('requestIdleCallback' in window) {
    // Preload commonly used heavy modules
    requestIdleCallback(() => {
      // Don't await these - let them load in background
      importCharts().catch(() => {}); // Charts are used frequently
      importFuse().catch(() => {}); // Search is common
    });
  }
}

// Feature-based dynamic imports
export const featureImports = {
  async importExport() {
    const [xlsx, pdfLibs] = await Promise.all([
      importXLSX(),
      importPDFLibraries()
    ]);
    return { xlsx, ...pdfLibs };
  },
  
  async importOCR() {
    return importTesseract();
  },
  
  async importAdvancedCharts() {
    const charts = await importCharts();
    // Return specific advanced chart components
    return {
      Treemap: charts.Treemap,
      Sankey: charts.Sankey,
      Radar: charts.Radar,
      Funnel: charts.Funnel
    };
  },
  
  async importAnimations() {
    return importFramerMotion();
  }
};

// Utility to measure import time
export async function measureImport<T>(
  name: string, 
  importFn: () => Promise<T>
): Promise<T> {
  if (typeof performance !== 'undefined') {
    const start = performance.now();
    try {
      const result = await importFn();
      const end = performance.now();
      const duration = toDecimal(end - start).toDecimalPlaces(2).toNumber();
      logger.info(`Loaded module`, { name, ms: duration });
      return result;
    } catch (error) {
      const end = performance.now();
      const duration = toDecimal(end - start).toDecimalPlaces(2).toNumber();
      logger.error(`❌ Failed to load ${name} after ${duration}ms`, error);
      throw error;
    }
  }
  return importFn();
}

// Resource hints for better loading performance
export function addResourceHints() {
  const hints = [
    // Preconnect to CDNs
    { rel: 'preconnect', href: 'https://cdn.sheetjs.com' },
    
    // DNS prefetch for potential external resources
    { rel: 'dns-prefetch', href: 'https://fonts.googleapis.com' },
    
    // Prefetch heavy modules likely to be used
    { rel: 'prefetch', href: '/assets/xlsx-*.js', as: 'script' },
    { rel: 'prefetch', href: '/assets/jspdf-*.js', as: 'script' }
  ];
  
  hints.forEach(hint => {
    const link = document.createElement('link');
    Object.assign(link, hint);
    document.head.appendChild(link);
  });
}
