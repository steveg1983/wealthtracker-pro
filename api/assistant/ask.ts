/**
 * `POST /api/assistant/ask` — one question to the in-app assistant.
 *
 *   { "messages": [{ "role": "user", "content": "…" }, …] }
 *     → 200 { answer, used, limit }
 *     → 400 the conversation could not be read (the message says why)
 *     → 403 { code: 'not_switched_on' | 'not_on_pro' | 'allowance_used' }
 *     → 502 Claude did not answer
 *     → 503 the server holds no ANTHROPIC_API_KEY
 *
 * The order of questions matters for cost: who is asking, whether Ask is on
 * for them and within allowance, and only then a call that is billed.
 *
 * Claude reads the ledger through the connector's READ tools over a port
 * scoped to the verified session (see _lib/assistant/ledgerTools.ts), so it
 * can neither change anything nor see anyone else's money. One usage row is
 * written per answered question: model, tokens, tool calls — never the words.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AccessLookupError, readAssistantAccess } from '../_lib/assistant/access.js';
import { ASSISTANT_MODEL, ConversationRefusal, answerQuestion, readConversation } from '../_lib/assistant/answer.js';
import { openLedgerTools } from '../_lib/assistant/ledgerTools.js';
import { AuthError, requireAuth } from '../_lib/auth.js';
import { setCorsHeaders } from '../_lib/cors.js';
import { getOptionalEnv } from '../_lib/env.js';
import { createErrorResponse } from '../_lib/http-error.js';
import { createSupabasePort } from '../_lib/mcp/port.js';
import { applyRateLimit } from '../_lib/rate-limit.js';
import { withSentry } from '../_lib/sentry.js';
import { getServiceRoleSupabase } from '../_lib/supabase.js';

const REFUSALS = {
  not_switched_on: 'Ask isn’t switched on for this account.',
  not_on_pro: 'Ask is part of the Pro plan.',
  allowance_used: 'You’ve used this month’s questions. They start again on the 1st.',
} as const;

/** "14 November 2026", as the person in London would say it. */
const todayInLondon = (now: Date): string =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' }).format(now);

let client: Anthropic | null = null;
const getClient = (apiKey: string): Anthropic => {
  if (!client) client = new Anthropic({ apiKey, maxRetries: 2 });
  return client;
};

async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCorsHeaders(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return createErrorResponse(res, 405, 'Method not allowed', 'method_not_allowed');
  }

  // A person asking is a question every few seconds at most; more is a loop.
  if (await applyRateLimit(req, res, { name: 'assistant-ask', limit: 20, windowMs: 60_000 })) {
    return;
  }

  try {
    const auth = await requireAuth(req);

    const apiKey = getOptionalEnv('ANTHROPIC_API_KEY') ?? '';
    if (apiKey === '') {
      return createErrorResponse(res, 503, 'Ask isn’t available yet.', 'not_configured');
    }

    let conversation;
    try {
      conversation = readConversation(req.body);
    } catch (error) {
      if (error instanceof ConversationRefusal) {
        return createErrorResponse(res, 400, error.message, 'invalid_request');
      }
      throw error;
    }

    const supabase = getServiceRoleSupabase();
    const now = new Date();
    const access = await readAssistantAccess(supabase, auth.userId, now);
    if (!access.allowed && access.reason) {
      return createErrorResponse(res, 403, REFUSALS[access.reason], access.reason);
    }

    const tools = await openLedgerTools(createSupabasePort(supabase, auth.userId, { clientId: 'reckley-assistant' }));
    let outcome;
    try {
      const anthropic = getClient(apiKey);
      outcome = await answerQuestion({
        create: params => anthropic.beta.messages.create(params),
        tools,
        conversation,
        today: todayInLondon(now),
      });
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        return createErrorResponse(
          res,
          502,
          'Claude didn’t answer just now. Please try again in a moment.',
          'assistant_unavailable',
          `${error.status ?? 'no status'}: ${error.message}`
        );
      }
      throw error;
    } finally {
      await tools.close();
    }

    // Counted whether or not Claude declined: the call was made and billed.
    const logged = await supabase.from('assistant_usage').insert({
      user_id: auth.userId,
      model: ASSISTANT_MODEL,
      input_tokens: outcome.inputTokens,
      output_tokens: outcome.outputTokens,
      tool_calls: outcome.toolCalls,
    });
    if (logged.error) {
      // The answer is still the person's; a missing row under-counts the
      // allowance by one, which the log makes findable.
      console.error('[assistant] usage row not written', { code: logged.error.code, message: logged.error.message });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      answer: outcome.answer,
      used: access.used + 1,
      limit: access.limit,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(res, error.status, error.message, error.code);
    }
    if (error instanceof AccessLookupError) {
      return createErrorResponse(res, 500, 'Could not check whether Ask is on', 'internal_error', error.message);
    }
    throw error;
  }
}

export default withSentry(handler);
