#!/bin/bash

# Script to assist with fixing 'any' type violations
# This script identifies files and generates a report for systematic fixing

echo "Analyzing ESLint 'any' type violations..."
echo "=========================================="
echo ""

# Run lint and capture output
LINT_OUTPUT=$(npm run lint 2>&1)

# Extract files with 'any' violations and count them
echo "$LINT_OUTPUT" | python3 -c "
import sys
import re
from collections import defaultdict

violations = defaultdict(list)
current_file = None

for line in sys.stdin:
    line = line.strip()
    if line.startswith('/Users/'):
        current_file = line
    elif 'no-explicit-any' in line and current_file:
        match = re.search(r'(\d+):(\d+)', line)
        if match:
            violations[current_file].append((int(match.group(1)), int(match.group(2))))

# Sort by count
sorted_files = sorted(violations.items(), key=lambda x: -len(x[1]))

print(f'Total files with violations: {len(sorted_files)}')
print(f'Total violations: {sum(len(v) for v in violations.values())}')
print('')
print('Top 20 files by violation count:')
print('=' * 80)

for file, locs in sorted_files[:20]:
    rel_path = file.replace('/Users/stevegreen/PROJECT_WEALTHTRACKER/', '')
    print(f'{len(locs):3d} violations - {rel_path}')
"

echo ""
echo "=========================================="
echo "Run 'npm run lint' to see detailed warnings"
