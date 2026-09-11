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

`scripts/ios-release.sh [build-number]` — archives, checks the entitlement
survived into the signed binary, exports and uploads. No Xcode, no GUI.

**Why a script and not two xcodebuild commands.** Build 2 could not be
uploaded headlessly. The first failure said App Store Connect access was
required; the second said the plain truth:

> Provisioning profile "iOS Team Store Provisioning Profile:
> com.wealthtracker.mobile" doesn't include the
> com.apple.developer.associated-domains entitlement.

Adding a capability in Xcode regenerates the **development** profile — the
**distribution** profile is a separate object and does not follow. Only
something holding an App Store Connect session can regenerate it, so the
upload went through Xcode's Organizer.

An **App Store Connect API key** is that session. With
`-authenticationKeyPath/-ID/-IssuerID`, `-allowProvisioningUpdates` regenerates
the distribution profile itself. The key lives in
`~/Documents/WealthTracker-signing/` and Apple allows it to be downloaded
**once** — back that folder up.

A build number already on App Store Connect is rejected *after* the upload
rather than before, so the script sets it deliberately and refuses to let
Xcode renumber.

App Store icons must carry **no alpha channel** — the upload is rejected for
it, and the fix is a JPEG round-trip through `sips`.

A **native** change (icons, `Info.plist`, permissions, entitlements, the shell
itself) is the only reason to cut a new build. Everything else arrives by
deploying the web app.

## Push notifications (11 Sep 2026)

The shell carries `@capacitor/push-notifications`, the `aps-environment`
entitlement, and the two `AppDelegate` methods that hand the APNs token to
the plugin. Everything that DECIDES to push lives on the server (the cloud
refresh cron and the reminders cron under `api/cron/`), and everything a
person can choose lives in the web app (Settings → App Settings → Phone
notifications, drawn only inside this shell). The phone's only jobs are to
ask iOS for a token and to hand it to `push_devices`, which
`src/services/push/pushRegistration.ts` does on every launch.

**Three things this needs that the code cannot supply:**

1. **An APNs key.** Apple Developer → Keys → `+` → tick *Apple Push
   Notifications service (APNs)*. Download the `.p8` **once** (Apple never
   offers it again — keep it beside the App Store Connect key in
   `~/Documents/WealthTracker-signing/`) and note the ten-character Key ID.
2. **Three Vercel environment variables**, server-side, none `VITE_`-prefixed:
   `APNS_TEAM_ID` (`VT6W829WRX`), `APNS_KEY_ID`, and `APNS_PRIVATE_KEY` (the
   `.p8` contents — pasted with real newlines, or with the two characters
   `\n` where a one-line field forces it; both are read). Until all three are
   set every push is skipped and logged once per cold start; nothing else
   changes.
3. **A new TestFlight build.** The entitlement and the plugin are native, so
   this is one of the rare changes a deploy cannot carry:
   `scripts/ios-release.sh <next build number>`. The script now refuses to
   upload an archive whose signed entitlements lack `aps-environment`. With
   automatic signing and the App Store Connect key, `-allowProvisioningUpdates`
   adds the Push Notifications capability to the App ID and regenerates the
   distribution profile itself — the same mechanism that carried Associated
   Domains.

**Sandbox versus production, and why the server does not care.** A build run
from Xcode registers a *sandbox* token; a TestFlight or App Store build a
*production* one; the phone cannot tell which. The server assumes production
and, on Apple's `BadDeviceToken`, tries the sandbox host once and remembers
the answer on the row (`api/_lib/push.ts`). A token Apple reports
`Unregistered` is retired, never deleted.

**Proving it on a phone.** Switch on any phone notification in Settings (the
one act that shows Apple's permission prompt), then trigger a push from the
server side: run the cron by hand —

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://www.wealthtrackerpro.co.uk/api/cron/reminders
```

— with a balance reminder scheduled for a minute ago and not yet acknowledged.
The response says how many were `pushed`; the phone says the rest. The
simulator receives no APNs pushes at all, so this is a real-device check.
