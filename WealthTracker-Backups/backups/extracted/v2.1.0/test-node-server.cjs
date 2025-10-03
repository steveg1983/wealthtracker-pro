const net = require('net');
const http = require('http');

console.log('Testing Node.js network capabilities...\n');

// Test 1: Can we create a TCP server?
console.log('Test 1: Creating TCP server...');
const tcpServer = net.createServer();

tcpServer.on('error', (err) => {
  console.error('❌ TCP Server Error:', err.message);
  console.error('Error code:', err.code);
  console.error('Error details:', err);
});

tcpServer.listen(0, '127.0.0.1', () => {
  const { port } = tcpServer.address();
  console.log(`✅ TCP server listening on port ${port}`);
  tcpServer.close();
  
  // Test 2: Can we create an HTTP server?
  console.log('\nTest 2: Creating HTTP server...');
  const httpServer = http.createServer((req, res) => {
    res.end('Hello');
  });
  
  httpServer.on('error', (err) => {
    console.error('❌ HTTP Server Error:', err.message);
    console.error('Error code:', err.code);
    console.error('Error details:', err);
    process.exit(1);
  });
  
  httpServer.listen(0, '127.0.0.1', () => {
    const { port } = httpServer.address();
    console.log(`✅ HTTP server listening on port ${port}`);
    
    // Test 3: Can we connect to it?
    console.log('\nTest 3: Testing HTTP connection...');
    http.get(`http://127.0.0.1:${port}`, (res) => {
      console.log('✅ Successfully connected to HTTP server');
      httpServer.close();
      
      // Test 4: Can we bind to specific ports?
      console.log('\nTest 4: Binding to port 8080...');
      const testServer = http.createServer();
      testServer.on('error', (err) => {
        console.error('❌ Cannot bind to port 8080:', err.message);
        process.exit(1);
      });
      
      testServer.listen(8080, '127.0.0.1', () => {
        console.log('✅ Successfully bound to port 8080');
        testServer.close();
        console.log('\n✅ All tests passed! Node.js networking is working.');
        process.exit(0);
      });
    }).on('error', (err) => {
      console.error('❌ Cannot connect to HTTP server:', err.message);
      process.exit(1);
    });
  });
});