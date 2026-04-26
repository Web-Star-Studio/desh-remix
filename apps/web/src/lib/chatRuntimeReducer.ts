import type { AgentEventEnvelope } from "@/lib/chat-stream";

/**
 * Per-conversation runtime state derived from the SSE event stream.
 *
 * The chat panel renders persisted user/assistant messages directly from
 * the event stream as before; this reducer captures the *non-message* rich
 * events (tool calls, reasoning summaries, run lifecycle, streaming
 * drafts) so the UI can render them inline alongside messages.
 *
 * Source of truth: a `message` (assistant_message) event for a given
 * `run_id` always wins over the streaming draft for that run — once the
 * persisted message arrives the draft is cleared.
 */

export interface RunState {
  status: "running" | "completed" | "failed";
  startedAt?: string;
  durationMs?: number;
  error?: string;
}

export interface DraftState {
  text: string;
  // Last seen `index` so we can reject out-of-order chunks.
  lastIndex: number;
}

export interface ToolState {
  id: string;
  name: string;
  status: "running" | "completed" | "failed";
  preview?: string;
  argsKeys: string[];
  durationMs?: number;
  resultPreview?: string;
}

export interface StepState {
  runId: string;
  iteration: number;
  toolNames: string[];
}

export interface ReasoningState {
  status: "started" | "available";
  summary?: string;
  truncated?: boolean;
}

export interface StatusEntry {
  runId: string;
  status: string;
  content: string;
  timestamp: string;
}

export interface HermesRuntimeState {
  runs: Record<string, RunState>;
  drafts: Record<string, DraftState>;
  tools: Record<string, ToolState>;
  steps: StepState[];
  reasoning: Record<string, ReasoningState>;
  statuses: StatusEntry[];
}

export const initialRuntimeState: HermesRuntimeState = {
  runs: {},
  drafts: {},
  tools: {},
  steps: [],
  reasoning: {},
  statuses: [],
};

const MAX_STEPS = 50;
const MAX_STATUSES = 50;

// Derives a stable key for the streaming draft. Hermes attaches a `run_id`
// to most events; when missing (legacy callers) we fall back to the
// `message_id`. Anchoring to run_id lets the UI collapse the draft once
// the matching `message` event lands.
function runKey(p: AgentEventEnvelope["payload"]): string {
  return p.run_id ?? p.message_id ?? "default";
}

export function chatRuntimeReducer(
  state: HermesRuntimeState,
  event: AgentEventEnvelope,
): HermesRuntimeState {
  const p = event.payload;
  switch (event.type) {
    case "run.started": {
      const id = runKey(p);
      return {
        ...state,
        runs: { ...state.runs, [id]: { status: "running", startedAt: event.createdAt } },
      };
    }
    case "run.completed": {
      const id = runKey(p);
      const prev = state.runs[id];
      return {
        ...state,
        runs: {
          ...state.runs,
          [id]: {
            ...(prev ?? {}),
            status: "completed",
            durationMs: p.duration_ms ?? prev?.durationMs,
          },
        },
        drafts: removeKey(state.drafts, id), // collapse the draft once the run finishes
      };
    }
    case "run.failed": {
      const id = runKey(p);
      const prev = state.runs[id];
      return {
        ...state,
        runs: {
          ...state.runs,
          [id]: { ...(prev ?? {}), status: "failed", error: p.error },
        },
      };
    }
    case "message.delta": {
      const id = runKey(p);
      const prev = state.drafts[id];
      const idx = p.index ?? (prev?.lastIndex ?? -1) + 1;
      // Reject out-of-order or duplicate chunks. v1 trade-off — drop
      // anything we've already accounted for; UI just stops accumulating.
      if (prev && idx <= prev.lastIndex) return state;
      return {
        ...state,
        drafts: {
          ...state.drafts,
          [id]: { text: (prev?.text ?? "") + (p.delta ?? ""), lastIndex: idx },
        },
      };
    }
    case "tool.started": {
      const id = p.tool_call_id;
      if (!id) return state;
      return {
        ...state,
        tools: {
          ...state.tools,
          [id]: {
            id,
            name: p.tool_name ?? "tool",
            status: "running",
            preview: p.preview,
            argsKeys: p.args_keys ?? [],
          },
        },
      };
    }
    case "tool.completed":
    case "tool.failed": {
      const id = p.tool_call_id;
      if (!id) return state;
      const prev = state.tools[id];
      return {
        ...state,
        tools: {
          ...state.tools,
          [id]: {
            id,
            name: p.tool_name ?? prev?.name ?? "tool",
            argsKeys: prev?.argsKeys ?? [],
            preview: prev?.preview,
            status: event.type === "tool.completed" ? "completed" : "failed",
            durationMs: p.duration_ms,
            resultPreview: p.result_preview,
          },
        },
      };
    }
    case "step.completed": {
      const next: StepState = {
        runId: runKey(p),
        iteration: p.iteration ?? 0,
        toolNames: p.tool_names ?? [],
      };
      return {
        ...state,
        steps: [...state.steps, next].slice(-MAX_STEPS),
      };
    }
    case "reasoning.started": {
      const id = runKey(p);
      return {
        ...state,
        reasoning: { ...state.reasoning, [id]: { status: "started" } },
      };
    }
    case "reasoning.summary": {
      const id = runKey(p);
      return {
        ...state,
        reasoning: {
          ...state.reasoning,
          [id]: { status: "available", summary: p.summary, truncated: p.truncated },
        },
      };
    }
    case "status": {
      const next: StatusEntry = {
        runId: runKey(p),
        status: p.status ?? "unknown",
        content: p.content ?? "",
        timestamp: event.createdAt,
      };
      return {
        ...state,
        statuses: [...state.statuses, next].slice(-MAX_STATUSES),
      };
    }
    case "assistant_message": {
      // The persisted assistant message is the authoritative end-of-run
      // artifact. Clear the streaming draft for whichever run it belongs
      // to so the rendered Message takes over from the AssistantDraft.
      const id = runKey(p);
      return {
        ...state,
        drafts: removeKey(state.drafts, id),
      };
    }
    default:
      return state;
  }
}

function removeKey<T>(map: Record<string, T>, key: string): Record<string, T> {
  if (!(key in map)) return map;
  const { [key]: _removed, ...rest } = map;
  void _removed;
  return rest;
}
