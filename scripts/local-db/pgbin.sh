# shellcheck shell=bash
# WHERE THE POSTGRES BINARIES ARE. Sourced by up.sh, test.sh and down.sh.
# (No shebang: this file is sourced, never executed. The directive above is how
# shellcheck is told which shell to assume for a fragment.)
#
# This was one hardcoded homebrew path in three scripts, which was true on the
# machine it was written on and nowhere else. CI runs the harness on Linux,
# where the tools live under /usr/lib/postgresql/<major>/bin and are NOT on PATH
# — `initdb` and `pg_ctl` are server binaries and Debian keeps them out of it on
# purpose, so a script that assumes PATH finds the client and not the server.
#
# `WT_PGBIN` overrides everything, then the two known layouts, then whatever
# PATH already has. Nothing here fails: `down.sh` must still be able to run when
# there is no Postgres left to find. up.sh does the refusing, because it is the
# one that cannot proceed.
#
# LC_ALL=C is set here too, on every platform, deliberately. macOS aborts the
# postmaster ("became multithreaded during startup") without it, and the
# harness's collation caveat — scripts/local-sqlite/README.md, spec x1-* — is
# written against an SQL_ASCII cluster. Letting Linux default to UTF8 would make
# the two platforms disagree about case folding and quietly flip that spec from
# a declared match to an unnoticed divergence.

export LC_ALL=C

if [ -z "${WT_PGBIN:-}" ]; then
  # `printf` over the glob rather than `ls`: if nothing matches, the pattern
  # comes back unexpanded and simply fails the -x test below, which is the
  # behaviour wanted on a machine with no Debian-layout Postgres at all.
  for _pg_candidate in \
    /opt/homebrew/opt/postgresql@17/bin \
    /usr/local/opt/postgresql@17/bin \
    "$(printf '%s\n' /usr/lib/postgresql/*/bin | sort -V | tail -1)"
  do
    if [ -x "$_pg_candidate/pg_ctl" ]; then
      WT_PGBIN="$_pg_candidate"
      break
    fi
  done
  unset _pg_candidate
fi

if [ -n "${WT_PGBIN:-}" ]; then
  export WT_PGBIN
  export PATH="$WT_PGBIN:$PATH"
fi
