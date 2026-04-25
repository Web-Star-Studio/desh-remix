import { useState, useMemo } from "react";
import { Search, Star, Clock, FolderPlus, Trash2, ChevronRight, Pencil, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchHistoryItemCard from "./SearchHistoryItem";
import SearchProjectForm from "./SearchProjectForm";
import type { SearchHistoryItem, SearchProject } from "@/hooks/search/useSearchHistory";

interface Props {
  history: SearchHistoryItem[];
  projects: SearchProject[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onSelectItem: (item: SearchHistoryItem) => void;
  onToggleFavorite: (id: string, current: boolean) => void;
  onMoveToProject: (id: string, projectId: string | null) => void;
  onDeleteItem: (id: string) => void;
  onClearHistory: () => void;
  onCreateProject: (name: string, color: string, icon: string) => void;
  onUpdateProject: (id: string, data: Partial<{ name: string; color: string; icon: string }>) => void;
  onDeleteProject: (id: string) => void;
  activeItemId?: string;
}

export default function SearchHistorySidebar({
  history, projects, loading, hasMore, onLoadMore,
  onSelectItem, onToggleFavorite, onMoveToProject, onDeleteItem,
  onClearHistory, onCreateProject, onUpdateProject, onDeleteProject,
  activeItemId,
}: Props) {
  const [searchFilter, setSearchFilter] = useState("");
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProject, setEditingProject] = useState<SearchProject | null>(null);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [moveItemId, setMoveItemId] = useState<string | null>(null);

  const filteredHistory = useMemo(() => {
    if (!searchFilter.trim()) return history;
    const q = searchFilter.toLowerCase();
    return history.filter(h => h.query.toLowerCase().includes(q) || h.tldr?.toLowerCase().includes(q));
  }, [history, searchFilter]);

  const favorites = useMemo(() => filteredHistory.filter(h => h.favorited), [filteredHistory]);

  const projectItems = useMemo(() => {
    if (!expandedProject) return [];
    return filteredHistory.filter(h => h.project_id === expandedProject);
  }, [filteredHistory, expandedProject]);

  const handleMoveConfirm = (projectId: string) => {
    if (moveItemId) {
      onMoveToProject(moveItemId, projectId);
      setMoveItemId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search filter */}
      <div className="p-3 border-b border-foreground/10">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            placeholder="Filtrar histórico..."
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <Tabs defaultValue="recent" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-3 mt-2 mb-1 h-8">
          <TabsTrigger value="recent" className="text-xs gap-1 flex-1"><Clock className="w-3 h-3" /> Recentes</TabsTrigger>
          <TabsTrigger value="projects" className="text-xs gap-1 flex-1"><FolderPlus className="w-3 h-3" /> Projetos</TabsTrigger>
          <TabsTrigger value="favorites" className="text-xs gap-1 flex-1"><Star className="w-3 h-3" /> Favoritos</TabsTrigger>
        </TabsList>

        {/* Recentes */}
        <TabsContent value="recent" className="flex-1 min-h-0 m-0">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-0.5">
              {filteredHistory.length === 0 && !loading && (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhuma busca encontrada</p>
              )}
              {filteredHistory.map(item => (
                <SearchHistoryItemCard
                  key={item.id}
                  item={item}
                  onSelect={onSelectItem}
                  onToggleFavorite={onToggleFavorite}
                  onDelete={onDeleteItem}
                  onMoveToProject={(id) => setMoveItemId(id)}
                  active={item.id === activeItemId}
                />
              ))}
              {hasMore && (
                <button onClick={onLoadMore} className="w-full text-xs text-primary py-2 hover:underline">
                  Carregar mais...
                </button>
              )}
            </div>
          </ScrollArea>
          {history.length > 0 && (
            <div className="p-2 border-t border-foreground/10">
              <button
                onClick={() => {
                  if (window.confirm("Tem certeza que deseja limpar todo o histórico de buscas? Itens favoritos serão mantidos.")) {
                    onClearHistory();
                  }
                }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors w-full justify-center py-1"
              >
                <Trash2 className="w-3 h-3" /> Limpar histórico
              </button>
            </div>
          )}
        </TabsContent>

        {/* Projetos */}
        <TabsContent value="projects" className="flex-1 min-h-0 m-0">
          <ScrollArea className="h-full">
            <div className="p-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowProjectForm(true)}
                className="w-full mb-2 text-xs h-8"
              >
                <FolderPlus className="w-3 h-3 mr-1.5" /> Novo Projeto
              </Button>

              {projects.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">Crie projetos para organizar suas buscas</p>
              )}

              {projects.map(proj => (
                <div key={proj.id} className="mb-1">
                  <button
                    onClick={() => setExpandedProject(expandedProject === proj.id ? null : proj.id)}
                    className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-foreground/5 transition-colors text-left"
                  >
                    <span className="text-base">{proj.icon}</span>
                    <span className="flex-1 text-sm font-medium truncate">{proj.name}</span>
                    <span className="text-[10px] text-muted-foreground bg-foreground/5 px-1.5 py-0.5 rounded-full">{proj.count}</span>
                    <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform ${expandedProject === proj.id ? "rotate-90" : ""}`} />
                  </button>

                  {expandedProject === proj.id && (
                    <div className="ml-2 border-l border-foreground/10 pl-2">
                      <div className="flex gap-1 mb-1">
                        <button onClick={() => setEditingProject(proj)} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 px-1.5 py-0.5 rounded">
                          <Pencil className="w-2.5 h-2.5" /> Editar
                        </button>
                        <button onClick={() => onDeleteProject(proj.id)} className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-0.5 px-1.5 py-0.5 rounded">
                          <Trash2 className="w-2.5 h-2.5" /> Excluir
                        </button>
                      </div>
                      {projectItems.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground py-2 pl-2">Nenhuma busca neste projeto</p>
                      ) : (
                        projectItems.map(item => (
                          <SearchHistoryItemCard
                            key={item.id}
                            item={item}
                            onSelect={onSelectItem}
                            onToggleFavorite={onToggleFavorite}
                            onDelete={onDeleteItem}
                            active={item.id === activeItemId}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Favoritos */}
        <TabsContent value="favorites" className="flex-1 min-h-0 m-0">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-0.5">
              {favorites.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhum favorito ainda</p>
              )}
              {favorites.map(item => (
                <SearchHistoryItemCard
                  key={item.id}
                  item={item}
                  onSelect={onSelectItem}
                  onToggleFavorite={onToggleFavorite}
                  onDelete={onDeleteItem}
                  onMoveToProject={(id) => setMoveItemId(id)}
                  active={item.id === activeItemId}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Move to project dialog */}
      {moveItemId && (
        <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">Mover para projeto</p>
            <button onClick={() => setMoveItemId(null)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1">
            <button
              onClick={() => { onMoveToProject(moveItemId, null); setMoveItemId(null); }}
              className="w-full text-left text-sm p-2 rounded-lg hover:bg-foreground/5 text-muted-foreground"
            >
              Sem projeto
            </button>
            {projects.map(proj => (
              <button
                key={proj.id}
                onClick={() => handleMoveConfirm(proj.id)}
                className="flex items-center gap-2 w-full text-left text-sm p-2 rounded-lg hover:bg-foreground/5"
              >
                <span>{proj.icon}</span>
                <span>{proj.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <SearchProjectForm
        open={showProjectForm || !!editingProject}
        onClose={() => { setShowProjectForm(false); setEditingProject(null); }}
        onSave={(name, color, icon) => {
          if (editingProject) {
            onUpdateProject(editingProject.id, { name, color, icon });
          } else {
            onCreateProject(name, color, icon);
          }
        }}
        initial={editingProject ? { name: editingProject.name, color: editingProject.color, icon: editingProject.icon } : undefined}
      />
    </div>
  );
}
