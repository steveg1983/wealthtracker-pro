import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { logger } from './services/loggingService';

// Minimal app for Safari testing
function SimpleApp() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Wealth Tracker - Safari Test</h1>
      <p>If you can see this, React is working in Safari!</p>
      <p>Browser: {navigator.userAgent}</p>
      <button onClick={() => alert('Button clicked!')}>Test Button</button>
    </div>
  );
}

// Simple error handling
window.addEventListener('error', (e) => {
  logger.error('Error:', e);
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'color: red; padding: 20px;';
  errorDiv.textContent = `Error: ${e.message}`;
  document.body.innerHTML = '';
  document.body.appendChild(errorDiv);
});

// Try to render
try {
  const root = document.getElementById('root');
  if (root) {
    createRoot(root).render(
      <StrictMode>
        <SimpleApp />
      </StrictMode>
    );
  } else {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'color: red; padding: 20px;';
    errorDiv.textContent = 'Root element not found';
    document.body.appendChild(errorDiv);
  }
} catch (error) {
  logger.error('Render error:', error);
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'color: red; padding: 20px;';
  errorDiv.textContent = `Render error: ${error}`;
  document.body.innerHTML = '';
  document.body.appendChild(errorDiv);
}