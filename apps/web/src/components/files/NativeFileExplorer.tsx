import { useState, useCallback, useRef, useMemo, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFileStorage, DeshFile, DeshFolder } from "@/hooks/files/useFileStorage";
import FileUploadZone from "@/components/files/FileUploadZone";
import StorageMeter from "@/components/files/StorageMeter";
import ShareDialog from "@/components/files/ShareDialog";
import VersionHistory from "@/components/files/VersionHistory";
import FilePreviewDrawer from "@/components/files/FilePreviewDrawer";
import MoveToFolderDialog from "@/components/files/MoveToFolderDialog";
import GlassCard from "@/components/dashboard/GlassCard";
import { toast } from "@/hooks/use-toast";
import {
  FolderOpen, FolderPlus, FileText, Image, File, Video, Music,
  Archive, FileSpreadsheet, Presentation, Grid, List, Search,
  Trash2, Star, Download, Edit3, MoreVertical, Loader2,
  ChevronRight, RefreshCw, Share2, History, Home, Upload,
  FolderInput, SortAsc, Filter, Eye, CheckSquare, Square, XCircle,
  Sparkles, Brain,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

/* ── Helpers ────────────────────────────────────────── */

import { getFileIcon, formatFileSize as formatSize } from "@/utils/fileHelpers";

const getMimeCategory = (mime: string) => {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.includes("pdf") || mime.includes("document") || mime.includes("text")) return "document";
  return "other";
};

const categoryBadges: Record<string, string> = {
  nota_fiscal: "🧾 Nota Fiscal",
  contrato: "📝 Contrato",
  recibo: "🧾 Recibo",
  comprovante: "✅ Comprovante",
  foto_pessoal: "📸 Foto",
  foto_documento: "🪪 Documento",
  video: "🎬 Vídeo",
  documento_texto: "📄 Documento",
  planilha: "📊 Planilha",
  apresentacao: "📽️ Apresentação",
  codigo: "💻 Código",
  audio: "🎵 Áudio",
  ebook: "📚 E-book",
};

const getCategoryBadge = (category: string) => categoryBadges[category] || category;

type ViewMode = "grid" | "list";
type Section = "files" | "favorites" | "trash";
type SortField = "name" | "size" | "date" | "type";
type SortDir = "asc" | "desc";
type TypeFilter = "all" | "image" | "document" | "video" | "audio" | "other";
type AICategoryFilter = "all" | "nota_fiscal" | "contrato" | "recibo" | "comprovante" | "foto_pessoal" | "foto_documento" | "documento_texto" | "planilha" | "apresentacao" | "codigo" | "audio" | "ebook" | "outro" | "unanalyzed";

/* ── Component ──────────────────────────────────────── */

