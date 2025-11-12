#!/bin/bash
# Development server starter with proper .env.local loading
# This ensures .env.local takes precedence over system environment variables

# Load .env.local and export all VITE_ variables
if [ -f .env.local ]; then
  echo "Loading environment variables from .env.local..."
  export $(grep -v '^#' .env.local | grep 'VITE_' | xargs)
fi

# Start Vite dev server directly (not via npm to avoid loop)
npx vite
