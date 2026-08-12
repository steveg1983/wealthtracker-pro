/**
 * THE DESKTOP'S GATES ARE WIRED — the wiring itself, asserted.
 *
 * Every other check in this directory asks something about the renderer. This
 * one asks whether the checks are connected to anything, because slice 30
 * measured what happens when one of them is not, and the answer was silence.
 *
 * ── THE MEASUREMENT THIS FILE EXISTS BECAUSE OF ─────────────────────────────
 *
 * A type error was planted in `src/desktop/tauriShell.ts` (2026-08-12):
 *
 *     npm run desktop:ui          exit 0   — BUILT IT ANYWAY
 *     npm run typecheck:strict    exit 2   — src/desktop/tauriShell.ts(27,9)
 *
 * Vite hands TypeScript to esbuild, which strips types and never checks them.
 * So the desktop renderer's type safety rests entirely on `tsc -b` reaching
 * `tsconfig.desktop.json`, and `tsc -b` reaches it through one line in the root
 * `tsconfig.json`. Delete that line and the renderer stops being typechecked by
 * anything at all — while `npm run desktop:ui`, `desktop:greps`,
 * `bundle:check:desktop` and every suite in this directory stay green, because
 * not one of them reads a type.
 *
 * `apps/desktop/README.md` puts the general form of this well: *"a wiring
 * decision that nothing checks is a wiring decision that drifts"*. That
 * sentence was written about which directory the renderer lives in. It is just
 * as true of the four lines below it.
 *
 * ── AND THE SAME ARGUMENT, ONE LEVEL OUT ────────────────────────────────────
 *
 * `scripts/desktop-bundle-greps.mjs` exists because slice 27's README claimed
 * a bundle was cloud-free and nothing re-checked the claim. A CI workflow is
 * the same kind of object: a step quietly dropped from a YAML file removes a
 * gate without removing anything that looks like a gate. So the workflows are
 * read here too — by the npm script they invoke, not by line or by order, so
 * that rearranging a job is free and deleting a check is not.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const REPO = path.resolve(__dirname, '..', '..', '..');
const read = (relative: string): string => readFileSync(path.join(REPO, relative), 'utf8');

/**
 * JSON with comments — every tsconfig in this repo has them, and they are the
 * good kind, so nothing here is going to ask for them to be removed.
 *
 * The compiler's own parser rather than a regex that strips `/* … *\/` and
 * `//`. That regex was written first and it got this wrong: these files contain
 * multi-line block comments inside object literals, and a stripper that does
 * not track whether it is inside a string produces JSON that fails to parse for
 * reasons having nothing to do with what is being asserted. Using the tool that
 * defines the format is both shorter and correct.
 */
const readJsonc = (relative: string): unknown => {
  const parsed = ts.parseConfigFileTextToJson(relative, read(relative));
  if (parsed.error !== undefined) {
    throw new Error(
      `${relative} is not valid tsconfig JSON: ${ts.flattenDiagnosticMessageText(parsed.error.messageText, ' ')}`
    );
  }
  return parsed.config;
};

interface TsConfig {
  readonly references?: ReadonlyArray<{ readonly path?: string }>;
  readonly include?: readonly string[];
  readonly exclude?: readonly string[];
}

const asTsConfig = (value: unknown): TsConfig => {
  if (typeof value !== 'object' || value === null) throw new Error('tsconfig is not an object');
  return value as TsConfig;
};

describe('the desktop renderer is actually typechecked', () => {
  it('is a referenced project of the root tsconfig, which is the only thing that checks it', () => {
    const root = asTsConfig(readJsonc('tsconfig.json'));
    const referenced = (root.references ?? []).map(reference => reference.path);

    // Measured, not assumed: `npm run desktop:ui` exits 0 on a renderer with a
    // type error in it. If this reference goes, nothing replaces it.
    expect(referenced).toContain('./tsconfig.desktop.json');
  });

  it('claims src/desktop, and the web project disclaims it', () => {
    const desktop = asTsConfig(readJsonc('tsconfig.desktop.json'));
    const app = asTsConfig(readJsonc('tsconfig.app.json'));

    expect(desktop.include ?? []).toContain('src/desktop');
    // Both projects owning the same files is what `tsc -b` composite builds
    // forbid; stating it here means the failure names the overlap rather than
    // arriving as "file is not listed within the file list of project".
    expect(app.exclude ?? []).toContain('src/desktop/**');
  });
});

