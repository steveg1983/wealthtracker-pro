# PWA Implementation Documentation

## Overview

WealthTracker has been enhanced with Progressive Web App (PWA) features to provide a native app-like experience with offline capabilities, installability, and background sync.

## Key Features Implemented

### 1. Service Worker (`/public/sw.js`)
- **Offline Support**: Caches static assets and API responses for offline access
- **Cache Strategies**:
  - Static assets: Cache-first strategy
  - API requests: Network-first with cache fallback
  - Images: Cache-first with size limits
- **Background Sync**: Automatically syncs offline changes when connection is restored
- **Push Notifications**: Ready for push notification support
- **Update Management**: Handles app updates gracefully

### 2. Web App Manifest (`/public/manifest.json`)
- **App Identity**: Name, description, and branding
- **Icons**: Multiple icon sizes for different devices (72px to 512px)
- **Display Mode**: Standalone app experience
- **Theme Colors**: Consistent with app branding (#8EA9DB)
- **Shortcuts**: Quick actions for common tasks
- **Screenshots**: Desktop and mobile previews

### 3. Offline Data Service (`/src/services/offlineDataService.ts`)
- **IndexedDB Storage**: Persistent offline data storage
- **Sync Queue**: Tracks pending changes made offline
- **Conflict Resolution**: Handles sync conflicts when data changes on multiple devices
- **Data Caching**: TTL-based caching for frequently accessed data
- **Background Sync**: Automatic retry with exponential backoff

### 4. React Integration

#### Hooks
- **`useOfflineData`**: Main hook for offline functionality
  - Online/offline status
  - Pending sync count
  - Conflict management
  - Manual sync trigger
  
- **`useOfflineQuery`**: Offline-capable data fetching
  - Automatic caching
  - Fallback to cached data when offline
  - Configurable TTL
  - Refetch on reconnect

#### Components
- **PWAInstallPrompt**: Shows install prompt after 30 seconds
- **OfflineIndicator**: Visual indicator when app is offline
- **ServiceWorkerUpdateNotification**: Prompts users to update when new version available
- **SyncConflictResolver**: UI for resolving data conflicts

### 5. Icon Generation
- **Script**: `/scripts/generate-pwa-icons.js`
- **Base SVG**: Custom WealthTracker logo with chart elements
- **Sizes**: All required PWA icon sizes generated

## Usage Examples

### Making Offline-Capable API Calls

```typescript
import { useOfflineQuery } from '../hooks/useOfflineData';

function TransactionList() {
  const { data: transactions, isLoading, error } = useOfflineQuery(
    'transactions',
    () => fetch('/api/transactions').then(res => res.json()),
    { 
      ttlMinutes: 10,
      refetchOnReconnect: true 
    }
  );

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return <TransactionList transactions={transactions} />;
}
```

### Handling Offline Actions

```typescript
import { useOfflineData } from '../hooks/useOfflineData';

function AddTransaction() {
  const { isOnline, addToSyncQueue } = useOfflineData();
  
  const handleSubmit = async (data) => {
    if (isOnline) {
      // Online - make direct API call
      await createTransaction(data);
    } else {
      // Offline - queue for later sync
      await addToSyncQueue('transaction', 'create', data);
      // Show success message
      toast.success('Transaction saved offline and will sync when online');
    }
  };
}
```

## Cache Configuration

### Cache Names
- `wealthtracker-static-v1`: Static assets (HTML, CSS, JS)
- `wealthtracker-dynamic-v1`: Dynamic content
- `wealthtracker-api-v1`: API responses
- `wealthtracker-images-v1`: Image assets

### Cache Limits
- Dynamic content: 50 items
- API responses: 100 items
- Images: 30 items

### Cacheable API Routes
- `/api/accounts`
- `/api/categories`
- `/api/transactions`
- `/api/budgets`
- `/api/goals`

## Background Sync

### Sync Events
- `sync-data`: General offline data sync
- `sync-transactions`: Transaction-specific sync
- `sync-accounts`: Account balance sync

### Retry Logic
- Maximum 3 retry attempts
- Exponential backoff
- Failed items moved to conflict queue

## Installation Flow

1. Browser triggers `beforeinstallprompt` event
2. PWAInstallPrompt component shows after 30 seconds
3. User can:
   - Install the app
   - Dismiss (won't show for 7 days)
   - Choose "Later" (shows again next session)

## Service Worker Lifecycle

1. **Install**: Caches essential static assets
2. **Activate**: Cleans up old caches, claims clients
3. **Fetch**: Handles requests with appropriate cache strategy
4. **Sync**: Processes background sync when online
5. **Update**: New versions skip waiting and reload

## Testing PWA Features

### Desktop Chrome
1. Open DevTools > Application tab
2. Check Service Worker status
3. Test offline mode in Network tab
4. Trigger install from address bar icon

### Mobile Testing
1. Visit site in Chrome/Safari
2. Add to Home Screen option appears
3. Test offline functionality
4. Verify background sync

## Future Enhancements

1. **Push Notifications**
   - Budget alerts
   - Bill reminders
   - Goal milestones

2. **Advanced Offline Features**
   - Offline reports generation
   - Predictive caching
   - Peer-to-peer sync

3. **Performance Optimizations**
   - Selective caching based on usage
   - Cache warming strategies
   - Resource prioritization

## Troubleshooting

### Service Worker Not Registering
- Check console for errors
- Ensure HTTPS or localhost
- Clear browser cache and storage

### Install Prompt Not Showing
- Must meet PWA criteria
- Not already installed
- User hasn't dismissed recently

### Offline Data Not Syncing
- Check IndexedDB in DevTools
- Verify background sync permissions
- Monitor network requests

## Browser Support

- **Chrome/Edge**: Full support
- **Firefox**: Partial (no install prompt)
- **Safari**: Limited (basic offline only)
- **Samsung Internet**: Full support

## Security Considerations

- All cached data is encrypted
- Sensitive data has shorter TTL
- Clear cache on logout
- No credentials in service worker