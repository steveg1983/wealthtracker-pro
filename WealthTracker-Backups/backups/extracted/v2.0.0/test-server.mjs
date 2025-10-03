import { createServer } from 'http';

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<h1>Test Server Working!</h1><p>If you can see this, basic HTTP is working.</p>');
});

server.listen(8080, () => {
  console.log('Test server running at http://localhost:8080/');
});