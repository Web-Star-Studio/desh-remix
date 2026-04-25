import React, { useMemo } from "react";
import DeshTooltip from "@/components/ui/DeshTooltip";
import GlassCard from "./GlassCard";
import WidgetEmptyState from "./WidgetEmptyState";
import WidgetTitle from "./WidgetTitle";
import ConnectionBadge from "./ConnectionBadge";
import { Users, Phone, Mail, Star, ExternalLink, Building2, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDbContacts } from "@/hooks/contacts/useDbContacts";
import type { DbContact } from "@/types/contacts";

/** Calculate a "completeness" score for ranking top contacts */
function contactScore(c: DbContact): number {
  let score = 0;
  if (c.phone) score += 1;
  if (c.email) score += 1;
  if (c.company) score += 1;
  if (c.role) score += 1;
  if (c.notes) score += 1;
  if (c.tags?.length) score += c.tags.length;
  if (c.phones?.length) score += c.phones.length;
  if (c.emails?.length) score += c.emails.length;
  if (c.addresses?.length) score += c.addresses.length;
  if (c.website) score += 1;
  if (c.birthday) score += 1;
  const socialCount = c.social_links ? Object.values(c.social_links).filter(Boolean).length : 0;
  score += socialCount;
  return score;
}

/** Normalize raw score to 0-100 for display */
function normalizeScore(raw: number): number {
  // Max realistic raw score ~20 (all fields filled + several tags/phones/socials)
  return Math.min(100, Math.round((raw / 14) * 100));
}

function getScoreMeta(pct: number): { label: string; color: string; dotColor: string } {
  if (pct >= 80) return { label: "Forte", color: "text-green-400", dotColor: "bg-green-400" };
  if (pct >= 55) return { label: "Bom", color: "text-primary", dotColor: "bg-primary" };
  if (pct >= 30) return { label: "Médio", color: "text-amber-400", dotColor: "bg-amber-400" };
  return { label: "Baixo", color: "text-muted-foreground", dotColor: "bg-muted-foreground/60" };
}

const colors = ["bg-primary/30", "bg-accent/30", "bg-destructive/20", "bg-muted", "bg-primary/20", "bg-accent/20"];

const ContactAvatar = ({ contact, size = "sm" }: { contact: DbContact; size?: "sm" | "md" }) => {
  const initials = contact.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const idx = contact.name.charCodeAt(0) % colors.length;
  const dim = size === "md" ? "w-9 h-9 text-xs" : "w-7 h-7 text-[10px]";

  if (contact.avatar_url) {
    return <img src={contact.avatar_url} alt={contact.name} className={`${dim} rounded-full object-cover shrink-0`} referrerPolicy="no-referrer" />;
  }
  return (
    <div className={`${dim} rounded-full ${colors[idx]} flex items-center justify-center font-medium text-foreground/80 shrink-0`}>
      {initials}
    </div>
  );
};

