import type { StepState } from "@/lib/chatRuntimeReducer";

// Compact horizontal step timeline. Each step.completed event from Hermes
// shows up as a chip with its iteration number and the tools it ran.
// Useful when the agent does multi-step reasoning so the user can see the
// shape of the run without expanding every tool card.
export const StepTimeline = ({ steps }: { steps: StepState[] }) => {
  if (steps.length === 0) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground px-1">
      <span className="uppercase tracking-wider text-[10px] font-semibold">Etapas</span>
      {steps.map((s, i) => (
        <span
          key={`${s.runId}_${s.iteration}_${i}`}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/40 border border-border/30"
          title={`run ${s.runId} • iteration ${s.iteration}`}
        >
          <span className="font-mono text-[10px]">#{s.iteration}</span>
          {s.toolNames.length > 0 && (
            <span className="text-foreground/70">{s.toolNames.join(", ")}</span>
          )}
        </span>
      ))}
    </div>
  );
};
