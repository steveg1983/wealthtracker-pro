import { getStockQuote, type StockQuote } from './stockPriceService';
import type { JsonValue } from '../types/common';
import { createScopedLogger, type ScopedLogger } from '../loggers/scopedLogger';

export interface PriceUpdate {
  symbol: string;
  quote: StockQuote;
  timestamp: Date;
}

export type PriceUpdateCallback = (update: PriceUpdate) => void;

export interface RealTimePriceServiceOptions {
  defaultUpdateFrequency?: number;
  marketStatusCheckIntervalMs?: number;
  enableMarketStatusCheck?: boolean;
  now?: () => Date;
  setIntervalFn?: (handler: (...args: unknown[]) => void, timeout: number) => NodeJS.Timeout;
  clearIntervalFn?: (handle: NodeJS.Timeout) => void;
  logger?: ScopedLogger;
}

export function isMarketOpenAt(date: Date): boolean {
  const day = date.getDay();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const currentTime = hour * 60 + minute;
  const utcOffset = date.getTimezoneOffset();
  const estOffset = 300; // EST is UTC-5
  const adjustedTime = currentTime - (utcOffset - estOffset);
  const marketOpen = 9 * 60 + 30;
  const marketClose = 16 * 60;
  return day >= 1 && day <= 5 && adjustedTime >= marketOpen && adjustedTime < marketClose;
}

export function clampUpdateFrequency(frequency: number): number {
  return Math.max(10000, frequency);
}

export class RealTimePriceService {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private subscriptions: Map<string, Set<PriceUpdateCallback>> = new Map();
  private updateFrequency: number;
  private isMarketOpen: boolean = false;
  private marketCheckInterval: NodeJS.Timeout | null = null;
  private eventListeners: Map<string, Set<(data: JsonValue) => void>> = new Map();
  private readonly marketStatusCheckIntervalMs: number;
  private readonly enableMarketStatusCheck: boolean;
  private readonly now: () => Date;
  private readonly setIntervalFn: (handler: (...args: unknown[]) => void, timeout: number) => NodeJS.Timeout;
  private readonly clearIntervalFn: (handle: NodeJS.Timeout) => void;
  private readonly logger: ScopedLogger;
  
  constructor(options: RealTimePriceServiceOptions = {}) {
    this.updateFrequency = options.defaultUpdateFrequency ?? 30000; // 30 seconds default
    this.marketStatusCheckIntervalMs = options.marketStatusCheckIntervalMs ?? 5 * 60 * 1000;
    this.enableMarketStatusCheck = options.enableMarketStatusCheck ?? true;
    this.now = options.now ?? (() => new Date());
    this.setIntervalFn = options.setIntervalFn ?? ((handler, timeout) => setInterval(handler, timeout));
    this.clearIntervalFn = options.clearIntervalFn ?? ((handle) => clearInterval(handle));
    this.logger = options.logger ?? createScopedLogger('RealTimePriceService');
    
    if (this.enableMarketStatusCheck) {
      this.checkMarketStatus();
      this.marketCheckInterval = this.setIntervalFn(
        () => this.checkMarketStatus(),
        this.marketStatusCheckIntervalMs
      );
    }
  }
  
