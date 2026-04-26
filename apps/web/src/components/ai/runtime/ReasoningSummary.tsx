import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";
import type { ReasoningState } from "@/lib/chatRuntimeReducer";

// Renders Hermes' capped reasoning summary. The component uses AI Elements'
// `Reasoning` collapsible — open while streaming ("Thinking..."), closed
// once the summary is available unless the user expands it. Hermes only
// emits the summary, never the raw chain-of-thought, so what's shown here
// is the same safe excerpt that gets persisted to agent_events.
export const ReasoningSummary = ({ state }: { state: ReasoningState }) => {
  const isStreaming = state.status === "started";
  // ReasoningContent expects a markdown string (it forwards to Streamdown
  // internally). Inline the "truncated" marker as italic text so we don't
  // need a JSX wrapper.
  const body = state.summary
    ? state.truncated
      ? `${state.summary}\n\n_(resumo truncado)_`
      : state.summary
    : "...";
  return (
    <Reasoning isStreaming={isStreaming} defaultOpen={isStreaming}>
      <ReasoningTrigger />
      <ReasoningContent>{body}</ReasoningContent>
    </Reasoning>
  );
};
