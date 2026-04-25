import { useState, useMemo } from "react";
import {
  X, Loader2, MailMinus, Shield, ShieldAlert, ShieldCheck,
  Trash2, CheckSquare, Square, AlertTriangle, ChevronDown, ChevronUp,
  Search, Filter, Ban, StopCircle,
} from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { UnsubscribeSender } from "@/hooks/email/useSmartUnsubscribe";

interface SmartUnsubscribePanelProps {
  show: boolean;
  onClose: () => void;
  senders: UnsubscribeSender[] | null;
  scanning: boolean;
  unsubscribing: boolean;
  fetchingHeaders: boolean;
  progress: { current: number; total: number } | null;
  scanProgress?: { current: number; total: number } | null;
  onUnsubscribe: (senders: UnsubscribeSender[], opts: { trashAfter: boolean }) => void;
  onCancel?: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  newsletter: "📰",
  marketing: "📢",
  social: "👥",
  promotional: "🏷️",
  notification: "🔔",
  transactional: "🏦",
  outro: "📧",
};

const TIER_CONFIG = {
  safe: { icon: ShieldCheck, color: "text-emerald-400", bg: "bg-emerald-500/15", label: "Seguro", border: "border-emerald-500/20" },
  caution: { icon: ShieldAlert, color: "text-amber-400", bg: "bg-amber-500/15", label: "Atenção", border: "border-amber-500/20" },
  keep: { icon: Shield, color: "text-red-400", bg: "bg-red-500/15", label: "Manter", border: "border-red-500/20" },
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-muted text-muted-foreground" },
  processing: { label: "Processando...", className: "bg-primary/20 text-primary animate-pulse" },
  success: { label: "✓ Descadastrado", className: "bg-emerald-500/20 text-emerald-400" },
  failed: { label: "✗ Falhou", className: "bg-red-500/20 text-red-400" },
  skipped: { label: "Pulado", className: "bg-muted text-muted-foreground" },
};

type TierFilter = "all" | "safe" | "caution" | "keep";

