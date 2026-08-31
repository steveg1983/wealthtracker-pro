# The desktop shell

A body for the ledger core. One window, one open file, and one command between
the two.

```
apps/desktop
├── vite.config.ts             builds src/desktop → dist/, which the binary embeds
├── licence-public-key.txt     compiled in with include_str!; PLACEHOLDER until issued
└── src-tauri
    ├── Cargo.toml             its own workspace; depends on crates/wealth-core by path
    ├── tauri.conf.json        window, CSP, `withGlobalTauri`, frontendDist
    ├── icons/icon.png         the app's mark
    └── src
        ├── main.rs            the ONE ledger command, the licence gate, the mutex
        ├── document.rs        open, create, and whose rows a file holds
        ├── lock.rs            the second of the two locks
        ├── license.rs         verify a signed licence, offline, and remember the clock
        └── update.rs          ask about a newer release, and never interrupt

src/desktop                    THE RENDERER. Not here, on purpose — see below.
├── index.html                 the window's document
├── main.tsx                   the entry: finds `invoke`, mounts React
├── DesktopApp.tsx             the router, and the window's one open document
├── MountedLedger.tsx          the application, in a window
├── routes.ts                  every address in App.tsx, and what it means here
├── LedgerScreen.tsx           "which ledger?"
├── LicenceScreen.tsx          the licence, as a line and as a panel
├── licence.ts                 what the renderer may know about it, and how it asks
├── shellInvoke.ts             the shell's door, reachable from inside the app
├── tauriShell.ts              the one line that knows where `invoke` comes from
└── desktop.css                this window's own chrome; the app brings its own

scripts/issue-licence.mjs      the owner's side: --generate, --issue, --verify
```

**Nothing with a decision in it is under `apps/`.** As of slice 29 that is
literal: the renderer moved to `src/desktop`, because everything under `apps/**`
is outside this repo's lint, typecheck and test roots and a wiring decision that
nothing checks is a wiring decision that drifts. `src/services/local/
deviceDocument.ts`'s header makes the argument; this directory is now only the
Rust shell and the config that points a build at the renderer.

