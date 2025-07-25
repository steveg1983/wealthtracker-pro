describe('Dashboard User Journey', () => {
  beforeEach(() => {
    // Visit the dashboard page
    cy.visit('/dashboard');
    cy.waitForDataLoad();
  });

  it('should display the dashboard with all key components', () => {
    // Check main heading
    cy.contains('h1', 'Dashboard').should('be.visible');
    
    // Check for presence of summary cards
    cy.get('[data-testid="summary-card"], .summary-card').should('have.length.at.least', 3);
    
    // Check for net worth display
    cy.contains(/net worth|total balance/i).should('be.visible');
    
    // Check for recent transactions section
    cy.contains(/recent transactions/i).should('be.visible');
    
    // Check for chart/graph presence
    cy.get('canvas, svg.chart, [data-testid="chart"]').should('exist');
  });

  it('should show loading states initially then display data', () => {
    // Fresh visit to catch loading states
    cy.visit('/dashboard');
    
    // Should show some loading indicator initially
    cy.get('[data-testid="loading"], .loading, .spinner, .skeleton').should('exist');
    
    // Loading should complete and data should appear
    cy.waitForDataLoad();
    
    // Verify data is displayed
    cy.get('[data-testid="summary-card"], .summary-card').should('be.visible');
  });

  it('should navigate to transactions page when clicking view all transactions', () => {
    // Find and click the view all transactions link/button
    cy.contains(/view all|see all|all transactions/i).click();
    
    // Should navigate to transactions page
    cy.url().should('include', '/transactions');
    
    // Transactions page should load
    cy.contains(/transactions/i).should('be.visible');
  });

  it('should navigate to accounts page when clicking on account card', () => {
    // Click on an account card or accounts section
    cy.contains(/accounts/i).first().click();
    
    // Should navigate to accounts page
    cy.url().should('include', '/accounts');
    
    // Accounts page should load
    cy.waitForDataLoad();
  });

  it('should show correct date range in charts', () => {
    // Check for date range selector or display
    cy.contains(/last 30 days|this month|date range/i).should('be.visible');
  });

  it('should handle empty state gracefully', () => {
    // This test would need backend support to clear data
    // For now, we'll just check that the page doesn't break with no data
    cy.visit('/dashboard');
    cy.waitForDataLoad();
    
    // Page should still be functional
    cy.contains('Dashboard').should('be.visible');
  });

  it('should be responsive on mobile viewport', () => {
    // Set mobile viewport
    cy.viewport('iphone-x');
    
    // Dashboard should still be functional
    cy.contains('Dashboard').should('be.visible');
    
    // Check that layout adapts
    cy.get('[data-testid="summary-card"], .summary-card').should('be.visible');
    
    // Mobile menu should be available
    cy.get('[data-testid="mobile-menu"], [aria-label="Menu"]').should('be.visible');
  });

  it('should update data when refreshing', () => {
    // Get initial value
    cy.get('[data-testid="net-worth"], .net-worth').first().invoke('text').then((initialValue) => {
      // Refresh the page
      cy.reload();
      cy.waitForDataLoad();
      
      // Check that dashboard still loads
      cy.contains('Dashboard').should('be.visible');
      
      // Net worth should be displayed (value might be same or different)
      cy.get('[data-testid="net-worth"], .net-worth').first().should('be.visible');
    });
  });

  it('should handle widget interactions', () => {
    // Find a widget
    cy.get('[data-testid*="widget"], .widget').first().as('widget');
    
    // Check widget is interactive
    cy.get('@widget').should('be.visible');
    
    // If widget has a button, it should be clickable
    cy.get('@widget').find('button').first().should('not.be.disabled');
  });

  it('should show proper loading states for async data', () => {
    cy.visit('/dashboard');
    
    // Intercept API calls to control timing
    cy.intercept('GET', '**/api/**', (req) => {
      req.reply((res) => {
        // Delay response to see loading states
        res.delay(1000);
      });
    }).as('apiCalls');
    
    // Should show loading states
    cy.get('[data-testid="loading"], .loading, .spinner, .skeleton').should('exist');
    
    // Wait for API calls to complete
    cy.wait('@apiCalls', { timeout: 15000 });
    
    // Loading states should be gone
    cy.get('[data-testid="loading"], .loading, .spinner, .skeleton').should('not.exist');
  });
});