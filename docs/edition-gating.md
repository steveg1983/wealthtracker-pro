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

The lint rule can only see specifiers it was told about. The graph walks read
the source the way a bundler *would* have. The greps read what a bundler *did*.
None of them is redundant, and the last one refuses rather than skips when there
is no build to look at.

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
