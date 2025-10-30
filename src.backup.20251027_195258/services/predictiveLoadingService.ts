import smartCache from './smartCacheService';
import { logger } from './loggingService';

type PredictionType = 'page' | 'data' | 'component' | 'image';
type PredictionLoader = () => Promise<unknown>;
type TimeoutHandle = ReturnType<typeof setTimeout>;

interface PredictionRule {
  id: string;
  condition: (context: NavigationContext) => boolean;
  predictions: Prediction[];
  priority: number;
  confidence: number;
}

interface Prediction {
  type: PredictionType;
  target: string;
  loader: PredictionLoader;
  priority?: number;
  ttl?: number;
}

export interface NavigationContext {
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

type StoredUserPattern = Omit<UserPattern, 'lastSeen'> & { lastSeen: string };

interface AnalyticsEvent {
  type: 'prediction_success' | 'prediction_failure';
  prediction: Prediction;
  timestamp: number;
}

interface NetworkInformationLike {
  downlink?: number;
  effectiveType?: string;
  rtt?: number;
  saveData?: boolean;
  addEventListener?: (type: 'change', listener: () => void) => void;
  removeEventListener?: (type: 'change', listener: () => void) => void;
}

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformationLike;
};

const isStoredUserPattern = (value: unknown): value is StoredUserPattern => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return Array.isArray(record.sequence)
    && record.sequence.every(item => typeof item === 'string')
    && typeof record.count === 'number'
    && typeof record.lastSeen === 'string'
    && (record.avgTimeSpent === undefined || typeof record.avgTimeSpent === 'number');
};

const isStoredUserPatternRecord = (
  value: unknown
): value is Record<string, StoredUserPattern> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const entries = Object.values(value);
  return entries.every(isStoredUserPattern);
};

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
  private loadingQueue: Map<string, Promise<unknown>>;
  private resourceBudget: number;
  private isLowBandwidth: boolean;
  private prefetchObserver?: IntersectionObserver;
  private hoverTimeout: TimeoutHandle | null;
  private analyticsQueue: AnalyticsEvent[];

  constructor() {
    this.rules = new Map();
    this.userPatterns = new Map();
    this.loadingQueue = new Map();
    this.resourceBudget = 5; // Max concurrent preloads
    this.isLowBandwidth = false;
    this.analyticsQueue = [];
    this.hoverTimeout = null;

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
   * Public entry point for manual preload requests
   */
  requestPreload(prediction: Prediction) {
    return this.preload(prediction);
  }

  /**
   * Preload a resource
   */
  private async preload(prediction: Prediction) {
    const key = `${prediction.type}:${prediction.target}`;
    
    // Check if already loading or loaded
    if (this.loadingQueue.has(key)) return;
    
    // Check if already in cache
    const cached = await smartCache.get<unknown>(key);
    if (cached && !this.isCacheStale(cached, prediction.ttl)) return;

    // Start loading
    const loadPromise = prediction.loader()
      .then(data => {
        smartCache.set<unknown>(key, data, { ttl: prediction.ttl || 5 * 60 * 1000 });
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
      if (this.hoverTimeout !== null) {
        clearTimeout(this.hoverTimeout);
        this.hoverTimeout = null;
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

  unobserveForPrefetch(element: HTMLElement) {
    this.prefetchObserver?.unobserve(element);
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
        void this.refreshData(key);
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
    const connection = this.getNetworkInformation();

    if (connection) {
      const updateBandwidth = () => {
        const effectiveType = connection.effectiveType ?? '';
        this.isLowBandwidth = ['slow-2g', '2g'].includes(effectiveType);

        if (this.isLowBandwidth) {
          this.loadingQueue.clear();
        }
      };

      updateBandwidth();

      if (typeof connection.addEventListener === 'function') {
        connection.addEventListener('change', updateBandwidth);
      }
    }

    if (this.getNetworkInformation()?.saveData) {
      this.isLowBandwidth = true;
    }
  }

  private getNetworkInformation(): NetworkInformationLike | null {
    if (typeof navigator === 'undefined') {
      return null;
    }

    const navigatorWithConnection = navigator as NavigatorWithConnection;
    return navigatorWithConnection.connection ?? null;
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

  private async fetchData(target: string): Promise<unknown> {
    // Generic data fetcher - implement based on your API
    const response = await fetch(`/api/${target}`);
    return response.json() as Promise<unknown>;
  }

  private async fetchRecentTransactions(): Promise<unknown> {
    return this.fetchData('transactions?limit=20&sort=date');
  }

  private async fetchYesterdayTransactions(): Promise<unknown> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return this.fetchData(`transactions?date=${yesterday.toISOString()}`);
  }

  private async fetchPendingTransactions(): Promise<unknown> {
    return this.fetchData('transactions?status=pending');
  }

  private async fetchCategories(): Promise<unknown> {
    return this.fetchData('categories');
  }

  private async fetchMonthlySummary(): Promise<unknown> {
    return this.fetchData('reports/monthly-summary');
  }

  private async fetchStockPrices(): Promise<unknown> {
    return this.fetchData('portfolio/prices');
  }

  private sequenceMatches(current: string[], pattern: string[]): boolean {
    if (current.length >= pattern.length) return false;
    
    for (let i = 0; i < current.length; i++) {
      if (current[i] !== pattern[i]) return false;
    }
    
    return true;
  }

  private isCacheStale(_data: unknown, _ttl?: number): boolean {
    // Implementation depends on cache structure
    return false;
  }

  private async findStaleData(): Promise<string[]> {
    // Find data that needs refreshing
    return [];
  }

  private async refreshData(_key: string): Promise<void> {
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
        const parsed = JSON.parse(saved) as unknown;
        if (isStoredUserPatternRecord(parsed)) {
          const patterns = Object.entries(parsed).map<[string, UserPattern]>(([key, pattern]) => [
            key,
            {
              sequence: [...pattern.sequence],
              count: pattern.count,
              lastSeen: new Date(pattern.lastSeen),
              ...(pattern.avgTimeSpent !== undefined && { avgTimeSpent: pattern.avgTimeSpent })
            }
          ]);
          this.userPatterns = new Map(patterns);
        }
      }
    } catch (error) {
      logger.warn('Failed to load user patterns:', error);
    }
  }

  private saveUserPatterns() {
    try {
      const serialisablePatterns: Record<string, StoredUserPattern> = Object.fromEntries(
        Array.from(this.userPatterns.entries()).map(([key, pattern]) => [
          key,
          {
            sequence: [...pattern.sequence],
            count: pattern.count,
            lastSeen: pattern.lastSeen.toISOString(),
            ...(pattern.avgTimeSpent !== undefined && { avgTimeSpent: pattern.avgTimeSpent })
          }
        ])
      );

      localStorage.setItem('userNavigationPatterns', JSON.stringify(serialisablePatterns));
    } catch (error) {
      logger.warn('Failed to save user patterns:', error);
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
