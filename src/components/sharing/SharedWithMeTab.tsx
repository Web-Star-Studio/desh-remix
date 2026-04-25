import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import type { WorkspaceShare, WorkspaceShareModule } from "@/types/common";
import { MODULE_OPTIONS } from "@/hooks/workspace/useWorkspaceShares";
import {
  Share2, Eye, Pencil, Inbox, ChevronDown, ChevronUp,
} from "lucide-react";
import { MODULE_ICONS } from "./moduleIcons";
import ModuleBadges from "./ModuleBadges";
import { stagger, fadeUp } from "./animations";

interface SharedWithMeTabProps {
  sharedWithMe: WorkspaceShare[];
  getSharedData: (shareId: string) => Promise<Record<string, any[]> | null>;
}

export default function SharedWithMeTab({ sharedWithMe, getSharedData }: SharedWithMeTabProps) {
  const [viewingShare, setViewingShare] = useState<string | null>(null);
  const [viewingData, setViewingData] = useState<Record<string, any[]> | null>(null);
  const [viewingLoading, setViewingLoading] = useState(false);
  const [viewingTab, setViewingTab] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  const handleViewSharedData = async (shareId: string) => {
    if (viewingShare === shareId) { setViewingShare(null); setViewingData(null); return; }
    setViewingShare(shareId);
    setViewingLoading(true);
    const data = await getSharedData(shareId);
    if (!mountedRef.current) return;
    setViewingData(data);
    if (data) {
      const firstKey = Object.keys(data).find(k => (data[k] as any[])?.length > 0) || Object.keys(data)[0];
      setViewingTab(firstKey || "");
    }
    setViewingLoading(false);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
          <Share2 className="w-3.5 h-3.5 text-primary" />
        </div>
        Compartilhados Comigo
        <span className="text-xs text-muted-foreground font-normal">({sharedWithMe.length})</span>
      </h3>

      {sharedWithMe.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
            <Inbox className="w-7 h-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground mb-1">Nenhum workspace compartilhado com você ainda</p>
          <p className="text-xs text-muted-foreground/60">Quando um amigo compartilhar um workspace, ele aparecerá aqui.</p>
        </div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sharedWithMe.map(share => (
            <motion.div key={share.id} variants={fadeUp}
              className="glass-card p-5 hover:border-border/30 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ring-1 ring-foreground/5" style={{ background: `${share.workspace_color || 'hsl(var(--primary))'}15` }}>
                  {share.workspace_icon || "📁"}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground truncate">{share.workspace_name || "Workspace"}</h4>
                  <p className="text-xs text-muted-foreground truncate">
                    de {share.owner_name || "Usuário"}
                    {share.owner_email && share.owner_name !== share.owner_email ? ` · ${share.owner_email}` : ""}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                  share.permission === "edit" ? "bg-primary/10 text-primary" : "bg-foreground/10 text-muted-foreground"
                }`}>
                  {share.permission === "edit" ? <><Pencil className="w-2.5 h-2.5" /> Editar</> : <><Eye className="w-2.5 h-2.5" /> Ver</>}
                </span>
              </div>

              <div className="mb-3">
                <ModuleBadges share={share} />
              </div>

              <button onClick={() => handleViewSharedData(share.id)}
                className={`w-full py-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                  viewingShare === share.id ? "bg-foreground/10 text-foreground" : "bg-primary/10 text-primary hover:bg-primary/15"
                }`}>
                {viewingShare === share.id ? (
                  <><ChevronUp className="w-3.5 h-3.5" /> Fechar</>
                ) : (
                  <><ChevronDown className="w-3.5 h-3.5" /> Visualizar dados</>
                )}
              </button>

              {/* Data viewer */}
              {viewingShare === share.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="mt-3 pt-3 border-t border-border/20">
                  {viewingLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    </div>
                  ) : viewingData ? (
                    <div>
                      <div className="flex gap-1 mb-2.5 overflow-x-auto pb-1 scrollbar-thin">
                        {Object.keys(viewingData).map(mod => {
                          const Icon = MODULE_ICONS[mod as WorkspaceShareModule] || MODULE_ICONS.tasks;
                          return (
                            <button key={mod} onClick={() => setViewingTab(mod)}
                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${
                                viewingTab === mod ? "bg-primary/15 text-primary border border-primary/30" : "bg-foreground/5 text-muted-foreground border border-transparent hover:bg-foreground/10"
                              }`}>
                              <Icon className="w-3 h-3" />
                              {MODULE_OPTIONS.find(o => o.value === mod)?.label || mod}
                              <span className="opacity-60">({(viewingData[mod] as any[])?.length || 0})</span>
                            </button>
                          );
                        })}
                      </div>
                      <SharedDataList data={viewingData[viewingTab] as any[] || []} tab={viewingTab} />
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-3">Nenhum dado disponível</p>
                  )}
                </motion.div>
              )}
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

