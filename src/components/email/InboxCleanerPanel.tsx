import { Loader2, X, Sparkles, CheckSquare, Square, History, Zap, Search, AlertTriangle, StopCircle } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import CleanerFilters, { ActionFilter, TypeFilter, SortBy } from "./cleaner/CleanerFilters";
import CleanerSummary from "./cleaner/CleanerSummary";
import CleanerGroupItem from "./cleaner/CleanerGroupItem";

export interface CleanerGroup {
  sender: string;
  icon: string;
  count: number;
  emailIds: string[];
  suggestion: string;
  action: "trash" | "archive";
  reason: string;
  isNewsletter: boolean;
  estimatedSpace: string;
}

export type ScanMode = "quick" | "deep" | "ultra";

interface CleanupHistoryItem {
  id: string;
  scanned_at: string;
  emails_scanned: number;
  groups_found: number;
  emails_cleaned: number;
  scan_mode: string;
}

interface InboxCleanerPanelProps {
  show: boolean;
  onClose: () => void;
  groups: CleanerGroup[] | null;
  loading: boolean;
  onCleanGroup: (group: CleanerGroup) => void;
  onCleanSelected: (groups: CleanerGroup[]) => void;
  deleting: boolean;
  cleanProgress: { current: number; total: number } | null;
  scanMode: ScanMode;
  onScanModeChange: (mode: ScanMode) => void;
  onRescan: (mode: ScanMode) => void;
  totalScanned: number;
  chunkProgress?: { current: number; total: number } | null;
  onCancel?: () => void;
}

