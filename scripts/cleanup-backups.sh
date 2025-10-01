#!/bin/bash
# Automated Backup Cleanup Script
# Purpose: Maintain maximum 3 most recent backups of CLAUDE.md and src/
# Usage: bash scripts/cleanup-backups.sh
# Schedule: Run weekly (every Monday) or before creating new backups

set -e  # Exit on error

PROJECT_ROOT="/Users/stevegreen/PROJECT_WEALTHTRACKER/wealthtracker-web"
cd "$PROJECT_ROOT"

echo "🧹 WealthTracker Backup Cleanup"
echo "================================"
echo ""

# Clean CLAUDE.md backups
echo "📄 Cleaning CLAUDE.md backups (keeping 3 most recent)..."
CLAUDE_BACKUPS=$(ls -t CLAUDE.md.backup.* 2>/dev/null | wc -l | tr -d ' ')
if [ "$CLAUDE_BACKUPS" -gt 3 ]; then
  TO_DELETE=$(($CLAUDE_BACKUPS - 3))
  echo "   Found $CLAUDE_BACKUPS backups, removing oldest $TO_DELETE..."
  ls -t CLAUDE.md.backup.* | tail -n +4 | xargs rm -f
  echo "   ✅ Removed $TO_DELETE old CLAUDE.md backup(s)"
elif [ "$CLAUDE_BACKUPS" -eq 0 ]; then
  echo "   ℹ️  No CLAUDE.md backups found"
else
  echo "   ✅ Found $CLAUDE_BACKUPS backup(s) - under limit, nothing to remove"
fi

echo ""

# Clean src backups
echo "📁 Cleaning src/ backups (keeping 3 most recent)..."
SRC_BACKUPS=$(ls -dt src.backup.* 2>/dev/null | wc -l | tr -d ' ')
if [ "$SRC_BACKUPS" -gt 3 ]; then
  TO_DELETE=$(($SRC_BACKUPS - 3))
  echo "   Found $SRC_BACKUPS backups, removing oldest $TO_DELETE..."
  ls -dt src.backup.* | tail -n +4 | xargs rm -rf
  echo "   ✅ Removed $TO_DELETE old src.backup.* director(y/ies)"
elif [ "$SRC_BACKUPS" -eq 0 ]; then
  echo "   ℹ️  No src.backup.* directories found"
else
  echo "   ✅ Found $SRC_BACKUPS backup(s) - under limit, nothing to remove"
fi

echo ""
echo "✨ Cleanup complete!"
echo ""

# Show remaining backups
echo "📋 Remaining backups:"
echo ""
echo "CLAUDE.md backups:"
ls -lht CLAUDE.md.backup.* 2>/dev/null | awk '{print "   " $9 " (" $5 ", " $6 " " $7 " " $8 ")"}' || echo "   None"
echo ""
echo "src/ backups:"
ls -dlht src.backup.* 2>/dev/null | awk '{print "   " $9 " (" $5 ", " $6 " " $7 " " $8 ")"}' || echo "   None"

echo ""
echo "💾 Backup policy: Maximum 3 most recent copies retained"
echo "📅 Next cleanup: Run weekly or before creating new backups"