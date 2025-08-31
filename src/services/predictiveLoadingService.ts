import smartCache from './smartCacheService';
import { logger } from './loggingService';

interface PredictionRule {
  id: string;
  condition: (context: NavigationContext) => boolean;
  predictions: Prediction[];
  priority: number;
  confidence: number;
}

interface Prediction {
  type: 'page' | 'data' | 'component' | 'image';
  target: string;
  loader: () => Promise<any>;
  priority?: number;
  ttl?: number;
}

interface NavigationContext {
  currentPath: string;
  previousPath?: string;
  userRole?: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek: number;
  isMonthEnd: boolean;
  recentActions: string[];
  deviceType: 'mobile' | 'tablet' | 'desktop';
}

interface UserPattern {
  sequence: string[];
  count: number;
  lastSeen: Date;
  avgTimeSpent?: number;
}

/**
 * Predictive Loading Service
 * Design principles:
 * 1. Learn from user patterns
 * 2. Preload based on context
 * 3. Smart resource prioritization
 * 4. Bandwidth-aware loading
 * 5. Machine learning ready
 */
class PredictiveLoadingService {
  private rules: Map<string, PredictionRule>;
  private userPatterns: Map<string, UserPattern>;
  private loadingQueue: Map<string, Promise<any>>;
  private resourceBudget: number;
  private isLowBandwidth: boolean;
  private prefetchObserver?: IntersectionObserver;
  private hoverTimeout?: NodeJS.Timeout;
  private analyticsQueue: any[];

  constructor() {
    this.rules = new Map();
    this.userPatterns = new Map();
    this.loadingQueue = new Map();
    this.resourceBudget = 5; // Max concurrent preloads
    this.isLowBandwidth = false;
    this.analyticsQueue = [];

    this.initializeRules();
    this.loadUserPatterns();
    this.detectBandwidth();
    this.setupPrefetchObserver();
  }

  /**
   * Initialize prediction rules
   */
  private initializeRules() {
    // Dashboard → Transactions pattern
    this.addRule({
      id: 'dashboard-to-transactions',
      condition: (ctx) => ctx.currentPath === '/dashboard',
      predictions: [
        {
          type: 'data',
          target: 'recent-transactions',
          loader: () => this.fetchRecentTransactions(),
          priority: 1
        },
        {
          type: 'page',
          target: '/transactions',
          loader: () => this.preloadPage('/transactions'),
          priority: 2
        }
      ],
      priority: 1,
      confidence: 0.85
    });

    // Transactions → Transaction Details pattern
    this.addRule({
      id: 'transactions-to-details',
      condition: (ctx) => ctx.currentPath === '/transactions',
      predictions: [
        {
          type: 'component',
          target: 'TransactionModal',
          loader: () => import('../components/TransactionModal'),
          priority: 1
        },
        {
          type: 'data',
          target: 'categories',
          loader: () => this.fetchCategories(),
          priority: 2
        }
      ],
      priority: 1,
      confidence: 0.75
    });

    // Month-end reports pattern
    this.addRule({
      id: 'month-end-reports',
      condition: (ctx) => ctx.isMonthEnd && ctx.currentPath === '/dashboard',
      predictions: [
        {
          type: 'page',
          target: '/reports',
          loader: () => this.preloadPage('/reports'),
          priority: 1
        },
        {
          type: 'data',
          target: 'monthly-summary',
          loader: () => this.fetchMonthlySummary(),
          priority: 1
        }
      ],
      priority: 2,
      confidence: 0.9
    });

    // Morning routine pattern
    this.addRule({
      id: 'morning-routine',
      condition: (ctx) => ctx.timeOfDay === 'morning' && ctx.currentPath === '/dashboard',
      predictions: [
        {
          type: 'data',
          target: 'yesterday-transactions',
          loader: () => this.fetchYesterdayTransactions(),
          priority: 1
        },
        {
          type: 'data',
          target: 'pending-transactions',
          loader: () => this.fetchPendingTransactions(),
          priority: 2
        }
      ],
      priority: 2,
      confidence: 0.7
    });

    // Investment check pattern
    this.addRule({
      id: 'investment-check',
      condition: (ctx) => ctx.recentActions.includes('view-portfolio'),
      predictions: [
        {
          type: 'data',
          target: 'stock-prices',
          loader: () => this.fetchStockPrices(),
          priority: 1
        },
        {
          type: 'component',
          target: 'PortfolioChart',
          loader: () => import('../components/charts/OptimizedCharts'),
          priority: 2
        }
      ],
      priority: 2,
      confidence: 0.8
    });
  }

  /**
   * Add a prediction rule
   */
  addRule(rule: PredictionRule) {
    this.rules.set(rule.id, rule);
  }

