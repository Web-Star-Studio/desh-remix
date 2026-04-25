import { useState } from "react";
import { Phone, Upload, AlertTriangle, Loader2, X, Users } from "lucide-react";
import type { ParsedVCardContact } from "@/lib/parseVCard";

interface Props {
  contacts: ParsedVCardContact[];
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

const ContactImportPreview = ({ contacts, onConfirm, onCancel }: Props) => {
  const [loading, setLoading] = useState(false);
  const noName = contacts.filter(c => c.name === "Sem nome").length;
  const preview = contacts.slice(0, 10);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Importar Contatos</h3>
          </div>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="text-center py-2">
            <p className="text-2xl font-bold text-foreground">{contacts.length}</p>
            <p className="text-sm text-muted-foreground">contato(s) encontrado(s) no arquivo</p>
          </div>

          {noName > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{noName} contato(s) sem nome — serão importados como "Sem nome"</span>
            </div>
          )}

          {/* Preview list */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium mb-2">Preview dos primeiros {preview.length}:</p>
            {preview.map((c, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-foreground/5">
                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                  {c.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.phones[0]?.number || c.emails[0]?.email || "—"}
                  </p>
                </div>
              </div>
            ))}
            {contacts.length > 10 && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                ...e mais {contacts.length - 10} contato(s)
              </p>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            💡 No iPhone: Ajustes → Contatos → Exportar, ou icloud.com/contacts → Exportar vCard
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-border">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Importar {contacts.length} contato(s)
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContactImportPreview;
