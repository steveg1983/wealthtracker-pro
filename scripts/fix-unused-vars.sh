#!/bin/bash
# Script to help identify and fix unused variables

echo "=== FILES WITH UNUSED VARIABLE WARNINGS ==="
npm run lint 2>&1 | grep -B2 "no-unused-vars" | grep "^/" | awk '{print $1}' | sort -u | nl

echo ""
echo "=== TOTAL COUNT ==="
npm run lint 2>&1 | grep "no-unused-vars" | wc -l
