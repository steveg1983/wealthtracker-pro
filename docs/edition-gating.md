# Edition gating

Two editions, one source tree. This is how a component can be in both without
knowing which one it is in, and how a desktop window ends up with no cloud in it
at all.

---

## The one-line version

```
                       shared UI
                           │
                     import '@data'
                           │
        ┌──────────────────┴──────────────────┐
        │                                     │
 web build resolves it to           desktop build resolves it to
 src/services/port/index.ts         src/services/local/deviceDataPort.ts
        │                                     │
 export const dataPort =            export const dataPort =
   DataService                        requireDeviceDocument().port
        │                                     │
   Supabase, Clerk, Sentry            one SQLite file, over one Tauri command
```

Neither bundle contains the other's engine, because neither bundle's *graph can
reach* it. That is the whole mechanism, and everything below is either an
enforcement of it or a consequence.

---

## The five seams

`@data` was the first and the largest. The mount slice added four more, for the
same reason and by the same mechanism — a specifier that names no edition, and a
build that says which file it is.

| specifier | the question it answers | web resolves it to | desktop resolves it to |
| --- | --- | --- | --- |
| `@data` | where are the rows? | `services/port/index.ts` — `DataService` | `services/local/deviceDataPort.ts` — the open file |
| `@chrome` | the shared frame's edition-varying furniture | `editions/cloud/chrome.tsx` — a Clerk button, the bank feed's scheduler, the demo banner, the search box, the bell, the breadcrumb, the realtime dot, the quick-add modal | `desktop/editions/chrome.tsx` — the open ledger's name, and seven absences with reasons |
| `@identity` | what do I file this session's local storage under? | `editions/cloud/identity.ts` — Clerk's `useUser().id` | `desktop/editions/identity.ts` — the uuid in the file's `users` row |
| `@prefs-store` | where do settings live when nobody has said? | `editions/cloud/preferencesStore.ts` — a `user_preferences` row | `desktop/editions/preferencesStore.ts` — `null`; the boot has already attached the file |
| `@telemetry` | where does a caught error go? | `editions/cloud/telemetry.ts` — Sentry | `desktop/editions/telemetry.ts` — this machine's console |

Each seam is three files: a CONTRACT in `src/editions/` that names no edition, a
cloud half in `src/editions/cloud/`, and a device half in
`src/desktop/editions/`. Both halves annotate their exports with the contract's
types, so `tsc -b` proves each is substitutable in the project that compiles it —
and `src/editions/__tests__/editionAliases.test.ts` proves the two answer for the
same vocabulary, which no single compilation can see.

**`@telemetry` is the one worth reading twice**, because it is the only seam that
split a module rather than replacing one. Logging is perfectly legitimate on a
device; reporting to a server is not. `loggers/scopedLogger.ts` — sixty-seven
importers, nearly all shared UI — used to be a *forbidden module* in a desktop
build purely because `services/loggingService.ts` imported two functions from
`lib/sentry.ts`. The seam is that one import, and the ban moved onto the thing it
was always really about.

---

## Why it is a build-time alias and not a runtime branch

The obvious alternative is a branch:

```ts
export const dataPort: DataPort = isDesktop() ? new LocalDataPort(…) : DataService;
```

It looks smaller and it is much worse. A bundler cannot remove either arm of a
branch it cannot evaluate, so **both engines ship in both builds**: a Supabase
client, Clerk and Sentry inside a program whose whole promise is that the money
never leaves the machine, and the ledger crate's entire wire format inside a
browser tab, each so that a runtime test can discard it. PHASE3-PLAN §5's two
bundle greps would fail on the first build, and they would be right to.

The alias moves the choice earlier — before a line of JavaScript runs — which is
the only place a choice between two whole engines can be made without paying for
both.

---

## Where the seams are declared

Six configs, because six things resolve a module — and five specifiers, so
thirty mappings that have to agree. They are asserted to by
`src/services/__tests__/dataAlias.test.ts` (for `@data`) and
`src/editions/__tests__/editionAliases.test.ts` (for the other four); a mapping
that one config has and another does not fails as *"Cannot find module"* in
whichever command is run next.

