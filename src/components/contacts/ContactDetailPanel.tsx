import { useState } from "react";
import { computeCompleteness } from "@/lib/contactScoring";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import {
  Phone, Mail, Building2, X, Star, Trash2, Edit3, Save, Tag,
  Sparkles, Loader2, Plus, Globe, MapPin, Calendar, Linkedin,
  Instagram, Github, Twitter, FileText, Clock, Lightbulb,
  Heart, BarChart3, Download, ImageIcon, Briefcase, Users2,
  Factory, ChevronDown, MessageCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { DbContact, DbInteraction, ContactPhone, ContactEmail, ContactAddress, ContactSocialLinks } from "@/hooks/contacts/useDbContacts";
import MoveToWorkspace from "@/components/dashboard/MoveToWorkspace";
import GoogleSyncBadge from "@/components/dashboard/GoogleSyncBadge";
import { ContactMonthlyChart } from "@/components/dashboard/ContactMonthlyChart";
import { Sparkline } from "@/components/dashboard/ContactSparkline";

interface InteractionSummary {
  count: number;
  lastDate: string | null;
  typeCounts: Record<string, number>;
}

const interactionTypes: Record<string, { icon: any; label: string; color: string }> = {
  call: { icon: Phone, label: "Ligação", color: "text-green-400" },
  email: { icon: Mail, label: "E-mail", color: "text-primary" },
  meeting: { icon: Users2, label: "Reunião", color: "text-yellow-500" },
  note: { icon: FileText, label: "Nota", color: "text-muted-foreground" },
};

const socialIcons: Record<string, any> = {
  linkedin: Linkedin, twitter: Twitter, instagram: Instagram, github: Github, website: Globe, facebook: Globe,
};

const phoneLabelOptions = ["principal", "pessoal", "trabalho", "whatsapp", "outro"];
const emailLabelOptions = ["principal", "pessoal", "trabalho", "outro"];
const addressLabelOptions = ["residencial", "comercial", "outro"];

interface ContactDetailPanelProps {
  contact: DbContact;
  interactions: DbInteraction[];
  loadingInteractions: boolean;
  interactionSummary: InteractionSummary;
  allInteractionsRaw: { contact_id: string; interaction_date: string; type: string }[];
  aiLoading: string | null;
  aiNextAction: string | null;
  googleConnected: boolean;
  onUpdate: (id: string, updates: Partial<DbContact>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleFavorite: (id: string) => Promise<void>;
  onAddInteraction: (i: Partial<DbInteraction>) => Promise<DbInteraction | undefined>;
  onDeleteInteraction: (id: string) => Promise<void>;
  onClose: () => void;
  onAiEnrich: (c: DbContact) => void;
  onAiSuggestAction: () => void;
  onAiSummarize: () => void;
  onSetAiNextAction: (v: string | null) => void;
  onExport: () => void;
  onConfirmDelete: () => void;
  computeScore: (s: InteractionSummary) => number;
  getScoreLabel: (score: number) => { label: string; color: string; bg: string };
  computeScoreComponents: (s: InteractionSummary) => { freq: number; recency: number; diversity: number };
}

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
};

// computeCompleteness imported from shared module

const inputCls = "w-full bg-foreground/5 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none border border-border/30 focus:border-primary/50 transition-colors";
const smallInputCls = "flex-1 bg-foreground/5 rounded-xl px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none border border-border/30 focus:border-primary/50 transition-colors";

const ContactDetailPanel = ({
  contact, interactions, loadingInteractions, interactionSummary, allInteractionsRaw,
  aiLoading, aiNextAction, googleConnected,
  onUpdate, onDelete, onToggleFavorite, onAddInteraction, onDeleteInteraction,
  onClose, onAiEnrich, onAiSuggestAction, onAiSummarize, onSetAiNextAction, onExport, onConfirmDelete,
  computeScore, getScoreLabel, computeScoreComponents,
}: ContactDetailPanelProps) => {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<DbContact>>({});
  const [tagInput, setTagInput] = useState("");
  const [showAddInteraction, setShowAddInteraction] = useState(false);
  const [intType, setIntType] = useState("note");
  const [intTitle, setIntTitle] = useState("");
  const [intDesc, setIntDesc] = useState("");
  const [showCompanySection, setShowCompanySection] = useState(false);
  const [showSocialSection, setShowSocialSection] = useState(false);
  const [showAddressSection, setShowAddressSection] = useState(false);

  const startEdit = () => {
    setEditing(true);
    setEditData({
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      role: contact.role,
      notes: contact.notes,
      website: contact.website,
      birthday: contact.birthday,
      contact_type: contact.contact_type,
      phones: [...(contact.phones || [])],
      emails: [...(contact.emails || [])],
      addresses: [...(contact.addresses || [])],
      social_links: { ...(contact.social_links || {}) },
      company_description: contact.company_description,
      company_industry: contact.company_industry,
      company_size: contact.company_size,
      avatar_url: contact.avatar_url,
      company_logo_url: contact.company_logo_url,
    });
  };

  const saveEdit = async () => {
    await onUpdate(contact.id, editData);
    setEditing(false);
  };

  const handleAddTag = async () => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag) return;
    const newTags = [...new Set([...(contact.tags || []), tag])];
    await onUpdate(contact.id, { tags: newTags });
    setTagInput("");
  };

  const removeTag = async (tag: string) => {
    await onUpdate(contact.id, { tags: (contact.tags || []).filter(t => t !== tag) });
  };

  const handleAddInteraction = async () => {
    if (!intTitle.trim()) return;
    const result = await onAddInteraction({
      contact_id: contact.id, type: intType, title: intTitle.trim(), description: intDesc.trim(),
    });
    if (result) {
      setIntTitle(""); setIntDesc(""); setShowAddInteraction(false);
    }
  };

  // Multi-value helpers for edit mode
  const addPhone = () => {
    const phones = [...(editData.phones || []), { number: "", label: "principal", is_primary: false }];
    setEditData(d => ({ ...d, phones }));
  };
  const updatePhone = (idx: number, field: keyof ContactPhone, value: any) => {
    const phones = [...(editData.phones || [])];
    (phones[idx] as any)[field] = value;
    setEditData(d => ({ ...d, phones }));
  };
  const removePhone = (idx: number) => {
    setEditData(d => ({ ...d, phones: (d.phones || []).filter((_, i) => i !== idx) }));
  };

  const addEmail = () => {
    const emails = [...(editData.emails || []), { email: "", label: "principal", is_primary: false }];
    setEditData(d => ({ ...d, emails }));
  };
  const updateEmail = (idx: number, field: keyof ContactEmail, value: any) => {
    const emails = [...(editData.emails || [])];
    (emails[idx] as any)[field] = value;
    setEditData(d => ({ ...d, emails }));
  };
  const removeEmail = (idx: number) => {
    setEditData(d => ({ ...d, emails: (d.emails || []).filter((_, i) => i !== idx) }));
  };

  const addAddress = () => {
    const addresses = [...(editData.addresses || []), { street: "", city: "", state: "", zip: "", country: "", label: "residencial" }];
    setEditData(d => ({ ...d, addresses }));
  };
  const updateAddress = (idx: number, field: keyof ContactAddress, value: string) => {
    const addresses = [...(editData.addresses || [])];
    (addresses[idx] as any)[field] = value;
    setEditData(d => ({ ...d, addresses }));
  };
  const removeAddress = (idx: number) => {
    setEditData(d => ({ ...d, addresses: (d.addresses || []).filter((_, i) => i !== idx) }));
  };

  const updateSocial = (key: string, value: string) => {
    setEditData(d => ({ ...d, social_links: { ...(d.social_links || {}), [key]: value } }));
  };

  const score = computeScore(interactionSummary);
  const meta = getScoreLabel(score);
  const daysSince = interactionSummary.lastDate ? Math.floor((Date.now() - new Date(interactionSummary.lastDate).getTime()) / 86400000) : null;
  const components = computeScoreComponents(interactionSummary);

  const phones = contact.phones?.length ? contact.phones : (contact.phone ? [{ number: contact.phone, label: "principal", is_primary: true }] : []);
  const emails = contact.emails?.length ? contact.emails : (contact.email ? [{ email: contact.email, label: "principal", is_primary: true }] : []);
  const addresses = contact.addresses || [];
  const socialLinks = contact.social_links || {};
  const hasSocials = Object.values(socialLinks).some(v => v && v.trim());
  const hasCompanyData = contact.company_description || contact.company_industry || contact.company_size || contact.company_logo_url;
  const isCompany = contact.contact_type === "company";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            {contact.avatar_url ? (
              <img src={contact.avatar_url} alt={contact.name} className="w-14 h-14 rounded-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className={`w-14 h-14 rounded-full ${isCompany ? "bg-accent/20 text-accent-foreground" : "bg-primary/20 text-primary"} flex items-center justify-center text-lg font-bold`}>
                {isCompany ? <Building2 className="w-6 h-6" /> : getInitials(contact.name)}
              </div>
            )}
            {contact.company_logo_url && isCompany && (
              <img src={contact.company_logo_url} alt="Logo" className="w-5 h-5 rounded-full absolute -bottom-0.5 -right-0.5 border-2 border-background object-cover" />
            )}
          </div>
          <div>
            {editing ? (
              <>
                <input value={editData.name || ""} onChange={e => setEditData({ ...editData, name: e.target.value })}
                  className="text-lg font-semibold text-foreground bg-transparent outline-none border-b border-primary/30 w-full" />
                <div className="flex items-center gap-2 mt-1">
                  <select value={editData.contact_type || "person"} onChange={e => setEditData({ ...editData, contact_type: e.target.value })}
                    className="bg-foreground/5 rounded-lg px-2 py-0.5 text-xs text-foreground outline-none border border-border/30">
                    <option value="person">Pessoa</option>
                    <option value="company">Empresa</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-foreground">{contact.name}</h2>
                  {isCompany && <span className="text-xs bg-accent/20 text-accent-foreground px-1.5 py-0.5 rounded-full">Empresa</span>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {contact.role}{contact.company ? ` @ ${contact.company}` : ""}
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onToggleFavorite(contact.id)} className="p-1.5 rounded-xl hover:bg-foreground/10" aria-label="Favoritar">
            <Star className={`w-4 h-4 ${contact.favorited ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"}`} />
          </button>
          <button onClick={() => onAiEnrich(contact)} disabled={!!aiLoading} className="p-1.5 rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary disabled:opacity-50" title="IA Enriquecer">
            {aiLoading === `enrich-${contact.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          </button>
          <button onClick={onExport} className="p-1.5 rounded-xl hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors" title="Exportar">
            <Download className="w-4 h-4" />
          </button>
          {editing ? (
            <>
              <button onClick={saveEdit} className="p-1.5 rounded-xl hover:bg-primary/10 text-primary"><Save className="w-4 h-4" /></button>
              <button onClick={() => setEditing(false)} className="p-1.5 rounded-xl hover:bg-foreground/10 text-muted-foreground"><X className="w-4 h-4" /></button>
            </>
          ) : (
            <button onClick={startEdit} className="p-1.5 rounded-xl hover:bg-foreground/10 text-muted-foreground"><Edit3 className="w-4 h-4" /></button>
          )}
          <MoveToWorkspace table="contacts" itemId={contact.id} currentWorkspaceId={(contact as any).workspace_id} size="sm" />
          <button onClick={onConfirmDelete} className="p-1.5 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-foreground/10 text-muted-foreground md:hidden"><X className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Quick Actions */}
      {(() => {
        const qPhone = phones[0]?.number || "";
        const qEmail = emails[0]?.email || "";
        const qAddr = addresses[0];
        const fullAddr = qAddr ? [qAddr.street, qAddr.city, qAddr.state, qAddr.country].filter(Boolean).join(", ") : "";
        const qWebsite = contact.website || socialLinks.website || "";
        const hasAny = qPhone || qEmail || fullAddr || qWebsite;
        if (!hasAny && !contact.name) return null;
        const btnCls = "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors";
        return (
          <div className="flex flex-wrap gap-1.5">
            {qPhone && (
              <a href={`tel:${qPhone}`} className={`${btnCls} bg-foreground/5 text-muted-foreground hover:bg-primary/10 hover:text-primary`}>
                <Phone className="w-3.5 h-3.5" /> Ligar
              </a>
            )}
            {qPhone && (
              <button onClick={() => navigate(`/messages?to=${qPhone.replace(/\D/g, "")}`)} className={`${btnCls} bg-foreground/5 text-muted-foreground hover:bg-green-500/10 hover:text-green-500`}>
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </button>
            )}
            {qEmail && (
              <button onClick={() => navigate(`/email?compose=true&to=${encodeURIComponent(qEmail)}`)} className={`${btnCls} bg-foreground/5 text-muted-foreground hover:bg-primary/10 hover:text-primary`}>
                <Mail className="w-3.5 h-3.5" /> Email
              </button>
            )}
            {fullAddr && (
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddr)}`} target="_blank" rel="noopener noreferrer" className={`${btnCls} bg-foreground/5 text-muted-foreground hover:bg-primary/10 hover:text-primary`}>
                <MapPin className="w-3.5 h-3.5" /> Mapa
              </a>
            )}
            {qWebsite && (
              <a href={qWebsite.startsWith("http") ? qWebsite : `https://${qWebsite}`} target="_blank" rel="noopener noreferrer" className={`${btnCls} bg-foreground/5 text-muted-foreground hover:bg-primary/10 hover:text-primary`}>
                <Globe className="w-3.5 h-3.5" /> Website
              </a>
            )}
            <button onClick={() => navigate(`/calendar?new=true&with=${encodeURIComponent(contact.name)}`)} className={`${btnCls} bg-foreground/5 text-muted-foreground hover:bg-primary/10 hover:text-primary`}>
              <Calendar className="w-3.5 h-3.5" /> Agendar
            </button>
          </div>
        );
      })()}

      <div className="p-3 rounded-xl bg-foreground/5 border border-border/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Heart className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Score de Relacionamento</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
              score >= 80 ? "bg-green-500/15 text-green-400 border-green-400/20"
              : score >= 55 ? "bg-primary/15 text-primary border-primary/20"
              : score >= 30 ? "bg-amber-500/15 text-amber-400 border-amber-400/20"
              : "bg-foreground/8 text-muted-foreground border-border/30"
            }`}>{meta.label}</span>
            <span className={`text-base font-bold tabular-nums ${meta.color}`}>{score}</span>
          </div>
        </div>
        <div className="h-2 bg-foreground/10 rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 0.7 }} className={`h-full rounded-full ${meta.bg}`} />
        </div>
        <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
          <span>{interactionSummary.count} interação{interactionSummary.count !== 1 ? "ões" : ""}</span>
          {daysSince !== null && (
            <span className={daysSince > 30 ? "text-destructive" : daysSince > 14 ? "text-amber-400" : "text-muted-foreground"}>
              Última: {daysSince === 0 ? "hoje" : daysSince === 1 ? "ontem" : `há ${daysSince}d`}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span>Frequência <span className="text-foreground font-medium">{components.freq}/40</span></span>
            <span>Recência <span className="text-foreground font-medium">{components.recency}/40</span></span>
            <span>Diversidade <span className="text-foreground font-medium">{components.diversity}/20</span></span>
          </div>
          <button onClick={onAiSuggestAction} disabled={!!aiLoading}
            className="flex items-center gap-1 px-2 py-1 rounded-xl bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50">
            {aiLoading === "next-action" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3" />}
            Próxima ação
          </button>
        </div>
      </div>

      {/* Completeness indicator */}
      {(() => {
        const { pct, missing } = computeCompleteness(contact);
        if (pct >= 100) return null;
        return (
          <div className="p-3 rounded-xl bg-foreground/5 border border-border/30">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Completude do perfil</span>
              <span className={`text-xs font-bold tabular-nums ${pct >= 80 ? "text-green-400" : pct >= 50 ? "text-primary" : "text-amber-400"}`}>{pct}%</span>
            </div>
            <div className="h-1.5 bg-foreground/10 rounded-full overflow-hidden mb-2">
              <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} className={`h-full rounded-full ${pct >= 80 ? "bg-green-400" : pct >= 50 ? "bg-primary" : "bg-amber-400"}`} />
            </div>
            {missing.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Faltando: {missing.slice(0, 4).join(", ")}{missing.length > 4 ? ` +${missing.length - 4}` : ""}
              </p>
            )}
          </div>
        );
      })()}

      {/* AI Suggestion */}
      <AnimatePresence>
        {aiNextAction && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs uppercase tracking-wider text-primary font-medium">Sugestão IA</span>
                <button onClick={() => onSetAiNextAction(null)} className="ml-auto text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed">{aiNextAction}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Contact Info (Phones, Emails, etc.) ── */}
      {editing ? (
        <div className="space-y-4">
          {/* Avatar URL */}
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1 flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Foto de perfil (URL)</label>
            <input value={editData.avatar_url || ""} onChange={e => setEditData({ ...editData, avatar_url: e.target.value || null })} placeholder="https://..." className={inputCls} />
          </div>

          {/* Company & Role */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Empresa</label>
              <input value={editData.company || ""} onChange={e => setEditData({ ...editData, company: e.target.value })} placeholder="Empresa" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Cargo</label>
              <input value={editData.role || ""} onChange={e => setEditData({ ...editData, role: e.target.value })} placeholder="Cargo" className={inputCls} />
            </div>
          </div>

          {/* Phones */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1"><Phone className="w-3 h-3" /> Telefones</label>
              <button onClick={addPhone} className="text-primary text-xs flex items-center gap-0.5 hover:underline"><Plus className="w-3 h-3" /> Adicionar</button>
            </div>
            <div className="space-y-1.5">
              {(editData.phones || []).map((p, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input value={p.number} onChange={e => updatePhone(i, "number", e.target.value)} placeholder="Número" className={smallInputCls} />
                  <select value={p.label} onChange={e => updatePhone(i, "label", e.target.value)} className="bg-foreground/5 rounded-lg px-2 py-1.5 text-xs text-foreground outline-none border border-border/30 w-24">
                    {phoneLabelOptions.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <button onClick={() => removePhone(i)} className="text-muted-foreground hover:text-destructive p-1"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Emails */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1"><Mail className="w-3 h-3" /> E-mails</label>
              <button onClick={addEmail} className="text-primary text-xs flex items-center gap-0.5 hover:underline"><Plus className="w-3 h-3" /> Adicionar</button>
            </div>
            <div className="space-y-1.5">
              {(editData.emails || []).map((e, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input value={e.email} onChange={ev => updateEmail(i, "email", ev.target.value)} placeholder="E-mail" className={smallInputCls} />
                  <select value={e.label} onChange={ev => updateEmail(i, "label", ev.target.value)} className="bg-foreground/5 rounded-lg px-2 py-1.5 text-xs text-foreground outline-none border border-border/30 w-24">
                    {emailLabelOptions.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <button onClick={() => removeEmail(i)} className="text-muted-foreground hover:text-destructive p-1"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Addresses */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1"><MapPin className="w-3 h-3" /> Endereços</label>
              <button onClick={addAddress} className="text-primary text-xs flex items-center gap-0.5 hover:underline"><Plus className="w-3 h-3" /> Adicionar</button>
            </div>
            <div className="space-y-2">
              {(editData.addresses || []).map((a, i) => (
                <div key={i} className="p-2 rounded-xl bg-foreground/5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <select value={a.label} onChange={e => updateAddress(i, "label", e.target.value)} className="bg-background/50 rounded-lg px-2 py-1 text-xs outline-none border border-border/30 w-28">
                      {addressLabelOptions.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <button onClick={() => removeAddress(i)} className="text-muted-foreground hover:text-destructive p-1"><X className="w-3 h-3" /></button>
                  </div>
                  <AddressAutocomplete
                    value={a.street || ""}
                    onChange={val => updateAddress(i, "street", val)}
                    onSelect={result => updateAddress(i, "street", result.address)}
                    placeholder="Buscar endereço..."
                    className={smallInputCls + " pl-8"}
                  />
                  <div className="grid grid-cols-3 gap-1.5">
                    <input value={a.city || ""} onChange={e => updateAddress(i, "city", e.target.value)} placeholder="Cidade" className={smallInputCls} />
                    <input value={a.state || ""} onChange={e => updateAddress(i, "state", e.target.value)} placeholder="Estado" className={smallInputCls} />
                    <input value={a.zip || ""} onChange={e => updateAddress(i, "zip", e.target.value)} placeholder="CEP" className={smallInputCls} />
                  </div>
                  <input value={a.country || ""} onChange={e => updateAddress(i, "country", e.target.value)} placeholder="País" className={smallInputCls} />
                </div>
              ))}
            </div>
          </div>

          {/* Social Links */}
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1 flex items-center gap-1"><Globe className="w-3 h-3" /> Redes sociais</label>
            <div className="space-y-1.5">
              {["linkedin", "twitter", "instagram", "github", "facebook"].map(key => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground w-20 capitalize">{key}</span>
                  <input value={(editData.social_links as any)?.[key] || ""} onChange={e => updateSocial(key, e.target.value)} placeholder={`URL do ${key}`} className={smallInputCls} />
                </div>
              ))}
            </div>
          </div>

          {/* Website & Birthday */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Globe className="w-3 h-3" /> Website</label>
              <input value={editData.website || ""} onChange={e => setEditData({ ...editData, website: e.target.value })} placeholder="https://..." className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Aniversário</label>
              <input type="date" value={editData.birthday || ""} onChange={e => setEditData({ ...editData, birthday: e.target.value || null })} className={inputCls} />
            </div>
          </div>

          {/* Company data (if company type) */}
          {(editData.contact_type === "company" || editData.company) && (
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1 flex items-center gap-1"><Factory className="w-3 h-3" /> Dados da empresa</label>
              <div className="space-y-1.5">
                <input value={editData.company_logo_url || ""} onChange={e => setEditData({ ...editData, company_logo_url: e.target.value || null })} placeholder="Logo URL" className={inputCls} />
                <input value={editData.company_industry || ""} onChange={e => setEditData({ ...editData, company_industry: e.target.value })} placeholder="Setor / Indústria" className={inputCls} />
                <div className="grid grid-cols-2 gap-1.5">
                  <select value={editData.company_size || ""} onChange={e => setEditData({ ...editData, company_size: e.target.value })} className={inputCls}>
                    <option value="">Porte</option>
                    <option value="1-10">1-10</option>
                    <option value="11-50">11-50</option>
                    <option value="51-200">51-200</option>
                    <option value="201-500">201-500</option>
                    <option value="501-1000">501-1000</option>
                    <option value="1001+">1001+</option>
                  </select>
                </div>
                <textarea value={editData.company_description || ""} onChange={e => setEditData({ ...editData, company_description: e.target.value })} placeholder="Descrição da empresa" rows={2} className={inputCls + " resize-none"} />
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Notas</label>
            <textarea value={editData.notes || ""} onChange={e => setEditData({ ...editData, notes: e.target.value })} placeholder="Notas..." rows={2} className={inputCls + " resize-none"} />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Phones */}
          {phones.length > 0 && (
            <div className="space-y-1">
              {phones.map((p, i) => (
                <a key={i} href={`tel:${p.number}`} className="flex items-center gap-2 p-2.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-colors">
                  <Phone className="w-4 h-4 text-primary/70" />
                  <span className="text-sm text-foreground">{p.number}</span>
                  <span className="text-xs text-muted-foreground bg-foreground/5 px-1.5 py-0.5 rounded-full">{p.label}</span>
                </a>
              ))}
            </div>
          )}

          {/* Emails */}
          {emails.length > 0 && (
            <div className="space-y-1">
              {emails.map((e, i) => (
                <a key={i} href={`mailto:${e.email}`} className="flex items-center gap-2 p-2.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-colors">
                  <Mail className="w-4 h-4 text-primary/70" />
                  <span className="text-sm text-foreground truncate">{e.email}</span>
                  <span className="text-xs text-muted-foreground bg-foreground/5 px-1.5 py-0.5 rounded-full">{e.label}</span>
                </a>
              ))}
            </div>
          )}

          {/* Company info */}
          {contact.company && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-foreground/5">
              <Building2 className="w-4 h-4 text-primary/70" />
              <span className="text-sm text-foreground">{contact.company}</span>
              {contact.role && <span className="text-xs text-muted-foreground">• {contact.role}</span>}
            </div>
          )}

          {/* Website */}
          {contact.website && (
            <a href={contact.website.startsWith("http") ? contact.website : `https://${contact.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-colors">
              <Globe className="w-4 h-4 text-primary/70" />
              <span className="text-sm text-foreground truncate">{contact.website}</span>
            </a>
          )}

          {/* Birthday */}
          {contact.birthday && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-foreground/5">
              <Calendar className="w-4 h-4 text-primary/70" />
              <span className="text-sm text-foreground">{new Date(contact.birthday + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</span>
            </div>
          )}

          {/* Addresses */}
          {addresses.length > 0 && (
            <div className="space-y-1">
              {addresses.map((a, i) => (
                <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-foreground/5">
                  <MapPin className="w-4 h-4 text-primary/70 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-foreground">{[a.street, a.city, a.state, a.zip, a.country].filter(Boolean).join(", ")}</p>
                    <span className="text-xs text-muted-foreground">{a.label}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Social Links */}
          {hasSocials && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(socialLinks).filter(([, v]) => v && v.trim()).map(([key, url]) => {
                const Icon = socialIcons[key] || Globe;
                return (
                  <a key={key} href={url!.startsWith("http") ? url! : `https://${url}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-colors text-xs text-foreground">
                    <Icon className="w-3.5 h-3.5 text-primary/70" />
                    <span className="capitalize">{key}</span>
                  </a>
                );
              })}
            </div>
          )}

          {/* Company details */}
          {hasCompanyData && (
            <div className="p-3 rounded-xl bg-foreground/5 border border-border/30 space-y-2">
              <div className="flex items-center gap-2">
                {contact.company_logo_url && <img src={contact.company_logo_url} alt="Logo" className="w-8 h-8 rounded-lg object-cover" />}
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1"><Factory className="w-3 h-3" /> Dados da empresa</p>
                </div>
              </div>
              {contact.company_industry && <p className="text-xs text-foreground"><span className="text-muted-foreground">Setor:</span> {contact.company_industry}</p>}
              {contact.company_size && <p className="text-xs text-foreground"><span className="text-muted-foreground">Porte:</span> {contact.company_size} funcionários</p>}
              {contact.company_description && <p className="text-xs text-foreground/80">{contact.company_description}</p>}
            </div>
          )}

          {/* Notes */}
          {contact.notes && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-foreground/5">
              <FileText className="w-4 h-4 text-primary/70 mt-0.5" />
              <span className="text-sm text-foreground">{contact.notes}</span>
            </div>
          )}
        </div>
      )}

      {/* Monthly chart */}
      {allInteractionsRaw.some(r => r.contact_id === contact.id) && (
        <div className="p-3 rounded-xl bg-foreground/5 border border-border/30">
          <div className="flex items-center gap-1.5 mb-3">
            <BarChart3 className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Evolução Mensal — últimos 6 meses</span>
          </div>
          <ContactMonthlyChart contactId={contact.id} allInteractions={allInteractionsRaw} months={6} />
        </div>
      )}

      {/* Tags */}
      <div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {contact.tags?.map(tag => (
            <span key={tag} className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {tag}
              <button onClick={() => removeTag(tag)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input value={tagInput} onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
            placeholder="Adicionar tag..." className="flex-1 bg-foreground/5 rounded-xl px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none border border-border/30 focus:border-primary/50 transition-colors" />
          <button onClick={handleAddTag} className="p-1.5 rounded-xl bg-foreground/5 text-muted-foreground hover:text-foreground"><Tag className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Interactions Timeline */}
      <div className="border-t border-border/30 pt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-foreground">Histórico de Interações</p>
          <div className="flex items-center gap-1">
            {interactions.length > 0 && (
              <button onClick={onAiSummarize} disabled={!!aiLoading}
                className="flex items-center gap-1 px-2 py-1 rounded-xl bg-primary/10 text-primary text-xs hover:bg-primary/20 disabled:opacity-50">
                {aiLoading === "summarize" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Resumir
              </button>
            )}
            <button onClick={() => setShowAddInteraction(!showAddInteraction)}
              className="p-1.5 rounded-xl text-primary hover:bg-primary/10">
              {showAddInteraction ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showAddInteraction && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="p-3 rounded-xl bg-foreground/5 mb-3 space-y-2">
                <div className="flex gap-1">
                  {Object.entries(interactionTypes).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <button key={key} onClick={() => setIntType(key)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs transition-colors ${intType === key ? "bg-primary/20 text-primary" : "bg-foreground/5 text-muted-foreground"}`}>
                        <Icon className="w-3.5 h-3.5" /> {cfg.label}
                      </button>
                    );
                  })}
                </div>
                <input value={intTitle} onChange={e => setIntTitle(e.target.value)} placeholder="Título *" className={inputCls} autoFocus />
                <textarea value={intDesc} onChange={e => setIntDesc(e.target.value)} placeholder="Detalhes..." rows={2} className={inputCls + " resize-none text-xs"} />
                <button onClick={handleAddInteraction} disabled={!intTitle.trim()}
                  className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">Registrar</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loadingInteractions ? (
          <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
        ) : interactions.length > 0 ? (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {interactions.map(int => {
              const cfg = interactionTypes[int.type] || interactionTypes.note;
              const Icon = cfg.icon;
              return (
                <div key={int.id} className="flex items-start gap-2 group p-2 rounded-xl hover:bg-foreground/5">
                  <div className={`p-1.5 rounded-xl bg-foreground/5 ${cfg.color} mt-0.5`}><Icon className="w-3.5 h-3.5" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{int.title}</p>
                    {int.description && <p className="text-xs text-muted-foreground mt-0.5">{int.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(int.interaction_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <button onClick={() => onDeleteInteraction(int.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1.5">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhuma interação registrada</p>
        )}
      </div>
    </div>
  );
};

export default ContactDetailPanel;
