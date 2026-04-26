import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Download, FileText, Loader2, Sparkles, Check,
  CalendarPlus, ListTodo, Clock,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { useCalendarActions } from "@/hooks/integrations/useCalendarActions";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/* ─── Types ──────────────────────────────────────────────────────────────── */
export interface ExportInteraction {
  id: string;
  type: string;
  title: string;
  description?: string;
  interaction_date: string;
}

export interface ExportContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  tags?: string[];
  notes?: string;
}

export interface ExportSummary {
  count: number;
  lastDate: string | null;
  typeCounts: Record<string, number>;
}

interface Props {
  contact: ExportContact;
  summary: ExportSummary;
  score: number;
  interactions: ExportInteraction[];
  allInteractions: { contact_id: string; interaction_date: string; type: string }[];
  aiSuggestion?: string | null;
  onClose: () => void;
}

/* ─── Score helpers ───────────────────────────────────────────────────────── */
const scoreLabel = (s: number) =>
  s >= 80 ? "Forte" : s >= 55 ? "Bom" : s >= 30 ? "Fraco" : s > 0 ? "Inicial" : "Sem dados";

const scoreColor = (s: number) =>
  s >= 80 ? "#4ade80" : s >= 55 ? "hsl(var(--primary))" : s >= 30 ? "#f59e0b" : "#6b7280";

/* ─── Extract a date from a free-text AI suggestion ─────────────────────── */
function extractDateFromSuggestion(suggestion: string | null): string {
  const fallback = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];
  if (!suggestion) return fallback;
  const s = suggestion.toLowerCase();
  const daysMatch = s.match(/em\s+(\d+)\s+dia/);
  const weeksMatch = s.match(/em\s+(\d+)\s+semana/);
  if (daysMatch) return new Date(Date.now() + Number(daysMatch[1]) * 86400000).toISOString().split("T")[0];
  if (weeksMatch) return new Date(Date.now() + Number(weeksMatch[1]) * 7 * 86400000).toISOString().split("T")[0];
  if (s.includes("esta semana") || s.includes("essa semana"))
    return new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0];
  if (s.includes("próxima semana") || s.includes("proxima semana"))
    return new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
  if (s.includes("próximo mês") || s.includes("proximo mes"))
    return new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
  return fallback;
}

/* ─── Build 12-week sparkline data ──────────────────────────────────────── */
function buildWeeklyData(contactId: string, all: Props["allInteractions"], weeks = 12) {
  const now = Date.now();
  return Array.from({ length: weeks }, (_, i) => {
    const wStart = now - (weeks - 1 - i) * 7 * 86400000;
    const wEnd = wStart + 7 * 86400000;
    const label = new Date(wStart).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const count = all.filter(r => {
      if (r.contact_id !== contactId) return false;
      const t = new Date(r.interaction_date).getTime();
      return t >= wStart && t < wEnd;
    }).length;
    return { semana: label, interações: count };
  });
}

const interactionTypeLabels: Record<string, string> = {
  call: "Ligação", email: "E-mail", meeting: "Reunião", note: "Nota",
};

