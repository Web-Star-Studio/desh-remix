import { useState, useEffect, useMemo, memo } from "react";
import { DeshFile, AISuggestedLink, useFileStorage } from "@/hooks/files/useFileStorage";
import { useSubscription } from "@/hooks/admin/useSubscription";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Download, Share2, Trash2, Star, FileText, Image, Video, Music,
  File, Archive, FileSpreadsheet, Presentation, Loader2, Tag, Brain,
  Link2, CheckCircle, X, Sparkles, AlertCircle, Copy, Check, Clock,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

import { getFileIcon, formatFileSize as formatSize } from "@/utils/fileHelpers";

const formatTimeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("pt-BR");
};

const categoryLabels: Record<string, { label: string; emoji: string; color: string }> = {
  nota_fiscal: { label: "Nota Fiscal", emoji: "🧾", color: "bg-amber-500/10 text-amber-400" },
  contrato: { label: "Contrato", emoji: "📝", color: "bg-blue-500/10 text-blue-400" },
  recibo: { label: "Recibo", emoji: "🧾", color: "bg-green-500/10 text-green-400" },
  comprovante: { label: "Comprovante", emoji: "✅", color: "bg-emerald-500/10 text-emerald-400" },
  foto_pessoal: { label: "Foto Pessoal", emoji: "📸", color: "bg-pink-500/10 text-pink-400" },
  foto_documento: { label: "Foto Documento", emoji: "🪪", color: "bg-indigo-500/10 text-indigo-400" },
  video: { label: "Vídeo", emoji: "🎬", color: "bg-purple-500/10 text-purple-400" },
  documento_texto: { label: "Documento", emoji: "📄", color: "bg-sky-500/10 text-sky-400" },
  planilha: { label: "Planilha", emoji: "📊", color: "bg-green-500/10 text-green-400" },
  apresentacao: { label: "Apresentação", emoji: "📽️", color: "bg-orange-500/10 text-orange-400" },
  codigo: { label: "Código", emoji: "💻", color: "bg-gray-500/10 text-gray-400" },
  audio: { label: "Áudio", emoji: "🎵", color: "bg-violet-500/10 text-violet-400" },
  ebook: { label: "E-book", emoji: "📚", color: "bg-yellow-500/10 text-yellow-400" },
  outro: { label: "Outro", emoji: "📁", color: "bg-muted text-muted-foreground" },
};

const entityTypeLabels: Record<string, string> = {
  contact: "Contato",
  task: "Tarefa",
  transaction: "Transação",
  note: "Nota",
};

interface FilePreviewDrawerProps {
  file: DeshFile | null;
  open: boolean;
  onClose: () => void;
  onDownload: (fileId: string) => void;
  onShare: (file: { id: string; name: string }) => void;
  onTrash: (fileId: string) => void;
  onToggleFavorite: (fileId: string, fav: boolean) => void;
}

