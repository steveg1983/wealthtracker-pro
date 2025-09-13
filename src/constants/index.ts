/**
 * Enterprise-grade centralized constants
 * All magic numbers and repeated values should be defined here
 * Follows clean code principles - no magic numbers in code
 */

// ============================================================================
// Time Constants (in milliseconds)
// ============================================================================
export const TIME = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
  YEAR: 365 * 24 * 60 * 60 * 1000,
} as const;

// ============================================================================
// Time Constants (in seconds - for APIs/cookies)
// ============================================================================
export const TIME_SECONDS = {
  MINUTE: 60,
  HOUR: 3600,
  DAY: 86400,
  WEEK: 604800,
  MONTH: 2592000, // 30 days
  YEAR: 31536000,
} as const;

// ============================================================================
// UI/UX Constants
// ============================================================================
export const UI = {
  // Animation durations
  ANIMATION: {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500,
  },
  
  // Debounce/throttle delays
  DEBOUNCE: {
    SEARCH: 300,
    INPUT: 500,
    RESIZE: 250,
  },
  
  // Pagination
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 25,
    MAX_PAGE_SIZE: 100,
    TRANSACTIONS_PER_PAGE: 50,
  },
  
  // Touch targets (accessibility)
  MIN_TOUCH_TARGET: 44, // pixels - WCAG 2.1 requirement
  
  // Z-index layers
  Z_INDEX: {
    DROPDOWN: 100,
    MODAL_BACKDROP: 200,
    MODAL: 300,
    NOTIFICATION: 400,
    TOOLTIP: 500,
  },
} as const;

// ============================================================================
// Financial Constants
// ============================================================================
export const FINANCIAL = {
  // Decimal precision
  DECIMAL_PLACES: 2,
  MAX_DECIMAL_PLACES: 6,
  
  // Interest calculation
  MONTHS_PER_YEAR: 12,
  DAYS_PER_YEAR: 365,
  
  // Common percentages
  PERCENTAGE: {
    FULL: 100,
    HALF: 50,
    QUARTER: 25,
  },
  
  // UK Tax rates
  UK_TAX: {
    PERSONAL_ALLOWANCE: 12570,
    BASIC_RATE: 20,
    HIGHER_RATE: 40,
    ADDITIONAL_RATE: 45,
    BASIC_RATE_THRESHOLD: 50270,
    HIGHER_RATE_THRESHOLD: 125140,
  },
  
  // US Tax brackets (simplified)
  US_TAX: {
    STANDARD_DEDUCTION: 13850,
    BRACKETS: [
      { min: 0, max: 11000, rate: 10 },
      { min: 11000, max: 44725, rate: 12 },
      { min: 44725, max: 95375, rate: 22 },
      { min: 95375, max: 182050, rate: 24 },
      { min: 182050, max: 231250, rate: 32 },
      { min: 231250, max: 578125, rate: 35 },
      { min: 578125, max: Infinity, rate: 37 },
    ],
  },
} as const;

// ============================================================================
// Performance Constants
// ============================================================================
export const PERFORMANCE = {
  // Bundle size limits (in KB)
  MAX_BUNDLE_SIZE: 200,
  MAX_CHUNK_SIZE: 100,
  
  // Cache durations
  CACHE: {
    API_RESPONSE: TIME.MINUTE * 5,
    USER_PREFERENCES: TIME.HOUR,
    STATIC_DATA: TIME.DAY,
  },
  
  // Service Worker
  SW_UPDATE_CHECK_INTERVAL: TIME.HOUR,
  
  // Virtualization
  VIRTUAL_LIST: {
    OVERSCAN: 3,
    ITEM_HEIGHT: 60,
    BUFFER_SIZE: 5,
  },
} as const;

// ============================================================================
// Security Constants
// ============================================================================
export const SECURITY = {
  // Password requirements
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBER: true,
    REQUIRE_SPECIAL: true,
  },
  
  // Session/token expiry
  SESSION_TIMEOUT: TIME.MINUTE * 30,
  REFRESH_TOKEN_EXPIRY: TIME.DAY * 7,
  
  // Rate limiting
  RATE_LIMIT: {
    API_CALLS_PER_MINUTE: 60,
    LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION: TIME.MINUTE * 15,
  },
  
  // CSP
  CSP_MAX_AGE: TIME_SECONDS.YEAR,
} as const;

// ============================================================================
// Data Constants
// ============================================================================
export const DATA = {
  // Excel/CSV limits
  MAX_EXPORT_ROWS: 10000,
  MAX_IMPORT_ROWS: 5000,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  
  // Date formats
  DATE_FORMAT: {
    ISO: 'YYYY-MM-DD',
    DISPLAY: 'DD/MM/YYYY',
    DISPLAY_US: 'MM/DD/YYYY',
    FULL: 'DD MMMM YYYY',
  },
  
  // OLE Automation date conversion
  OLE_DATE_OFFSET: 25569,
  
  // Batch operations
  BATCH_SIZE: {
    SMALL: 10,
    MEDIUM: 50,
    LARGE: 100,
  },
} as const;

// ============================================================================
// Network Constants
// ============================================================================
export const NETWORK = {
  // Request timeouts
  TIMEOUT: {
    SHORT: 5000,
    NORMAL: 10000,
    LONG: 30000,
    UPLOAD: 60000,
  },
  
  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    BACKOFF_FACTOR: 2,
    INITIAL_DELAY: 1000,
  },
  
  // WebSocket
  WS_RECONNECT_DELAY: 3000,
  WS_MAX_RECONNECT_ATTEMPTS: 5,
} as const;

// ============================================================================
// Chart/Visualization Constants
// ============================================================================
export const CHARTS = {
  // Default colors
  COLORS: {
    PRIMARY: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'],
    POSITIVE: '#10B981',
    NEGATIVE: '#EF4444',
    NEUTRAL: '#6B7280',
  },
  
  // Chart dimensions
  DEFAULT_HEIGHT: 300,
  MIN_HEIGHT: 200,
  MAX_HEIGHT: 600,
  
  // Data limits
  MAX_DATA_POINTS: 365,
  MAX_CATEGORIES: 20,
} as const;

// ============================================================================
// Accessibility Constants
// ============================================================================
export const A11Y = {
  // WCAG contrast ratios
  CONTRAST_RATIO: {
    NORMAL_TEXT: 4.5,
    LARGE_TEXT: 3,
    NON_TEXT: 3,
  },
  
  // Focus indicators
  FOCUS_OUTLINE_WIDTH: 2,
  FOCUS_OUTLINE_OFFSET: 2,
  
  // Screen reader
  LIVE_REGION_DELAY: 100,
} as const;

// ============================================================================
// Mobile/PWA Constants
// ============================================================================
export const MOBILE = {
  // Breakpoints (matches Tailwind)
  BREAKPOINT: {
    SM: 640,
    MD: 768,
    LG: 1024,
    XL: 1280,
    XXL: 1536,
  },
  
  // Touch gestures
  SWIPE_THRESHOLD: 50,
  TAP_DELAY: 300,
  LONG_PRESS_DURATION: 500,
  
  // PWA
  OFFLINE_CACHE_SIZE: 50 * 1024 * 1024, // 50MB
} as const;

// ============================================================================
// Type guards for constants
// ============================================================================
export type TimeConstant = typeof TIME[keyof typeof TIME];
export type UIConstant = typeof UI[keyof typeof UI];
export type FinancialConstant = typeof FINANCIAL[keyof typeof FINANCIAL];