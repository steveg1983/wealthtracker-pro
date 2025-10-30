# Telemetry Verification Checklist

1. **Environment Setup**
   - Set `VITE_ANALYTICS_ENDPOINT` to a test endpoint (e.g., http://localhost:4000/collect).
   - Optionally set `VITE_ANALYTICS_WITH_CREDENTIALS=true` if the endpoint requires cookies.

2. **Start a local collector**
   - Example using `npx http-serve` or a simple Node script to log POST bodies.

3. **Trigger analytics events**
   - Open the app, generate a conflict (force via AutoSync or mocks).
   - Confirm toasts appear.

4. **Inspect runtime buffer**
   - Run in console: `window.__analyticsEvents__` to see recent payloads.

5. **Validate network calls**
   - Check the collector logs or browser Network tab for POST/Beacon calls.
   - Ensure payload matches `docs/TELEMETRY_PAYLOADS.md` contract.

6. **Offline scenario**
   - Set browser to Offline.
   - Trigger additional events; confirm `localStorage.analytics_offline_queue_v1` contains them.
   - Go back Online; ensure queue flushes and collector receives the pending events.

7. **Finalize**
   - Clear local storage (`localStorage.removeItem('analytics_offline_queue_v1')`).
   - Reset network conditions.
