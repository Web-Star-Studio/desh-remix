import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import type { ToolState } from "@/lib/chatRuntimeReducer";

// Maps our reducer's tool status (`running`/`completed`/`failed`) to AI
// Elements' AI-SDK-shaped ToolUIPart states. AI Elements has a richer set
// (input-streaming, approval-requested, etc.) but Hermes only exposes the
// basic three; we pick the closest equivalents.
function toElementState(status: ToolState["status"]): "input-available" | "output-available" | "output-error" {
  if (status === "completed") return "output-available";
  if (status === "failed") return "output-error";
  return "input-available";
}

export const ToolCallCard = ({ tool }: { tool: ToolState }) => {
  const state = toElementState(tool.status);
  const inputObject = tool.argsKeys.length
    ? Object.fromEntries(tool.argsKeys.map((k) => [k, "<…>"]))
    : null;

  return (
    <Tool defaultOpen={tool.status !== "completed"}>
      <ToolHeader
        type={`tool-${tool.name}`}
        state={state}
      />
      <ToolContent>
        {inputObject && <ToolInput input={inputObject} />}
        {tool.resultPreview && (
          <ToolOutput
            output={<pre className="whitespace-pre-wrap text-xs">{tool.resultPreview}</pre>}
            errorText={tool.status === "failed" ? tool.resultPreview : undefined}
          />
        )}
      </ToolContent>
    </Tool>
  );
};
