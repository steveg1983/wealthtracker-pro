import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { logger } from './services/loggingService';

export default function SimpleApp() {
  logger.debug('SimpleApp rendering');
  
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
