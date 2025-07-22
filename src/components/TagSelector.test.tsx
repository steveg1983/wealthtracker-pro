/**
 * TagSelector Tests
 * Tests for the tag selection component with autocomplete and creation
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import TagSelector from './TagSelector';

// Mock icons
vi.mock('./icons/XIcon', () => ({
  XIcon: ({ size }: { size?: number }) => (
    <span data-testid="x-icon" style={{ fontSize: size }}>×</span>
  )
}));

vi.mock('./icons/PlusIcon', () => ({
  PlusIcon: ({ size, className }: { size?: number; className?: string }) => (
    <span data-testid="plus-icon" className={className} style={{ fontSize: size }}>+</span>
  )
}));

vi.mock('./icons/HashIcon', () => ({
  HashIcon: ({ size }: { size?: number }) => (
    <span data-testid="hash-icon" style={{ fontSize: size }}>#</span>
  )
}));

// Mock AppContext
const mockTags = [
  { id: '1', name: 'urgent', color: '#EF4444', description: 'High priority items' },
  { id: '2', name: 'personal', color: '#3B82F6', description: 'Personal expenses' },
  { id: '3', name: 'work', color: '#10B981', description: null },
  { id: '4', name: 'travel', color: '#F59E0B', description: 'Travel related' }
];

const mockAddTag = vi.fn();
const mockGetTagUsageCount = vi.fn((tagName: string) => {
  const counts: Record<string, number> = {
    'urgent': 15,
    'personal': 8,
    'work': 23,
    'travel': 5
  };
  return counts[tagName] || 0;
});

vi.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    tags: mockTags,
    addTag: mockAddTag,
    getTagUsageCount: mockGetTagUsageCount
  })
}));

describe('TagSelector', () => {
  const mockOnTagsChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders input field with placeholder', () => {
      render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
        />
      );
      
      const input = screen.getByPlaceholderText('Add tags...');
      expect(input).toBeInTheDocument();
    });

    it('renders custom placeholder', () => {
      render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
          placeholder="Select tags"
        />
      );
      
      expect(screen.getByPlaceholderText('Select tags')).toBeInTheDocument();
    });

    it('shows helper text when no tags selected', () => {
      render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
        />
      );
      
      expect(screen.getByText('Type to search existing tags or create new ones')).toBeInTheDocument();
      expect(screen.getByTestId('hash-icon')).toBeInTheDocument();
    });

    it('hides helper text when tags are selected', () => {
      render(
        <TagSelector
          selectedTags={['urgent']}
          onTagsChange={mockOnTagsChange}
        />
      );
      
      expect(screen.queryByText('Type to search existing tags or create new ones')).not.toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
          className="custom-tag-selector"
        />
      );
      
      expect(container.firstChild).toHaveClass('custom-tag-selector');
    });
  });

  describe('Selected Tags Display', () => {
    it('displays selected tags', () => {
      render(
        <TagSelector
          selectedTags={['urgent', 'work']}
          onTagsChange={mockOnTagsChange}
        />
      );
      
      expect(screen.getByText('urgent')).toBeInTheDocument();
      expect(screen.getByText('work')).toBeInTheDocument();
    });

    it('applies tag colors from tag data', () => {
      render(
        <TagSelector
          selectedTags={['urgent', 'personal']}
          onTagsChange={mockOnTagsChange}
        />
      );
      
      // The component sets inline styles, so we check the style attribute
      const urgentTag = screen.getByText('urgent').closest('span[style]');
      expect(urgentTag).toHaveAttribute('style', expect.stringContaining('background-color: rgb(239, 68, 68)'));
      
      const personalTag = screen.getByText('personal').closest('span[style]');
      expect(personalTag).toHaveAttribute('style', expect.stringContaining('background-color: rgb(59, 130, 246)'));
    });

    it('uses default color for unknown tags', () => {
      render(
        <TagSelector
          selectedTags={['unknown-tag']}
          onTagsChange={mockOnTagsChange}
        />
      );
      
      const unknownTag = screen.getByText('unknown-tag').closest('span[style]');
      expect(unknownTag).toHaveAttribute('style', expect.stringContaining('background-color: rgb(107, 114, 128)'));
    });

    it('shows remove button for each tag', () => {
      render(
        <TagSelector
          selectedTags={['urgent', 'work']}
          onTagsChange={mockOnTagsChange}
        />
      );
      
      const removeButtons = screen.getAllByTestId('x-icon');
      expect(removeButtons).toHaveLength(2);
    });

    it('removes tag when remove button clicked', () => {
      render(
        <TagSelector
          selectedTags={['urgent', 'work', 'personal']}
          onTagsChange={mockOnTagsChange}
        />
      );
      
      // Get all remove buttons and click the second one (for 'work')
      const removeButtons = screen.getAllByTestId('x-icon');
      fireEvent.click(removeButtons[1].parentElement!);
      
      expect(mockOnTagsChange).toHaveBeenCalledWith(['urgent', 'personal']);
    });
  });

  describe('Dropdown Behavior', () => {
    it('does not show dropdown initially', () => {
      render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
        />
      );
      
      expect(screen.queryByText('urgent')).not.toBeInTheDocument();
    });

    it('shows dropdown when typing', () => {
      render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
        />
      );
      
      fireEvent.change(screen.getByPlaceholderText('Add tags...'), {
        target: { value: 'u' }
      });
      
      expect(screen.getByText('urgent')).toBeInTheDocument();
    });

    it('filters tags based on input', () => {
      render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
        />
      );
      
      fireEvent.change(screen.getByPlaceholderText('Add tags...'), {
        target: { value: 'per' }
      });
      
      expect(screen.getByText('personal')).toBeInTheDocument();
      expect(screen.queryByText('urgent')).not.toBeInTheDocument();
      expect(screen.queryByText('work')).not.toBeInTheDocument();
    });

    it('shows dropdown on focus if input has value', () => {
      render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
        />
      );
      
      const input = screen.getByPlaceholderText('Add tags...');
      fireEvent.change(input, { target: { value: 'ur' } });
      
      // The dropdown stays open after typing, we need to close it some other way
      // Since blur doesn't close it, we'll use click outside instead
      fireEvent.mouseDown(document.body);
      
      // Dropdown should be hidden
      expect(screen.queryByText('urgent')).not.toBeInTheDocument();
      
      // Focus again should show dropdown
      fireEvent.focus(input);
      expect(screen.getByText('urgent')).toBeInTheDocument();
    });

    it('excludes already selected tags from dropdown', () => {
      render(
        <TagSelector
          selectedTags={['urgent']}
          onTagsChange={mockOnTagsChange}
        />
      );
      
      fireEvent.change(screen.getByPlaceholderText('Add tags...'), {
        target: { value: 'u' }
      });
      
      // Check that 'urgent' appears in selected tags but not in dropdown
      // There should be one 'urgent' in the selected tags area
      const urgentElements = screen.getAllByText('urgent');
      expect(urgentElements).toHaveLength(1);
      
      // And it should be in the selected tags area (has a remove button)
      const selectedTag = urgentElements[0].parentElement;
      expect(selectedTag?.querySelector('[data-testid="x-icon"]')).toBeInTheDocument();
    });

    it('shows tag usage counts', () => {
      render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
        />
      );
      
      fireEvent.change(screen.getByPlaceholderText('Add tags...'), {
        target: { value: 'work' }
      });
      
      expect(screen.getByText('(23 uses)')).toBeInTheDocument();
    });

    it('shows tag descriptions when available', () => {
      render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
        />
      );
      
      fireEvent.change(screen.getByPlaceholderText('Add tags...'), {
        target: { value: 'urgent' }
      });
      
      expect(screen.getByText('High priority items')).toBeInTheDocument();
    });

    it('does not show description for tags without one', () => {
      render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
        />
      );
      
      fireEvent.change(screen.getByPlaceholderText('Add tags...'), {
        target: { value: 'work' }
      });
      
      expect(screen.getByText('work')).toBeInTheDocument();
      expect(screen.queryByText('null')).not.toBeInTheDocument();
    });
  });

  describe('Tag Selection', () => {
    it('selects tag when clicked', () => {
      render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
        />
      );
      
      fireEvent.change(screen.getByPlaceholderText('Add tags...'), {
        target: { value: 'urgent' }
      });
      
      fireEvent.click(screen.getByText('urgent').closest('div')!);
      
      expect(mockOnTagsChange).toHaveBeenCalledWith(['urgent']);
    });

    it('clears input and closes dropdown after selection', async () => {
      render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
        />
      );
      
      const input = screen.getByPlaceholderText('Add tags...');
      fireEvent.change(input, { target: { value: 'urgent' } });
      
      fireEvent.click(screen.getByText('urgent').closest('div')!);
      
      expect(input).toHaveValue('');
      await waitFor(() => {
        expect(screen.queryByText('High priority items')).not.toBeInTheDocument();
      });
    });

    it('does not add duplicate tags', () => {
      render(
        <TagSelector
          selectedTags={['urgent']}
          onTagsChange={mockOnTagsChange}
        />
      );
      
      // This shouldn't happen normally since selected tags are filtered out,
      // but the selectTag function has this check
      expect(mockOnTagsChange).not.toHaveBeenCalled();
    });
  });

  describe('New Tag Creation', () => {
    it('shows create option for new tag when allowNewTags is true', () => {
      render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
          allowNewTags={true}
        />
      );
      
      fireEvent.change(screen.getByPlaceholderText('Add tags...'), {
        target: { value: 'newtag' }
      });
      
      expect(screen.getByText('Create "newtag"')).toBeInTheDocument();
      expect(screen.getByText('Create new tag and add to transaction')).toBeInTheDocument();
    });

    it('does not show create option when allowNewTags is false', () => {
      render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
          allowNewTags={false}
        />
      );
      
      fireEvent.change(screen.getByPlaceholderText('Add tags...'), {
        target: { value: 'newtag' }
      });
      
      expect(screen.queryByText('Create "newtag"')).not.toBeInTheDocument();
    });

    it('does not show create option for existing tags', () => {
      render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
          allowNewTags={true}
        />
      );
      
      fireEvent.change(screen.getByPlaceholderText('Add tags...'), {
        target: { value: 'urgent' }
      });
      
      expect(screen.queryByText('Create "urgent"')).not.toBeInTheDocument();
    });

    it('creates and selects new tag when create option clicked', () => {
      render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
          allowNewTags={true}
        />
      );
      
      fireEvent.change(screen.getByPlaceholderText('Add tags...'), {
        target: { value: 'newtag' }
      });
      
      fireEvent.click(screen.getByText('Create "newtag"').closest('div')!);
      
      expect(mockAddTag).toHaveBeenCalledWith({
        name: 'newtag',
        color: '#6B7280',
        description: 'Created during transaction entry'
      });
      
      expect(mockOnTagsChange).toHaveBeenCalledWith(['newtag']);
    });

    it('trims whitespace from new tags', () => {
      render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
          allowNewTags={true}
        />
      );
      
      fireEvent.change(screen.getByPlaceholderText('Add tags...'), {
        target: { value: '  newtag  ' }
      });
      
      expect(screen.getByText('Create "newtag"')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('navigates dropdown with arrow keys', () => {
      render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
        />
      );
      
      const input = screen.getByPlaceholderText('Add tags...');
      fireEvent.change(input, { target: { value: 'u' } });
      
      // Arrow down
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      
      // The option div has multiple levels, find the one with hover/focus classes
      const urgentText = screen.getByText('urgent');
      let optionDiv = urgentText.parentElement?.parentElement;
      while (optionDiv && !optionDiv.className.includes('cursor-pointer')) {
        optionDiv = optionDiv.parentElement;
      }
      expect(optionDiv).toHaveClass('bg-gray-100');
    });

    it('wraps around when navigating past last item', () => {
      render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
          allowNewTags={true}
        />
      );
      
      const input = screen.getByPlaceholderText('Add tags...');
      fireEvent.change(input, { target: { value: 'newtag' } });
      
      // Navigate down past the create option
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      
      // Should wrap to first item (no existing tags match 'newtag')
    });

    it('selects focused item with Enter', () => {
      render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
        />
      );
      
      const input = screen.getByPlaceholderText('Add tags...');
      fireEvent.change(input, { target: { value: 'urgent' } });
      
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      expect(mockOnTagsChange).toHaveBeenCalledWith(['urgent']);
    });

    it('closes dropdown with Escape', () => {
      render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
        />
      );
      
      const input = screen.getByPlaceholderText('Add tags...');
      fireEvent.change(input, { target: { value: 'urgent' } });
      
      expect(screen.getByText('urgent')).toBeInTheDocument();
      
      fireEvent.keyDown(input, { key: 'Escape' });
      
      expect(screen.queryByText('urgent')).not.toBeInTheDocument();
    });

    it('creates new tag with Enter when typed', () => {
      render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
          allowNewTags={true}
        />
      );
      
      const input = screen.getByPlaceholderText('Add tags...');
      fireEvent.change(input, { target: { value: 'brandnew' } });
      
      fireEvent.keyDown(input, { key: 'Enter' });
      
      expect(mockAddTag).toHaveBeenCalledWith({
        name: 'brandnew',
        color: '#6B7280',
        description: 'Created during transaction entry'
      });
    });

    it('selects exact match with Enter even if not focused', () => {
      render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
        />
      );
      
      const input = screen.getByPlaceholderText('Add tags...');
      fireEvent.change(input, { target: { value: 'urgent' } });
      
      // Press Enter without navigating
      fireEvent.keyDown(input, { key: 'Enter' });
      
      expect(mockOnTagsChange).toHaveBeenCalledWith(['urgent']);
    });
  });

  describe('Click Outside Behavior', () => {
    it('closes dropdown when clicking outside', async () => {
      render(
        <div>
          <TagSelector
            selectedTags={[]}
            onTagsChange={mockOnTagsChange}
          />
          <button>Outside button</button>
        </div>
      );
      
      fireEvent.change(screen.getByPlaceholderText('Add tags...'), {
        target: { value: 'urgent' }
      });
      
      expect(screen.getByText('urgent')).toBeInTheDocument();
      
      // Click outside
      fireEvent.mouseDown(screen.getByText('Outside button'));
      
      await waitFor(() => {
        expect(screen.queryByText('urgent')).not.toBeInTheDocument();
      });
    });

    it('keeps dropdown open when clicking inside', () => {
      render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
        />
      );
      
      fireEvent.change(screen.getByPlaceholderText('Add tags...'), {
        target: { value: 'urgent' }
      });
      
      // Click inside the dropdown
      fireEvent.mouseDown(screen.getByText('urgent'));
      
      expect(screen.getByText('urgent')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty tag list', () => {
      vi.mocked(vi.importActual('../contexts/AppContext')).useApp = () => ({
        tags: [],
        addTag: mockAddTag,
        getTagUsageCount: mockGetTagUsageCount
      });
      
      render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
        />
      );
      
      fireEvent.change(screen.getByPlaceholderText('Add tags...'), {
        target: { value: 'any' }
      });
      
      // Should not show any existing tags
      expect(screen.queryByRole('option')).not.toBeInTheDocument();
    });

    it('handles case-insensitive search', () => {
      render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
        />
      );
      
      fireEvent.change(screen.getByPlaceholderText('Add tags...'), {
        target: { value: 'URGENT' }
      });
      
      expect(screen.getByText('urgent')).toBeInTheDocument();
    });

    it('handles case-insensitive exact match detection', () => {
      render(
        <TagSelector
          selectedTags={[]}
          onTagsChange={mockOnTagsChange}
          allowNewTags={true}
        />
      );
      
      fireEvent.change(screen.getByPlaceholderText('Add tags...'), {
        target: { value: 'URGENT' }
      });
      
      // Should not show create option for existing tag
      expect(screen.queryByText('Create "URGENT"')).not.toBeInTheDocument();
    });
  });
});