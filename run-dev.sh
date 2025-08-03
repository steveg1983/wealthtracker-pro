#!/bin/bash

echo "🔧 Setting up development environment..."

# Kill any existing processes on port 8080
lsof -ti:8080 | xargs kill -9 2>/dev/null || true

# Kill any existing vite processes
pkill -f vite 2>/dev/null || true

# Clear vite cache
rm -rf node_modules/.vite 2>/dev/null || true

echo "✅ Environment cleaned"
echo "🚀 Starting development server..."

# Use the direct node command that we know works
node -e "
import { createServer } from 'vite';

(async () => {
  const server = await createServer({
    server: {
      host: 'localhost',
      port: 8080,
      strictPort: false
    }
  });
  
  await server.listen();
  
  console.log('\n✅ Dev server is running at http://localhost:8080\n');
  console.log('Press Ctrl+C to stop\n');
})();
"