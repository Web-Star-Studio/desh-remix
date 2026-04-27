import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useComposioWorkspaceId } from "@/hooks/integrations/useComposioWorkspaceId";
import { uploadFile, getDownloadUrl } from "@/lib/storage";
import { apiFetch } from "@/lib/api-client";
import GlassCard from "@/components/dashboard/GlassCard";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FolderOpen, Plus, Download, Trash2, CreditCard, Globe, Car, MapPin, FileText,
  Upload, X, Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

const DOC_TYPES = [
  { value: "rg", label: "RG", icon: CreditCard },
  { value: "cpf", label: "CPF", icon: CreditCard },
  { value: "passport", label: "Passaporte", icon: Globe },
  { value: "cnh", label: "CNH", icon: Car },
  { value: "proof_of_address", label: "Comprovante", icon: MapPin },
  { value: "other", label: "Outro", icon: FileText },
] as const;

const DOC_ICON_MAP: Record<string, React.ElementType> = Object.fromEntries(
  DOC_TYPES.map(d => [d.value, d.icon])
);
const DOC_LABEL_MAP: Record<string, string> = Object.fromEntries(
  DOC_TYPES.map(d => [d.value, d.label])
);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

// Shape returned by GET /workspaces/:id/profile-documents — joins on the
// underlying `files` row so the list endpoint carries enough metadata to
// render without a per-row download-url round trip.
interface ApiProfileDocument {
  id: string;
  workspaceId: string;
  userId: string;
  fileId: string;
  docType: string;
  label: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

const ProfileDocumentsSection = () => {
  const { user } = useAuth();
  const workspaceId = useComposioWorkspaceId();
  const [documents, setDocuments] = useState<ApiProfileDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("other");
  const [customLabel, setCustomLabel] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = async () => {
    if (!user || !workspaceId) {
      setDocuments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await apiFetch<ApiProfileDocument[]>(
        `/workspaces/${workspaceId}/profile-documents`,
      );
      setDocuments(rows);
    } catch (err) {
      console.error("[profile-documents] fetch failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDocs(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user, workspaceId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "Arquivo muito grande", description: "O limite é 10MB.", variant: "destructive" });
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({ title: "Tipo não suportado", description: "Aceita PDF, JPG, PNG ou WEBP.", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!user || !selectedFile || !workspaceId) return;
    setUploading(true);
    try {
      // Two-step: upload the binary to S3 via the files API, then create
      // the profile_documents row pointing at it. The server validates the
      // file_id belongs to this workspace before persisting.
      const result = await uploadFile(workspaceId, selectedFile, { category: "profile-doc" });
      const created = await apiFetch<ApiProfileDocument>(
        `/workspaces/${workspaceId}/profile-documents`,
        {
          method: "POST",
          body: JSON.stringify({
            fileId: result.file.id,
            docType,
            label: customLabel || DOC_LABEL_MAP[docType] || "Documento",
          }),
        },
      );
      setDocuments((prev) => [created, ...prev]);
      toast({ title: "Documento adicionado!" });
      resetForm();
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: ApiProfileDocument) => {
    if (!workspaceId) return;
    try {
      const url = await getDownloadUrl(workspaceId, doc.fileId);
      window.open(url, "_blank");
    } catch (err: any) {
      toast({ title: "Erro ao baixar", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (doc: ApiProfileDocument) => {
    if (!user || !workspaceId) return;
    try {
      await apiFetch<void>(
        `/workspaces/${workspaceId}/profile-documents/${doc.id}`,
        { method: "DELETE" },
      );
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      toast({ title: "Documento excluído" });
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err?.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setDocType("other");
    setCustomLabel("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) return null;

  return (
    <GlassCard size="auto">
      <div className="flex items-center justify-between mb-3">
        <p className="widget-title flex items-center gap-2">
          <FolderOpen className="w-4 h-4" /> Meus Documentos
        </p>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)} className="text-xs">
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? "Cancelar" : "Adicionar"}
        </Button>
      </div>

      {/* Upload Form */}
      {showForm && (
        <div className="mb-4 p-3 rounded-lg bg-foreground/5 border border-border/20 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tipo de documento</label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map(dt => (
                    <SelectItem key={dt.value} value={dt.value} className="text-xs">
                      <span className="flex items-center gap-2">
                        <dt.icon className="w-3.5 h-3.5" /> {dt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Rótulo (opcional)</label>
              <input
                value={customLabel}
                onChange={e => setCustomLabel(e.target.value)}
                placeholder="Ex: RG frente"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-border/30 hover:border-primary/40 hover:bg-primary/5 transition-all text-xs text-muted-foreground hover:text-foreground"
            >
              <Upload className="w-4 h-4" />
              {selectedFile ? (
                <span className="truncate max-w-[250px]">{selectedFile.name} ({formatSize(selectedFile.size)})</span>
              ) : (
                "Clique para selecionar arquivo (PDF, JPG, PNG — máx 10MB)"
              )}
            </button>
          </div>

          <Button
            size="sm"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="w-full text-xs"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? "Enviando..." : "Enviar documento"}
          </Button>
        </div>
      )}

      {/* Documents Grid */}
      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <FileText className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-xs">Nenhum documento adicionado</p>
          <p className="text-[10px] mt-0.5 opacity-60">Adicione RG, CNH, Passaporte e mais</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {documents.map(doc => {
            const IconComp = DOC_ICON_MAP[doc.docType] || FileText;
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-foreground/5 border border-border/10 group hover:border-primary/20 transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <IconComp className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {doc.label || DOC_LABEL_MAP[doc.docType] || "Documento"}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {doc.fileName} · {formatSize(doc.sizeBytes)}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60">
                    {format(new Date(doc.createdAt), "dd MMM yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => handleDownload(doc)}
                    className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                    title="Download"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(doc)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
};

export default ProfileDocumentsSection;
