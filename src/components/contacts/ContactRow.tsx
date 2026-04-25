import React, { lazy, Suspense, useState } from "react";
import {
  Phone, Mail, Star, Trash2, Edit3, Sparkles, Loader2,
  CheckSquare, Square, Lightbulb, ChevronRight,
  Globe, MapPin, MessageCircle, Eye, Copy, Calendar, Building2,
} from "lucide-react";
import { DeshContextMenu } from "@/components/ui/DeshContextMenu";
import GoogleSyncBadge from "@/components/dashboard/GoogleSyncBadge";
import WorkspaceBadge from "@/components/dashboard/WorkspaceBadge";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { Sparkline } from "@/components/dashboard/ContactSparkline";
import type { DbContact, DbInteraction } from "@/hooks/contacts/useDbContacts";
import type { InteractionSummary } from "@/lib/contactScoring";
import { computeCompleteness, getScoreLabel } from "@/lib/contactScoring";
import {
  highlightMatch, getInitials, getAvatarPalette,
} from "@/hooks/contacts/useContactsPageState";
import SendWhatsAppDialog from "@/components/whatsapp-business/SendWhatsAppDialog";

const ContactDetailPanel = lazy(() => import("@/components/contacts/ContactDetailPanel"));

interface ContactRowProps {
  contact: DbContact;
  score: number;
  summary: InteractionSummary;
  isSelected: boolean;
  selectMode: boolean;
  searchQuery: string;
  isChecked: boolean;
  googleContactsConnected: boolean;
  lastInteractionType: string | undefined;
  allInteractionsRaw: { contact_id: string; interaction_date: string; type: string }[];
  aiFollowup: string | undefined;
  // Detail panel props (only used when selected)
  selectedContact: DbContact | null;
  interactions: DbInteraction[];
  loadingInteractions: boolean;
  interactionSummary: InteractionSummary;
  aiLoading: string | null;
  aiNextAction: string | null;
  // Handlers
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onToggleFavorite: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAiEnrich: (c: DbContact) => void;
  onAiSuggestAction: () => void;
  onAiSummarize: () => void;
  onSetAiNextAction: (v: string | null) => void;
  onNavigate: (path: string) => void;
  onSyncContactToGoogle: (action: string, payload: any) => Promise<void>;
  onUpdateContact: (id: string, updates: Partial<DbContact>) => Promise<void>;
  onAddInteraction: (i: Partial<DbInteraction>) => Promise<DbInteraction | undefined>;
  onDeleteInteraction: (id: string) => Promise<void>;
  onExport: () => void;
  onConfirmDelete: () => Promise<void>;
  computeRelationshipScore: (s: InteractionSummary) => number;
  computeScoreComponents: (s: InteractionSummary) => { freq: number; recency: number; diversity: number };
}

