import { createServer } from 'vite';
import http from 'http';

console.log('Creating manual vite server...');

// First test: Can we create a basic HTTP server?
const testServer = http.createServer((req, res) => {
  res.end('Test server works');
});

testServer.listen(8081, '127.0.0.1', () => {
  console.log('✅ Basic HTTP server works on port 8081');
  testServer.close();
  
  // Now try vite
  startVite();
});

async function startVite() {
  try {
    console.log('\nCreating Vite server...');
    const vite = await createServer({
      server: {
        middlewareMode: false,
        host: '127.0.0.1',
        port: 8080
      },
      clearScreen: false
    });
    
    console.log('Vite server object created');
    console.log('httpServer exists?', !!vite.httpServer);
    
    // Try to start the server
    await vite.listen();
    
    console.log('vite.listen() completed');
    console.log('httpServer exists after listen?', !!vite.httpServer);
    
    if (vite.httpServer) {
      const addr = vite.httpServer.address();
      console.log('Server address:', addr);
      
      // Try to make a request
      setTimeout(() => {
        http.get('http://127.0.0.1:8080/', (res) => {
          console.log('✅ Successfully connected to Vite server!');
          process.exit(0);
        }).on('error', (err) => {
          console.log('❌ Cannot connect to Vite server:', err.message);
          process.exit(1);
        });
      }, 1000);
    } else {
      console.log('❌ No httpServer created!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}