  /**
   * Get predictions based on current context
   */
  getPredictions(context: NavigationContext): Prediction[] {
    const predictions: Prediction[] = [];
    const appliedRules: PredictionRule[] = [];

    // Check all rules
    this.rules.forEach(rule => {
      if (rule.condition(context)) {
        appliedRules.push(rule);
      }
    });

    // Sort by priority and confidence
    appliedRules.sort((a, b) => 
      (b.priority * b.confidence) - (a.priority * a.confidence)
    );

    // Collect predictions
    appliedRules.forEach(rule => {
      predictions.push(...rule.predictions);
    });

    // Add pattern-based predictions
    const patternPredictions = this.getPatternBasedPredictions(context);
    predictions.push(...patternPredictions);

    // Sort and deduplicate
    return this.prioritizePredictions(predictions);
  }

  /**
   * Get predictions based on user patterns
   */
  private getPatternBasedPredictions(context: NavigationContext): Prediction[] {
    const predictions: Prediction[] = [];
    const currentSequence = [...context.recentActions, context.currentPath];

    this.userPatterns.forEach(pattern => {
      // Check if current sequence matches pattern start
      if (this.sequenceMatches(currentSequence, pattern.sequence)) {
        const nextStep = pattern.sequence[currentSequence.length];
        if (nextStep) {
          predictions.push({
            type: 'page',
            target: nextStep,
            loader: () => this.preloadPage(nextStep),
            priority: pattern.count / 100 // Higher count = higher priority
          });
        }
      }
    });

    return predictions;
  }

  /**
   * Execute predictions
   */
  async executePredictions(context: NavigationContext) {
    if (this.isLowBandwidth) return;

    const predictions = this.getPredictions(context);
    const toLoad = predictions.slice(0, this.resourceBudget);

    for (const prediction of toLoad) {
      this.preload(prediction);
    }
  }

  /**
   * Preload a resource
   */
  private async preload(prediction: Prediction) {
    const key = `${prediction.type}:${prediction.target}`;
    
    // Check if already loading or loaded
    if (this.loadingQueue.has(key)) return;
    
    // Check if already in cache
    const cached = await smartCache.get(key);
    if (cached && !this.isCacheStale(cached, prediction.ttl)) return;

    // Start loading
    const loadPromise = prediction.loader()
      .then(data => {
        smartCache.set(key, data, { ttl: prediction.ttl || 5 * 60 * 1000 });
        this.trackPredictionSuccess(prediction);
        return data;
      })
      .catch(error => {
        logger.warn(`Failed to preload ${key}:`, error);
        this.trackPredictionFailure(prediction);
      })
      .finally(() => {
        this.loadingQueue.delete(key);
      });

    this.loadingQueue.set(key, loadPromise);
  }

