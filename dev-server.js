#!/usr/bin/env node

import { createServer } from 'vite';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function startDevServer() {
  try {
    const server = await createServer({
      root: __dirname,
      server: {
        host: 'localhost',
        port: 8080,
        strictPort: false,
        middlewareMode: false
      },
      clearScreen: false
    });
    
    await server.listen();
    
    // Wait a moment to ensure the server is fully ready
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify the server is actually listening
    if (server.httpServer) {
      const addr = server.httpServer.address();
      if (addr) {
        console.log(`
  ✅ Dev server is running at http://localhost:${addr.port}
  ➜  Press Ctrl+C to stop
        `);
      } else {
        throw new Error('Server failed to bind to port');
      }
    } else {
      throw new Error('HTTP server was not created');
    }
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down dev server...');
      await server.close();
      process.exit(0);
    });
    
    // Keep the process alive
    process.stdin.resume();
    
  } catch (error) {
    console.error('Failed to start dev server:', error);
    process.exit(1);
  }
}

// Start the server
console.log('Starting Vite dev server...');
startDevServer();