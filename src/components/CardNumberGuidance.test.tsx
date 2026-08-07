import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CardNumberGuidance from './CardNumberGuidance';

describe('CardNumberGuidance', () => {
  it('states the rule before anything has been typed', () => {
    render(<CardNumberGuidance value="" />);

    expect(
      screen.getByText(/Only the last 4 digits are ever saved/)
    ).toBeInTheDocument();
  });

  it('stays quiet while the field holds four digits or fewer', () => {
    render(<CardNumberGuidance value="9012" />);

    // The live region is there but empty — it has to pre-exist its own message
    // for a screen reader to announce it.
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('names the four digits that will survive a pasted card number', () => {
    render(<CardNumberGuidance value="4929123456789012" />);

    const panel = screen.getByRole('status');
    expect(panel).toHaveTextContent('That is 16 digits.');
    expect(panel).toHaveTextContent('Saving will store 9012 and discard the rest.');
  });

  it('offers no action, because keeping a full card number is not on offer', () => {
    render(<CardNumberGuidance value="4929123456789012" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
