/**
 * The app's side of the in-app assistant: ask the server whether Ask is on,
 * and send it a question.
 *
 * Both routes are behind the app's own sign-in, so every call carries the
 * session token the caller fetched. Nothing here stores the conversation:
 * it lives in the panel's state and is gone when the panel is closed.
 */

export type AskRefusal = 'not_switched_on' | 'not_on_pro' | 'allowance_used';

export interface AskStatus {
  allowed: boolean;
  reason: AskRefusal | null;
  used: number;
  limit: number;
}

export interface AskTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskAnswer {
  answer: string;
  used: number;
  limit: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const REFUSALS: readonly AskRefusal[] = ['not_switched_on', 'not_on_pro', 'allowance_used'];
const asRefusal = (value: unknown): AskRefusal | null =>
  REFUSALS.find(refusal => refusal === value) ?? null;

const readJson = async (response: Response): Promise<Record<string, unknown>> => {
  const payload: unknown = await response.json().catch(() => ({}));
  return isRecord(payload) ? payload : {};
};

/** Whether Ask is on for this account. Anything unreadable is "not on": a button that would fail is not drawn. */
export async function fetchAskStatus(sessionToken: string): Promise<AskStatus> {
  const response = await fetch('/api/assistant/status', {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  const answer = await readJson(response);
  if (!response.ok) {
    return { allowed: false, reason: null, used: 0, limit: 0 };
  }
  return {
    allowed: answer.allowed === true,
    reason: asRefusal(answer.reason),
    used: typeof answer.used === 'number' ? answer.used : 0,
    limit: typeof answer.limit === 'number' ? answer.limit : 0,
  };
}

/** One question, with the conversation so far. Throws with the server's own words when it refuses. */
export async function askQuestion(sessionToken: string, messages: AskTurn[]): Promise<AskAnswer> {
  const response = await fetch('/api/assistant/ask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ messages }),
  });
  const answer = await readJson(response);
  if (!response.ok) {
    const said = typeof answer.error === 'string' && answer.error !== ''
      ? answer.error
      : 'Ask didn’t answer just now. Please try again in a moment.';
    throw new Error(said);
  }
  if (typeof answer.answer !== 'string') {
    throw new Error('Ask didn’t answer just now. Please try again in a moment.');
  }
  return {
    answer: answer.answer,
    used: typeof answer.used === 'number' ? answer.used : 0,
    limit: typeof answer.limit === 'number' ? answer.limit : 0,
  };
}