/* ─── CSV export ─────────────────────────────────────────────────────────── */
function exportContactCsv(contact: ExportContact, summary: ExportSummary, score: number, interactions: ExportInteraction[], aiSuggestion: string | null) {
  const filename = `relacionamento_${contact.name.replace(/\s+/g, "_")}`;
  const profileRows: string[][] = [
    ["Nome", contact.name],
    ["E-mail", contact.email || ""],
    ["Telefone", contact.phone || ""],
    ["Empresa", contact.company || ""],
    ["Cargo", contact.role || ""],
    ["Tags", (contact.tags || []).join("; ")],
    ["Score de Relacionamento", String(score)],
    ["Nível", scoreLabel(score)],
    ["Total de interações", String(summary.count)],
    ["Última interação", summary.lastDate ? new Date(summary.lastDate).toLocaleDateString("pt-BR") : "—"],
    ["Sugestão IA", aiSuggestion || "—"],
  ];
  const intHeaders = ["Data", "Tipo", "Título", "Descrição"];
  const intRows: string[][] = interactions.map(i => [
    new Date(i.interaction_date).toLocaleDateString("pt-BR"),
    interactionTypeLabels[i.type] || i.type,
    i.title,
    i.description || "",
  ]);
  const csvLines: string[] = [
    "=== PERFIL E SCORE ===",
    ["Campo", "Valor"].map(c => `"${c}"`).join(","),
    ...profileRows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")),
    "",
    "=== HISTÓRICO DE INTERAÇÕES ===",
    intHeaders.map(c => `"${c}"`).join(","),
    ...intRows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")),
  ];
  const blob = new Blob(["\uFEFF" + csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/* ─── PDF (print) export ─────────────────────────────────────────────────── */
function printContactPdf(
  contact: ExportContact,
  summary: ExportSummary,
  score: number,
  interactions: ExportInteraction[],
  aiSuggestion: string | null,
  weeklyData: { semana: string; interações: number }[],
) {
  const color = scoreColor(score);
  const barWidth = Math.round(score);
  const date = new Date().toLocaleDateString("pt-BR");
  const interactionHtml = interactions.map(i => `
    <tr>
      <td style="padding:6px 8px; border-bottom:1px solid #eee; font-size:11px;">${new Date(i.interaction_date).toLocaleDateString("pt-BR")}</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee; font-size:11px;">${interactionTypeLabels[i.type] || i.type}</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee; font-size:11px;">${i.title}</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee; font-size:11px; color:#555;">${i.description || ""}</td>
    </tr>
  `).join("");
  const maxVal = Math.max(...weeklyData.map(d => d.interações), 1);
  const W = 480, H = 60, pad = 8;
  const xs = weeklyData.map((_, i) => pad + (i / (weeklyData.length - 1)) * (W - pad * 2));
  const ys = weeklyData.map(d => H - pad - (d.interações / maxVal) * (H - pad * 2));
  const polyline = xs.map((x, i) => `${x},${ys[i]}`).join(" ");
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relatório — ${contact.name}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; padding: 32px; max-width: 700px; margin: 0 auto; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .sub { color: #666; font-size: 13px; margin-bottom: 24px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #888; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; }
    .info-item { font-size: 12px; }
    .info-label { color: #888; font-size: 10px; text-transform: uppercase; }
    .score-bar-bg { background: #eee; border-radius: 99px; height: 8px; margin: 6px 0 2px; overflow: hidden; }
    .score-bar { height: 8px; border-radius: 99px; background: ${color}; width: ${barWidth}%; }
    .score-num { font-size: 28px; font-weight: 800; color: ${color}; }
    table { width: 100%; border-collapse: collapse; }
    th { font-size: 10px; text-transform: uppercase; color: #888; text-align: left; padding: 6px 8px; border-bottom: 2px solid #eee; }
    .ai-box { background: #f5f3ff; border: 1px solid #d8b4fe; border-radius: 8px; padding: 12px 16px; font-size: 12px; line-height: 1.6; color: #4b2aa8; }
    svg { display: block; margin: 0 auto; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <h1>${contact.name}</h1>
  <div class="sub">${[contact.role, contact.company].filter(Boolean).join(" @ ")} &nbsp;•&nbsp; Gerado em ${date}</div>
  <div class="section">
    <div class="section-title">Informações de Contato</div>
    <div class="info-grid">
      ${contact.email ? `<div class="info-item"><div class="info-label">E-mail</div>${contact.email}</div>` : ""}
      ${contact.phone ? `<div class="info-item"><div class="info-label">Telefone</div>${contact.phone}</div>` : ""}
      ${contact.company ? `<div class="info-item"><div class="info-label">Empresa</div>${contact.company}</div>` : ""}
      ${contact.role ? `<div class="info-item"><div class="info-label">Cargo</div>${contact.role}</div>` : ""}
      ${contact.tags?.length ? `<div class="info-item"><div class="info-label">Tags</div>${contact.tags.join(", ")}</div>` : ""}
    </div>
  </div>
  <div class="section">
    <div class="section-title">Score de Relacionamento</div>
    <div class="score-num">${score} <span style="font-size:14px; font-weight:500; color:#888;">${scoreLabel(score)}</span></div>
    <div class="score-bar-bg"><div class="score-bar"></div></div>
    <div style="font-size:11px; color:#888; margin-top:4px;">
      ${summary.count} interação${summary.count !== 1 ? "ões" : ""} &nbsp;•&nbsp;
      Última: ${summary.lastDate ? new Date(summary.lastDate).toLocaleDateString("pt-BR") : "—"}
    </div>
  </div>
  <div class="section">
    <div class="section-title">Evolução Semanal (últimos 3 meses)</div>
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
      ${xs.map((x, i) => weeklyData[i].interações > 0 ? `<circle cx="${x}" cy="${ys[i]}" r="3" fill="${color}"/>` : "").join("")}
    </svg>
    <div style="font-size:10px; color:#999; text-align:center; margin-top:4px;">semanas recentes →</div>
  </div>
  ${aiSuggestion ? `<div class="section"><div class="section-title">Sugestão de IA</div><div class="ai-box">${aiSuggestion}</div></div>` : ""}
  <div class="section">
    <div class="section-title">Histórico de Interações (${interactions.length})</div>
    ${interactions.length > 0 ? `<table><thead><tr><th>Data</th><th>Tipo</th><th>Título</th><th>Detalhes</th></tr></thead><tbody>${interactionHtml}</tbody></table>` : `<p style="font-size:12px; color:#999;">Nenhuma interação registrada.</p>`}
  </div>
</body>
</html>`;
  const win = window.open("", "_blank", "width=800,height=700");
  if (!win) { toast({ title: "Pop-up bloqueado", description: "Permita pop-ups para gerar o PDF.", variant: "destructive" }); return; }
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 400);
}

/* ─── Modal component ────────────────────────────────────────────────────── */
export default function ContactExportModal({ contact, summary, score, interactions, allInteractions, aiSuggestion: initialSuggestion, onClose }: Props) {
  const { invoke } = useEdgeFn();
  const calendar = useCalendarActions();
  const { user } = useAuth();
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(initialSuggestion || null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [exported, setExported] = useState<"csv" | "pdf" | null>(null);

  // Follow-up scheduling state
  const [followUpDate, setFollowUpDate] = useState<string>(() => extractDateFromSuggestion(initialSuggestion || null));
  const [followUpTime, setFollowUpTime] = useState("10:00");
  const [followUpTitle, setFollowUpTitle] = useState(`Follow-up com ${contact.name}`);
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [scheduled, setScheduled] = useState<"calendar" | "task" | null>(null);

  const weeklyData = buildWeeklyData(contact.id, allInteractions);
  const color = scoreColor(score);

  // Update suggested date when AI suggestion arrives
  const fetchAISuggestion = useCallback(async () => {
    if (aiSuggestion) return;
    setLoadingAi(true);
    try {
      const { data } = await invoke<any>({
        fn: "ai-router",
        body: {
          module: "contacts",
          action: "suggest_followup",
          contact: {
            name: contact.name, company: contact.company, role: contact.role,
            last_interaction: summary.lastDate, score, interaction_count: summary.count,
          },
        },
      });
      const suggestion = data?.result?.suggestion || data?.result || null;
      setAiSuggestion(suggestion);
      // Auto-fill the follow-up date with the extracted date
      if (suggestion) setFollowUpDate(extractDateFromSuggestion(suggestion));
    } catch {
      toast({ title: "Erro na IA", description: "Não foi possível gerar sugestão.", variant: "destructive" });
    } finally {
      setLoadingAi(false);
    }
  }, [aiSuggestion, contact, summary, score, invoke]);

  /* ─── Create Google Calendar event ──────────────────────────────────────── */
  const handleScheduleCalendar = useCallback(async () => {
    setScheduling(true);
    try {
      const startDt = new Date(`${followUpDate}T${followUpTime}:00`);
      const endDt = new Date(startDt.getTime() + 60 * 60000); // 1h duration

      const eventBody: Record<string, unknown> = {
        calendar_id: "primary",
        summary: followUpTitle,
        description: [
          aiSuggestion ? `Sugestão IA: ${aiSuggestion}` : "",
          followUpNotes,
          `Contato: ${contact.name}${contact.company ? ` (${contact.company})` : ""}`,
          contact.email ? `E-mail: ${contact.email}` : "",
        ].filter(Boolean).join("\n\n"),
        start_datetime: startDt.toISOString(),
        end_datetime: endDt.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(contact.email ? { attendees: [{ email: contact.email }] } : {}),
      };

      await calendar.createEvent(eventBody);
      setScheduled("calendar");
      toast({
        title: "Evento criado no Google Calendar! 📅",
        description: `"${followUpTitle}" agendado para ${new Date(`${followUpDate}T${followUpTime}`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })} às ${followUpTime}.`,
      });
    } catch (err: any) {
      toast({ title: "Erro ao criar evento", description: err?.message || "Verifique a conexão com o Google.", variant: "destructive" });
    } finally {
      setScheduling(false);
    }
  }, [calendar, followUpDate, followUpTime, followUpTitle, followUpNotes, aiSuggestion, contact]);

  /* ─── Create local task ──────────────────────────────────────────────────── */
  const handleScheduleTask = useCallback(async () => {
    if (!user) return;
    setScheduling(true);
    try {
      const { error } = await supabase.from("tasks").insert({
        user_id: user.id,
        title: followUpTitle,
        description: [
          aiSuggestion ? `Sugestão IA: ${aiSuggestion}` : "",
          followUpNotes,
          contact.email ? `E-mail: ${contact.email}` : "",
          contact.phone ? `Tel: ${contact.phone}` : "",
        ].filter(Boolean).join("\n"),
        due_date: followUpDate,
        priority: "high",
        status: "todo",
      });

      if (error) throw error;
      setScheduled("task");
      toast({
        title: "Tarefa criada! ✅",
        description: `"${followUpTitle}" adicionada para ${new Date(`${followUpDate}T12:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}.`,
      });
    } catch (err: any) {
      toast({ title: "Erro ao criar tarefa", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setScheduling(false);
    }
  }, [user, supabase, followUpDate, followUpTitle, followUpNotes, aiSuggestion, contact]);

  const handleCsv = () => {
    exportContactCsv(contact, summary, score, interactions, aiSuggestion);
    setExported("csv");
    toast({ title: "CSV exportado", description: `${contact.name} — histórico de relacionamento.` });
  };

  const handlePdf = () => {
    printContactPdf(contact, summary, score, interactions, aiSuggestion, weeklyData);
    setExported("pdf");
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="w-full max-w-lg mx-4 bg-background/90 backdrop-blur-xl border border-foreground/10 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/8 flex-shrink-0">
            <div>
              <p className="text-sm font-semibold text-foreground">Exportar Relacionamento</p>
              <p className="text-[11px] text-muted-foreground">{contact.name}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-foreground/10 text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>

          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* Score preview */}
            <div className="p-3 rounded-xl bg-foreground/5 border border-foreground/8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Score de Relacionamento</span>
                <span className="text-base font-bold tabular-nums" style={{ color }}>{score}</span>
              </div>
              <div className="h-1.5 bg-foreground/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
              </div>
              <div className="mt-1.5 text-[9px] text-muted-foreground">
                {summary.count} interação{summary.count !== 1 ? "ões" : ""} &nbsp;•&nbsp; {scoreLabel(score)}
                {summary.lastDate && ` • Última há ${Math.floor((Date.now() - new Date(summary.lastDate).getTime()) / 86400000)}d`}
              </div>
            </div>

            {/* Sparkline preview */}
            {weeklyData.some(d => d.interações > 0) && (
              <div className="p-3 rounded-xl bg-foreground/5 border border-foreground/8">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Evolução Semanal — 3 meses</p>
                <ResponsiveContainer width="100%" height={60}>
                  <AreaChart data={weeklyData} margin={{ top: 4, right: 4, left: -32, bottom: 0 }}>
                    <defs>
                      <linearGradient id="exportGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="semana" tick={{ fontSize: 8 }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 8 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      content={({ active, payload }) =>
                        active && payload?.length ? (
                          <div className="bg-background/90 border border-foreground/10 rounded px-2 py-1 text-[10px] text-foreground shadow-sm">
                            {payload[0].value} interação{Number(payload[0].value) !== 1 ? "ões" : ""}
                          </div>
                        ) : null
                      }
                    />
                    <Area type="monotone" dataKey="interações" stroke={color} strokeWidth={1.5} fill="url(#exportGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* AI suggestion */}
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] uppercase tracking-wider text-primary font-medium">Sugestão IA</span>
                </div>
                {!aiSuggestion && (
                  <button onClick={fetchAISuggestion} disabled={loadingAi}
                    className="flex items-center gap-1 text-[10px] text-primary hover:underline disabled:opacity-50">
                    {loadingAi ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {loadingAi ? "Gerando..." : "Gerar"}
                  </button>
                )}
              </div>
              {aiSuggestion ? (
                <p className="text-xs text-foreground/80 leading-relaxed">{aiSuggestion}</p>
              ) : (
                <p className="text-xs text-muted-foreground italic">Clique em "Gerar" para obter uma sugestão personalizada antes de exportar.</p>
              )}
            </div>

            {/* ── Follow-up scheduling ──────────────────────────────────────── */}
            <div className="rounded-xl border border-foreground/10 overflow-hidden">
              {/* Section header */}
              <div className="px-3 py-2.5 bg-foreground/5 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] uppercase tracking-wider text-foreground font-semibold">Agendar Follow-up</span>
                {scheduled && (
                  <span className="ml-auto flex items-center gap-1 text-[10px] text-green-400 font-medium">
                    <Check className="w-3 h-3" />
                    {scheduled === "calendar" ? "Evento criado!" : "Tarefa criada!"}
                  </span>
                )}
              </div>

              <div className="p-3 space-y-3">
                {/* Title */}
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1 block">Título</label>
                  <input
                    value={followUpTitle}
                    onChange={e => setFollowUpTitle(e.target.value)}
                    className="w-full bg-foreground/5 rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/30"
                    placeholder="Título do follow-up..."
                  />
                </div>

                {/* Date + Time row */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1 block">Data</label>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={e => setFollowUpDate(e.target.value)}
                      className="w-full bg-foreground/5 rounded-lg px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1 block">Horário (Calendar)</label>
                    <input
                      type="time"
                      value={followUpTime}
                      onChange={e => setFollowUpTime(e.target.value)}
                      className="w-full bg-foreground/5 rounded-lg px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1 block">Notas (opcional)</label>
                  <textarea
                    value={followUpNotes}
                    onChange={e => setFollowUpNotes(e.target.value)}
                    rows={2}
                    placeholder="Contexto ou pauta..."
                    className="w-full bg-foreground/5 rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none resize-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button
                    onClick={handleScheduleCalendar}
                    disabled={scheduling || !followUpTitle.trim()}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    {scheduling
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : scheduled === "calendar"
                      ? <Check className="w-3.5 h-3.5 text-green-400" />
                      : <CalendarPlus className="w-3.5 h-3.5" />}
                    Google Calendar
                  </button>
                  <button
                    onClick={handleScheduleTask}
                    disabled={scheduling || !followUpTitle.trim()}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-foreground/5 text-foreground text-xs font-medium hover:bg-foreground/10 transition-colors disabled:opacity-50"
                  >
                    {scheduling
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : scheduled === "task"
                      ? <Check className="w-3.5 h-3.5 text-green-400" />
                      : <ListTodo className="w-3.5 h-3.5" />}
                    Criar Tarefa
                  </button>
                </div>
                <p className="text-[9px] text-muted-foreground">
                  Google Calendar cria evento de 1h com o contato como participante (se disponível). Tarefa é salva com prioridade alta no seu quadro.
                </p>
              </div>
            </div>

            {/* Export buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleCsv}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-foreground/10 bg-foreground/5 hover:bg-foreground/10 transition-colors">
                {exported === "csv" ? <Check className="w-5 h-5 text-green-400" /> : <Download className="w-5 h-5 text-muted-foreground" />}
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Exportar CSV</p>
                  <p className="text-[10px] text-muted-foreground">Planilha com score e histórico</p>
                </div>
              </button>

              <button onClick={handlePdf}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors">
                {exported === "pdf" ? <Check className="w-5 h-5 text-green-400" /> : <FileText className="w-5 h-5 text-primary" />}
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Gerar PDF</p>
                  <p className="text-[10px] text-muted-foreground">Relatório visual completo</p>
                </div>
              </button>
            </div>

            <p className="text-[10px] text-muted-foreground text-center">
              {interactions.length} interação{interactions.length !== 1 ? "ões" : ""} incluída{interactions.length !== 1 ? "s" : ""}
              {aiSuggestion ? " · Sugestão IA incluída" : ""}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
