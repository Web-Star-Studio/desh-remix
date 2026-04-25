import React, { useState, useEffect } from "react";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { useAuth } from "@/contexts/AuthContext";
import PageLayout from "@/components/dashboard/PageLayout";
import PageHeader from "@/components/dashboard/PageHeader";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import GlassCard from "@/components/dashboard/GlassCard";
import { motion } from "framer-motion";
import {
  User, MapPin, Phone, Mail, CreditCard, Globe, Copy, Check, Pencil, Eye, EyeOff,
  BarChart3, Users, Share2, Coins, Sparkles, Zap, History, ArrowUp, ArrowDown,
  Target, TrendingUp, Flame, Trophy, ListTodo, FolderOpen, Shield, Plus, Cake, X,
} from "lucide-react";
import ProfileDocumentsSection from "@/components/profile/ProfileDocumentsSection";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useFriends } from "@/hooks/contacts/useFriends";
import { useAnalytics } from "@/hooks/admin/useAnalytics";
import { useSubscription } from "@/hooks/admin/useSubscription";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

import { toLabeledArray, type LabeledEntry } from "@/lib/profileUtils";
import { MONTHLY_CREDITS } from "@/constants/credits";

const CHART_COLORS = [
  "hsl(var(--primary))", "hsl(var(--accent))", "hsl(220, 60%, 55%)",
  "hsl(140, 50%, 50%)", "hsl(0, 60%, 55%)", "hsl(280, 50%, 55%)",
  "hsl(35, 80%, 50%)", "hsl(180, 50%, 45%)",
];

const STATUS_LABELS: Record<string, string> = { todo: "A fazer", in_progress: "Em progresso", done: "Concluída" };
const PRIORITY_LABELS: Record<string, string> = { low: "Baixa", medium: "Média", high: "Alta" };
type MainTab = "perfil" | "faturamento" | "compartilhamento" | "relatorios";

interface ProfileData {
  name: string; email: string; phone: string; location: string;
  cpf: string; rg: string; passport: string; birthday: string; website: string;
  emails: LabeledEntry[]; phones: LabeledEntry[]; locations: LabeledEntry[]; websites: LabeledEntry[];
}