/** Extracted data list renderer to keep the main component cleaner */
function SharedDataList({ data, tab }: { data: any[]; tab: string }) {
  if (data.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-3">Sem dados</p>;
  }

  return (
    <div className="space-y-1.5 max-h-60 overflow-y-auto scrollbar-thin">
      {data.map((item: any, i: number) => (
        <div key={item.id || i} className="p-2.5 rounded-lg bg-foreground/[0.03] border border-border/10 text-xs text-foreground">
          {tab === "tasks" && (
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${item.status === "done" ? "bg-emerald-500" : item.priority === "high" ? "bg-destructive" : "bg-muted-foreground"}`} />
              <span className={`flex-1 truncate ${item.status === "done" ? "line-through text-muted-foreground" : ""}`}>{item.title}</span>
              {item.due_date && <span className="text-muted-foreground/60 text-[10px] shrink-0">{new Date(item.due_date).toLocaleDateString("pt-BR")}</span>}
            </div>
          )}
          {tab === "contacts" && (
            <div className="flex items-center justify-between">
              <span className="truncate">{item.name}</span>
              {item.email && <span className="text-muted-foreground text-[10px] shrink-0 ml-2">{item.email}</span>}
            </div>
          )}
          {tab === "financegoals" && (
            <div className="flex justify-between items-center">
              <span className="truncate">{item.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-16 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (item.current / (item.target || 1)) * 100)}%` }} />
                </div>
                <span className="text-primary font-medium text-[10px]">{Math.round((item.current / (item.target || 1)) * 100)}%</span>
              </div>
            </div>
          )}
          {tab === "transactions" && (
            <div className="flex justify-between">
              <span className="truncate">{item.description}</span>
              <span className={`font-medium shrink-0 ml-2 ${item.type === "income" ? "text-emerald-500" : "text-destructive"}`}>
                {item.type === "income" ? "+" : "-"}R$ {Math.abs(item.amount).toFixed(2)}
              </span>
            </div>
          )}
          {tab === "recurring" && (
            <div className="flex justify-between">
              <span className="truncate">{item.description} <span className="text-muted-foreground">· dia {item.day_of_month}</span></span>
              <span className={`font-medium shrink-0 ml-2 ${item.type === "income" ? "text-emerald-500" : "text-destructive"}`}>
                R$ {Math.abs(item.amount).toFixed(2)}
              </span>
            </div>
          )}
          {tab === "budgets" && (
            <div className="flex justify-between">
              <span className="truncate">{item.category}</span>
              <span className="text-primary font-medium shrink-0 ml-2">R$ {item.monthly_limit?.toFixed(2)}</span>
            </div>
          )}
          {tab === "notes" && (
            <span className="truncate block">{typeof item.data === "object" ? (item.data?.title || JSON.stringify(item.data).slice(0, 100)) : String(item.data).slice(0, 100)}</span>
          )}
          {tab === "habits" && (
            <span className="truncate block">{typeof item.data === "object" ? (item.data?.name || item.data?.title || JSON.stringify(item.data).slice(0, 100)) : String(item.data).slice(0, 100)}</span>
          )}
          {tab === "calendar" && (
            <span className="truncate block">{typeof item.data === "object" ? (item.data?.title || item.data?.summary || JSON.stringify(item.data).slice(0, 100)) : String(item.data).slice(0, 100)}</span>
          )}
          {!["tasks", "contacts", "financegoals", "transactions", "recurring", "budgets", "notes", "habits", "calendar"].includes(tab) && (
            <span className="truncate block">{item.title || JSON.stringify(item).slice(0, 120)}</span>
          )}
        </div>
      ))}
    </div>
  );
}
