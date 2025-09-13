#!/bin/bash

# Get all files that need useEffect
npm run build:check 2>&1 | grep "error TS2304: Cannot find name 'useEffect'" | sed 's/\(.*\)(.*/\1/' | sort -u | while read file; do
  if [ -f "$file" ]; then
    # Get the first line that imports from 'react'
    import_line=$(grep "^import.*from 'react'" "$file" | head -1)
    
    if [ ! -z "$import_line" ]; then
      # Check if useEffect is already in the import
      if ! echo "$import_line" | grep -q "useEffect"; then
        # Extract what's currently being imported
        if echo "$import_line" | grep -q "^import {"; then
          # Named imports like: import { memo } from 'react';
          new_import=$(echo "$import_line" | sed "s/} from 'react';/, useEffect } from 'react';/")
          # Escape for sed
          escaped_old=$(echo "$import_line" | sed 's/[[\.*^$()+?{|]/\\&/g')
          escaped_new=$(echo "$new_import" | sed 's/[[\.*^$()+?{|]/\\&/g')
          sed -i '' "s/$escaped_old/$escaped_new/" "$file"
          echo "Fixed: $file"
        elif echo "$import_line" | grep -q "^import React"; then
          # Default import like: import React from 'react';
          sed -i '' "s/^import React from 'react';/import React, { useEffect } from 'react';/" "$file"
          echo "Fixed: $file"
        fi
      fi
    else
      # No React import found, add one
      sed -i '' "1i\\
import { useEffect } from 'react';\\
" "$file"
      echo "Added import to: $file"
    fi
  fi
done