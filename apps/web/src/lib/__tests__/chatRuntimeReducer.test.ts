import { describe, expect, it } from "vitest";
import { chatRuntimeReducer, initialRuntimeState } from "@/lib/chatRuntimeReducer";
import type { AgentEventEnvelope } from "@/lib/chat-stream";

function event(type: string, payload: AgentEventEnvelope["payload"], id = "evt"): AgentEventEnvelope {
  return {
    id,
    conversationId: "conv-1",
    workspaceId: "ws-1",
    type,
    payload,
    createdAt: "2026-04-26T00:00:00Z",
  };
}

describe("chatRuntimeReducer", () => {
  it("run.started records a running run keyed by run_id", () => {
    const s = chatRuntimeReducer(initialRuntimeState, event("run.started", { run_id: "r1", status: "running" }));
    expect(s.runs).toEqual({ r1: { status: "running", startedAt: "2026-04-26T00:00:00Z" } });
  });

  it("run.completed flips the run to completed and clears the draft", () => {
    let s = chatRuntimeReducer(initialRuntimeState, event("run.started", { run_id: "r1" }));
    s = chatRuntimeReducer(s, event("message.delta", { run_id: "r1", delta: "hi", index: 0 }));
    expect(s.drafts.r1?.text).toBe("hi");
    s = chatRuntimeReducer(s, event("run.completed", { run_id: "r1", duration_ms: 1234 }));
    expect(s.runs.r1?.status).toBe("completed");
    expect(s.runs.r1?.durationMs).toBe(1234);
    expect(s.drafts.r1).toBeUndefined();
  });

  it("run.failed marks the run failed and stores the error", () => {
    const s = chatRuntimeReducer(initialRuntimeState, event("run.failed", { run_id: "r1", error: "oops" }));
    expect(s.runs.r1).toEqual({ status: "failed", error: "oops" });
  });

  it("message.delta accumulates text in order", () => {
    let s = chatRuntimeReducer(initialRuntimeState, event("message.delta", { run_id: "r1", delta: "Hel", index: 0 }));
    s = chatRuntimeReducer(s, event("message.delta", { run_id: "r1", delta: "lo ", index: 1 }));
    s = chatRuntimeReducer(s, event("message.delta", { run_id: "r1", delta: "world", index: 2 }));
    expect(s.drafts.r1?.text).toBe("Hello world");
    expect(s.drafts.r1?.lastIndex).toBe(2);
  });

  it("message.delta drops out-of-order chunks", () => {
    let s = chatRuntimeReducer(initialRuntimeState, event("message.delta", { run_id: "r1", delta: "Hello", index: 0 }));
    s = chatRuntimeReducer(s, event("message.delta", { run_id: "r1", delta: "world", index: 2 }));
    // index 1 arrives late — should be dropped (lastIndex is already 2)
    s = chatRuntimeReducer(s, event("message.delta", { run_id: "r1", delta: "MIDDLE", index: 1 }));
    expect(s.drafts.r1?.text).toBe("Helloworld");
  });

  it("tool.started → tool.completed records the lifecycle", () => {
    let s = chatRuntimeReducer(initialRuntimeState, event("tool.started", {
      tool_call_id: "call_1",
      tool_name: "list_tasks",
      args_keys: ["status"],
      preview: '{"status":"todo"}',
    }));
    expect(s.tools.call_1?.status).toBe("running");
    s = chatRuntimeReducer(s, event("tool.completed", {
      tool_call_id: "call_1",
      tool_name: "list_tasks",
      duration_ms: 50,
      result_preview: "[]",
    }));
    expect(s.tools.call_1).toEqual({
      id: "call_1",
      name: "list_tasks",
      argsKeys: ["status"],
      preview: '{"status":"todo"}',
      status: "completed",
      durationMs: 50,
      resultPreview: "[]",
    });
  });

  it("tool.failed flips status to failed and keeps prev preview/argsKeys", () => {
    let s = chatRuntimeReducer(initialRuntimeState, event("tool.started", {
      tool_call_id: "call_2",
      tool_name: "browser",
      args_keys: ["url"],
    }));
    s = chatRuntimeReducer(s, event("tool.failed", {
      tool_call_id: "call_2",
      tool_name: "browser",
      duration_ms: 800,
      result_preview: "Network error",
    }));
    expect(s.tools.call_2?.status).toBe("failed");
    expect(s.tools.call_2?.argsKeys).toEqual(["url"]);
    expect(s.tools.call_2?.resultPreview).toBe("Network error");
  });

  it("step.completed appends with bounded length", () => {
    let s = initialRuntimeState;
    for (let i = 0; i < 60; i++) {
      s = chatRuntimeReducer(s, event("step.completed", { run_id: "r1", iteration: i, tool_names: ["a"] }));
    }
    expect(s.steps).toHaveLength(50);
    expect(s.steps[0]!.iteration).toBe(10); // first 10 dropped
    expect(s.steps[49]!.iteration).toBe(59);
  });

  it("reasoning.started then reasoning.summary transitions state", () => {
    let s = chatRuntimeReducer(initialRuntimeState, event("reasoning.started", { run_id: "r1", status: "streaming" }));
    expect(s.reasoning.r1?.status).toBe("started");
    s = chatRuntimeReducer(s, event("reasoning.summary", { run_id: "r1", summary: "Capped excerpt", truncated: true }));
    expect(s.reasoning.r1).toEqual({ status: "available", summary: "Capped excerpt", truncated: true });
  });

  it("status entries accumulate and clamp to 50", () => {
    let s = initialRuntimeState;
    for (let i = 0; i < 60; i++) {
      s = chatRuntimeReducer(s, event("status", { run_id: "r1", status: "context_pressure", content: `n=${i}` }));
    }
    expect(s.statuses).toHaveLength(50);
    expect(s.statuses[0]!.content).toBe("n=10");
  });

  it("assistant_message clears the draft for that run_id", () => {
    let s = chatRuntimeReducer(initialRuntimeState, event("message.delta", { run_id: "r1", delta: "draft", index: 0 }));
    expect(s.drafts.r1?.text).toBe("draft");
    s = chatRuntimeReducer(s, event("assistant_message", { run_id: "r1", content: "final" }));
    expect(s.drafts.r1).toBeUndefined();
  });

  it("falls back to message_id when run_id is absent", () => {
    const s = chatRuntimeReducer(initialRuntimeState, event("run.started", { message_id: "msg_1" }));
    expect(s.runs.msg_1?.status).toBe("running");
  });

  it("ignores unrelated event types unchanged", () => {
    const s = chatRuntimeReducer(initialRuntimeState, event("user_message", { text: "hello" }));
    expect(s).toBe(initialRuntimeState);
  });
});