const ContactRow = ({ contact, showScore, onToggleFav }: { contact: DbContact & { _score?: number }; showScore?: boolean; onToggleFav?: (id: string) => void }) => {
  const subtitle = contact.company || contact.role || contact.email || "";
  const rawScore = contact._score ?? contactScore(contact);
  const pct = normalizeScore(rawScore);
  const meta = getScoreMeta(pct);

  return (
    <div className="flex items-center gap-2 px-1.5 py-1.5 rounded-lg hover:bg-foreground/[0.04] transition-colors group">
      <div className="relative shrink-0">
        <ContactAvatar contact={contact} />
        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${meta.dotColor}`} title={`${meta.label} (${pct})`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-foreground truncate">{contact.name}</span>
          {contact.favorited && <Star className="w-2.5 h-2.5 fill-primary text-primary shrink-0" />}
        </div>
        {subtitle && (
          <span className="text-[10px] text-muted-foreground truncate block">
            {contact.company && <><Building2 className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />{subtitle}</>}
            {!contact.company && subtitle}
          </span>
        )}
      </div>
      {onToggleFav && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFav(contact.id); }}
          className="p-1 rounded hover:bg-foreground/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
          title={contact.favorited ? "Remover favorito" : "Favoritar"}
        >
          <Star className={`w-3 h-3 ${contact.favorited ? "fill-primary text-primary" : "text-muted-foreground hover:text-primary"}`} />
        </button>
      )}
      {showScore && (
        <span className={`text-[9px] font-semibold tabular-nums shrink-0 ${meta.color}`} title={`Score: ${pct}/100`}>
          {pct}
        </span>
      )}
    </div>
  );
};

const ContactsWidget = () => {
  const navigate = useNavigate();
  const { contacts: dbContacts, isLoading: dbLoading, toggleFavorite } = useDbContacts();

  const favorites = useMemo(() => dbContacts.filter(c => c.favorited).slice(0, 3), [dbContacts]);

  const topLinked = useMemo(() => {
    const scored = dbContacts.map(c => ({ ...c, _score: contactScore(c) }));
    scored.sort((a, b) => b._score - a._score);
    // Exclude already-shown favorites
    const favIds = new Set(favorites.map(f => f.id));
    return scored.filter(c => !favIds.has(c.id) && c._score > 0).slice(0, 5);
  }, [dbContacts, favorites]);

  const isConnected = dbContacts.length > 0;

  return (
    <GlassCard className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2">
          <WidgetTitle label="Contatos" icon={<Users className="w-3.5 h-3.5 text-purple-400" />} popupIcon={<Users className="w-5 h-5 text-primary" />} popupContent={
            isConnected ? (
              <div className="space-y-2">
                {dbContacts.slice(0, 12).map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-colors">
                    <ContactAvatar contact={c} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground flex items-center gap-1">{c.name} {c.favorited && <Star className="w-3 h-3 fill-primary text-primary" />}</p>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                        {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : undefined
          } />
          <ConnectionBadge isConnected={isConnected} isLoading={dbLoading} sourceNames={isConnected ? ["Local"] : undefined} />
        </div>
        <DeshTooltip label="Ver tudo">
          <button onClick={() => navigate("/contacts")} className="text-muted-foreground hover:text-primary transition-colors">
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </DeshTooltip>
      </div>

      {!isConnected && !dbLoading ? (
        <WidgetEmptyState icon={Users} title="Nenhum contato" description="Adicione contatos ao seu CRM" connectTo="/contacts" connectLabel="Ver contatos" />
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin space-y-2">
          {/* Favorites section */}
          {favorites.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1 px-1">
                <Star className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Favoritos</span>
              </div>
              {favorites.map(c => <ContactRow key={c.id} contact={c} onToggleFav={toggleFavorite} />)}
            </div>
          )}

          {/* Top linked section */}
          {topLinked.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1 px-1">
                <TrendingUp className="w-3 h-3 text-accent-foreground/60" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Top Vínculos</span>
              </div>
              {topLinked.map(c => <ContactRow key={c.id} contact={c} showScore onToggleFav={toggleFavorite} />)}
            </div>
          )}

          {/* Fallback if no favorites and no scored contacts */}
          {favorites.length === 0 && topLinked.length === 0 && dbContacts.length > 0 && (
            <div className="space-y-0.5">
              {dbContacts.slice(0, 5).map(c => <ContactRow key={c.id} contact={c} onToggleFav={toggleFavorite} />)}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      {isConnected && (
        <div className="mt-2 pt-1.5 border-t border-foreground/5 shrink-0">
          <button onClick={() => navigate("/contacts")} className="text-[11px] text-muted-foreground hover:text-primary transition-colors">
            {dbContacts.length} contatos · Ver todos →
          </button>
        </div>
      )}
    </GlassCard>
  );
};

export default React.memo(ContactsWidget);
