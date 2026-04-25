import { useState } from "react";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { toast } from "@/hooks/use-toast";
import {
  Share2, Copy, Lock, Clock, Download, Loader2, Check, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface ShareDialogProps {
  fileId: string;
  fileName: string;
  onClose: () => void;
}

const ShareDialog = ({ fileId, fileName, onClose }: ShareDialogProps) => {
  const { invoke } = useEdgeFn();
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [expiresHours, setExpiresHours] = useState<number>(72);
  const [maxDownloads, setMaxDownloads] = useState<number | "">("");
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const { data, error } = await invoke<{ link: { token: string } }>({
        fn: "files-storage",
        body: {
          action: "create-share-link",
          fileId,
          password: password || undefined,
          expiresInHours: expiresHours || undefined,
          maxDownloads: maxDownloads || undefined,
        },
      });

      if (error) {
        toast({ title: "Erro", description: error, variant: "destructive" });
        return;
      }

      if (data?.link?.token) {
        const url = `${window.location.origin}/shared/${data.link.token}`;
        setShareUrl(url);
        toast({ title: "Link criado!" });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-4 p-4 rounded-xl bg-popover border border-border shadow-xl max-w-sm w-full">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <Share2 className="w-4 h-4 text-primary" />
          Compartilhar "{fileName}"
        </h4>
        <button onClick={onClose} className="p-1 rounded hover:bg-muted">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {shareUrl ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input value={shareUrl} readOnly className="text-xs h-8 flex-1" />
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 flex items-center gap-1"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <button
            onClick={() => { setShareUrl(null); setPassword(""); }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Criar outro link
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
              <Lock className="w-3 h-3" /> Senha (opcional)
            </label>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sem senha"
              type="password"
              className="h-8 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
                <Clock className="w-3 h-3" /> Expira em
              </label>
              <select
                value={expiresHours}
                onChange={(e) => setExpiresHours(Number(e.target.value))}
                className="w-full h-8 text-xs rounded-md border border-border bg-background px-2"
              >
                <option value={1}>1 hora</option>
                <option value={24}>24 horas</option>
                <option value={72}>3 dias</option>
                <option value={168}>7 dias</option>
                <option value={720}>30 dias</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
                <Download className="w-3 h-3" /> Max downloads
              </label>
              <Input
                value={maxDownloads}
                onChange={(e) => setMaxDownloads(e.target.value ? Number(e.target.value) : "")}
                placeholder="Ilimitado"
                type="number"
                min={1}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
            Gerar link
          </button>
        </div>
      )}
    </div>
  );
};

export default ShareDialog;
