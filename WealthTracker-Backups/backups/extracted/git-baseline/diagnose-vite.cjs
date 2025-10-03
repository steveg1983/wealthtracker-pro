const http = require('http');
const { spawn } = require('child_process');

console.log('Node version:', process.version);
console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);

// Test if we can create a basic HTTP server
const testServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Test server working\n');
});

testServer.listen(9999, '127.0.0.1', () => {
  console.log('✅ Basic HTTP server works on port 9999');
  testServer.close();
  
  // Now try vite
  console.log('\nTrying to start vite...');
  const vite = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', '5555'], {
    stdio: 'inherit'
  });
  
  setTimeout(() => {
    console.log('\nChecking if vite bound to port 5555...');
    const req = http.get('http://127.0.0.1:5555', (res) => {
      console.log('✅ Vite is accessible!');
      vite.kill();
      process.exit(0);
    });
    
    req.on('error', (err) => {
      console.log('❌ Vite is NOT accessible:', err.message);
      vite.kill();
      process.exit(1);
    });
  }, 3000);
});

testServer.on('error', (err) => {
  console.log('❌ Cannot create basic HTTP server:', err);
  process.exit(1);
});