| Config | Resolves them to | Used by |
| --- | --- | --- |
| `vite.config.ts` | the web halves | the web build and dev server |
| `vitest.config.ts` | the web halves | the app's test suite |
| `tsconfig.app.json` | the web halves | `tsc -b`, the web project |
| `apps/desktop/vite.config.ts` | the device halves | the desktop renderer build |
| `vitest.local.config.ts` | the device halves | the local contract run |
| `tsconfig.desktop.json` | the device halves | `tsc -b`, the desktop project |

**Every seam must be declared before the bare `@` alias** in the two Vite-family
configs. Vite matches aliases in order, by prefix, so `'@'` would otherwise claim
`'@data'` and resolve it to `src/…data`. There is a test for that too, because
the error it produces says nothing about aliases.

`editionAliases.test.ts` also reads the `@`-prefixed aliases out of
`vite.config.ts` and requires the list to be exactly the five it knows about — so
a sixth seam cannot arrive with no substitution check behind it.

---

## The rule for each kind of module

| If a module is… | it imports the seam as | because |
| --- | --- | --- |
| shared UI (`components`, `pages`, `contexts`, `hooks`) | the specifier — `@data`, `@chrome`, `@identity`, `@prefs-store`, `@telemetry` | it must not know which edition it is in |
| desktop-only (`src/desktop/**`) | the device half by path | it only ever runs in a window; asking the build is asking a question it knows the answer to |
| cloud-only (`services/backupService.ts`, and the cloud halves themselves) | the cloud half by path | the mirror image: a module that already opens with a Supabase client has no question to ask |
| a seam's own types | the contract in `src/editions/`, or `services/port/dataPort` | types are erased, and `const x: Contract = impl` in each half is the compile-time proof the seam rests on |

`eslint.config.js` enforces all four. The rule for the first row is worth
stating plainly: **a component that imports `services/port` — or
`editions/cloud/chrome` — by path has picked an edition on behalf of every
edition**, it compiles, it passes every test, and the damage appears on the day
that component is mounted in a window.

---

## What is checked, and at what altitude

Seven instruments, on purpose. Each catches what the others structurally cannot.

| | What it reads | When | What only it can catch |
| --- | --- | --- | --- |
| `eslint.config.js` — `no-restricted-imports` | one line | as it is typed | the mistake, before it is committed |
| `deviceDocument.cloudFree.test.ts` | the import graph from the DATA root | every test run | a cloud module pulled in through the object graph |
| `desktopEntry.cloudFree.test.ts` | the import graph from `src/desktop/main.tsx` | every test run | a cloud module pulled in through the component tree of what is BUILT, and a mis-pointed alias |
| `layoutIsDesktopClean.test.ts` | the import graph from `components/Layout` | every test run | a cloud module re-entering the shared FRAME — which the entry does not reach yet, so nothing else would notice until part 2 tried to mount it |
| `editionAliases.test.ts` | the two halves of each seam, and six configs, as text | every test run | a half that answers for a name the other does not, and a mapping one config is missing |
| `scripts/desktop-bundle-greps.mjs` | the built bundle | `npm run desktop:verify` | anything a *dependency* drags in, and anything a plugin injects |
| `scripts/desktop-bundle-size.mjs` | the built bundle's weight | the same | growth that is **perfectly cloud-free** — 65 modules of shared UI arriving at once, which every row above passes |

The lint rule can only see specifiers it was told about. The graph walks read
the source the way a bundler *would* have. The greps read what a bundler *did*.
The ratchet reads how much of it there is, which is the one question the other
four cannot be made to answer: a renderer that doubled in size without importing
a single forbidden module satisfies all of them. None is redundant, and the last
two refuse rather than skip when there is no build to look at.

---

## What runs in CI, where, and why

Everything above was enforced only on whichever machine happened to run it.
Slice 30 wired it. Two workflows, four jobs, and one rule for deciding which
job a check belongs in: **cost and environment, never importance.**

### On every pull request — `.github/workflows/handoff-snapshot.yml`

