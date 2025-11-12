import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { createScopedLogger } from './loggers/scopedLogger';

const simpleAppLogger = createScopedLogger('SimpleApp');

export default function SimpleApp() {
  simpleAppLogger.info('Rendering SimpleApp');
  
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
