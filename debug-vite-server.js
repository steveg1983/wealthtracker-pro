import { createServer } from 'vite';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Starting Vite debug server...');

async function startDebugServer() {
  try {
    const server = await createServer({
      root: __dirname,
      logLevel: 'info',
      server: {
        port: 8080,
        host: 'localhost',
        strictPort: true
      }
    });

    console.log('Vite server created, attempting to listen...');
    
    // Add event listeners before starting
    if (server.httpServer) {
      server.httpServer.on('listening', () => {
        const addr = server.httpServer.address();
        console.log(`✅ HTTP Server is listening on ${addr.address}:${addr.port}`);
      });
      
      server.httpServer.on('error', (err) => {
        console.error('❌ HTTP Server error:', err);
      });
    }
    
    await server.listen();
    
    console.log('✅ Vite server.listen() completed');
    console.log('Server config:', server.config.server);
    console.log('Resolved URLs:', server.resolvedUrls);
    
    // Check if the server is actually listening
    setTimeout(() => {
      if (server.httpServer) {
        const addr = server.httpServer.address();
        if (addr) {
          console.log(`\n✅ Server is actually listening on ${addr.address}:${addr.port}`);
        } else {
          console.log('❌ Server address is null - not listening!');
        }
      } else {
        console.log('❌ No httpServer object!');
      }
    }, 1000);
    
  } catch (error) {
    console.error('Failed to start server:', error);
  }
}

startDebugServer();