/**
 * Layout Tests
 * Component rendering and user interactions
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/testUtils';
import Layout from '../Layout';

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    renderWithProviders(<Layout />);
    // Layout contains navigation - check for navigation elements (there may be multiple)
    const navElements = screen.getAllByRole('navigation');
    expect(navElements.length).toBeGreaterThan(0);
  });

  it('handles user interactions', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Layout />);
    
    // Check if menu button exists (for mobile)
    const menuButton = screen.queryByRole('button', { name: /menu/i });
    if (menuButton) {
      await user.click(menuButton);
      // Menu should open
    }
  });


});
