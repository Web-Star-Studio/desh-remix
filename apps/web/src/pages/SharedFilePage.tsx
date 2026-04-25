import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText, Download, Lock, Loader2, AlertCircle, CheckCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";

const formatSize = (bytes: number) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const SharedFilePage = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [fileInfo, setFileInfo] = useState<{ url: string; name: string; mimeType: string; size: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  const resolve = async (pwd?: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("files-storage", {
        body: { action: "resolve-share", token, password: pwd },
      });

      if (fnErr) {
        setError("Erro ao acessar arquivo");
        return;
      }

      if (data?.needsPassword) {
        setNeedsPassword(true);
        setFileName(data.fileName || "Arquivo protegido");
        return;
      }

      if (data?.error) {
        setError(data.error);
        return;
      }

      if (data?.url) {
        setFileInfo(data);
      }
    } catch {
      setError("Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) resolve();
  }, [token]);

  const handleDownload = () => {
    if (fileInfo?.url) {
      const a = document.createElement("a");
      a.href = fileInfo.url;
      a.download = fileInfo.name;
      a.click();
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <FileText className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Arquivo compartilhado</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <AlertCircle className="w-8 h-8 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : needsPassword && !fileInfo ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
              <Lock className="w-4 h-4" />
              <span>Este arquivo requer uma senha</span>
            </div>
            <p className="text-xs text-muted-foreground">{fileName}</p>
            <div className="flex gap-2">
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha"
                type="password"
                onKeyDown={(e) => e.key === "Enter" && resolve(password)}
                className="flex-1"
              />
              <button
                onClick={() => resolve(password)}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
              >
                Acessar
              </button>
            </div>
          </div>
        ) : fileInfo ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-2">
              <p className="text-sm font-medium text-foreground">{fileInfo.name}</p>
              <p className="text-xs text-muted-foreground">
                {fileInfo.mimeType} · {formatSize(fileInfo.size)}
              </p>
            </div>
            <button
              onClick={handleDownload}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> Baixar arquivo
            </button>
          </div>
        ) : null}

        <p className="text-[10px] text-muted-foreground">
          Powered by DESH
        </p>
      </div>
    </div>
  );
};

export default SharedFilePage;
