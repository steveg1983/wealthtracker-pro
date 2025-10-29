import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

export default function SimpleApp() {
  console.log('SimpleApp rendering');
  
  return (
    <Router>
      <div style={{ padding: '20px' }}>
        <h1>Simple App Test</h1>
        <Routes>
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </div>
    </Router>
  );
}