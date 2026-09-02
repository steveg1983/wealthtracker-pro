#!/bin/bash
set -u
here="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/local-db/pgbin.sh
. "$here/pgbin.sh"
D=${WT_PGDATA:-/tmp/wtpg}; PORT=${WT_PGPORT:-55432}
rc=0
for t in "$here"/*.test.sql; do
  echo "── $(basename "$t")"

  # psql runs to a FILE, not through a pipe, so its exit status survives.
  # It used to be `psql ... | grep ... || true`, and the two things that does
  # are both wrong: the pipeline reports grep's status, and `|| true` discards
  # even that. Measured 2026-09-02 — restore-roundtrip.test.sql aborted at its
  # line 8 on a re-run and this script still exited 0, so a suite that could
  # not get past its own teardown reported success. Every test file sets
  # ON_ERROR_STOP, so a non-zero psql means the file stopped early and the
  # checks after that point never ran; that is a failure whatever the lines it
  # did print say.
  #
  # The two deliberate negative probes still pass: each turns ON_ERROR_STOP off
  # for its own last statement, so psql reaches EOF and exits 0 while the
  # expected ERROR still prints for the reader.
  out="$(mktemp)"
  psql -h "$D" -p "$PORT" -U postgres -d postgres -f "$t" > "$out" 2>&1
  status=$?

  # Header lines are matched by suffix so a result set's column names print
  # alongside its row — a bare "t | t | f" tells you nothing about which check
  # failed.
  grep -E "^ [tf]([ |]|$)|_match|_preserved|_restored|_intact|_resolves|_mutual|_correct|_rewritten|_untouched|_empty|_present|ERROR" "$out" || true

  if [ "$status" -ne 0 ]; then
    echo "   ✗ FAILED — psql exited $status; the file stopped early. Whole run:"
    sed 's/^/     /' "$out"
    rc=1
  fi
  rm -f "$out"
done

if [ "$rc" -eq 0 ]; then
  echo "── all files ran to the end"
else
  echo "── FAILED: at least one file did not run to the end"
fi
exit $rc