The data half of the renderer's graph is assembled in
`src/services/local/deviceDocument.ts`, beside `deviceIdentity.ts` (whose ledger
this is), `preferencesTransport.ts` (this file's settings) and
`deviceDataPort.ts` (the door `@data` opens in this edition). All four are in
that graph on purpose: `deviceDocument.cloudFree.test.ts` walks it from the data
root and `src/desktop/__tests__/desktopEntry.cloudFree.test.ts` walks it from
the entry.

## What it is

`wealth_core_invoke(verb, payload)` is the whole money surface: one Tauri
command over `wealth_core::command`'s `parse → plan → dispatch → respond`, which
is the same four functions and the **same single match** the differential
harness's CLI runs (PHASE3-PLAN D-3). There is no second verb set, no SQL door,
and nothing in `main.rs` that knows any verb's name.

Beside it are three commands that are **not** verbs — `open_ledger`,
`create_ledger`, `close_ledger` — and one that describes the build. They take no
path from the renderer: the WebView asks to open *a* ledger and the shell shows
the platform's own chooser. `document.rs`'s header gives the three reasons a
file command may not be a `Command` variant, the first of which is that a
payload-supplied path would let the renderer open any SQLite file on the disk.

**Two locks.** A `Mutex<Option<Document>>` in `main.rs` (the app cannot race
itself) and an advisory exclusive lock on a `<ledger>.lock` sidecar (a second
process cannot open the same ledger). `lock.rs` explains why neither implies the
other and why the kernel holds the second rather than a row in the file.

## Building it

```bash
npm run desktop:ui             # vite → apps/desktop/dist  (the binary embeds this)
npm run desktop:greps          # PHASE3-PLAN §5's two bundle greps, over that build
npm run bundle:check:desktop   # the renderer's size ratchet, over the same build
npm run desktop:verify         # the three above, in that order
npm run desktop:build          # desktop:ui, then cargo build --release
npm run desktop:check          # clippy -D warnings, and the shell's own tests

# The INSTALLERS (.app/.dmg here; .exe from the Windows runner in CI):
npm ci --prefix apps/desktop   # the Tauri CLI, this directory's own manifest
npm run desktop:ui             # the CLI does not run it for you
(cd apps/desktop && npx tauri build)
```

Releases: push a `desktop-v*` tag (or press Run workflow on “Desktop
installers”) and `.github/workflows/desktop-release.yml` builds macOS
arm64 + x64 and a Windows NSIS installer, and attaches them to a draft
release.

`cargo build` needs `dist/` to exist first: `tauri::generate_context!` embeds the
renderer at compile time.

`desktop:greps` and `bundle:check:desktop` both REFUSE rather than skip when
there is no build to look at. A gate that passes because it found nothing to
read is the kind of gate that stops meaning anything, and this repository has
ruled on that once already (R-8, in the local contract suite).

**The ratchet gates RAW bytes, not gzip**, which is the opposite of the web's
`bundle:check` and for a reason: nothing here is downloaded. These bytes are
embedded in the binary and parsed when the window opens, so compression never
enters it. Gzip is measured too, because this README quotes it and because it is
the only figure directly comparable with the web bundle's.

The binary's size is **recorded and never gated** — CI's Linux binary and this
arm64 macOS one are different artefacts and neither is the other's regression.

## Where these run

| | on every PR | nightly |
| --- | --- | --- |
| `desktop:ui`, `desktop:greps`, `bundle:check:desktop` | ✅ | |
| `cargo test` / `clippy` on `crates/wealth-core` | ✅ | |
| `test:local-contract`, `test:local-admission` | ✅ | |
| `test:local-sqlite`, `test:local-verbs` | | needs the Postgres cluster |
| `desktop:check`, `desktop:build` | | needs webkit2gtk + 262 CPU-seconds |

`.github/workflows/handoff-snapshot.yml` and `local-edition-nightly.yml`.
`docs/edition-gating.md` argues the split; `src/desktop/__tests__/
desktopIsGated.test.ts` fails if a step is dropped from either.

**A type error in `src/desktop` does not fail any of the desktop commands.**
Vite hands TypeScript to esbuild, which strips types without checking them —
measured, exit 0 on a renderer that does not typecheck. `npm run
typecheck:strict` is what catches it, via the root `tsconfig.json`'s reference
to `tsconfig.desktop.json`, and that reference is now asserted by a test because
it is the only thing standing between this renderer and being untyped.

## How an installed copy gets fixes

A desktop build is a **frozen** copy of the app: `frontendDist` embeds the
renderer in the binary at compile time, so nothing about a download changes
when the website changes. (The iOS shell is the opposite — it points a WebView
at production, so a deploy IS its release. The two are not comparable and the
difference catches people out.)

Since **0.1.1** the app therefore updates itself:

* on launch, `src-tauri/src/update.rs` asks the endpoint in `tauri.conf.json`
  whether there is a newer release. Silent, off the main thread, and a failure
  costs only the update — never a dialog;
* if there is one, a native dialog offers it, saying what will happen (the
  window closes and reopens) and what will not (the ledger file is untouched).
  Declining is free; the next launch asks again;
* the download is verified against the release public key before it is allowed
  to run, so the endpoint is not trusted, only the signature is.

It is driven from Rust rather than the renderer for the reason the file chooser
is: the WebView must not be the part of the program that can replace the
program. It also keeps the updater out of the size ratchet and out of the CSP.

**The release is created as a DRAFT.** Nothing is offered to anyone until that
draft is published by hand — publishing IS shipping the update, and it happens
after the `.dmg` has been notarised and swapped in. Cutting a release is
`git tag desktop-v<x.y.z> && git push origin desktop-v<x.y.z>`.

**Still owed: OS code signing in CI.** Update signatures exist; Developer ID
and Windows code-signing certificates do not, so first-run downloads still need
right-click → Open (macOS) or "more info" (Windows), the published `.dmg` is
notarised by hand, and the macOS update archive is only ad-hoc signed. The
header of `.github/workflows/desktop-release.yml` names the secrets that would
retire all of that.

## What has been verified, and what has not

Verified on this machine, at this commit:

| | |
| --- | --- |
| the shell crate compiles | `cargo build --release` → a 16.1 MB arm64 binary (15.3 MiB). Cold, from an empty target directory: 45 s wall, 262 CPU-seconds, 454 packages, 991 MB of build artefacts |
| the shell's own tests | 38 pass: both locks, the identity flow, the refusals, and — since licensing — the verifier, the clock's high-water mark, the read allowlist held to the crate's own enum, and a real ledger proving that an expired window is refused a write BY NAME while a read and an export both still answer |
| clippy | clean at `--all-targets`, pedantic on |
| the renderer builds | 3,273.1 KiB raw / 1,006.5 KiB gzipped over 101 files — the whole application, mounted (the mount slice's second half). It was 259.3 KiB / 86.7 KiB when it was React and a file chooser, and 81.8 kB when it was one screen of vanilla DOM. `npm run bundle:check:desktop` is that measurement as a command, with budgets ~10 % above it and the four chunks worth attacking named in the script's own note (xlsx, jspdf, html2canvas, recharts — 41 % of it, and all four are the WEB app's problem too) |
| the renderer is cloud-free | zero occurrences of `supabase`, `storageAdapter` — PHASE3-PLAN §5's two bundle greps — and of `wealthtracker_transactions` (the browser ledger mirror's own storage key), `clerk`, `sentry`, `stripe`. `npm run desktop:greps` is that check, as a command, over the built bundle; two import-graph walks assert the same on every test run, from the data root and from the entry. The `indexedDB` grep RETIRED in favour of the storage key, and the script's note says why at length: a device keeps its receipts in the WebView's store and that is not the ledger |
| the ledger path end to end | the contract suite drives 127 checks in five files through the real crate against real files (`npm run test:local-contract`) |
| the settings path end to end | `localCore.preferences.test.ts` writes a document into a real file, closes it, reads it back, and follows a preference's account ids through a real backup and restore |

**Verified in a GUI session on 25 Aug 2026** — the first time the window was
ever drawn — on the arm64 macOS build, driven end to end:

* **the window itself.** `tauri::Builder::run` executed; the chooser painted;
  the full React tree mounted inside the WebView. Not jsdom — the real thing.
* **the native file chooser.** "New ledger…" raised the platform save sheet
  from the async command with no deadlock — the one place the
  `blocking_save_file` threading pattern could have hung rather than failed.
* **the whole boot path.** The sheet created `Verification ledger.db` in
  Documents: WAL mode, the `.lock` sidecar, every migration, and the 78-row
  category seed — then `bootDeviceLedger` mounted the application over it.
* **one verb, all the way down.** An account created through the UI went
  renderer → `wealth_core_invoke` → the crate → the file, and reading the file
  with a second process shows the row exactly as the core stores money:
  `123456` integer minor units for £1,234.56, no float anywhere.
* **`tauri build` and the icon set.** The CLI now lives in this directory's own
  `package.json` (the web manifest still carries no desktop dependencies), the
  platform icons are generated (`.icns`, `.ico`, the iOS and Android sets for
  later), and `npx tauri build` produced `WealthTracker.app` and a 6.1 MB
  `.dmg`.

**Still NOT verified:**

* **`tauri dev`** — the hot-reload loop has not been run.
* **signing and notarisation.** The `.app` is ad-hoc signed
  (`Signature=adhoc`), so a downloaded copy meets Gatekeeper's
  right-click-→-Open ritual. A Developer ID Application certificate, and the
  notarisation flow, are the remaining steps to a clean install experience —
  the release workflow's header says where the secrets plug in.
* **Windows and Intel macOS.** Neither has ever been built. The
  `desktop-release.yml` workflow exists to produce both (NSIS on a Windows
  runner, dmg on `macos-13`) and has not yet had a green run.

## Licensing

A licence is a signed statement, checked offline, and nothing else. There is no
server, no activation call and no phone-home in this program, and there is not
going to be one: the local edition's whole promise is one file on one machine,
and a licence check that reached the internet would be the first line of that
promise broken.

**A fence, not a vault.** This repository is public, so the verifier and the
allowlist can be read by anybody, and somebody prepared to compile their own
build can delete them in an afternoon. That is the premise rather than a flaw.
What is actually being sold is the signed, notarised, self-updating build — a
recompiled fork gets none of that — and what the licence does is keep honest
people honest and let a trial exist at all.
`apps/desktop/src-tauri/src/license.rs`'s header argues the whole of it,
including the two things it deliberately does NOT do (machine binding, and
anything at all to your ledger).

**Nothing is ever held hostage.** The landing page promises *"your ledger
exports in full whenever you want it"*, and an expired or missing licence does
not touch that: every read answers, every report runs, and `collect_backup` —
the export — is on the allowlist beside them. What stops is writing.
`main.rs`'s `READ_VERBS` is that allowlist, derived one verb at a time from the
crate's single `dispatch` match, and `licence_gate` is where the promise is
kept.

### The owner's one manual step

Once, ever:

```bash
node scripts/issue-licence.mjs --generate
```

It writes the PRIVATE key to `~/Documents/WealthTracker-signing/wealthtracker-licence.key`
(chmod 600, never printed, never committed) and prints the PUBLIC half. Then:

1. **back the private key up to your password manager, that afternoon.** Nothing
   else in the world has a copy;
2. paste the public line into `apps/desktop/licence-public-key.txt`, replacing
   the word `PLACEHOLDER`, and commit it.

That second step is what ARMS enforcement. Until it happens, every build reports
the licence state `unenforced`: nothing is refused, and the window says
"Development build" rather than pretending to be licensed. There is no flag and
no build profile involved, because a switch that can be flipped is a switch that
gets flipped by accident.

### Issuing, and rotating

```bash
# a lifetime licence
node scripts/issue-licence.mjs --issue --email ada@example.com --name "Ada Lovelace"

# a three-month trial
node scripts/issue-licence.mjs --issue --email ada@example.com --name "Ada Lovelace" --trial-months 3

# the support tool: "they say it does not work"
node scripts/issue-licence.mjs --verify WTL1-…
```

A licence string is `WTL1-<base64url(claims JSON)>.<base64url(signature)>`. It
is **not a secret**: it is a signed statement, readable by anybody holding one,
and the property it has is that it cannot be MADE without the private key. The
signature covers the exact transported bytes, so there is no canonical
serialisation for Node and Rust to agree about.

**Rotating** is one commit: `--generate` into a new directory, replace the line
in `licence-public-key.txt`, ship. Every licence signed by the old key stops
verifying the moment the new public key ships, so re-issue to everybody who
bought one. Losing the private key costs exactly that and nothing more — already
issued licences keep working on already installed builds, because those carry
the old public half.

### Checking it end to end, without going near the real key

```bash
export WEALTHTRACKER_SIGNING_DIR=$(mktemp -d)
export WEALTHTRACKER_PUBLIC_KEY_FILE=$WEALTHTRACKER_SIGNING_DIR/pub.txt
node scripts/issue-licence.mjs --generate            # prints a public key
# …put that line in $WEALTHTRACKER_PUBLIC_KEY_FILE, then:
node scripts/issue-licence.mjs --issue --email a@example.com --name "A" --trial-months 3
node scripts/issue-licence.mjs --verify WTL1-…       # valid
node scripts/issue-licence.mjs --verify WTL1-…       # one byte changed → REFUSED, exit 1
```

Both environment variables exist for this and for nothing else. The SHELL reads
the committed key file with `include_str!` at compile time and has never heard
of either of them.

The two implementations are also held to each other by a test rather than by
these paragraphs: `license.rs`'s
`a_licence_the_issuing_script_really_made_verifies_here` carries a licence that
script actually printed, beside the public key it printed with it. The keypair
was ephemeral, its private half is gone, and the licensee is invented.

## What one open file gives the app

Three things, and `src/services/local/deviceDocument.ts` assembles all of them
from one `open_ledger` answer:

| | |
| --- | --- |
| the **engine** | `LocalDataPort` — the whole seam, over `wealth_core_invoke` |
| the **identity** | the uuid in the file's one `users` row, published to `deviceIdentity.ts`. The cloud gets this from Clerk through `userIdService`; a device gets it from the file, and there is nothing to translate |
| the **settings** | `localPreferencesTransport` — the choices a person made about how to READ their ledger, in the same file as the ledger, so they are in the backup and they move with it |

`bootDeviceLedger` is where the ordering rules that no engine can state for
itself are kept: categories are seeded before the ledger is read, and the
preferences service is pointed at the file *before* it is attached to the file's
owner.

## What it deliberately does not do

**REACT IS MOUNTED AND SO IS THE APP.** Slice 29 built the three things the mount
needed and could not safely be added afterwards — the `@data` alias, the router's
decisions, and the rules that keep the cloud out — and then measured what stood
between there and the pages:

> A runtime import walk from `components/Layout` reaches **144 modules** and
> **five independent cloud roots**, none of which is any page's own fault.

The mount slice answered all five with four seams (`@chrome`, `@identity`,
`@prefs-store`, `@telemetry`) and then answered what was behind them with two
more: `@session` for the state layer's preamble, `@service` for the billing and
bank-feed surfaces that sit inside otherwise local pages. A walk from
`src/desktop/main.tsx` today reaches **348 modules and no cloud at all**, and the
window serves **thirty-seven routes** — the same pages the web app serves, not
copies of them.

**Three routes are still owed**, each with the exact chain named in
`src/desktop/routes.ts`: `investments` (holdings never went through the seam and
that page talks to Supabase directly), and `enhanced-import` / `settings/data`
(the restore dialog previews what a store cannot keep by reading a description of
the BROWSER's store — which is also a latent bug for this edition, and is a port
question rather than a file split). Five more are `NEVER_ON_A_DESKTOP`, with
reasons.

**What the window shows is checked, not assumed.**
`src/desktop/__tests__/desktopPages.test.tsx` opens a fixture ledger, mounts the
application over it and reads the money off the screen — the dashboard's total,
both accounts, a register's rows, reports, and a settings page with no billing
card on it. It is the only check in this repository that asserts PRESENCE; every
other one passes happily on a window that renders nothing.

**The debt this renderer used to carry is discharged.** `bootDeviceLedger` takes
an optional preferences service and slice 29's renderer passed none, honestly,
because the one surface it rendered read no setting — and with a measured excuse,
because `preferencesService.ts` reached a Supabase client in its module scope.
`@prefs-store` removed the excuse in the mount's first half (a walk from that
service now finds six modules and no cloud), and `src/desktop/DesktopApp.tsx`
passes the one `preferences` singleton every surface renders through. Without it,
a window that renders the app would read the WebView's own `localStorage`: a
store that is not in the backup, does not travel with the file, and is thrown
away by anything that clears the app's data.

**One debt is new and is worth naming here rather than only in a comment.** A
device's ATTACHMENTS — receipts, invoices — live in the WebView's IndexedDB
(`services/documentService.ts`), so they do not travel with the ledger file and
are not in its backup. That is inherited rather than introduced: the web app's
receipts do not travel between browsers either. It belongs in a slice about
documents, and until there is one, `desktop:greps` deliberately does not fail on
it — see that script's note on why the bare word `indexedDB` stopped meaning
"the browser's copy of the ledger".
