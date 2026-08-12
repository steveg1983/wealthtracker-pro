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
npm run desktop:ui             # vite → apps/desktop/dist  (the binary embeds this)
npm run desktop:greps          # PHASE3-PLAN §5's two bundle greps, over that build
npm run bundle:check:desktop   # the renderer's size ratchet, over the same build
npm run desktop:verify         # the three above, in that order
npm run desktop:build          # desktop:ui, then cargo build --release
npm run desktop:check          # clippy -D warnings, and the shell's own tests
```

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

## What has been verified, and what has not

Verified on this machine, at this commit:

| | |
| --- | --- |
| the shell crate compiles | `cargo build --release` → a 16.1 MB arm64 binary (15.3 MiB). Cold, from an empty target directory: 45 s wall, 262 CPU-seconds, 454 packages, 991 MB of build artefacts |
| the shell's own tests | 12 pass: both locks, the identity flow, the refusals |
| clippy | clean at `--all-targets`, pedantic on |
| the renderer builds | 3,273.1 KiB raw / 1,006.5 KiB gzipped over 101 files — the whole application, mounted (the mount slice's second half). It was 259.3 KiB / 86.7 KiB when it was React and a file chooser, and 81.8 kB when it was one screen of vanilla DOM. `npm run bundle:check:desktop` is that measurement as a command, with budgets ~10 % above it and the four chunks worth attacking named in the script's own note (xlsx, jspdf, html2canvas, recharts — 41 % of it, and all four are the WEB app's problem too) |
| the renderer is cloud-free | zero occurrences of `supabase`, `storageAdapter` — PHASE3-PLAN §5's two bundle greps — and of `wealthtracker_transactions` (the browser ledger mirror's own storage key), `clerk`, `sentry`, `stripe`. `npm run desktop:greps` is that check, as a command, over the built bundle; two import-graph walks assert the same on every test run, from the data root and from the entry. The `indexedDB` grep RETIRED in favour of the storage key, and the script's note says why at length: a device keeps its receipts in the WebView's store and that is not the ledger |
| the ledger path end to end | the contract suite drives 127 checks in five files through the real crate against real files (`npm run test:local-contract`) |
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
