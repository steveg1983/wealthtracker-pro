// Extracts "which audit document cites this file, and under which invariant
// ids" from the Phase 1 audit documents.
//
// Used only by seed.mjs, once, to give the manifest an honest starting point:
// the files three sweeps actually named keep their ids; everything else starts
// `pending`. AUDIT3 §0.1 measured the same thing by lines and found 52% of
// money-handling code cited nowhere — this turns that measurement into rows.
//
// A citation is a weak proxy and AUDIT3 says so ("a citation is not proof of a
// careful read"). It is recorded as `ids` / `cited_by`, never as a status.

import fs from 'node:fs';
import path from 'node:path';

/**
 * Invariant id shapes used across the four documents:
 *   #41                canonical inventory number (PHASE1 §1)
 *   TS-T3, TS-F12      TS-INVARIANTS ids
 *   B-1, S-5, C-11 …   DESIGN family ids
 *   D-7                TS↔SQL disagreements
 */
const ID_PATTERN = /#\d{1,3}\b|\bTS-[A-Z]{1,2}\d{1,2}\b|\b[BSTCIMXURAD]-\d{1,2}\b/g;

/**
 * Blocks are the smallest unit that can be read as one statement: a table row,
 * a list item with its wrapped continuation lines, or a paragraph. Granularity
 * matters — AUDIT3 §7.1 is a fifteen-item bullet list naming a dozen files and
 * twenty ids, and treating it as one block would attribute every id to every
 * file in it.
 */
const LIST_ITEM = /^\s*(?:[-*+]\s|\d+\.\s)/;

function splitBlocks(text) {
  const blocks = [];
  let buffer = [];
  const flush = () => {
    if (buffer.length > 0) {
      blocks.push(buffer.join('\n'));
      buffer = [];
    }
  };
  for (const line of text.split('\n')) {
    if (line.trim() === '') {
      flush();
    } else if (line.trimStart().startsWith('|')) {
      flush();
      blocks.push(line);
    } else if (LIST_ITEM.test(line)) {
      flush();
      buffer.push(line);
    } else {
      buffer.push(line);
    }
  }
  flush();
  return blocks;
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `#89` sorts before `#118`, and `#…` before `B-…` before `TS-…`. */
function compareIds(a, b) {
  const split = (id) => {
    const match = /^(.*?)(\d+)$/.exec(id);
    return match ? [match[1], Number(match[2])] : [id, 0];
  };
  const [prefixA, numberA] = split(a);
  const [prefixB, numberB] = split(b);
  if (prefixA !== prefixB) return prefixA < prefixB ? -1 : 1;
  return numberA - numberB;
}

/**
 * `accounts.ts` must not match inside `link-accounts.ts`. A path separator is a
 * legitimate left boundary; a word character, dot or dash is not.
 *
 * Migrations get a third probe: the documents cite them by bare timestamp at
 * least as often as by filename (`20260707120000:78-105`), and AUDIT3 §0.1
 * counted "by name **or timestamp**". Missing that would overstate how much of
 * the schema went unread.
 */
function mentionProbe(file) {
  const base = path.basename(file);
  const alternatives = [escapeRegExp(file), escapeRegExp(base)];
  const timestamp = /^(\d{14})_/.exec(base);
  if (timestamp) alternatives.push(timestamp[1]);
  return new RegExp(`(?<![A-Za-z0-9_.\\-])(?:${alternatives.join('|')})(?![A-Za-z0-9_])`);
}

/**
 * @param {string[]} docPaths absolute paths to the audit documents
 * @param {string[]} files repo-relative paths to look for
 * @returns {Map<string, { ids: string[], citedBy: string[] }>}
 */
export function collectCitations(docPaths, files) {
  const docs = docPaths.map((p) => ({ name: path.basename(p), text: fs.readFileSync(p, 'utf8') }));
  const blocksByDoc = docs.map((doc) => ({ name: doc.name, text: doc.text, blocks: splitBlocks(doc.text) }));

  const result = new Map();
  for (const file of files) {
    // The documents cite `dataService.ts:379-383` far more often than the full
    // path, so the basename is a first-class probe.
    const probe = mentionProbe(file);
    const ids = new Set();
    const citedBy = [];
    for (const doc of blocksByDoc) {
      if (!probe.test(doc.text)) continue;
      citedBy.push(doc.name.replace(/\.md$/, ''));
      for (const block of doc.blocks) {
        if (!probe.test(block)) continue;
        for (const id of block.match(ID_PATTERN) ?? []) ids.add(id);
      }
    }
    if (citedBy.length > 0) result.set(file, { ids: [...ids].sort(compareIds), citedBy });
  }
  return result;
}
