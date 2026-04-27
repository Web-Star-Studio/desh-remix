import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDriveActions } from "@/hooks/integrations/useDriveActions";
import { useGoogleServiceData } from "@/hooks/integrations/useGoogleServiceData";
import { useGoogleData } from "@/hooks/files/useGoogleData";
import { useDriveUpload } from "@/hooks/files/useDriveUpload";
import { useConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { TransferWorkspaceDialog } from "@/components/files/TransferWorkspaceDialog";
import { MoveToDialog } from "@/components/files/MoveToDialog";
import GlassCard from "@/components/dashboard/GlassCard";
import GoogleSyncBadge from "@/components/dashboard/GoogleSyncBadge";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import WorkspaceBadge from "@/components/dashboard/WorkspaceBadge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { notifyAiShortcutPending } from "@/lib/aiShortcuts";
import {
  FolderOpen,
  FolderPlus,
  FileText,
  Image,
  File,
  Upload,
  Trash2,
  Loader2,
  Edit3,
  Save,
  Download,
  X,
  ChevronRight,
  ArrowLeft,
  Video,
  Music,
  Archive,
  FileSpreadsheet,
  Presentation,
  Grid,
  List,
  Search,
  FolderInput,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Star,
  CheckSquare,
  Square,
  Copy,
  Clock,
  BarChart2,
  AlertCircle,
  Lightbulb,
  Zap,
  Wand2,
  ClipboardPaste,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FolderSymlink,
  Link2,
  ChevronLeft,
  Scissors,
  History,
} from "lucide-react";
import { DeshContextMenu } from "@/components/ui/DeshContextMenu";

/* ── Helpers ── */
const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.startsWith("video/")) return Video;
  if (mimeType.startsWith("audio/")) return Music;
  if (mimeType.includes("pdf")) return FileText;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return FileSpreadsheet;
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return Presentation;
  if (mimeType.includes("zip") || mimeType.includes("archive") || mimeType.includes("rar"))
    return Archive;
  return File;
};

const formatSize = (bytes: number) => {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

type TypeFilter = "all" | "image" | "video" | "audio" | "pdf" | "doc" | "other";

const TYPE_FILTERS: { key: TypeFilter; label: string; icon: React.ElementType }[] = [
  { key: "all", label: "Todos", icon: File },
  { key: "image", label: "Imagens", icon: Image },
  { key: "video", label: "Vídeos", icon: Video },
  { key: "audio", label: "Áudios", icon: Music },
  { key: "pdf", label: "PDFs", icon: FileText },
  { key: "doc", label: "Docs", icon: FileText },
  { key: "other", label: "Outros", icon: Archive },
];

const matchesTypeFilter = (mimeType: string, filter: TypeFilter) => {
  if (filter === "all") return true;
  if (filter === "image") return mimeType.startsWith("image/");
  if (filter === "video") return mimeType.startsWith("video/");
  if (filter === "audio") return mimeType.startsWith("audio/");
  if (filter === "pdf") return mimeType.includes("pdf");
  if (filter === "doc")
    return (
      mimeType.includes("word") ||
      mimeType.includes("document") ||
      mimeType.includes("text/plain") ||
      mimeType.includes("spreadsheet") ||
      mimeType.includes("presentation")
    );
  return (
    !mimeType.startsWith("image/") &&
    !mimeType.startsWith("video/") &&
    !mimeType.startsWith("audio/") &&
    !mimeType.includes("pdf") &&
    !mimeType.includes("word") &&
    !mimeType.includes("document")
  );
};

const canPreview = (mime: string) =>
  mime.startsWith("image/") ||
  mime === "application/pdf" ||
  mime.startsWith("video/") ||
  mime.startsWith("audio/");

const highlightMatch = (text: string, query: string) => {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-foreground rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
};

/* ── Types ── */
interface DriveRawFile {
  id: string;
  name?: string;
  mimeType?: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  parents?: string[];
}

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  modifiedTime: string;
  webViewLink: string;
  iconLink: string;
  thumbnailLink: string;
  isFolder: boolean;
  parents?: string[];
}

interface DriveFileVersion {
  id: string;
  modifiedTime: string;
  originalFilename?: string;
  size?: string;
}

interface DriveAIResult {
  type?: string;
  folders?: { name: string; files: string[] }[];
  tips?: string[];
  groups?: { reason: string; confidence: string; files: string[] }[];
  total_duplicates?: number;
  [key: string]: unknown;
}

interface DriveAISummary {
  fileName?: string;
  summary?: string;
  priority?: string;
  insights?: string[];
  suggested_actions?: string[];
}

interface BreadcrumbItem {
  id: string | null;
  name: string;
}

