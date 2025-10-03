/**
 * Modal Component Tests
 * Comprehensive tests for the Modal component with accessibility and focus management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal, ModalBody, ModalFooter } from './Modal';

describe('Modal', () => {
  const mockOnClose = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Ensure body overflow is reset
    document.body.style.overflow = '';
  });

  describe('basic rendering', () => {
    it('renders nothing when closed', () => {
      const { container } = render(
        <Modal isOpen={false} onClose={mockOnClose} title="Test Modal">
          Modal content
        </Modal>
      );
      
      expect(container.firstChild).toBeNull();
    });

    it('renders modal when open', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          Modal content
        </Modal>
      );
      
      expect(screen.getByRole('dialog', { hidden: true })).toBeInTheDocument();
      expect(screen.getByText('Test Modal')).toBeInTheDocument();
      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });

    it('renders title in header', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="My Title">
          Content
        </Modal>
      );
      
      const title = screen.getByText('My Title');
      expect(title.tagName).toBe('H2');
      expect(title).toHaveAttribute('id', 'modal-title');
    });

    it('shows close button by default', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test">
          Content
        </Modal>
      );
      
      const closeButton = screen.getByLabelText('Close modal');
      expect(closeButton).toBeInTheDocument();
    });

    it('hides close button when showCloseButton is false', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test" showCloseButton={false}>
          Content
        </Modal>
      );
      
      expect(screen.queryByLabelText('Close modal')).not.toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('applies small size', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Small" size="sm">
          Content
        </Modal>
      );
      
      const modal = screen.getByRole('dialog', { hidden: true });
      expect(modal.className).toContain('max-w-sm');
    });

    it('applies medium size by default', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Medium">
          Content
        </Modal>
      );
      
      const modal = screen.getByRole('dialog', { hidden: true });
      expect(modal.className).toContain('max-w-md');
    });

    it('applies large size', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Large" size="lg">
          Content
        </Modal>
      );
      
      const modal = screen.getByRole('dialog', { hidden: true });
      expect(modal.className).toContain('max-w-lg');
    });

    it('applies extra large size', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="XL" size="xl">
          Content
        </Modal>
      );
      
      const modal = screen.getByRole('dialog', { hidden: true });
      expect(modal.className).toContain('max-w-xl');
    });

    it('applies full size', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Full" size="full">
          Content
        </Modal>
      );
      
      const modal = screen.getByRole('dialog', { hidden: true });
      expect(modal.className).toContain('max-w-full');
      expect(modal.className).toContain('mx-4');
    });
  });

  describe('closing behavior', () => {
    it('calls onClose when close button is clicked', async () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test">
          Content
        </Modal>
      );
      
      const closeButton = screen.getByLabelText('Close modal');
      await userEvent.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test">
          Content
        </Modal>
      );
      
      const backdrop = screen.getByRole('dialog', { hidden: true }).parentElement;
      fireEvent.click(backdrop!);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when modal content is clicked', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test">
          <div>Click me</div>
        </Modal>
      );
      
      const content = screen.getByText('Click me');
      fireEvent.click(content);
      
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('closes when Escape key is pressed', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test">
          Content
        </Modal>
      );
      
      fireEvent.keyDown(document, { key: 'Escape' });
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('focus management', () => {
    it('focuses modal when opened', async () => {
      const { rerender } = render(
        <Modal isOpen={false} onClose={mockOnClose} title="Test">
          Content
        </Modal>
      );
      
      rerender(
        <Modal isOpen={true} onClose={mockOnClose} title="Test">
          Content
        </Modal>
      );
      
      await waitFor(() => {
        const modal = screen.getByRole('dialog', { hidden: true });
        expect(document.activeElement).toBe(modal);
      });
    });

    it('restores focus to previous element when closed', async () => {
      const button = document.createElement('button');
      button.textContent = 'Open Modal';
      document.body.appendChild(button);
      button.focus();
      
      const { rerender } = render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test">
          Content
        </Modal>
      );
      
      rerender(
        <Modal isOpen={false} onClose={mockOnClose} title="Test">
          Content
        </Modal>
      );
      
      await waitFor(() => {
        expect(document.activeElement).toBe(button);
      });
      
      document.body.removeChild(button);
    });

    it('traps focus within modal', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test">
          <div>
            <button>First button</button>
            <input type="text" placeholder="Input field" />
            <button>Last button</button>
          </div>
        </Modal>
      );
      
      const closeButton = screen.getByLabelText('Close modal');
      const firstButton = screen.getByText('First button');
      const lastButton = screen.getByText('Last button');
      
      // Focus last button and press Tab
      lastButton.focus();
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: false });
      
      // Should wrap to first focusable element (which is the close button)
      expect(document.activeElement).toBe(closeButton);
      
      // Focus close button and press Shift+Tab
      closeButton.focus();
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
      
      // Should wrap to last focusable element
      expect(document.activeElement).toBe(lastButton);
    });
  });

  describe('body scroll behavior', () => {
    it('prevents body scroll when modal is open', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test">
          Content
        </Modal>
      );
      
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores body scroll when modal is closed', () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test">
          Content
        </Modal>
      );
      
      expect(document.body.style.overflow).toBe('hidden');
      
      rerender(
        <Modal isOpen={false} onClose={mockOnClose} title="Test">
          Content
        </Modal>
      );
      
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('accessibility', () => {
    it('has correct ARIA attributes', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          Content
        </Modal>
      );
      
      const modal = screen.getByRole('dialog', { hidden: true });
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-labelledby', 'modal-title');
      expect(modal).toHaveAttribute('tabIndex', '-1');
    });

    it('supports aria-describedby', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test" ariaDescribedBy="description">
          <p id="description">This is a description</p>
        </Modal>
      );
      
      const modal = screen.getByRole('dialog', { hidden: true });
      expect(modal).toHaveAttribute('aria-describedby', 'description');
    });

    it('has backdrop that is accessible', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test">
          Content
        </Modal>
      );
      
      const backdrop = screen.getByRole('dialog').parentElement;
      // Backdrop should NOT have aria-hidden since it contains the accessible dialog
      expect(backdrop).not.toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('lifecycle', () => {
    it('cleans up event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      
      const { unmount } = render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test">
          Content
        </Modal>
      );
      
      unmount();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(2); // Tab handler and Escape handler
      
      removeEventListenerSpy.mockRestore();
    });

    it('updates event listeners when isOpen changes', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      
      const { rerender } = render(
        <Modal isOpen={false} onClose={mockOnClose} title="Test">
          Content
        </Modal>
      );
      
      // Open modal
      rerender(
        <Modal isOpen={true} onClose={mockOnClose} title="Test">
          Content
        </Modal>
      );
      
      expect(addEventListenerSpy).toHaveBeenCalled();
      
      // Close modal
      rerender(
        <Modal isOpen={false} onClose={mockOnClose} title="Test">
          Content
        </Modal>
      );
      
      expect(removeEventListenerSpy).toHaveBeenCalled();
      
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });
});

describe('ModalBody', () => {
  it('renders children with default padding', () => {
    const { container } = render(
      <ModalBody>
        Body content
      </ModalBody>
    );
    
    const body = container.firstChild;
    expect(body?.className).toContain('p-4');
    expect(body?.className).toContain('sm:p-6');
  });

  it('applies custom className', () => {
    const { container } = render(
      <ModalBody className="custom-body">
        Body content
      </ModalBody>
    );
    
    const body = container.firstChild;
    expect(body?.className).toContain('custom-body');
    expect(body?.className).toContain('p-4');
  });

  it('renders complex children', () => {
    render(
      <ModalBody>
        <h3>Title</h3>
        <p>Paragraph</p>
        <form>
          <input type="text" />
        </form>
      </ModalBody>
    );
    
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Paragraph')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});

describe('ModalFooter', () => {
  it('renders children with border and padding', () => {
    const { container } = render(
      <ModalFooter>
        Footer content
      </ModalFooter>
    );
    
    const footer = container.firstChild;
    expect(footer?.className).toContain('p-4');
    expect(footer?.className).toContain('sm:p-6');
    expect(footer?.className).toContain('border-t');
    expect(footer?.className).toContain('border-gray-200');
  });

  it('applies custom className', () => {
    const { container } = render(
      <ModalFooter className="justify-end">
        Footer content
      </ModalFooter>
    );
    
    const footer = container.firstChild;
    expect(footer?.className).toContain('justify-end');
    expect(footer?.className).toContain('border-t');
  });

  it('renders action buttons', () => {
    render(
      <ModalFooter>
        <button>Cancel</button>
        <button>Save</button>
      </ModalFooter>
    );
    
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });
});

describe('Modal composition', () => {
  const mockOnClose = vi.fn();
  it('works with ModalBody and ModalFooter', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Complete Modal">
        <ModalBody>
          <p>This is the modal body content</p>
        </ModalBody>
        <ModalFooter>
          <button onClick={mockOnClose}>Cancel</button>
          <button>Confirm</button>
        </ModalFooter>
      </Modal>
    );
    
    expect(screen.getByText('Complete Modal')).toBeInTheDocument();
    expect(screen.getByText('This is the modal body content')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });

  it('handles form submission within modal', async () => {
    const handleSubmit = vi.fn((e) => e.preventDefault());
    
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Form Modal">
        <form onSubmit={handleSubmit}>
          <ModalBody>
            <input type="text" placeholder="Enter name" />
          </ModalBody>
          <ModalFooter>
            <button type="button" onClick={mockOnClose}>Cancel</button>
            <button type="submit">Submit</button>
          </ModalFooter>
        </form>
      </Modal>
    );
    
    const submitButton = screen.getByText('Submit');
    await userEvent.click(submitButton);
    
    expect(handleSubmit).toHaveBeenCalled();
  });
});

describe('real-world scenarios', () => {
  const mockOnClose = vi.fn();
  it('works as a confirmation dialog', async () => {
    const handleConfirm = vi.fn();
    
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Confirm Delete" size="sm">
        <ModalBody>
          <p>Are you sure you want to delete this item?</p>
        </ModalBody>
        <ModalFooter className="flex justify-end gap-2">
          <button onClick={mockOnClose}>Cancel</button>
          <button onClick={handleConfirm} className="text-red-600">Delete</button>
        </ModalFooter>
      </Modal>
    );
    
    const deleteButton = screen.getByText('Delete');
    await userEvent.click(deleteButton);
    
    expect(handleConfirm).toHaveBeenCalled();
  });

  it('works as a form modal', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Edit Profile" size="lg">
        <ModalBody>
          <form>
            <div>
              <label htmlFor="name">Name</label>
              <input id="name" type="text" />
            </div>
            <div>
              <label htmlFor="email">Email</label>
              <input id="email" type="email" />
            </div>
          </form>
        </ModalBody>
        <ModalFooter>
          <button>Save Changes</button>
        </ModalFooter>
      </Modal>
    );
    
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('works as an information modal', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="About" showCloseButton={false}>
        <ModalBody>
          <h3>Application Version 1.0</h3>
          <p>This is a sample application.</p>
        </ModalBody>
        <ModalFooter className="text-center">
          <button onClick={mockOnClose}>Got it</button>
        </ModalFooter>
      </Modal>
    );
    
    expect(screen.getByText('Application Version 1.0')).toBeInTheDocument();
    expect(screen.queryByLabelText('Close modal')).not.toBeInTheDocument();
  });
});