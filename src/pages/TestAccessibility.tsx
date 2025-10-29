import React from 'react';
import PageWrapper from '../components/PageWrapper';

/**
 * Test page with various accessibility issues for testing the audit tool
 */
export default function TestAccessibility(): React.JSX.Element {
  return (
    <PageWrapper title="Test Accessibility Page">
      <div className="space-y-6">
        {/* Image without alt text */}
        <img src="/test-image.jpg" />
        
        {/* Button without label */}
        <button className="p-2">
          <svg width="20" height="20"><circle cx="10" cy="10" r="5" /></svg>
        </button>
        
        {/* Form without labels */}
        <form>
          <input type="text" placeholder="Name" className="border p-2" />
          <input type="email" placeholder="Email" className="border p-2 ml-2" />
        </form>
        
        {/* Low contrast text */}
        <p style={{ color: '#cccccc' }}>This text has low contrast</p>
        
        {/* Missing heading hierarchy */}
        <h1>Main Title</h1>
        <h3>Skipped H2</h3>
        
        {/* Link without text */}
        <a href="/test"></a>
        
        {/* Table without headers */}
        <table className="border">
          <tr>
            <td>Data 1</td>
            <td>Data 2</td>
          </tr>
        </table>
        
        {/* Positive tabindex */}
        <button tabIndex={5}>Bad Tab Order</button>
      </div>
    </PageWrapper>
  );
}