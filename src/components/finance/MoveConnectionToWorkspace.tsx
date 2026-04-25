import { useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ArrowRightLeft, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MoveConnectionToWorkspaceProps {
  connectionId: string;
  currentWorkspaceId?: string | null;
  onMoved?: () => void;
}

const MoveConnectionToWorkspace = ({
  connectionId,
  currentWorkspaceId,
  onMoved,
}: MoveConnectionToWorkspaceProps) => {
  const { workspaces } = useWorkspace();
  const [loading, setLoading] = useState(false);

  if (workspaces.length < 2) return null;

  const handleMove = async (targetWsId: string) => {
    if (targetWsId === currentWorkspaceId) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc("move_financial_connection", {
        _connection_id: connectionId,
        _target_workspace_id: targetWsId,
      } as any);

      if (error) throw error;

      const targetWs = workspaces.find((w) => w.id === targetWsId);
      toast({
        title: "Conexão movida",
        description: `Banco movido para ${targetWs?.icon} ${targetWs?.name} (contas e transações incluídas)`,
      });
      onMoved?.();
    } catch (err: any) {
      console.error("Move connection error:", err);
      toast({
        title: "Erro",
        description: "Falha ao mover conexão bancária.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-1 rounded text-muted-foreground hover:text-primary transition-all disabled:opacity-30 flex-shrink-0"
          title="Mover para outro perfil"
          disabled={loading}
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {workspaces.map((ws) => (
          <DropdownMenuItem
            key={ws.id}
            onClick={() => handleMove(ws.id)}
            disabled={ws.id === currentWorkspaceId}
            className="gap-2"
          >
            <span>{ws.icon}</span>
            <span className="flex-1 truncate">{ws.name}</span>
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: ws.color }}
            />
            {ws.id === currentWorkspaceId && (
              <Check className="w-3.5 h-3.5 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default MoveConnectionToWorkspace;
