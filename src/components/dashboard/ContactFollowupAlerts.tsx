import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  UserX, X, Sparkles, Loader2, ChevronDown, ChevronUp,
  Mail, Phone, MessageSquare, Linkedin, Copy, ExternalLink,
  AlertTriangle, Clock
} from "lucide-react";
import { useContactFollowupAlerts } from "@/hooks/contacts/useContactFollowupAlerts";
import { toast } from "@/hooks/use-toast";

const channelIcons: Record<string, any> = {
  email: Mail,
  phone: Phone,
  whatsapp: MessageSquare,
  linkedin: Linkedin,
};

const urgencyColors: Record<string, string> = {
  high: "text-red-400 bg-red-400/10 border-red-400/20",
  medium: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  low: "text-primary bg-primary/10 border-primary/20",
};

export function ContactFollowupAlerts() {
  const navigate = useNavigate();
  const { alerts, dismissAlert, loadSuggestion } = useContactFollowupAlerts();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (alerts.length === 0) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    toast({ title: "Copiado!", description: "Mensagem copiada para a área de transferência." });
  };

  return (
    <div className="mb-3 space-y-2">
      <div className="flex items-center gap-2 px-1">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
          {alerts.length} contato{alerts.length !== 1 ? "s" : ""} precisando de atenção
        </span>
      </div>

      <AnimatePresence>
        {alerts.map((alert) => {
          const isExpanded = expandedId === alert.contactId;
          const ChannelIcon = alert.aiSuggestion ? (channelIcons[alert.aiSuggestion.channel] || MessageSquare) : null;
          const urgencyClass = alert.aiSuggestion ? (urgencyColors[alert.aiSuggestion.urgency] || urgencyColors.low) : "";

          return (
            <motion.div
              key={alert.contactId}
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.2 }}
              className="glass-card border border-amber-400/20 bg-amber-400/5 rounded-xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-amber-400/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <UserX className="w-4 h-4 text-amber-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-semibold text-foreground">{alert.contactName}</p>
                    {alert.contactCompany && (
                      <span className="text-[10px] text-muted-foreground">· {alert.contactCompany}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1 text-[10px] text-amber-400">
                      <Clock className="w-2.5 h-2.5" />
                      {alert.daysSince >= 999 ? "Sem interações" : `${alert.daysSince} dias sem contato`}
                    </span>
                    {alert.reason === "low_score" && (
                      <span className="text-[10px] text-muted-foreground">· Score: {alert.score}/100</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Load / expand AI suggestion */}
                  <button
                    onClick={() => {
                      if (!alert.aiSuggestion && !alert.loadingSuggestion) {
                        loadSuggestion(alert.contactId);
                        setExpandedId(alert.contactId);
                      } else {
                        setExpandedId(isExpanded ? null : alert.contactId);
                      }
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-amber-400/15 text-amber-400 hover:bg-amber-400/25 transition-colors"
                    title="Sugestão de mensagem via IA"
                  >
                    {alert.loadingSuggestion ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    {!alert.loadingSuggestion && (isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </button>

                  {/* Go to contact */}
                  <button
                    onClick={() => navigate("/contacts")}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                    title="Ver no CRM"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </button>

                  {/* Dismiss */}
                  <button
                    onClick={() => dismissAlert(alert.contactId)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                    title="Dispensar"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* AI Suggestion Panel */}
              <AnimatePresence>
                {isExpanded && alert.aiSuggestion && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 pt-0 border-t border-amber-400/10">
                      <div className="mt-3 space-y-2">
                        {/* Meta row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {ChannelIcon && (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <ChannelIcon className="w-3 h-3" />
                              {alert.aiSuggestion.channel}
                            </span>
                          )}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-medium ${urgencyClass}`}>
                            {alert.aiSuggestion.urgency === "high" ? "Urgente" : alert.aiSuggestion.urgency === "medium" ? "Médio" : "Baixo"}
                          </span>
                        </div>

                        {/* Subject */}
                        {alert.aiSuggestion.subject && (
                          <div className="bg-foreground/5 rounded-lg px-3 py-2">
                            <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Assunto</p>
                            <p className="text-[11px] text-foreground font-medium">{alert.aiSuggestion.subject}</p>
                          </div>
                        )}

                        {/* Message */}
                        <div className="bg-foreground/5 rounded-lg px-3 py-2">
                          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Mensagem sugerida</p>
                          <p className="text-[11px] text-foreground/90 leading-relaxed">{alert.aiSuggestion.message}</p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCopy(
                              alert.aiSuggestion!.subject
                                ? `Assunto: ${alert.aiSuggestion!.subject}\n\n${alert.aiSuggestion!.message}`
                                : alert.aiSuggestion!.message
                            )}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors"
                          >
                            <Copy className="w-2.5 h-2.5" />
                            Copiar
                          </button>
                          <button
                            onClick={() => {
                              dismissAlert(alert.contactId);
                              toast({ title: "Marcado como contatado", description: `Lembre de registrar a interação com ${alert.contactName}.` });
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-amber-400/15 text-amber-400 hover:bg-amber-400/25 transition-colors"
                          >
                            Já contatei
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Loading state expanded */}
                {isExpanded && alert.loadingSuggestion && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="px-4 pb-3 pt-0 border-t border-amber-400/10"
                  >
                    <div className="mt-3 flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      <span className="text-xs">IA elaborando sugestão de mensagem...</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default ContactFollowupAlerts;