| job | runs | needs |
| --- | --- | --- |
| `desktop-renderer` | `desktop:ui`, `desktop:greps`, `bundle:check:desktop` | Node |
| `local-core` | `cargo clippy`, `cargo test` (468), the release bridge, `test:local-contract` (127), `test:local-admission` (109) | Node + a Rust toolchain |

Two jobs and not one, because *"which half broke"* is the first question anyone
asks a red build and a single job cannot answer it. The renderer half also
finishes in seconds while the core half is still compiling.

**Node 22, not the 20 the web jobs use.** `node:sqlite` is how both the harness
and the contract fixtures open a ledger file, and it does not exist before 22.5.
The web jobs are left on 20 deliberately: their version is a build-parity
question with Vercel and has nothing to do with this.

**No third-party actions.** `rustup` and a stable toolchain ship in the runner
image, and `actions/cache` is first-party. This repository is public; every
extra action is another owner of a token that can read a finance codebase.

**The cargo cache holds the registry, not `target/`.** Measured on an M4
(2026-08-12): a cold `cargo test` plus a cold `cargo build --release --features
cli` over this workspace's 65 packages is ~89 CPU-seconds and leaves a 726 MB
target directory. Round-tripping most of a gigabyte through the cache service to
save that is not obviously a saving, and it is a much bigger thing to go wrong.

### Nightly — `.github/workflows/local-edition-nightly.yml`

| job | runs | why not on a PR |
| --- | --- | --- |
| `differential` | `test:local-sqlite` (67), `test:local-verbs` (474) | needs a PostgreSQL cluster with 51 migrations applied — minutes of setup before one spec runs |
| `desktop-shell` | `desktop:check`, `desktop:build`, the ratchet again | Tauri needs webkit2gtk and five more `-dev` packages on Linux, then 262 CPU-seconds to link 454 crates |

The differential harness is the most load-bearing thing in the local edition and
it is nightly anyway. It is the clearest case for the rule: the cloud's own
schema is its oracle, and standing that oracle up costs more than everything on
a pull request put together.

The shell build proves the shell **links**. It does not open a window — nothing
in CI can, and `apps/desktop/README.md` has always said so. A three-minute job
proving a link step is a nightly.

### Why a service container is not how the Postgres lanes get their database

The obvious wiring is `services: postgres:17` and it does not fit, for three
reasons that are all in the harness rather than in the container:

* the engines connect with `-h $WT_PGDATA`, a **unix socket directory**, under
  trust auth. A service container offers TCP with a password.
* the cluster is not an empty Postgres. It is the **whole migration history**,
  applied in three passes, plus three roles and the `auth.uid`/`auth.role`/
  `auth.jwt` stand-ins that every RLS policy calls. `up.sh` is the only thing
  that knows that recipe.
* `up.sh` would then need a second mode, and the harness a second connection
  shape, so that CI could use a Postgres it configures *less* well.

The runner already has `initdb`. Letting the existing script do exactly what it
does on a developer's machine is both less code and a closer match to what is
being tested. What that needed was one real change — `pgbin.sh`, because Debian
keeps the server binaries off `PATH` — and it is the same script either way.

### What has and has not actually been run

**Verified locally, 2026-08-12:** a cluster built from scratch under a separate
`WT_PGDATA` on a separate port applied every migration (`unapplied: 0`), and
both lanes were **67/67** and **474/474** against it. That is the nightly's
riskiest step, done by hand.

**Not verified:** these workflows have never executed on GitHub's runners, and
cannot be from here. `actionlint` passes on both files. **Their first real run
is the pull request that introduces them**, and the two things that can still
surprise them are Linux-specific and commented where they occur: where Debian
puts `initdb`, and Tauri's `-dev` package list. Both fail loudly at a named
step rather than degrading to green.

### The one thing none of the desktop jobs catches

`npm run desktop:ui` **builds a renderer with type errors in it.** Measured:
planting `const x: number = 'string'` in `src/desktop/tauriShell.ts` leaves
`desktop:ui` at exit 0 and every check in this section green — Vite hands
TypeScript to esbuild, which strips types without reading them.

