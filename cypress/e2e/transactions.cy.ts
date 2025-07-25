describe('Transaction Management User Journey', () => {
  beforeEach(() => {
    // Visit transactions page
    cy.visit('/transactions');
    cy.waitForDataLoad();
  });

  it('should display the transactions page with key elements', () => {
    // Check page title
    cy.contains('h1', /transactions/i).should('be.visible');
    
    // Check for add transaction button
    cy.contains('button', /add transaction/i).should('be.visible');
    
    // Check for transaction list or empty state
    cy.get('[data-testid="transaction-list"], .transaction-list, [data-testid="empty-state"]').should('exist');
    
    // Check for filter/search options
    cy.get('input[placeholder*="search"], [data-testid="search-input"]').should('be.visible');
  });

  it('should open add transaction modal when clicking add button', () => {
    // Click add transaction button
    cy.contains('button', /add transaction/i).click();
    
    // Modal should appear
    cy.get('[role="dialog"], .modal, [data-testid="transaction-modal"]').should('be.visible');
    
    // Form fields should be present
    cy.get('input[name="description"], input[placeholder*="description"]').should('be.visible');
    cy.get('input[name="amount"], input[placeholder*="amount"]').should('be.visible');
    cy.get('input[type="date"]').should('be.visible');
  });

  it('should create a new expense transaction', () => {
    // Click add transaction
    cy.contains('button', /add transaction/i).click();
    
    // Fill in the form
    const transactionData = {
      description: 'Coffee Shop Test',
      amount: '4.50',
      date: '2025-07-23',
      category: 'Food & Dining'
    };
    
    cy.get('input[name="description"], input[placeholder*="description"]').type(transactionData.description);
    cy.get('input[name="amount"], input[placeholder*="amount"]').type(transactionData.amount);
    cy.get('input[type="date"]').clear().type(transactionData.date);
    
    // Select category if dropdown exists
    cy.get('select[name="category"], [data-testid="category-select"]').then($el => {
      if ($el.length) {
        cy.wrap($el).select(transactionData.category);
      }
    });
    
    // Submit the form
    cy.get('button[type="submit"]').contains(/save|add|create/i).click();
    
    // Transaction should appear in the list
    cy.contains(transactionData.description).should('be.visible');
    cy.contains(`$${transactionData.amount}`).should('be.visible');
  });

  it('should create a new income transaction', () => {
    // Click add transaction
    cy.contains('button', /add transaction/i).click();
    
    // Switch to income if there's a toggle
    cy.get('button').contains(/income/i).click();
    
    // Fill in the form
    const incomeData = {
      description: 'Freelance Payment',
      amount: '500.00',
      date: '2025-07-23'
    };
    
    cy.get('input[name="description"], input[placeholder*="description"]').type(incomeData.description);
    cy.get('input[name="amount"], input[placeholder*="amount"]').type(incomeData.amount);
    cy.get('input[type="date"]').clear().type(incomeData.date);
    
    // Submit
    cy.get('button[type="submit"]').contains(/save|add|create/i).click();
    
    // Income should appear
    cy.contains(incomeData.description).should('be.visible');
  });

  it('should edit an existing transaction', () => {
    // Find a transaction row
    cy.get('[data-testid="transaction-row"], .transaction-row, tr').first().as('transaction');
    
    // Click edit button
    cy.get('@transaction').find('button[aria-label*="edit"], button').contains(/edit/i).click();
    
    // Edit form should appear
    cy.get('[role="dialog"], .modal, [data-testid="transaction-modal"]').should('be.visible');
    
    // Modify description
    cy.get('input[name="description"], input[placeholder*="description"]')
      .clear()
      .type('Updated Transaction Description');
    
    // Save changes
    cy.get('button[type="submit"]').contains(/save|update/i).click();
    
    // Updated transaction should be visible
    cy.contains('Updated Transaction Description').should('be.visible');
  });

  it('should delete a transaction', () => {
    // Get the first transaction
    cy.get('[data-testid="transaction-row"], .transaction-row, tr').first().as('transaction');
    
    // Get the transaction description to verify deletion
    cy.get('@transaction').find('[data-testid="description"], td').first().invoke('text').then((description) => {
      // Click delete button
      cy.get('@transaction').find('button[aria-label*="delete"], button').contains(/delete/i).click();
      
      // Confirm deletion if there's a confirmation dialog
      cy.get('button').contains(/confirm|yes|delete/i).click();
      
      // Transaction should be removed
      cy.contains(description).should('not.exist');
    });
  });

  it('should filter transactions by search term', () => {
    // Type in search box
    cy.get('input[placeholder*="search"], [data-testid="search-input"]').type('coffee');
    
    // Should show filtered results
    cy.get('[data-testid="transaction-row"], .transaction-row, tr').should('have.length.greaterThan', 0);
    
    // Clear search
    cy.get('input[placeholder*="search"], [data-testid="search-input"]').clear();
  });

  it('should filter transactions by date range', () => {
    // Look for date filter
    cy.get('[data-testid="date-filter"], select[name="dateRange"], button').contains(/date|period|range/i).click();
    
    // Select a date range option
    cy.contains(/last 30 days|this month/i).click();
    
    // Transactions should be filtered
    cy.waitForDataLoad();
  });

  it('should sort transactions', () => {
    // Click on a sortable column header
    cy.get('th').contains(/date|amount/i).click();
    
    // Wait for sort to apply
    cy.wait(500);
    
    // Click again to reverse sort
    cy.get('th').contains(/date|amount/i).click();
  });

  it('should handle empty state', () => {
    // Search for something that doesn't exist
    cy.get('input[placeholder*="search"], [data-testid="search-input"]').type('xyznonexistentxyz');
    
    // Should show empty state
    cy.contains(/no transactions|no results|empty/i).should('be.visible');
  });

  it('should paginate through transactions', () => {
    // Check if pagination exists
    cy.get('[data-testid="pagination"], .pagination, nav[aria-label="pagination"]').then($pagination => {
      if ($pagination.length) {
        // Click next page
        cy.get('button').contains(/next|→/i).click();
        
        // Wait for new data
        cy.waitForDataLoad();
        
        // Should show different transactions
        cy.get('[data-testid="transaction-row"], .transaction-row, tr').should('exist');
      }
    });
  });

  it('should bulk select and delete transactions', () => {
    // Check if bulk selection is available
    cy.get('input[type="checkbox"]').then($checkboxes => {
      if ($checkboxes.length > 1) {
        // Select first few transactions
        cy.get('input[type="checkbox"]').eq(1).check();
        cy.get('input[type="checkbox"]').eq(2).check();
        
        // Bulk actions should appear
        cy.contains(/bulk|selected/i).should('be.visible');
        
        // Click bulk delete
        cy.get('button').contains(/delete selected/i).click();
        
        // Confirm
        cy.get('button').contains(/confirm|yes/i).click();
        
        // Transactions should be deleted
        cy.waitForDataLoad();
      }
    });
  });

  it('should export transactions', () => {
    // Look for export button
    cy.get('button').contains(/export|download/i).then($button => {
      if ($button.length) {
        cy.wrap($button).click();
        
        // Export options should appear
        cy.contains(/csv|excel|pdf/i).should('be.visible');
      }
    });
  });
});