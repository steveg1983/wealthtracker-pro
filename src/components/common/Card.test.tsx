/**
 * Card Component Tests
 * Comprehensive tests for the Card UI component and its sub-components
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardContent } from './Card';

describe('Card', () => {
  describe('basic rendering', () => {
    it('renders children content', () => {
      render(<Card>Card content</Card>);
      expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('renders as a div element', () => {
      render(<Card data-testid="card">Content</Card>);
      const card = screen.getByTestId('card');
      expect(card.tagName).toBe('DIV');
    });

    it('applies rounded corners', () => {
      render(<Card data-testid="card">Content</Card>);
      const card = screen.getByTestId('card');
      expect(card.className).toContain('rounded-[var(--radius-lg)]');
    });
  });

  describe('variants', () => {
    it('applies surface variant by default', () => {
      render(<Card data-testid="card">Surface Card</Card>);
      const card = screen.getByTestId('card');
      
      expect(card.className).toContain('bg-[var(--color-surface-primary)]');
      expect(card.className).toContain('border');
      expect(card.className).toContain('border-[var(--color-border-primary)]');
    });

    it('applies elevated variant', () => {
      render(<Card variant="elevated" data-testid="card">Elevated Card</Card>);
      const card = screen.getByTestId('card');
      
      expect(card.className).toContain('bg-[var(--color-surface-elevated)]');
      expect(card.className).toContain('shadow-[var(--shadow-md)]');
    });

    it('applies bordered variant', () => {
      render(<Card variant="bordered" data-testid="card">Bordered Card</Card>);
      const card = screen.getByTestId('card');
      
      expect(card.className).toContain('bg-[var(--color-background-secondary)]');
      expect(card.className).toContain('border-2');
      expect(card.className).toContain('border-[var(--color-border-secondary)]');
    });
  });

  describe('padding', () => {
    it('applies medium padding by default', () => {
      render(<Card data-testid="card">Default Padding</Card>);
      const card = screen.getByTestId('card');
      
      expect(card.className).toContain('p-[var(--spacing-6)]');
    });

    it('applies no padding when padding="none"', () => {
      render(<Card padding="none" data-testid="card">No Padding</Card>);
      const card = screen.getByTestId('card');
      
      expect(card.className).not.toContain('p-[');
    });

    it('applies small padding', () => {
      render(<Card padding="sm" data-testid="card">Small Padding</Card>);
      const card = screen.getByTestId('card');
      
      expect(card.className).toContain('p-[var(--spacing-4)]');
    });

    it('applies large padding', () => {
      render(<Card padding="lg" data-testid="card">Large Padding</Card>);
      const card = screen.getByTestId('card');
      
      expect(card.className).toContain('p-[var(--spacing-8)]');
    });
  });

  describe('custom className', () => {
    it('applies custom className', () => {
      render(
        <Card className="custom-class" data-testid="card">
          Custom Class
        </Card>
      );
      const card = screen.getByTestId('card');
      
      expect(card.className).toContain('custom-class');
    });

    it('combines custom className with default classes', () => {
      render(
        <Card className="mt-4 w-full" data-testid="card">
          Multiple Classes
        </Card>
      );
      const card = screen.getByTestId('card');
      
      expect(card.className).toContain('mt-4');
      expect(card.className).toContain('w-full');
      expect(card.className).toContain('rounded-[var(--radius-lg)]');
      expect(card.className).toContain('p-[var(--spacing-6)]');
    });
  });

  describe('complex content', () => {
    it('renders multiple children', () => {
      render(
        <Card>
          <h2>Title</h2>
          <p>Paragraph</p>
          <button>Button</button>
        </Card>
      );
      
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Paragraph')).toBeInTheDocument();
      expect(screen.getByText('Button')).toBeInTheDocument();
    });

    it('renders nested components', () => {
      render(
        <Card>
          <div data-testid="nested">
            <span>Nested content</span>
          </div>
        </Card>
      );
      
      expect(screen.getByTestId('nested')).toBeInTheDocument();
      expect(screen.getByText('Nested content')).toBeInTheDocument();
    });
  });

  describe('additional HTML props', () => {
    it('forwards onClick handler', () => {
      const handleClick = vi.fn();
      render(
        <Card data-testid="card" onClick={handleClick}>
          Clickable
        </Card>
      );
      
      const card = screen.getByTestId('card');
      card.click();
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('forwards aria attributes', () => {
      render(
        <Card data-testid="card" aria-label="Info card" role="region">
          Accessible Card
        </Card>
      );
      
      const card = screen.getByTestId('card');
      expect(card).toHaveAttribute('aria-label', 'Info card');
      expect(card).toHaveAttribute('role', 'region');
    });
  });
});

describe('CardHeader', () => {
  it('renders children content', () => {
    render(<CardHeader>Header Content</CardHeader>);
    expect(screen.getByText('Header Content')).toBeInTheDocument();
  });

  it('applies margin bottom', () => {
    render(<CardHeader data-testid="header">Header</CardHeader>);
    const header = screen.getByTestId('header');
    
    expect(header.className).toContain('mb-[var(--spacing-4)]');
  });

  it('applies custom className', () => {
    render(
      <CardHeader className="custom-header" data-testid="header">
        Header
      </CardHeader>
    );
    const header = screen.getByTestId('header');
    
    expect(header.className).toContain('custom-header');
    expect(header.className).toContain('mb-[var(--spacing-4)]');
  });

  it('renders complex content', () => {
    render(
      <CardHeader>
        <h2>Title</h2>
        <p>Subtitle</p>
      </CardHeader>
    );
    
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Subtitle')).toBeInTheDocument();
  });
});

describe('CardTitle', () => {
  it('renders children content', () => {
    render(<CardTitle>Card Title</CardTitle>);
    expect(screen.getByText('Card Title')).toBeInTheDocument();
  });

  it('renders as h3 element', () => {
    render(<CardTitle>Title</CardTitle>);
    const title = screen.getByText('Title');
    expect(title.tagName).toBe('H3');
  });

  it('applies title styles', () => {
    render(<CardTitle>Styled Title</CardTitle>);
    const title = screen.getByText('Styled Title');
    
    expect(title.className).toContain('text-[var(--font-size-lg)]');
    expect(title.className).toContain('font-[var(--font-weight-semibold)]');
    expect(title.className).toContain('text-[var(--color-text-primary)]');
  });

  it('applies custom className', () => {
    render(<CardTitle className="custom-title">Title</CardTitle>);
    const title = screen.getByText('Title');
    
    expect(title.className).toContain('custom-title');
    expect(title.className).toContain('text-[var(--font-size-lg)]');
  });

  it('renders complex content', () => {
    render(
      <CardTitle>
        <span>Title with</span> <strong>emphasis</strong>
      </CardTitle>
    );
    
    expect(screen.getByText('Title with')).toBeInTheDocument();
    expect(screen.getByText('emphasis')).toBeInTheDocument();
  });
});

describe('CardContent', () => {
  it('renders children content', () => {
    render(<CardContent>Content text</CardContent>);
    expect(screen.getByText('Content text')).toBeInTheDocument();
  });

  it('applies secondary text color', () => {
    render(<CardContent data-testid="content">Content</CardContent>);
    const content = screen.getByTestId('content');
    
    expect(content.className).toContain('text-[var(--color-text-secondary)]');
  });

  it('applies custom className', () => {
    render(
      <CardContent className="custom-content" data-testid="content">
        Content
      </CardContent>
    );
    const content = screen.getByTestId('content');
    
    expect(content.className).toContain('custom-content');
    expect(content.className).toContain('text-[var(--color-text-secondary)]');
  });

  it('renders complex content', () => {
    render(
      <CardContent>
        <p>Paragraph 1</p>
        <p>Paragraph 2</p>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      </CardContent>
    );
    
    expect(screen.getByText('Paragraph 1')).toBeInTheDocument();
    expect(screen.getByText('Paragraph 2')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });
});

describe('Card composition', () => {
  it('works with all sub-components together', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Complete Card</CardTitle>
        </CardHeader>
        <CardContent>
          This is the card content
        </CardContent>
      </Card>
    );
    
    expect(screen.getByText('Complete Card')).toBeInTheDocument();
    expect(screen.getByText('This is the card content')).toBeInTheDocument();
  });

  it('supports multiple sections', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Section 1</CardTitle>
        </CardHeader>
        <CardContent>Content 1</CardContent>
        
        <CardHeader>
          <CardTitle>Section 2</CardTitle>
        </CardHeader>
        <CardContent>Content 2</CardContent>
      </Card>
    );
    
    expect(screen.getByText('Section 1')).toBeInTheDocument();
    expect(screen.getByText('Content 1')).toBeInTheDocument();
    expect(screen.getByText('Section 2')).toBeInTheDocument();
    expect(screen.getByText('Content 2')).toBeInTheDocument();
  });

  it('maintains proper layout with different variants and padding', () => {
    const { rerender } = render(
      <Card variant="elevated" padding="lg" data-testid="card">
        <CardHeader>
          <CardTitle>Elevated Large Card</CardTitle>
        </CardHeader>
        <CardContent>With large padding</CardContent>
      </Card>
    );
    
    let card = screen.getByTestId('card');
    expect(card.className).toContain('shadow-[var(--shadow-md)]');
    expect(card.className).toContain('p-[var(--spacing-8)]');
    
    rerender(
      <Card variant="bordered" padding="sm" data-testid="card">
        <CardHeader>
          <CardTitle>Bordered Small Card</CardTitle>
        </CardHeader>
        <CardContent>With small padding</CardContent>
      </Card>
    );
    
    card = screen.getByTestId('card');
    expect(card.className).toContain('border-2');
    expect(card.className).toContain('p-[var(--spacing-4)]');
  });
});

describe('real-world usage scenarios', () => {
  it('works as a stat card', () => {
    render(
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Total Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">$12,345</div>
          <div className="text-sm">+12% from last month</div>
        </CardContent>
      </Card>
    );
    
    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
    expect(screen.getByText('$12,345')).toBeInTheDocument();
    expect(screen.getByText('+12% from last month')).toBeInTheDocument();
  });

  it('works as a form container', () => {
    render(
      <Card padding="lg">
        <CardHeader>
          <CardTitle>User Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" />
            <button type="submit">Save</button>
          </form>
        </CardContent>
      </Card>
    );
    
    expect(screen.getByText('User Settings')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('works as an empty state container', () => {
    render(
      <Card variant="bordered" padding="lg">
        <CardContent>
          <div className="text-center">
            <p>No transactions found</p>
            <button>Add your first transaction</button>
          </div>
        </CardContent>
      </Card>
    );
    
    expect(screen.getByText('No transactions found')).toBeInTheDocument();
    expect(screen.getByText('Add your first transaction')).toBeInTheDocument();
  });
});