export const ContactRow = React.memo(({
  contact, score, summary, isSelected, selectMode, searchQuery, isChecked,
  googleContactsConnected, lastInteractionType, allInteractionsRaw, aiFollowup,
  selectedContact, interactions, loadingInteractions, interactionSummary,
  aiLoading, aiNextAction,
  onSelect, onToggleSelect, onToggleFavorite, onDelete,
  onAiEnrich, onAiSuggestAction, onAiSummarize, onSetAiNextAction,
  onNavigate, onSyncContactToGoogle, onUpdateContact, onAddInteraction,
  onDeleteInteraction, onExport, onConfirmDelete,
  computeRelationshipScore, computeScoreComponents,
}: ContactRowProps) => {
  const { pct: completeness } = computeCompleteness(contact);
  const scoreMeta = getScoreLabel(score);
  const lastInt = summary.lastDate;
  const daysSince = lastInt ? Math.floor((Date.now() - new Date(lastInt).getTime()) / 86400000) : null;
  const typeIcon = lastInteractionType === "email" ? "📧" : lastInteractionType === "whatsapp" ? "💬" : lastInteractionType === "call" ? "📞" : lastInteractionType === "meeting" ? "📅" : lastInteractionType ? "📝" : null;
  const typeLabels: Record<string, string> = { email: "emails", whatsapp: "WhatsApp", call: "ligações", meeting: "reuniões", note: "notas" };
  const tooltipParts = Object.entries(summary.typeCounts).map(([t, n]) => `${n} ${typeLabels[t] || t}`);
  const tooltipText = tooltipParts.length ? tooltipParts.join(", ") : undefined;
  const [waSendOpen, setWaSendOpen] = useState(false);

  return (
    <div key={contact.id}>
      <DeshContextMenu actions={[
        { id: "view", label: "Ver detalhes", icon: Eye, onClick: () => onSelect(contact.id) },
        { id: "edit", label: "Editar contato", icon: Edit3, onClick: () => { } },
        { id: "enrich", label: "Enriquecer com IA", icon: Sparkles, onClick: () => onAiEnrich(contact) },
        { id: "suggest", label: "Sugerir ação (IA)", icon: Lightbulb, onClick: () => { onSelect(contact.id); onAiSuggestAction(); } },
        { id: "whatsapp", label: "Enviar WhatsApp", icon: MessageCircle, onClick: () => onNavigate(`/messages?to=${contact.phone?.replace(/\D/g, "")}`), disabled: !contact.phone },
        { id: "whatsapp_business", label: "Enviar via WhatsApp Business", icon: Building2, onClick: () => setWaSendOpen(true), disabled: !contact.phone },
        { id: "email", label: "Enviar e-mail", icon: Mail, onClick: () => onNavigate(`/email?compose=true&to=${encodeURIComponent(contact.email || "")}`), disabled: !contact.email },
        { id: "copy_phone", label: "Copiar telefone", icon: Copy, onClick: () => { navigator.clipboard.writeText(contact.phone || ""); toast({ title: "Telefone copiado" }); }, disabled: !contact.phone },
        { id: "favorite", label: contact.favorited ? "Desfavoritar" : "Favoritar", icon: Star, onClick: () => onToggleFavorite(contact.id) },
        { id: "delete", label: "Excluir contato", icon: Trash2, destructive: true, dividerAfter: true, onClick: async () => {
          if (googleContactsConnected && (contact as any).google_resource_name) {
            await onSyncContactToGoogle("delete", { resourceName: (contact as any).google_resource_name });
          }
          await onDelete(contact.id);
        }}
      ]}>
        <div
          onClick={() => { if (selectMode) onToggleSelect(contact.id); else onSelect(isSelected ? "" : contact.id); }}
          className={`w-full text-left flex items-center gap-3 p-2.5 rounded-xl transition-colors cursor-pointer group relative ${
            isChecked ? "bg-primary/15" : isSelected ? "bg-primary/10" : "hover:bg-foreground/5"
          }`}>
          {selectMode ? (
            <div className="flex-shrink-0">
              {isChecked ? <CheckSquare className="w-5 h-5 text-primary" /> : <Square className="w-5 h-5 text-muted-foreground" />}
            </div>
          ) : (
            <div className="relative flex-shrink-0">
              {(() => { const pal = getAvatarPalette(contact.name); return (
              <div className={`w-9 h-9 rounded-full ${pal.bg} ${pal.text} ring-1 ${pal.ring} backdrop-blur-sm flex items-center justify-center text-xs font-bold`}>
                {contact.avatar_url
                  ? <img src={contact.avatar_url} className="w-9 h-9 rounded-full object-cover" alt={contact.name} referrerPolicy="no-referrer" />
                  : getInitials(contact.name)}
              </div>
              ); })()}
              <svg className="absolute inset-0 w-9 h-9 -rotate-90 pointer-events-none" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16" fill="none" strokeWidth="2.5" className="text-foreground/10" stroke="currentColor" />
                <circle cx="18" cy="18" r="16" fill="none" strokeWidth="2.5"
                  stroke={score >= 80 ? "hsl(var(--primary))" : score >= 55 ? "hsl(var(--primary))" : score >= 30 ? "hsl(38 92% 50%)" : "hsl(var(--muted-foreground))"}
                  strokeOpacity={score > 0 ? 0.9 : 0.2}
                  strokeDasharray={`${(score / 100) * 100.53} 100.53`}
                  strokeLinecap="round"
                />
              </svg>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <p className="text-sm font-medium text-foreground truncate">{highlightMatch(contact.name, searchQuery)}</p>
              {contact.favorited && <Star className="w-2.5 h-2.5 fill-yellow-500 text-yellow-500 flex-shrink-0" />}
              {completeness < 50 && <span className="text-[9px] bg-amber-500/15 text-amber-400 px-1 py-0.5 rounded-full flex-shrink-0" title={`${completeness}% completo`}>{completeness}%</span>}
              <WorkspaceBadge workspaceId={(contact as any).workspace_id} />
              {googleContactsConnected && <GoogleSyncBadge variant="synced" />}
            </div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-muted-foreground truncate">
                {searchQuery ? highlightMatch(`${contact.company}${contact.role ? ` • ${contact.role}` : ""}`, searchQuery) : `${contact.company}${contact.role ? ` • ${contact.role}` : ""}`}
              </p>
              {daysSince !== null && (
                <span className={`text-xs flex-shrink-0 flex items-center gap-0.5 ${daysSince > 30 ? "text-destructive/70" : daysSince > 14 ? "text-amber-500/70" : "text-muted-foreground"}`} title={tooltipText}>
                  {typeIcon && <span className="text-[10px]">{typeIcon}</span>}
                  {daysSince === 0 ? "hoje" : daysSince === 1 ? "ontem" : `${daysSince}d`}
                </span>
              )}
              {daysSince !== null && daysSince > 30 && (
                <span className="text-xs text-destructive flex-shrink-0" title={aiFollowup || "Follow-up sugerido"}>⚠️</span>
              )}
            </div>
          </div>
          {!selectMode && (
            <div className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <Sparkline contactId={contact.id} allInteractions={allInteractionsRaw} score={score} />
                <span className={`text-xs font-bold tabular-nums ${scoreMeta.color}`}>{score > 0 ? score : "—"}</span>
              </div>
              {contact.tags?.length ? (
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{contact.tags[0]}</span>
              ) : (
                <span className={`text-xs ${scoreMeta.color} opacity-70`}>{scoreMeta.label}</span>
              )}
            </div>
          )}
          {!selectMode && (() => {
            const cPhone = contact.phone || contact.phones?.[0]?.number || "";
            const cEmail = contact.email || contact.emails?.[0]?.email || "";
            const cAddr = contact.addresses?.[0];
            const fullAddr = cAddr ? [cAddr.street, cAddr.city, cAddr.state, cAddr.country].filter(Boolean).join(", ") : "";
            return (
              <div className="hidden md:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                {cPhone && (
                  <a href={`tel:${cPhone}`} onClick={e => e.stopPropagation()} className="p-1.5 rounded-lg hover:bg-foreground/10 text-muted-foreground hover:text-primary transition-colors" title="Ligar">
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                )}
                {cPhone && (
                  <button onClick={e => { e.stopPropagation(); onNavigate(`/messages?to=${cPhone.replace(/\D/g, "")}`); }} className="p-1.5 rounded-lg hover:bg-foreground/10 text-muted-foreground hover:text-green-500 transition-colors" title="WhatsApp">
                    <MessageCircle className="w-3.5 h-3.5" />
                  </button>
                )}
                {cEmail && (
                  <button onClick={e => { e.stopPropagation(); onNavigate(`/email?compose=true&to=${encodeURIComponent(cEmail)}`); }} className="p-1.5 rounded-lg hover:bg-foreground/10 text-muted-foreground hover:text-primary transition-colors" title="E-mail">
                    <Mail className="w-3.5 h-3.5" />
                  </button>
                )}
                {fullAddr && (
                  <button onClick={e => { e.stopPropagation(); window.location.href = `/map?search=${encodeURIComponent(fullAddr)}`; }} className="p-1.5 rounded-lg hover:bg-foreground/10 text-muted-foreground hover:text-primary transition-colors" title="Mapa">
                    <MapPin className="w-3.5 h-3.5" />
                  </button>
                )}
                {contact.website && (
                  <a href={contact.website.startsWith("http") ? contact.website : `https://${contact.website}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="p-1.5 rounded-lg hover:bg-foreground/10 text-muted-foreground hover:text-primary transition-colors" title="Website">
                    <Globe className="w-3.5 h-3.5" />
                  </a>
                )}
                <button onClick={e => { e.stopPropagation(); onNavigate(`/calendar?new=true&with=${encodeURIComponent(contact.name)}`); }} className="p-1.5 rounded-lg hover:bg-foreground/10 text-muted-foreground hover:text-primary transition-colors" title="Agendar">
                  <Calendar className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })()}
          <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform duration-200 flex-shrink-0 ${isSelected ? "rotate-90" : ""}`} />
        </div>
      </DeshContextMenu>

      {/* Inline detail panel */}
      <AnimatePresence>
        {isSelected && selectedContact && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="ml-4 mr-1 mt-1 mb-3 p-3 rounded-xl border border-border/30 bg-foreground/[0.02]">
              <Suspense fallback={<div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>}><ContactDetailPanel
                contact={selectedContact}
                interactions={interactions}
                loadingInteractions={loadingInteractions}
                interactionSummary={interactionSummary}
                allInteractionsRaw={allInteractionsRaw}
                aiLoading={aiLoading}
                aiNextAction={aiNextAction}
                googleConnected={googleContactsConnected}
                onUpdate={onUpdateContact}
                onDelete={onDelete}
                onToggleFavorite={onToggleFavorite}
                onAddInteraction={onAddInteraction}
                onDeleteInteraction={onDeleteInteraction}
                onClose={() => onSelect("")}
                onAiEnrich={onAiEnrich}
                onAiSuggestAction={onAiSuggestAction}
                onAiSummarize={onAiSummarize}
                onSetAiNextAction={onSetAiNextAction}
                onExport={onExport}
                onConfirmDelete={onConfirmDelete}
                computeScore={computeRelationshipScore}
                getScoreLabel={getScoreLabel}
                computeScoreComponents={computeScoreComponents}
              /></Suspense>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SendWhatsAppDialog
        open={waSendOpen}
        onOpenChange={setWaSendOpen}
        defaultTo={contact.phone ?? ""}
        contactId={contact.id}
        recipientLabel={contact.name}
      />
    </div>
  );
});

ContactRow.displayName = "ContactRow";
