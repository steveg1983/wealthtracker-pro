#!/usr/bin/env node

import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function startServer() {
  try {
    console.log('Starting Vite development server...');
    
    // Create Vite server
    const vite = await createViteServer({
      root: __dirname,
      server: {
        host: true, // This allows external connections
        port: 8080,
        strictPort: false,
        open: false
      },
      clearScreen: false
    });
    
    // Start listening
    await vite.listen();
    
    const info = vite.config.server;
    const port = vite.config.server.port || 8080;
    
    console.log('\n✅ Dev server is running!');
    console.log(`\n  ➜  Local:   http://localhost:${port}/`);
    console.log(`  ➜  Network: http://127.0.0.1:${port}/`);
    console.log('\n  Press Ctrl+C to stop\n');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down server...');
      await vite.close();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      await vite.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();