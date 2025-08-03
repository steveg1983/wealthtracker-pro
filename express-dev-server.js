#!/usr/bin/env node

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createServer() {
  const app = express();
  
  // Create Vite server in middleware mode
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });
  
  // Use vite's connect instance as middleware
  app.use(vite.middlewares);
  
  const port = 8080;
  
  app.listen(port, () => {
    console.log(`✅ Dev server running at http://localhost:${port}`);
  });
}

createServer().catch(err => {
  console.error('Error starting server:', err);
  process.exit(1);
});