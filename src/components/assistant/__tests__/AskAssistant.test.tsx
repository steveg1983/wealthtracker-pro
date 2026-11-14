/**
 * ASK, AS A PERSON SEES IT: nothing at all unless it is switched on for the
 * account; a panel that sends the conversation and shows the answer; a
 * failure that keeps what was typed.
 *
 * The server is a stubbed fetch (a browser API); the routes behind it are
 * specified in src/test/api-lib/assistant.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import AskAssistant from '../AskAssistant';

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isSignedIn: true, getToken: async () => 'session-token' }),
}));

type Reply = { status: number; body: unknown };

let statusReply: Reply;
let askReplies: Reply[];
let asked: unknown[];

const respond = (reply: Reply): Response =>
  new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  statusReply = { status: 200, body: { allowed: true, reason: null, used: 3, limit: 200, configured: true } };
  askReplies = [];
  asked = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/assistant/status') return respond(statusReply);
    if (url === '/api/assistant/ask') {
      asked.push(JSON.parse(String(init?.body)));
      const next = askReplies.shift();
      if (!next) throw new Error('no reply scripted');
      return respond(next);
    }
    throw new Error(`unexpected fetch ${url}`);
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Ask: the in-app assistant', () => {
  it('draws nothing for an account it is not switched on for', async () => {
    statusReply = { status: 200, body: { allowed: false, reason: 'not_switched_on', used: 0, limit: 0, configured: true } };
    const { container } = render(<AskAssistant />);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/assistant/status', expect.anything()));
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('ask-open')).not.toBeInTheDocument();
  });

  it('draws nothing when the server cannot say', async () => {
    statusReply = { status: 500, body: { error: 'no' } };
    const { container } = render(<AskAssistant />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('asks a question, sends it with the signed-in session, and shows the answer and what is left', async () => {
    askReplies = [{ status: 200, body: { answer: 'You spent £120.00 on eating out.', used: 4, limit: 200 } }];
    render(<AskAssistant />);
    fireEvent.click(await screen.findByTestId('ask-open'));

    const panel = screen.getByTestId('ask-panel');
    expect(within(panel).getByText(/197 of 200 questions left this month/)).toBeInTheDocument();
    expect(within(panel).getByText(/Not financial advice/)).toBeInTheDocument();

    fireEvent.change(within(panel).getByLabelText('Your question'), { target: { value: 'How much on eating out?' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Send' }));

    expect(await within(panel).findByText('You spent £120.00 on eating out.')).toBeInTheDocument();
    expect(asked).toEqual([{ messages: [{ role: 'user', content: 'How much on eating out?' }] }]);
    const [, init] = vi.mocked(fetch).mock.calls.find(([url]) => url === '/api/assistant/ask') ?? [];
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer session-token');
    expect(within(panel).getByText(/196 of 200 questions left this month/)).toBeInTheDocument();
  });

  it('sends the whole conversation with a follow-up', async () => {
    askReplies = [
      { status: 200, body: { answer: 'First answer.', used: 4, limit: 200 } },
      { status: 200, body: { answer: 'Second answer.', used: 5, limit: 200 } },
    ];
    render(<AskAssistant />);
    fireEvent.click(await screen.findByTestId('ask-open'));
    const panel = screen.getByTestId('ask-panel');
    fireEvent.click(within(panel).getByRole('button', { name: 'Which budgets are over this month?' }));
    await within(panel).findByText('First answer.');

    fireEvent.change(within(panel).getByLabelText('Your question'), { target: { value: 'And last month?' } });
    fireEvent.keyDown(within(panel).getByLabelText('Your question'), { key: 'Enter' });
    await within(panel).findByText('Second answer.');

    expect(asked[1]).toEqual({ messages: [
      { role: 'user', content: 'Which budgets are over this month?' },
      { role: 'assistant', content: 'First answer.' },
      { role: 'user', content: 'And last month?' },
    ] });
  });

  it('a failure says why and puts the question back in the box', async () => {
    askReplies = [{ status: 502, body: { error: 'Claude didn’t answer just now. Please try again in a moment.', code: 'assistant_unavailable' } }];
    render(<AskAssistant />);
    fireEvent.click(await screen.findByTestId('ask-open'));
    const panel = screen.getByTestId('ask-panel');
    fireEvent.change(within(panel).getByLabelText('Your question'), { target: { value: 'My net worth?' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Send' }));

    expect(await within(panel).findByRole('alert')).toHaveTextContent('Claude didn’t answer just now');
    expect(within(panel).getByLabelText('Your question')).toHaveValue('My net worth?');
    expect(within(panel).queryByTestId('ask-question')).not.toBeInTheDocument();
  });

  it('when the month’s questions are used, it says so and offers no box', async () => {
    statusReply = { status: 200, body: { allowed: false, reason: 'allowance_used', used: 200, limit: 200, configured: true } };
    render(<AskAssistant />);
    fireEvent.click(await screen.findByTestId('ask-open'));
    const panel = screen.getByTestId('ask-panel');
    expect(within(panel).getByText(/used this month’s 200 questions/)).toBeInTheDocument();
    expect(within(panel).queryByLabelText('Your question')).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    render(<AskAssistant />);
    fireEvent.click(await screen.findByTestId('ask-open'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('ask-panel')).not.toBeInTheDocument();
  });
});
