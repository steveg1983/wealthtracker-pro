export const performanceMetrics = {
  // Acceptable time limits in milliseconds
  accountCreation: {
    single: 3000, // 3 seconds for single account
    bulk: 3000, // 3 seconds per account in bulk
  },
  
  // UI responsiveness
  modalOpen: 1000, // 1 second to open modal
  formSubmit: 2000, // 2 seconds to submit and close
  
  // Memory limits
  memoryGrowth: {
    maxPerOperation: 5 * 1024 * 1024, // 5MB per operation
    maxTotal: 50 * 1024 * 1024, // 50MB total growth
  },
  
  // Page load metrics
  pageLoad: {
    firstContentfulPaint: 1500,
    largestContentfulPaint: 2500,
    timeToInteractive: 3500,
  }
};

export async function measurePerformance(page: any, operation: () => Promise<void>) {
  const startTime = performance.now();
  const startMetrics = await page.evaluate(() => ({
    memory: (performance as any).memory?.usedJSHeapSize || 0,
    entries: performance.getEntries().length,
  }));
  
  await operation();
  
  const endTime = performance.now();
  const endMetrics = await page.evaluate(() => ({
    memory: (performance as any).memory?.usedJSHeapSize || 0,
    entries: performance.getEntries().length,
  }));
  
  return {
    duration: endTime - startTime,
    memoryUsed: endMetrics.memory - startMetrics.memory,
    performanceEntries: endMetrics.entries - startMetrics.entries,
  };
}