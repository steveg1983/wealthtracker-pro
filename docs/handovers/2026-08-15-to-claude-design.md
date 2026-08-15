# Handover back to Claude Design — 15 August 2026

**From:** the implementation side
**Covers:** everything since the conversion-queue handover, PRs #294 onwards

---

## 0. What this document is, and what it is not

It is a **letter**, not a record of rulings.

This repo keeps design rulings in the header comment of the code they govern,
deliberately — `CLAUDE.md` says so, and the reason is that a document restating
a ruling drifts away from the code and then argues with it. Section 5 below is
a live demonstration of exactly that failure, caught this morning.

So: no colour rules are restated here. Where a ruling is mentioned, the file
that owns it is named. Grep the header before re-litigating anything.

---

## 1. Design's queue is closed

Both handovers landed in full.

| Handover | Shipped in | Notes |
| --- | --- | --- |
| Negative parentheses | [#298](../../) | Plus a follow-through Design did not ask for — see §4 |
| Add Account modal review (8 items) | [#302](../../), [#304](../../) | 7 of 8 implemented; 1 declined, see §3 |

Three of the eight "items" in the modal review turned out to be **one bug**
wearing three faces, which is why #302's title says so. Worth knowing for how
future lists are written: the symptoms were reported separately and were not
separate.

Everything else in #294–#311 came from the owner testing against his real
ledger and his phone, not from Design. Listing it would be noise; the relevant
outcomes are §3–§5.

---

## 2. The encryption question — answered, and built

Design asked what was happening with export encryption. The owner's steer was
"why can't we encrypt it, or give the user the option?" It shipped in
[#294](../../).

**What it is:** AES-256-GCM, with PBKDF2-SHA-256 at 600,000 iterations
(OWASP's 2023 floor) turning the password into a key. Optional — an
unencrypted backup is still available.

**Three decisions Design may care about, because they are user-visible:**

1. **It is still a `.json` file, and it says what it is.** The envelope carries
   the algorithm, the KDF, the iteration count and the salt in readable
   fields. Someone who finds one of these in five years, with this app long
   gone, can read the header and knows how to open it. A backup that cannot be
   opened without its original software is not a backup.
2. **The iteration count travels in the file**, so raising it later does not
   strand files written before the change.
3. **GCM is authenticated**, which is the whole reason for choosing it: a file
   altered by one byte fails to decrypt, rather than decrypting into
   plausible-looking rubbish that then gets restored over real data.

The failure copy names **both** faults it could be — wrong password, or damaged
file — because the app genuinely cannot tell which, and guessing at one would
send someone hunting for the wrong problem. `BackupDecryptionError`.

**Not** built on the app's existing CryptoJS helper, which derives keys with the
old OpenSSL `EVP_BytesToKey` construction (a few MD5 rounds, no configurable
cost) and was separately measured at ~92% of the cost of every write in the app.

---

## 3. Declined: the interest-rate field on Loan/Savings

Design's Add Account review asked for an interest-rate field on the Loan and
Savings account types. **Not built.** The reason is not taste:

- there is no `interest_rate` column on the accounts table in `supabase/`;
- nothing in `src/` reads an interest rate off an account (the only
  `interestRate` in the tree belongs to `types/financial-planning.ts`, a
  separate feature with its own model);
- so the field would accept a number, report it back on reopening, and change
  nothing anywhere.

That is the precise shape of the four controls we had just **removed** in
[#305](../../) — Two-Factor, Biometric, End-to-End Encryption and Read-Only
Mode, all of which stored a preference nothing read. A dead control in a
security panel is a false statement about safety; a dead control on an account
is a false statement about money. Neither is worth shipping to close a list
item.

**It is a good idea.** It wants the column, a decision about compounding, and
somewhere that displays the consequence — then the field is honest. Happy to
build it that way if Design wants to spec it.

---

## 4. Two findings from the parentheses work Design should know about

**The mocks.** Applying the parentheses ruling surfaced that the test suite
contained **24** hand-rolled fake currency formatters — tests asserting against
their own invented `£1,234.56`, not against the app's real `formatCurrency`.
They would have passed no matter what the ruling did to real output. All 24 now
call the real formatter (#300). Design's ruling was fine; the instrument
measuring it was not.

**The speech path.** Parentheses are silent to a screen reader — `(£100.00)`
and `£100.00` can read identically depending on the engine, which would have
made the ruling *remove* information for anyone not looking at the screen. So
`Amount` renders the visible text `aria-hidden` and supplies an accessible name
from `formatCurrencyForSpeech`, which says the word "minus". Flagging it
because any future ruling that changes how a sign is *drawn* has the same
obligation.

---

## 5. What Design owes back: one open question

**`src/components/LargeTransactionAlertSettings.tsx:89`** — the amber panel.

It is a **preview**. It shows the user an example of the notification they will
receive, and it is currently dressed in the warning pair.

The question: does a preview of a warning wear the warning's colour? It is not
warning anyone about anything — it is a sample. Under the four categories, a
sample looks like it belongs in a neutral one, but that is a category call and
category calls are Design's.

Deliberately left alone. It was inside the blast radius of the AA sweep
([#309](../../)) and I would not recategorise a panel on my own authority while
already touching its neighbours.

*(The other open question, "balance as of date", was resolved by the owner
directly: Add Account now asks for an **opening** balance and when it was true
— #304. No input needed.)*

---

## 6. A doctrine failure worth reporting, because it is Design's doctrine

`semantic-contrast.test.ts` exists because Design asked, correctly, that
contrast be **measured in this repo's harness, not calculated and asserted from
memory** — after calculated figures failed here twice.

This morning, moving `NEXT_ACTION_YELLOW` into the design system, the same
failure was found one level up. The ratios were written **in prose** in the
constant's header and **again** in prose at a call site, and the copies had
drifted:

| | claimed | measured |
| --- | --- | --- |
| amber-800 on amber-100 | 6.37 *and* 6.15 | **6.37** |
| dark pair, as quoted at the call site | 10.7 | **9.16** on the card it sits on |

The dark number was not merely stale — it was measured against the **gray-900
page** and quoted for a panel that sits on a **gray-800 card**. That is the
exact error Design's own rule was written to prevent, committed in prose by the
person enforcing it in tests.

Nothing failed AA; every pair clears it with room. That is *why* it survived
three PRs.

**Fixed properly:** the prose figures are gone, and the constant's six pairs are
now measured on both surfaces by `semantic-contrast.test.ts`, reading the
shades **out of the constant itself** so a shade change re-measures rather than
re-remembers. Proven non-vacuous by breaking it four ways (injecting a
non-colour utility, darkening the light text, darkening the dark text, dropping
the hover state) and confirming each fails.

**The generalisable rule, for Design's consideration:** a measured number
written into prose becomes a remembered number the moment it is copied. If a
ratio matters enough to state, it belongs in the assertion, and the prose should
point at the test.

---

## 7. Parked, with reasons

| Item | Status |
| --- | --- |
| Save & Next category bug | Owner's call: wait for the next bank import to reproduce it honestly rather than guess at it |
| 844px tablet breakpoint | Owner's decision pending |
| Twelve Data stock search | Built and merged (#311), inert until an API key is added to the deployment. Provider seam, so switching is config, not a rewrite |

---

## 8. State of the tree

18 PRs merged in this stream, none open, working tree clean. Lint, strict
types, 6,000+ unit tests, the desktop renderer's cloud-free greps and its size
ratchet all green. The renderer got **5.6 KiB smaller** as a side effect of §6's
move: `SubscriptionStatus` no longer pulls a reconciliation module into its
chunk, which is the clearest argument that the constant was in the wrong place.
