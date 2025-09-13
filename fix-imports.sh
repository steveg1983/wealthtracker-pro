#!/bin/bash

# Fix malformed React imports

echo "Fixing malformed React imports..."

# Pattern 1: Fix "import React, { useEffect, { useState } from 'react';"
# Should be: "import React, { useEffect, useState } from 'react';"
find src -name "*.tsx" -type f -exec sed -i '' 's/import React, { useEffect, { \([^}]*\) }/import React, { useEffect, \1 }/g' {} \;

# Pattern 2: Fix "import React, { useEffect from 'react';"
# Should be: "import React, { useEffect } from 'react';"
find src -name "*.tsx" -type f -exec sed -i '' 's/import React, { useEffect from/import React, { useEffect } from/g' {} \;

# Pattern 3: Fix other missing braces variations
find src -name "*.tsx" -type f -exec sed -i '' 's/import React, { \([^}]*\) from/import React, { \1 } from/g' {} \;

echo "Import fixes applied!"

# Count remaining errors
echo "Checking for remaining syntax errors..."
find src -name "*.tsx" -exec grep -l "import React, { [^}]*from" {} \; | wc -l