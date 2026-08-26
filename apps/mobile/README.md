# The iOS shell

A Capacitor app: a native window around the **cloud** edition, running on
TestFlight since 26 August 2026.

## It has no copy of the app in it

`capacitor.config.ts` sets `server.url` to `https://www.wealthtrackerpro.co.uk`,
so the web view loads production. **A deploy IS the mobile release** — a web
fix reaches the phone with no rebuild and no review.

That is the opposite of the desktop edition, which embeds its renderer at
compile time and is frozen until someone cuts a release. The two are not
comparable and the difference has caught us out once already: a fix reported
from the desktop build was the one fix that could not reach it.

The catch, which looks like a bug and is not: the web view keeps the old page
alive while the app is backgrounded, so an iPhone can run yesterday's build
for days. **Force-quit before diagnosing anything on the phone.**

The `www/` directory exists only because Capacitor demands one; a single
offline page lives there for the no-network case. App Store *review* (later —
TestFlight does not care) will want the assets bundled instead, which means
CORS work on the API and a second deploy pipeline.

## Associated Domains — why a password would not save

iOS will not offer to save or fill a credential in an app's web view, and will
not allow a passkey, until the app has **proved it owns the domain**. Before
26 August it had not, so Apple Passwords ignored the sign-in form entirely
while Safari on the same Mac remembered it perfectly.

The proof is **two-sided**, and both halves must agree or iOS silently
believes neither:

| half | where | says |
| --- | --- | --- |
| the claim | `ios/App/App/App.entitlements` | `webcredentials:www.wealthtrackerpro.co.uk` |
| the answer | `public/.well-known/apple-app-site-association` | `VT6W829WRX.com.wealthtracker.mobile` |

Three things that are easy to get wrong, all of which we did:

- **The file must be JSON, and it was HTML.** The path answered `200` long
  before the file existed, because the SPA catch-all in `vercel.json` served
  `index.html` for it. The rewrite now exempts `/.well-known`, and a header
  rule pins `application/json`. A `200` is not evidence; check the
  content-type.
- **Only `www` is claimed.** The apex `wealthtrackerpro.co.uk` 308-redirects
  to it (measured) and Apple does not follow redirects. `www` is also the
  origin the web view actually loads, so it is the origin a saved credential
  is scoped to.
- **The entitlement is Xcode's file, not ours.** Xcode rewrites it and strips
  comments whenever the capability is touched, which is why this explanation
  lives here instead. The capability itself is enabled through Xcode
  (target → Signing & Capabilities → + Capability → Associated Domains), which
  with automatic signing also enables it on the App ID and regenerates the
  profile.

**Order matters when shipping this**: the association file must be live on the
domain before an install can believe it. Deploy the web change first, then
build.

## Releasing to TestFlight

`xcodebuild archive` then `-exportArchive` with an export options plist naming
`method: app-store-connect` and `destination: upload`. Team `VT6W829WRX`.

App Store icons must carry **no alpha channel** — the upload is rejected for
it, and the fix is a JPEG round-trip through `sips`.

A **native** change (icons, `Info.plist`, permissions, entitlements, the shell
itself) is the only reason to cut a new build. Everything else arrives by
deploying the web app.
