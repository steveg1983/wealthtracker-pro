#!/usr/bin/env node

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createServer() {
  const app = express();
  const port = 8080;
  
  // Create Vite server in middleware mode
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
    root: __dirname
  });
  
  // Use vite's connect instance as middleware
  app.use(vite.middlewares);
  
  // Start the server
  const server = app.listen(port, '127.0.0.1', () => {
    console.log(`✅ Dev server is running at http://localhost:${port}`);
    console.log('Press Ctrl+C to stop\n');
  });
  
  server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
  });
  
  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await vite.close();
    server.close();
    process.exit(0);
  });
}

createServer().catch(err => {
  console.error('Error starting server:', err);
  process.exit(1);
});