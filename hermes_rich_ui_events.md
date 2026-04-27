# Hermes Rich UI Events

Hermes now supports opt-in rich runtime events for the `saas_web` gateway adapter. Enable them in the Desh Hermes profile with:

```env
SAAS_WEB_RICH_EVENTS=true
```

Production delivery is still `POST /internal/hermes/events` from the adapter callback. Local/dev fallback can poll Hermes at `GET /events/{conversation_id}?after=<seq>`. The final assistant `event: "message"` remains the canonical persisted assistant message.

## Shared Package

Update `packages/shared/src/schemas.ts` to replace the broad `HermesOutboundEventSchema` with a discriminated union keyed by `event`. Re-export the inferred union from `packages/shared/src/index.ts` if the current barrel export needs adjustment.

Keep compatibility for existing events:

- `message`
- `typing`
- `error`

Add typed variants for:

- `run.started`
- `run.completed`
- `run.failed`
- `message.delta`
- `tool.started`
- `tool.completed`
- `tool.failed`
- `step.completed`
- `reasoning.started`
- `reasoning.summary`
- `status`

Common envelope:

```json
{
  "seq": 12,
  "event": "tool.started",
  "platform": "saas_web",
  "conversation_id": "conv_123",
  "workspace_id": "ws_123",
  "workspace_name": "Personal",
  "message_id": "evt_abc",
  "timestamp": "2026-04-26T00:00:00+00:00",
  "run_id": "msg_user_123",
  "reply_to": "msg_user_123",
  "parent_message_id": "msg_user_123",
  "metadata": {}
}
```

Example payloads:

```json
{ "event": "run.started", "status": "running" }
{ "event": "message.delta", "delta": "Hello", "index": 1 }
{ "event": "tool.started", "tool_call_id": "call_1", "tool_name": "terminal", "preview": "{\"command\":\"pwd\"}", "args_keys": ["command"] }
{ "event": "tool.completed", "tool_call_id": "call_1", "tool_name": "terminal", "duration_ms": 1234, "result_preview": "..." }
{ "event": "tool.failed", "tool_call_id": "call_2", "tool_name": "browser", "duration_ms": 500, "result_preview": "..." }
{ "event": "step.completed", "iteration": 2, "tool_names": ["terminal"] }
{ "event": "reasoning.started", "status": "streaming" }
{ "event": "reasoning.summary", "summary": "Capped safe summary/excerpt.", "truncated": true }
{ "event": "status", "status": "context_pressure", "content": "Context pressure is high." }
{ "event": "run.completed", "duration_ms": 12000 }
{ "event": "run.failed", "error": "safe error preview" }
```

## API App

Update these `apps/api` modules:

- `apps/api/src/modules/hermes/hermes.routes.ts`: keep accepting callbacks at `POST /internal/hermes/events` and parse the new union schema.
- `apps/api/src/modules/hermes/hermes-adapter.client.ts`: parse polled `/events/{conversation_id}` responses with the same union schema.
- `apps/api/src/modules/hermes/hermes-event.repository.ts`: store every rich event, deduplicate by `seq` and `message_id`, and preserve ordering by `seq`.
- `apps/api/src/modules/hermes/hermes-event-bus.ts`: continue publishing every event object unchanged.
- `apps/api/src/modules/conversations/conversation.service.ts`: only `event === "message"` creates a persisted assistant `ChatMessage`; all other events are event-repository/SSE runtime state only.
- `apps/api/src/modules/conversations/conversation.routes.ts`: continue forwarding every stored and live event through SSE as `event: hermes`.
- `apps/api/src/modules/profiles/profile-manager.ts`: include `SAAS_WEB_RICH_EVENTS=true` in the Hermes profile `.env` projection/runtime environment for Desh-managed profiles.
- Do not expose adapter secrets, callback keys, or Hermes ports to the browser.

Backend persistence rule: runtime events are ephemeral conversation state; persisted `ChatMessage` rows come only from final `message` events.

## Web App

Update these `apps/web` modules:

- `apps/web/src/api/client.ts`: use the new shared `HermesOutboundEvent` union for `listEvents` and `openConversationEventStream`.
- `apps/web/src/App.tsx`: replace the current `typing/message/error`-only event handling with a per-conversation runtime event reducer.
- `apps/web/src/components/ConversationView.tsx`: accept and render runtime state alongside persisted `messages`.
- `apps/web/src/components/Message.tsx`: leave persisted `ChatMessage` rendering as the final source of truth.
- Add focused components as needed, for example `apps/web/src/components/ToolCall.tsx`, `apps/web/src/components/StepTimeline.tsx`, `apps/web/src/components/ReasoningSummary.tsx`, and `apps/web/src/components/AssistantDraft.tsx`.

Suggested reducer state:

```ts
type HermesRuntimeState = {
  runs: Record<string, { status: "running" | "completed" | "failed"; startedAt?: string; durationMs?: number; error?: string }>;
  drafts: Record<string, { text: string; lastIndex: number }>;
  tools: Record<string, { id: string; name: string; status: "running" | "completed" | "failed"; preview?: string; argsKeys: string[]; durationMs?: number; resultPreview?: string }>;
  steps: Array<{ runId: string; iteration: number; toolNames: string[] }>;
  reasoning: Record<string, { status: "started" | "available"; summary?: string; truncated?: boolean }>;
  statuses: Array<{ runId: string; status: string; content: string; timestamp: string }>;
};
```

Render:

- Streaming assistant draft from `message.delta`.
- Tool cards from `tool.started`, `tool.completed`, and `tool.failed`.
- Step timeline from `step.completed`.
- Reasoning summary panel from `reasoning.summary`.
- Run status from `run.started`, `run.completed`, `run.failed`, and `status`.

After the final persisted `message` arrives, treat the persisted `ChatMessage` as source of truth and clear or collapse the streaming draft for that `run_id`.

## Safety Notes

Hermes does not emit full raw chain-of-thought. `reasoning.summary` is capped and sanitized. Tool arguments and results are previews only; raw tool results are not sent through rich events.