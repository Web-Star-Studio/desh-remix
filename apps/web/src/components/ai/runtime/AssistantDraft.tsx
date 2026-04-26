import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import type { DraftState } from "@/lib/chatRuntimeReducer";

// Streaming assistant draft, accumulated from message.delta events. Once
// the persisted assistant_message arrives for the same run_id, the
// reducer clears the draft and this component unmounts — so the draft is
// strictly a "before the final message lands" affordance.
//
// Visual: same Message/Response chrome as a real assistant message, with
// a blinking caret to signal it's still streaming.
export const AssistantDraft = ({ draft }: { draft: DraftState }) => (
  <Message from="assistant">
    <MessageContent>
      <MessageResponse>{draft.text}</MessageResponse>
      <span
        aria-hidden
        className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom"
      />
    </MessageContent>
  </Message>
);
