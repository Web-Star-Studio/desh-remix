import { useState, useMemo } from "react";
import { Loader2, FolderInput, Check, X, ChevronDown, ChevronUp, Shield, AlertTriangle, Sparkles, Tag, Plus, StopCircle, Filter } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

interface OrganizeAssignment {
  emailId: string;
  subject: string;
  from: string;
  suggestedLabels: string[];
  newLabels: string[];
  removeLabels: string[];
  reason: string;
  confidence: "high" | "medium" | "low";
  emailType: string;
  selected: boolean;
}

interface OrganizeStats {
  total_to_organize: number;
  already_organized: number;
  newsletters_found: number;
  high_priority: number;
}

interface OrganizeResults {
  assignments: OrganizeAssignment[];
  summary: string;
  stats: OrganizeStats;
}

interface AutoOrganizePanelProps {
  show: boolean;
  onClose: () => void;
  results: OrganizeResults | null;
  loading: boolean;
  onApply: (assignments: OrganizeAssignment[]) => void;
  applying: boolean;
  applyProgress: { current: number; total: number } | null;
  analyzeProgress?: { current: number; total: number } | null;
  onToggleSelect: (emailId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

const CONFIDENCE_CONFIG = {
  high: { color: "text-green-500", bg: "bg-green-500/10", icon: Shield, label: "Alta" },
  medium: { color: "text-amber-500", bg: "bg-amber-500/10", icon: Sparkles, label: "Média" },
  low: { color: "text-muted-foreground", bg: "bg-foreground/5", icon: AlertTriangle, label: "Baixa" },
};

const TYPE_EMOJI: Record<string, string> = {
  newsletter: "📰", promotion: "🏷️", notification: "🔔", personal: "👤",
  work: "💼", transactional: "🧾", social: "💬",
};

const TYPE_LABEL: Record<string, string> = {
  newsletter: "Newsletter", promotion: "Promoção", notification: "Notificação", personal: "Pessoal",
  work: "Trabalho", transactional: "Transacional", social: "Social",
};

const AutoOrganizePanel = ({ show, onClose, results, loading, onApply, applying, applyProgress, analyzeProgress, onToggleSelect, onSelectAll, onDeselectAll }: AutoOrganizePanelProps) => {
  const [expanded, setExpanded] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [filterConfidence, setFilterConfidence] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleFilter = (set: Set<string>, val: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    next.has(val) ? next.delete(val) : next.add(val);
    setter(next);
  };

  // Filtered assignments
  const filteredAssignments = useMemo(() => {
    if (!results) return [];
    let list = results.assignments;
    if (filterConfidence.size > 0) list = list.filter(a => filterConfidence.has(a.confidence));
    if (filterType.size > 0) list = list.filter(a => filterType.has(a.emailType));
    return list;
  }, [results, filterConfidence, filterType]);

  // Group by first suggested label
  const grouped = useMemo(() => {
    const groups: Record<string, OrganizeAssignment[]> = {};
    for (const a of filteredAssignments) {
      const key = a.suggestedLabels[0] || a.newLabels?.[0] || "Sem label";
      (groups[key] ||= []).push(a);
    }
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [filteredAssignments]);

  // Available types for filter chips
  const availableTypes = useMemo(() => {
    if (!results) return [];
    const types = new Set(results.assignments.map(a => a.emailType));
    return Array.from(types);
  }, [results]);

  if (!show) return null;

  const selectedCount = results?.assignments.filter(a => a.selected).length || 0;
  const totalCount = results?.assignments.length || 0;
  const newLabelsCount = results ? new Set(results.assignments.filter(a => a.selected).flatMap(a => a.newLabels || [])).size : 0;
  const selectedAssignments = results?.assignments.filter(a => a.selected) || [];
  const removeCount = selectedAssignments.filter(a => a.removeLabels?.length > 0).length;
  const hasFilters = filterConfidence.size > 0 || filterType.size > 0;

  const handleApplyClick = () => {
    if (selectedCount === 0) return;
    setShowConfirmDialog(true);
  };

  const confirmApply = () => {
    setShowConfirmDialog(false);
    onApply(selectedAssignments);
  };

  return (
    <>
      <AnimatedItem index={0}>
        <GlassCard size="auto" className="mb-3 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FolderInput className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Organizar com IA</h3>
              {results && results.assignments.length > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                  {hasFilters ? `${filteredAssignments.length}/${totalCount}` : `${totalCount}`} sugestões
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {(loading || applying) && (
                <button
                  onClick={onClose}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:bg-red-500/15 rounded-lg transition-colors"
                >
                  <StopCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cancelar</span>
                </button>
              )}
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Loading with analyze progress */}
          {loading && (
            <div className="py-6 space-y-3">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Analisando e-mails para organização inteligente...</span>
              </div>
              {analyzeProgress && analyzeProgress.total > 1 && (
                <div className="px-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Lote {analyzeProgress.current + 1} de {analyzeProgress.total}</span>
                    <span>{Math.round(((analyzeProgress.current + 1) / analyzeProgress.total) * 100)}%</span>
                  </div>
                  <Progress value={((analyzeProgress.current + 1) / analyzeProgress.total) * 100} className="h-1.5" />
                </div>
              )}
            </div>
          )}

          {!loading && results && results.assignments.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">✅ Nenhuma sugestão de organização. Seus e-mails já estão bem organizados!</p>
          )}

          {!loading && results && results.assignments.length > 0 && (
            <>
              {/* Summary & Stats */}
              <div className="mb-3 p-2.5 rounded-lg bg-foreground/5 border border-foreground/10">
                <p className="text-xs text-muted-foreground mb-2">{results.summary}</p>
                <div className="flex flex-wrap gap-2">
                  {results.stats.total_to_organize > 0 && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">📂 {results.stats.total_to_organize} para organizar</span>
                  )}
                  {results.stats.already_organized > 0 && (
                    <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full">✅ {results.stats.already_organized} já organizados</span>
                  )}
                  {results.stats.newsletters_found > 0 && (
                    <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">📰 {results.stats.newsletters_found} newsletters</span>
                  )}
                  {results.stats.high_priority > 0 && (
                    <span className="text-xs bg-red-500/10 text-red-600 px-2 py-0.5 rounded-full">🔴 {results.stats.high_priority} urgentes</span>
                  )}
                  {newLabelsCount > 0 && (
                    <span className="text-xs bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded-full">✨ {newLabelsCount} novo(s) label(s)</span>
                  )}
                </div>
              </div>

              {/* Filters */}
              <div className="mb-2 space-y-1.5">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <Filter className="w-3 h-3 text-muted-foreground shrink-0" />
                  {(["high", "medium", "low"] as const).map(c => {
                    const cfg = CONFIDENCE_CONFIG[c];
                    const active = filterConfidence.has(c);
                    return (
                      <button
                        key={c}
                        onClick={() => toggleFilter(filterConfidence, c, setFilterConfidence)}
                        className={`text-[10px] px-2 py-1 rounded-full border transition-colors whitespace-nowrap ${
                          active ? `${cfg.bg} ${cfg.color} border-current` : "bg-foreground/5 text-muted-foreground border-foreground/10 hover:bg-foreground/10"
                        }`}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                  <span className="text-foreground/20 mx-0.5">|</span>
                  {availableTypes.map(t => {
                    const active = filterType.has(t);
                    const emoji = TYPE_EMOJI[t] || "📧";
                    const label = TYPE_LABEL[t] || t;
                    return (
                      <button
                        key={t}
                        onClick={() => toggleFilter(filterType, t, setFilterType)}
                        className={`text-[10px] px-2 py-1 rounded-full border transition-colors whitespace-nowrap ${
                          active ? "bg-primary/10 text-primary border-primary/30" : "bg-foreground/5 text-muted-foreground border-foreground/10 hover:bg-foreground/10"
                        }`}
                      >
                        {emoji} {label}
                      </button>
                    );
                  })}
                  {hasFilters && (
                    <button
                      onClick={() => { setFilterConfidence(new Set()); setFilterType(new Set()); }}
                      className="text-[10px] text-red-400 hover:text-red-300 px-1 whitespace-nowrap"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>

              {/* Selection controls */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <button onClick={onSelectAll} disabled={applying} className="text-xs text-primary hover:underline disabled:opacity-50">Selecionar tudo</button>
                  <span className="text-xs text-muted-foreground">|</span>
                  <button onClick={onDeselectAll} disabled={applying} className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">Limpar seleção</button>
                </div>
                <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
                  {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Grouped assignments list */}
              {expanded && (
                <div className="max-h-96 overflow-y-auto mb-3 pr-1 space-y-2">
                  {grouped.map(([groupLabel, items]) => (
                    <GroupSection
                      key={groupLabel}
                      label={groupLabel}
                      items={items}
                      applying={applying}
                      onToggleSelect={onToggleSelect}
                      expandedItems={expandedItems}
                      onToggleExpand={(id) => {
                        const next = new Set(expandedItems);
                        next.has(id) ? next.delete(id) : next.add(id);
                        setExpandedItems(next);
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Apply progress */}
              {applying && applyProgress && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Organizando...</span>
                    <span>{applyProgress.current}/{applyProgress.total}</span>
                  </div>
                  <Progress value={(applyProgress.current / applyProgress.total) * 100} className="h-1.5" />
                </div>
              )}

              {/* Apply button */}
              <button
                onClick={handleApplyClick}
                disabled={applying || selectedCount === 0}
                className="w-full flex items-center justify-center gap-1.5 bg-primary text-primary-foreground rounded-lg py-2 text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Aplicar {selectedCount} de {totalCount} sugestão(ões)
              </button>
            </>
          )}
        </GlassCard>
      </AnimatedItem>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FolderInput className="w-5 h-5 text-primary" />
              Confirmar Organização
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Você está prestes a organizar <strong>{selectedCount} e-mail(s)</strong> com labels do Gmail:</p>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-primary" />
                    <span>{selectedAssignments.reduce((s, a) => s + a.suggestedLabels.length, 0)} label(s) existente(s) serão aplicados</span>
                  </div>
                  {newLabelsCount > 0 && (
                    <div className="flex items-center gap-2">
                      <Plus className="w-3.5 h-3.5 text-purple-500" />
                      <span>{newLabelsCount} novo(s) label(s) serão criados</span>
                    </div>
                  )}
                  {removeCount > 0 && (
                    <div className="flex items-center gap-2">
                      <X className="w-3.5 h-3.5 text-destructive" />
                      <span>{removeCount} e-mail(s) terão labels removidos</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Esta ação modificará os labels dos e-mails selecionados no Gmail.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmApply}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

/* ---------- Group Section ---------- */
interface GroupSectionProps {
  label: string;
  items: OrganizeAssignment[];
  applying: boolean;
  onToggleSelect: (id: string) => void;
  expandedItems: Set<string>;
  onToggleExpand: (id: string) => void;
}

const GroupSection = ({ label, items, applying, onToggleSelect, expandedItems, onToggleExpand }: GroupSectionProps) => {
  const selectedInGroup = items.filter(a => a.selected).length;
  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 transition-colors text-xs">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Tag className="w-3 h-3 text-primary" />
          {label}
          <span className="text-muted-foreground font-normal">({selectedInGroup}/{items.length})</span>
        </div>
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-1 mt-1">
          {items.map((a, i) => (
            <AssignmentItem
              key={a.emailId || i}
              assignment={a}
              applying={applying}
              onToggle={() => onToggleSelect(a.emailId)}
              isExpanded={expandedItems.has(a.emailId)}
              onToggleExpand={() => onToggleExpand(a.emailId)}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

/* ---------- Assignment Item ---------- */
interface AssignmentItemProps {
  assignment: OrganizeAssignment;
  applying: boolean;
  onToggle: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const AssignmentItem = ({ assignment: a, applying, onToggle, isExpanded, onToggleExpand }: AssignmentItemProps) => {
  const conf = CONFIDENCE_CONFIG[a.confidence] || CONFIDENCE_CONFIG.medium;
  const ConfIcon = conf.icon;
  const emoji = TYPE_EMOJI[a.emailType] || "📧";

  return (
    <div
      className={`rounded-lg border transition-colors ${
        applying ? "opacity-60 cursor-not-allowed" : ""
      } ${
        a.selected ? "bg-primary/5 border-primary/30" : "bg-foreground/5 border-foreground/10 opacity-60"
      }`}
    >
      <div
        onClick={() => !applying && onToggle()}
        className={`flex items-start gap-2 p-2 ${applying ? "" : "cursor-pointer"}`}
      >
        <input type="checkbox" checked={a.selected} readOnly disabled={applying} className="mt-1 accent-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs">{emoji}</span>
            <p className="text-xs font-medium text-foreground truncate">{a.subject}</p>
          </div>
          <p className="text-[11px] text-muted-foreground truncate">{a.from}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className={`flex items-center gap-1 ${conf.bg} ${conf.color} px-1.5 py-0.5 rounded text-[10px] font-medium`}>
            <ConfIcon className="w-2.5 h-2.5" /> {conf.label}
          </div>
          <div className="flex flex-wrap gap-1 justify-end">
            {a.suggestedLabels.map((label, li) => (
              <span key={`existing-${li}`} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <Tag className="w-2 h-2" /> {label}
              </span>
            ))}
            {(a.newLabels || []).map((label, li) => (
              <span key={`new-${li}`} className="text-[10px] bg-purple-500/15 text-purple-500 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 border border-purple-500/20">
                <Plus className="w-2 h-2" /> {label}
              </span>
            ))}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
            className="text-muted-foreground hover:text-foreground p-0.5"
          >
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>
      {isExpanded && (
        <div className="px-8 pb-2 text-[11px] text-muted-foreground border-t border-foreground/5 pt-1.5">
          <p className="italic">{a.reason}</p>
          {a.removeLabels?.length > 0 && (
            <p className="mt-1 text-red-400">Remover: {a.removeLabels.join(", ")}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default AutoOrganizePanel;
