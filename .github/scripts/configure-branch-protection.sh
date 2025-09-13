#!/usr/bin/env bash
set -euo pipefail

# Configure branch protection for main via GitHub API using gh CLI.
# Requirements:
# - gh CLI installed and authenticated with a token that has admin:repo_hook / repo scope
# - GH_REPOSITORY set to "owner/repo" (if not, script will try to infer via git remote)
#
# Usage:
#   GH_TOKEN=... GH_REPOSITORY=owner/repo .github/scripts/configure-branch-protection.sh

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found. Install https://cli.github.com/" >&2
  exit 1
fi

REPO=${GH_REPOSITORY:-}
if [[ -z "$REPO" ]]; then
  origin_url=$(git config --get remote.origin.url || true)
  # Handle SSH and HTTPS URLs
  if [[ "$origin_url" =~ github.com[:/]{1}([^/]+/[^/.]+) ]]; then
    REPO="${BASH_REMATCH[1]}"
  fi
fi

if [[ -z "$REPO" ]]; then
  echo "Unable to determine repository. Set GH_REPOSITORY=owner/repo" >&2
  exit 1
fi

echo "Applying branch protection to $REPO:main"

# Load desired protection config
CONFIG_FILE=".github/branch-protection.json"
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Config file not found: $CONFIG_FILE" >&2
  exit 1
fi

# PUT /repos/{owner}/{repo}/branches/{branch}/protection
gh api \
  -X PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/$REPO/branches/main/protection" \
  --input "$CONFIG_FILE"

echo "Branch protection updated. Verify in GitHub Settings → Branches."

