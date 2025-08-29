type MetricEvent = {
  name: string;
  at: number;
  payload?: Record<string, unknown>;
};

const KEY = 'ai_metrics_v1';

function load(): MetricEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MetricEvent[]) : [];
  } catch {
    return [];
  }
}

function save(events: MetricEvent[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(events.slice(-500))); // cap
  } catch {
    // ignore
  }
}

export function recordEvent(name: string, payload?: Record<string, unknown>) {
  const events = load();
  events.push({ name, at: Date.now(), payload });
  save(events);
}

export function getEvents(): MetricEvent[] {
  return load();
}