interface GoogleDriveExplorerProps {
  view?: "list" | "grid";
  fullPage?: boolean;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

const GoogleDriveExplorer = ({ view: initialView, fullPage = false }: GoogleDriveExplorerProps) => {
  const drive = useDriveActions();
  const { fetchGoogleData } = useGoogleData();
  const { workspaces: allWorkspaces } = useWorkspace();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  // Navigation
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([{ id: null, name: "Meu Drive" }]);

  // View & filters
  const [view, setView] = useState<"list" | "grid">(initialView || "grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortBy, setSortBy] = useState<"name" | "date" | "size">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");

  // UI state
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleBulkDeleteRef = useRef<() => void>(() => {});

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  // Preview
  const [previewFile, setPreviewFile] = useState<DriveItem | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const previewIndexRef = useRef(-1);

  // AI state
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<DriveAIResult | null>(null);
  const [aiSummary, setAiSummary] = useState<DriveAISummary | null>(null);

  // Clipboard
  const [clipboardItem, setClipboardItem] = useState<{
    id: string;
    name: string;
    mimeType: string;
    action: "copy" | "cut";
    parents?: string[];
  } | null>(null);
  // Transfer dialog
  const [transferItem, setTransferItem] = useState<DriveItem | null>(null);
  // Move-to dialog
  const [moveToItem, setMoveToItem] = useState<DriveItem | null>(null);
  // Version history
  const [versionsFile, setVersionsFile] = useState<DriveItem | null>(null);
  const [versions, setVersions] = useState<DriveFileVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  // Favorites (localStorage)
  const [starredIds, setStarredIds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("drive_starred") || "[]"));
    } catch {
      return new Set();
    }
  });
  const [showStarredOnly, setShowStarredOnly] = useState(false);

  // AI tag cache (localStorage)
  const [fileTagCache, setFileTagCache] = useState<
    Record<string, { category: string; tags: string[] }>
  >(() => {
    try {
      return JSON.parse(localStorage.getItem("drive_tag_cache") || "{}");
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem("drive_starred", JSON.stringify(Array.from(starredIds)));
  }, [starredIds]);
  useEffect(() => {
    localStorage.setItem("drive_tag_cache", JSON.stringify(fileTagCache));
  }, [fileTagCache]);

  const toggleStar = useCallback((id: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Build Drive API query
  const query = currentFolderId
    ? `'${currentFolderId}' in parents and trashed=false`
    : `'root' in parents and trashed=false`;

  const {
    data: driveItems,
    isLoading,
    isConnected,
    error: driveError,
    refetch,
    connectionWorkspaceId: driveWorkspaceId,
  } = useGoogleServiceData<DriveRawFile[]>({
    service: "drive",
    path: "/files",
    params: {
      pageSize: "200",
      q: query,
      fields:
        "files(id,name,mimeType,size,modifiedTime,webViewLink,iconLink,thumbnailLink,parents)",
      orderBy: "folder,modifiedTime desc",
    },
  });

  // Drive upload hook (resumable, direct-to-Google, with progress)
  const { uploads, isUploading, startUpload, cancelUpload, clearCompleted, totalProgress } =
    useDriveUpload({
      currentFolderId,
      onComplete: () => refetch(),
    });

  const items: DriveItem[] = useMemo(() => {
    if (!driveItems || driveItems.length === 0) return [];
    return driveItems.map((f: DriveRawFile) => ({
      id: f.id,
      name: f.name || "Sem nome",
      mimeType: f.mimeType || "application/octet-stream",
      size: f.size ? parseInt(f.size, 10) : 0,
      modifiedTime: f.modifiedTime || "",
      webViewLink: f.webViewLink || "",
      iconLink: f.iconLink || "",
      thumbnailLink: f.thumbnailLink || "",
      isFolder: f.mimeType === FOLDER_MIME,
      parents: f.parents || [],
    }));
  }, [driveItems]);

  const allFolders = useMemo(() => items.filter((i) => i.isFolder), [items]);
  const allFiles = useMemo(() => items.filter((i) => !i.isFolder), [items]);

  // Apply filters
  const filteredFiles = useMemo(() => {
    let f = allFiles;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      f = f.filter((i) => i.name.toLowerCase().includes(q));
    }
    if (typeFilter !== "all") f = f.filter((i) => matchesTypeFilter(i.mimeType, typeFilter));
    if (dateFilter !== "all") {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(startOfDay);
      startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      f = f.filter((i) => {
        const d = new Date(i.modifiedTime);
        if (dateFilter === "today") return d >= startOfDay;
        if (dateFilter === "week") return d >= startOfWeek;
        if (dateFilter === "month") return d >= startOfMonth;
        return true;
      });
    }
    if (showStarredOnly) f = f.filter((i) => starredIds.has(i.id));
    // Sort
    return [...f].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = a.name.localeCompare(b.name);
      else if (sortBy === "size") cmp = (a.size || 0) - (b.size || 0);
      else cmp = new Date(a.modifiedTime).getTime() - new Date(b.modifiedTime).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [allFiles, searchQuery, typeFilter, dateFilter, showStarredOnly, starredIds, sortBy, sortDir]);

  const filteredFolders = useMemo(() => {
    if (!searchQuery) return allFolders;
    const q = searchQuery.toLowerCase();
    return allFolders.filter((f) => f.name.toLowerCase().includes(q));
  }, [allFolders, searchQuery]);

  const displayFolders = useMemo(
    () => (searchQuery || typeFilter !== "all" || dateFilter !== "all" ? [] : filteredFolders),
    [searchQuery, typeFilter, dateFilter, filteredFolders],
  );
  const displayFiles = useMemo(() => filteredFiles, [filteredFiles]);

  // Previewable files for navigation
  const previewableFiles = useMemo(
    () => displayFiles.filter((f) => canPreview(f.mimeType)),
    [displayFiles],
  );

  /* ── Navigation ── */
  const navigateToFolder = (folderId: string | null, folderName: string) => {
    if (folderId === null) {
      setBreadcrumb([{ id: null, name: "Meu Drive" }]);
    } else {
      const existing = breadcrumb.findIndex((b) => b.id === folderId);
      if (existing >= 0) setBreadcrumb(breadcrumb.slice(0, existing + 1));
      else setBreadcrumb([...breadcrumb, { id: folderId, name: folderName }]);
    }
    setCurrentFolderId(folderId);
    setSelectedIds(new Set());
  };

  const goBack = () => {
    if (breadcrumb.length > 1) {
      const parent = breadcrumb[breadcrumb.length - 2];
      setBreadcrumb(breadcrumb.slice(0, -1));
      setCurrentFolderId(parent.id);
    }
  };

  /* ── Drive CRUD ── */
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setActionLoading("create-folder");
    try {
      const parents = currentFolderId ? [currentFolderId] : ["root"];
      await fetchGoogleData({
        service: "drive",
        path: "/files",
        method: "POST",
        body: { name: newFolderName.trim(), mimeType: FOLDER_MIME, parents },
      });
      toast({ title: `Pasta "${newFolderName.trim()}" criada no Drive` });
      setNewFolderName("");
      setCreatingFolder(false);
      refetch();
    } catch (err: any) {
      toast({ title: "Erro ao criar pasta", description: err?.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRename = async (fileId: string) => {
    if (!renameValue.trim()) return;
    setActionLoading(fileId);
    try {
      await fetchGoogleData({
        service: "drive",
        path: `/files/${fileId}`,
        method: "PATCH",
        body: { name: renameValue.trim() },
      });
      toast({ title: "Renomeado no Drive" });
      setRenamingId(null);
      setRenameValue("");
      refetch();
    } catch (err: any) {
      toast({ title: "Erro ao renomear", description: err?.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (fileId: string, fileName: string) => {
    const ok = await confirm({
      title: "Excluir do Google Drive?",
      description: `"${fileName}" será removido permanentemente.`,
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    setActionLoading(fileId);
    try {
      await fetchGoogleData({ service: "drive", path: `/files/${fileId}`, method: "DELETE" });
      toast({ title: "Excluído do Drive" });
      refetch();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err?.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDriveMove = async (itemId: string, targetFolderId: string) => {
    if (itemId === targetFolderId) return;
    setActionLoading(itemId);
    try {
      const item = items.find((i) => i.id === itemId);
      const currentParent = item?.parents?.[0] || "root";
      await fetchGoogleData({
        service: "drive",
        path: `/files/${itemId}`,
        method: "PATCH",
        params: { addParents: targetFolderId, removeParents: currentParent },
      });
      toast({ title: "Movido no Drive" });
      refetch();
    } catch (err: any) {
      toast({ title: "Erro ao mover", description: err?.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
      setDragOverId(null);
      setDraggingId(null);
    }
  };

  const handleDuplicate = async (file: DriveItem) => {
    setActionLoading(file.id);
    try {
      await fetchGoogleData({
        service: "drive",
        path: `/files/${file.id}/copy`,
        method: "POST",
        body: { name: `Cópia de ${file.name}` },
      });
      toast({ title: "Duplicado!", description: `"Cópia de ${file.name}" criado.` });
      refetch();
    } catch (err: any) {
      toast({ title: "Erro ao duplicar", description: err?.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleClipboardCopy = (item: DriveItem) => {
    setClipboardItem({
      id: item.id,
      name: item.name,
      mimeType: item.mimeType,
      action: "copy",
      parents: item.parents,
    });
    toast({ title: "Copiado!", description: `"${item.name}" — cole em outra pasta com Ctrl+V` });
  };

  const handleClipboardCut = (item: DriveItem) => {
    setClipboardItem({
      id: item.id,
      name: item.name,
      mimeType: item.mimeType,
      action: "cut",
      parents: item.parents,
    });
    toast({ title: "Recortado!", description: `"${item.name}" — cole em outra pasta com Ctrl+V` });
  };

  const handleClipboardPaste = useCallback(async () => {
    if (!clipboardItem) return;
    setActionLoading(clipboardItem.id);
    const targetFolder = currentFolderId || "root";
    try {
      if (clipboardItem.action === "copy") {
        await fetchGoogleData({
          service: "drive",
          path: `/files/${clipboardItem.id}/copy`,
          method: "POST",
          body: { name: clipboardItem.name, parents: [targetFolder] },
        });
      } else {
        const currentParent = clipboardItem.parents?.[0] || "root";
        await fetchGoogleData({
          service: "drive",
          path: `/files/${clipboardItem.id}`,
          method: "PATCH",
          params: { addParents: targetFolder, removeParents: currentParent },
        });
      }
      toast({
        title: clipboardItem.action === "copy" ? "Colado!" : "Movido!",
        description: `"${clipboardItem.name}" adicionado à pasta atual.`,
      });
      if (clipboardItem.action === "cut") setClipboardItem(null);
      refetch();
    } catch (err: any) {
      toast({ title: "Erro ao colar", description: err?.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }, [clipboardItem, currentFolderId, fetchGoogleData, refetch]);

  const handleUploadToDrive = useCallback(
    async (fileList: FileList | File[] | null) => {
      if (
        !fileList ||
        (fileList instanceof FileList && fileList.length === 0) ||
        (Array.isArray(fileList) && fileList.length === 0)
      )
        return;
      await startUpload(fileList);
    },
    [startUpload],
  );

  /* ── AI Actions ── */
  const showAiPending = (title: string) => {
    setAiLoading(null);
    notifyAiShortcutPending(title);
  };

  const handleAiAnalyze = async (file: DriveItem) => {
    void file;
    showAiPending("Análise de arquivo indisponível");
  };

  const handleAiSmartRename = async (file: DriveItem) => {
    void file;
    showAiPending("Renomeação inteligente indisponível");
  };

  const handleAiSummarize = async (file: DriveItem) => {
    void file;
    setAiSummary(null);
    showAiPending("Resumo de arquivo indisponível");
  };

  const handleAiOrganize = async () => {
    if (allFiles.length === 0) return;
    setAiResult(null);
    showAiPending("Organização de arquivos indisponível");
  };

  const handleAiFindDuplicates = async () => {
    if (allFiles.length < 2) {
      toast({
        title: "Poucos arquivos",
        description: "É necessário pelo menos 2 arquivos para buscar duplicatas.",
      });
      return;
    }
    setAiResult(null);
    showAiPending("Busca de duplicatas indisponível");
  };

  const handleTrashDuplicate = async (fileName: string) => {
    const file = allFiles.find((f) => f.name === fileName);
    if (!file) {
      toast({ title: "Arquivo não encontrado", variant: "destructive" });
      return;
    }
    const confirmed = await confirm({
      title: `Mover "${fileName}" para a lixeira?`,
      description: "Esta ação pode ser desfeita no Google Drive.",
      confirmLabel: "Mover para lixeira",
    });
    if (!confirmed) return;
    setAiLoading("duplicates");
    try {
      await fetchGoogleData({
        service: "drive",
        path: `/files/${file.id}`,
        method: "PATCH",
        body: { trashed: true },
      });
      toast({ title: "Movido para lixeira", description: fileName });
      // Remove from current AI result
      if (aiResult?.type === "duplicates" && aiResult.groups) {
        const updatedGroups = aiResult.groups
          .map((g: any) => ({ ...g, files: g.files.filter((f: string) => f !== fileName) }))
          .filter((g: any) => g.files.length >= 2);
        setAiResult({ ...aiResult, groups: updatedGroups });
      }
      refetch();
    } catch (err: any) {
      toast({ title: "Erro ao mover", description: err?.message, variant: "destructive" });
    } finally {
      setAiLoading(null);
    }
  };

  const handleAiAutoOrganize = async () => {
    if (!aiResult?.folders?.length) return;

    // Confirm before applying
    const totalFiles = aiResult.folders.reduce(
      (s: number, f: any) => s + (f.files?.length || 0),
      0,
    );
    const confirmed = await confirm({
      title: `Organizar ${totalFiles} arquivo(s) em ${aiResult.folders.length} pasta(s)?`,
      description: `Pastas: ${aiResult.folders.map((f: any) => f.name).join(", ")}\n\nEsta ação criará pastas e moverá arquivos no Google Drive.`,
      confirmLabel: "Organizar",
    });
    if (!confirmed) return;

    setAiLoading("auto-organize");
    let foldersCreated = 0;
    let filesMoved = 0;
    let filesSkipped = 0;
    let folderErrors = 0;

    try {
      for (const suggestion of aiResult.folders) {
        const parents = currentFolderId ? [currentFolderId] : ["root"];
        try {
          const folderRes = await fetchGoogleData<{ id: string }>({
            service: "drive",
            path: "/files",
            method: "POST",
            body: { name: String(suggestion.name).slice(0, 100), mimeType: FOLDER_MIME, parents },
          });

          if (!folderRes?.id) {
            folderErrors++;
            continue;
          }
          foldersCreated++;

          const newFolderId = folderRes.id;
          if (!suggestion.files?.length) continue;

          for (const fileName of suggestion.files) {
            const matchedFile = allFiles.find(
              (f) => f.name.toLowerCase() === String(fileName).toLowerCase(),
            );
            if (!matchedFile) continue;

            const currentParent = matchedFile.parents?.[0] || "root";
            try {
              const moveRes = await fetchGoogleData<{ id: string }>({
                service: "drive",
                path: `/files/${matchedFile.id}`,
                method: "PATCH",
                params: { addParents: newFolderId, removeParents: currentParent },
              });
              if (moveRes?.id) {
                filesMoved++;
              } else {
                filesSkipped++;
              }
            } catch {
              filesSkipped++;
            }
          }
        } catch {
          folderErrors++;
        }
      }

      const parts: string[] = [];
      if (foldersCreated > 0) parts.push(`${foldersCreated} pasta(s) criada(s)`);
      if (filesMoved > 0) parts.push(`${filesMoved} arquivo(s) movido(s)`);
      if (filesSkipped > 0) parts.push(`${filesSkipped} arquivo(s) sem permissão`);
      if (folderErrors > 0) parts.push(`${folderErrors} pasta(s) falharam`);

      toast({
        title: filesMoved > 0 ? "Organização aplicada!" : "Organização parcial",
        description:
          parts.join(" · ") +
          "." +
          (filesSkipped > 0
            ? " Reconecte o Google Drive com permissões completas para mover todos os arquivos."
            : ""),
        variant:
          (filesSkipped > 0 || folderErrors > 0) && filesMoved === 0 ? "destructive" : "default",
      });
      setAiResult(null);
      refetch();
    } catch (err: any) {
      toast({ title: "Erro ao organizar", description: err?.message, variant: "destructive" });
    } finally {
      setAiLoading(null);
    }
  };

  const handleAiBatchAnalyze = async () => {
    if (selectedIds.size === 0) return;
    showAiPending("Análise em lote indisponível");
  };

  /* ── Preview navigation ── */
  const openPreview = useCallback(
    (file: DriveItem) => {
      const idx = previewableFiles.findIndex((f) => f.id === file.id);
      previewIndexRef.current = idx;
      setPreviewFile(file);
      setPreviewZoom(1);
    },
    [previewableFiles],
  );

  const navigatePreview = useCallback(
    (dir: 1 | -1) => {
      const next = previewIndexRef.current + dir;
      if (next < 0 || next >= previewableFiles.length) return;
      previewIndexRef.current = next;
      setPreviewFile(previewableFiles[next]);
      setPreviewZoom(1);
    },
    [previewableFiles],
  );

  /* ── Bulk operations ── */
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (count === 0) return;
    const ok = await confirm({
      title: `Excluir ${count} arquivo(s)?`,
      description: "Estes arquivos serão removidos permanentemente do Drive.",
      confirmLabel: "Excluir tudo",
    });
    if (!ok) return;
    const idsToDelete = Array.from(selectedIds);
    setSelectedIds(new Set());
    setBulkMode(false);
    for (const id of idsToDelete) {
      await fetchGoogleData({ service: "drive", path: `/files/${id}`, method: "DELETE" }).catch(
        () => {},
      );
    }
    refetch();
    toast({ title: `${count} arquivo(s) excluídos do Drive` });
  };

  /* ── Keyboard shortcuts (combined into single effect) ── */
  handleBulkDeleteRef.current = handleBulkDelete;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA";

      // Preview navigation
      if (previewFile) {
        if (e.key === "ArrowLeft") navigatePreview(-1);
        if (e.key === "ArrowRight") navigatePreview(1);
        if (e.key === "Escape") setPreviewFile(null);
        if (e.key === "+" || e.key === "=") setPreviewZoom((z) => Math.min(z + 0.25, 3));
        if (e.key === "-") setPreviewZoom((z) => Math.max(z - 0.25, 0.5));
        if (e.key === "0") setPreviewZoom(1);
        return;
      }

      if (isInput) return;

      // Ctrl+A select all
      if ((e.ctrlKey || e.metaKey) && e.key === "a" && displayFiles.length > 0) {
        e.preventDefault();
        if (!bulkMode) setBulkMode(true);
        setSelectedIds(new Set(displayFiles.map((f) => f.id)));
      }
      // Delete/Backspace bulk delete
      if ((e.key === "Delete" || e.key === "Backspace") && bulkMode && selectedIds.size > 0) {
        e.preventDefault();
        handleBulkDeleteRef.current();
      }
      // Ctrl+V paste
      if ((e.ctrlKey || e.metaKey) && e.key === "v" && clipboardItem) {
        e.preventDefault();
        handleClipboardPaste();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    previewFile,
    navigatePreview,
    bulkMode,
    selectedIds,
    displayFiles,
    clipboardItem,
    handleClipboardPaste,
  ]);

  // Clipboard file paste (from OS)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const fileList: File[] = [];
      for (const item of items) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) fileList.push(f);
        }
      }
      if (fileList.length > 0) {
        e.preventDefault();
        const dt = new DataTransfer();
        fileList.forEach((f) => dt.items.add(f));
        await handleUploadToDrive(dt.files);
        toast({ title: `${fileList.length} arquivo(s) colado(s) da área de transferência` });
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handleUploadToDrive]);

  /* ── Drag handlers ── */
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("driveItemId", id);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(id);
  };
  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };
  const handleFolderDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const itemId = e.dataTransfer.getData("driveItemId");
    if (itemId && itemId !== targetId) handleDriveMove(itemId, targetId);
    if (e.dataTransfer.files.length > 0) handleUploadToDrive(e.dataTransfer.files);
    setDragOverId(null);
  };

  const handlePageDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDragOver(true);
  };
  const handlePageDragLeave = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragOver(false);
    }
  };
  const handlePageDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) e.preventDefault();
  };
  const handlePageDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) await handleUploadToDrive(e.dataTransfer.files);
  };

  const handleOpen = (file: DriveItem) => {
    if (file.webViewLink) window.open(file.webViewLink, "_blank", "noopener,noreferrer");
  };

  const handleCopyLink = (file: DriveItem) => {
    if (!file.webViewLink) return;
    navigator.clipboard.writeText(file.webViewLink);
    toast({ title: "Link copiado!", description: file.name });
  };

  const handleDownload = async (file: DriveItem) => {
    try {
      const data = await drive.downloadFile<any>({ file_id: file.id });
      const url =
        data?.download_url || data?.url || data?.webContentLink || data?.file?.webContentLink;
      if (url) {
        window.open(url, "_blank");
      } else {
        handleOpen(file);
      }
    } catch {
      handleOpen(file);
    }
  };

  const handleViewVersions = async (file: DriveItem) => {
    if (file.isFolder) {
      toast({ title: "Pastas não possuem histórico de versões" });
      return;
    }
    setVersionsFile(file);
    setVersions([]);
    setVersionsLoading(true);
    try {
      const res = await fetchGoogleData<any>({
        service: "drive",
        path: `/files/${file.id}/revisions`,
        method: "GET",
        params: {
          fields: "revisions(id,modifiedTime,size,lastModifyingUser,mimeType,keepForever)",
        },
      });
      const revs = Array.isArray(res?.data?.revisions)
        ? res.data.revisions
        : Array.isArray(res?.data)
          ? res.data
          : [];
      setVersions(revs);
      if (revs.length === 0) {
        toast({
          title: "Sem versões",
          description: "Este arquivo não possui histórico de versões disponível.",
        });
      }
    } catch (err: any) {
      console.error("Versions error:", err);
      toast({
        title: "Erro ao carregar versões",
        description: err?.message || "Não foi possível acessar o histórico",
        variant: "destructive",
      });
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleDownloadVersion = async (fileId: string, _revisionId: string, _fileName: string) => {
    // Composio's googledrive toolkit has no per-revision download action.
    // Open the file in Drive so the user can use Drive's native version history UI.
    const driveUrl = `https://drive.google.com/file/d/${fileId}/view`;
    window.open(driveUrl, "_blank");
    toast({
      title: "Abrindo no Google Drive",
      description: "Use o histórico de versões do Drive para baixar versões anteriores.",
    });
  };

  const handleKeepVersion = async (fileId: string, revisionId: string, keep: boolean) => {
    try {
      await fetchGoogleData({
        service: "drive",
        path: `/files/${fileId}/revisions/${revisionId}`,
        method: "PATCH",
        body: { keepForever: keep },
      });
      setVersions((prev) =>
        prev.map((v) => (v.id === revisionId ? { ...v, keepForever: keep } : v)),
      );
      toast({ title: keep ? "Versão protegida" : "Proteção removida" });
    } catch (err: any) {
      toast({
        title: "Erro ao atualizar versão",
        description: err?.message,
        variant: "destructive",
      });
    }
  };

  const hasActiveFilter =
    searchQuery || typeFilter !== "all" || dateFilter !== "all" || showStarredOnly;

  const PRIORITY_COLOR: Record<string, string> = {
    alta: "text-destructive bg-destructive/10",
    média: "text-amber-500 bg-amber-500/10",
    baixa: "text-emerald-500 bg-emerald-500/10",
  };

  /* ── Render file actions ── */
  const renderFileActions = (file: DriveItem, compact = false) => {
    const isStarred = starredIds.has(file.id);
    const tagInfo = fileTagCache[file.id];
    const iconSize = compact ? "w-3 h-3" : "w-3.5 h-3.5";

    return (
      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => toggleStar(file.id)}
          className={`p-1 transition-colors ${isStarred ? "text-amber-400" : "text-muted-foreground hover:text-amber-400"}`}
          title={isStarred ? "Remover favorito" : "Favoritar"}
        >
          <Star className={`${iconSize} ${isStarred ? "fill-current" : ""}`} />
        </button>
        {canPreview(file.mimeType) && (
          <button
            onClick={() => openPreview(file)}
            className="p-1 text-muted-foreground hover:text-foreground"
            title="Visualizar"
          >
            <Eye className={iconSize} />
          </button>
        )}
        <button
          onClick={() => {
            setRenamingId(file.id);
            setRenameValue(file.name);
          }}
          className="p-1 text-muted-foreground hover:text-foreground"
          title="Renomear"
        >
          <Edit3 className={iconSize} />
        </button>
        <button
          onClick={() => handleAiSummarize(file)}
          disabled={aiLoading === `sum_${file.id}`}
          className="p-1 text-muted-foreground hover:text-primary disabled:opacity-50"
          title="Resumo IA"
        >
          {aiLoading === `sum_${file.id}` ? (
            <Loader2 className={`${iconSize} animate-spin`} />
          ) : (
            <Lightbulb className={iconSize} />
          )}
        </button>
        <button
          onClick={() => handleAiAnalyze(file)}
          disabled={aiLoading === file.id}
          className="p-1 text-muted-foreground hover:text-primary disabled:opacity-50"
          title="Analisar com IA"
        >
          {aiLoading === file.id ? (
            <Loader2 className={`${iconSize} animate-spin`} />
          ) : (
            <Sparkles className={iconSize} />
          )}
        </button>
        <button
          onClick={() => handleOpen(file)}
          className="p-1 text-muted-foreground hover:text-foreground"
          title="Abrir no Drive"
        >
          <Download className={iconSize} />
        </button>
        <button
          onClick={() => handleCopyLink(file)}
          className="p-1 text-muted-foreground hover:text-foreground"
          title="Copiar link"
        >
          <Link2 className={iconSize} />
        </button>
        <button
          onClick={() => handleDelete(file.id, file.name)}
          disabled={actionLoading === file.id}
          className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-50"
          title="Excluir"
        >
          {actionLoading === file.id ? (
            <Loader2 className={`${iconSize} animate-spin`} />
          ) : (
            <Trash2 className={iconSize} />
          )}
        </button>
      </div>
    );
  };

  if (!isConnected) return null;

  return (
    <div
      className="relative"
      onDragEnter={handlePageDragEnter}
      onDragLeave={handlePageDragLeave}
      onDragOver={handlePageDragOver}
      onDrop={handlePageDrop}
    >
      {confirmDialog}

      {/* Upload drop overlay */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary rounded-xl pointer-events-none"
          >
            <div className="text-center">
              <Upload className="w-10 h-10 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium text-primary">Solte para enviar ao Drive</p>
              {currentFolderId && <p className="text-xs text-primary/70 mt-1">na pasta atual</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Summary Result */}
      <AnimatePresence>
        {aiSummary && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <GlassCard>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary" /> Resumo Inteligente
                  <span className="text-xs font-normal text-muted-foreground">
                    — {aiSummary.fileName}
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  {aiSummary.priority && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOR[aiSummary.priority] || "text-muted-foreground bg-foreground/5"}`}
                    >
                      Prioridade {aiSummary.priority}
                    </span>
                  )}
                  <button
                    onClick={() => setAiSummary(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {aiSummary.summary && (
                <p className="text-sm text-foreground/80 mb-3 leading-relaxed">
                  {aiSummary.summary}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {aiSummary.insights?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-1.5">
                      <Lightbulb className="w-3 h-3" /> Insights
                    </p>
                    <ul className="space-y-1">
                      {aiSummary.insights.map((ins: string, i: number) => (
                        <li key={i} className="text-xs text-foreground/70 flex items-start gap-1.5">
                          <span className="text-primary mt-0.5">•</span> {ins}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiSummary.suggested_actions?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-1.5">
                      <Zap className="w-3 h-3" /> Ações sugeridas
                    </p>
                    <ul className="space-y-1">
                      {aiSummary.suggested_actions.map((act: string, i: number) => (
                        <li key={i} className="text-xs text-foreground/70 flex items-start gap-1.5">
                          <span className="text-primary mt-0.5">→</span> {act}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Organization suggestion */}
      <AnimatePresence>
        {aiResult?.type === "organization" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <GlassCard size="auto" className="max-h-[300px] flex flex-col">
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <p className="widget-title flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary" /> Sugestão de Organização
                </p>
                <div className="flex items-center gap-2">
                  {aiResult.folders?.length > 0 && (
                    <button
                      onClick={handleAiAutoOrganize}
                      disabled={aiLoading === "auto-organize"}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {aiLoading === "auto-organize" ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5" />
                      )}{" "}
                      Aplicar tudo
                    </button>
                  )}
                  <button
                    onClick={() => setAiResult(null)}
                    className="text-muted-foreground hover:text-foreground text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto flex-1 min-h-0 pr-1">
                {aiResult.folders?.map((folder: any, i: number) => (
                  <div key={i} className="mb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <FolderOpen className="w-3.5 h-3.5 text-primary" />
                      <span className="text-sm font-medium text-foreground">{folder.name}</span>
                    </div>
                    <div className="ml-6 space-y-0.5">
                      {folder.files?.map((f: string, j: number) => (
                        <p key={j} className="text-xs text-muted-foreground">
                          • {f}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
                {aiResult.tips?.map((tip: string, i: number) => (
                  <p key={i} className="text-xs text-muted-foreground mt-1">
                    <span className="text-primary">💡</span> {tip}
                  </p>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Duplicates */}
      <AnimatePresence>
        {aiResult?.type === "duplicates" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <GlassCard>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <p className="widget-title flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-primary" /> Possíveis Duplicatas
                  </p>
                  {aiResult.total_duplicates > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
                      {aiResult.total_duplicates} arquivo(s)
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setAiResult(null)}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              </div>
              {aiResult.groups?.length > 0 ? (
                <div className="max-h-[350px] overflow-y-auto space-y-2.5 pr-1">
                  {aiResult.groups.map((group: any, i: number) => {
                    const confidenceColor =
                      group.confidence === "alta"
                        ? "text-destructive"
                        : group.confidence === "média"
                          ? "text-yellow-500"
                          : "text-muted-foreground";
                    const confidenceLabel =
                      group.confidence === "alta"
                        ? "Alta"
                        : group.confidence === "média"
                          ? "Média"
                          : "Baixa";
                    return (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-primary/5 border border-primary/20"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs text-primary font-medium flex-1">{group.reason}</p>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full bg-foreground/5 font-medium ${confidenceColor}`}
                          >
                            {confidenceLabel}
                          </span>
                        </div>
                        {group.files?.map((f: string, j: number) => {
                          const isKeep = group.keep === f;
                          return (
                            <div
                              key={j}
                              className="flex items-center justify-between gap-1.5 py-0.5 group/dup"
                            >
                              <p
                                className={`text-xs flex items-center gap-1.5 flex-1 min-w-0 truncate ${isKeep ? "text-foreground font-medium" : "text-foreground/70"}`}
                              >
                                {isKeep ? (
                                  <Star className="w-3 h-3 text-yellow-500 shrink-0" />
                                ) : (
                                  <Copy className="w-3 h-3 text-primary/60 shrink-0" />
                                )}
                                <span className="truncate">{f}</span>
                                {isKeep && (
                                  <span className="text-[10px] text-muted-foreground ml-1 shrink-0">
                                    (manter)
                                  </span>
                                )}
                              </p>
                              {!isKeep && (
                                <button
                                  onClick={() => handleTrashDuplicate(f)}
                                  disabled={!!aiLoading}
                                  className="opacity-0 group-hover/dup:opacity-100 p-0.5 rounded text-muted-foreground hover:text-destructive transition-all shrink-0"
                                  title="Mover para lixeira"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma duplicata encontrada! 🎉</p>
              )}
              {aiResult.tips?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  {aiResult.tips.map((tip: string, i: number) => (
                    <p key={i} className="text-xs text-muted-foreground mt-0.5">
                      <span className="text-primary">💡</span> {tip}
                    </p>
                  ))}
                </div>
              )}
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toolbar */}
      <GlassCard size="auto" className="mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar no Drive..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-foreground/5 rounded-lg pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
          {/* View toggle */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setView("list")}
              className={`p-2 rounded-lg transition-colors ${view === "list" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView("grid")}
              className={`p-2 rounded-lg transition-colors ${view === "grid" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>
          {/* AI menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
                <Sparkles className="w-3.5 h-3.5" /> IA
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={handleAiOrganize}
                disabled={!!aiLoading || allFiles.length === 0}
              >
                <Sparkles className="w-4 h-4 mr-2" /> Organizar arquivos
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleAiFindDuplicates}
                disabled={!!aiLoading || allFiles.length < 2}
              >
                <Copy className="w-4 h-4 mr-2" /> Encontrar duplicatas
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setBulkMode(!bulkMode);
                  setSelectedIds(new Set());
                }}
              >
                <CheckSquare className="w-4 h-4 mr-2" />{" "}
                {bulkMode ? "Cancelar seleção" : "Selecionar"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Create folder */}
          <button
            onClick={() => setCreatingFolder(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-foreground/5 text-muted-foreground hover:text-foreground hover:bg-foreground/10 text-xs transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Pasta</span>
          </button>
          {/* Upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 relative overflow-hidden"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Enviando {totalProgress}%</span>
                <div
                  className="absolute bottom-0 left-0 h-0.5 bg-primary-foreground/30 transition-all"
                  style={{ width: `${totalProgress}%` }}
                />
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" /> Upload
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              handleUploadToDrive(e.target.files);
              e.target.value = "";
            }}
          />
          {/* Refresh */}
          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
            title="Atualizar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {/* Type chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {TYPE_FILTERS.map((tf) => {
              const count =
                tf.key === "all"
                  ? allFiles.length
                  : allFiles.filter((f) => matchesTypeFilter(f.mimeType, tf.key)).length;
              if (tf.key !== "all" && count === 0) return null;
              return (
                <button
                  key={tf.key}
                  onClick={() => setTypeFilter(tf.key)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${typeFilter === tf.key ? "bg-primary text-primary-foreground" : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"}`}
                >
                  {tf.label}{" "}
                  <span
                    className={`text-xs ${typeFilter === tf.key ? "opacity-70" : "opacity-50"}`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="h-4 w-px bg-foreground/10 hidden sm:block" />
          {/* Date filter */}
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-muted-foreground" />
            {(["all", "today", "week", "month"] as const).map((d) => {
              const labels = { all: "Sempre", today: "Hoje", week: "Semana", month: "Mês" };
              return (
                <button
                  key={d}
                  onClick={() => setDateFilter(d)}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${dateFilter === d ? "bg-primary text-primary-foreground" : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"}`}
                >
                  {labels[d]}
                </button>
              );
            })}
          </div>
          <div className="h-4 w-px bg-foreground/10 hidden sm:block" />
          {/* Sort */}
          <div className="flex items-center gap-1">
            <BarChart2 className="w-3 h-3 text-muted-foreground rotate-90" />
            {(["name", "date", "size"] as const).map((s) => {
              const labels = { name: "Nome", date: "Data", size: "Tamanho" };
              return (
                <button
                  key={s}
                  onClick={() => {
                    if (sortBy === s) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                    else {
                      setSortBy(s);
                      setSortDir(s === "name" ? "asc" : "desc");
                    }
                  }}
                  className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${sortBy === s ? "bg-foreground/15 text-foreground" : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"}`}
                >
                  {labels[s]}{" "}
                  {sortBy === s && (
                    <span className="text-xs ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>
                  )}
                </button>
              );
            })}
          </div>
          {/* Clear filters */}
          {(typeFilter !== "all" || dateFilter !== "all" || showStarredOnly) && (
            <button
              onClick={() => {
                setTypeFilter("all");
                setDateFilter("all");
                setShowStarredOnly(false);
              }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-destructive/70 hover:text-destructive bg-destructive/5 hover:bg-destructive/10 transition-colors ml-auto"
            >
              <X className="w-3 h-3" /> Limpar filtros
            </button>
          )}
          {/* Starred filter */}
          {starredIds.size > 0 && (
            <button
              onClick={() => setShowStarredOnly((prev) => !prev)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${showStarredOnly ? "bg-amber-500/20 text-amber-500" : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10"}`}
            >
              <Star className={`w-3 h-3 ${showStarredOnly ? "fill-current" : ""}`} /> Favoritos (
              {starredIds.size})
            </button>
          )}
          {/* Keyboard hints */}
          <span className="text-xs text-muted-foreground/50 hidden lg:flex items-center gap-2 ml-auto">
            <span className="flex items-center gap-1">
              <ClipboardPaste className="w-3 h-3" /> Ctrl+V
            </span>
            <span>·</span>
            <span>Ctrl+A selecionar</span>
            {bulkMode && (
              <>
                <span>·</span>
                <span>Del excluir</span>
              </>
            )}
          </span>
        </div>

        {/* Bulk actions bar */}
        <AnimatePresence>
          {bulkMode && selectedIds.size > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-foreground/5">
                <span className="text-xs text-muted-foreground">
                  {selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={() => setSelectedIds(new Set(displayFiles.map((f) => f.id)))}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-foreground/5 text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
                >
                  <CheckSquare className="w-3 h-3" /> Selecionar tudo
                </button>
                <button
                  onClick={handleAiBatchAnalyze}
                  disabled={!!aiLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  {aiLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}{" "}
                  Analisar com IA
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Excluir selecionados
                </button>
                <button
                  onClick={() => {
                    setSelectedIds(new Set());
                    setBulkMode(false);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create folder inline */}
        <AnimatePresence>
          {creatingFolder && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-foreground/5">
                <FolderOpen className="w-4 h-4 text-primary" />
                <input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                  placeholder="Nome da pasta..."
                  className="flex-1 bg-foreground/5 rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  autoFocus
                />
                <button
                  onClick={handleCreateFolder}
                  disabled={actionLoading === "create-folder"}
                  className="text-primary hover:text-primary/80"
                >
                  {actionLoading === "create-folder" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => {
                    setCreatingFolder(false);
                    setNewFolderName("");
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Drag hint */}
        <AnimatePresence>
          {draggingId && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary"
            >
              <FolderInput className="w-3.5 h-3.5 shrink-0" />
              <span>Arraste para uma pasta ou breadcrumb para mover no Drive</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground flex-wrap">
          {breadcrumb.map((item, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3 h-3" />}
              <button
                onClick={() => navigateToFolder(item.id, item.name)}
                onDragOver={(e) => {
                  if (draggingId) {
                    e.preventDefault();
                    setDragOverId(`bc-${i}`);
                  }
                }}
                onDragLeave={() => setDragOverId(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  const itemId = e.dataTransfer.getData("driveItemId");
                  if (itemId) handleDriveMove(itemId, item.id || "root");
                  setDragOverId(null);
                }}
                className={`hover:text-foreground transition-all px-1.5 py-0.5 rounded ${dragOverId === `bc-${i}` ? "bg-primary/20 text-primary ring-2 ring-primary/50 scale-110 font-medium" : ""}`}
              >
                {item.name}
              </button>
            </span>
          ))}
          <GoogleSyncBadge variant="from-google" />
          <WorkspaceBadge workspaceId={driveWorkspaceId} />
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-2">
            {allFolders.length + allFiles.length} itens
          </span>
        </div>
      </GlassCard>

      {/* Upload Progress Panel */}
      <AnimatePresence>
        {uploads.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <GlassCard size="auto">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Upload className="w-4 h-4 text-primary" />
                  {isUploading
                    ? `Enviando ${uploads.filter((u) => u.status === "uploading" || u.status === "pending").length} arquivo(s)...`
                    : "Upload concluído"}
                </p>
                <div className="flex items-center gap-2">
                  {!isUploading && (
                    <button
                      onClick={clearCompleted}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>
              {/* Global progress bar */}
              {isUploading && (
                <div className="w-full h-1.5 bg-foreground/10 rounded-full mb-3 overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${totalProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )}
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {uploads.map((upload) => (
                  <div
                    key={upload.id}
                    className="flex items-center gap-3 px-2.5 py-1.5 rounded-lg bg-foreground/[0.03]"
                  >
                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {upload.status === "uploading" ? (
                        <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                      ) : upload.status === "done" ? (
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                      ) : upload.status === "error" ? (
                        <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground truncate">{upload.name}</p>
                      {upload.status === "uploading" && (
                        <div className="w-full h-1 bg-foreground/10 rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{ width: `${upload.progress}%` }}
                          />
                        </div>
                      )}
                      {upload.status === "error" && (
                        <p className="text-xs text-destructive mt-0.5">{upload.error}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {upload.status === "uploading"
                        ? `${upload.progress}%`
                        : upload.status === "done"
                          ? "✓"
                          : ""}
                    </span>
                    {(upload.status === "uploading" || upload.status === "pending") && (
                      <button
                        onClick={() => cancelUpload(upload.id)}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {isLoading && !driveItems?.length ? (
        <GlassCard size="auto" className="flex flex-col items-center justify-center py-8 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Carregando arquivos do Drive...</p>
        </GlassCard>
      ) : driveError && !driveItems?.length ? (
        <GlassCard size="auto" className="flex flex-col items-center justify-center py-8 gap-3">
          <AlertCircle className="w-6 h-6 text-destructive/50" />
          <p className="text-sm text-muted-foreground">Erro ao carregar arquivos</p>
          <p className="text-xs text-muted-foreground/70 max-w-xs text-center">{driveError}</p>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors mt-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
          </button>
        </GlassCard>
      ) : (
        <>
          {/* Folders */}
          {(displayFolders.length > 0 || currentFolderId !== null) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {currentFolderId !== null && (
                <button
                  onClick={goBack}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-colors text-sm text-muted-foreground"
                >
                  <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
              )}
              {displayFolders.map((folder) => (
                <DeshContextMenu
                  key={folder.id}
                  actions={[
                    {
                      id: "open",
                      label: "Abrir pasta",
                      icon: FolderOpen,
                      onClick: () => navigateToFolder(folder.id, folder.name),
                    },
                    {
                      id: "rename",
                      label: "Renomear",
                      icon: Edit3,
                      onClick: () => {
                        setRenamingId(folder.id);
                        setRenameValue(folder.name);
                      },
                      dividerAfter: true,
                    },
                    {
                      id: "copy_link",
                      label: "Copiar link",
                      icon: Link2,
                      onClick: () => {
                        if (folder.webViewLink) {
                          navigator.clipboard.writeText(folder.webViewLink);
                          toast({ title: "Link copiado!" });
                        }
                      },
                      disabled: !folder.webViewLink,
                    },
                    {
                      id: "copy",
                      label: "Copiar",
                      icon: Copy,
                      onClick: () => handleClipboardCopy(folder),
                      shortcut: "Ctrl+C",
                    },
                    {
                      id: "cut",
                      label: "Recortar",
                      icon: Scissors,
                      onClick: () => handleClipboardCut(folder),
                      shortcut: "Ctrl+X",
                      dividerAfter: true,
                    },
                    {
                      id: "move_to",
                      label: "Mover para...",
                      icon: FolderInput,
                      onClick: () => setMoveToItem(folder),
                    },
                    {
                      id: "transfer",
                      label: "Transferir para outro perfil",
                      icon: FolderSymlink,
                      onClick: () => setTransferItem(folder),
                      dividerAfter: true,
                    },
                    {
                      id: "delete",
                      label: "Excluir",
                      icon: Trash2,
                      destructive: true,
                      onClick: () => handleDelete(folder.id, folder.name),
                    },
                  ]}
                >
                  <div
                    className={`flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-all group select-none
                    ${draggingId === folder.id ? "opacity-40 scale-95" : ""}
                    ${dragOverId === folder.id && draggingId !== folder.id ? "ring-2 ring-primary bg-primary/10 scale-[1.03] shadow-lg" : "bg-foreground/5 hover:bg-foreground/10"}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, folder.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (draggingId !== folder.id) setDragOverId(folder.id);
                    }}
                    onDragLeave={() => setDragOverId(null)}
                    onDrop={(e) => handleFolderDrop(e, folder.id)}
                    onClick={() => navigateToFolder(folder.id, folder.name)}
                  >
                    <FolderOpen
                      className={`w-5 h-5 flex-shrink-0 transition-all ${dragOverId === folder.id ? "text-primary animate-pulse" : "text-primary/70"}`}
                    />
                    <div className="flex-1 min-w-0">
                      {renamingId === folder.id ? (
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleRename(folder.id)}
                            className="flex-1 bg-foreground/5 rounded px-1.5 py-0.5 text-xs text-foreground outline-none"
                            autoFocus
                          />
                          <button onClick={() => handleRename(folder.id)} className="text-primary">
                            <Save className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setRenamingId(null)}
                            className="text-muted-foreground"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {folder.name}
                          </p>
                          <WorkspaceBadge workspaceId={driveWorkspaceId} />
                        </div>
                      )}
                    </div>
                    {renamingId !== folder.id && (
                      <div
                        className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setRenamingId(folder.id);
                            setRenameValue(folder.name);
                          }}
                          className="p-0.5 text-muted-foreground hover:text-foreground"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(folder.id, folder.name)}
                          className="p-0.5 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </DeshContextMenu>
              ))}
            </div>
          )}

          {/* Files */}
          {displayFiles.length > 0 && (
            <GlassCard size="auto">
              <div className="flex items-center justify-between mb-3">
                <p className="widget-title">
                  {displayFiles.length} arquivo{displayFiles.length !== 1 && "s"}
                  {hasActiveFilter && (
                    <span className="ml-1 text-xs font-normal text-primary">· filtrado</span>
                  )}
                </p>
              </div>

              {view === "list" ? (
                <div className="space-y-0.5">
                  {displayFiles.map((file) => {
                    const Icon = getFileIcon(file.mimeType);
                    const isSelected = selectedIds.has(file.id);
                    const tagInfo = fileTagCache[file.id];
                    const isStarred = starredIds.has(file.id);
                    return (
                      <DeshContextMenu
                        actions={[
                          {
                            id: "open",
                            label: "Abrir no Drive",
                            icon: Eye,
                            onClick: () => handleOpen(file),
                          },
                          {
                            id: "preview",
                            label: "Visualizar",
                            icon: ZoomIn,
                            onClick: () => openPreview(file),
                            disabled: !canPreview(file.mimeType),
                          },
                          {
                            id: "download",
                            label: "Baixar",
                            icon: Download,
                            onClick: () => handleDownload(file),
                            dividerAfter: true,
                          },
                          {
                            id: "copy",
                            label: "Copiar",
                            icon: Copy,
                            onClick: () => handleClipboardCopy(file),
                            shortcut: "⌘C",
                          },
                          {
                            id: "cut",
                            label: "Recortar",
                            icon: Scissors,
                            onClick: () => handleClipboardCut(file),
                            shortcut: "⌘X",
                          },
                          {
                            id: "duplicate",
                            label: "Duplicar",
                            icon: Copy,
                            onClick: () => handleDuplicate(file),
                          },
                          {
                            id: "copy_link",
                            label: "Copiar link",
                            icon: Link2,
                            onClick: () => handleCopyLink(file),
                            dividerAfter: true,
                          },
                          {
                            id: "rename",
                            label: "Renomear",
                            icon: Edit3,
                            onClick: () => {
                              setRenamingId(file.id);
                              setRenameValue(file.name);
                            },
                          },
                          {
                            id: "ai_rename",
                            label: "Renomear com IA",
                            icon: Wand2,
                            onClick: () => handleAiSmartRename(file),
                          },
                          {
                            id: "ai_analyze",
                            label: "Analisar com IA",
                            icon: Sparkles,
                            onClick: () => handleAiAnalyze(file),
                          },
                          {
                            id: "ai_summarize",
                            label: "Resumir com IA",
                            icon: Lightbulb,
                            onClick: () => handleAiSummarize(file),
                            dividerAfter: true,
                          },
                          {
                            id: "move_to",
                            label: "Mover para...",
                            icon: FolderInput,
                            onClick: () => setMoveToItem(file),
                          },
                          {
                            id: "versions",
                            label: "Histórico de versões",
                            icon: History,
                            onClick: () => handleViewVersions(file),
                          },
                          {
                            id: "transfer",
                            label: "Transferir para outro perfil",
                            icon: FolderSymlink,
                            onClick: () => setTransferItem(file),
                            dividerAfter: true,
                          },
                          {
                            id: "delete",
                            label: "Excluir",
                            icon: Trash2,
                            destructive: true,
                            onClick: () => handleDelete(file.id, file.name),
                          },
                        ]}
                      >
                        <div
                          className={`flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-foreground/5 transition-all group cursor-grab active:cursor-grabbing
                          ${isSelected ? "bg-primary/10 ring-1 ring-primary/20" : ""}
                          ${draggingId === file.id ? "opacity-40 scale-95" : ""}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, file.id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => {
                            if (bulkMode) {
                              toggleSelect(file.id);
                              return;
                            }
                          }}
                        >
                          {bulkMode && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelect(file.id);
                              }}
                              className="flex-shrink-0"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-primary" />
                              ) : (
                                <Square className="w-4 h-4 text-muted-foreground" />
                              )}
                            </button>
                          )}
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            {file.iconLink ? (
                              <img src={file.iconLink} alt="" className="w-5 h-5" />
                            ) : (
                              <Icon className="w-4 h-4 text-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            {renamingId === file.id ? (
                              <div
                                className="flex items-center gap-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleRename(file.id);
                                    if (e.key === "Escape") setRenamingId(null);
                                  }}
                                  className="flex-1 bg-foreground/5 rounded px-2 py-0.5 text-sm text-foreground outline-none"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleRename(file.id)}
                                  className="text-primary"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setRenamingId(null)}
                                  className="text-muted-foreground"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 min-w-0">
                                <p className="text-sm text-foreground truncate">
                                  {searchQuery ? highlightMatch(file.name, searchQuery) : file.name}
                                </p>
                                {tagInfo?.category && (
                                  <span className="flex-shrink-0 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                                    {tagInfo.category}
                                  </span>
                                )}
                                {isStarred && (
                                  <Star className="flex-shrink-0 w-3 h-3 fill-current text-amber-400" />
                                )}
                                <WorkspaceBadge workspaceId={driveWorkspaceId} />
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {formatSize(file.size)}
                              {file.size > 0 && " · "}
                              {file.modifiedTime &&
                                new Date(file.modifiedTime).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                          {!bulkMode && renamingId !== file.id && (
                            <div className="opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                              {renderFileActions(file)}
                            </div>
                          )}
                        </div>
                      </DeshContextMenu>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {displayFiles.map((file) => {
                    const Icon = getFileIcon(file.mimeType);
                    const isImage = file.mimeType.startsWith("image/");
                    const isSelected = selectedIds.has(file.id);
                    const tagInfo = fileTagCache[file.id];
                    const isStarred = starredIds.has(file.id);
                    return (
                      <DeshContextMenu
                        key={file.id}
                        actions={[
                          {
                            id: "open",
                            label: "Abrir no Drive",
                            icon: Eye,
                            onClick: () => handleOpen(file),
                          },
                          {
                            id: "preview",
                            label: "Visualizar",
                            icon: ZoomIn,
                            onClick: () => openPreview(file),
                            disabled: !canPreview(file.mimeType),
                          },
                          {
                            id: "download",
                            label: "Baixar",
                            icon: Download,
                            onClick: () => handleDownload(file),
                            dividerAfter: true,
                          },
                          {
                            id: "copy",
                            label: "Copiar",
                            icon: Copy,
                            onClick: () => handleClipboardCopy(file),
                            shortcut: "⌘C",
                          },
                          {
                            id: "cut",
                            label: "Recortar",
                            icon: Scissors,
                            onClick: () => handleClipboardCut(file),
                            shortcut: "⌘X",
                          },
                          {
                            id: "duplicate",
                            label: "Duplicar",
                            icon: Copy,
                            onClick: () => handleDuplicate(file),
                          },
                          {
                            id: "copy_link",
                            label: "Copiar link",
                            icon: Link2,
                            onClick: () => handleCopyLink(file),
                            dividerAfter: true,
                          },
                          {
                            id: "rename",
                            label: "Renomear",
                            icon: Edit3,
                            onClick: () => {
                              setRenamingId(file.id);
                              setRenameValue(file.name);
                            },
                          },
                          {
                            id: "ai_rename",
                            label: "Renomear com IA",
                            icon: Wand2,
                            onClick: () => handleAiSmartRename(file),
                          },
                          {
                            id: "ai_analyze",
                            label: "Analisar com IA",
                            icon: Sparkles,
                            onClick: () => handleAiAnalyze(file),
                          },
                          {
                            id: "ai_summarize",
                            label: "Resumir com IA",
                            icon: Lightbulb,
                            onClick: () => handleAiSummarize(file),
                            dividerAfter: true,
                          },
                          {
                            id: "versions",
                            label: "Histórico de versões",
                            icon: History,
                            onClick: () => handleViewVersions(file),
                          },
                          {
                            id: "transfer",
                            label: "Transferir para outro perfil",
                            icon: FolderSymlink,
                            onClick: () => setTransferItem(file),
                            dividerAfter: true,
                          },
                          {
                            id: "delete",
                            label: "Excluir",
                            icon: Trash2,
                            destructive: true,
                            onClick: () => handleDelete(file.id, file.name),
                          },
                        ]}
                      >
                        <div
                          className={`rounded-2xl border transition-all cursor-pointer group relative flex flex-col overflow-hidden select-none
                          ${isSelected ? "border-primary ring-2 ring-primary/20" : "border-foreground/8 hover:border-foreground/20"}
                          ${draggingId === file.id ? "opacity-40 scale-95" : ""} bg-foreground/[0.03] hover:bg-foreground/[0.06]`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, file.id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => {
                            if (bulkMode) {
                              toggleSelect(file.id);
                              return;
                            }
                            handleOpen(file);
                          }}
                        >
                          {/* Thumbnail */}
                          <div className="relative w-full aspect-[4/3] bg-foreground/5 flex items-center justify-center overflow-hidden">
                            {isImage && file.thumbnailLink ? (
                              <img
                                src={file.thumbnailLink}
                                alt={file.name}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                loading="lazy"
                              />
                            ) : file.iconLink ? (
                              <img src={file.iconLink} alt="" className="w-10 h-10" />
                            ) : (
                              <Icon className="w-10 h-10 text-primary/30" />
                            )}
                            {bulkMode && (
                              <div className="absolute inset-0 flex items-center justify-center bg-background/40">
                                {isSelected ? (
                                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                                    <CheckSquare className="w-4 h-4 text-primary-foreground" />
                                  </div>
                                ) : (
                                  <div className="w-7 h-7 rounded-full border-2 border-foreground/30 bg-background/60" />
                                )}
                              </div>
                            )}
                            {/* Hover star */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleStar(file.id);
                              }}
                              className={`absolute top-1.5 right-1.5 p-1 rounded-full backdrop-blur-sm transition-all ${isStarred ? "bg-amber-500/20 text-amber-400" : "bg-background/60 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-amber-400"}`}
                            >
                              <Star className={`w-3 h-3 ${isStarred ? "fill-current" : ""}`} />
                            </button>
                            {tagInfo?.category && (
                              <div className="absolute bottom-1.5 left-1.5">
                                <span className="text-xs bg-primary/80 text-primary-foreground px-1.5 py-0.5 rounded-full font-medium backdrop-blur-sm">
                                  {tagInfo.category}
                                </span>
                              </div>
                            )}
                          </div>
                          {/* Info */}
                          <div className="px-2.5 py-2 flex items-center justify-between gap-1 min-w-0">
                            <div className="min-w-0 flex-1">
                              {renamingId === file.id ? (
                                <div
                                  className="flex items-center gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleRename(file.id);
                                      if (e.key === "Escape") setRenamingId(null);
                                    }}
                                    className="flex-1 bg-foreground/5 rounded px-2 py-0.5 text-xs text-foreground outline-none min-w-0"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleRename(file.id)}
                                    className="text-primary flex-shrink-0"
                                  >
                                    <Save className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => setRenamingId(null)}
                                    className="text-muted-foreground flex-shrink-0"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-1 min-w-0">
                                    <p className="text-xs text-foreground truncate leading-tight">
                                      {searchQuery
                                        ? highlightMatch(file.name, searchQuery)
                                        : file.name}
                                    </p>
                                    <WorkspaceBadge workspaceId={driveWorkspaceId} />
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {formatSize(file.size) || "Google Docs"}
                                  </p>
                                </>
                              )}
                            </div>
                            {!bulkMode && renamingId !== file.id && (
                              <div
                                className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={() => {
                                    setRenamingId(file.id);
                                    setRenameValue(file.name);
                                  }}
                                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
                                  title="Renomear"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDelete(file.id, file.name)}
                                  disabled={actionLoading === file.id}
                                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                  title="Excluir"
                                >
                                  {actionLoading === file.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </DeshContextMenu>
                    );
                  })}
                </div>
              )}
            </GlassCard>
          )}

          {/* Empty state */}
          {displayFolders.length === 0 && displayFiles.length === 0 && !isLoading && (
            <GlassCard
              size="auto"
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <FolderOpen className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {hasActiveFilter
                  ? "Nenhum arquivo encontrado com os filtros atuais"
                  : "Pasta vazia"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Arraste qualquer arquivo ou clique Upload — sem limite de tamanho
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Upload className="w-4 h-4" /> Fazer upload
              </button>
            </GlassCard>
          )}

          {/* Inline drop zone */}
          {!fullPage && !isUploading && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 rounded-2xl border-2 border-dashed border-foreground/15 bg-foreground/[0.03] hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer flex flex-col items-center justify-center py-6 gap-2"
            >
              <Upload className="w-7 h-7 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                Arraste qualquer arquivo ou clique para upload
              </p>
              <p className="text-xs text-muted-foreground/50">
                Qualquer tipo e tamanho · Direto para o Google Drive
              </p>
            </div>
          )}
        </>
      )}

      {/* Clipboard indicator */}
      <AnimatePresence>
        {clipboardItem && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-foreground/90 text-background text-xs font-medium shadow-xl backdrop-blur-sm"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>
              {clipboardItem.action === "copy" ? "Copiado" : "Recortado"}: "{clipboardItem.name}"
            </span>
            <button
              onClick={handleClipboardPaste}
              className="px-2 py-0.5 rounded-lg bg-primary text-primary-foreground text-xs hover:bg-primary/90"
            >
              Colar aqui
            </button>
            <button
              onClick={() => setClipboardItem(null)}
              className="text-background/60 hover:text-background"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transfer dialog */}
      <TransferWorkspaceDialog
        item={transferItem}
        currentWorkspaceId={driveWorkspaceId}
        onClose={() => setTransferItem(null)}
        onSuccess={() => refetch()}
      />

      {/* Move-to dialog */}
      <MoveToDialog
        item={
          moveToItem
            ? {
                id: moveToItem.id,
                name: moveToItem.name,
                mimeType: moveToItem.mimeType,
                parents: moveToItem.parents,
                workspaceId: driveWorkspaceId || undefined,
              }
            : null
        }
        onClose={() => setMoveToItem(null)}
        onSuccess={() => refetch()}
      />

      {/* Preview modal */}
      <Dialog
        open={!!previewFile}
        onOpenChange={(open) => {
          if (!open) setPreviewFile(null);
        }}
      >
        <DialogContent className="max-w-5xl max-h-[92vh] p-0 gap-0 overflow-hidden flex flex-col [&>button:last-child]:hidden sm:rounded-2xl">
          {previewFile && (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-foreground/10 flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  {previewableFiles.length > 1 && (
                    <span className="text-xs text-muted-foreground bg-foreground/5 px-2 py-0.5 rounded-full flex-shrink-0">
                      {previewIndexRef.current + 1}/{previewableFiles.length}
                    </span>
                  )}
                  <p className="text-sm font-medium text-foreground truncate">{previewFile.name}</p>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatSize(previewFile.size)}
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {previewFile.mimeType.startsWith("image/") && (
                    <>
                      <button
                        onClick={() => setPreviewZoom((z) => Math.max(z - 0.25, 0.5))}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs text-muted-foreground w-12 text-center">
                        {Math.round(previewZoom * 100)}%
                      </span>
                      <button
                        onClick={() => setPreviewZoom((z) => Math.min(z + 0.25, 3))}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setPreviewZoom(1)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleOpen(previewFile)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                    title="Abrir no Drive"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setPreviewFile(null)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="relative flex-1 flex items-center min-h-0 bg-foreground/3">
                {previewableFiles.length > 1 && previewIndexRef.current > 0 && (
                  <button
                    onClick={() => navigatePreview(-1)}
                    className="absolute left-3 z-10 p-2 rounded-full bg-background/80 backdrop-blur-sm border border-foreground/10 text-foreground hover:bg-background shadow-lg transition-all"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                {previewableFiles.length > 1 &&
                  previewIndexRef.current < previewableFiles.length - 1 && (
                    <button
                      onClick={() => navigatePreview(1)}
                      className="absolute right-3 z-10 p-2 rounded-full bg-background/80 backdrop-blur-sm border border-foreground/10 text-foreground hover:bg-background shadow-lg transition-all"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
                <div className="flex items-center justify-center w-full h-full p-4 overflow-auto">
                  {previewFile.mimeType.startsWith("image/") &&
                    (previewFile.thumbnailLink || previewFile.webViewLink) && (
                      <img
                        src={
                          previewFile.thumbnailLink
                            ? previewFile.thumbnailLink.replace(/=s\d+/, "=s1600")
                            : previewFile.webViewLink
                        }
                        alt={previewFile.name}
                        className="rounded-lg shadow-lg transition-transform duration-200"
                        style={{
                          maxWidth: "100%",
                          maxHeight: "72vh",
                          objectFit: "contain",
                          transform: `scale(${previewZoom})`,
                          transformOrigin: "center",
                        }}
                      />
                    )}
                  {previewFile.mimeType === "application/pdf" && previewFile.webViewLink && (
                    <iframe
                      src={previewFile.webViewLink}
                      className="w-full h-full rounded-lg"
                      title={previewFile.name}
                    />
                  )}
                  {previewFile.mimeType.startsWith("video/") && previewFile.webViewLink && (
                    <iframe
                      src={previewFile.webViewLink}
                      className="w-full h-full rounded-lg"
                      title={previewFile.name}
                      allowFullScreen
                    />
                  )}
                  {previewFile.mimeType.startsWith("audio/") && previewFile.webViewLink && (
                    <div className="text-center">
                      <Music className="w-16 h-16 text-primary/30 mx-auto mb-4" />
                      <p className="text-sm text-foreground mb-4">{previewFile.name}</p>
                      <a
                        href={previewFile.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90"
                      >
                        Abrir no Drive
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog
        open={!!versionsFile}
        onOpenChange={(open) => {
          if (!open) {
            setVersionsFile(null);
            setVersions([]);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[80vh] p-0 gap-0 overflow-hidden flex flex-col [&>button:last-child]:hidden sm:rounded-2xl">
          {versionsFile && (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <History className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-sm font-medium text-foreground truncate">
                    {versionsFile.name}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setVersionsFile(null);
                    setVersions([]);
                  }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {versionsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="ml-2 text-sm text-muted-foreground">
                      Carregando versões...
                    </span>
                  </div>
                ) : versions.length === 0 ? (
                  <div className="text-center py-8">
                    <History className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Nenhuma versão anterior disponível
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      O Google Drive mantém versões automaticamente para arquivos editados
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground mb-2">
                      {versions.length} versão(ões) encontrada(s)
                    </p>
                    {versions.map((rev: any, i: number) => {
                      const date = rev.modifiedTime ? new Date(rev.modifiedTime) : null;
                      const sizeStr = rev.size
                        ? Number(rev.size) < 1024 * 1024
                          ? `${(Number(rev.size) / 1024).toFixed(0)} KB`
                          : `${(Number(rev.size) / (1024 * 1024)).toFixed(1)} MB`
                        : "";
                      const userName =
                        rev.lastModifyingUser?.displayName ||
                        rev.lastModifyingUser?.emailAddress ||
                        "Desconhecido";
                      const isLatest = i === versions.length - 1;
                      return (
                        <div
                          key={rev.id}
                          className={`p-3 rounded-xl border transition-colors ${isLatest ? "border-primary/30 bg-primary/5" : "border-border bg-foreground/[0.02] hover:bg-foreground/[0.04]"}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-foreground">
                                  {isLatest ? "Versão atual" : `Versão ${versions.length - i}`}
                                </p>
                                {rev.keepForever && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                    Protegida
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {date && (
                                  <p className="text-xs text-muted-foreground">
                                    {date.toLocaleDateString("pt-BR")} às{" "}
                                    {date.toLocaleTimeString("pt-BR", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </p>
                                )}
                                {sizeStr && (
                                  <span className="text-xs text-muted-foreground/60">
                                    · {sizeStr}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                                por {userName}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() =>
                                  handleDownloadVersion(versionsFile.id, rev.id, versionsFile.name)
                                }
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                                title="Baixar esta versão"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() =>
                                  handleKeepVersion(versionsFile.id, rev.id, !rev.keepForever)
                                }
                                className={`p-1.5 rounded-lg transition-colors ${rev.keepForever ? "text-primary hover:text-primary/70" : "text-muted-foreground hover:text-foreground"} hover:bg-foreground/5`}
                                title={
                                  rev.keepForever
                                    ? "Remover proteção"
                                    : "Proteger contra exclusão automática"
                                }
                              >
                                <Star
                                  className={`w-3.5 h-3.5 ${rev.keepForever ? "fill-current" : ""}`}
                                />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
              <div className="px-4 py-3 border-t border-border flex-shrink-0">
                <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                  💡 O Google Drive mantém versões por 30 dias ou até 100 versões. Proteja versões
                  importantes para evitar exclusão automática.
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GoogleDriveExplorer;