const ProfilePage = () => {
  const { user, profile: authProfile, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<MainTab>("perfil");

  const tabs: { id: MainTab; label: string; icon: React.ElementType }[] = [
    { id: "perfil", label: "Perfil", icon: User },
    { id: "faturamento", label: "Faturamento", icon: Coins },
    { id: "compartilhamento", label: "Compartilhamento", icon: Share2 },
    { id: "relatorios", label: "Relatórios", icon: BarChart3 },
  ];

  return (
    <PageLayout maxWidth="full">
      <PageHeader
        title="Meu Perfil"
        icon={<User className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" />}
      />

      <div className="flex gap-1 mb-4 sm:mb-6 p-1.5 rounded-xl bg-black/20 backdrop-blur-sm overflow-x-auto w-fit max-w-full">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap touch-target ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden xs:inline sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {activeTab === "perfil" && <ProfileTab user={user} authProfile={authProfile} updateProfile={updateProfile} />}
        {activeTab === "faturamento" && <BillingUserTab />}
        {activeTab === "compartilhamento" && <SharingTab />}
        {activeTab === "relatorios" && <RelatoriosTab />}
      </motion.div>
    </PageLayout>
  );
};

// ─── Sensitive fields ─────────────────────────────────────────────────────────
const SENSITIVE_FIELDS = new Set<string>(["cpf", "rg", "passport"]);

// Multi-value capable fields
const MULTI_FIELDS = new Set<string>(["email", "phone", "location", "website"]);
const MULTI_KEY_MAP: Record<string, keyof ProfileData> = {
  email: "emails", phone: "phones", location: "locations", website: "websites",
};

function maskSensitive(value: string): string {
  if (!value || value.length <= 3) return "•••";
  const visible = Math.min(3, Math.floor(value.length * 0.25));
  return "•".repeat(value.length - visible) + value.slice(-visible);
}

// ─── Single-value Profile Field (stable, outside ProfileTab) ──────────────────
const ProfileField = ({ label, value, field, icon: Icon, isSensitive = false, editing, draftValue, onDraftChange, onStartEdit, isRevealed, onToggleReveal, copied, onCopy }: {
  label: string; value: string; field: string; icon: any; isSensitive?: boolean;
  editing: boolean; draftValue: string; onDraftChange: (field: string, val: string) => void;
  onStartEdit: () => void; isRevealed: boolean; onToggleReveal: (field: string) => void;
  copied: string | null; onCopy: (value: string, label: string) => void;
}) => {
  const displayValue = !value ? "" : (isSensitive && !isRevealed ? maskSensitive(value) : value);

  return (
    <div className="flex items-center justify-between group py-3 border-b border-border/10 last:border-0">
      <span className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="w-4 h-4" /> {label}</span>
      <div className="flex items-center gap-1.5">
        {editing ? (
          <input
            value={draftValue}
            onChange={e => onDraftChange(field, e.target.value)}
            className="text-sm text-right bg-foreground/5 border border-border/20 rounded-lg px-3 py-1.5 text-foreground outline-none focus:ring-1 focus:ring-primary/50 w-44 transition-all"
            placeholder={`Adicionar ${label.toLowerCase()}`}
          />
        ) : (
          <>
            {value ? (
              <span className="text-sm font-medium text-foreground">{displayValue}</span>
            ) : (
              <button onClick={onStartEdit} className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors">
                <Plus className="w-3 h-3" /> Adicionar
              </button>
            )}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {isSensitive && value && (
                <button onClick={() => onToggleReveal(field)} className="p-1 rounded hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors" title={isRevealed ? "Ocultar" : "Revelar"}>
                  {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              )}
              {value && (
                <button onClick={() => onCopy(value, label)} className="p-1 rounded hover:bg-foreground/10 text-muted-foreground hover:text-primary transition-colors">
                  {copied === label ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Multi-value Profile Field ────────────────────────────────────────────────
const MultiProfileField = ({ label, primaryValue, extraValues, icon: Icon, editing, draftPrimary, draftExtras, onPrimaryChange, onExtraChange, onExtraLabelChange, onAddExtra, onRemoveExtra, onStartEdit, copied, onCopy, useAutocomplete = false }: {
  label: string; primaryValue: string; extraValues: LabeledEntry[]; icon: any;
  editing: boolean; draftPrimary: string; draftExtras: LabeledEntry[];
  onPrimaryChange: (val: string) => void; onExtraChange: (idx: number, val: string) => void;
  onExtraLabelChange: (idx: number, label: string) => void;
  onAddExtra: () => void; onRemoveExtra: (idx: number) => void;
  onStartEdit: () => void; copied: string | null; onCopy: (value: string, label: string) => void;
  useAutocomplete?: boolean;
}) => {
  const inputCls = "text-xs bg-foreground/5 border border-border/20 rounded-lg px-2.5 py-1.5 text-foreground outline-none focus:ring-1 focus:ring-primary/50 transition-all";

  const renderInput = (value: string, onChange: (val: string) => void, ph: string) => {
    if (useAutocomplete) {
      return (
        <AddressAutocomplete
          value={value}
          onChange={onChange}
          placeholder={ph}
          className="text-xs bg-foreground/5 border border-border/20 rounded-lg px-2.5 py-1.5 pl-7 text-foreground outline-none focus:ring-1 focus:ring-primary/50 w-44 transition-all"
        />
      );
    }
    return (
      <input value={value} onChange={e => onChange(e.target.value)} className={`${inputCls} w-44`} placeholder={ph} />
    );
  };

  return (
    <div className="py-2.5 border-b border-border/10 last:border-0">
      {/* Primary row */}
      <div className="flex items-center justify-between group">
        <span className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="w-3.5 h-3.5" /> {label}</span>
        <div className="flex items-center gap-1.5">
          {editing ? (
            renderInput(draftPrimary, onPrimaryChange, `Adicionar ${label.toLowerCase()}`)
          ) : (
            <>
              {primaryValue ? (
                <span className="text-xs font-medium text-foreground truncate max-w-[200px]">{primaryValue}</span>
              ) : (
                <button onClick={onStartEdit} className="flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary transition-colors">
                  <Plus className="w-3 h-3" /> Adicionar
                </button>
              )}
              {primaryValue && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onCopy(primaryValue, label)} className="p-1 rounded hover:bg-foreground/10 text-muted-foreground hover:text-primary transition-colors">
                    {copied === label ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Extra entries */}
      {(editing ? draftExtras : extraValues).map((entry, idx) => {
        const entryValue = typeof entry === "string" ? entry : entry.value;
        const entryLabel = typeof entry === "string" ? "" : entry.label;
        return (
          <div key={idx} className="flex items-center justify-between group mt-1.5 pl-5">
            {editing ? (
              <div className="flex items-center gap-1.5 ml-auto w-full justify-end">
                <input
                  value={entryLabel}
                  onChange={e => onExtraLabelChange(idx, e.target.value)}
                  className={`${inputCls} w-20 text-[11px] text-muted-foreground`}
                  placeholder="Rótulo"
                />
                {renderInput(entryValue, (v) => onExtraChange(idx, v), `${label} adicional`)}
                <button onClick={() => onRemoveExtra(idx)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground/40">└</span>
                  {entryLabel && (
                    <span className="text-[10px] font-medium text-primary/60 bg-primary/5 rounded px-1.5 py-0.5">{entryLabel}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-foreground/70 truncate max-w-[180px]">{entryValue}</span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onCopy(entryValue, `${label} ${idx + 2}`)} className="p-1 rounded hover:bg-foreground/10 text-muted-foreground hover:text-primary transition-colors">
                      {copied === `${label} ${idx + 2}` ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* Add more button */}
      {editing && (
        <button onClick={onAddExtra} className="flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary transition-colors mt-1.5 pl-5">
          <Plus className="w-3 h-3" /> Adicionar outro {label.toLowerCase()}
        </button>
      )}
    </div>
  );
};

// ─── Perfil Tab ───────────────────────────────────────────────────────────────
const ProfileTab = ({ user, authProfile, updateProfile }: any) => {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set());

  const defaultProfile: ProfileData = {
    name: authProfile?.display_name || user?.email?.split("@")[0] || "Usuário",
    email: user?.email || "", phone: "", location: "",
    cpf: "", rg: "", passport: "", birthday: "", website: "",
    emails: [], phones: [], locations: [], websites: [],
  };
  const [profile, setProfile] = useState<ProfileData>(defaultProfile);
  const [draft, setDraft] = useState<ProfileData>(defaultProfile);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("user_data").select("data")
        .eq("user_id", user.id).eq("data_type", "profile_extended").single();
      if (data?.data) {
        const ext = data.data as Record<string, any>;
        const merged: ProfileData = {
          name: authProfile?.display_name || ext.name || defaultProfile.name,
          email: user.email || "", phone: ext.phone || "",
          location: ext.location || "", cpf: ext.cpf || "",
          rg: ext.rg || "", passport: ext.passport || "",
          birthday: ext.birthday || "", website: ext.website || "",
          emails: toLabeledArray(ext.emails),
          phones: toLabeledArray(ext.phones),
          locations: toLabeledArray(ext.locations),
          websites: toLabeledArray(ext.websites),
        };
        setProfile(merged); setDraft(merged);
      } else {
        setProfile(defaultProfile); setDraft(defaultProfile);
      }
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authProfile]);

  const save = async () => {
    if (!user) return;
    if (draft.name !== authProfile?.display_name) await updateProfile({ display_name: draft.name });
    const extData = {
      name: draft.name, phone: draft.phone, location: draft.location,
      cpf: draft.cpf, rg: draft.rg, passport: draft.passport,
      birthday: draft.birthday, website: draft.website,
      emails: draft.emails.filter(e => e.value),
      phones: draft.phones.filter(e => e.value),
      locations: draft.locations.filter(e => e.value),
      websites: draft.websites.filter(e => e.value),
    };
    const { data: existing } = await supabase.from("user_data").select("id").eq("user_id", user.id).eq("data_type", "profile_extended").single();
    if (existing) {
      await supabase.from("user_data").update({ data: extData as any }).eq("id", existing.id);
    } else {
      await supabase.from("user_data").insert({ user_id: user.id, data_type: "profile_extended", data: extData as any } as any);
    }
    setProfile(draft); setEditing(false);
  };

  const copyValue = (value: string, label: string) => {
    navigator.clipboard.writeText(value); setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const toggleReveal = (field: string) => {
    setRevealedFields(prev => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field); else next.add(field);
      return next;
    });
  };

  // Completeness calculation
  const completenessFields: (keyof ProfileData)[] = ["name", "phone", "location", "cpf", "rg", "passport", "birthday", "website"];
  const filledCount = completenessFields.filter(f => !!profile[f]).length;
  const completeness = Math.round((filledCount / completenessFields.length) * 100);

  const handleDraftChange = (field: string, val: string) => {
    setDraft(prev => ({ ...prev, [field]: val }));
  };

  const handleExtraChange = (arrayField: keyof ProfileData, idx: number, val: string) => {
    setDraft(prev => {
      const arr = [...(prev[arrayField] as LabeledEntry[])];
      arr[idx] = { ...arr[idx], value: val };
      return { ...prev, [arrayField]: arr };
    });
  };

  const handleExtraLabelChange = (arrayField: keyof ProfileData, idx: number, label: string) => {
    setDraft(prev => {
      const arr = [...(prev[arrayField] as LabeledEntry[])];
      arr[idx] = { ...arr[idx], label };
      return { ...prev, [arrayField]: arr };
    });
  };

  const handleAddExtra = (arrayField: keyof ProfileData) => {
    setDraft(prev => ({ ...prev, [arrayField]: [...(prev[arrayField] as LabeledEntry[]), { label: "", value: "" }] }));
  };

  const handleRemoveExtra = (arrayField: keyof ProfileData, idx: number) => {
    setDraft(prev => {
      const arr = [...(prev[arrayField] as LabeledEntry[])];
      arr.splice(idx, 1);
      return { ...prev, [arrayField]: arr };
    });
  };

  const singleFieldProps = (field: string, label: string, icon: any, isSensitive = false) => ({
    label, field, icon, isSensitive, editing, draftValue: (draft as any)[field] as string,
    onDraftChange: handleDraftChange, onStartEdit: () => setEditing(true),
    isRevealed: revealedFields.has(field), onToggleReveal: toggleReveal, copied, onCopy: copyValue,
  });

  const multiFieldProps = (primaryField: string, label: string, icon: any) => {
    const arrayKey = MULTI_KEY_MAP[primaryField] as keyof ProfileData;
    return {
      label, icon, editing, copied, onCopy: copyValue,
      primaryValue: (profile as any)[primaryField] as string,
      extraValues: profile[arrayKey] as LabeledEntry[],
      draftPrimary: (draft as any)[primaryField] as string,
      draftExtras: draft[arrayKey] as LabeledEntry[],
      onPrimaryChange: (val: string) => handleDraftChange(primaryField, val),
      onExtraChange: (idx: number, val: string) => handleExtraChange(arrayKey, idx, val),
      onExtraLabelChange: (idx: number, lbl: string) => handleExtraLabelChange(arrayKey, idx, lbl),
      onAddExtra: () => handleAddExtra(arrayKey),
      onRemoveExtra: (idx: number) => handleRemoveExtra(arrayKey, idx),
      onStartEdit: () => setEditing(true),
    };
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-pulse text-muted-foreground text-sm">Carregando perfil...</div></div>;

  return (
    <div className="space-y-4">
      {/* Hero Card Compacto + Barra de Completude */}
      <AnimatedItem index={0}>
        <GlassCard size="auto">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary shrink-0">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold text-foreground truncate">{profile.name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate">{profile.email}</span>
              </p>
              {profile.location && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 shrink-0" />{profile.location}
                </p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              {editing && (
                <Button variant="ghost" size="sm" onClick={() => { setDraft(profile); setEditing(false); }}>
                  Cancelar
                </Button>
              )}
              <Button size="sm" variant={editing ? "default" : "outline"} onClick={() => editing ? save() : setEditing(true)}>
                <Pencil className="w-3.5 h-3.5" />
                {editing ? "Salvar" : "Editar"}
              </Button>
            </div>
          </div>

          {/* Barra de completude */}
          <div className="mt-4 pt-3 border-t border-border/10">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">Perfil {completeness}% completo</span>
              <span className="text-xs font-medium text-foreground">{filledCount}/{completenessFields.length}</span>
            </div>
            <div className="w-full h-2 bg-foreground/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  completeness === 100 ? "bg-green-500" : completeness >= 60 ? "bg-primary" : "bg-amber-500"
                }`}
                style={{ width: `${completeness}%` }}
              />
            </div>
          </div>
        </GlassCard>
      </AnimatedItem>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnimatedItem index={1}>
          <GlassCard size="auto" className="h-full">
            <p className="widget-title mb-2">Informações Pessoais</p>
            <div>
              <ProfileField value={profile.name} {...singleFieldProps("name", "Nome", User)} />
              <MultiProfileField {...multiFieldProps("email", "E-mail", Mail)} />
              <MultiProfileField {...multiFieldProps("phone", "Telefone", Phone)} />
              <MultiProfileField {...multiFieldProps("location", "Localização", MapPin)} useAutocomplete />
              <ProfileField value={profile.birthday} {...singleFieldProps("birthday", "Nascimento", Cake)} />
              <MultiProfileField {...multiFieldProps("website", "Website", Globe)} />
            </div>
          </GlassCard>
        </AnimatedItem>

        <AnimatedItem index={2}>
          <GlassCard size="auto" className="h-full flex flex-col">
            <p className="widget-title mb-2">Documentos</p>
            <div className="flex-1">
              <ProfileField value={profile.cpf} {...singleFieldProps("cpf", "CPF", CreditCard, true)} />
              <ProfileField value={profile.rg} {...singleFieldProps("rg", "RG", CreditCard, true)} />
              <ProfileField value={profile.passport} {...singleFieldProps("passport", "Passaporte", Globe, true)} />
            </div>
            <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-border/10">
              <Shield className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Dados sensíveis são mascarados por padrão</span>
            </div>
          </GlassCard>
        </AnimatedItem>
      </div>

      <AnimatedItem index={3}>
        <ProfileDocumentsSection />
      </AnimatedItem>
    </div>
  );
};
// ─── Billing Tab ──────────────────────────────────────────────────────────────
const BillingUserTab = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { credits, hasActiveCredits, openBillingPortal } = useSubscription();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txFilter, setTxFilter] = useState<"all" | "earned" | "spent">("all");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("credit_transactions")
      .select("action, amount, description, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setTransactions(data || []));
  }, [user]);

  const creditBalance = credits?.balance ?? 0;
  const creditPct = Math.min(100, Math.round((creditBalance / MONTHLY_CREDITS) * 100));
  const isLow = creditPct < 15;

  const formatDate = (d: string) => {
    try { return format(new Date(d), "dd MMM, HH:mm", { locale: ptBR }); }
    catch { return d; }
  };

  const totalSpent = transactions.filter(tx => tx.amount < 0).reduce((s, tx) => s + Math.abs(tx.amount), 0);
  const totalEarned = transactions.filter(tx => tx.amount > 0).reduce((s, tx) => s + tx.amount, 0);
  const daysInRange = Math.max(1, transactions.length > 0
    ? Math.ceil((Date.now() - new Date(transactions[transactions.length - 1].created_at).getTime()) / 86400000)
    : 1);
  const dailyCost = totalSpent / daysInRange;
  const estimatedDaysLeft = dailyCost > 0 ? Math.floor(creditBalance / dailyCost) : null;

  const spendingByAction = transactions
    .filter(tx => tx.amount < 0)
    .reduce<Record<string, number>>((acc, tx) => {
      const key = tx.action.replace(/_/g, " ");
      acc[key] = (acc[key] || 0) + Math.abs(tx.amount);
      return acc;
    }, {});

  const spendingChart = Object.entries(spendingByAction)
    .map(([action, total]) => ({ action, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  const actionBadgeColor = (amount: number) =>
    amount > 0 ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive";

  const filteredTx = transactions.filter(tx => {
    if (txFilter === "earned") return tx.amount > 0;
    if (txFilter === "spent") return tx.amount < 0;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Subscription status */}
      <AnimatedItem index={0}>
        <GlassCard size="auto" className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Créditos disponíveis</p>
              <p className="text-lg font-bold text-foreground flex items-center gap-2">
                <Coins className="w-5 h-5 text-primary" /> {creditBalance.toLocaleString("pt-BR")}
              </p>
              {!hasActiveCredits && (
                <p className="text-xs text-destructive mt-1">Sem créditos. Compre um pacote para continuar.</p>
              )}
              {estimatedDaysLeft !== null && hasActiveCredits && (
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Estimativa: <span className={`font-medium ${estimatedDaysLeft < 7 ? "text-destructive" : "text-foreground"}`}>{estimatedDaysLeft} dias</span> restantes
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={openBillingPortal}>
                Gerenciar pagamento
              </Button>
              <Button size="sm" onClick={() => navigate("/pricing")}>
                Comprar créditos
              </Button>
            </div>
          </div>
        </GlassCard>
      </AnimatedItem>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard icon={<Coins className="w-4 h-4" />} label="Saldo" value={creditBalance.toLocaleString("pt-BR")} sub={`${creditPct}% disponível`} highlight={isLow} />
        <KPICard icon={<ArrowDown className="w-4 h-4" />} label="Total Gasto" value={totalSpent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} sub="créditos" />
        <KPICard icon={<ArrowUp className="w-4 h-4" />} label="Total Recebido" value={totalEarned.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} sub="créditos" />
        <KPICard icon={<TrendingUp className="w-4 h-4" />} label="Custo/Dia" value={dailyCost.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} sub="créditos/dia" />
      </div>

      {/* Credit progress */}
      {credits && (
        <AnimatedItem index={1}>
          <GlassCard size="auto" className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Coins className="w-4 h-4 text-primary" /> Barra de Créditos
              </h3>
              <span className={`text-xl font-bold font-mono ${isLow ? "text-destructive" : "text-foreground"}`}>
                {creditBalance.toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="w-full h-2.5 bg-foreground/10 rounded-full overflow-hidden mb-1.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isLow ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${creditPct}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">{creditPct}% disponível de {MONTHLY_CREDITS.toLocaleString("pt-BR")}</p>
          </GlassCard>
        </AnimatedItem>
      )}

      {/* Spending chart */}
      {spendingChart.length > 0 && (
        <AnimatedItem index={2}>
          <GlassCard size="auto" className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Consumo por Recurso
            </h3>
            <ResponsiveContainer width="100%" height={160}>
              <ReBarChart data={spendingChart} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="action" type="category" tick={{ fontSize: 10 }} width={100} />
                <Tooltip formatter={(v: number) => [v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }), "Créditos"]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12, color: "hsl(var(--foreground))" }} itemStyle={{ color: "hsl(var(--foreground))" }} labelStyle={{ color: "hsl(var(--muted-foreground))" }} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
              </ReBarChart>
            </ResponsiveContainer>
          </GlassCard>
        </AnimatedItem>
      )}

      {/* Transaction history */}
      <AnimatedItem index={3}>
        <GlassCard size="auto" className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <History className="w-4 h-4 text-primary" /> Histórico de Créditos
            </h3>
            <div className="flex gap-1 bg-foreground/5 rounded-lg p-0.5">
              {(["all", "earned", "spent"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setTxFilter(f)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                    txFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f === "all" ? "Todos" : f === "earned" ? "Recebidos" : "Gastos"}
                </button>
              ))}
            </div>
          </div>
          {filteredTx.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <History className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs">Nenhuma transação encontrada</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[300px] overflow-y-auto scrollbar-thin">
              {filteredTx.map((tx, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-colors">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${actionBadgeColor(tx.amount)}`}>
                      {tx.action.replace(/_/g, " ")}
                    </span>
                    <p className="text-xs text-foreground truncate">{tx.description || "—"}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    <span className="text-[10px] text-muted-foreground">{formatDate(tx.created_at)}</span>
                    <span className={`text-xs font-mono font-semibold ${tx.amount > 0 ? "text-green-600" : "text-destructive"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </AnimatedItem>
    </div>
  );
};

// ─── Sharing Tab ──────────────────────────────────────────────────────────────
const SharingTab = () => {
  const navigate = useNavigate();
  const { friends } = useFriends();
  const { user } = useAuth();
  const [shareCount, setShareCount] = useState(0);
  const [receivedCount, setReceivedCount] = useState(0);
  const [wsShareCount, setWsShareCount] = useState(0);
  const [wsReceivedCount, setWsReceivedCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    // Widget shares
    supabase.from("widget_shares" as any).select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .then(({ count }) => setShareCount(count ?? 0));
    supabase.from("widget_shares" as any).select("id", { count: "exact", head: true })
      .eq("shared_with", user.id)
      .then(({ count }) => setReceivedCount(count ?? 0));
    // Workspace shares
    supabase.from("workspace_shares" as any).select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .then(({ count }) => setWsShareCount(count ?? 0));
    supabase.from("workspace_shares" as any).select("id", { count: "exact", head: true })
      .eq("shared_with", user.id)
      .eq("status", "accepted")
      .then(({ count }) => setWsReceivedCount(count ?? 0));
  }, [user]);

  const widgetTypes = [
    { label: "Tarefas", icon: ListTodo, desc: "Listas e projetos" },
    { label: "Calendário", icon: Target, desc: "Eventos e agenda" },
    { label: "Notas", icon: FolderOpen, desc: "Anotações e docs" },
    { label: "Contatos", icon: Users, desc: "Agenda de contatos" },
    { label: "Hábitos", icon: Flame, desc: "Rastreamento diário" },
    { label: "Metas", icon: TrendingUp, desc: "Metas financeiras" },
  ];

  const totalShared = shareCount + wsShareCount;
  const totalReceived = receivedCount + wsReceivedCount;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard icon={<Users className="w-4 h-4" />} label="Amigos" value={friends.length} sub="conectados" />
        <KPICard icon={<ArrowUp className="w-4 h-4" />} label="Enviados" value={totalShared} sub="compartilhamentos" />
        <KPICard icon={<ArrowDown className="w-4 h-4" />} label="Recebidos" value={totalReceived} sub="compartilhados comigo" />
        <KPICard icon={<Share2 className="w-4 h-4" />} label="Módulos" value={widgetTypes.length} sub="disponíveis" />
      </div>

      <AnimatedItem index={0}>
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Módulos Compartilháveis</h3>
            </div>
            <button
              onClick={() => navigate("/workspaces")}
              className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors"
            >
              Gerenciar →
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Compartilhe workspaces e módulos com amigos. Controle permissões granulares de visualização ou edição.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {widgetTypes.map(w => (
              <div key={w.label} className="flex flex-col gap-1 p-3 rounded-xl bg-foreground/[0.03] border border-border/20 hover:bg-foreground/[0.05] transition-colors">
                <div className="flex items-center gap-2">
                  <w.icon className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-foreground">{w.label}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{w.desc}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </AnimatedItem>

      {/* Workspace shares summary */}
      {(wsShareCount > 0 || wsReceivedCount > 0) && (
        <AnimatedItem index={1}>
          <GlassCard size="auto" className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" /> Workspaces Compartilhados
              </h3>
              <button onClick={() => navigate("/workspaces")} className="text-xs text-primary hover:text-primary/80 transition-colors">
                Ver todos →
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-foreground/[0.03] border border-border/20">
                <div className="text-lg font-bold text-foreground">{wsShareCount}</div>
                <div className="text-[10px] text-muted-foreground">enviados por você</div>
              </div>
              <div className="p-3 rounded-xl bg-foreground/[0.03] border border-border/20">
                <div className="text-lg font-bold text-foreground">{wsReceivedCount}</div>
                <div className="text-[10px] text-muted-foreground">recebidos de amigos</div>
              </div>
            </div>
          </GlassCard>
        </AnimatedItem>
      )}

      {/* Friends preview */}
      {friends.length > 0 && (
        <AnimatedItem index={2}>
          <GlassCard size="auto" className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Amigos conectados
              </h3>
              <button onClick={() => navigate("/workspaces")} className="text-xs text-primary hover:text-primary/80 transition-colors">
                Ver todos →
              </button>
            </div>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto scrollbar-thin">
              {friends.slice(0, 10).map((f: any) => (
                <div key={f.id} className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-foreground/[0.03] transition-colors">
                  <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {(f.friend_display_name || f.friend_email || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{f.friend_display_name || "Amigo"}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{f.friend_email}</p>
                  </div>
                </div>
              ))}
            </div>
            {friends.length > 10 && (
              <p className="text-[10px] text-muted-foreground text-center mt-2">e mais {friends.length - 10} amigos</p>
            )}
          </GlassCard>
        </AnimatedItem>
      )}

      {/* Empty state */}
      {friends.length === 0 && (
        <AnimatedItem index={1}>
          <GlassCard size="auto" className="p-6 text-center">
            <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-2">Nenhum amigo conectado</p>
            <p className="text-xs text-muted-foreground/60 mb-4">Adicione amigos para começar a compartilhar workspaces e módulos.</p>
            <button onClick={() => navigate("/workspaces")} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              Adicionar Amigos
            </button>
          </GlassCard>
        </AnimatedItem>
      )}
    </div>
  );
};

// ─── Relatórios Tab ───────────────────────────────────────────────────────────
const RelatoriosTab = () => {
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("quarter");
  const { weeklyStats, insights, isLoading } = useAnalytics(period);

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="animate-pulse text-muted-foreground text-sm">Carregando relatórios...</div></div>;

  const pieData = insights.tasksByCategory.map((c, i) => ({
    name: STATUS_LABELS[c.category] || c.category,
    value: c.count,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const priorityData = insights.tasksByPriority.map((p, i) => ({
    name: PRIORITY_LABELS[p.priority] || p.priority,
    value: p.count,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex justify-end">
        <div className="flex gap-1 bg-foreground/5 rounded-lg p-0.5">
          {(["month", "quarter", "year"] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "month" ? "Mês" : p === "quarter" ? "Trimestre" : "Ano"}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard icon={<Target className="w-4 h-4" />} label="Concluídas" value={insights.totalCompleted} sub={`de ${insights.totalCreated} criadas`} />
        <KPICard icon={<TrendingUp className="w-4 h-4" />} label="Taxa de conclusão" value={`${insights.completionRate.toFixed(0)}%`} sub={`${insights.avgPerWeek.toFixed(1)}/semana`} />
        <KPICard icon={<Flame className="w-4 h-4" />} label="Sequência" value={`${insights.streakDays}d`} sub="dias consecutivos" />
        <KPICard icon={<Trophy className="w-4 h-4" />} label="Melhor semana" value={insights.bestWeek?.completed ?? 0} sub={insights.bestWeek?.week || "—"} />
      </div>

      {/* Tasks per week */}
      <GlassCard size="auto" className="p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <ListTodo className="w-4 h-4 text-primary" /> Tarefas por semana
        </h2>
        <div className="h-44 sm:h-52">
          <ResponsiveContainer width="100%" height="100%">
            <ReBarChart data={weeklyStats} barGap={2}>
              <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, fontSize: 12, color: "#1f2937" }}
                labelStyle={{ color: "#374151" }}
                itemStyle={{ color: "#1f2937" }}
                cursor={{ fill: "hsl(var(--foreground) / 0.06)" }}
              />
              <Bar dataKey="created" name="Criadas" fill="hsl(var(--muted-foreground) / 0.3)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completed" name="Concluídas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </ReBarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      {/* Status + Priority row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassCard size="auto" className="p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" /> Por prioridade
          </h2>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={priorityData}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, fontSize: 12, color: "#1f2937" }} itemStyle={{ color: "#1f2937" }} labelStyle={{ color: "#374151" }} cursor={{ fill: "hsl(var(--foreground) / 0.06)" }} />
                <Bar dataKey="value" name="Tarefas" radius={[4, 4, 0, 0]}>
                  {priorityData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard size="auto" className="p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" /> Status das tarefas
          </h2>
          <div className="h-40 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} dataKey="value" paddingAngle={3} stroke="none">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, fontSize: 12, color: "#1f2937" }} itemStyle={{ color: "#1f2937" }} labelStyle={{ color: "#374151" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 min-w-[100px]">
              {pieData.map((entry, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: entry.fill }} />
                  <span className="text-foreground/70">{entry.name}</span>
                  <span className="text-foreground font-medium ml-auto">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Projects */}
      <GlassCard size="auto" className="p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-primary" /> Tarefas por projeto
        </h2>
        <div className="space-y-2">
          {insights.tasksByProject.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhum dado</p>
          ) : (
            insights.tasksByProject.map((p, i) => {
              const pct = insights.totalCreated > 0 ? (p.count / insights.totalCreated) * 100 : 0;
              return (
                <div key={p.project} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground/80 truncate">{p.project}</span>
                    <span className="text-muted-foreground">{p.count}</span>
                  </div>
                  <div className="h-1.5 bg-foreground/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </GlassCard>

      {/* Insights textuais */}
      <GlassCard size="auto" className="p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> Resumo do Período
        </h2>
        <div className="p-3 rounded-xl bg-foreground/[0.03] border border-border/20 mb-3">
          <p className="text-xs text-foreground/80 leading-relaxed">
            {insights.totalCreated === 0
              ? "Nenhuma tarefa registrada neste período. Comece criando uma tarefa para acompanhar sua produtividade."
              : `Você criou ${insights.totalCreated} tarefas e concluiu ${insights.totalCompleted} (${insights.completionRate.toFixed(0)}%). ${
                  insights.streakDays > 0 ? `Sua sequência ativa é de ${insights.streakDays} dias consecutivos. ` : ""
                }${insights.avgPerWeek > 3 ? "Excelente ritmo!" : insights.avgPerWeek > 1 ? "Bom progresso!" : "Continue firme!"}`
            }
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-foreground/[0.03] border border-border/20 text-center">
            <p className="text-muted-foreground mb-0.5">Pendentes</p>
            <p className="text-lg font-bold text-foreground">{Math.max(0, insights.totalCreated - insights.totalCompleted)}</p>
          </div>
          <div className="p-3 rounded-xl bg-foreground/[0.03] border border-border/20 text-center">
            <p className="text-muted-foreground mb-0.5">Projetos</p>
            <p className="text-lg font-bold text-foreground">{insights.tasksByProject.length}</p>
          </div>
          <div className="p-3 rounded-xl bg-foreground/[0.03] border border-border/20 text-center">
            <p className="text-muted-foreground mb-0.5">Prioridade Alta</p>
            <p className="text-lg font-bold text-foreground">{insights.tasksByPriority.find(p => p.priority === "high")?.count ?? 0}</p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};

// ─── Shared KPI Card ──────────────────────────────────────────────────────────
const KPICard = ({ icon, label, value, sub, highlight }: { icon: React.ReactNode; label: string; value: string | number; sub: string; highlight?: boolean }) => (
  <GlassCard size="auto" className="space-y-1 p-3">
    <div className="flex items-center gap-2 text-muted-foreground">
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </div>
    <p className={`text-xl font-bold ${highlight ? "text-destructive" : "text-foreground"}`}>{value}</p>
    <p className="text-[10px] text-muted-foreground">{sub}</p>
  </GlassCard>
);

export default ProfilePage;
