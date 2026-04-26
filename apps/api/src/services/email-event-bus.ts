// In-memory pub/sub for email-cache events. Keyed by workspaceId (not by
// connection or by user) because the SPA inbox view is workspace-scoped and
// renders all connections together. Separate from `event-bus.ts` because the
// envelope shape is different and we don't want crosstalk between agent
// events and email events.
//
// Like event-bus.ts, this is single-instance only — multi-host apps/api
// deployments will need Redis/PG LISTEN/NOTIFY.

export type EmailEventType = "upsert" | "delete";

export interface EmailEventEnvelope {
  type: EmailEventType;
  workspaceId: string;
  // For "upsert": the gmail_ids of rows touched. The SPA can fetch the new
  // shapes via GET /workspaces/:id/emails on receipt; we don't push the full
  // row to keep the payload small and avoid leaking jsonb fields the route
  // would otherwise filter.
  gmailIds: string[];
  // For "delete": same as above — gmail_ids that were removed.
  ts: string; // ISO timestamp
}

type Listener = (event: EmailEventEnvelope) => void;

const subscribers = new Map<string, Set<Listener>>();

export function subscribeEmailBus(workspaceId: string, fn: Listener): () => void {
  let set = subscribers.get(workspaceId);
  if (!set) {
    set = new Set();
    subscribers.set(workspaceId, set);
  }
  set.add(fn);
  return () => {
    const s = subscribers.get(workspaceId);
    if (!s) return;
    s.delete(fn);
    if (s.size === 0) subscribers.delete(workspaceId);
  };
}

export function publishEmailEvent(event: EmailEventEnvelope): void {
  const set = subscribers.get(event.workspaceId);
  if (!set) return;
  for (const fn of set) {
    try {
      fn(event);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[email-event-bus] subscriber threw", err);
    }
  }
}

export function emailSubscriberCount(workspaceId: string): number {
  return subscribers.get(workspaceId)?.size ?? 0;
}