What catches it is `tsc -b` in the *web* `quality-gates` job, which reaches the
renderer through one `references` line in the root `tsconfig.json`. Delete that
line and `src/desktop` stops being typechecked by anything at all.
`src/desktop/__tests__/desktopIsGated.test.ts` is that line, asserted.

---

## What the desktop router does and does not have

`src/desktop/routes.ts` gives every `path=` in `src/App.tsx` one of three
answers, and `desktopRouter.test.tsx` fails if any route has none, has two, or
has crept from the second list into the first.

* **`DESKTOP_ROUTES`** — mounted in the window today.
* **`NEVER_ON_A_DESKTOP`** — banking, subscription, auth and the hosted
  service's own pages, each with the reason it will not come. A bank feed needs
  a server holding a consent; a subscription needs something to subscribe to; a
  sign-in needs somewhere to sign in, and this edition's identity is the uuid
  inside the file the person opened.
* **`AWAITING_THE_MOUNT`** — admitted in principle, blocked by a coupling that
  is *measured* and named per route.

---

## The five cloud roots, and what became of them

The app's own screens are still not mounted in the window, but the reason has
changed, and the number that scoped the work has moved. Slice 29 measured:

> A runtime import walk from `components/Layout` reaches **144 modules** and
> **five independent cloud roots**, none of which is any page's own fault.

Re-measured at the mount slice's base with the same instrument the figure was
**141 modules, 17 packages, six roots** — the sixth being one slice 29's walker
did not print, because a walk records the FIRST chain that reaches a module and
three of Layout's own children reach `AppContextSupabase` behind the breadcrumb
that got the credit. Each was given the treatment the data layer had:

| the root | what it was | the seam | the device answer |
| --- | --- | --- | --- |
| `Layout → @clerk/clerk-react` | the `UserButton` in the header, written twice | `@chrome` | the open ledger's name |
| `Layout → useAutoBankSync` | a bank feed, in the frame | `@chrome` | nothing — a region `NEVER_ON_A_DESKTOP` already ruled on |
| `PreferencesContext → preferencesService → supabaseClient` | the DEFAULT store, resolved when nobody has said | `@prefs-store` | `null` — `bootDeviceLedger` attached the file first |
| `scopedLogger → loggingService → lib/sentry` | two imported functions | `@telemetry` | this machine's console |
| `DemoModeIndicator → demoData → storageAdapter` | a hosted demo's sample data | `@chrome` | nothing — there is no hosted demo to be in |
| `Breadcrumbs`, `GlobalSearch`, the bell, the quick-add `→ AppContextSupabase` | the web's state layer, reached four ways | `@chrome` | nothing yet, and this is the part that is owed |
| `NavComponents → ActivityBadge → useActivityTracking → useUser()` | a per-owner localStorage key, on a nav badge | `@identity` | the uuid in the file's `users` row |

The same walk now reaches **65 modules, 9 packages and no cloud at all**, and
`src/desktop/__tests__/layoutIsDesktopClean.test.ts` is that measurement executed
— including an arm that points each seam back at its cloud half one at a time and
requires the cloud to reappear, so none of the four is decoration.

**Nothing was deleted to get there.** Every surface named above is still in the
web build, reached through the same frame, by the specifier's other half. The
web build's output is byte-for-byte what it was; only Rollup's content-hash
filenames rotate, because the entry chunk's module list changed.

### What is left

One context. `contexts/AppContextSupabase` is the web's state layer — 70
importers — and it reaches Clerk, `userIdService`, `autoSyncService`,
`utils/demoData` and `services/storageAdapter` between them. Of the twenty-five
owed routes with a page of their own, twenty reach it, three reach a cloud import
of their own, and **two —
`documents` and `security/audit-logs` — already reach nothing at all**, which is
where part 2 starts.

The preferences obligation still stands and is written down three times, because
it is the one with a consequence a person would feel: a window that renders
surfaces must pass the preferences singleton to `bootDeviceLedger`, or those
surfaces read the WebView's own `localStorage` — a store that is not in the
backup, does not travel with the file, and is discarded by anything that clears
the app's data. `@prefs-store`'s device half answers `null` precisely so that the
mistake is a missing attach rather than a silently different store.
