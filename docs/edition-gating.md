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

## Where `@data` is declared

Six configs, because six things resolve a module. They are asserted to agree by
`src/services/__tests__/dataAlias.test.ts`; a mapping that one of them has and
another does not fails as *"Cannot find module '@data'"* in whichever command is
run next.

| Config | Resolves `@data` to | Used by |
| --- | --- | --- |
| `vite.config.ts` | `src/services/port` | the web build and dev server |
| `vitest.config.ts` | `src/services/port` | the app's test suite |
| `tsconfig.app.json` | `src/services/port/index.ts` | `tsc -b`, the web project |
| `apps/desktop/vite.config.ts` | `src/services/local/deviceDataPort` | the desktop renderer build |
| `vitest.local.config.ts` | `src/services/local/deviceDataPort` | the local contract run |
| `tsconfig.desktop.json` | `src/services/local/deviceDataPort.ts` | `tsc -b`, the desktop project |

**`@data` must be declared before the bare `@` alias** in the two Vite-family
configs. Vite matches aliases in order, by prefix, so `'@'` would otherwise claim
`'@data'` and resolve it to `src/…data`. There is a test for that too, because
the error it produces says nothing about aliases.

---

## The rule for each kind of module

| If a module is… | it imports the seam as | because |
| --- | --- | --- |
| shared UI (`components`, `pages`, `contexts`, `hooks`) | `@data` | it must not know which edition it is in |
| desktop-only (`src/desktop/**`) | `services/local/deviceDataPort` by path | it only ever runs in a window; asking the build is asking a question it knows the answer to |
| the seam's own types | `services/port/dataPort` | types are erased, and `LocalDataPort implements DataPort` is the compile-time proof the whole seam rests on |

`eslint.config.js` enforces all three. The rule for the first row is worth
stating plainly: **a component that imports `services/port` by path has picked
an engine on behalf of every edition**, it compiles, it passes every test, and
the damage appears on the day that component is mounted in a window.

---

## What is checked, and at what altitude

Four instruments, on purpose. Each catches what the others structurally cannot.

| | What it reads | When | What only it can catch |
| --- | --- | --- | --- |
| `eslint.config.js` — `no-restricted-imports` | one line | as it is typed | the mistake, before it is committed |
| `deviceDocument.cloudFree.test.ts` | the import graph from the DATA root | every test run | a cloud module pulled in through the object graph |
| `desktopEntry.cloudFree.test.ts` | the import graph from `src/desktop/main.tsx` | every test run | a cloud module pulled in through the component tree, and a mis-pointed alias |
| `scripts/desktop-bundle-greps.mjs` | the built bundle | `npm run desktop:verify` | anything a *dependency* drags in, and anything a plugin injects |
| `scripts/desktop-bundle-size.mjs` | the built bundle's weight | the same | growth that is **perfectly cloud-free** — 144 modules of shared UI arriving at once, which every row above passes |

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

## What is not done yet, and the number that says why

The app's own screens are not mounted in the window. This is not an oversight
and it is not a small remaining step; it is the next programme of work, and the
measurement that scopes it is:

> A runtime import walk from `components/Layout` reaches **144 modules** and
> **five independent cloud roots**, none of which is any page's own fault.

```
Layout             → @clerk/clerk-react        the UserButton in the header
Layout             → useAutoBankSync           a bank feed, in the chrome
PreferencesContext → preferencesService        → a Supabase client
anything logging   → loggers/scopedLogger      → lib/sentry → @sentry/react
DemoModeIndicator  → utils/demoData            → services/storageAdapter
Breadcrumbs        → AppContextSupabase        → useUser(), and Clerk again
```

Every one is a shared surface, and each needs the treatment the data layer has
just had — a seam, a supplied dependency, or an entry of its own — before *any*
page can be mounted in a window. The data layer was the first and largest of
them; these are the rest.

The preferences one is already written down twice more, because it is the one
with a consequence a person would feel: a window that renders surfaces must pass
the preferences singleton to `bootDeviceLedger`, or those surfaces read the
WebView's own `localStorage` — a store that is not in the backup, does not travel
with the file, and is discarded by anything that clears the app's data.
