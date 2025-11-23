import { Transaction, Budget } from '../types';
import { Decimal, toDecimal } from '../utils/decimal';
import { formatDecimal } from '../utils/decimal-format';
import { createScopedLogger, type ScopedLogger } from '../loggers/scopedLogger';
import type {
  NotificationAction,
  NotificationData,
  SavedOfflineTransaction,
  SavedPushNotification,
  NavigatorWithStandalone,
  NavigatorWithConnection
} from '../types/mobile';

export interface OfflineTransaction {
  id: string;
  data: Partial<Transaction>;
  action: 'create' | 'update' | 'delete';
  timestamp: Date;
  synced: boolean;
  retry_count: number;
}

export interface CameraCapture {
  imageData: string;
  timestamp: Date;
  location?: GeolocationCoordinates;
  extractedText?: string;
  suggestedAmount?: number;
  suggestedMerchant?: string;
  suggestedCategory?: string;
}

export interface MerchantLocation {
  name: string;
  category: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  address?: string;
  distance?: number;
}

export interface PushNotification {
  id: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: NotificationData;
  actions?: NotificationAction[];
  timestamp: Date;
  read: boolean;
}

export interface NotificationSettings {
  enabled: boolean;
  budgetAlerts: boolean;
  billReminders: boolean;
  expenseThreshold: number;
  quietHours: {
    enabled: boolean;
    start: string; // "22:00"
    end: string;   // "08:00"
  };
}

const OFFLINE_TRANSACTIONS_KEY = 'offline_transactions';
const NOTIFICATION_SETTINGS_KEY = 'notification_settings';
const PUSH_NOTIFICATIONS_KEY = 'push_notifications';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface WindowLike {
  addEventListener?: Window['addEventListener'];
  removeEventListener?: Window['removeEventListener'];
}

interface NavigatorLike {
  onLine?: boolean;
  serviceWorker?: Pick<typeof navigator.serviceWorker, 'ready'>;
}

interface NotificationAdapter {
  getPermission(): NotificationPermission;
  requestPermission(): Promise<NotificationPermission>;
  show(title: string, options?: NotificationOptions): void;
}

export interface MobileServiceOptions {
  storage?: StorageLike | null;
  windowRef?: WindowLike | null;
  navigatorRef?: NavigatorLike | null;
  notificationAdapter?: NotificationAdapter;
  logger?: ScopedLogger;
}

export class MobileService {
  private offlineTransactions: OfflineTransaction[] = [];
  private notificationSettings: NotificationSettings;
  private pushNotifications: PushNotification[] = [];
  private isOnline: boolean;
  private storage: StorageLike | null;
  private windowRef: WindowLike | null;
  private navigatorRef: NavigatorLike | null;
  private notificationAdapter: NotificationAdapter;
  private readonly logger: ScopedLogger;

  constructor(options: MobileServiceOptions = {}) {
    this.storage = options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    this.windowRef = options.windowRef ?? (typeof window !== 'undefined' ? window : null);
    this.navigatorRef = options.navigatorRef ?? (typeof navigator !== 'undefined' ? navigator : null);
    const globalNotification = typeof Notification !== 'undefined' ? Notification : undefined;
    this.notificationAdapter = options.notificationAdapter ?? {
      getPermission: () => globalNotification?.permission ?? 'default',
      requestPermission: () =>
        globalNotification?.requestPermission
          ? globalNotification.requestPermission()
          : Promise.resolve('default'),
      show: (title, opts) => {
        if (globalNotification && globalNotification.permission === 'granted') {
          void new globalNotification(title, opts);
        }
      }
    };
    this.isOnline = this.navigatorRef?.onLine ?? true;
    this.logger = options.logger ?? createScopedLogger('MobileService');

    this.loadOfflineData();
    this.notificationSettings = this.loadNotificationSettings();
    this.pushNotifications = this.loadPushNotifications();
    this.setupNetworkListeners();
    this.setupNotificationPermissions();
  }

