/**
 * MerchantLogo Tests
 * Tests for the merchant logo component with logo fetching and display
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import MerchantLogo from './MerchantLogo';
import { merchantLogoService } from '../services/merchantLogoService';

// Mock the merchantLogoService
vi.mock('../services/merchantLogoService', () => ({
  merchantLogoService: {
    getMerchantInfo: vi.fn(),
    fetchLogoUrl: vi.fn()
  }
}));

const mockMerchantLogoService = merchantLogoService as {
  getMerchantInfo: Mock;
  fetchLogoUrl: Mock;
};

describe('MerchantLogo', () => {
  const mockMerchantInfo = {
    name: 'Amazon',
    domain: 'amazon.com',
    logo: '🛒',
    color: '#FF9900',
    category: 'shopping'
  };

  const mockMerchantInfoNoDomain = {
    name: 'Local Shop',
    domain: null,
    logo: '🏪',
    color: '#4285F4',
    category: 'shopping'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders merchant logo with emoji when no URL is available', async () => {
      mockMerchantLogoService.getMerchantInfo.mockReturnValue(mockMerchantInfo);
      mockMerchantLogoService.fetchLogoUrl.mockResolvedValue(null);

      render(<MerchantLogo description="Amazon purchase" />);

      // Wait for loading to complete
      await waitFor(() => {
        const logo = screen.getByRole('img', { name: 'Amazon' });
        expect(logo).toBeInTheDocument();
        expect(logo).toHaveTextContent('🛒');
      });
    });

    it('returns null when no merchant info is found', () => {
      mockMerchantLogoService.getMerchantInfo.mockReturnValue(null);

      const { container } = render(<MerchantLogo description="Unknown merchant" />);
      
      expect(container.firstChild).toBeNull();
    });

    it('shows merchant name when showName is true', async () => {
      mockMerchantLogoService.getMerchantInfo.mockReturnValue(mockMerchantInfo);
      mockMerchantLogoService.fetchLogoUrl.mockResolvedValue(null);

      render(<MerchantLogo description="Amazon purchase" showName={true} />);

      expect(screen.getByText('Amazon')).toBeInTheDocument();
      
      // Wait for logo to finish loading
      await waitFor(() => {
        expect(screen.getByRole('img', { name: 'Amazon' })).toBeInTheDocument();
      });
    });

    it('does not show merchant name when showName is false', () => {
      mockMerchantLogoService.getMerchantInfo.mockReturnValue(mockMerchantInfo);
      mockMerchantLogoService.fetchLogoUrl.mockResolvedValue(null);

      render(<MerchantLogo description="Amazon purchase" showName={false} />);

      expect(screen.queryByText('Amazon')).not.toBeInTheDocument();
    });
  });

  describe('Size Variants', () => {
    it('applies correct classes for small size', () => {
      mockMerchantLogoService.getMerchantInfo.mockReturnValue(mockMerchantInfoNoDomain);

      render(<MerchantLogo description="Local Shop" size="sm" />);

      const container = screen.getByRole('img', { name: 'Local Shop' }).parentElement;
      expect(container).toHaveClass('w-6', 'h-6');
      
      const emoji = screen.getByRole('img', { name: 'Local Shop' });
      expect(emoji).toHaveClass('text-sm');
    });

    it('applies correct classes for medium size', () => {
      mockMerchantLogoService.getMerchantInfo.mockReturnValue(mockMerchantInfoNoDomain);

      render(<MerchantLogo description="Local Shop" size="md" />);

      const container = screen.getByRole('img', { name: 'Local Shop' }).parentElement;
      expect(container).toHaveClass('w-8', 'h-8');
      
      const emoji = screen.getByRole('img', { name: 'Local Shop' });
      expect(emoji).toHaveClass('text-lg');
    });

    it('applies correct classes for large size', () => {
      mockMerchantLogoService.getMerchantInfo.mockReturnValue(mockMerchantInfoNoDomain);

      render(<MerchantLogo description="Local Shop" size="lg" />);

      const container = screen.getByRole('img', { name: 'Local Shop' }).parentElement;
      expect(container).toHaveClass('w-10', 'h-10');
      
      const emoji = screen.getByRole('img', { name: 'Local Shop' });
      expect(emoji).toHaveClass('text-2xl');
    });

    it('uses medium size as default', () => {
      mockMerchantLogoService.getMerchantInfo.mockReturnValue(mockMerchantInfoNoDomain);

      render(<MerchantLogo description="Local Shop" />);

      const container = screen.getByRole('img', { name: 'Local Shop' }).parentElement;
      expect(container).toHaveClass('w-8', 'h-8');
    });
  });

  describe('Logo Fetching', () => {
    it('fetches and displays logo URL when domain is available', async () => {
      mockMerchantLogoService.getMerchantInfo.mockReturnValue(mockMerchantInfo);
      mockMerchantLogoService.fetchLogoUrl.mockResolvedValue('https://logo.clearbit.com/amazon.com');

      render(<MerchantLogo description="Amazon purchase" />);

      await waitFor(() => {
        const img = screen.getByAltText('Amazon');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', 'https://logo.clearbit.com/amazon.com');
      });
    });

    it('shows loading state while fetching logo', async () => {
      mockMerchantLogoService.getMerchantInfo.mockReturnValue(mockMerchantInfo);
      mockMerchantLogoService.fetchLogoUrl.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('https://logo.clearbit.com/amazon.com'), 100))
      );

      render(<MerchantLogo description="Amazon purchase" />);

      // Should show loading animation
      const loadingElement = document.querySelector('.animate-pulse');
      expect(loadingElement).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByAltText('Amazon')).toBeInTheDocument();
      });

      // Loading element should be gone
      expect(document.querySelector('.animate-pulse')).not.toBeInTheDocument();
    });

    it('falls back to emoji when image fails to load', async () => {
      mockMerchantLogoService.getMerchantInfo.mockReturnValue(mockMerchantInfo);
      mockMerchantLogoService.fetchLogoUrl.mockResolvedValue('https://logo.clearbit.com/amazon.com');

      render(<MerchantLogo description="Amazon purchase" />);

      await waitFor(() => {
        const img = screen.getByAltText('Amazon');
        expect(img).toBeInTheDocument();
      });

      // Simulate image load error
      const img = screen.getByAltText('Amazon');
      fireEvent.error(img);

      await waitFor(() => {
        expect(screen.queryByAltText('Amazon')).not.toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Amazon' })).toHaveTextContent('🛒');
      });
    });

    it('does not fetch logo when merchant has no domain', () => {
      const merchantWithoutDomain = {
        ...mockMerchantInfo,
        domain: null
      };
      
      mockMerchantLogoService.getMerchantInfo.mockReturnValue(merchantWithoutDomain);

      render(<MerchantLogo description="Local shop" />);

      expect(mockMerchantLogoService.fetchLogoUrl).not.toHaveBeenCalled();
      expect(screen.getByRole('img', { name: 'Amazon' })).toHaveTextContent('🛒');
    });

    it('applies correct size classes to loaded image', async () => {
      mockMerchantLogoService.getMerchantInfo.mockReturnValue(mockMerchantInfo);
      mockMerchantLogoService.fetchLogoUrl.mockResolvedValue('https://logo.clearbit.com/amazon.com');

      render(<MerchantLogo description="Amazon" size="lg" />);

      await waitFor(() => {
        const img = screen.getByAltText('Amazon');
        expect(img).toHaveClass('w-6', 'h-6', 'object-contain');
      });
    });
  });

  describe('Styling', () => {
    it('applies background color based on merchant color', () => {
      mockMerchantLogoService.getMerchantInfo.mockReturnValue(mockMerchantInfoNoDomain);

      render(<MerchantLogo description="Local Shop" />);

      const container = screen.getByRole('img', { name: 'Local Shop' }).parentElement;
      expect(container).toHaveStyle({ backgroundColor: '#4285F420' });
    });

    it('applies custom className when provided', () => {
      mockMerchantLogoService.getMerchantInfo.mockReturnValue(mockMerchantInfoNoDomain);

      render(<MerchantLogo description="Local Shop" className="custom-class" />);

      const container = screen.getByRole('img', { name: 'Local Shop' }).closest('.custom-class');
      expect(container).toBeInTheDocument();
    });

    it('has proper container styling', () => {
      mockMerchantLogoService.getMerchantInfo.mockReturnValue(mockMerchantInfoNoDomain);

      render(<MerchantLogo description="Local Shop" />);

      const container = screen.getByRole('img', { name: 'Local Shop' }).parentElement;
      expect(container).toHaveClass(
        'rounded-lg',
        'flex',
        'items-center',
        'justify-center',
        'shadow-sm',
        'overflow-hidden'
      );
    });

    it('sets title attribute on logo container', () => {
      mockMerchantLogoService.getMerchantInfo.mockReturnValue(mockMerchantInfoNoDomain);

      render(<MerchantLogo description="Local Shop" />);

      const container = screen.getByRole('img', { name: 'Local Shop' }).parentElement;
      expect(container).toHaveAttribute('title', 'Local Shop');
    });
  });

  describe('Performance', () => {
    it('memoizes merchant info based on description', () => {
      mockMerchantLogoService.getMerchantInfo.mockReturnValue(mockMerchantInfo);
      mockMerchantLogoService.fetchLogoUrl.mockResolvedValue(null);

      const { rerender } = render(<MerchantLogo description="Amazon purchase" />);

      expect(mockMerchantLogoService.getMerchantInfo).toHaveBeenCalledTimes(1);

      // Re-render with same description
      rerender(<MerchantLogo description="Amazon purchase" />);

      // Should not call getMerchantInfo again due to memoization
      expect(mockMerchantLogoService.getMerchantInfo).toHaveBeenCalledTimes(1);

      // Re-render with different description
      rerender(<MerchantLogo description="Walmart purchase" />);

      // Should call getMerchantInfo again
      expect(mockMerchantLogoService.getMerchantInfo).toHaveBeenCalledTimes(2);
    });

    it('fetches logo only when merchant info changes', async () => {
      mockMerchantLogoService.getMerchantInfo.mockReturnValue(mockMerchantInfo);
      mockMerchantLogoService.fetchLogoUrl.mockResolvedValue('https://logo.clearbit.com/amazon.com');

      const { rerender } = render(<MerchantLogo description="Amazon" />);

      await waitFor(() => {
        expect(mockMerchantLogoService.fetchLogoUrl).toHaveBeenCalledTimes(1);
      });

      // Re-render with same props
      rerender(<MerchantLogo description="Amazon" />);

      // Should not fetch again
      expect(mockMerchantLogoService.fetchLogoUrl).toHaveBeenCalledTimes(1);

      // Change to different merchant
      mockMerchantLogoService.getMerchantInfo.mockReturnValue({
        ...mockMerchantInfo,
        name: 'Walmart',
        domain: 'walmart.com'
      });

      rerender(<MerchantLogo description="Walmart" />);

      await waitFor(() => {
        expect(mockMerchantLogoService.fetchLogoUrl).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles merchant info with empty values', () => {
      const emptyMerchantInfo = {
        name: '',
        domain: '',
        logo: '',
        color: '',
        category: ''
      };

      mockMerchantLogoService.getMerchantInfo.mockReturnValue(emptyMerchantInfo);

      render(<MerchantLogo description="Unknown" />);

      const logo = screen.getByRole('img', { name: '' });
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveTextContent('');
    });

    it('handles fetchLogoUrl rejection gracefully', async () => {
      mockMerchantLogoService.getMerchantInfo.mockReturnValue(mockMerchantInfo);
      mockMerchantLogoService.fetchLogoUrl.mockRejectedValue(new Error('Network error'));

      render(<MerchantLogo description="Amazon" />);

      // Wait for the promise to be handled
      await waitFor(() => {
        expect(mockMerchantLogoService.fetchLogoUrl).toHaveBeenCalled();
      });

      // After error, should fall back to emoji
      await waitFor(() => {
        expect(screen.getByRole('img', { name: 'Amazon' })).toHaveTextContent('🛒');
      });
    });
  });
});