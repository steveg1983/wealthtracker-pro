import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

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
  console.error('Error:', e);
  document.body.innerHTML = `<div style="color: red; padding: 20px;">Error: ${e.message}</div>`;
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
    document.body.innerHTML = '<div style="color: red; padding: 20px;">Root element not found</div>';
  }
} catch (error) {
  console.error('Render error:', error);
  document.body.innerHTML = `<div style="color: red; padding: 20px;">Render error: ${error}</div>`;
}