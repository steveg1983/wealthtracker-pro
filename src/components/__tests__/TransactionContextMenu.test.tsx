import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TransactionContextMenu from '../TransactionContextMenu';
import type { Transaction } from '../../types';

const mockTransaction: Transaction = {
  id: 'tx1',
  date: new Date('2026-04-07'),
  amount: -50,
  type: 'expense',
  description: 'Test transaction',
  accountId: 'acc1',
  category: 'Food',
  createdAt: new Date(),
};

describe('TransactionContextMenu', () => {
  const defaultProps = {
    x: 100,
    y: 200,
    transaction: mockTransaction,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onView: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders all menu items', () => {
    render(<TransactionContextMenu {...defaultProps} />);
    expect(screen.getByText('View Details')).toBeInTheDocument();
    expect(screen.getByText('Edit Transaction')).toBeInTheDocument();
    expect(screen.getByText('Delete Transaction')).toBeInTheDocument();
  });

  it('has accessible menu role', () => {
    render(<TransactionContextMenu {...defaultProps} />);
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('has menuitem roles on buttons', () => {
    render(<TransactionContextMenu {...defaultProps} />);
    const items = screen.getAllByRole('menuitem');
    expect(items.length).toBe(3);
  });

  it('calls onEdit when edit is clicked', () => {
    render(<TransactionContextMenu {...defaultProps} />);
    fireEvent.click(screen.getByText('Edit Transaction'));
    expect(defaultProps.onEdit).toHaveBeenCalledWith(mockTransaction);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onDelete when delete is clicked', () => {
    render(<TransactionContextMenu {...defaultProps} />);
    fireEvent.click(screen.getByText('Delete Transaction'));
    expect(defaultProps.onDelete).toHaveBeenCalledWith('tx1');
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onView when view is clicked', () => {
    render(<TransactionContextMenu {...defaultProps} />);
    fireEvent.click(screen.getByText('View Details'));
    expect(defaultProps.onView).toHaveBeenCalledWith(mockTransaction);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('closes on Escape key', () => {
    render(<TransactionContextMenu {...defaultProps} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
