import { useState, useCallback, useRef, useMemo } from "react";
import {
  Save, X, Eye, Code, Bold, Italic, Link, Image, Type, AlignLeft, AlignCenter,
  List, ListOrdered, Minus, Square, Variable, Braces, Copy, Undo2, Redo2,
  Palette, LayoutGrid, Sparkles, ChevronDown, ChevronRight, HelpCircle,
  Send, Table, Columns, FileCode2, Wand2,
} from "lucide-react";
import DeshTooltip from "@/components/ui/DeshTooltip";

interface EmailTemplate {
  id?: string;
  slug: string;
  name: string;
  subject_template: string;
  body_html: string;
  type: string;
  active: boolean;
}

interface Props {
  template: EmailTemplate | null;
  onSave: (data: Partial<EmailTemplate>) => void;
  onCancel: () => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────
const VARIABLES = [
  { key: "display_name", label: "Nome do usuário", example: "João Silva" },
  { key: "credits_balance", label: "Saldo de créditos", example: "150" },
  { key: "credits_amount", label: "Créditos comprados", example: "500" },
  { key: "tasks_due", label: "Tarefas pendentes", example: "5" },
  { key: "tasks_completed", label: "Tarefas concluídas", example: "12" },
  { key: "events_today", label: "Eventos hoje", example: "3" },
  { key: "events_attended", label: "Eventos participados", example: "8" },
  { key: "title", label: "Título", example: "Reunião Semanal" },
  { key: "message", label: "Mensagem", example: "Corpo da mensagem aqui." },
  { key: "time_label", label: "Label de tempo", example: "em 2 horas" },
  { key: "time_str", label: "Horário", example: "14:30" },
  { key: "minutes", label: "Minutos", example: "30" },
  { key: "days_inactive", label: "Dias inativo", example: "7" },
  { key: "connection_name", label: "Nome da conexão", example: "Gmail" },
  { key: "platform", label: "Plataforma", example: "Google" },
  { key: "ip", label: "Endereço IP", example: "189.34.22.101" },
  { key: "user_agent", label: "Dispositivo", example: "Chrome/Windows" },
  { key: "broadcast_type", label: "Tipo broadcast", example: "info" },
  { key: "app_url", label: "URL do app", example: "https://desh-ws.lovable.app" },
];

const BRAND = {
  primary: "#C8956C",
  dark: "#1A1A28",
  secondary: "#636366",
  muted: "#8E8E93",
  cardBg: "#F9F7F5",
  cardBorder: "#E8E4E0",
};

const SNIPPETS = [
  {
    name: "Botão CTA",
    icon: "🔘",
    code: `<table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr><td style="background-color:${BRAND.primary};border-radius:16px;">
    <a href="{{app_url}}" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Texto do botão →</a>
  </td></tr>
</table>`,
  },
  {
    name: "Card de informação",
    icon: "📋",
    code: `<div style="background-color:${BRAND.cardBg};padding:20px 24px;border-radius:12px;border:1px solid ${BRAND.cardBorder};border-left:4px solid ${BRAND.primary};">
  <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:${BRAND.dark};">Título do card</p>
  <p style="margin:0;font-size:13px;color:${BRAND.secondary};">Descrição ou detalhe aqui</p>
</div>`,
  },
  {
    name: "Stat cards (2 cols)",
    icon: "📊",
    code: `<table width="100%" cellpadding="0" cellspacing="8" border="0" style="margin:16px 0;">
  <tr>
    <td style="background-color:${BRAND.cardBg};padding:20px;border-radius:12px;text-align:center;border:1px solid ${BRAND.cardBorder};">
      <p style="margin:0;font-size:20px;">📋</p>
      <p style="margin:8px 0 4px;font-size:28px;font-weight:700;color:${BRAND.primary};">{{tasks_due}}</p>
      <p style="margin:0;font-size:12px;color:${BRAND.muted};">Tarefas pendentes</p>
    </td>
    <td style="background-color:${BRAND.cardBg};padding:20px;border-radius:12px;text-align:center;border:1px solid ${BRAND.cardBorder};">
      <p style="margin:0;font-size:20px;">📅</p>
      <p style="margin:8px 0 4px;font-size:28px;font-weight:700;color:#8B5CF6;">{{events_today}}</p>
      <p style="margin:0;font-size:12px;color:${BRAND.muted};">Eventos hoje</p>
    </td>
  </tr>
</table>`,
  },
  {
    name: "Alerta (warning)",
    icon: "⚠️",
    code: `<div style="background-color:#FFFBEB;padding:20px 24px;border-radius:12px;border:1px solid #FDE68A;">
  <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#92400E;">⚠️ Atenção</p>
  <p style="margin:0;font-size:14px;color:#A16207;">Mensagem de alerta aqui.</p>
</div>`,
  },
  {
    name: "Alerta (erro)",
    icon: "🔴",
    code: `<div style="background-color:#FEF2F2;padding:20px 24px;border-radius:12px;border:1px solid #FECACA;">
  <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#991B1B;">🔒 Alerta de segurança</p>
  <p style="margin:0;font-size:14px;color:#B91C1C;">Descrição do alerta.</p>
</div>`,
  },
  {
    name: "Alerta (sucesso)",
    icon: "✅",
    code: `<div style="background-color:#F0FDF4;padding:20px 24px;border-radius:12px;border:1px solid #BBF7D0;">
  <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#166534;">✅ Sucesso</p>
  <p style="margin:0;font-size:14px;color:#15803D;">Operação concluída com sucesso.</p>
</div>`,
  },
  {
    name: "Barra de progresso",
    icon: "📶",
    code: `<div style="margin:16px 0;">
  <p style="margin:0 0 8px;font-size:13px;color:${BRAND.muted};">Progresso</p>
  <div style="background-color:${BRAND.cardBorder};border-radius:8px;height:8px;overflow:hidden;">
    <div style="background-color:${BRAND.primary};height:8px;border-radius:8px;width:65%;"></div>
  </div>
</div>`,
  },
  {
    name: "Grid 2x2 (features)",
    icon: "📐",
    code: `<table width="100%" cellpadding="0" cellspacing="8" border="0" style="margin:16px 0;">
  <tr>
    <td width="50%" style="background-color:${BRAND.cardBg};padding:20px;border-radius:12px;border:1px solid ${BRAND.cardBorder};vertical-align:top;">
      <p style="margin:0 0 8px;font-size:20px;">📋</p>
      <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:${BRAND.dark};">Tarefas</p>
      <p style="margin:0;font-size:12px;color:${BRAND.secondary};">Organize seu dia</p>
    </td>
    <td width="50%" style="background-color:${BRAND.cardBg};padding:20px;border-radius:12px;border:1px solid ${BRAND.cardBorder};vertical-align:top;">
      <p style="margin:0 0 8px;font-size:20px;">📧</p>
      <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:${BRAND.dark};">E-mail</p>
      <p style="margin:0;font-size:12px;color:${BRAND.secondary};">Gmail integrado</p>
    </td>
  </tr>
  <tr>
    <td width="50%" style="background-color:${BRAND.cardBg};padding:20px;border-radius:12px;border:1px solid ${BRAND.cardBorder};vertical-align:top;">
      <p style="margin:0 0 8px;font-size:20px;">💰</p>
      <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:${BRAND.dark};">Finanças</p>
      <p style="margin:0;font-size:12px;color:${BRAND.secondary};">Controle total</p>
    </td>
    <td width="50%" style="background-color:${BRAND.cardBg};padding:20px;border-radius:12px;border:1px solid ${BRAND.cardBorder};vertical-align:top;">
      <p style="margin:0 0 8px;font-size:20px;">🤖</p>
      <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:${BRAND.dark};">IA Pandora</p>
      <p style="margin:0;font-size:12px;color:${BRAND.secondary};">Assistente pessoal</p>
    </td>
  </tr>
</table>`,
  },
  {
    name: "Tabela de detalhes",
    icon: "📝",
    code: `<div style="background-color:${BRAND.cardBg};padding:24px;border-radius:12px;border:1px solid ${BRAND.cardBorder};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="padding:8px 0;border-bottom:1px solid ${BRAND.cardBorder};">
      <p style="margin:0;font-size:13px;color:${BRAND.secondary};">Label</p>
    </td><td style="padding:8px 0;text-align:right;border-bottom:1px solid ${BRAND.cardBorder};">
      <p style="margin:0;font-size:14px;font-weight:600;color:${BRAND.dark};">Valor</p>
    </td></tr>
    <tr><td style="padding:8px 0;">
      <p style="margin:0;font-size:13px;color:${BRAND.secondary};">Label 2</p>
    </td><td style="padding:8px 0;text-align:right;">
      <p style="margin:0;font-size:14px;font-weight:600;color:${BRAND.dark};">Valor 2</p>
    </td></tr>
  </table>
</div>`,
  },
  {
    name: "Separador",
    icon: "➖",
    code: `<div style="height:1px;background-color:${BRAND.cardBorder};margin:24px 0;"></div>`,
  },
];

const HTML_TAGS: { label: string; icon: React.ElementType; before: string; after: string }[] = [
  { label: "Negrito", icon: Bold, before: "<strong>", after: "</strong>" },
  { label: "Itálico", icon: Italic, before: "<em>", after: "</em>" },
  { label: "Link", icon: Link, before: '<a href="URL" style="color:#C8956C;text-decoration:underline;">', after: "</a>" },
  { label: "Parágrafo", icon: Type, before: `<p style="margin:0 0 12px;font-size:15px;color:${BRAND.dark};line-height:1.6;">`, after: "</p>" },
  { label: "Título H1", icon: AlignLeft, before: `<h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:${BRAND.dark};">`, after: "</h1>" },
  { label: "Título H2", icon: AlignCenter, before: `<h2 style="margin:0 0 8px;font-size:18px;font-weight:600;color:${BRAND.dark};">`, after: "</h2>" },
  { label: "Lista", icon: List, before: `<ul style="padding-left:20px;color:${BRAND.dark};font-size:14px;line-height:2;"><li>`, after: "</li></ul>" },
  { label: "Imagem", icon: Image, before: '<img src="URL" alt="Descrição" width="100%" style="border-radius:12px;display:block;" />', after: "" },
  { label: "Linha horizontal", icon: Minus, before: `<div style="height:1px;background-color:${BRAND.cardBorder};margin:20px 0;"></div>`, after: "" },
];

// ─── Sample data for preview ────────────────────────────────────────────────
const SAMPLE_DATA: Record<string, string> = {};
VARIABLES.forEach(v => { SAMPLE_DATA[v.key] = v.example; });

function replaceVarsPreview(html: string): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => SAMPLE_DATA[key] ?? `{{${key}}}`);
}

