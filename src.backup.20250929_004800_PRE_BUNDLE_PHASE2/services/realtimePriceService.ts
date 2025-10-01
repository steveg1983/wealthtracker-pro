import { getStockQuote, type StockQuote } from './stockPriceService';
import type { JsonValue } from '../types/common';
import { logger } from './loggingService';

export interface PriceUpdate {
  symbol: string;
  quote: StockQuote;
  timestamp: Date;
}

export type PriceUpdateCallback = (update: PriceUpdate) => void;

class RealTimePriceService {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private subscriptions: Map<string, Set<PriceUpdateCallback>> = new Map();
  private updateFrequency: number = 30000; // 30 seconds default
  private isMarketOpen: boolean = false;
  private marketCheckInterval: NodeJS.Timeout | null = null;
  private eventListeners: Map<string, Set<(data: JsonValue) => void>> = new Map();
  
  constructor() {
    this.checkMarketStatus();
    // Check market status every 5 minutes
    this.marketCheckInterval = setInterval(() => this.checkMarketStatus(), 5 * 60 * 1000);
  }
  
  // Simple event emitter methods
  private emit(event: string, data: JsonValue) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          logger.error(`Error in event listener for ${event}:`, error);
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

  async getQuote(symbol: string): Promise<StockQuote | null> {
    try {
      return await getStockQuote(symbol);
    } catch (error) {
      logger.error(`RealTimePriceService.getQuote failed for ${symbol}`, error);
      return null;
    }
  }

  async getBatchQuotes(symbols: string[]): Promise<StockQuote[]> {
    const uniqueSymbols = Array.from(new Set(symbols.map((symbol) => symbol.toUpperCase())));
    const quotes: StockQuote[] = [];

    for (const symbol of uniqueSymbols) {
      const quote = await this.getQuote(symbol);
      if (quote) {
        quotes.push(quote);
      }
    }

    return quotes;
  }

  /**
   * Check if markets are open (simplified - US market hours)
   */
  private checkMarketStatus(): void {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = hour * 60 + minute;
    
    // Convert to EST/EDT (UTC-5 or UTC-4)
    const utcOffset = now.getTimezoneOffset();
    const estOffset = 300; // EST is UTC-5
    const adjustedTime = currentTime - (utcOffset - estOffset);
    
    // Market hours: 9:30 AM - 4:00 PM EST, Monday-Friday
    const marketOpen = 9 * 60 + 30;
    const marketClose = 16 * 60;
    
    this.isMarketOpen = day >= 1 && day <= 5 && 
                       adjustedTime >= marketOpen && 
                       adjustedTime < marketClose;
    
    // Update frequency based on market status
    this.updateFrequency = this.isMarketOpen ? 30000 : 300000; // 30s when open, 5min when closed
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
    const interval = setInterval(() => {
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
      clearInterval(interval);
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
        
        // Emit event
        const eventData = {
          symbol: update.symbol,
          quote: {
            price: update.quote.price.toString(),
            change: update.quote.change.toString(),
            changePercent: update.quote.changePercent.toString(),
            previousClose: update.quote.previousClose.toString(),
            ...(update.quote.marketCap && { marketCap: update.quote.marketCap.toString() }),
            ...(update.quote.dayHigh && { dayHigh: update.quote.dayHigh.toString() }),
            ...(update.quote.dayLow && { dayLow: update.quote.dayLow.toString() }),
            ...(update.quote.fiftyTwoWeekHigh && { fiftyTwoWeekHigh: update.quote.fiftyTwoWeekHigh.toString() }),
            ...(update.quote.fiftyTwoWeekLow && { fiftyTwoWeekLow: update.quote.fiftyTwoWeekLow.toString() }),
            lastUpdated: update.quote.lastUpdated.toISOString()
          },
          timestamp: update.timestamp.toISOString()
        };
        this.emit('priceUpdate', eventData);
        
        // Call all callbacks
        const callbacks = this.subscriptions.get(symbol);
        if (callbacks) {
          callbacks.forEach(callback => {
            try {
              callback(update);
            } catch (error) {
              logger.error(`Error in price update callback for ${symbol}:`, error);
            }
          });
        }
      }
    } catch (error) {
      logger.error(`Error fetching price for ${symbol}:`, error);
      this.emit('error', { symbol, error: String(error) } as JsonValue);
    }
  }

  /**
   * Set update frequency (in milliseconds)
   */
  setUpdateFrequency(frequency: number): void {
    this.updateFrequency = Math.max(10000, frequency); // Minimum 10 seconds
    
    // Restart all intervals with new frequency
    this.intervals.forEach((interval, symbol) => {
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
      nextCheck: new Date(Date.now() + 5 * 60 * 1000)
    };
  }

  /**
   * Clean up all intervals
   */
  dispose(): void {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();
    this.subscriptions.clear();
    if (this.marketCheckInterval) {
      clearInterval(this.marketCheckInterval);
    }
    this.eventListeners.clear();
  }
}

// Singleton instance
export const realTimePriceService = new RealTimePriceService();
