import { useState } from "react";
import { DeshFolder } from "@/hooks/files/useFileStorage";
import { FolderOpen, Home, Search, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";

interface MoveToFolderDialogProps {
  folders: DeshFolder[];
  currentFolderId?: string | null;
  onMove: (folderId: string | null) => void;
  onClose: () => void;
}

const MoveToFolderDialog = ({ folders, currentFolderId, onMove, onClose }: MoveToFolderDialogProps) => {
  const [search, setSearch] = useState("");

  const filtered = folders.filter(
    (f) =>
      f.id !== currentFolderId &&
      f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl bg-popover border border-border shadow-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <FolderOpen className="w-4 h-4 text-primary" />
            Mover para...
          </h4>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar pasta..."
            className="pl-8 h-8 text-xs"
          />
        </div>

        <div className="max-h-[240px] overflow-y-auto space-y-0.5 scrollbar-thin">
          {/* Root option */}
          <button
            onClick={() => onMove(null)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:bg-muted/50 ${
              !currentFolderId ? "bg-primary/10 text-primary" : "text-foreground"
            }`}
          >
            <Home className="w-4 h-4" />
            Raiz (Meus Arquivos)
            {!currentFolderId && <Check className="w-3.5 h-3.5 ml-auto" />}
          </button>

          {filtered.map((folder) => (
            <button
              key={folder.id}
              onClick={() => onMove(folder.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:bg-muted/50 ${
                folder.id === currentFolderId ? "bg-primary/10 text-primary" : "text-foreground"
              }`}
            >
              <span className="text-base">{folder.icon}</span>
              <span className="truncate">{folder.name}</span>
              {folder.id === currentFolderId && <Check className="w-3.5 h-3.5 ml-auto" />}
            </button>
          ))}

          {filtered.length === 0 && !search && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma pasta criada</p>
          )}
          {filtered.length === 0 && search && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma pasta encontrada</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MoveToFolderDialog;