// ─── Component ──────────────────────────────────────────────────────────────
const EmailTemplateEditor = ({ template, onSave, onCancel }: Props) => {
  const [slug, setSlug] = useState(template?.slug || "");
  const [name, setName] = useState(template?.name || "");
  const [subjectTemplate, setSubjectTemplate] = useState(template?.subject_template || "");
  const [bodyHtml, setBodyHtml] = useState(template?.body_html || "");
  const [type, setType] = useState(template?.type || "transactional");
  const [viewMode, setViewMode] = useState<"code" | "preview" | "split">("split");
  const [showVars, setShowVars] = useState(false);
  const [showSnippets, setShowSnippets] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [history, setHistory] = useState<string[]>([template?.body_html || ""]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const pushHistory = useCallback((val: string) => {
    setHistory(prev => {
      const newHist = [...prev.slice(0, historyIdx + 1), val];
      if (newHist.length > 50) newHist.shift();
      return newHist;
    });
    setHistoryIdx(prev => Math.min(prev + 1, 49));
  }, [historyIdx]);

  const updateBody = useCallback((val: string) => {
    setBodyHtml(val);
    pushHistory(val);
  }, [pushHistory]);

  const undo = useCallback(() => {
    if (historyIdx > 0) {
      const newIdx = historyIdx - 1;
      setHistoryIdx(newIdx);
      setBodyHtml(history[newIdx]);
    }
  }, [historyIdx, history]);

  const redo = useCallback(() => {
    if (historyIdx < history.length - 1) {
      const newIdx = historyIdx + 1;
      setHistoryIdx(newIdx);
      setBodyHtml(history[newIdx]);
    }
  }, [historyIdx, history]);

  const insertAtCursor = useCallback((text: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      updateBody(bodyHtml + text);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newVal = bodyHtml.slice(0, start) + text + bodyHtml.slice(end);
    updateBody(newVal);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + text.length;
    });
  }, [bodyHtml, updateBody]);

  const wrapSelection = useCallback((before: string, after: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      updateBody(bodyHtml + before + after);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = bodyHtml.slice(start, end) || "texto";
    const newVal = bodyHtml.slice(0, start) + before + selected + after + bodyHtml.slice(end);
    updateBody(newVal);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = start + before.length;
      ta.selectionEnd = start + before.length + selected.length;
    });
  }, [bodyHtml, updateBody]);

  const insertVariable = useCallback((key: string) => {
    insertAtCursor(`{{${key}}}`);
    setShowVars(false);
  }, [insertAtCursor]);

  const insertSnippet = useCallback((code: string) => {
    insertAtCursor("\n" + code + "\n");
    setShowSnippets(false);
  }, [insertAtCursor]);

  const handleSubmit = () => {
    if (!slug.trim() || !name.trim()) return;
    onSave({ slug, name, subject_template: subjectTemplate, body_html: bodyHtml, type, active: template?.active ?? true });
  };

  const previewHtml = useMemo(() => {
    const LOGO = "https://fzidukdcyqsqajoebdfe.supabase.co/storage/v1/object/public/email-assets/desh-logo.png";
    const FONT = "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const replaced = replaceVarsPreview(bodyHtml);
    return `<div style="background:#ffffff;font-family:${FONT};padding:32px 28px;max-width:600px;margin:0 auto;">
      <img src="${LOGO}" alt="DESH" width="44" height="44" style="display:block;margin-bottom:24px;" />
      ${replaced}
      <div style="height:1px;background:${BRAND.cardBorder};margin:32px 0 20px;"></div>
      <p style="font-size:13px;color:${BRAND.muted};margin:0 0 4px;">Feito com ☕ pela equipe <strong style="color:${BRAND.dark};">DESH</strong></p>
      <p style="font-size:12px;color:${BRAND.muted};margin:0;"><a href="#" style="color:${BRAND.primary};text-decoration:underline;">Gerenciar preferências</a></p>
    </div>`;
  }, [bodyHtml]);

  const subjectPreview = useMemo(() => replaceVarsPreview(subjectTemplate), [subjectTemplate]);

  return (
    <div className="bg-card/90 backdrop-blur-sm border border-border/50 rounded-2xl overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <h4 className="text-sm font-semibold text-foreground">{template ? "Editar Template" : "Novo Template"}</h4>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHelp(!showHelp)} className="p-1.5 rounded-lg hover:bg-foreground/10 text-muted-foreground hover:text-foreground">
            <HelpCircle className="w-4 h-4" />
          </button>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-foreground/10 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Help panel ── */}
      {showHelp && (
        <div className="px-4 py-3 bg-primary/5 border-b border-border/50">
          <p className="text-xs font-semibold text-foreground mb-2">Guia rápido</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-muted-foreground">
            <div>
              <p className="font-medium text-foreground mb-1">📝 Variáveis</p>
              <p>Use <code className="text-primary bg-primary/10 px-1 rounded">{"{{variavel}}"}</code> para inserir dados dinâmicos. Ex: <code className="text-primary bg-primary/10 px-1 rounded">{"{{display_name}}"}</code></p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">🧩 Snippets</p>
              <p>Blocos pré-formatados como botões CTA, cards de alerta e tabelas. Clique para inserir no cursor.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">👁️ Preview</p>
              <p>O preview substitui variáveis por dados de exemplo e aplica o layout real do e-mail DESH.</p>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* ── Meta fields ── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Slug</label>
            <input
              value={slug}
              onChange={e => setSlug(e.target.value)}
              placeholder="ex: weekly_report"
              disabled={!!template}
              className="w-full px-3 py-2 rounded-lg bg-foreground/[0.04] border border-border/50 text-sm text-foreground placeholder:text-muted-foreground/40 disabled:opacity-50 outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Nome</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nome amigável"
              className="w-full px-3 py-2 rounded-lg bg-foreground/[0.04] border border-border/50 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Tipo</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-foreground/[0.04] border border-border/50 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/30"
            >
              <option value="transactional">Transacional</option>
              <option value="report">Relatório</option>
              <option value="marketing">Marketing</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Assunto</label>
            <input
              value={subjectTemplate}
              onChange={e => setSubjectTemplate(e.target.value)}
              placeholder="☀️ Bom dia, {{display_name}}!"
              className="w-full px-3 py-2 rounded-lg bg-foreground/[0.04] border border-border/50 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
        </div>

        {/* Subject preview */}
        {subjectTemplate && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-foreground/[0.02] border border-border/30">
            <Send className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="text-[11px] text-muted-foreground">Preview:</span>
            <span className="text-[11px] text-foreground truncate">{subjectPreview}</span>
          </div>
        )}

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-1 flex-wrap bg-foreground/[0.03] rounded-xl px-2 py-1.5 border border-border/30">
          {/* Format buttons */}
          {HTML_TAGS.map(tag => (
            <DeshTooltip key={tag.label} label={tag.label}>
              <button
                onClick={() => tag.after ? wrapSelection(tag.before, tag.after) : insertAtCursor(tag.before)}
                className="p-1.5 rounded-lg hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
                disabled={viewMode === "preview"}
              >
                <tag.icon className="w-3.5 h-3.5" />
              </button>
            </DeshTooltip>
          ))}

          <div className="w-px h-5 bg-border/50 mx-1" />

          {/* Undo/Redo */}
          <DeshTooltip label="Desfazer">
            <button onClick={undo} disabled={historyIdx <= 0} className="p-1.5 rounded-lg hover:bg-foreground/10 text-muted-foreground hover:text-foreground disabled:opacity-30">
              <Undo2 className="w-3.5 h-3.5" />
            </button>
          </DeshTooltip>
          <DeshTooltip label="Refazer">
            <button onClick={redo} disabled={historyIdx >= history.length - 1} className="p-1.5 rounded-lg hover:bg-foreground/10 text-muted-foreground hover:text-foreground disabled:opacity-30">
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </DeshTooltip>

          <div className="w-px h-5 bg-border/50 mx-1" />

          {/* Variables dropdown */}
          <div className="relative">
            <DeshTooltip label="Inserir variável">
              <button
                onClick={() => { setShowVars(!showVars); setShowSnippets(false); }}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${showVars ? "bg-primary/15 text-primary" : "hover:bg-foreground/10 text-muted-foreground hover:text-foreground"}`}
              >
                <Variable className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Variáveis</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </DeshTooltip>
            {showVars && (
              <div className="absolute top-full left-0 mt-1 z-50 w-72 bg-card border border-border rounded-xl shadow-xl max-h-64 overflow-auto">
                <div className="p-2 space-y-0.5">
                  {VARIABLES.map(v => (
                    <button
                      key={v.key}
                      onClick={() => insertVariable(v.key)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs hover:bg-foreground/5 transition-colors text-left"
                    >
                      <div>
                        <code className="text-primary font-mono text-[11px]">{`{{${v.key}}}`}</code>
                        <p className="text-muted-foreground text-[10px] mt-0.5">{v.label}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground/50 shrink-0">{v.example}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Snippets dropdown */}
          <div className="relative">
            <DeshTooltip label="Inserir snippet">
              <button
                onClick={() => { setShowSnippets(!showSnippets); setShowVars(false); }}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${showSnippets ? "bg-primary/15 text-primary" : "hover:bg-foreground/10 text-muted-foreground hover:text-foreground"}`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Snippets</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </DeshTooltip>
            {showSnippets && (
              <div className="absolute top-full left-0 mt-1 z-50 w-64 bg-card border border-border rounded-xl shadow-xl max-h-72 overflow-auto">
                <div className="p-2 space-y-0.5">
                  {SNIPPETS.map(s => (
                    <button
                      key={s.name}
                      onClick={() => insertSnippet(s.code)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs hover:bg-foreground/5 transition-colors text-left"
                    >
                      <span className="text-base">{s.icon}</span>
                      <span className="text-foreground font-medium">{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* View mode */}
          <div className="flex items-center bg-foreground/[0.04] rounded-lg p-0.5">
            <DeshTooltip label="Código">
              <button
                onClick={() => setViewMode("code")}
                className={`p-1.5 rounded-md transition-colors ${viewMode === "code" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Code className="w-3.5 h-3.5" />
              </button>
            </DeshTooltip>
            <DeshTooltip label="Dividido">
              <button
                onClick={() => setViewMode("split")}
                className={`p-1.5 rounded-md transition-colors ${viewMode === "split" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Columns className="w-3.5 h-3.5" />
              </button>
            </DeshTooltip>
            <DeshTooltip label="Preview">
              <button
                onClick={() => setViewMode("preview")}
                className={`p-1.5 rounded-md transition-colors ${viewMode === "preview" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            </DeshTooltip>
          </div>
        </div>

        {/* ── Editor / Preview ── */}
        <div className={`grid gap-3 ${viewMode === "split" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
          {/* Code editor */}
          {viewMode !== "preview" && (
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                  <FileCode2 className="w-3 h-3" /> HTML
                </span>
                <button
                  onClick={() => { navigator.clipboard.writeText(bodyHtml); }}
                  className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Copiar
                </button>
              </div>
              <textarea
                ref={textareaRef}
                value={bodyHtml}
                onChange={e => updateBody(e.target.value)}
                rows={viewMode === "split" ? 20 : 24}
                placeholder={`<h1 style="margin:0;font-size:24px;font-weight:700;color:${BRAND.dark};">Olá, {{display_name}}! 👋</h1>\n<p style="margin:16px 0;font-size:15px;color:${BRAND.secondary};">Conteúdo do e-mail aqui...</p>`}
                className="w-full px-4 py-3 rounded-xl bg-foreground/[0.03] border border-border/50 text-xs text-foreground placeholder:text-muted-foreground/30 font-mono resize-y outline-none focus:ring-1 focus:ring-primary/30 leading-relaxed"
                spellCheck={false}
              />
              <div className="absolute bottom-3 right-3 text-[10px] text-muted-foreground/40">
                {bodyHtml.length} chars
              </div>
            </div>
          )}

          {/* Preview */}
          {viewMode !== "code" && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                  <Eye className="w-3 h-3" /> Preview (dados de exemplo)
                </span>
              </div>
              <div className="bg-white rounded-xl border border-border/30 overflow-hidden" style={{ maxHeight: viewMode === "split" ? 480 : 600 }}>
                <div className="overflow-auto" style={{ maxHeight: viewMode === "split" ? 480 : 600 }}>
                  <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer actions ── */}
        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          <p className="text-[10px] text-muted-foreground">
            {VARIABLES.length} variáveis · {SNIPPETS.length} snippets disponíveis
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onCancel} className="px-4 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={!slug.trim() || !name.trim()}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Salvar Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailTemplateEditor;
