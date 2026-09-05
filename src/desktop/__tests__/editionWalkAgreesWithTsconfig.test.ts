/**
 * THE WALK'S ALIAS MAPS AGREE WITH THE COMPILER'S.
 *
 * `editionWalk.ts` carries two hand-written maps of every seam to the module it
 * resolves to in each edition, and every import-graph test in this directory
 * walks with one of them. A seam a map does not know is not an error there:
 * the walker files the specifier as a package and stops. That is a blind spot,
 * and for a week it was a real one — from 28 Aug to 5 Sep 2026 `@rules-store`
 * was declared in six build configs and in neither map, so nobody walked the
 * rules store in either edition; and the cloud map's `@session` pointed at the
 * DEVICE half, so the "would notice" walk from the web entry was reading the
 * desktop's session code and calling it the cloud's.
 *
 * The compiler already holds both truths, in the `paths` of
 * `tsconfig.desktop.json` and `tsconfig.app.json`, and `typecheck:strict`
 * proves those resolve. So the maps are held to the tsconfigs — key for key,
 * target for target, in both directions — and a seam added to a tsconfig
 * without being added to the walk fails here rather than silently shortening
 * every walk in the directory. Proven non-vacuous on the day it was written:
 * run against the maps as they stood, it failed on both of the faults above.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { CLOUD_ALIAS, DEVICE_ALIAS } from './editionWalk';

const REPO = path.resolve(__dirname, '..', '..', '..');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * The seam entries of one tsconfig's `paths`, spelt the way the walker spells a
 * target: `src/`-relative, no extension. `@wealthtracker/utils` is skipped —
 * a workspace package with one target in both projects is not a seam, because
 * there is nothing for an edition to choose between.
 */
function seamsOf(tsconfig: string): Record<string, string> {
  const file = path.join(REPO, tsconfig);
  const { config, error } = ts.parseConfigFileTextToJson(file, readFileSync(file, 'utf8'));
  if (error) throw new Error(ts.flattenDiagnosticMessageText(error.messageText, '\n'));
  const parsed: unknown = config;
  if (!isRecord(parsed) || !isRecord(parsed.compilerOptions) || !isRecord(parsed.compilerOptions.paths)) {
    throw new Error(`${tsconfig}: no compilerOptions.paths to read`);
  }
  const seams: Record<string, string> = {};
  for (const [specifier, targets] of Object.entries(parsed.compilerOptions.paths)) {
    if (!specifier.startsWith('@') || specifier.includes('/')) continue;
    if (!Array.isArray(targets) || typeof targets[0] !== 'string') {
      throw new Error(`${tsconfig}: ${specifier} has no string target`);
    }
    seams[specifier] = targets[0].replace(/^\.\/src\//, '').replace(/\.tsx?$/, '');
  }
  return seams;
}

describe('the edition walk knows every seam the compiler knows', () => {
  const device = seamsOf('tsconfig.desktop.json');
  const cloud = seamsOf('tsconfig.app.json');

  it('is reading real files: the two projects name the same seams and agree on none of them', () => {
    expect(Object.keys(device).sort()).toEqual(Object.keys(cloud).sort());
    expect(Object.keys(device).length).toBeGreaterThanOrEqual(9);
    for (const seam of Object.keys(device)) expect(device[seam]).not.toBe(cloud[seam]);
  });

  it('maps the device halves exactly as tsconfig.desktop.json does', () => {
    expect(DEVICE_ALIAS).toEqual(device);
  });

  it('maps the cloud halves exactly as tsconfig.app.json does', () => {
    expect(CLOUD_ALIAS).toEqual(cloud);
  });
});
