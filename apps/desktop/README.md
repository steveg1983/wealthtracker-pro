# The desktop shell

A body for the ledger core. One window, one open file, and one command between
the two.

```
apps/desktop
├── index.html            the window's document
├── ui/main.ts            the renderer: finds `invoke`, draws the open/new screen
├── vite.config.ts        builds ui/ → dist/, which the binary embeds
└── src-tauri
    ├── Cargo.toml        its own workspace; depends on crates/wealth-core by path
    ├── tauri.conf.json   window, CSP, `withGlobalTauri`, frontendDist
    ├── icons/icon.png    the app's mark
    └── src
        ├── main.rs       the ONE ledger command, three file commands, the mutex
        ├── document.rs   open, create, and whose rows a file holds
        └── lock.rs       the second of the two locks
```

Everything with a decision in it that can be written in TypeScript is in
`src/services/local/deviceDocument.ts` instead, because `apps/**` is outside
this repo's lint, typecheck and test roots — see that file's header. Its
neighbours there are `deviceIdentity.ts` (whose ledger this is) and
`preferencesTransport.ts` (this file's settings), and both are in that graph on
purpose: `deviceDocument.cloudFree.test.ts` walks it.

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
npm run desktop:build    # the above, then cargo build --release
npm run desktop:check    # clippy -D warnings, and the shell's own tests
```

`cargo build` needs `dist/` to exist first: `tauri::generate_context!` embeds the
renderer at compile time.

## What has been verified, and what has not

Verified on this machine, at this commit:

| | |
| --- | --- |
| the shell crate compiles | `cargo build --release` → a 16 MB arm64 binary |
| the shell's own tests | 12 pass: both locks, the identity flow, the refusals |
| clippy | clean at `--all-targets`, pedantic on |
| the renderer builds | 81.8 kB raw / 28.0 kB gzipped |
| the renderer is cloud-free | zero occurrences of `supabase`, `indexedDB`, `storageAdapter`, `clerk`, `sentry` in the built bundle — PHASE3-PLAN §5's two bundle greps, and `deviceDocument.cloudFree.test.ts` asserts the same over the import graph on every test run |
| the ledger path end to end | the contract suite drives all 113 rules through the real crate against real files |
| the settings path end to end | `localCore.preferences.test.ts` writes a document into a real file, closes it, reads it back, and follows a preference's account ids through a real backup and restore |

**NOT verified here, because it needs a GUI session:**

* **the window itself.** Nothing in this environment can start one, so
  `tauri::Builder::run` has never been executed. The binary links and the
  context is embedded; whether a window appears is unproven.
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

**The React app is not mounted in it.** The port this shell builds is a
`DataPort`, which is what the app's provider takes — but connecting them is a
slice of its own: a build of the app that is not the web build, a router with no
cloud routes, and a first-run screen that is a file chooser rather than a sign
in. What the current renderer proves is that the whole path works: chooser →
locks → schema → owner → seed → settings → boot. It says so on screen rather
than pretending to be more.

**What that slice owes, precisely.** `bootDeviceLedger` takes an optional
preferences service and this renderer passes none — honestly, because it mounts
no React and reads no setting. A window that DOES render surfaces must pass the
one `preferences` singleton the app renders through, or those surfaces will read
the WebView's own `localStorage`: a store that is not in the backup, does not
travel with the file, and is thrown away by anything that clears the app's data.
The parameter is documented at the function; this is the note that says why it
is not optional in spirit.