const SmartUnsubscribePanel = ({
  show, onClose, senders, scanning, unsubscribing, fetchingHeaders, progress, scanProgress, onUnsubscribe, onCancel,
}: SmartUnsubscribePanelProps) => {
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmTrash, setConfirmTrash] = useState(false);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");

  // Filtered & searched senders
  const filteredSenders = useMemo(() => {
    if (!senders) return [];
    let list = senders;
    if (tierFilter !== "all") {
      list = list.filter((s) => s.safetyTier === tierFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.senderName.toLowerCase().includes(q) ||
          s.senderEmail.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q),
      );
    }
    return list;
  }, [senders, tierFilter, searchQuery]);

  // Method distribution
  const methodCounts = useMemo(() => {
    if (!senders) return { http: 0, oneClick: 0, mailto: 0, none: 0 };
    return senders.reduce(
      (acc, s) => {
        if (!s.unsubscribeUrl) acc.none++;
        else if (s.unsubscribeMethod === "POST") acc.oneClick++;
        else if (s.unsubscribeMethod === "mailto") acc.mailto++;
        else acc.http++;
        return acc;
      },
      { http: 0, oneClick: 0, mailto: 0, none: 0 },
    );
  }, [senders]);

  if (!show) return null;

  const safeSenders = senders?.filter((s) => s.safetyTier === "safe") || [];
  const cautionSenders = senders?.filter((s) => s.safetyTier === "caution") || [];
  const keepSenders = senders?.filter((s) => s.safetyTier === "keep") || [];

  const toggleSelect = (email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      next.has(email) ? next.delete(email) : next.add(email);
      return next;
    });
  };

  const selectAllSafe = () => {
    if (!senders) return;
    const safeEmails = senders
      .filter((s) => s.safetyTier === "safe")
      .map((s) => s.senderEmail);
    setSelectedEmails(new Set(safeEmails));
  };

  const selectAllVisible = () => {
    const emails = filteredSenders.map((s) => s.senderEmail);
    setSelectedEmails(new Set(emails));
  };

  const handleBatchUnsubscribe = (trash: boolean) => {
    if (!senders) return;
    const selected = senders.filter((s) => selectedEmails.has(s.senderEmail));
    if (selected.length === 0) return;
    setConfirmTrash(trash);
    setShowConfirmDialog(true);
  };

  const confirmUnsubscribe = () => {
    if (!senders) return;
    const selected = senders.filter((s) => selectedEmails.has(s.senderEmail));
    setShowConfirmDialog(false);
    onUnsubscribe(selected, { trashAfter: confirmTrash });
    setSelectedEmails(new Set());
  };

  const totalEmails = senders?.reduce((sum, s) => sum + s.emailCount, 0) || 0;
  const actionableCount = senders?.filter((s) => s.unsubscribeUrl).length || 0;
  const noLinkCount = (senders?.length || 0) - actionableCount;

  // How many selected have/don't have links
  const selectedWithLink = senders?.filter((s) => selectedEmails.has(s.senderEmail) && s.unsubscribeUrl).length || 0;
  const selectedNoLink = senders?.filter((s) => selectedEmails.has(s.senderEmail) && !s.unsubscribeUrl).length || 0;

  // Completed stats (after execution)
  const successCount = senders?.filter((s) => s.status === "success").length || 0;
  const failedCount = senders?.filter((s) => s.status === "failed").length || 0;
  const isExecutionDone = !unsubscribing && (successCount > 0 || failedCount > 0);

  return (
    <AnimatedItem>
      <GlassCard size="auto" className="mb-4 p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-foreground/10">
          <div className="flex items-center gap-2">
            <MailMinus className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-sm">Smart Unsubscribe</h3>
            {senders && (
              <Badge variant="outline" className="text-xs">
                {senders.length} senders · {totalEmails} e-mails
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {(unsubscribing || scanning) && onCancel && (
              <button
                onClick={onCancel}
                className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:bg-red-500/15 rounded-lg transition-colors"
              >
                <StopCircle className="w-3.5 h-3.5" />
                Cancelar
              </button>
            )}
            <button onClick={onClose} className="p-1 hover:bg-foreground/10 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Loading */}
        {(scanning || fetchingHeaders) && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">
              {scanning ? "Analisando e-mails com IA..." : "Buscando links de descadastro..."}
            </p>
            {scanning && scanProgress && scanProgress.total > 1 && (
              <div className="w-full max-w-xs space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Lote {scanProgress.current}/{scanProgress.total}</span>
                  <span>{Math.round((scanProgress.current / scanProgress.total) * 100)}%</span>
                </div>
                <Progress value={(scanProgress.current / scanProgress.total) * 100} className="h-1.5" />
              </div>
            )}
          </div>
        )}

        {/* Progress */}
        {progress && unsubscribing && (
          <div className="px-4 py-3 border-b border-foreground/10">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Processando descadastros...</span>
              <span>{progress.current}/{progress.total}</span>
            </div>
            <Progress value={(progress.current / progress.total) * 100} className="h-2" />
          </div>
        )}

        {/* Execution summary */}
        {isExecutionDone && (
          <div className="px-4 py-3 border-b border-foreground/10 bg-foreground/5">
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                {successCount} sucesso
              </span>
              {failedCount > 0 && (
                <span className="flex items-center gap-1 text-red-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {failedCount} falha(s)
                </span>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        {!scanning && !fetchingHeaders && senders && senders.length > 0 && (
          <div className="max-h-[65vh] overflow-y-auto">
            {/* Stats bar */}
            <div className="px-4 py-3 bg-foreground/5 border-b border-foreground/10">
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  {safeSenders.length} seguros
                </span>
                <span className="flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  {cautionSenders.length} atenção
                </span>
                <span className="flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-red-400" />
                  {keepSenders.length} manter
                </span>
                <span className="text-muted-foreground ml-auto">
                  {actionableCount} com link · {noLinkCount} sem link
                </span>
              </div>
              {/* Method stats */}
              <div className="flex flex-wrap gap-2 mt-2 text-[10px] text-muted-foreground">
                {methodCounts.oneClick > 0 && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                    ⚡ {methodCounts.oneClick} One-Click
                  </Badge>
                )}
                {methodCounts.http > 0 && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                    🔗 {methodCounts.http} HTTP
                  </Badge>
                )}
                {methodCounts.mailto > 0 && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                    ✉️ {methodCounts.mailto} Mailto
                  </Badge>
                )}
                {methodCounts.none > 0 && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 opacity-50">
                    ❌ {methodCounts.none} sem link
                  </Badge>
                )}
              </div>
            </div>

            {/* Search + Filter bar */}
            <div className="px-4 py-2 border-b border-foreground/10 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar sender..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-foreground/5 rounded-lg border border-foreground/10 focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex gap-1">
                {(["all", "safe", "caution", "keep"] as TierFilter[]).map((tier) => (
                  <button
                    key={tier}
                    onClick={() => setTierFilter(tier)}
                    className={`text-[10px] px-2 py-1 rounded-md transition-colors ${
                      tierFilter === tier
                        ? "bg-primary/20 text-primary"
                        : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
                    }`}
                  >
                    {tier === "all" ? "Todos" : tier === "safe" ? "Seguros" : tier === "caution" ? "Atenção" : "Manter"}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            {!unsubscribing && (
              <div className="px-4 py-2 border-b border-foreground/10 flex flex-wrap gap-2">
                <button
                  onClick={selectAllSafe}
                  className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                >
                  Selecionar seguros ({safeSenders.length})
                </button>
                {filteredSenders.length > 0 && (
                  <button
                    onClick={selectAllVisible}
                    className="text-xs px-3 py-1.5 rounded-lg bg-foreground/10 text-muted-foreground hover:bg-foreground/15 transition-colors"
                  >
                    Selecionar todos ({filteredSenders.length})
                  </button>
                )}
                {selectedEmails.size > 0 && (
                  <>
                    <button
                      onClick={() => handleBatchUnsubscribe(false)}
                      disabled={unsubscribing || selectedWithLink === 0}
                      className="text-xs px-3 py-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={selectedWithLink === 0 ? "Nenhum dos selecionados possui link de descadastro" : undefined}
                    >
                      <MailMinus className="w-3 h-3 inline mr-1" />
                      Descadastrar ({selectedWithLink})
                    </button>
                    <button
                      onClick={() => handleBatchUnsubscribe(true)}
                      disabled={unsubscribing}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3 inline mr-1" />
                      + Excluir ({selectedEmails.size})
                    </button>
                    <button
                      onClick={() => setSelectedEmails(new Set())}
                      className="text-xs px-3 py-1.5 rounded-lg bg-foreground/10 text-muted-foreground hover:bg-foreground/15 transition-colors"
                    >
                      Limpar
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Sender list */}
            <div className="divide-y divide-foreground/5">
              {filteredSenders.length === 0 && (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  <Filter className="w-6 h-6 mx-auto mb-2 opacity-40" />
                  Nenhum sender encontrado com os filtros atuais.
                </div>
              )}
              {filteredSenders.map((sender) => {
                const tierCfg = TIER_CONFIG[sender.safetyTier];
                const TierIcon = tierCfg.icon;
                const statusCfg = STATUS_BADGE[sender.status];
                const isSelected = selectedEmails.has(sender.senderEmail);
                const isExpanded = expandedEmail === sender.senderEmail;
                const hasUrl = !!sender.unsubscribeUrl;
                const isProcessed = sender.status === "success" || sender.status === "failed";

                return (
                  <div
                    key={sender.senderEmail}
                    className={`px-4 py-3 hover:bg-foreground/5 transition-colors ${isSelected ? "bg-primary/5" : ""} ${isProcessed ? "opacity-70" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Checkbox - disabled during execution or if already processed */}
                      <button
                        onClick={() => !unsubscribing && !isProcessed && toggleSelect(sender.senderEmail)}
                        className={`flex-shrink-0 ${unsubscribing || isProcessed ? "cursor-not-allowed opacity-50" : ""}`}
                        disabled={unsubscribing || isProcessed}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <Square className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>

                      {/* Category icon */}
                      <span className="text-lg flex-shrink-0">
                        {CATEGORY_ICONS[sender.category] || "📧"}
                      </span>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{sender.senderName}</span>
                          <Badge className={`text-[10px] px-1.5 py-0 ${tierCfg.bg} ${tierCfg.color} border-0`}>
                            <TierIcon className="w-3 h-3 mr-0.5" />
                            {tierCfg.label}
                          </Badge>
                          {sender.status !== "pending" && (
                            <Badge className={`text-[10px] px-1.5 py-0 border-0 ${statusCfg.className}`}>
                              {statusCfg.label}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground truncate">{sender.senderEmail}</span>
                          <span className="text-xs text-muted-foreground">· {sender.emailCount} e-mails</span>
                          {!hasUrl && sender.status === "pending" && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-amber-500/30 text-amber-400">
                              <Ban className="w-2.5 h-2.5 mr-0.5" />
                              sem link · apenas excluir
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Score */}
                      <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                        <span className={`text-sm font-bold ${tierCfg.color}`}>{sender.safetyScore}</span>
                        <span className="text-[10px] text-muted-foreground">score</span>
                      </div>

                      {/* Expand */}
                      <button
                        onClick={() => setExpandedEmail(isExpanded ? null : sender.senderEmail)}
                        className="p-1 hover:bg-foreground/10 rounded transition-colors flex-shrink-0"
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="mt-2 ml-11 p-3 rounded-lg bg-foreground/5 text-xs space-y-1.5">
                        <p className="text-muted-foreground">{sender.reason}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-muted-foreground">Categoria:</span>
                          <Badge variant="outline" className="text-[10px]">{sender.category}</Badge>
                          <span className="text-muted-foreground ml-2">E-mails:</span>
                          <Badge variant="outline" className="text-[10px]">{sender.emailIds.length} rastreados</Badge>
                        </div>
                        {sender.unsubscribeUrl && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Método:</span>
                            <Badge variant="outline" className="text-[10px]">
                              {sender.unsubscribeMethod === "POST"
                                ? "⚡ RFC 8058 One-Click"
                                : sender.unsubscribeMethod === "mailto"
                                  ? "✉️ Mailto"
                                  : "🔗 HTTP Link"}
                            </Badge>
                          </div>
                        )}
                        {!sender.unsubscribeUrl && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Método:</span>
                            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">
                              Nenhum link detectado — use "+ Excluir" para mover para lixeira
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!scanning && !fetchingHeaders && senders && senders.length === 0 && (
          <div className="py-12 text-center">
            <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <p className="text-sm font-medium">Inbox limpa!</p>
            <p className="text-xs text-muted-foreground mt-1">Nenhum sender de marketing/newsletter encontrado.</p>
          </div>
        )}

        {/* Confirm dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                Confirmar Descadastramento
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>
                  {selectedWithLink > 0 && (
                    <span className="block">
                      Você será descadastrado de <strong>{selectedWithLink}</strong> remetente(s) com link de descadastro.
                    </span>
                  )}
                  {selectedNoLink > 0 && confirmTrash && (
                    <span className="block mt-1 text-amber-400">
                      {selectedNoLink} remetente(s) sem link — seus e-mails serão apenas excluídos.
                    </span>
                  )}
                  {selectedNoLink > 0 && !confirmTrash && (
                    <span className="block mt-1 text-muted-foreground">
                      {selectedNoLink} remetente(s) sem link serão ignorados (use "+ Excluir" para incluí-los).
                    </span>
                  )}
                  {confirmTrash && (
                    <span className="block mt-1 text-red-400">
                      Todos os e-mails associados serão movidos para a lixeira.
                    </span>
                  )}
                  <span className="block mt-2">Esta ação não pode ser desfeita.</span>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmUnsubscribe}>
                {confirmTrash ? "Descadastrar + Excluir" : "Descadastrar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </GlassCard>
    </AnimatedItem>
  );
};

export default SmartUnsubscribePanel;
