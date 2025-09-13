#!/bin/bash

# Script to fix React hooks violations in batch
# Pattern 1: Early returns before hooks
# Pattern 2: Try-catch wrapping hooks

echo "Fixing React hooks violations in batch..."

# Get all files with hooks violations
FILES=$(npx eslint src --ext .ts,.tsx 2>&1 | grep -B1 "react-hooks/rules-of-hooks" | grep "^/Users" | cut -d: -f1 | sort -u)

FIXED_COUNT=0
for file in $FILES; do
  echo "Checking $file..."
  
  # Check if file has try-catch wrapping component body
  if grep -q "^const.*= memo(function.*{$" "$file" && grep -q "^  try {" "$file"; then
    echo "  Found try-catch pattern in $file"
    # This needs manual fixing - record it
    echo "$file" >> files-with-try-catch.txt
    ((FIXED_COUNT++))
  fi
  
  # Check for early returns before hooks
  if grep -q "if.*return null" "$file"; then
    echo "  Found early return pattern in $file"
    echo "$file" >> files-with-early-returns.txt
    ((FIXED_COUNT++))
  fi
done

echo "Found $FIXED_COUNT files needing fixes"
echo "Files with try-catch pattern saved to: files-with-try-catch.txt"
echo "Files with early returns saved to: files-with-early-returns.txt"