  // Simple event emitter methods
  private emit(event: string, data: JsonValue) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          this.logger.error(`Error in event listener for ${event}`, error as Error);
        }
      });
    }
  }
  
  on(event: string, listener: (data: JsonValue) => void) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }
  
  off(event: string, listener: (data: JsonValue) => void) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.eventListeners.delete(event);
      }
    }
  }

  /**
   * Check if markets are open (simplified - US market hours)
   */
  private checkMarketStatus(): void {
    this.isMarketOpen = isMarketOpenAt(this.now());
    
    if (this.enableMarketStatusCheck) {
      this.updateFrequency = this.isMarketOpen ? 30000 : 300000;
      this.intervals.forEach((_, symbol) => {
        this.stopPolling(symbol);
        this.startPolling(symbol);
      });
    }
  }

  /**
   * Subscribe to real-time price updates for a symbol
   */
  subscribe(symbol: string, callback: PriceUpdateCallback): () => void {
    const upperSymbol = symbol.toUpperCase();
    
    // Add callback to subscriptions
    if (!this.subscriptions.has(upperSymbol)) {
      this.subscriptions.set(upperSymbol, new Set());
    }
    this.subscriptions.get(upperSymbol)!.add(callback);
    
    // Start polling if not already
    if (!this.intervals.has(upperSymbol)) {
      this.startPolling(upperSymbol);
      // Fetch immediately on subscribe
      this.fetchAndBroadcast(upperSymbol);
    }
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(upperSymbol);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.stopPolling(upperSymbol);
          this.subscriptions.delete(upperSymbol);
        }
      }
    };
  }

  /**
   * Subscribe to multiple symbols
   */
  subscribeMultiple(symbols: string[], callback: PriceUpdateCallback): () => void {
    const unsubscribes = symbols.map(symbol => this.subscribe(symbol, callback));
    return () => unsubscribes.forEach(unsub => unsub());
  }

  /**
   * Start polling for a symbol
   */
  private startPolling(symbol: string): void {
    const interval = this.setIntervalFn(() => {
      this.fetchAndBroadcast(symbol);
    }, this.updateFrequency);
    
    this.intervals.set(symbol, interval);
  }

  /**
   * Stop polling for a symbol
   */
  private stopPolling(symbol: string): void {
    const interval = this.intervals.get(symbol);
    if (interval) {
      this.clearIntervalFn(interval);
      this.intervals.delete(symbol);
    }
  }

  /**
   * Fetch price and broadcast to subscribers
   */
  private async fetchAndBroadcast(symbol: string): Promise<void> {
    try {
      const quote = await getStockQuote(symbol);
      if (quote) {
        const update: PriceUpdate = {
          symbol,
          quote,
          timestamp: new Date()
        };
        
        // Emit event with fully serialized data (all strings, no Date objects)
        this.emit('priceUpdate', {
          symbol: update.symbol,
          quote: {
            price: update.quote.price.toString(),
            change: update.quote.change.toString(),
            changePercent: update.quote.changePercent.toString(),
            previousClose: update.quote.previousClose.toString(),
            marketCap: update.quote.marketCap?.toString(),
            dayHigh: update.quote.dayHigh?.toString(),
            dayLow: update.quote.dayLow?.toString(),
            fiftyTwoWeekHigh: update.quote.fiftyTwoWeekHigh?.toString(),
            fiftyTwoWeekLow: update.quote.fiftyTwoWeekLow?.toString(),
            lastUpdated: update.quote.lastUpdated.toISOString()
          },
          timestamp: update.timestamp.toISOString()
        } as JsonValue);
        
        // Call all callbacks
        const callbacks = this.subscriptions.get(symbol);
        if (callbacks) {
          callbacks.forEach(callback => {
            try {
              callback(update);
            } catch (error) {
              this.logger.error(`Error in price update callback for ${symbol}`, error as Error);
            }
          });
        }
      }
    } catch (error) {
      this.logger.error(`Error fetching price for ${symbol}`, error as Error);
      this.emit('error', { symbol, error: String(error) } as JsonValue);
    }
  }

  /**
   * Set update frequency (in milliseconds)
   */
  setUpdateFrequency(frequency: number): void {
    this.updateFrequency = clampUpdateFrequency(frequency);
    
    // Restart all intervals with new frequency
    this.intervals.forEach((_, symbol) => {
      this.stopPolling(symbol);
      this.startPolling(symbol);
    });
  }

  /**
   * Get current market status
   */
  getMarketStatus(): { isOpen: boolean; nextCheck: Date } {
    return {
      isOpen: this.isMarketOpen,
      nextCheck: new Date(Date.now() + this.marketStatusCheckIntervalMs)
    };
  }

  /**
   * Clean up all intervals
   */
  dispose(): void {
    this.intervals.forEach(interval => this.clearIntervalFn(interval));
    this.intervals.clear();
    this.subscriptions.clear();
    if (this.marketCheckInterval) {
      this.clearIntervalFn(this.marketCheckInterval);
      this.marketCheckInterval = null;
    }
    this.eventListeners.clear();
  }
}
