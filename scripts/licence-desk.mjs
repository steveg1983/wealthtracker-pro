#!/usr/bin/env node

/**
 * THE LICENCE DESK. `issue-licence.mjs --issue`, as a page with a memory.
 *
 *   node scripts/licence-desk.mjs        (or: npm run licence:desk)
 *
 * Opens http://127.0.0.1:8377 — a form for the person's name, their email and
 * a length in months (blank for a lifetime licence), a copy button for the
 * string it signs, and a record of every licence this desk has ever issued.
 * Licences issued in the terminal before the desk existed can be pasted into
 * the record; they are verified against the committed public key first, so the
 * record can never hold a string the shipped app would refuse.
 *
 * ── WHERE THE RECORD LIVES, AND WHY NOT IN THE REPOSITORY ───────────────────
 *
 * `~/Documents/WealthTracker-signing/licence-ledger.jsonl` — one JSON line per
 * licence, next to the private key. The record holds real customers' names and
 * email addresses and the repository is PUBLIC; the signing directory is the
 * one place in this project already established as private-and-backed-up. The
 * crate's "nothing here needs to know how many have been sold" note still
 * holds for SIGNING — the ledger is the owner's memory, not the scheme's.
 *
 * ── WHY A LOCAL SERVER AND NOT A HOSTED PAGE ────────────────────────────────
 *
 * Issuing means signing, signing means the private key, and the private key
 * never leaves this machine. The page is served from 127.0.0.1 and the key is
 * only ever touched server-side, in this process; the browser sees nothing but
 * claims and finished licence strings. The server also refuses any request
 * whose Host header is not localhost's own — a page in some other tab saying
 * `fetch('http://127.0.0.1:8377/issue')` gets its POST answered but cannot
 * read the response (no CORS headers are ever sent), and a DNS name that
 * RESOLVES to 127.0.0.1 — the rebinding trick that would make it readable — is
 * turned away by that Host check.
 */

import { execFile } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { issueLicence, SIGNING_DIR, verifyLicence } from './licence-core.mjs';

const LEDGER = path.join(SIGNING_DIR, 'licence-ledger.jsonl');
const PORT = Number(process.env.WEALTHTRACKER_DESK_PORT ?? 8377);
const URL_SHOWN = `http://127.0.0.1:${PORT}`;

const say = line => process.stdout.write(`${line}\n`);

// ── the record ───────────────────────────────────────────────────────────────

/** Every recorded licence, oldest first. A line that will not parse is skipped
 *  aloud rather than silently — the record is the point of this tool. */
function readLedger() {
  if (!existsSync(LEDGER)) return [];
  const rows = [];
  for (const line of readFileSync(LEDGER, 'utf8').split('\n')) {
    if (line.trim() === '') continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      process.stderr.write(`licence-desk: skipping an unreadable line in ${LEDGER}\n`);
    }
  }
  return rows;
}

function record(entry) {
  mkdirSync(SIGNING_DIR, { recursive: true, mode: 0o700 });
  appendFileSync(LEDGER, `${JSON.stringify(entry)}\n`);
}

// ── the requests ─────────────────────────────────────────────────────────────

/** The request body, refused beyond 64 KiB — nothing this desk accepts is big. */
function body(request) {
  return new Promise((resolve, reject) => {
    let held = '';
    request.on('data', piece => {
      held += piece;
      if (held.length > 64 * 1024) {
        reject(new Error('that request is far bigger than anything this desk accepts.'));
        request.destroy();
      }
    });
    request.on('end', () => resolve(held));
    request.on('error', reject);
  });
}

const answer = (response, status, value) => {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
};

const server = createServer(async (request, response) => {
  // The rebinding guard argued in the header: only localhost's own names.
  const host = (request.headers.host ?? '').split(':')[0];
  if (host !== '127.0.0.1' && host !== 'localhost') {
    answer(response, 403, { error: 'this desk only answers localhost.' });
    return;
  }

  try {
    if (request.method === 'GET' && request.url === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(PAGE);
    } else if (request.method === 'GET' && request.url === '/licences') {
      answer(response, 200, readLedger().reverse());
    } else if (request.method === 'POST' && request.url === '/issue') {
      const { name, email, months } = JSON.parse(await body(request));
      const trialMonths = String(months ?? '').trim() === '' ? undefined : String(months).trim();
      const { claims, licence } = issueLicence({
        name: String(name ?? '').trim(),
        email: String(email ?? '').trim(),
        trialMonths
      });
      record({ recorded: new Date().toISOString(), source: 'desk', claims, licence });
      answer(response, 200, { claims, licence });
    } else if (request.method === 'POST' && request.url === '/record') {
      const licence = String(JSON.parse(await body(request)).licence ?? '').trim();
      const claims = verifyLicence(licence);
      if (readLedger().some(row => row.claims?.id === claims.id)) {
        answer(response, 200, { already: true, claims });
        return;
      }
      record({ recorded: new Date().toISOString(), source: 'pasted', claims, licence });
      answer(response, 200, { claims, licence });
    } else {
      answer(response, 404, { error: 'the desk has no such page.' });
    }
  } catch (refused) {
    answer(response, 400, { error: refused instanceof Error ? refused.message : String(refused) });
  }
});

