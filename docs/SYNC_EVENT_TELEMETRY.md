# Sync Event & Telemetry Types

## Packages
- `@wealthtracker/types`: sync contracts (operations, conflicts, telemetry payload shape)
- `@wealthtracker/core`: runtime auto-sync service
- `src/services/analyticsBridge.ts`: forwards `analyticsEngine.track` events to the network and offline buffer

## Telemetry payload type
```ts
import type { ConflictAnalyticsPayload } from '@wealthtracker/types';
```

Example payload for conflict detection:
```ts
const payload: ConflictAnalyticsPayload<EntityDataMap, 'account'> = {
  entity: 'account',
  conflictId: 'acc_123',
  fields: ['balance'],
  resolution: 'manual',
  confidence: 40,
  autoResolvable: false,
};
```

## Sync events
- `conflict_detected`
- `conflict_auto_resolved`
- `conflict_resolved_manual`

These events are emitted via `analyticsEngine.track` inside:
- `autoSyncSupabaseProcessor.ts`
- `conflictResolutionService.ts`
- `NotificationContext.tsx`

## Offline handling
- Buffer: in-memory array (window.__analyticsEvents__)
- Offline queue: `localStorage` key `analytics_offline_queue_v1`
- Flushes when browser goes `online`
