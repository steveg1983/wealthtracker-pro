# Telemetry Event Contract

WealthTracker emits client-side analytics events via `analyticsEngine.track`.
`analyticsBridge` fans these events to the configured endpoint (`VITE_ANALYTICS_ENDPOINT`).

## Event envelope

```json
{
  "eventName": "conflict_detected",
  "payload": {
    "entity": "account",
    "conflictId": "acc_123",
    "fields": ["balance"],
    "autoResolvable": false,
    "strategy": "manual"
  },
  "timestamp": "2025-10-14T21:15:00.123Z"
}
```

- `eventName`: string identifier
- `payload`: JSON payload (event-specific fields)
- `timestamp`: ISO-8601 string (added client-side)

## Conflict lifecycle events

| Event | Description | Payload fields |
|-------|-------------|----------------|
| `conflict_detected` | Raised when reconcile emitted a conflict that needs manual review. | `entity`, `conflictId`, `fields`, `strategy`, `autoResolvable` |
| `conflict_auto_resolved` | Raised when the conflict service merged changes automatically. | `entity`, `conflictId`, `fields`, `resolution`, `confidence` |
| `conflict_resolved_manual` | Raised once the user resolves a conflict via the UI. | `entity`, `conflictId`, `resolution` |

## Offline queue

- Unsent events persist in `localStorage` under `analytics_offline_queue_v1`.
- Queue flushes automatically when the browser returns online.
- Maximum queue size: 500 events (oldest evicted).

## Environment variables

| Key | Description |
|-----|-------------|
| `VITE_ANALYTICS_ENDPOINT` | HTTPS endpoint receiving analytics events via POST/`sendBeacon`. |
| `VITE_ANALYTICS_WITH_CREDENTIALS` | Set to `true` to include cookies/credentials when using `fetch` fallback. |
