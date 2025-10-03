// Shared AI service contracts

export interface ExplainContext {
  route: string;
  title?: string;
  // Optional lightweight signals from the page
  // e.g., counts, selected filters, entity focus
  signals?: Record<string, string | number | boolean | undefined>;
}

export interface ExplainResponse {
  title: string;
  markdown: string; // Render with react-markdown
  sources?: Array<{ label: string; path: string }>;
}

export interface AIServices {
  explainPage: (ctx: ExplainContext) => Promise<ExplainResponse>;
}

