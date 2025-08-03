#!/usr/bin/env node

import { createServer } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function startServer() {
  try {
    console.log('Starting Vite server...');
    
    const server = await createServer({
      root: __dirname,
      server: {
        port: 8080,
        host: 'localhost',
        strictPort: false
      }
    });
    
    await server.listen();
    
    console.log(`
✅ Server is running at http://localhost:${server.config.server.port}
    `);
    
    // Keep the process alive
    process.on('SIGINT', async () => {
      console.log('\nShutting down server...');
      await server.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();