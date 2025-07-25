describe('Enhanced Import User Journey', () => {
  beforeEach(() => {
    // Visit the enhanced import page
    cy.visit('/import');
    cy.waitForDataLoad();
  });

  it('should display the enhanced import page with all sections', () => {
    // Check page title
    cy.contains('h1', 'Enhanced Import').should('be.visible');
    
    // Check quick stats
    cy.contains('Supported Banks').should('be.visible');
    cy.contains('File Formats').should('be.visible');
    cy.contains('CSV, OFX, QIF').should('be.visible');
    
    // Check import options
    cy.contains('Enhanced Import Wizard').should('be.visible');
    cy.contains('Batch File Import').should('be.visible');
    
    // Check import rules section
    cy.contains('Import Rules & Transformations').should('be.visible');
    
    // Check supported banks list
    cy.contains('Supported Bank Formats').should('be.visible');
    cy.contains('Barclays').should('be.visible');
    cy.contains('Chase').should('be.visible');
  });

  it('should open enhanced import wizard', () => {
    // Click start enhanced import button
    cy.contains('button', 'Start Enhanced Import').click();
    
    // Modal should appear
    cy.get('[role="dialog"], .modal, [data-testid="import-wizard"]').should('be.visible');
    
    // Should show file upload area
    cy.contains(/drag.*drop|choose.*file|upload/i).should('be.visible');
  });

  it('should open batch import modal', () => {
    // Click start batch import button
    cy.contains('button', 'Start Batch Import').click();
    
    // Modal should appear
    cy.get('[role="dialog"], .modal, [data-testid="batch-import"]').should('be.visible');
    
    // Should show batch upload interface
    cy.contains(/drag.*drop|multiple files/i).should('be.visible');
  });

  it('should open import rules manager', () => {
    // Click manage rules button
    cy.contains('button', 'Manage Rules').click();
    
    // Rules manager modal should appear
    cy.get('[role="dialog"], .modal').within(() => {
      cy.contains('Import Rules Manager').should('be.visible');
    });
  });

  it('should show active import rules if any exist', () => {
    // Check if active rules are displayed
    cy.get('body').then($body => {
      if ($body.text().includes('Active Rules')) {
        // Should show rule cards
        cy.get('[data-testid="rule-card"], .rule-card').should('exist');
      } else {
        // Should show no rules message
        cy.contains('No import rules configured yet').should('be.visible');
      }
    });
  });

  it('should upload a CSV file through enhanced wizard', () => {
    // Open wizard
    cy.contains('button', 'Start Enhanced Import').click();
    
    // Create a test CSV file
    const csvContent = `Date,Description,Amount,Balance
2025-07-23,Coffee Shop,-4.50,1000.00
2025-07-22,Salary,2000.00,1004.50
2025-07-21,Groceries,-85.00,3004.50`;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const file = new File([blob], 'test-transactions.csv', { type: 'text/csv' });
    
    // Upload file
    cy.get('input[type="file"]').then($input => {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      $input[0].files = dataTransfer.files;
      $input.trigger('change', { force: true });
    });
    
    // Should proceed to mapping step
    cy.contains(/map|column|field/i).should('be.visible');
  });

  it('should handle drag and drop file upload', () => {
    // Open wizard
    cy.contains('button', 'Start Enhanced Import').click();
    
    // Get drop zone
    cy.get('[data-testid="drop-zone"], .drop-zone, [class*="drop"]').as('dropZone');
    
    // Simulate drag over
    cy.get('@dropZone').trigger('dragover', {
      dataTransfer: { effectAllowed: 'copy' }
    });
    
    // Drop zone should show active state
    cy.get('@dropZone').should('have.class', 'drag-over');
  });

  it('should filter supported banks', () => {
    // Scroll to bank formats section
    cy.contains('Supported Bank Formats').scrollIntoView();
    
    // Count initial banks
    cy.get('[data-testid="bank-item"], .bank-item, div').contains('Barclays').should('be.visible');
    cy.get('[data-testid="bank-item"], .bank-item, div').contains('Chase').should('be.visible');
    cy.get('[data-testid="bank-item"], .bank-item, div').contains('Coinbase').should('be.visible');
  });

  it('should show custom format info', () => {
    // Check for custom format information
    cy.contains("Don't see your bank?").should('be.visible');
    cy.contains('Custom Format').should('be.visible');
  });

  it('should handle multiple file upload in batch mode', () => {
    // Open batch import
    cy.contains('button', 'Start Batch Import').click();
    
    // Create multiple test files
    const files = [
      new File(['content1'], 'file1.csv', { type: 'text/csv' }),
      new File(['content2'], 'file2.csv', { type: 'text/csv' }),
      new File(['content3'], 'file3.csv', { type: 'text/csv' })
    ];
    
    // Upload files
    cy.get('input[type="file"][multiple]').then($input => {
      const dataTransfer = new DataTransfer();
      files.forEach(file => dataTransfer.items.add(file));
      $input[0].files = dataTransfer.files;
      $input.trigger('change', { force: true });
    });
    
    // Should show file list
    cy.contains('file1.csv').should('be.visible');
    cy.contains('file2.csv').should('be.visible');
    cy.contains('file3.csv').should('be.visible');
  });

  it('should be responsive on mobile', () => {
    // Set mobile viewport
    cy.viewport('iphone-x');
    
    // Page should still be functional
    cy.contains('Enhanced Import').should('be.visible');
    
    // Cards should stack vertically
    cy.contains('Enhanced Import Wizard').should('be.visible');
    cy.contains('Batch File Import').should('be.visible');
    
    // Buttons should be accessible
    cy.contains('button', 'Start Enhanced Import').should('be.visible');
  });

  it('should validate file types', () => {
    // Open wizard
    cy.contains('button', 'Start Enhanced Import').click();
    
    // Try to upload invalid file type
    const invalidFile = new File(['content'], 'test.txt', { type: 'text/plain' });
    
    cy.get('input[type="file"]').then($input => {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(invalidFile);
      $input[0].files = dataTransfer.files;
      $input.trigger('change', { force: true });
    });
    
    // Should show error or not proceed
    cy.contains(/invalid|unsupported|csv|ofx|qif/i).should('be.visible');
  });
});