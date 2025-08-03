const net = require('net');
const http = require('http');

console.log('=== FINAL DIAGNOSTIC ===\n');

// Test 1: Raw TCP server
const tcpServer = net.createServer();
tcpServer.listen(0, '127.0.0.1', () => {
  const { port } = tcpServer.address();
  console.log(`✅ TCP server on port ${port}`);
  
  // Can we connect to ourselves?
  const client = net.connect(port, '127.0.0.1', () => {
    console.log('✅ TCP client connected');
    client.end();
    tcpServer.close();
    
    // Test 2: HTTP server with request
    testHTTP();
  });
  
  client.on('error', err => {
    console.error('❌ TCP client error:', err.message);
    tcpServer.close();
  });
});

function testHTTP() {
  const server = http.createServer((req, res) => {
    res.end('OK');
  });
  
  server.listen(8080, '127.0.0.1', () => {
    console.log('\n✅ HTTP server on port 8080');
    
    // List all network interfaces
    const os = require('os');
    const interfaces = os.networkInterfaces();
    console.log('\nNetwork interfaces:');
    Object.keys(interfaces).forEach(name => {
      interfaces[name].forEach(iface => {
        if (iface.family === 'IPv4') {
          console.log(`  ${name}: ${iface.address}`);
        }
      });
    });
    
    // Try to connect
    const req = http.get('http://127.0.0.1:8080', res => {
      console.log('\n✅ HTTP request successful');
      server.close();
      
      // Test 3: Check if something is intercepting
      testInterception();
    });
    
    req.on('error', err => {
      console.error('\n❌ HTTP request failed:', err.message);
      
      // Check if we can at least see the socket
      const sock = net.connect(8080, '127.0.0.1');
      sock.on('connect', () => {
        console.log('✅ Raw socket connected to port 8080');
        sock.end();
        server.close();
      });
      sock.on('error', err => {
        console.error('❌ Raw socket failed:', err.message);
        server.close();
      });
    });
  });
  
  server.on('error', err => {
    console.error('❌ HTTP server error:', err.message);
  });
}

function testInterception() {
  console.log('\nChecking for proxy/VPN:');
  console.log('HTTP_PROXY:', process.env.HTTP_PROXY || 'not set');
  console.log('HTTPS_PROXY:', process.env.HTTPS_PROXY || 'not set');
  console.log('NO_PROXY:', process.env.NO_PROXY || 'not set');
  
  console.log('\nProcess info:');
  console.log('PID:', process.pid);
  console.log('Node:', process.version);
  console.log('Platform:', process.platform);
  console.log('Arch:', process.arch);
}