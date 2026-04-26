// In-memory pub/sub for conversation events. Single-instance only — multi-instance
// apps/api will need Redis pub/sub or Postgres LISTEN/NOTIFY.

export interface AgentEventEnvelope {
  id: string;          // stringified bigserial id
  conversationId: string;
  workspaceId: string;
  type: string;
  payload: unknown;
  createdAt: string;   // ISO timestamp
}

type Listener = (event: AgentEventEnvelope) => void;

const subscribers = new Map<string, Set<Listener>>();

export function subscribe(conversationId: string, fn: Listener): () => void {
  let set = subscribers.get(conversationId);
  if (!set) {
    set = new Set();
    subscribers.set(conversationId, set);
  }
  set.add(fn);
  return () => {
    const s = subscribers.get(conversationId);
    if (!s) return;
    s.delete(fn);
    if (s.size === 0) subscribers.delete(conversationId);
  };
}

export function publish(conversationId: string, event: AgentEventEnvelope): void {
  const set = subscribers.get(conversationId);
  if (!set) return;
  for (const fn of set) {
    try {
      fn(event);
    } catch (err) {
      console.error("[event-bus] subscriber threw", err);
    }
  }
}

export function subscriberCount(conversationId: string): number {
  return subscribers.get(conversationId)?.size ?? 0;
}
