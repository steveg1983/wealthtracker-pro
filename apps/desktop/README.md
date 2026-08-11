# The desktop shell

A body for the ledger core. One window, one open file, and one command between
the two.

```
apps/desktop
├── vite.config.ts        builds src/desktop → dist/, which the binary embeds
└── src-tauri
    ├── Cargo.toml        its own workspace; depends on crates/wealth-core by path
    ├── tauri.conf.json   window, CSP, `withGlobalTauri`, frontendDist
    ├── icons/icon.png    the app's mark
    └── src
        ├── main.rs       the ONE ledger command, three file commands, the mutex
        ├── document.rs   open, create, and whose rows a file holds
        └── lock.rs       the second of the two locks

src/desktop               THE RENDERER. Not here, on purpose — see below.
├── index.html            the window's document
├── main.tsx              the entry: finds `invoke`, mounts React
├── DesktopApp.tsx        the router, and the window's one open document
├── routes.ts             every address in App.tsx, and what it means here
├── LedgerScreen.tsx      "which ledger?", and the ledger once it is open
├── tauriShell.ts         the one line that knows where `invoke` comes from
└── desktop.css           four rules; the app's stylesheet is not here yet
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
npm run desktop:ui       # vite → apps/desktop/dist  (the binary embeds this)
npm run desktop:greps    # PHASE3-PLAN §5's two bundle greps, over that build
npm run desktop:verify   # the two above, in that order
npm run desktop:build    # desktop:ui, then cargo build --release
npm run desktop:check    # clippy -D warnings, and the shell's own tests
```

`cargo build` needs `dist/` to exist first: `tauri::generate_context!` embeds the
renderer at compile time.

`desktop:greps` REFUSES rather than skips when there is no build to look at. A
grep that passes because it found nothing to read is the kind of gate that stops
meaning anything, and this repository has ruled on that once already (R-8, in
the local contract suite).

## What has been verified, and what has not

Verified on this machine, at this commit:

| | |
| --- | --- |
| the shell crate compiles | `cargo build --release` → a 16 MB arm64 binary |
| the shell's own tests | 12 pass: both locks, the identity flow, the refusals |
| clippy | clean at `--all-targets`, pedantic on |
| the renderer builds | 263.7 kB raw / 87.8 kB gzipped — React, React DOM and the router, mounted (slice 29). It was 81.8 kB / 28.0 kB when it was one screen of vanilla DOM |
| the renderer is cloud-free | zero occurrences of `supabase`, `storageAdapter` — PHASE3-PLAN §5's two bundle greps — and of `indexedDB`, `clerk`, `sentry`, `stripe`. `npm run desktop:greps` is that check, as a command, over the built bundle; two import-graph walks assert the same on every test run, from the data root and from the entry |
| the ledger path end to end | the contract suite drives all 113 rules through the real crate against real files |
| the settings path end to end | `localCore.preferences.test.ts` writes a document into a real file, closes it, reads it back, and follows a preference's account ids through a real backup and restore |

**NOT verified here, because it needs a GUI session:**

* **the window itself.** Nothing in this environment can start one, so
  `tauri::Builder::run` has never been executed. The binary links and the
  context is embedded; whether a window appears is unproven. Since slice 29
  there is also a React tree inside it that has never been painted — it is
  rendered in jsdom by `desktopRouter.test.tsx`, which is not the same as being
  drawn by a WebView.
* **the native file chooser.** `blocking_pick_file` / `blocking_save_file` are
  called from `async` commands so that the modal panel is dispatched to the main
  thread and waited on from a runtime thread — the pattern the plugin documents,
  and the one place a wrong choice deadlocks rather than fails. Untested here.
* **`tauri dev` and `tauri build`.** The Tauri CLI is not installed (it is an npm
  package, and this repo deliberately does not carry desktop dependencies in the
  web app's `package.json`); bundling, code signing and notarisation are
  therefore all unrun.
* **the icon at every size.** `icons/icon.png` is one 512×512 file. A real
  release needs the platform set (`.icns`, `.ico`, the @2x variants), which is
  what `tauri icon` generates.

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

## What it deliberately does not do yet

**REACT IS MOUNTED. THE APP'S SCREENS ARE NOT.** Slice 29 built the three things
that mount needs and could not safely be added afterwards — the `@data` alias,
the router's decisions, and the rules that keep the cloud out — and then
measured what stands between here and the pages. The measurement is why the
router has one route in it:

> A runtime import walk from `components/Layout` reaches **144 modules** and
> **five independent cloud roots**, none of which is any page's own fault:
> Clerk's `UserButton` in the header, `useAutoBankSync` in the chrome,
> `PreferencesContext → preferencesService →` a Supabase client, every logging
> call reaching `scopedLogger → lib/sentry`, `DemoModeIndicator → demoData →
> storageAdapter`, and `Breadcrumbs → AppContextSupabase → useUser()`.

Each of those is a shared surface that needs the treatment the data layer has
just had — a seam, a supplied dependency, or an entry of its own. That is the
next programme of work, and `src/desktop/routes.ts`'s `AWAITING_THE_MOUNT` names
which route is waiting on which one. `docs/edition-gating.md` has the rest.

What the window renders today is the chooser and the open ledger, in React,
through the router, and it proves the same path it always did: chooser → locks →
schema → owner → seed → boot.

**What that mount owes, precisely.** `bootDeviceLedger` takes an optional
preferences service and this renderer still passes none — honestly, because the
one surface it renders reads no setting. It now has a measured reason as well as
an honest one: `preferencesService.ts` reaches a Supabase client in its module
scope, so this build cannot import it, and giving the window the app's settings
means giving that service the same kind of seam the data layer got. Until then,
a window that DOES render surfaces must pass the one `preferences` singleton the
app renders through, or those surfaces will read the WebView's own
`localStorage`: a store that is not in the backup, does not travel with the file,
and is thrown away by anything that clears the app's data. The parameter is
documented at the function; this is the note that says why it is not optional in
spirit.
