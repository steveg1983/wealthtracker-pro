#!/usr/bin/env node
// One-time (and re-runnable) seeder for manifest.json.
//
//   node scripts/port-coverage/seed.mjs --audit-dir=<dir> [--refresh-citations] [--write]
//
// Adds an entry for every newly discovered file. It never changes a status, a
// reason or a note — dispositions are human work and this script is not allowed
// to overwrite them. `--refresh-citations` re-derives the two fields that ARE
// derived (`ids`, `cited_by`) on existing entries. Without --write it prints
// what it would do.
//
// --audit-dir points at the Phase 1 documents (DESIGN.md, TS-INVARIANTS.md,
// PHASE1-PLAN.md, AUDIT3.md). When given, a new entry records which documents
// name the file and which invariant ids sit alongside the citation. Those are
// informational: a citation is not a disposition, so every new entry is
// `pending` regardless.

import fs from 'node:fs';
import path from 'node:path';
import { discover, REPO_ROOT } from './lib/discovery.mjs';
import { collectCitations } from './lib/audit-citations.mjs';
import { loadManifest, writeManifest, MANIFEST_PATH } from './lib/manifest.mjs';

const argv = process.argv.slice(2);
const value = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const write = argv.includes('--write');
const refresh = argv.includes('--refresh-citations');
const auditDir = value('audit-dir');

if (refresh && !auditDir) {
  process.stderr.write('--refresh-citations needs --audit-dir=<dir>\n');
  process.exit(2);
}

const out = (line = '') => process.stdout.write(`${line}\n`);

const result = discover(REPO_ROOT);
const discovered = [...result.files.keys()];

let citations = new Map();
let auditSources = [];
if (auditDir) {
  const docs = fs.readdirSync(auditDir).filter((f) => f.endsWith('.md')).sort().map((f) => path.join(auditDir, f));
  if (docs.length === 0) {
    process.stderr.write(`no .md documents in ${auditDir}\n`);
    process.exit(2);
  }
  citations = collectCitations(docs, discovered);
  auditSources = docs.map((d) => path.basename(d));
}

const manifest = fs.existsSync(MANIFEST_PATH)
  ? loadManifest()
  : {
    version: 1,
    purpose: 'Disposition of every money-handling file for the local-edition port. See README.md.',
    checked_by: 'npm run port:coverage',
    seeded_from_audits: auditSources,
    seeded_at: new Date().toISOString().slice(0, 10),
    files: {},
  };

const added = [];
for (const file of discovered) {
  if (Object.hasOwn(manifest.files, file)) continue;
  const citation = citations.get(file);
  const entry = { status: 'pending' };
  if (citation) {
    if (citation.ids.length > 0) entry.ids = citation.ids;
    entry.cited_by = citation.citedBy;
  }
  manifest.files[file] = entry;
  added.push(file);
}

const recited = [];
if (refresh) {
  for (const file of discovered) {
    if (added.includes(file)) continue;
    const entry = manifest.files[file];
    const citation = citations.get(file);
    const before = JSON.stringify([entry.ids ?? [], entry.cited_by ?? []]);
    if (citation) {
      if (citation.ids.length > 0) entry.ids = citation.ids;
      else delete entry.ids;
      entry.cited_by = citation.citedBy;
    } else {
      delete entry.ids;
      delete entry.cited_by;
    }
    if (JSON.stringify([entry.ids ?? [], entry.cited_by ?? []]) !== before) recited.push(file);
  }
}

out(`discovered ${discovered.length} files; manifest holds ${Object.keys(manifest.files).length}`);
out(`${added.length} new ${added.length === 1 ? 'entry' : 'entries'}${write ? ' written' : ' (dry run — pass --write)'}`);
for (const file of added) {
  const citation = citations.get(file);
  out(`  + ${file}${citation ? `   cited by ${citation.citedBy.join(',')}${citation.ids.length > 0 ? ` as ${citation.ids.join(' ')}` : ''}` : ''}`);
}
if (refresh) {
  out(`${recited.length} ${recited.length === 1 ? 'citation' : 'citations'} re-derived (statuses, reasons and notes untouched)`);
  for (const file of recited) out(`  ~ ${file}   ${(manifest.files[file].cited_by ?? ['(now uncited)']).join(',')}`);
}

if (write) {
  if (auditSources.length > 0) manifest.seeded_from_audits = auditSources;
  writeManifest(manifest);
  out(`wrote ${path.relative(REPO_ROOT, MANIFEST_PATH)}`);
}
