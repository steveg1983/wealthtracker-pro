// Load, validate and serialise manifest.json.
//
// The manifest is the only place human judgement lives. Discovery decides what
// must be dispositioned; the manifest records the disposition; the checker
// refuses to let the two drift apart.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MANIFEST_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'manifest.json');

export const STATUSES = {
  ported: 'Its rules exist in the local edition and are covered by differential or unit tests. Requires `evidence`.',
  'mirror-of': 'A TypeScript mirror of rules owned elsewhere (SQL, or another module). Requires `of`: the audit ids it mirrors.',
  'out-of-scope': 'Deliberately not part of the local-edition port. Requires `reason`.',
  pending: 'Not yet dispositioned. The work queue.',
};

/** An `out-of-scope` reason with one of these prefixes also excuses the file being gone from disk. */
export const ABSENCE_REASONS = ['deleted:', 'superseded-by:', 'moved-to:'];

export function loadManifest(manifestPath = MANIFEST_PATH) {
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || typeof parsed.files !== 'object') {
    throw new Error(`${manifestPath}: expected an object with a "files" map`);
  }
  return parsed;
}

/**
 * Structural validation of every entry. Returns a list of human-readable
 * problems; an empty list means the manifest is internally coherent (it says
 * nothing about whether the claims are true — see README §"What this does not
 * prove").
 */
export function validateEntries(manifest) {
  const problems = [];
  for (const [file, entry] of Object.entries(manifest.files)) {
    if (!entry || typeof entry !== 'object') {
      problems.push(`${file}: entry is not an object`);
      continue;
    }
    if (!Object.hasOwn(STATUSES, entry.status)) {
      problems.push(`${file}: unknown status "${entry.status}" (expected one of ${Object.keys(STATUSES).join(', ')})`);
      continue;
    }
    if (entry.status === 'mirror-of' && (!Array.isArray(entry.of) || entry.of.length === 0)) {
      problems.push(`${file}: status "mirror-of" needs a non-empty "of" array naming the audit ids it mirrors`);
    }
    if (entry.status === 'out-of-scope' && (typeof entry.reason !== 'string' || entry.reason.trim() === '')) {
      problems.push(`${file}: status "out-of-scope" needs a "reason"`);
    }
    if (entry.status === 'ported' && (typeof entry.evidence !== 'string' || entry.evidence.trim() === '')) {
      problems.push(`${file}: status "ported" needs "evidence" naming the specs or tests that prove it`);
    }
    if (entry.discovery !== undefined && entry.discovery !== 'manual') {
      problems.push(`${file}: "discovery" may only be omitted or set to "manual"`);
    }
  }
  return problems;
}

export function toleratesAbsence(entry) {
  return entry.status === 'out-of-scope'
    && typeof entry.reason === 'string'
    && ABSENCE_REASONS.some((prefix) => entry.reason.startsWith(prefix));
}

const ENTRY_KEY_ORDER = ['status', 'of', 'reason', 'evidence', 'discovery', 'ids', 'cited_by', 'note'];

function orderEntry(entry) {
  const out = {};
  for (const key of ENTRY_KEY_ORDER) if (entry[key] !== undefined) out[key] = entry[key];
  for (const key of Object.keys(entry)) if (!Object.hasOwn(out, key)) out[key] = entry[key];
  return out;
}

/**
 * One line per file, paths sorted. `git diff` on this file should read as a
 * list of dispositions changing, never as a reflow.
 */
export function serialiseManifest(manifest) {
  const head = { ...manifest };
  delete head.files;
  const headLines = Object.entries(head).map(
    ([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value, null, 2).split('\n').join('\n  ')}`,
  );
  const fileLines = Object.keys(manifest.files)
    .sort()
    .map((file) => `    ${JSON.stringify(file)}: ${JSON.stringify(orderEntry(manifest.files[file]))}`);
  const body = [...headLines, `  "files": {\n${fileLines.join(',\n')}\n  }`];
  return `{\n${body.join(',\n')}\n}\n`;
}

export function writeManifest(manifest, manifestPath = MANIFEST_PATH) {
  fs.writeFileSync(manifestPath, serialiseManifest(manifest), 'utf8');
}
