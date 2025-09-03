// React compatibility polyfill for production builds
// This ensures React is available globally if needed

import React from 'react';

// Make React available globally if it's not already
if (typeof window !== 'undefined' && !(window as any).React) {
  (window as any).React = React;
}

export {};