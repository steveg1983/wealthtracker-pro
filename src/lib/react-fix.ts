// Production fix for React bundling issues
// This ensures React is available globally for libraries that expect it
import * as React from 'react';
import * as ReactDOM from 'react-dom';

// Make React available globally in production
if (typeof window !== 'undefined') {
  (window as any).React = React;
  (window as any).ReactDOM = ReactDOM;
}

export { React, ReactDOM };