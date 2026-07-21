import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DataMigrationWizard from './DataMigrationWizard';

describe('DataMigrationWizard (honest router)', () => {
  it('lists the sources and routes Quicken to the real QIF importer', () => {
    const onOpenTool = vi.fn();
    render(<DataMigrationWizard isOpen onClose={() => {}} onOpenTool={onOpenTool} />);

    expect(screen.getByText('Where are you migrating from?')).toBeInTheDocument();
    for (const name of ['Microsoft Money', 'Mint', 'Quicken', 'YNAB']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }

    fireEvent.click(screen.getByText('Quicken'));
    // real export instructions, no fake progress steps
    expect(screen.getByText(/File → Export → QIF/)).toBeInTheDocument();
    expect(screen.queryByText(/Map Fields|Complete Import/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Open the QIF importer'));
    expect(onOpenTool).toHaveBeenCalledWith('qif');
  });

  it('warns that Microsoft Money is a destructive total migration before routing', () => {
    const onOpenTool = vi.fn();
    render(<DataMigrationWizard isOpen onClose={() => {}} onOpenTool={onOpenTool} />);

    fireEvent.click(screen.getByText('Microsoft Money'));
    expect(screen.getByText(/TOTAL migration/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Open the Microsoft Money importer'));
    expect(onOpenTool).toHaveBeenCalledWith('msmoney');
  });

  it('routes every CSV-based source to the CSV importer', () => {
    for (const source of ['Mint', 'YNAB', 'Personal Capital', 'Excel / other CSV']) {
      const onOpenTool = vi.fn();
      const { unmount } = render(<DataMigrationWizard isOpen onClose={() => {}} onOpenTool={onOpenTool} />);
      fireEvent.click(screen.getByText(source));
      fireEvent.click(screen.getByText('Open the CSV importer'));
      expect(onOpenTool).toHaveBeenCalledWith('csv');
      unmount();
    }
  });
});
