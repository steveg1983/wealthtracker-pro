import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { AriaLiveRegion } from './AriaLiveRegion';
import { useAriaAnnounce } from './useAriaAnnounce';

describe('AriaLiveRegion', () => {
  beforeEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('Basic rendering', () => {
    it('renders with message', () => {
      render(<AriaLiveRegion message="Test announcement" />);
      
      expect(screen.getByText('Test announcement')).toBeInTheDocument();
    });

    it('renders with screen reader only class', () => {
      render(<AriaLiveRegion message="Test announcement" />);
      
      const region = screen.getByRole('status');
      expect(region).toHaveClass('sr-only');
    });

    it('sets role as status', () => {
      render(<AriaLiveRegion message="Test announcement" />);
      
      const region = screen.getByRole('status');
      expect(region).toBeInTheDocument();
    });

    it('sets aria-atomic to true', () => {
      render(<AriaLiveRegion message="Test announcement" />);
      
      const region = screen.getByRole('status');
      expect(region).toHaveAttribute('aria-atomic', 'true');
    });
  });

  describe('aria-live attribute', () => {
    it('defaults to polite', () => {
      render(<AriaLiveRegion message="Test" />);
      
      const region = screen.getByRole('status');
      expect(region).toHaveAttribute('aria-live', 'polite');
    });

    it('can be set to assertive', () => {
      render(<AriaLiveRegion message="Test" type="assertive" />);
      
      const region = screen.getByRole('status');
      expect(region).toHaveAttribute('aria-live', 'assertive');
    });

    it('can be explicitly set to polite', () => {
      render(<AriaLiveRegion message="Test" type="polite" />);
      
      const region = screen.getByRole('status');
      expect(region).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Message clearing', () => {
    it('clears message after default timeout', () => {
      render(<AriaLiveRegion message="Test announcement" />);
      
      expect(screen.getByText('Test announcement')).toBeInTheDocument();
      
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      
      expect(screen.queryByText('Test announcement')).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('');
    });

    it('clears message after custom timeout', () => {
      render(<AriaLiveRegion message="Test announcement" clearAfter={3000} />);
      
      expect(screen.getByText('Test announcement')).toBeInTheDocument();
      
      act(() => {
        vi.advanceTimersByTime(2999);
      });
      expect(screen.getByText('Test announcement')).toBeInTheDocument();
      
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(screen.queryByText('Test announcement')).not.toBeInTheDocument();
    });

    it('does not clear when clearAfter is 0', () => {
      render(<AriaLiveRegion message="Test announcement" clearAfter={0} />);
      
      expect(screen.getByText('Test announcement')).toBeInTheDocument();
      
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      
      expect(screen.getByText('Test announcement')).toBeInTheDocument();
    });

    it('does not clear when clearAfter is negative', () => {
      render(<AriaLiveRegion message="Test announcement" clearAfter={-1} />);
      
      expect(screen.getByText('Test announcement')).toBeInTheDocument();
      
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      
      expect(screen.getByText('Test announcement')).toBeInTheDocument();
    });
  });

  describe('Message updates', () => {
    it('updates message when prop changes', () => {
      const { rerender } = render(<AriaLiveRegion message="First message" />);
      
      expect(screen.getByText('First message')).toBeInTheDocument();
      
      rerender(<AriaLiveRegion message="Second message" />);
      
      expect(screen.queryByText('First message')).not.toBeInTheDocument();
      expect(screen.getByText('Second message')).toBeInTheDocument();
    });

    it('resets timer when message changes', () => {
      const { rerender } = render(<AriaLiveRegion message="First message" clearAfter={2000} />);
      
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      
      rerender(<AriaLiveRegion message="Second message" clearAfter={2000} />);
      
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      
      // Should still show second message because timer was reset
      expect(screen.getByText('Second message')).toBeInTheDocument();
      
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      // Now it should be cleared
      expect(screen.queryByText('Second message')).not.toBeInTheDocument();
    });

    it('clears previous timer when message changes', () => {
      const { rerender } = render(<AriaLiveRegion message="First message" clearAfter={1000} />);
      
      act(() => {
        vi.advanceTimersByTime(500);
      });
      
      rerender(<AriaLiveRegion message="Second message" clearAfter={1000} />);
      
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      
      // First message timer should be cleared, only second message timer matters
      expect(screen.queryByText('First message')).not.toBeInTheDocument();
      expect(screen.queryByText('Second message')).not.toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('handles empty message', () => {
      render(<AriaLiveRegion message="" />);
      
      const region = screen.getByRole('status');
      expect(region).toHaveTextContent('');
    });

    it('handles message with special characters', () => {
      const message = 'Test & <message> with "special" \'characters\'';
      render(<AriaLiveRegion message={message} />);
      
      expect(screen.getByText(message)).toBeInTheDocument();
    });

    it('does not set timer for empty message', () => {
      render(<AriaLiveRegion message="" />);
      
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      
      const region = screen.getByRole('status');
      expect(region).toHaveTextContent('');
    });
  });
});

describe('useAriaAnnounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('initializes with empty announcement', () => {
    const { result } = renderHook(() => useAriaAnnounce());
    
    expect(result.current.announcement).toBe('');
  });

  it('announces message after delay', async () => {
    const { result } = renderHook(() => useAriaAnnounce());
    
    act(() => {
      result.current.announce('Test announcement');
    });
    
    // Initially empty (cleared first)
    expect(result.current.announcement).toBe('');
    
    act(() => {
      vi.advanceTimersByTime(100);
    });
    
    // After delay, message appears
    expect(result.current.announcement).toBe('Test announcement');
  });

  it('clears previous announcement before new one', () => {
    const { result } = renderHook(() => useAriaAnnounce());
    
    // First announcement
    act(() => {
      result.current.announce('First announcement');
      vi.advanceTimersByTime(100);
    });
    
    expect(result.current.announcement).toBe('First announcement');
    
    // Second announcement
    act(() => {
      result.current.announce('Second announcement');
    });
    
    // Should be cleared immediately
    expect(result.current.announcement).toBe('');
    
    act(() => {
      vi.advanceTimersByTime(100);
    });
    
    // Then new message appears
    expect(result.current.announcement).toBe('Second announcement');
  });

  it('AriaAnnouncer component renders with announcement', () => {
    const { result } = renderHook(() => useAriaAnnounce());
    
    act(() => {
      result.current.announce('Test message');
      vi.advanceTimersByTime(100);
    });
    
    render(<>{result.current.AriaAnnouncer()}</>);

    const region = screen.getByRole('status');
    expect(region).toBeInTheDocument();
    expect(region).toHaveTextContent('Test message');
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('supports multiple rapid announcements', () => {
    const { result } = renderHook(() => useAriaAnnounce());
    
    act(() => {
      result.current.announce('Message 1');
      vi.advanceTimersByTime(50);
      result.current.announce('Message 2');
      vi.advanceTimersByTime(50);
      result.current.announce('Message 3');
    });
    
    // Should be cleared from the last announce call
    expect(result.current.announcement).toBe('');
    
    act(() => {
      vi.advanceTimersByTime(100);
    });
    
    // Only the last message should be announced
    expect(result.current.announcement).toBe('Message 3');
  });
});
