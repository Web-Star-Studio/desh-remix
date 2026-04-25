import { useState } from "react";
import { useWorkspace, Workspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ArrowRightLeft, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MoveToWorkspaceProps {
  /** Table name in Supabase */
  table: "tasks" | "user_data" | "contacts" | "finance_transactions" | "finance_goals" | "finance_recurring";
  /** Row ID to move */
  itemId: string;
  /** Current workspace_id */
  currentWorkspaceId?: string | null;
  /** Callback after successful move */
  onMoved?: () => void;
  /** Size variant */
  size?: "sm" | "xs";
}

/**
 * Dropdown button to move an item to a different workspace.
 */
const MoveToWorkspace = ({ table, itemId, currentWorkspaceId, onMoved, size = "xs" }: MoveToWorkspaceProps) => {
  const { workspaces, activeWorkspaceId } = useWorkspace();
  const [loading, setLoading] = useState(false);

  // Only show in "All" mode or when there are multiple workspaces
  if (workspaces.length < 2) return null;

  const handleMove = async (targetWsId: string) => {
    if (targetWsId === currentWorkspaceId) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from(table)
        .update({ workspace_id: targetWsId } as any)
        .eq("id", itemId);

      if (error) throw error;

      const targetWs = workspaces.find(w => w.id === targetWsId);
      toast({
        title: "Item movido",
        description: `Movido para ${targetWs?.icon} ${targetWs?.name}`,
      });
      onMoved?.();
    } catch (err: any) {
      console.error("Move error:", err);
      toast({ title: "Erro", description: "Falha ao mover item.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`${size === "xs" ? "p-1" : "p-1.5"} rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all disabled:opacity-30`}
          title="Mover para outro perfil"
          disabled={loading}
        >
          <ArrowRightLeft className={size === "xs" ? "w-3 h-3" : "w-3.5 h-3.5"} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {workspaces.map(ws => (
          <DropdownMenuItem
            key={ws.id}
            onClick={() => handleMove(ws.id)}
            disabled={ws.id === currentWorkspaceId}
            className="gap-2"
          >
            <span>{ws.icon}</span>
            <span className="flex-1 truncate">{ws.name}</span>
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: ws.color }} />
            {ws.id === currentWorkspaceId && <Check className="w-3.5 h-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default MoveToWorkspace;
