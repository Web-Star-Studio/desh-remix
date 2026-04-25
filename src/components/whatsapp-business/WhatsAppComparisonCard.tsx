import { MessageCircle, Building2, ArrowRight, Check, X, Shield, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function WhatsAppComparisonCard() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Personal */}
      <button
        onClick={() => navigate("/settings/whatsapp")}
        className="group relative flex flex-col p-6 rounded-2xl border border-border/50 bg-card/50 hover:bg-accent/20 hover:border-[hsl(142,70%,45%)]/30 transition-all duration-300 text-left"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-[hsl(142,70%,45%)]/10 flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-[hsl(142,70%,45%)]" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-base">WhatsApp Pessoal</h3>
            <p className="text-[10px] text-muted-foreground">Via QR Code · Evolution API</p>
          </div>
        </div>
        <ul className="space-y-2 flex-1 mb-4">
          {[
            { yes: true, text: "Grupos e comunidades" },
            { yes: true, text: "Mensagens livres (sem restrição 24h)" },
            { yes: true, text: "Conta pessoal WhatsApp" },
            { yes: true, text: "Sincronização em tempo real" },
            { yes: false, text: "Risco de bloqueio (não-oficial)" },
            { yes: false, text: "Sem broadcasts em massa" },
          ].map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-xs">
              {item.yes ? (
                <Check className="w-3.5 h-3.5 text-[hsl(142,70%,45%)] shrink-0" />
              ) : (
                <X className="w-3.5 h-3.5 text-destructive/50 shrink-0" />
              )}
              <span className={item.yes ? "text-foreground" : "text-muted-foreground"}>{item.text}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-1.5 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          Configurar <ArrowRight className="w-3 h-3" />
        </div>
        <div className="absolute top-3 right-3 flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">
          <Zap className="w-2.5 h-2.5" /> Pessoal
        </div>
      </button>

      {/* Business */}
      <button
        onClick={() => navigate("/whatsapp-business")}
        className="group relative flex flex-col p-6 rounded-2xl border border-border/50 bg-card/50 hover:bg-accent/20 hover:border-primary/30 transition-all duration-300 text-left"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-base">WhatsApp Business</h3>
            <p className="text-[10px] text-muted-foreground">API Oficial Meta · Zernio</p>
          </div>
        </div>
        <ul className="space-y-2 flex-1 mb-4">
          {[
            { yes: true, text: "Broadcasts em massa com templates" },
            { yes: true, text: "Templates aprovados pela Meta" },
            { yes: true, text: "CRM de contatos com tags e grupos" },
            { yes: true, text: "Zero risco de bloqueio (oficial)" },
            { yes: true, text: "Agendamento de campanhas" },
            { yes: true, text: "Perfil comercial verificado" },
          ].map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-xs">
              <Check className="w-3.5 h-3.5 text-[hsl(142,70%,45%)] shrink-0" />
              <span className="text-foreground">{item.text}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-1.5 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          Configurar <ArrowRight className="w-3 h-3" />
        </div>
        <div className="absolute top-3 right-3 flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-[hsl(142,70%,45%)]/10 text-[hsl(142,70%,45%)]">
          <Shield className="w-2.5 h-2.5" /> Oficial
        </div>
      </button>
    </div>
  );
}