  private loadOfflineData() {
    const stored = this.storage?.getItem(OFFLINE_TRANSACTIONS_KEY);
    if (stored) {
      this.offlineTransactions = JSON.parse(stored).map((item: SavedOfflineTransaction) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      }));
    }
  }

  private saveOfflineData() {
    this.storage?.setItem(OFFLINE_TRANSACTIONS_KEY, JSON.stringify(this.offlineTransactions));
  }

  private loadNotificationSettings(): NotificationSettings {
    const stored = this.storage?.getItem(NOTIFICATION_SETTINGS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      enabled: false,
      budgetAlerts: true,
      billReminders: true,
      expenseThreshold: 100,
      quietHours: {
        enabled: true,
        start: '22:00',
        end: '08:00'
      }
    };
  }

  private saveNotificationSettings() {
    this.storage?.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(this.notificationSettings));
  }

  private loadPushNotifications(): PushNotification[] {
    const stored = this.storage?.getItem(PUSH_NOTIFICATIONS_KEY);
    if (stored) {
      return JSON.parse(stored).map((item: SavedPushNotification) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      }));
    }
    return [];
  }

  private savePushNotifications() {
    this.storage?.setItem(PUSH_NOTIFICATIONS_KEY, JSON.stringify(this.pushNotifications));
  }

  private setupNetworkListeners() {
    this.windowRef?.addEventListener?.('online', () => {
      this.isOnline = true;
      this.syncOfflineTransactions();
    });

    this.windowRef?.addEventListener?.('offline', () => {
      this.isOnline = false;
    });
  }

  private async setupNotificationPermissions() {
    if (this.navigatorRef?.serviceWorker) {
      try {
        // Check if permission already granted
        if (this.notificationAdapter.getPermission() === 'granted') {
          this.notificationSettings.enabled = true;
          this.saveNotificationSettings();
        }
      } catch (error) {
        this.logger.error('Error setting up notifications', error);
      }
    }
  }

  // Offline Mode
  isOffline(): boolean {
    return !this.isOnline;
  }

  addOfflineTransaction(data: Partial<Transaction>, action: 'create' | 'update' | 'delete'): string {
    const offlineTransaction: OfflineTransaction = {
      id: Date.now().toString(),
      data,
      action,
      timestamp: new Date(),
      synced: false,
      retry_count: 0
    };

    this.offlineTransactions.push(offlineTransaction);
    this.saveOfflineData();
    
    return offlineTransaction.id;
  }

  getOfflineTransactions(): OfflineTransaction[] {
    return [...this.offlineTransactions];
  }

  async syncOfflineTransactions(): Promise<void> {
    if (!this.isOnline || this.offlineTransactions.length === 0) return;

    const unsyncedTransactions = this.offlineTransactions.filter(t => !t.synced);
    
    for (const transaction of unsyncedTransactions) {
      try {
        // In a real app, this would sync with the server
        await this.simulateSync(transaction);
        transaction.synced = true;
        transaction.retry_count = 0;
      } catch (error) {
        transaction.retry_count++;
        this.logger.error('Failed to sync transaction', error);
        
        // Remove after 5 failed attempts
        if (transaction.retry_count >= 5) {
          this.offlineTransactions = this.offlineTransactions.filter(t => t.id !== transaction.id);
        }
      }
    }

    // Remove synced transactions
    this.offlineTransactions = this.offlineTransactions.filter(t => !t.synced);
    this.saveOfflineData();
  }

  private async simulateSync(_transaction: OfflineTransaction): Promise<void> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Simulate 90% success rate
    if (Math.random() < 0.1) {
      throw new Error('Sync failed');
    }
  }

  // Camera Capture
  async captureExpense(): Promise<CameraCapture | null> {
    if (!('mediaDevices' in navigator) || !('getUserMedia' in navigator.mediaDevices)) {
      throw new Error('Camera not supported');
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      
      return new Promise((resolve, reject) => {
        video.onloadedmetadata = () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }
          
          ctx.drawImage(video, 0, 0);
          const imageData = canvas.toDataURL('image/jpeg', 0.8);
          
          // Stop camera
          stream.getTracks().forEach(track => track.stop());
          
          // Get location if available
          this.getCurrentLocation().then(location => {
            const capture: CameraCapture = {
              imageData,
              timestamp: new Date(),
              location: location || undefined
            };
            
            // Extract text and suggest details
            this.processImage(capture).then(processedCapture => {
              resolve(processedCapture);
            });
          });
        };
      });
    } catch (error) {
      this.logger.error('Camera capture failed', error);
      throw error;
    }
  }

  private async processImage(capture: CameraCapture): Promise<CameraCapture> {
    // Mock OCR processing - in a real app, this would use a service like Google Vision API
    const mockText = 'COFFEE SHOP\nTOTAL: $4.50\nDATE: ' + new Date().toLocaleDateString();
    
    // Extract amount using regex
    const amountMatch = mockText.match(/\$?(\d+\.?\d*)/);
    const suggestedAmount = amountMatch ? parseFloat(amountMatch[1]) : undefined;
    
    // Determine merchant and category
    const merchantMatch = mockText.match(/([A-Z\s]+)(?=\n)/);
    const suggestedMerchant = merchantMatch ? merchantMatch[1].trim() : undefined;
    
    let suggestedCategory = 'other';
    if (mockText.toLowerCase().includes('coffee')) {
      suggestedCategory = 'dining';
    } else if (mockText.toLowerCase().includes('gas')) {
      suggestedCategory = 'transportation';
    }
    
    return {
      ...capture,
      extractedText: mockText,
      suggestedAmount,
      suggestedMerchant,
      suggestedCategory
    };
  }

  // Location Services
  async getCurrentLocation(): Promise<GeolocationCoordinates | null> {
    if (!('geolocation' in navigator)) {
      return null;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position.coords),
        () => resolve(null),
        { timeout: 10000, enableHighAccuracy: true }
      );
    });
  }

  async findNearbyMerchants(location: GeolocationCoordinates): Promise<MerchantLocation[]> {
    // Mock merchant data - in a real app, this would query a places API
    const mockMerchants: MerchantLocation[] = [
      {
        name: 'Starbucks',
        category: 'dining',
        coordinates: {
          latitude: location.latitude + 0.001,
          longitude: location.longitude + 0.001
        },
        address: '123 Main St',
        distance: 0.1
      },
      {
        name: 'Shell Gas Station',
        category: 'transportation',
        coordinates: {
          latitude: location.latitude - 0.002,
          longitude: location.longitude + 0.002
        },
        address: '456 Oak Ave',
        distance: 0.2
      },
      {
        name: 'Walmart',
        category: 'shopping',
        coordinates: {
          latitude: location.latitude + 0.003,
          longitude: location.longitude - 0.001
        },
        address: '789 Pine Rd',
        distance: 0.3
      }
    ];

    return mockMerchants;
  }

  // Push Notifications
  async requestNotificationPermission(): Promise<boolean> {
    let permission = this.notificationAdapter.getPermission();
    
    if (permission === 'default') {
      permission = await this.notificationAdapter.requestPermission();
    }
    
    const granted = permission === 'granted';
    this.notificationSettings.enabled = granted;
    this.saveNotificationSettings();
    
    return granted;
  }

  getNotificationSettings(): NotificationSettings {
    return { ...this.notificationSettings };
  }

  updateNotificationSettings(settings: Partial<NotificationSettings>): void {
    this.notificationSettings = { ...this.notificationSettings, ...settings };
    this.saveNotificationSettings();
  }

  async sendNotification(title: string, body: string, data?: NotificationData): Promise<void> {
    if (!this.notificationSettings.enabled || !this.canSendNotification()) {
      return;
    }

    const notification: PushNotification = {
      id: Date.now().toString(),
      title,
      body,
      data,
      timestamp: new Date(),
      read: false
    };

    this.pushNotifications.unshift(notification);
    this.savePushNotifications();

    // Send browser notification
    if (this.notificationSettings.enabled) {
      this.notificationAdapter.show(title, {
        body,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        data
      });
    }
  }

  private canSendNotification(): boolean {
    if (!this.notificationSettings.quietHours.enabled) {
      return true;
    }

    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                       now.getMinutes().toString().padStart(2, '0');
    
    const start = this.notificationSettings.quietHours.start;
    const end = this.notificationSettings.quietHours.end;
    
    // Handle quiet hours spanning midnight
    if (start > end) {
      return currentTime < start && currentTime > end;
    } else {
      return currentTime < start || currentTime > end;
    }
  }

  getNotifications(): PushNotification[] {
    return [...this.pushNotifications];
  }

  markNotificationAsRead(id: string): void {
    const notification = this.pushNotifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      this.savePushNotifications();
    }
  }

  clearNotifications(): void {
    this.pushNotifications = [];
    this.savePushNotifications();
  }

  // Budget/Bill Monitoring
  checkBudgetAlerts(budgets: Budget[], transactions: Transaction[]): void {
    if (!this.notificationSettings.budgetAlerts) return;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    budgets.forEach(budget => {
      const monthlyTransactions = transactions.filter(t => {
        const date = new Date(t.date);
        return date.getMonth() === currentMonth && 
               date.getFullYear() === currentYear &&
               t.category === budget.categoryId &&
               t.type === 'expense';
      });

      const spentDecimal = monthlyTransactions.reduce(
        (sum, t) => sum.plus(toDecimal(Math.abs(t.amount))),
        toDecimal(0)
      );
      const budgetAmountDecimal = toDecimal(budget.amount || 0);

      if (budgetAmountDecimal.equals(0)) {
        return;
      }

      const percentageDecimal = spentDecimal
        .dividedBy(budgetAmountDecimal)
        .times(100);

      if (percentageDecimal.greaterThanOrEqualTo(new Decimal(90))) {
        const percentageDisplay = formatDecimal(percentageDecimal, 0);
        this.sendNotification(
          'Budget Alert',
          `You've spent ${percentageDisplay}% of your ${budget.categoryId} budget`,
          { type: 'budget_alert', category: budget.categoryId }
        );
      }
    });
  }

  checkBillReminders(transactions: Transaction[]): void {
    if (!this.notificationSettings.billReminders) return;

    // Mock bill reminder logic
    const recurringExpenses = transactions.filter(t => t.isRecurring);
    const today = new Date();
    
    recurringExpenses.forEach(expense => {
      const lastDate = new Date(expense.date);
      const daysSinceLastPayment = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Remind if it's been 25+ days since last payment (assuming monthly bills)
      if (daysSinceLastPayment >= 25 && daysSinceLastPayment <= 35) {
        this.sendNotification(
          'Bill Reminder',
          `${expense.description} payment may be due soon`,
          { type: 'bill_reminder', transaction_id: expense.id }
        );
      }
    });
  }

  // PWA Installation
  async installPWA(): Promise<boolean> {
    // This would work with the beforeinstallprompt event
    // For now, just return true if PWA is supported
    return 'serviceWorker' in navigator && 'PushManager' in window;
  }

  isPWAInstalled(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as NavigatorWithStandalone).standalone === true;
  }

  // Utility Methods
  getConnectionStatus(): 'online' | 'offline' | 'slow' {
    if (!this.isOnline) return 'offline';
    
    // Check connection quality
    const connection = (navigator as NavigatorWithConnection).connection;
    if (connection) {
      if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        return 'slow';
      }
    }
    
    return 'online';
  }

  getStorageUsage(): { used: number; available: number } {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then(estimate => {
        return {
          used: estimate.usage || 0,
          available: estimate.quota || 0
        };
      });
    }
    
    return { used: 0, available: 0 };
  }
}

export const mobileService = new MobileService();
