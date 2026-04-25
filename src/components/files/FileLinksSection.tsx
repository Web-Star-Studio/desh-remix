import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFileStorage, DeshFile } from "@/hooks/files/useFileStorage";
import FileUploadZone from "./FileUploadZone";
import { toast } from "@/hooks/use-toast";
import {
  FileText, Image, File, Video, Music, Archive, X, Download,
  Plus, Paperclip, ChevronDown, ChevronUp, Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const getIcon = (mime: string) => {
  if (mime?.startsWith("image/")) return Image;
  if (mime?.startsWith("video/")) return Video;
  if (mime?.startsWith("audio/")) return Music;
  if (mime?.includes("pdf")) return FileText;
  if (mime?.includes("zip") || mime?.includes("archive")) return Archive;
  return File;
};

const formatSize = (bytes: number) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

interface FileLinksSectionProps {
  entityType: "contact" | "task" | "transaction" | "note" | "event";
  entityId: string;
  compact?: boolean;
}

interface LinkedFile {
  link_id: string;
  file: DeshFile;
}

const FileLinksSection = ({ entityType, entityId, compact = false }: FileLinksSectionProps) => {
  const { uploadFile, getDownloadUrl, uploads } = useFileStorage();
  const [linkedFiles, setLinkedFiles] = useState<LinkedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(!compact);
  const [showUpload, setShowUpload] = useState(false);

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: links, error } = await supabase
        .from("file_links")
        .select("id, file_id")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .eq("user_id", user.id);

      if (error || !links?.length) {
        setLinkedFiles([]);
        return;
      }

      const fileIds = links.map((l: any) => l.file_id);
      const { data: files } = await supabase
        .from("files")
        .select("*")
        .in("id", fileIds)
        .eq("is_trashed", false);

      const result: LinkedFile[] = links
        .map((link: any) => {
          const file = files?.find((f: any) => f.id === link.file_id);
          return file ? { link_id: link.id, file: file as unknown as DeshFile } : null;
        })
        .filter(Boolean) as LinkedFile[];

      setLinkedFiles(result);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  const handleUpload = async (selectedFiles: File[]) => {
    for (const f of selectedFiles) {
      const result = await uploadFile(f);
      if (result) {
        // Create link
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("file_links").insert({
            file_id: result.id,
            entity_type: entityType,
            entity_id: entityId,
            user_id: user.id,
          });
        }
        fetchLinks();
      }
    }
    setShowUpload(false);
  };

  const handleUnlink = async (linkId: string) => {
    await supabase.from("file_links").delete().eq("id", linkId);
    setLinkedFiles((prev) => prev.filter((l) => l.link_id !== linkId));
    toast({ title: "Arquivo desvinculado" });
  };

  const handleDownload = async (fileId: string) => {
    const result = await getDownloadUrl(fileId);
    if (result?.url) {
      const a = document.createElement("a");
      a.href = result.url;
      a.download = result.name;
      a.click();
    }
  };

  const count = linkedFiles.length;

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
      >
        <span className="flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" />
          Arquivos {count > 0 && <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px]">{count}</span>}
        </span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2">
              {loading ? (
                <div className="flex justify-center py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* File list */}
                  {linkedFiles.map(({ link_id, file }) => {
                    const Icon = getIcon(file.mime_type);
                    return (
                      <div
                        key={link_id}
                        className="group flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/40 transition-all"
                      >
                        <Icon className="w-4 h-4 text-primary/60 shrink-0" />
                        <span className="text-xs truncate flex-1">{file.name}</span>
                        <span className="text-[10px] text-muted-foreground hidden sm:block">{formatSize(file.size_bytes)}</span>
                        <button
                          onClick={() => handleDownload(file.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted text-muted-foreground"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleUnlink(link_id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}

                  {/* Upload area */}
                  {showUpload ? (
                    <FileUploadZone
                      onFilesSelected={handleUpload}
                      uploads={uploads}
                      compact
                    />
                  ) : (
                    <button
                      onClick={() => setShowUpload(true)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md border border-dashed border-border/50 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> Anexar arquivo
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FileLinksSection;