const InboxCleanerPanel = ({
  show, onClose, groups, loading, onCleanGroup, onCleanSelected,
  deleting, cleanProgress, scanMode, onScanModeChange, onRescan, totalScanned, chunkProgress, onCancel,
}: InboxCleanerPanelProps) => {
  const { user } = useAuth();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"selected" | "single" | null>(null);
  const [pendingSingleGroup, setPendingSingleGroup] = useState<CleanerGroup | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<CleanupHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [stats, setStats] = useState<{ totalCleaned: number; totalSessions: number; firstUsed: string | null } | null>(null);

  // Filter state
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("count");

  // Excluded email IDs per group index
  const [excludedByGroup, setExcludedByGroup] = useState<Map<number, string[]>>(new Map());

  // Action overrides per group index
  const [actionOverrides, setActionOverrides] = useState<Map<number, "trash" | "archive">>(new Map());

  // Load accumulated stats on mount
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("email_cleanup_sessions")
          .select("emails_cleaned, scanned_at")
          .eq("user_id", user.id)
          .order("scanned_at", { ascending: true });
        if (data && data.length > 0) {
          const totalCleaned = data.reduce((sum, d) => sum + (d.emails_cleaned || 0), 0);
          setStats({ totalCleaned, totalSessions: data.length, firstUsed: data[0].scanned_at });
        }
      } catch { /* ignore */ }
    })();
  }, [user]);

  // Auto-select all groups when loaded & reset filters
  useEffect(() => {
    if (groups && groups.length > 0) {
      setSelectedIds(new Set(groups.map((_, i) => i)));
      setExcludedByGroup(new Map());
      setActionOverrides(new Map());
    } else {
      setSelectedIds(new Set());
    }
  }, [groups]);

  // Helper to get effective group (with action override applied)
  const getEffectiveGroup = (group: CleanerGroup, index: number): CleanerGroup => {
    const overriddenAction = actionOverrides.get(index);
    if (overriddenAction && overriddenAction !== group.action) {
      return {
        ...group,
        action: overriddenAction,
        suggestion: overriddenAction === "trash" ? "Excluir" : "Arquivar",
      };
    }
    return group;
  };

  // Filtered and sorted groups (with action overrides applied)
  const filteredGroups = useMemo(() => {
    if (!groups) return [];
    let result = groups.map((g, i) => ({ group: getEffectiveGroup(g, i), originalIndex: i }));

    if (actionFilter !== "all") {
      result = result.filter(({ group }) => group.action === actionFilter);
    }
    if (typeFilter === "newsletter") {
      result = result.filter(({ group }) => group.isNewsletter);
    } else if (typeFilter === "other") {
      result = result.filter(({ group }) => !group.isNewsletter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(({ group }) => group.sender.toLowerCase().includes(q));
    }

    result.sort((a, b) => {
      if (sortBy === "count") return b.group.count - a.group.count;
      return a.group.sender.localeCompare(b.group.sender);
    });

    return result;
  }, [groups, actionFilter, typeFilter, searchQuery, sortBy, actionOverrides]);

  // Group by action for visual separation
  const trashGroups = filteredGroups.filter(({ group }) => group.action === "trash");
  const archiveGroups = filteredGroups.filter(({ group }) => group.action === "archive");

  if (!show) return null;

  const totalEmails = groups?.reduce((sum, g) => sum + g.count, 0) || 0;
  const selectedGroups = groups?.filter((_, i) => selectedIds.has(i)) || [];
  const selectedEmailCount = selectedGroups.reduce((sum, g) => sum + g.count, 0);

  const toggleGroup = (index: number) => {
    if (deleting) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  const toggleAll = () => {
    if (!groups || deleting) return;
    const visibleIndices = filteredGroups.map(fg => fg.originalIndex);
    const allSelected = visibleIndices.every(i => selectedIds.has(i));
    setSelectedIds(prev => {
      const next = new Set(prev);
      visibleIndices.forEach(i => allSelected ? next.delete(i) : next.add(i));
      return next;
    });
  };

  const handleCleanSelected = () => {
    if (selectedGroups.length === 0) return;
    setConfirmAction("selected");
    setShowConfirmDialog(true);
  };

  const handleCleanSingle = (group: CleanerGroup) => {
    setPendingSingleGroup(group);
    setConfirmAction("single");
    setShowConfirmDialog(true);
  };

  const confirmClean = () => {
    setShowConfirmDialog(false);
    if (confirmAction === "selected") {
      // Apply exclusions to selected groups
      const adjusted = selectedGroups.map((g, _) => {
        const origIdx = groups!.indexOf(g);
        const excluded = excludedByGroup.get(origIdx);
        if (excluded && excluded.length > 0) {
          return { ...g, emailIds: g.emailIds.filter(id => !excluded.includes(id)), count: g.count - excluded.length };
        }
        return g;
      }).filter(g => g.count > 0);
      onCleanSelected(adjusted);
    } else if (confirmAction === "single" && pendingSingleGroup) {
      const origIdx = groups!.indexOf(pendingSingleGroup);
      const excluded = excludedByGroup.get(origIdx);
      if (excluded && excluded.length > 0) {
        const adjusted = {
          ...pendingSingleGroup,
          emailIds: pendingSingleGroup.emailIds.filter(id => !excluded.includes(id)),
          count: pendingSingleGroup.count - excluded.length,
        };
        if (adjusted.count > 0) onCleanGroup(adjusted);
      } else {
        onCleanGroup(pendingSingleGroup);
      }
    }
    setPendingSingleGroup(null);
    setConfirmAction(null);
  };

  const loadHistory = async () => {
    if (!user) return;
    setHistoryLoading(true);
    try {
      const { data } = await supabase
        .from("email_cleanup_sessions")
        .select("id, scanned_at, emails_scanned, groups_found, emails_cleaned, scan_mode")
        .eq("user_id", user.id)
        .order("scanned_at", { ascending: false })
        .limit(10);
      setHistory((data as CleanupHistoryItem[]) || []);
    } catch { /* ignore */ }
    setHistoryLoading(false);
  };

  const toggleHistory = () => {
    if (!showHistory) loadHistory();
    setShowHistory(!showHistory);
  };

  const allVisibleSelected = filteredGroups.length > 0 && filteredGroups.every(fg => selectedIds.has(fg.originalIndex));

  const renderGroupSection = (label: string, emoji: string, items: typeof filteredGroups) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 py-1">
          <span className="text-xs">{emoji}</span>
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
          <span className="text-[10px] text-muted-foreground/60">({items.reduce((s, fg) => s + fg.group.count, 0)} e-mails)</span>
        </div>
        {items.map(({ group, originalIndex }) => (
          <CleanerGroupItem
            key={`${group.sender}-${originalIndex}`}
            group={group}
            selected={selectedIds.has(originalIndex)}
            onToggle={() => toggleGroup(originalIndex)}
            onClean={() => handleCleanSingle(group)}
            deleting={deleting}
            onRemoveEmailIds={(ids) => {
              setExcludedByGroup(prev => {
                const next = new Map(prev);
                next.set(originalIndex, ids);
                return next;
              });
            }}
            onActionChange={(action) => {
              setActionOverrides(prev => {
                const next = new Map(prev);
                next.set(originalIndex, action);
                return next;
              });
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      <AnimatedItem index={0}>
        <GlassCard size="auto" className="mb-3 p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-2 gap-2">
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-lg">🧹</span>
              <h3 className="text-sm font-semibold text-foreground">Limpeza Inteligente</h3>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {(loading || deleting) && onCancel && (
                <button onClick={onCancel} className="flex items-center gap-1 px-2 py-1 text-xs text-destructive hover:bg-destructive/15 rounded-lg transition-colors">
                  <StopCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cancelar</span>
                </button>
              )}
              <button onClick={toggleHistory} className="p-2 sm:p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors">
                <History className="w-3.5 h-3.5" />
              </button>
              <button onClick={onClose} className="p-2 sm:p-1.5 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Scan mode toggle + clean button */}
          {!loading && !deleting && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-3">
              <div className="flex items-center rounded-lg bg-foreground/5 border border-foreground/10 p-0.5 w-full sm:w-auto">
                {(["quick", "deep", "ultra"] as ScanMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => { onScanModeChange(mode); onRescan(mode); }}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-1 px-2 py-1.5 sm:py-1 rounded-md text-[10px] font-medium transition-colors ${
                      scanMode === mode ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mode === "quick" && <Zap className="w-3 h-3" />}
                    {mode === "deep" && <Search className="w-3 h-3" />}
                    {mode === "ultra" && <Sparkles className="w-3 h-3" />}
                    {mode === "quick" ? "Rápido" : mode === "deep" ? "Profundo" : "Ultra"}
                  </button>
                ))}
              </div>
              {groups && selectedGroups.length > 0 && (
                <button
                  onClick={handleCleanSelected}
                  disabled={deleting}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 w-full sm:w-auto"
                >
                  <Sparkles className="w-3 h-3" />
                  Limpar {selectedGroups.length === groups?.length ? "Tudo" : `(${selectedGroups.length})`}
                </button>
              )}
            </div>
          )}

          {/* History panel */}
          {showHistory && (
            <div className="mb-3 p-3 rounded-lg bg-foreground/5 border border-foreground/10">
              <h4 className="text-xs font-medium text-foreground mb-2">Histórico de Limpezas</h4>
              {historyLoading && <div className="flex items-center gap-2 py-3 text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /><span className="text-xs">Carregando...</span></div>}
              {!historyLoading && history.length === 0 && <p className="text-xs text-muted-foreground py-2">Nenhuma limpeza realizada ainda.</p>}
              {!historyLoading && history.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {history.map(h => (
                    <div key={h.id} className="flex items-center justify-between text-[11px] text-muted-foreground py-1 border-b border-foreground/5 last:border-0">
                      <span>{new Date(h.scanned_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">{h.scan_mode === "ultra" ? "Ultra" : h.scan_mode === "deep" ? "Profundo" : "Rápido"}</Badge>
                        <span>{h.emails_cleaned} limpos</span>
                        <span className="text-muted-foreground/60">/ {h.emails_scanned} analisados</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Accumulated stats */}
          {stats && stats.totalCleaned > 0 && !showHistory && !loading && (
            <div className="mb-3 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="text-sm">📊</span>
                <span><strong className="text-foreground">{stats.totalCleaned}</strong> limpos no total</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span>~<strong className="text-foreground">{(stats.totalCleaned * 0.05).toFixed(1)} MB</strong> economizados</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {stats.totalSessions} limpeza{stats.totalSessions > 1 ? "s" : ""}
                {stats.firstUsed && (
                  <span className="ml-1 text-muted-foreground/60">
                    desde {new Date(stats.firstUsed).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Progress bar during batch operations */}
          {deleting && cleanProgress && (
            <div className="mb-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Limpando...</span>
                <span>{cleanProgress.current}/{cleanProgress.total} e-mails</span>
              </div>
              <Progress value={(cleanProgress.current / cleanProgress.total) * 100} className="h-2" />
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">
                {chunkProgress && chunkProgress.total > 1
                  ? `Analisando lote ${chunkProgress.current}/${chunkProgress.total}...`
                  : `Analisando ${scanMode === "deep" ? "profundamente" : scanMode === "ultra" ? "em modo ultra" : ""} sua caixa de entrada...`
                }
              </span>
              {totalScanned > 0 && <span className="text-xs text-muted-foreground/70">{totalScanned} e-mails sendo analisados</span>}
              {chunkProgress && chunkProgress.total > 1 && (
                <div className="w-full max-w-xs mt-1">
                  <Progress value={(chunkProgress.current / chunkProgress.total) * 100} className="h-1.5" />
                </div>
              )}
            </div>
          )}

          {!loading && groups && groups.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">✨ Sua caixa está limpa! Nenhum grupo de e-mails desnecessários encontrado.</p>
          )}

          {!loading && groups && groups.length > 0 && (
            <>
              {/* Visual summary */}
              <CleanerSummary groups={groups} />

              {/* Filters */}
              <CleanerFilters
                groups={groups}
                actionFilter={actionFilter}
                typeFilter={typeFilter}
                searchQuery={searchQuery}
                sortBy={sortBy}
                onActionFilterChange={setActionFilter}
                onTypeFilterChange={setTypeFilter}
                onSearchChange={setSearchQuery}
                onSortChange={setSortBy}
              />

              {/* Select all for visible groups */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <button onClick={toggleAll} disabled={deleting} className="flex items-center gap-1.5 hover:text-foreground transition-colors disabled:opacity-50">
                    {allVisibleSelected ? <CheckSquare className="w-3.5 h-3.5 text-primary" /> : <Square className="w-3.5 h-3.5" />}
                    <span>{allVisibleSelected ? "Desmarcar" : "Selecionar"} visíveis</span>
                  </button>
                  <span className="text-muted-foreground/60">•</span>
                  <span>{filteredGroups.length} de {groups.length} grupo(s)</span>
                </div>
              </div>

              {/* Grouped list */}
              <div className="space-y-4 max-h-[28rem] overflow-y-auto">
                {actionFilter === "all" ? (
                  <>
                    {renderGroupSection("Excluir", "🗑️", trashGroups)}
                    {renderGroupSection("Arquivar", "📦", archiveGroups)}
                  </>
                ) : (
                  <div className="space-y-2">
                    {filteredGroups.map(({ group, originalIndex }) => (
                      <CleanerGroupItem
                        key={`${group.sender}-${originalIndex}`}
                        group={group}
                        selected={selectedIds.has(originalIndex)}
                        onToggle={() => toggleGroup(originalIndex)}
                        onClean={() => handleCleanSingle(group)}
                        deleting={deleting}
                        onRemoveEmailIds={(ids) => {
                          setExcludedByGroup(prev => {
                            const next = new Map(prev);
                            next.set(originalIndex, ids);
                            return next;
                          });
                        }}
                        onActionChange={(action) => {
                          setActionOverrides(prev => {
                            const next = new Map(prev);
                            next.set(originalIndex, action);
                            return next;
                          });
                        }}
                      />
                    ))}
                  </div>
                )}
                {filteredGroups.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum grupo corresponde aos filtros.</p>
                )}
              </div>
            </>
          )}
        </GlassCard>
      </AnimatedItem>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirmar Limpeza
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {confirmAction === "selected" && (
                  <>
                    <p>Você está prestes a limpar <strong>{selectedGroups.length} grupo(s)</strong> com <strong>{selectedEmailCount} e-mail(s)</strong>:</p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {selectedGroups.map((g) => (
                        <div key={g.sender} className="flex items-center gap-2 text-sm py-1 border-b border-border/50 last:border-0">
                          <span>{g.icon}</span>
                          <span className="flex-1 truncate">{g.sender}</span>
                          <Badge variant={g.action === "trash" ? "destructive" : "secondary"} className="text-[10px]">
                            {g.action === "trash" ? `Excluir ${g.count}` : `Arquivar ${g.count}`}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {confirmAction === "single" && pendingSingleGroup && (
                  <p>
                    {pendingSingleGroup.action === "trash" ? "Excluir" : "Arquivar"}{" "}
                    <strong>{pendingSingleGroup.count} e-mail(s)</strong> de <strong>{pendingSingleGroup.sender}</strong>?
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Esta ação não pode ser facilmente desfeita.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClean} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar Limpeza
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default InboxCleanerPanel;
