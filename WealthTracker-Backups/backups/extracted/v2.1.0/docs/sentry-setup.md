# Sentry Error Tracking Setup

This guide explains how to set up and use Sentry error tracking in WealthTracker.

## Setup

### 1. Create a Sentry Account

1. Go to [sentry.io](https://sentry.io) and create an account
2. Create a new project for WealthTracker
3. Select "React" as the platform
4. Copy your DSN from the project settings

### 2. Configure Environment Variables

Copy `.env.sentry` to `.env.local` and update with your Sentry DSN:

```bash
cp .env.sentry .env.local
```

Edit `.env.local`:
```env
VITE_ENABLE_ERROR_TRACKING=true
VITE_SENTRY_DSN=https://YOUR_PUBLIC_KEY@sentry.io/YOUR_PROJECT_ID
VITE_APP_ENV=development
```

### 3. GitHub Secrets (for CI/CD)

Add these secrets to your GitHub repository:

- `VITE_SENTRY_DSN`: Your Sentry DSN
- `SENTRY_AUTH_TOKEN`: Authentication token for uploading source maps
- `SENTRY_ORG`: Your Sentry organization slug
- `SENTRY_PROJECT`: Your Sentry project slug

## Features

### Error Boundaries

The app includes two levels of error boundaries:

1. **Custom ErrorBoundary**: Wraps the entire app and shows a user-friendly error page
2. **Sentry ErrorBoundary**: Provides error reporting and user feedback dialog

### User Context

User information is automatically attached to error reports when available:

```typescript
// In your auth logic
import { setSentryUser, clearSentryUser } from './lib/sentry';

// On login
setSentryUser({
  id: user.id,
  email: user.email,
  username: user.username
});

// On logout
clearSentryUser();
```

### Manual Error Capture

Use the provided utilities for manual error tracking:

```typescript
import { captureException, captureMessage, addBreadcrumb } from './lib/sentry';

// Capture exceptions
try {
  await riskyOperation();
} catch (error) {
  captureException(error, {
    operation: 'riskyOperation',
    userId: currentUser.id
  });
}

// Log messages
captureMessage('Payment processed successfully', 'info', {
  amount: 100,
  currency: 'USD'
});

// Add breadcrumbs for debugging
addBreadcrumb({
  message: 'User clicked export button',
  category: 'ui',
  level: 'info',
  data: { format: 'csv' }
});
```

### API Error Handling

Use the API error handler for consistent error tracking:

```typescript
import { ApiErrorHandler } from './utils/api-error-handler';

try {
  const response = await fetch('/api/data');
  await ApiErrorHandler.handleResponse(response);
  const data = await response.json();
} catch (error) {
  throw ApiErrorHandler.handle(error, '/api/data', 'GET');
}
```

### Custom Hook

Use the error handler hook in components:

```typescript
import { useErrorHandler } from './hooks/useErrorHandler';

function MyComponent() {
  const { handleError, handleAsyncError } = useErrorHandler();
  
  const fetchData = async () => {
    const result = await handleAsyncError(
      api.getData(),
      { component: 'MyComponent', action: 'fetchData' }
    );
    
    if (result) {
      // Handle successful result
    }
  };
}
```

## Configuration

### Environment-based Settings

- **Development**: Errors are logged to console, not sent to Sentry (unless `VITE_SENTRY_SEND_IN_DEV=true`)
- **Staging**: 10% transaction sampling, errors sent to Sentry
- **Production**: 10% transaction sampling, 10% session replay sampling

### Filtering

The integration automatically filters out:
- Browser extension errors
- Network errors from third-party services
- Common false positives (ResizeObserver, etc.)

### Security

Sensitive data is automatically filtered:
- Passwords
- Credit card numbers
- SSNs
- Bank account numbers

## Monitoring

### Sentry Dashboard

Monitor your app's health at [sentry.io](https://sentry.io):

1. **Issues**: View and triage errors
2. **Performance**: Monitor transaction performance
3. **Releases**: Track error rates by release
4. **User Feedback**: See user reports

### Release Tracking

Releases are automatically created during deployment with format: `wealthtracker@{version}`

Source maps are uploaded for production builds to enable readable stack traces.

## Testing

Run Sentry integration tests:

```bash
npm run test src/test/sentry.test.ts
```

## Troubleshooting

### Errors Not Appearing

1. Check `VITE_ENABLE_ERROR_TRACKING=true` in environment
2. Verify `VITE_SENTRY_DSN` is set correctly
3. In development, set `VITE_SENTRY_SEND_IN_DEV=true`

### Source Maps Issues

1. Ensure `SENTRY_AUTH_TOKEN` is set in CI/CD
2. Check build artifacts include `.map` files
3. Verify URL prefix matches deployment URL

### Performance Impact

Sentry has minimal performance impact:
- Async error reporting
- Sampling reduces data volume
- Local buffering prevents blocking