describe('the desktop gates are connected to CI', () => {
  const packageJson: unknown = JSON.parse(read('package.json'));
  const scripts = ((): Readonly<Record<string, string>> => {
    if (typeof packageJson !== 'object' || packageJson === null) throw new Error('no package.json');
    const found = (packageJson as { scripts?: unknown }).scripts;
    if (typeof found !== 'object' || found === null) throw new Error('no scripts');
    return found as Readonly<Record<string, string>>;
  })();

  const PR_WORKFLOW = '.github/workflows/handoff-snapshot.yml';
  const NIGHTLY_WORKFLOW = '.github/workflows/local-edition-nightly.yml';

  /**
   * Each gate, where it runs, and what only it can catch. The third column is
   * not decoration: it is the reason a future reader may not move a row to the
   * nightly column to make a pull request faster.
   */
  const ON_EVERY_PR = [
    { script: 'desktop:ui', catches: 'the renderer no longer builds' },
    { script: 'desktop:greps', catches: 'a cloud SDK reached the built bundle' },
    { script: 'bundle:check:desktop', catches: 'the renderer grew past its ratchet' },
    {
      script: 'test:desktop-mount',
      catches:
        'the window renders nothing — every other gate here is about ABSENCE and passes on a blank page'
    },
    { script: 'test:local-contract', catches: 'the ledger stopped honouring the port contract' },
    { script: 'test:local-admission', catches: 'the Rust and TypeScript admission rules diverged' }
  ] as const;

  const NIGHTLY = [
    { script: 'test:local-sqlite', needs: 'a Postgres cluster with the migration history' },
    { script: 'test:local-verbs', needs: 'the same cluster, and the release bridge' },
    { script: 'desktop:check', needs: "the Rust toolchain and Tauri's Linux -dev packages" },
    { script: 'desktop:build', needs: 'the same, plus a release link of 454 crates' }
  ] as const;

  it.each([...ON_EVERY_PR, ...NIGHTLY])('package.json defines $script', ({ script }) => {
    expect(Object.keys(scripts)).toContain(script);
  });

  it('runs every per-PR gate on every pull request', () => {
    const workflow = read(PR_WORKFLOW);
    // Matched on the invocation rather than on a step name, so a job can be
    // renamed or reordered freely and only a DELETED check fails this.
    const missing = ON_EVERY_PR.filter(gate => !workflow.includes(`npm run ${gate.script}`)).map(
      gate => `${gate.script} — nothing else catches: ${gate.catches}`
    );
    expect(missing).toEqual([]);
  });

  it('runs every environment-heavy gate nightly', () => {
    const workflow = read(NIGHTLY_WORKFLOW);
    const missing = NIGHTLY.filter(gate => !workflow.includes(`npm run ${gate.script}`)).map(
      gate => `${gate.script} — it is nightly because it needs ${gate.needs}`
    );
    expect(missing).toEqual([]);
  });

  it('never lets a desktop or local gate degrade to green', () => {
    // supabase-smoke.yml's ruling, applied here: a nightly that cannot go red
    // is theatre. `continue-on-error` is how a gate stops being one without
    // anybody deleting it.
    for (const workflow of [NIGHTLY_WORKFLOW, PR_WORKFLOW]) {
      const jobs = read(workflow);
      const offending = jobs
        .split('\n')
        .filter(line => line.includes('continue-on-error') && line.includes('true'));
      // The web half of handoff-snapshot.yml has one, on the Supabase migration
      // lint, which predates this and is not a desktop gate. Anything beyond
      // that count is new and has to be argued for rather than inherited.
      expect(offending.length).toBeLessThanOrEqual(workflow === PR_WORKFLOW ? 1 : 0);
    }
  });
});