const FilePreviewDrawer = memo(({ file, open, onClose, onDownload, onShare, onTrash, onToggleFavorite }: FilePreviewDrawerProps) => {
  const { getPreviewUrl, linkFile, analyzeFile } = useFileStorage();
  const { credits } = useSubscription();
  const queryClient = useQueryClient();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [linkingIndex, setLinkingIndex] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [copiedOcr, setCopiedOcr] = useState(false);

  useEffect(() => {
    if (!file || !open) { setPreviewUrl(null); setAnalyzing(false); setAnalyzeError(null); setCopiedOcr(false); return; }
    if (file.mime_type.startsWith("image/") && file.thumbnail_url) {
      setPreviewUrl(file.thumbnail_url);
      return;
    }
    if (file.mime_type.startsWith("image/") || file.mime_type.includes("pdf")) {
      setLoadingPreview(true);
      getPreviewUrl(file.id).then((r) => {
        if (r?.url) setPreviewUrl(r.url);
      }).finally(() => setLoadingPreview(false));
    }
  }, [file, open, getPreviewUrl]);

  const handleAnalyze = async () => {
    if (!file) return;
    const balance = credits?.balance ?? 0;
    if (balance < 2) {
      toast({ title: "Créditos insuficientes", description: "Você precisa de 2 créditos.", variant: "destructive" });
      setAnalyzeError("insufficient_credits");
      return;
    }
    setAnalyzing(true);
    setAnalyzeError(null);
    const result = await analyzeFile(file.id);
    setAnalyzing(false);
    if (result.success) {
      toast({ title: "Análise concluída", description: "O arquivo foi analisado pela IA." });
      queryClient.invalidateQueries({ queryKey: ["files"] });
    } else if (result.error === "insufficient_credits") {
      setAnalyzeError("insufficient_credits");
      toast({ title: "Créditos insuficientes", variant: "destructive" });
    } else {
      setAnalyzeError(result.error || "unknown");
      toast({ title: "Erro na análise", description: result.error, variant: "destructive" });
    }
  };

  const handleLinkSuggestion = async (suggestion: AISuggestedLink, index: number) => {
    if (!file || !suggestion.entity_id) return;
    setLinkingIndex(index);
    try {
      await linkFile(file.id, suggestion.entity_type, suggestion.entity_id);
      toast({ title: "Vinculado!", description: `Arquivo vinculado ao ${entityTypeLabels[suggestion.entity_type] || suggestion.entity_type}` });
    } catch (err: any) {
      toast({ title: "Erro ao vincular", description: err.message, variant: "destructive" });
    } finally {
      setLinkingIndex(null);
    }
  };

  const handleCopyOcr = () => {
    if (!file?.ocr_text) return;
    navigator.clipboard.writeText(file.ocr_text);
    setCopiedOcr(true);
    setTimeout(() => setCopiedOcr(false), 2000);
    toast({ title: "Texto copiado!" });
  };

  // Compute file "freshness" indicator
  const freshness = useMemo(() => {
    if (!file) return null;
    const age = Date.now() - new Date(file.created_at).getTime();
    const days = age / 86400000;
    if (days < 1) return { label: "Novo", color: "bg-green-500/10 text-green-400" };
    if (days < 7) return { label: "Recente", color: "bg-blue-500/10 text-blue-400" };
    if (days < 30) return { label: "Este mês", color: "bg-muted text-muted-foreground" };
    return null;
  }, [file]);

  if (!file) return null;
  const Icon = getFileIcon(file.mime_type);
  const catInfo = file.ai_category ? categoryLabels[file.ai_category] || categoryLabels.outro : null;
  const isAnalyzed = !!file.ai_category;
  const suggestedLinks = (file.ai_suggested_links || []).filter((l: AISuggestedLink) => l.resolved && l.entity_id);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-sm truncate">{file.name}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {/* Preview */}
          <div className="w-full aspect-video rounded-xl bg-foreground/5 border border-border/50 flex items-center justify-center overflow-hidden relative">
            {loadingPreview ? (
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            ) : previewUrl && file.mime_type.startsWith("image/") ? (
              <img src={previewUrl} alt={file.name} className="w-full h-full object-contain" />
            ) : previewUrl && file.mime_type.includes("pdf") ? (
              <iframe src={previewUrl} className="w-full h-full" title={file.name} />
            ) : file.mime_type.startsWith("video/") ? (
              <div className="flex flex-col items-center gap-2">
                <Video className="w-12 h-12 text-muted-foreground/30" />
                <p className="text-[10px] text-muted-foreground">Prévia de vídeo indisponível</p>
              </div>
            ) : file.mime_type.startsWith("audio/") ? (
              <div className="flex flex-col items-center gap-2">
                <Music className="w-12 h-12 text-muted-foreground/30" />
                <p className="text-[10px] text-muted-foreground">{file.extension?.toUpperCase() || "Áudio"}</p>
              </div>
            ) : (
              <Icon className="w-16 h-16 text-muted-foreground/30" />
            )}
            {/* Freshness badge */}
            {freshness && (
              <span className={`absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${freshness.color}`}>
                {freshness.label}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onDownload(file.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Baixar
            </button>
            <button
              onClick={() => onShare({ id: file.id, name: file.name })}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-muted text-foreground text-xs font-medium hover:bg-muted/70 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" /> Compartilhar
            </button>
            <button
              onClick={() => onToggleFavorite(file.id, !file.is_favorite)}
              className={`p-2 rounded-lg hover:bg-muted transition-colors ${file.is_favorite ? "text-yellow-500" : "text-muted-foreground"}`}
            >
              <Star className={`w-4 h-4 ${file.is_favorite ? "fill-current" : ""}`} />
            </button>
            <button
              onClick={() => { onTrash(file.id); onClose(); }}
              className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Metadata */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Detalhes</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-foreground/5">
                <p className="text-muted-foreground text-[10px]">Tamanho</p>
                <p className="font-medium">{formatSize(file.size_bytes)}</p>
              </div>
              <div className="p-2 rounded-lg bg-foreground/5">
                <p className="text-muted-foreground text-[10px]">Tipo</p>
                <p className="font-medium truncate">{file.extension?.toUpperCase() || file.mime_type.split("/")[1]}</p>
              </div>
              <div className="p-2 rounded-lg bg-foreground/5">
                <p className="text-muted-foreground text-[10px]">Criado em</p>
                <p className="font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  {formatTimeAgo(file.created_at)}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-foreground/5">
                <p className="text-muted-foreground text-[10px]">Versão</p>
                <p className="font-medium">v{file.version || 1}</p>
              </div>
              {file.content_hash && (
                <div className="col-span-2 p-2 rounded-lg bg-foreground/5">
                  <p className="text-muted-foreground text-[10px]">Hash</p>
                  <p className="font-mono text-[10px] truncate" title={file.content_hash}>{file.content_hash.slice(0, 16)}…</p>
                </div>
              )}
            </div>
          </div>

          {/* AI Analyze Button */}
          {!isAnalyzed && (
            <div className="space-y-2">
              {analyzeError === "insufficient_credits" ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-destructive font-medium">Créditos insuficientes</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">2 créditos necessários.</p>
                  </div>
                  <button onClick={handleAnalyze} className="shrink-0 px-2.5 py-1.5 rounded-md text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                    Tentar novamente
                  </button>
                </div>
              ) : analyzeError ? (
                <button onClick={handleAnalyze} disabled={analyzing} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors border border-destructive/20">
                  <AlertCircle className="w-3.5 h-3.5" /> Tentar novamente
                </button>
              ) : (
                <button onClick={handleAnalyze} disabled={analyzing} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors border border-amber-500/20 disabled:opacity-50">
                  {analyzing ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analisando...</>
                  ) : (
                    <><Sparkles className="w-3.5 h-3.5" /> Analisar com IA <span className="text-[9px] opacity-60">(2 créditos)</span></>
                  )}
                </button>
              )}
            </div>
          )}

          {/* AI info */}
          {(catInfo || file.ai_summary || (file.ai_tags && file.ai_tags.length > 0)) && (
            <div className="space-y-3">
              <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Brain className="w-3 h-3" /> Inteligência Artificial
              </h4>
              {catInfo && (
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium ${catInfo.color}`}>
                  <span>{catInfo.emoji}</span> {catInfo.label}
                </span>
              )}
              {file.ai_summary && (
                <p className="text-xs text-muted-foreground leading-relaxed">{file.ai_summary}</p>
              )}
              {file.ai_tags && file.ai_tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {file.ai_tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] bg-muted text-muted-foreground">
                      <Tag className="w-2.5 h-2.5" /> {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* AI Suggested Links */}
          {suggestedLinks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Sugestões de vinculação
              </h4>
              <div className="space-y-2">
                {suggestedLinks.map((link: AISuggestedLink, i: number) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                    <Link2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-foreground leading-relaxed">{link.reason}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {entityTypeLabels[link.entity_type] || link.entity_type}
                        {link.search_term ? `: ${link.search_term}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => handleLinkSuggestion(link, i)}
                      disabled={linkingIndex === i}
                      className="p-1 rounded hover:bg-primary/20 text-primary transition-colors shrink-0"
                      title="Vincular"
                    >
                      {linkingIndex === i ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* OCR Text with copy button */}
          {file.ocr_text && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <FileText className="w-3 h-3" /> Texto extraído (OCR)
                </h4>
                <button
                  onClick={handleCopyOcr}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  {copiedOcr ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  {copiedOcr ? "Copiado" : "Copiar"}
                </button>
              </div>
              <div className="p-2.5 rounded-lg bg-foreground/5 border border-border/30 max-h-32 overflow-y-auto">
                <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{file.ocr_text.slice(0, 1500)}</p>
                {file.ocr_text.length > 1500 && (
                  <p className="text-[9px] text-muted-foreground/50 mt-1">… {file.ocr_text.length - 1500} caracteres a mais</p>
                )}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
});

FilePreviewDrawer.displayName = "FilePreviewDrawer";

export default FilePreviewDrawer;
