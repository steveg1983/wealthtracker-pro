/**
 * ASK — the in-app assistant, as a button in the header and a panel beside the page.
 *
 * The owner, 14 Nov 2026: offered on the top tier only, switched on per
 * account. So the button is drawn only when the server says Ask is on for
 * this account (or that this month's questions are used up, so it can say
 * so); for everyone else there is nothing to see, not a locked door.
 *
 * Claude reads the ledger on the server through the connector's read tools
 * (api/assistant/ask.ts). The conversation lives in this component's state
 * and nowhere else: closing the panel keeps it for the visit, "New
 * conversation" clears it, and a reload forgets it.
 *
 * The panel is portalled to <body> for the reason EnhancedNotificationBell
 * gives: the app root is an isolated stacking context, so a fixed panel
 * inside it cannot rise above a portalled page tip.
 *
 * Cloud edition only: `@chrome` gives the desktop edition nothing here.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@clerk/clerk-react';
import { AskIcon, SendIcon, XIcon } from '../icons';
import { askQuestion, fetchAskStatus, type AskStatus, type AskTurn } from '../../services/assistant/assistantClient';
import { formatCount } from '../../utils/localeFormat';

const EXAMPLES = [
  'How much did we spend on eating out this year?',
  'Which budgets are over this month?',
  'How has my net worth changed since January?',
];

export default function AskAssistant(): React.JSX.Element | null {
  const { isSignedIn, getToken } = useAuth();
  const tokenSource = useRef(getToken);
  tokenSource.current = getToken;

  const [status, setStatus] = useState<AskStatus | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isSignedIn) {
      setStatus(null);
      return;
    }
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const token = await tokenSource.current();
        if (!token) return;
        const next = await fetchAskStatus(token);
        if (!cancelled) setStatus(next);
      } catch {
        // No answer is "not on": the button simply is not drawn.
        if (!cancelled) setStatus(null);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  useEffect(() => {
    if (!isOpen) return;
    // The newest line in view: the list scrolls itself to its foot.
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [isOpen, turns, isAsking]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const send = useCallback(async (question: string): Promise<void> => {
    const text = question.trim();
    if (text === '' || isAsking) return;
    const asked: AskTurn[] = [...turns, { role: 'user', content: text }];
    setTurns(asked);
    setDraft('');
    setProblem(null);
    setIsAsking(true);
    try {
      const token = await tokenSource.current();
      if (!token) throw new Error('Please sign in again to use Ask.');
      const reply = await askQuestion(token, asked);
      setTurns([...asked, { role: 'assistant', content: reply.answer }]);
      setStatus(previous => (previous ? { ...previous, used: reply.used, limit: reply.limit } : previous));
    } catch (error) {
      // The question goes back in the box, so nothing typed is lost.
      setTurns(turns);
      setDraft(text);
      setProblem(error instanceof Error ? error.message : 'Ask didn’t answer just now. Please try again in a moment.');
    } finally {
      setIsAsking(false);
    }
  }, [isAsking, turns]);

  if (!status || (!status.allowed && status.reason !== 'allowance_used')) {
    return null;
  }

  const allowanceUsed = !status.allowed;
  const left = Math.max(0, status.limit - status.used);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(open => !open)}
        className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
        aria-label="Ask about your money"
        aria-expanded={isOpen}
        title="Ask"
        data-testid="ask-open"
      >
        <AskIcon size={20} />
      </button>

      {isOpen && createPortal(
        <div className="fixed inset-0 z-[60] flex justify-end" data-testid="ask-panel">
          <button
            type="button"
            className="absolute inset-0 bg-black/30 cursor-default"
            aria-label="Close Ask"
            tabIndex={-1}
            onClick={() => setIsOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="ask-title"
            className="relative flex flex-col w-full sm:w-[28rem] h-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700"
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 id="ask-title" className="text-lg font-semibold text-gray-900 dark:text-white">Ask</h2>
              <div className="flex items-center gap-2">
                {turns.length > 0 && !isAsking && (
                  <button
                    type="button"
                    onClick={() => {
                      setTurns([]);
                      setProblem(null);
                    }}
                    className="text-sm text-primary hover:underline"
                  >
                    New conversation
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                  aria-label="Close"
                >
                  <XIcon size={18} />
                </button>
              </div>
            </header>

            <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4" aria-live="polite">
              {turns.length === 0 && (
                <div className="text-sm text-gray-600 dark:text-gray-300 space-y-3">
                  <p>Ask a question about your accounts, spending, budgets or net worth. Ask reads your ledger to answer; it can’t change anything.</p>
                  {!allowanceUsed && (
                    <ul className="space-y-2">
                      {EXAMPLES.map(example => (
                        <li key={example}>
                          <button
                            type="button"
                            onClick={() => void send(example)}
                            className="text-left w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            {example}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {turns.map((turn, index) => (
                <div
                  key={index}
                  className={turn.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                  data-testid={turn.role === 'user' ? 'ask-question' : 'ask-answer'}
                >
                  <div
                    className={
                      turn.role === 'user'
                        ? 'max-w-[85%] rounded-2xl px-3 py-2 bg-primary text-white whitespace-pre-wrap'
                        : 'max-w-[95%] text-gray-900 dark:text-gray-100 whitespace-pre-wrap'
                    }
                  >
                    {turn.content}
                  </div>
                </div>
              ))}

              {isAsking && (
                <p className="text-sm text-gray-500 dark:text-gray-400" role="status">Reading your ledger…</p>
              )}
              {problem && (
                <p className="text-sm text-red-700 dark:text-red-400" role="alert">{problem}</p>
              )}
            </div>

            <footer className="shrink-0 border-t border-gray-200 dark:border-gray-700 px-4 py-3 space-y-2">
              {allowanceUsed ? (
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  You’ve used this month’s {formatCount(status.limit)} questions. They start again on the 1st.
                </p>
              ) : (
                <form
                  className="flex items-end gap-2"
                  onSubmit={event => {
                    event.preventDefault();
                    void send(draft);
                  }}
                >
                  <label htmlFor="ask-input" className="sr-only">Your question</label>
                  <textarea
                    id="ask-input"
                    ref={inputRef}
                    value={draft}
                    onChange={event => setDraft(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void send(draft);
                      }
                    }}
                    rows={2}
                    maxLength={4000}
                    placeholder="Ask about your money"
                    className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-base text-gray-900 dark:text-gray-100"
                    disabled={isAsking}
                  />
                  <button
                    type="submit"
                    disabled={isAsking || draft.trim() === ''}
                    className="p-2.5 rounded-lg bg-primary text-white disabled:opacity-50"
                    aria-label="Send"
                  >
                    <SendIcon size={18} />
                  </button>
                </form>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Answers are written by Claude, from Anthropic, reading your ledger. They can be wrong, so check any figure that matters. Not financial advice.
                {!allowanceUsed && ` ${formatCount(left)} of ${formatCount(status.limit)} questions left this month.`}
              </p>
            </footer>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}