const NativeFileExplorer = () => {
  const {
    folders, allFolders, loading: hookLoading, uploads,
    listFiles, uploadFiles, createFolder, renameFile, renameFolder, moveFiles,
    trashFiles, restoreFiles, permanentDelete, emptyTrash, deleteFolder,
    toggleFavorite, getDownloadUrl, analyzeFiles,
  } = useFileStorage();

  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [section, setSection] = useState<Section>("files");
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState("");
  const [sharingFile, setSharingFile] = useState<{ id: string; name: string } | null>(null);
  const [versionFileId, setVersionFileId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<DeshFile | null>(null);
  const [movingFileIds, setMovingFileIds] = useState<string[] | null>(null);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [aiCategoryFilter, setAiCategoryFilter] = useState<AICategoryFilter>("all");
  const [dragFileId, setDragFileId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const uploadRef = useRef<HTMLInputElement>(null);

  const currentFolderId = folderPath.length > 0 ? folderPath[folderPath.length - 1].id : undefined;

  const queryKey = ["files", currentFolderId ?? "root", section, search];

  const { data: queryData, isLoading: queryLoading } = useQuery({
    queryKey,
    queryFn: () => listFiles({
      folderId: currentFolderId,
      trashed: section === "trash",
      favorites: section === "favorites",
      search: search || undefined,
    }),
    staleTime: 30 * 60 * 1000,
  });

  const files = queryData?.files ?? [];
  const loading = hookLoading || queryLoading;

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["files"] });
    setSelectedIds(new Set());
  }, [queryClient]);

  /* ── Selection ─── */

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedIds.size === files.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(files.map((f) => f.id)));
    }
  }, [files, selectedIds.size]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  /* ── Batch actions ─── */

  const handleBatchTrash = useCallback(async () => {
    if (selectedIds.size === 0) return;
    await trashFiles(Array.from(selectedIds));
    clearSelection();
    refresh();
    toast({ title: `${selectedIds.size} arquivo(s) movido(s) para lixeira` });
  }, [selectedIds, trashFiles, clearSelection, refresh]);

  const handleBatchRestore = useCallback(async () => {
    if (selectedIds.size === 0) return;
    await restoreFiles(Array.from(selectedIds));
    clearSelection();
    refresh();
    toast({ title: `${selectedIds.size} arquivo(s) restaurado(s)` });
  }, [selectedIds, restoreFiles, clearSelection, refresh]);

  const handleBatchMove = useCallback(() => {
    if (selectedIds.size === 0) return;
    setMovingFileIds(Array.from(selectedIds));
  }, [selectedIds]);

  const handleBatchDownload = useCallback(async () => {
    for (const id of selectedIds) {
      const result = await getDownloadUrl(id);
      if (result?.url) {
        const a = document.createElement("a");
        a.href = result.url;
        a.download = result.name;
        a.target = "_blank";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }
  }, [selectedIds, getDownloadUrl]);

  const [batchAnalyzing, setBatchAnalyzing] = useState(false);
  const handleBatchAnalyze = useCallback(async () => {
    if (selectedIds.size === 0) return;
    // Filter only non-analyzed files
    const toAnalyze = files.filter((f) => selectedIds.has(f.id) && !f.ai_category);
    if (toAnalyze.length === 0) {
      toast({ title: "Todos os arquivos selecionados já foram analisados" });
      return;
    }
    if (!window.confirm(`Analisar ${toAnalyze.length} arquivo(s) com IA? Custo: ${toAnalyze.length * 2} créditos.`)) return;
    setBatchAnalyzing(true);
    const result = await analyzeFiles(toAnalyze.map((f) => f.id));
    setBatchAnalyzing(false);
    clearSelection();
    refresh();
    toast({ title: `Análise concluída: ${result.succeeded} OK, ${result.failed} falha(s)` });
  }, [selectedIds, files, analyzeFiles, clearSelection, refresh]);

  const handleEmptyTrash = useCallback(async () => {
    if (!window.confirm("Esvaziar a lixeira? Esta ação não pode ser desfeita.")) return;
    await emptyTrash();
    refresh();
    toast({ title: "Lixeira esvaziada" });
  }, [emptyTrash, refresh]);

  /* ── Handlers ─── */

  const handleUpload = useCallback(
    async (selectedFiles: File[]) => {
      const results = await uploadFiles(selectedFiles, currentFolderId);
      if (results.length > 0) refresh();
    },
    [uploadFiles, currentFolderId, refresh]
  );

  const handleCreateFolder = useCallback(async () => {
    const name = prompt("Nome da pasta:");
    if (!name) return;
    await createFolder(name, currentFolderId);
    refresh();
    toast({ title: "Pasta criada" });
  }, [createFolder, currentFolderId, refresh]);

  const enterFolder = (folder: DeshFolder) => {
    setFolderPath((p) => [...p, { id: folder.id, name: folder.name }]);
    clearSelection();
  };

  const handleRename = async (fileId: string) => {
    if (!renameValue.trim()) return;
    await renameFile(fileId, renameValue.trim());
    setRenamingId(null);
    refresh();
  };

  const handleRenameFolder = async (folderId: string) => {
    if (!renameFolderValue.trim()) return;
    await renameFolder(folderId, renameFolderValue.trim());
    setRenamingFolderId(null);
    refresh();
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!window.confirm("Excluir esta pasta? Os arquivos dentro serão movidos para a raiz.")) return;
    await deleteFolder(folderId);
    refresh();
    toast({ title: "Pasta excluída" });
  };

  const handleDownload = async (fileId: string) => {
    const result = await getDownloadUrl(fileId);
    if (result?.url) {
      const a = document.createElement("a");
      a.href = result.url;
      a.download = result.name;
      a.target = "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleMoveFiles = async (targetFolderId: string | null) => {
    if (!movingFileIds) return;
    await moveFiles(movingFileIds, targetFolderId);
    setMovingFileIds(null);
    clearSelection();
    refresh();
    toast({ title: "Arquivo movido" });
  };

  const handleDrop = async (targetFolderId: string, e: React.DragEvent) => {
    e.preventDefault();
    const fileId = e.dataTransfer.getData("text/plain");
    if (fileId) {
      await moveFiles([fileId], targetFolderId);
      refresh();
      toast({ title: "Arquivo movido" });
    }
    setDragFileId(null);
  };

  const handleTrashAndRefresh = async (fileId: string) => {
    await trashFiles([fileId]);
    refresh();
    toast({ title: "Movido para a lixeira" });
  };

  const handleFavAndRefresh = async (fileId: string, fav: boolean) => {
    await toggleFavorite(fileId, fav);
    refresh();
  };

  /* ── Sort & Filter (memoized) ─── */

  const sortedFiles = useMemo(() =>
    [...files]
      .filter((f) => typeFilter === "all" || getMimeCategory(f.mime_type) === typeFilter)
      .filter((f) => {
        if (aiCategoryFilter === "all") return true;
        if (aiCategoryFilter === "unanalyzed") return !f.ai_category;
        return f.ai_category === aiCategoryFilter;
      })
      .sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
          case "name": cmp = a.name.localeCompare(b.name); break;
          case "size": cmp = a.size_bytes - b.size_bytes; break;
          case "date": cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
          case "type": cmp = a.mime_type.localeCompare(b.mime_type); break;
        }
        return sortDir === "asc" ? cmp : -cmp;
      }),
    [files, typeFilter, aiCategoryFilter, sortField, sortDir]
  );

  /* ── Section buttons ─── */

  const sectionButtons: { key: Section; label: string; icon: React.ReactNode }[] = [
    { key: "files", label: "Arquivos", icon: <FolderOpen className="w-4 h-4" /> },
    { key: "favorites", label: "Favoritos", icon: <Star className="w-4 h-4" /> },
    { key: "trash", label: "Lixeira", icon: <Trash2 className="w-4 h-4" /> },
  ];

  /* ── File menu items ─── */

  const renderFileMenu = (file: DeshFile) => (
    <DropdownMenu>
      <DropdownMenuTrigger className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted" onClick={(e) => e.stopPropagation()}>
        <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="text-xs">
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setPreviewFile(file); }}>
          <Eye className="w-3.5 h-3.5 mr-2" /> Abrir
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownload(file.id); }}>
          <Download className="w-3.5 h-3.5 mr-2" /> Baixar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenamingId(file.id); setRenameValue(file.name); }}>
          <Edit3 className="w-3.5 h-3.5 mr-2" /> Renomear
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setMovingFileIds([file.id]); }}>
          <FolderInput className="w-3.5 h-3.5 mr-2" /> Mover para...
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleFavAndRefresh(file.id, !file.is_favorite); }}>
          <Star className={`w-3.5 h-3.5 mr-2 ${file.is_favorite ? "fill-yellow-500 text-yellow-500" : ""}`} />
          {file.is_favorite ? "Desfavoritar" : "Favoritar"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSharingFile({ id: file.id, name: file.name }); }}>
          <Share2 className="w-3.5 h-3.5 mr-2" /> Compartilhar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setVersionFileId(file.id); }}>
          <History className="w-3.5 h-3.5 mr-2" /> Versões
        </DropdownMenuItem>
        {section === "trash" ? (
          <>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); restoreFiles([file.id]).then(refresh); }}>Restaurar</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); permanentDelete([file.id]).then(refresh); }}>Excluir permanentemente</DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); handleTrashAndRefresh(file.id); }}>
            <Trash2 className="w-3.5 h-3.5 mr-2" /> Mover para lixeira
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderFolderMenu = (folder: DeshFolder) => (
    <DropdownMenu>
      <DropdownMenuTrigger className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted" onClick={(e) => e.stopPropagation()}>
        <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="text-xs">
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenamingFolderId(folder.id); setRenameFolderValue(folder.name); }}>
          <Edit3 className="w-3.5 h-3.5 mr-2" /> Renomear
        </DropdownMenuItem>
        <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }}>
          <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir pasta
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  /* ── Render ─── */

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          {sectionButtons.map((s) => (
            <button
              key={s.key}
              onClick={() => { setSection(s.key); setFolderPath([]); setSearch(""); clearSelection(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                section === s.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar arquivos..."
            className="pl-8 h-8 text-xs"
          />
        </div>

        <div className="flex items-center gap-1 ml-auto">
          {/* Sort */}
          <Select value={`${sortField}-${sortDir}`} onValueChange={(v) => { const [f, d] = v.split("-"); setSortField(f as SortField); setSortDir(d as SortDir); }}>
            <SelectTrigger className="h-8 text-xs w-[120px] gap-1">
              <SortAsc className="w-3 h-3" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Data ↓</SelectItem>
              <SelectItem value="date-asc">Data ↑</SelectItem>
              <SelectItem value="name-asc">Nome A-Z</SelectItem>
              <SelectItem value="name-desc">Nome Z-A</SelectItem>
              <SelectItem value="size-desc">Tamanho ↓</SelectItem>
              <SelectItem value="size-asc">Tamanho ↑</SelectItem>
              <SelectItem value="type-asc">Tipo</SelectItem>
            </SelectContent>
          </Select>

          {/* Type filter */}
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
            <SelectTrigger className="h-8 text-xs w-[100px] gap-1">
              <Filter className="w-3 h-3" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="image">Imagens</SelectItem>
              <SelectItem value="document">Documentos</SelectItem>
              <SelectItem value="video">Vídeos</SelectItem>
              <SelectItem value="audio">Áudio</SelectItem>
              <SelectItem value="other">Outros</SelectItem>
            </SelectContent>
          </Select>

          {/* AI Category filter */}
          <Select value={aiCategoryFilter} onValueChange={(v) => setAiCategoryFilter(v as AICategoryFilter)}>
            <SelectTrigger className="h-8 text-xs w-[120px] gap-1">
              <Brain className="w-3 h-3" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Categoria IA</SelectItem>
              <SelectItem value="unanalyzed">🔍 Não analisados</SelectItem>
              <SelectItem value="nota_fiscal">🧾 Nota Fiscal</SelectItem>
              <SelectItem value="contrato">📝 Contrato</SelectItem>
              <SelectItem value="recibo">🧾 Recibo</SelectItem>
              <SelectItem value="comprovante">✅ Comprovante</SelectItem>
              <SelectItem value="foto_pessoal">📸 Foto</SelectItem>
              <SelectItem value="foto_documento">🪪 Documento</SelectItem>
              <SelectItem value="documento_texto">📄 Texto</SelectItem>
              <SelectItem value="planilha">📊 Planilha</SelectItem>
              <SelectItem value="codigo">💻 Código</SelectItem>
              <SelectItem value="outro">📁 Outro</SelectItem>
            </SelectContent>
          </Select>

          {section === "files" && (
            <button
              onClick={handleCreateFolder}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
            >
              <FolderPlus className="w-3.5 h-3.5" /> Nova pasta
            </button>
          )}
          <button onClick={refresh} className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
            className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground"
          >
            {viewMode === "grid" ? <List className="w-3.5 h-3.5" /> : <Grid className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Batch action bar */}
      {selectedIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20"
        >
          <span className="text-xs font-medium text-primary">{selectedIds.size} selecionado(s)</span>
          <div className="flex items-center gap-1 ml-auto">
            {section === "trash" ? (
              <button onClick={handleBatchRestore} className="px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20">
                Restaurar
              </button>
            ) : (
              <>
                <button onClick={handleBatchDownload} className="px-2.5 py-1 rounded-md text-xs font-medium bg-muted hover:bg-muted/70" title="Baixar selecionados">
                  <Download className="w-3 h-3" />
                </button>
                <button onClick={handleBatchMove} className="px-2.5 py-1 rounded-md text-xs font-medium bg-muted hover:bg-muted/70" title="Mover selecionados">
                  <FolderInput className="w-3 h-3" />
                </button>
                <button
                  onClick={handleBatchAnalyze}
                  disabled={batchAnalyzing}
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 flex items-center gap-1"
                  title="Analisar com IA"
                >
                  {batchAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                </button>
                <button onClick={handleBatchTrash} className="px-2.5 py-1 rounded-md text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20" title="Excluir selecionados">
                  <Trash2 className="w-3 h-3" />
                </button>
              </>
            )}
            <button onClick={clearSelection} className="p-1 rounded-md hover:bg-muted text-muted-foreground">
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Upload zone */}
      {section === "files" && (
        <FileUploadZone onFilesSelected={handleUpload} uploads={uploads} disabled={loading} />
      )}

      {/* Breadcrumb */}
      {folderPath.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <button
            onClick={() => { setFolderPath([]); clearSelection(); }}
            className="hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Home className="w-3 h-3" /> Meus Arquivos
          </button>
          {folderPath.map((p, i) => (
            <span key={p.id} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3" />
              <button
                onClick={() => { setFolderPath((prev) => prev.slice(0, i + 1)); clearSelection(); }}
                className="hover:text-foreground transition-colors"
              >
                {p.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Empty trash button */}
      {section === "trash" && files.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleEmptyTrash}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Esvaziar lixeira
          </button>
        </div>
      )}

      {/* Content */}
      {loading && files.length === 0 && folders.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : sortedFiles.length === 0 && folders.length === 0 ? (
        <GlassCard className="flex flex-col items-center justify-center py-14 text-center gap-3">
          {section === "trash" ? (
            <>
              <Trash2 className="w-12 h-12 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">Lixeira vazia</p>
            </>
          ) : section === "favorites" ? (
            <>
              <Star className="w-12 h-12 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">Nenhum favorito ainda</p>
              <p className="text-xs text-muted-foreground/60">Favorite arquivos para acessá-los rapidamente</p>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">Nenhum arquivo nesta pasta</p>
              <p className="text-xs text-muted-foreground/60">Arraste arquivos aqui ou use o botão acima</p>
              <button
                onClick={() => uploadRef.current?.click()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors mt-1"
              >
                <Upload className="w-3.5 h-3.5" /> Fazer upload
              </button>
              <input ref={uploadRef} type="file" multiple className="hidden" onChange={(e) => { const f = Array.from(e.target.files || []); if (f.length) handleUpload(f); e.target.value = ""; }} />
            </>
          )}
        </GlassCard>
      ) : (
        <>
          {/* Select all */}
          {sortedFiles.length > 0 && (
            <div className="flex items-center gap-2">
              <button onClick={selectAll} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                {selectedIds.size === files.length && files.length > 0 ? (
                  <CheckSquare className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <Square className="w-3.5 h-3.5" />
                )}
                {selectedIds.size === files.length && files.length > 0 ? "Desselecionar tudo" : "Selecionar tudo"}
              </button>
              <span className="text-[10px] text-muted-foreground/60">{sortedFiles.length} arquivo(s)</span>
            </div>
          )}

          <div className={viewMode === "grid"
            ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
            : "space-y-1"
          }>
            {/* Folders */}
            <AnimatePresence mode="popLayout">
              {folders.map((folder) => {
                const isRenamingFolder = renamingFolderId === folder.id;
                return (
                  <motion.div
                    key={folder.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("ring-2", "ring-primary"); }}
                    onDragLeave={(e) => { e.currentTarget.classList.remove("ring-2", "ring-primary"); }}
                    onDrop={(e) => { e.currentTarget.classList.remove("ring-2", "ring-primary"); handleDrop(folder.id, e); }}
                  >
                    {viewMode === "grid" ? (
                      <div
                        onClick={() => !isRenamingFolder && enterFolder(folder)}
                        className="group p-3 rounded-xl glass-card hover:brightness-105 cursor-pointer transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="text-2xl mb-2">{folder.icon}</div>
                          <div onClick={(e) => e.stopPropagation()}>{renderFolderMenu(folder)}</div>
                        </div>
                        {isRenamingFolder ? (
                          <Input
                            value={renameFolderValue}
                            onChange={(e) => setRenameFolderValue(e.target.value)}
                            onBlur={() => handleRenameFolder(folder.id)}
                            onKeyDown={(e) => e.key === "Enter" && handleRenameFolder(folder.id)}
                            autoFocus
                            className="h-6 text-xs"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <p className="text-xs font-medium text-foreground truncate">{folder.name}</p>
                        )}
                      </div>
                    ) : (
                      <div
                        onClick={() => !isRenamingFolder && enterFolder(folder)}
                        className="group flex items-center gap-3 p-2 rounded-lg hover:bg-foreground/10 cursor-pointer transition-all"
                      >
                        <span className="text-lg">{folder.icon}</span>
                        <span className="text-sm font-medium flex-1 truncate">
                          {isRenamingFolder ? (
                            <Input
                              value={renameFolderValue}
                              onChange={(e) => setRenameFolderValue(e.target.value)}
                              onBlur={() => handleRenameFolder(folder.id)}
                              onKeyDown={(e) => e.key === "Enter" && handleRenameFolder(folder.id)}
                              autoFocus
                              className="h-6 text-xs"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : folder.name}
                        </span>
                        <div onClick={(e) => e.stopPropagation()}>{renderFolderMenu(folder)}</div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Files */}
            <AnimatePresence mode="popLayout">
              {sortedFiles.map((file) => {
                const Icon = getFileIcon(file.mime_type);
                const isRenaming = renamingId === file.id;
                const isImage = file.mime_type.startsWith("image/");
                const isSelected = selectedIds.has(file.id);

                return (
                  <motion.div
                    key={file.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    draggable
                    onDragStart={(e: any) => { e.dataTransfer?.setData("text/plain", file.id); setDragFileId(file.id); }}
                    onDragEnd={() => setDragFileId(null)}
                  >
                    {viewMode === "grid" ? (
                      <div
                        onClick={() => !isRenaming && setPreviewFile(file)}
                        className={`group relative rounded-xl glass-card hover:brightness-105 transition-all cursor-pointer overflow-hidden ${
                          dragFileId === file.id ? "opacity-50" : ""
                        } ${isSelected ? "ring-2 ring-primary" : ""}`}
                      >
                        {/* Select checkbox */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSelect(file.id); }}
                          className={`absolute top-2 left-2 z-10 p-0.5 rounded transition-all ${
                            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          }`}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>

                        {/* Thumbnail / Icon area */}
                        <div className="w-full aspect-[4/3] flex items-center justify-center bg-foreground/5 overflow-hidden relative">
                          {isImage && file.thumbnail_url ? (
                            <img
                              src={file.thumbnail_url}
                              alt={file.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <Icon className="w-10 h-10 text-primary/40" />
                          )}
                          {file.ai_category && (
                            <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-sm">
                              <span className="text-[8px] text-white/90">{getCategoryBadge(file.ai_category)}</span>
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="p-2.5">
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex-1 min-w-0">
                              {isRenaming ? (
                                <Input
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onBlur={() => handleRename(file.id)}
                                  onKeyDown={(e) => e.key === "Enter" && handleRename(file.id)}
                                  autoFocus
                                  className="h-6 text-xs"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <p className="text-xs font-medium text-foreground truncate" title={file.ai_summary || file.name}>{file.name}</p>
                              )}
                              <p className="text-[10px] text-muted-foreground mt-0.5">{formatSize(file.size_bytes)}</p>
                            </div>
                            <div onClick={(e) => e.stopPropagation()}>
                              {renderFileMenu(file)}
                            </div>
                          </div>
                          {file.is_favorite && (
                            <Star className="absolute top-2 right-2 w-3.5 h-3.5 fill-yellow-500 text-yellow-500" />
                          )}
                        </div>
                      </div>
                    ) : (
                      /* List view */
                      <div
                        onClick={() => !isRenaming && setPreviewFile(file)}
                        className={`group flex items-center gap-3 p-2 rounded-lg hover:bg-foreground/10 transition-all cursor-pointer ${
                          dragFileId === file.id ? "opacity-50" : ""
                        } ${isSelected ? "bg-primary/5" : ""}`}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSelect(file.id); }}
                          className={`shrink-0 transition-all ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                        >
                          {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                        </button>
                        {/* Mini thumbnail */}
                        <div className="w-8 h-8 rounded-md bg-foreground/10 flex items-center justify-center overflow-hidden shrink-0">
                          {isImage && file.thumbnail_url ? (
                            <img src={file.thumbnail_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <Icon className="w-4 h-4 text-primary/60" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {isRenaming ? (
                            <Input
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onBlur={() => handleRename(file.id)}
                              onKeyDown={(e) => e.key === "Enter" && handleRename(file.id)}
                              autoFocus
                              className="h-6 text-xs"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <p className="text-sm truncate">{file.name}</p>
                          )}
                        </div>
                        {file.is_favorite && <Star className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500 shrink-0" />}
                        {file.ai_category && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary hidden lg:inline">{getCategoryBadge(file.ai_category)}</span>
                        )}
                        <span className="text-xs text-muted-foreground hidden sm:block w-16 text-right">{formatSize(file.size_bytes)}</span>
                        <span className="text-xs text-muted-foreground hidden md:block w-20 text-right">
                          {new Date(file.created_at).toLocaleDateString("pt-BR")}
                        </span>
                        <div onClick={(e) => e.stopPropagation()}>
                          {renderFileMenu(file)}
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Storage Meter */}
      <StorageMeter />

      {/* Preview Drawer */}
      <FilePreviewDrawer
        file={previewFile}
        open={!!previewFile}
        onClose={() => setPreviewFile(null)}
        onDownload={handleDownload}
        onShare={setSharingFile}
        onTrash={handleTrashAndRefresh}
        onToggleFavorite={handleFavAndRefresh}
      />

      {/* Move Dialog */}
      {movingFileIds && (
        <MoveToFolderDialog
          folders={allFolders}
          currentFolderId={currentFolderId}
          onMove={handleMoveFiles}
          onClose={() => setMovingFileIds(null)}
        />
      )}

      {/* Share Dialog */}
      {sharingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <ShareDialog
            fileId={sharingFile.id}
            fileName={sharingFile.name}
            onClose={() => setSharingFile(null)}
          />
        </div>
      )}

      {/* Version History */}
      {versionFileId && (
        <GlassCard className="mt-4">
          <VersionHistory
            fileId={versionFileId}
            onClose={() => setVersionFileId(null)}
          />
        </GlassCard>
      )}
    </div>
  );
};

export default NativeFileExplorer;
