import React, { useState, useMemo, useCallback, useRef } from "react";
import DeshTooltip from "@/components/ui/DeshTooltip";
import {
  FolderOpen, FileText, Image, ExternalLink, Search, BarChart3,
  TrendingUp, Clock, Sparkles, Loader2, Zap, HardDrive, FileImage,
  FileVideo, FileAudio, FileSpreadsheet, FileCode, File, Archive,
  LayoutGrid, List, Filter, Star, Download, Eye,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { useConnections } from "@/contexts/ConnectionsContext";

import { useGoogleServiceData } from "@/hooks/integrations/useGoogleServiceData";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { useDemo } from "@/contexts/DemoContext";
import { DEMO_FILES } from "@/lib/demoData";
import GlassCard from "./GlassCard";
import WidgetEmptyState from "./WidgetEmptyState";
import WidgetTitle from "./WidgetTitle";
import ConnectionBadge from "./ConnectionBadge";
import ScopeRequestBanner from "./ScopeRequestBanner";

type FileCategory = "Documentos" | "Imagens" | "Planilhas" | "Vídeos" | "Áudio" | "Código" | "Arquivos" | "Outros";

const CATEGORY_META: Record<FileCategory, { icon: React.ElementType; color: string; barColor: string }> = {
  Documentos: { icon: FileText, color: "text-blue-400", barColor: "bg-blue-500" },
  Imagens: { icon: FileImage, color: "text-emerald-400", barColor: "bg-emerald-500" },
  Planilhas: { icon: FileSpreadsheet, color: "text-green-400", barColor: "bg-green-500" },
  Vídeos: { icon: FileVideo, color: "text-purple-400", barColor: "bg-purple-500" },
  Áudio: { icon: FileAudio, color: "text-pink-400", barColor: "bg-pink-500" },
  Código: { icon: FileCode, color: "text-amber-400", barColor: "bg-amber-500" },
  Arquivos: { icon: Archive, color: "text-orange-400", barColor: "bg-orange-500" },
  Outros: { icon: File, color: "text-muted-foreground", barColor: "bg-foreground/30" },
};

function categorizeFile(mimeType?: string, name?: string): FileCategory {
  if (!mimeType && !name) return "Outros";
  const m = (mimeType || "").toLowerCase();
  const n = (name || "").toLowerCase();
  if (m.includes("image") || /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/i.test(n)) return "Imagens";
  if (m.includes("video") || /\.(mp4|avi|mov|mkv|webm)$/i.test(n)) return "Vídeos";
  if (m.includes("audio") || /\.(mp3|wav|flac|ogg|m4a)$/i.test(n)) return "Áudio";
  if (m.includes("spreadsheet") || m.includes("excel") || /\.(xlsx?|csv|ods)$/i.test(n)) return "Planilhas";
  if (m.includes("zip") || m.includes("rar") || m.includes("compressed") || /\.(zip|rar|7z|tar|gz)$/i.test(n)) return "Arquivos";
  if (/\.(js|ts|tsx|jsx|py|go|rs|java|rb|php|html|css|json|xml|yaml|yml|md|sh)$/i.test(n)) return "Código";
  if (m.includes("document") || m.includes("pdf") || m.includes("text") || m.includes("presentation") || /\.(pdf|docx?|pptx?|txt|rtf)$/i.test(n)) return "Documentos";
  return "Outros";
}

function formatSize(bytes?: number | string): string {
  if (!bytes) return "";
  const b = typeof bytes === "string" ? parseInt(bytes) : bytes;
  if (isNaN(b) || b === 0) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function relativeTime(dateStr?: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

interface NormalizedFile {
  id: string;
  name: string;
  mimeType?: string;
  size?: number;
  modifiedTime?: string;
  category: FileCategory;
  icon: React.ElementType;
  webViewLink?: string;
}

const FilesWidget = () => {
  const navigate = useNavigate();
  const { isDemoMode } = useDemo();
  const { invoke } = useEdgeFn();
  const { getConnectionsByCategory } = useConnections();
  const storageConns = getConnectionsByCategory("storage");
  const connectionIds = storageConns.map(c => c.id);

  const { data: googleFiles, isLoading: googleLoading, isConnected: googleConnected, connectionNames: googleNames, needsScope: driveNeedsScope, requestScope: driveRequestScope } = useGoogleServiceData<any[]>({
    service: "drive",
    path: "/files",
    params: { pageSize: "20", orderBy: "modifiedTime desc", fields: "files(id,name,mimeType,size,modifiedTime,createdTime,webViewLink,starred)" },
  });

  const isConnected = googleConnected;
  const isLoading = googleLoading;
  const sourceNames = googleConnected ? googleNames : [];

  const [view, setView] = useState<"list" | "grid">("list");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<FileCategory | "Todos">("Todos");

  // Normalize files
  const files: NormalizedFile[] = useMemo(() => {
    if (isDemoMode) {
      return DEMO_FILES.map((f, i) => {
        const cat = f.icon === "image" ? "Imagens" as FileCategory : "Documentos" as FileCategory;
        return { id: String(i), name: f.name, category: cat, icon: CATEGORY_META[cat].icon, size: undefined, modifiedTime: undefined };
      });
    }
    if (googleConnected && Array.isArray(googleFiles) && googleFiles.length > 0) {
      return googleFiles.map((f: any, i: number) => {
        const cat = categorizeFile(f.mimeType, f.name);
        return {
          id: f.id || String(i),
          name: f.name || "Arquivo",
          mimeType: f.mimeType,
          size: f.size ? parseInt(f.size) : undefined,
          modifiedTime: f.modifiedTime || f.createdTime,
          category: cat,
          icon: CATEGORY_META[cat].icon,
          webViewLink: f.webViewLink,
        };
      });
    }
    return [];
  }, [isDemoMode, googleConnected, googleFiles]);

  const filteredFiles = useMemo(() => {
    let result = files;
    if (filterCat !== "Todos") result = result.filter(f => f.category === filterCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(f => f.name.toLowerCase().includes(q));
    }
    return result;
  }, [files, filterCat, search]);

  // Stats
  const stats = useMemo(() => {
    const catCounts: Partial<Record<FileCategory, number>> = {};
    let totalSize = 0;
    for (const f of files) {
      catCounts[f.category] = (catCounts[f.category] || 0) + 1;
      if (f.size) totalSize += f.size;
    }
    const activeCats = Object.entries(catCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .map(([cat, count]) => ({ cat: cat as FileCategory, count: count as number }));

    const recent = [...files].filter(f => f.modifiedTime).sort((a, b) =>
      new Date(b.modifiedTime!).getTime() - new Date(a.modifiedTime!).getTime()
    ).slice(0, 5);

    const largest = [...files].filter(f => f.size && f.size > 0).sort((a, b) => (b.size || 0) - (a.size || 0)).slice(0, 5);

    return { catCounts, activeCats, totalSize, recent, largest };
  }, [files]);

  // AI Summary
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const aiCacheRef = useRef<{ key: string; text: string; ts: number } | null>(null);

  const generateAiSummary = useCallback(async () => {
    const key = `${files.length}-${stats.totalSize}`;
    if (aiCacheRef.current?.key === key && Date.now() - aiCacheRef.current.ts < 5 * 60 * 1000) {
      setAiSummary(aiCacheRef.current.text); return;
    }
    if (files.length === 0) { setAiSummary("Nenhum arquivo para analisar."); return; }
    setAiLoading(true);
    try {
      const catSummary = stats.activeCats.map(c => `${c.cat}: ${c.count}`).join(", ");
      const topFiles = files.slice(0, 10).map(f => `- ${f.name} (${f.category}, ${formatSize(f.size)})`).join("\n");
      const { data: res, error } = await invoke<any>({
        fn: "chat",
        body: {
          messages: [
            { role: "system", content: "Você é um assistente de organização de arquivos. Analise os arquivos do usuário e dê 2-3 observações úteis em português: organização, tipos predominantes, arquivos grandes que podem ser limpos, sugestões de pastas. Máximo 4 frases." },
            { role: "user", content: `Total: ${files.length} arquivos (${formatSize(stats.totalSize)})\nDistribuição: ${catSummary}\n\nAmostra:\n${topFiles}` }
          ]
        }
      });
      if (error) throw new Error(error);
      const text = typeof res === "string" ? res : (res?.content || res?.choices?.[0]?.message?.content || "Sem sugestões.");
      setAiSummary(text);
      aiCacheRef.current = { key, text, ts: Date.now() };
    } catch { setAiSummary("Não foi possível gerar análise."); }
    finally { setAiLoading(false); }
  }, [files, stats, invoke]);

  // Card: top 3 categories mini bar
  const topCats = stats.activeCats.slice(0, 4);

  // === POPUP ===
  const popupContent = (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        <div className="p-2.5 rounded-xl bg-foreground/5 text-center">
          <p className="text-lg font-bold text-foreground">{files.length}</p>
          <p className="text-[10px] text-muted-foreground">Arquivos</p>
        </div>
        <div className="p-2.5 rounded-xl bg-foreground/5 text-center">
          <p className="text-lg font-bold text-primary">{stats.activeCats.length}</p>
          <p className="text-[10px] text-muted-foreground">Tipos</p>
        </div>
        <div className="p-2.5 rounded-xl bg-foreground/5 text-center">
          <p className="text-lg font-bold text-foreground">{formatSize(stats.totalSize) || "—"}</p>
          <p className="text-[10px] text-muted-foreground">Total</p>
        </div>
        <div className="p-2.5 rounded-xl bg-foreground/5 text-center">
          <p className="text-lg font-bold text-foreground">{stats.recent.length}</p>
          <p className="text-[10px] text-muted-foreground">Recentes</p>
        </div>
      </div>

      {/* AI Analysis */}
      <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Análise IA
          </span>
          <button onClick={generateAiSummary} disabled={aiLoading}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-primary/15 text-primary font-medium hover:bg-primary/25 transition-colors disabled:opacity-50 flex items-center gap-1">
            {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            {aiLoading ? "Analisando..." : aiSummary ? "Atualizar" : "Analisar"}
          </button>
        </div>
        {aiSummary ? (
          <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-line">{aiSummary}</p>
        ) : (
          <p className="text-xs text-muted-foreground/60 italic">Clique para uma análise inteligente dos seus arquivos.</p>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="files" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-8">
          <TabsTrigger value="files" className="text-[11px] gap-1"><FolderOpen className="w-3 h-3" />Arquivos</TabsTrigger>
          <TabsTrigger value="types" className="text-[11px] gap-1"><HardDrive className="w-3 h-3" />Tipos</TabsTrigger>
          <TabsTrigger value="insights" className="text-[11px] gap-1"><BarChart3 className="w-3 h-3" />Insights</TabsTrigger>
        </TabsList>

        {/* Files Tab */}
        <TabsContent value="files" className="space-y-3 mt-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar arquivos..."
              className="w-full bg-foreground/5 rounded-lg pl-8 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none" />
          </div>

          {/* Category filter */}
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setFilterCat("Todos")}
              className={`text-[9px] px-2 py-0.5 rounded-full border font-medium transition-all ${
                filterCat === "Todos" ? "bg-primary/20 text-primary border-primary/30" : "bg-foreground/5 text-muted-foreground border-foreground/10"
              }`}>Todos</button>
            {stats.activeCats.map(({ cat }) => {
              const meta = CATEGORY_META[cat];
              return (
                <button key={cat} onClick={() => setFilterCat(filterCat === cat ? "Todos" : cat)}
                  className={`text-[9px] px-2 py-0.5 rounded-full border font-medium transition-all flex items-center gap-0.5 ${
                    filterCat === cat ? `bg-foreground/10 ${meta.color} border-foreground/20` : "bg-foreground/5 text-muted-foreground border-foreground/10"
                  }`}>
                  <meta.icon className="w-2.5 h-2.5" />{cat}
                </button>
              );
            })}
          </div>

          {/* File list */}
          <div className="space-y-1.5 max-h-[280px] overflow-y-auto scrollbar-thin">
            {filteredFiles.map(f => {
              const meta = CATEGORY_META[f.category];
              return (
                <div key={f.id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-colors group">
                  <f.icon className={`w-5 h-5 shrink-0 ${meta.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className={`px-1.5 py-0.5 rounded-full bg-foreground/5 ${meta.color}`}>{f.category}</span>
                      {f.size ? <span>{formatSize(f.size)}</span> : null}
                      {f.modifiedTime && <span>{relativeTime(f.modifiedTime)}</span>}
                    </div>
                  </div>
                  {f.webViewLink && (
                    <a href={f.webViewLink} target="_blank" rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-foreground/10 shrink-0">
                      <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                    </a>
                  )}
                </div>
              );
            })}
            {filteredFiles.length === 0 && (
              <p className="text-xs text-muted-foreground/60 text-center py-4">Nenhum arquivo encontrado</p>
            )}
          </div>
        </TabsContent>

        {/* Types Tab */}
        <TabsContent value="types" className="space-y-3 mt-3">
          {stats.activeCats.map(({ cat, count }) => {
            const meta = CATEGORY_META[cat];
            const catFiles = files.filter(f => f.category === cat);
            const catSize = catFiles.reduce((s, f) => s + (f.size || 0), 0);
            return (
              <div key={cat} className="p-3 rounded-xl bg-foreground/5">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-medium flex items-center gap-1.5 ${meta.color}`}>
                    <meta.icon className="w-4 h-4" />{cat}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{count} arquivo{count > 1 ? "s" : ""}{catSize > 0 ? ` · ${formatSize(catSize)}` : ""}</span>
                </div>
                <div className="space-y-1">
                  {catFiles.slice(0, 4).map(f => (
                    <div key={f.id} className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-foreground/5 transition-colors">
                      <f.icon className={`w-3.5 h-3.5 shrink-0 ${meta.color}`} />
                      <span className="text-xs text-foreground truncate flex-1">{f.name}</span>
                      {f.size ? <span className="text-[9px] text-muted-foreground tabular-nums">{formatSize(f.size)}</span> : null}
                    </div>
                  ))}
                  {catFiles.length > 4 && (
                    <p className="text-[9px] text-muted-foreground/50 px-2">+{catFiles.length - 4} mais</p>
                  )}
                </div>
              </div>
            );
          })}
          {stats.activeCats.length === 0 && (
            <p className="text-xs text-muted-foreground/60 text-center py-4">Nenhum tipo identificado</p>
          )}
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-3 mt-3">
          {/* Distribution bar chart */}
          {stats.activeCats.length > 0 && (
            <div className="p-3 rounded-xl bg-foreground/5">
              <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-primary" /> Distribuição
              </p>
              <div className="space-y-1.5">
                {stats.activeCats.map(({ cat, count }) => {
                  const pct = files.length > 0 ? Math.round((count / files.length) * 100) : 0;
                  const meta = CATEGORY_META[cat];
                  return (
                    <div key={cat} className="flex items-center gap-2">
                      <meta.icon className={`w-3.5 h-3.5 shrink-0 ${meta.color}`} />
                      <span className="text-[10px] text-muted-foreground w-16 truncate">{cat}</span>
                      <div className="flex-1 h-2 rounded-full bg-foreground/10 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${meta.barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Largest files */}
          {stats.largest.length > 0 && (
            <div className="p-3 rounded-xl bg-foreground/5">
              <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-primary" /> Maiores arquivos
              </p>
              <div className="space-y-1">
                {stats.largest.map((f, i) => {
                  const meta = CATEGORY_META[f.category];
                  return (
                    <div key={f.id} className="flex items-center gap-2 py-1">
                      <span className="text-[10px] font-bold text-muted-foreground w-4 text-right">{i + 1}.</span>
                      <f.icon className={`w-3.5 h-3.5 shrink-0 ${meta.color}`} />
                      <span className="text-xs text-foreground truncate flex-1">{f.name}</span>
                      <span className="text-[10px] text-primary font-medium tabular-nums">{formatSize(f.size)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent files */}
          {stats.recent.length > 0 && (
            <div className="p-3 rounded-xl bg-foreground/5">
              <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" /> Recentes
              </p>
              <div className="space-y-1">
                {stats.recent.map(f => {
                  const meta = CATEGORY_META[f.category];
                  return (
                    <div key={f.id} className="flex items-center gap-2 py-1">
                      <f.icon className={`w-3.5 h-3.5 shrink-0 ${meta.color}`} />
                      <span className="text-xs text-foreground truncate flex-1">{f.name}</span>
                      <span className="text-[9px] text-muted-foreground">{relativeTime(f.modifiedTime)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Storage summary */}
          {stats.totalSize > 0 && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-foreground/5">
              <TrendingUp className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="text-xs font-medium text-foreground">Tamanho médio</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatSize(Math.round(stats.totalSize / files.length))} por arquivo
                </p>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );

  // === COMPACT CARD ===
  return (
    <GlassCard className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <WidgetTitle label="Arquivos" icon={<FolderOpen className="w-3.5 h-3.5 text-amber-400" />}
            popupIcon={<FolderOpen className="w-5 h-5 text-primary" />} popupContent={files.length > 0 ? popupContent : undefined} />
          <ConnectionBadge isConnected={isConnected} isLoading={isLoading} sourceCount={googleConnected ? 1 : connectionIds.length} sourceNames={sourceNames} />
        </div>
        <div className="flex items-center gap-1">
          {isConnected && files.length > 0 && (
            <button onClick={() => setView(view === "list" ? "grid" : "list")} className="text-muted-foreground hover:text-primary transition-colors">
              {view === "list" ? <LayoutGrid className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
            </button>
          )}
          <DeshTooltip label="Ver tudo">
            <button onClick={() => navigate("/files")} className="text-muted-foreground hover:text-primary transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </DeshTooltip>
        </div>
      </div>

      {driveNeedsScope && <ScopeRequestBanner service="drive" onRequest={driveRequestScope} />}

      {(!isConnected && !isDemoMode) ? (
        <WidgetEmptyState icon={FolderOpen} title="Nenhum arquivo" description="Conecte seu armazenamento para ver seus arquivos" connectTo="/integrations" connectLabel="Conectar armazenamento" />
      ) : (
        <>
          {/* Mini stats bar */}
          <div className="flex items-center gap-3 mb-2 shrink-0">
            <span className="text-[10px] text-muted-foreground">{files.length} arquivos</span>
            {stats.totalSize > 0 && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <HardDrive className="w-2.5 h-2.5" />{formatSize(stats.totalSize)}
              </span>
            )}
            {topCats.length > 0 && (
              <div className="flex items-center gap-1 ml-auto">
                {topCats.slice(0, 3).map(({ cat, count }) => {
                  const meta = CATEGORY_META[cat];
                  return (
                    <span key={cat} className={`text-[9px] flex items-center gap-0.5 ${meta.color}`} title={`${cat}: ${count}`}>
                      <meta.icon className="w-2.5 h-2.5" />{count}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* File list */}
          <div className={`flex-1 overflow-y-auto min-h-0 scrollbar-thin ${view === "grid" ? "grid grid-cols-2 gap-1.5" : "space-y-1"}`}>
            {files.slice(0, view === "grid" ? 8 : 6).map(f => {
              const meta = CATEGORY_META[f.category];
              if (view === "grid") {
                return (
                  <div key={f.id} className="p-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 transition-colors cursor-pointer flex flex-col items-center gap-1">
                    <f.icon className={`w-5 h-5 ${meta.color}`} />
                    <p className="text-[10px] text-foreground truncate w-full text-center">{f.name}</p>
                    {f.size ? <p className="text-[9px] text-muted-foreground">{formatSize(f.size)}</p> : null}
                  </div>
                );
              }
              return (
                <div key={f.id} className="flex items-center gap-2 py-1.5 px-1.5 rounded-lg hover:bg-foreground/5 transition-colors">
                  <f.icon className={`w-4 h-4 shrink-0 ${meta.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground/80 truncate">{f.name}</p>
                    <div className="flex gap-2 text-[10px] text-muted-foreground">
                      {f.size ? <span>{formatSize(f.size)}</span> : null}
                      {f.modifiedTime && <span>{relativeTime(f.modifiedTime)}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
            {files.length === 0 && <WidgetEmptyState icon={FolderOpen} title="Nenhum arquivo encontrado" />}
          </div>

          {/* Footer */}
          {files.length > 6 && (
            <div className="mt-2 pt-1.5 border-t border-foreground/5 shrink-0">
              <button onClick={() => navigate("/files")} className="text-[10px] text-muted-foreground hover:text-primary transition-colors">
                Ver todos os {files.length} arquivos →
              </button>
            </div>
          )}
        </>
      )}
    </GlassCard>
  );
};

export default React.memo(FilesWidget);
