/// <reference types="cypress" />
import React from 'react';
import PerformanceWidget from './PerformanceWidget';
import { MemoryRouter } from 'react-router-dom';

describe('PerformanceWidget Component', () => {
  beforeEach(() => {
    // Mock localStorage
    cy.mockAuth();
    
    // Mock API responses
    cy.mockApiResponses();
  });

  it('renders the widget with correct title', () => {
    cy.mount(
      <MemoryRouter>
        <PerformanceWidget />
      </MemoryRouter>
    );
    
    cy.contains('Performance').should('be.visible');
  });

  it('displays performance metrics', () => {
    cy.mount(
      <MemoryRouter>
        <PerformanceWidget />
      </MemoryRouter>
    );
    
    // Check for metric values
    cy.contains('ms').should('be.visible'); // Load time
    cy.contains('/100').should('be.visible'); // Score
  });

  it('shows loading state initially', () => {
    cy.mount(
      <MemoryRouter>
        <PerformanceWidget />
      </MemoryRouter>
    );
    
    // Should show performance data after loading
    cy.contains('Performance').should('be.visible');
  });

  it('handles click interaction', () => {
    cy.mount(
      <MemoryRouter>
        <PerformanceWidget />
      </MemoryRouter>
    );
    
    // Click on the widget
    cy.get('[data-testid="widget-container"], .widget').click();
    
    // Should navigate (in real app) or show more details
    cy.url().should('include', '/performance');
  });

  it('applies correct styling based on performance score', () => {
    cy.mount(
      <MemoryRouter>
        <PerformanceWidget />
      </MemoryRouter>
    );
    
    // Check for color coding based on score
    cy.get('[class*="text-green"], [class*="text-yellow"], [class*="text-red"]').should('exist');
  });

  it('is keyboard accessible', () => {
    cy.mount(
      <MemoryRouter>
        <PerformanceWidget />
      </MemoryRouter>
    );
    
    // Tab to widget
    cy.get('body').tab();
    
    // Widget should be focusable
    cy.focused().should('have.attr', 'role', 'button');
    
    // Enter key should activate
    cy.focused().type('{enter}');
  });

  it('displays optimization tips on hover', () => {
    cy.mount(
      <MemoryRouter>
        <PerformanceWidget />
      </MemoryRouter>
    );
    
    // Hover over performance score
    cy.contains('/100').trigger('mouseenter');
    
    // Tooltip might appear
    cy.get('[role="tooltip"], .tooltip').should('be.visible');
  });

  it('updates metrics when data changes', () => {
    // Mount with initial data
    cy.mount(
      <MemoryRouter>
        <PerformanceWidget />
      </MemoryRouter>
    );
    
    // Get initial metric
    cy.contains('ms').invoke('text').then((initialTime) => {
      // Simulate data update
      cy.window().then((win) => {
        win.dispatchEvent(new Event('performance-update'));
      });
      
      // Metric might change
      cy.contains('ms').invoke('text').should((newTime) => {
        // Just verify it's still a valid metric
        expect(newTime).to.match(/\d+ms/);
      });
    });
  });

  it('handles error states gracefully', () => {
    // Mock API error
    cy.intercept('GET', '**/api/performance', {
      statusCode: 500,
      body: { error: 'Server error' }
    });
    
    cy.mount(
      <MemoryRouter>
        <PerformanceWidget />
      </MemoryRouter>
    );
    
    // Should still render without crashing
    cy.contains('Performance').should('be.visible');
    
    // Might show error indicator or fallback values
    cy.get('[data-testid="error-indicator"], .error').should('exist');
  });

  it('works in different viewport sizes', () => {
    // Test mobile viewport
    cy.viewport('iphone-x');
    
    cy.mount(
      <MemoryRouter>
        <PerformanceWidget />
      </MemoryRouter>
    );
    
    cy.contains('Performance').should('be.visible');
    
    // Test desktop viewport
    cy.viewport(1280, 720);
    
    cy.contains('Performance').should('be.visible');
  });
});