server.on('error', failure => {
  if (failure.code === 'EADDRINUSE') {
    say(`The licence desk is already running — open ${URL_SHOWN}`);
    open();
    process.exit(0);
  }
  throw failure;
});

server.listen(PORT, '127.0.0.1', () => {
  say(`The licence desk is at ${URL_SHOWN} — leave this window open while you use it.`);
  say(`The record lives in ${LEDGER}`);
  open();
});

function open() {
  if (process.platform === 'darwin' && !process.env.WEALTHTRACKER_DESK_NO_OPEN) {
    execFile('open', [URL_SHOWN], () => {});
  }
}

// ── the page ─────────────────────────────────────────────────────────────────
//
// One document, no assets, no client-side template literals (this whole page
// lives inside one server-side template literal, and a nested backtick would
// end it). Names and emails come back out of the record, so everything the
// ledger touches goes through esc() before it reaches innerHTML.

const PAGE = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WealthTracker licence desk</title>
<style>
  :root { color-scheme: light dark; }
  body {
    font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    max-width: 780px; margin: 2rem auto 4rem; padding: 0 1rem;
    background: Canvas; color: CanvasText;
  }
  h1 { font-size: 1.4rem; margin-bottom: 0.2rem; }
  .quiet { opacity: 0.65; font-size: 0.9rem; }
  form, .panel { border: 1px solid color-mix(in srgb, CanvasText 25%, transparent);
    border-radius: 10px; padding: 1rem 1.2rem; margin: 1.2rem 0; }
  label { display: block; font-weight: 600; font-size: 0.9rem; margin: 0.8rem 0 0.2rem; }
  input, textarea { width: 100%; box-sizing: border-box; font: inherit;
    padding: 0.45rem 0.6rem; border: 1px solid color-mix(in srgb, CanvasText 30%, transparent);
    border-radius: 7px; background: Field; color: FieldText; }
  textarea.key { font-family: ui-monospace, Menlo, monospace; font-size: 0.8rem; height: 5.4rem; }
  button { font: inherit; font-weight: 600; padding: 0.45rem 1rem; margin-top: 0.9rem;
    border: 1px solid color-mix(in srgb, CanvasText 35%, transparent);
    border-radius: 8px; background: Canvas; color: CanvasText; cursor: pointer; }
  button:hover { background: color-mix(in srgb, CanvasText 8%, Canvas); }
  .error { color: #b3261e; font-weight: 600; margin-top: 0.8rem; }
  .ok { font-weight: 600; margin-top: 0.8rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.88rem; margin-top: 0.8rem; }
  th { text-align: left; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em;
    opacity: 0.65; padding: 0.3rem 0.5rem 0.3rem 0; }
  td { padding: 0.42rem 0.5rem 0.42rem 0;
    border-top: 1px solid color-mix(in srgb, CanvasText 15%, transparent); }
  td button { margin: 0; padding: 0.15rem 0.6rem; font-size: 0.8rem; font-weight: 500; }
  .ended { color: #b3261e; }
  .wrap { overflow-x: auto; }
</style>
</head>
<body>
<h1>WealthTracker licence desk</h1>
<p class="quiet">Licences are signed on this machine — the private key never leaves it.
The record lives next to the key in Documents&thinsp;/&thinsp;WealthTracker-signing.</p>

<form id="issue">
  <label for="name">Name</label>
  <input id="name" autocomplete="off" placeholder="Ada Lovelace">
  <label for="email">Email</label>
  <input id="email" autocomplete="off" placeholder="ada@example.com">
  <label for="months">Length, in months</label>
  <input id="months" autocomplete="off" inputmode="numeric" placeholder="Leave blank for a lifetime licence">
  <button type="submit">Issue licence</button>
  <div id="issue-error" class="error" hidden></div>
</form>

<div id="result" class="panel" hidden>
  <div id="result-summary" class="ok"></div>
  <textarea id="result-key" class="key" readonly></textarea>
  <button id="result-copy" type="button">Copy licence</button>
</div>

<div class="panel">
  <label for="paste">Add an existing licence to the record</label>
  <p class="quiet" style="margin:0.2rem 0 0">For licences issued in the terminal —
  it is checked against the shipped public key before it is recorded.</p>
  <textarea id="paste" class="key" placeholder="WTL1-…"></textarea>
  <button id="paste-add" type="button">Add to the record</button>
  <div id="paste-note" hidden></div>
</div>

<h2 style="font-size:1.05rem; margin-top:2rem">Everything issued</h2>
<div class="wrap"><table>
  <thead><tr><th>Issued</th><th>Name</th><th>Email</th><th>Licence</th><th>Reference</th><th></th></tr></thead>
  <tbody id="rows"><tr><td colspan="6" class="quiet">Nothing recorded yet.</td></tr></tbody>
</table></div>

<script>
  var esc = function (text) {
    return String(text).replace(/[&<>"']/g, function (one) {
      return '&#' + one.charCodeAt(0) + ';';
    });
  };
  var when = function (seconds) {
    return new Date(seconds * 1000).toLocaleDateString('en-GB',
      { day: 'numeric', month: 'short', year: 'numeric' });
  };
  var describe = function (claims) {
    if (claims.kind !== 'trial') return 'Lifetime';
    var over = claims.expires * 1000 < Date.now();
    return over
      ? 'Trial — <span class="ended">ended ' + esc(when(claims.expires)) + '</span>'
      : 'Trial — ends ' + esc(when(claims.expires));
  };

  var copyText = function (text, button) {
    navigator.clipboard.writeText(text).then(function () {
      var before = button.textContent;
      button.textContent = 'Copied';
      setTimeout(function () { button.textContent = before; }, 1500);
    }, function () {
      button.textContent = 'Copy failed — select it by hand';
    });
  };

  var held = [];
  var load = function () {
    fetch('/licences').then(function (r) { return r.json(); }).then(function (rows) {
      held = rows;
      var body = document.getElementById('rows');
      if (rows.length === 0) {
        body.innerHTML = '<tr><td colspan="6" class="quiet">Nothing recorded yet.</td></tr>';
        return;
      }
      body.innerHTML = rows.map(function (row, at) {
        var claims = row.claims;
        return '<tr>' +
          '<td>' + esc(when(claims.issued)) + '</td>' +
          '<td>' + esc(claims.name) + '</td>' +
          '<td>' + esc(claims.email) + '</td>' +
          '<td>' + describe(claims) + '</td>' +
          '<td><code>' + esc(claims.id) + '</code></td>' +
          '<td><button type="button" data-at="' + at + '">Copy</button></td>' +
        '</tr>';
      }).join('');
    });
  };
  document.getElementById('rows').addEventListener('click', function (event) {
    var at = event.target.getAttribute && event.target.getAttribute('data-at');
    if (at !== null && at !== undefined) copyText(held[Number(at)].licence, event.target);
  });

  document.getElementById('issue').addEventListener('submit', function (event) {
    event.preventDefault();
    var problem = document.getElementById('issue-error');
    problem.hidden = true;
    fetch('/issue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        months: document.getElementById('months').value
      })
    }).then(function (r) { return r.json(); }).then(function (made) {
      if (made.error) {
        problem.textContent = made.error;
        problem.hidden = false;
        return;
      }
      var claims = made.claims;
      document.getElementById('result-summary').innerHTML =
        (claims.kind === 'trial' ? describe(claims) : 'Lifetime') +
        ' — ' + esc(claims.name) + ' &lt;' + esc(claims.email) + '&gt;';
      document.getElementById('result-key').value = made.licence;
      document.getElementById('result').hidden = false;
      load();
    });
  });
  document.getElementById('result-copy').addEventListener('click', function (event) {
    copyText(document.getElementById('result-key').value, event.target);
  });

  document.getElementById('paste-add').addEventListener('click', function () {
    var note = document.getElementById('paste-note');
    note.hidden = true;
    fetch('/record', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ licence: document.getElementById('paste').value })
    }).then(function (r) { return r.json(); }).then(function (kept) {
      note.className = kept.error ? 'error' : 'ok';
      note.textContent = kept.error ? kept.error
        : kept.already ? 'Already in the record — ' + kept.claims.id
        : 'Recorded — ' + kept.claims.id;
      note.hidden = false;
      if (!kept.error) { document.getElementById('paste').value = ''; load(); }
    });
  });

  load();
</script>
</body>
</html>
`;
