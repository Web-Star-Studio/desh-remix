import { useWorkspace } from "@/contexts/WorkspaceContext";

interface WorkspaceBadgeProps {
  workspaceId?: string | null;
  size?: "sm" | "xs";
}

/**
 * Shows a small colored dot + workspace name when in "All profiles" mode.
 * Hidden when a specific workspace is active (since all items belong to it).
 */
const WorkspaceBadge = ({ workspaceId, size = "xs" }: WorkspaceBadgeProps) => {
  const { activeWorkspaceId, workspaces } = useWorkspace();

  // Only show in "All" mode
  if (activeWorkspaceId !== null) return null;
  if (!workspaceId) return null;

  const ws = workspaces.find(w => w.id === workspaceId);
  if (!ws) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-foreground/5 ${
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-[9px]"
      } text-muted-foreground font-medium`}
      title={ws.name}
    >
      <span
        className={`rounded-full flex-shrink-0 ${size === "sm" ? "w-2 h-2" : "w-1.5 h-1.5"}`}
        style={{ background: ws.color }}
      />
      <span className="truncate max-w-[60px]">{ws.name}</span>
    </span>
  );
};

export default WorkspaceBadge;