  /**
   * Preload on hover
   */
  preloadOnHover(element: HTMLElement, target: string, type: 'page' | 'data' = 'page') {
    const handleMouseEnter = () => {
      // Clear any existing timeout
      if (this.hoverTimeout) {
        clearTimeout(this.hoverTimeout);
      }

      // Wait 100ms to avoid accidental hovers
      this.hoverTimeout = setTimeout(() => {
        const prediction: Prediction = {
          type,
          target,
          loader: type === 'page' 
            ? () => this.preloadPage(target)
            : () => this.fetchData(target),
          priority: 3
        };
        this.preload(prediction);
      }, 100);
    };

    const handleMouseLeave = () => {
      if (this.hoverTimeout) {
        clearTimeout(this.hoverTimeout);
        this.hoverTimeout = undefined;
      }
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    // Return cleanup function
    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  }

  /**
   * Setup intersection observer for viewport-based prefetching
   */
  private setupPrefetchObserver() {
    if (typeof IntersectionObserver === 'undefined') return;

    this.prefetchObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement;
            const prefetchUrl = element.dataset.prefetch;
            
            if (prefetchUrl) {
              this.preload({
                type: 'page',
                target: prefetchUrl,
                loader: () => this.preloadPage(prefetchUrl),
                priority: 2
              });
            }
          }
        });
      },
      {
        rootMargin: '50px' // Start loading 50px before element is visible
      }
    );
  }

  /**
   * Observe element for prefetching
   */
  observeForPrefetch(element: HTMLElement) {
    if (this.prefetchObserver) {
      this.prefetchObserver.observe(element);
    }
  }

  /**
   * Record user navigation pattern
   */
  recordNavigation(from: string, to: string) {
    const pattern = `${from}->${to}`;
    const existing = this.userPatterns.get(pattern) || {
      sequence: [from, to],
      count: 0,
      lastSeen: new Date()
    };

    existing.count++;
    existing.lastSeen = new Date();
    
    this.userPatterns.set(pattern, existing);
    this.saveUserPatterns();
  }

  /**
   * Background data refresh
   */
  async refreshStaleData() {
    const staleKeys = await this.findStaleData();
    
    for (const key of staleKeys) {
      // Refresh in background with low priority
      setTimeout(() => {
        this.refreshData(key);
      }, Math.random() * 5000); // Spread out refreshes
    }
  }

  /**
   * Smart resource prioritization
   */
  private prioritizePredictions(predictions: Prediction[]): Prediction[] {
    // Remove duplicates
    const seen = new Set<string>();
    const unique = predictions.filter(p => {
      const key = `${p.type}:${p.target}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by priority
    return unique.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Detect bandwidth and adjust strategy
   */
  private detectBandwidth() {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      // Check effective type
      if (connection.effectiveType) {
        this.isLowBandwidth = ['slow-2g', '2g'].includes(connection.effectiveType);
      }

      // Listen for changes
      connection.addEventListener('change', () => {
        this.isLowBandwidth = ['slow-2g', '2g'].includes(connection.effectiveType);
        
        if (this.isLowBandwidth) {
          // Cancel pending preloads
          this.loadingQueue.clear();
        }
      });
    }

    // Also check save data preference
    if ('connection' in navigator && (navigator as any).connection.saveData) {
      this.isLowBandwidth = true;
    }
  }

  // Helper methods

  private async preloadPage(path: string): Promise<void> {
    // Simulate page preload - in production, use actual routing preload
    const response = await fetch(path, { 
      method: 'HEAD',
      credentials: 'same-origin'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to preload ${path}`);
    }
  }

  private async fetchData(target: string): Promise<any> {
    // Generic data fetcher - implement based on your API
    const response = await fetch(`/api/${target}`);
    return response.json();
  }

  private async fetchRecentTransactions(): Promise<any> {
    return this.fetchData('transactions?limit=20&sort=date');
  }

  private async fetchYesterdayTransactions(): Promise<any> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return this.fetchData(`transactions?date=${yesterday.toISOString()}`);
  }

  private async fetchPendingTransactions(): Promise<any> {
    return this.fetchData('transactions?status=pending');
  }

  private async fetchCategories(): Promise<any> {
    return this.fetchData('categories');
  }

  private async fetchMonthlySummary(): Promise<any> {
    return this.fetchData('reports/monthly-summary');
  }

  private async fetchStockPrices(): Promise<any> {
    return this.fetchData('portfolio/prices');
  }

  private sequenceMatches(current: string[], pattern: string[]): boolean {
    if (current.length >= pattern.length) return false;
    
    for (let i = 0; i < current.length; i++) {
      if (current[i] !== pattern[i]) return false;
    }
    
    return true;
  }

  private isCacheStale(data: any, ttl?: number): boolean {
    // Implementation depends on cache structure
    return false;
  }

  private async findStaleData(): Promise<string[]> {
    // Find data that needs refreshing
    return [];
  }

  private async refreshData(key: string): Promise<void> {
    // Refresh specific data
  }

  private trackPredictionSuccess(prediction: Prediction) {
    this.analyticsQueue.push({
      type: 'prediction_success',
      prediction,
      timestamp: Date.now()
    });
  }

  private trackPredictionFailure(prediction: Prediction) {
    this.analyticsQueue.push({
      type: 'prediction_failure',
      prediction,
      timestamp: Date.now()
    });
  }

  private loadUserPatterns() {
    try {
      const saved = localStorage.getItem('userNavigationPatterns');
      if (saved) {
        const patterns = JSON.parse(saved);
        this.userPatterns = new Map(Object.entries(patterns));
      }
    } catch (e) {
      logger.warn('Failed to load user patterns:', e);
    }
  }

  private saveUserPatterns() {
    try {
      const patterns = Object.fromEntries(this.userPatterns);
      localStorage.setItem('userNavigationPatterns', JSON.stringify(patterns));
    } catch (e) {
      logger.warn('Failed to save user patterns:', e);
    }
  }

  /**
   * Get current context
   */
  getCurrentContext(): NavigationContext {
    const now = new Date();
    const hour = now.getHours();
    
    let timeOfDay: NavigationContext['timeOfDay'];
    if (hour < 6) timeOfDay = 'night';
    else if (hour < 12) timeOfDay = 'morning';
    else if (hour < 18) timeOfDay = 'afternoon';
    else timeOfDay = 'evening';

    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const isMonthEnd = now.getDate() >= lastDayOfMonth - 3;

    return {
      currentPath: window.location.pathname,
      timeOfDay,
      dayOfWeek: now.getDay(),
      isMonthEnd,
      recentActions: [], // Should be tracked separately
      deviceType: this.getDeviceType()
    };
  }

  private getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }
}

// Create singleton instance
export const predictiveLoader = new PredictiveLoadingService();

export default predictiveLoader;