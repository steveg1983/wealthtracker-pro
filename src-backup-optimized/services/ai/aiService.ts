import type { AIServices, ExplainContext, ExplainResponse } from './types';
import { localAdapter } from './localAdapter';

// Adapter selection (future: cloud/edge adapters)
const adapter: AIServices = localAdapter;

export const aiService = {
  explainPage: (ctx: ExplainContext): Promise<ExplainResponse> => adapter.explainPage(ctx),
};

export type { ExplainContext, ExplainResponse } from './types';

