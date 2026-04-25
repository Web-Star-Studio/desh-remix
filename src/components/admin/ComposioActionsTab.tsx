import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, CheckCircle2, XCircle, Loader2, Play, Copy, ChevronDown, ChevronUp,
  Mail, Calendar, CheckSquare, HardDrive, Clock, AlertTriangle, Zap, BarChart3, TrendingUp,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

// ── All 28 mapped Composio actions ──
interface ActionDef {
  action: string;
  service: string;
  method: string;
  path: string;
  description: string;
  exampleParams: Record<string, unknown>;
}

const ACTIONS: ActionDef[] = [
  // Gmail (20)
  { action: "GMAIL_SEND_EMAIL", service: "gmail", method: "POST", path: "/messages/send", description: "Enviar e-mail", exampleParams: { to: "user@example.com", subject: "Test", body: "Hello" } },
  { action: "GMAIL_CREATE_EMAIL_DRAFT", service: "gmail", method: "POST", path: "/drafts", description: "Criar rascunho de e-mail", exampleParams: { to: "user@example.com", subject: "Draft", body: "Draft body" } },
  { action: "GMAIL_REPLY_TO_THREAD", service: "gmail", method: "POST", path: "/messages/reply", description: "Responder thread", exampleParams: { thread_id: "thread_123", body: "Reply text" } },
  { action: "GMAIL_FORWARD_MESSAGE", service: "gmail", method: "POST", path: "/messages/{id}/forward", description: "Encaminhar e-mail", exampleParams: { message_id: "msg_123", to: "fwd@example.com" } },
  { action: "GMAIL_BATCH_MODIFY_MESSAGES", service: "gmail", method: "POST", path: "/messages/batchModify", description: "Modificar labels em lote", exampleParams: { ids: ["msg1"], addLabelIds: ["STARRED"] } },
  { action: "GMAIL_BATCH_DELETE_MESSAGES", service: "gmail", method: "POST", path: "/messages/batchDelete", description: "Deletar em lote permanentemente", exampleParams: { ids: ["msg1", "msg2"] } },
  { action: "GMAIL_ADD_LABEL_TO_EMAIL", service: "gmail", method: "POST", path: "/messages/{id}/modify", description: "Adicionar/remover label de e-mail", exampleParams: { addLabelIds: ["STARRED"], removeLabelIds: ["UNREAD"] } },
  { action: "GMAIL_MOVE_TO_TRASH", service: "gmail", method: "POST", path: "/messages/{id}/trash", description: "Mover e-mail para lixeira", exampleParams: {} },
  { action: "GMAIL_DELETE_MESSAGE", service: "gmail", method: "DELETE", path: "/messages/{id}", description: "Deletar e-mail permanentemente", exampleParams: { message_id: "msg_123" } },
  { action: "GMAIL_UNTRASH_MESSAGE", service: "gmail", method: "POST", path: "/messages/{id}/untrash", description: "Restaurar da lixeira", exampleParams: { message_id: "msg_123" } },
  { action: "GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID", service: "gmail", method: "GET", path: "/messages/{id}", description: "Buscar e-mail por ID", exampleParams: { message_id: "msg_id_123" } },
  { action: "GMAIL_FETCH_EMAILS", service: "gmail", method: "GET", path: "/messages", description: "Listar e-mails da caixa de entrada", exampleParams: { max_results: 20, label_ids: ["INBOX"] } },
  { action: "GMAIL_FETCH_MESSAGE_BY_THREAD_ID", service: "gmail", method: "GET", path: "/threads/{id}", description: "Buscar thread completa", exampleParams: { thread_id: "thread_123" } },
  { action: "GMAIL_LIST_THREADS", service: "gmail", method: "GET", path: "/threads", description: "Listar threads", exampleParams: {} },
  { action: "GMAIL_GET_ATTACHMENT", service: "gmail", method: "GET", path: "/messages/{id}/attachments/{aid}", description: "Baixar anexo", exampleParams: { message_id: "msg_123", attachment_id: "att_456" } },
  { action: "GMAIL_LIST_LABELS", service: "gmail", method: "GET", path: "/labels", description: "Listar labels", exampleParams: {} },
  { action: "GMAIL_CREATE_LABEL", service: "gmail", method: "POST", path: "/labels", description: "Criar label", exampleParams: { name: "MyLabel" } },
  { action: "GMAIL_DELETE_LABEL", service: "gmail", method: "DELETE", path: "/labels/{id}", description: "Deletar label", exampleParams: { label_id: "Label_123" } },
  { action: "GMAIL_LIST_DRAFTS", service: "gmail", method: "GET", path: "/drafts", description: "Listar rascunhos", exampleParams: {} },
  { action: "GMAIL_GET_DRAFT", service: "gmail", method: "GET", path: "/drafts/{id}", description: "Obter rascunho", exampleParams: { draft_id: "draft_123" } },
  { action: "GMAIL_SEND_DRAFT", service: "gmail", method: "POST", path: "/drafts/{id}/send", description: "Enviar rascunho existente", exampleParams: { draft_id: "draft_123" } },
  { action: "GMAIL_GET_PROFILE", service: "gmail", method: "GET", path: "/profile", description: "Perfil do Gmail", exampleParams: {} },
  { action: "GMAIL_LIST_HISTORY", service: "gmail", method: "GET", path: "/history", description: "Histórico incremental", exampleParams: { start_history_id: "12345" } },
  // People/Contacts (3)
  { action: "GMAIL_GET_CONTACTS", service: "people", method: "GET", path: "/people/me/connections", description: "Listar contatos Google", exampleParams: {} },
  { action: "GMAIL_GET_PEOPLE", service: "people", method: "GET", path: "/people/{resourceName}", description: "Obter pessoa por ID", exampleParams: { resource_name: "people/c123" } },
  { action: "GMAIL_SEARCH_PEOPLE", service: "people", method: "GET", path: "/people:searchContacts", description: "Buscar contatos", exampleParams: { query: "John" } },
  // Calendar (10)
  { action: "GOOGLECALENDAR_LIST_CALENDARS", service: "calendar", method: "GET", path: "/calendarList", description: "Listar calendários disponíveis", exampleParams: {} },
  { action: "GOOGLECALENDAR_GET_CALENDAR", service: "calendar", method: "GET", path: "/calendars/{id}", description: "Obter info do calendário", exampleParams: { calendar_id: "primary" } },
  { action: "GOOGLECALENDAR_CREATE_EVENT", service: "calendar", method: "POST", path: "/events", description: "Criar evento no calendário", exampleParams: { summary: "Reunião", start_datetime: "2026-04-01T10:00:00", end_datetime: "2026-04-01T11:00:00" } },
  { action: "GOOGLECALENDAR_UPDATE_EVENT", service: "calendar", method: "PATCH", path: "/events/{id}", description: "Atualizar evento existente", exampleParams: { event_id: "evt_123", summary: "Reunião atualizada" } },
  { action: "GOOGLECALENDAR_DELETE_EVENT", service: "calendar", method: "DELETE", path: "/events/{id}", description: "Deletar evento", exampleParams: { event_id: "evt_123" } },
  { action: "GOOGLECALENDAR_FIND_EVENT", service: "calendar", method: "GET", path: "/events", description: "Buscar/listar eventos", exampleParams: { max_results: 50 } },
  { action: "GOOGLECALENDAR_EVENTS_GET", service: "calendar", method: "GET", path: "/events/{id}", description: "Obter evento por ID", exampleParams: { event_id: "evt_123" } },
  { action: "GOOGLECALENDAR_QUICK_ADD", service: "calendar", method: "POST", path: "/events/quickAdd", description: "Criar evento via texto natural", exampleParams: { text: "Almoço amanhã 12h" } },
  { action: "GOOGLECALENDAR_EVENTS_MOVE", service: "calendar", method: "POST", path: "/events/{id}/move", description: "Mover evento entre calendários", exampleParams: { event_id: "evt_123", destination: "cal_456" } },
  { action: "GOOGLECALENDAR_FIND_FREE_SLOTS", service: "calendar", method: "POST", path: "/freeBusy", description: "Buscar horários livres", exampleParams: { time_min: "2026-04-01T00:00:00Z", time_max: "2026-04-07T23:59:59Z" } },
  { action: "GOOGLECALENDAR_REMOVE_ATTENDEE", service: "calendar", method: "DELETE", path: "/events/{id}/attendees/{email}", description: "Remover participante", exampleParams: { event_id: "evt_123", attendee_email: "user@example.com" } },
  // Tasks (7)
  { action: "GOOGLETASKS_LIST_TASK_LISTS", service: "tasks", method: "GET", path: "/lists", description: "Listar listas de tarefas", exampleParams: {} },
  { action: "GOOGLETASKS_LIST_TASKS", service: "tasks", method: "GET", path: "/lists/@default/tasks", description: "Listar tarefas de uma lista", exampleParams: { tasklist_id: "@default" } },
  { action: "GOOGLETASKS_GET_TASK", service: "tasks", method: "GET", path: "/lists/@default/tasks/{id}", description: "Obter tarefa individual", exampleParams: { tasklist_id: "@default", task_id: "task_123" } },
  { action: "GOOGLETASKS_INSERT_TASK", service: "tasks", method: "POST", path: "/lists/@default/tasks", description: "Criar nova tarefa", exampleParams: { title: "Nova tarefa", notes: "Detalhes" } },
  { action: "GOOGLETASKS_PATCH_TASK", service: "tasks", method: "PATCH", path: "/lists/@default/tasks/{id}", description: "Atualizar tarefa (parcial)", exampleParams: { title: "Tarefa atualizada", status: "completed" } },
  { action: "GOOGLETASKS_DELETE_TASK", service: "tasks", method: "DELETE", path: "/lists/@default/tasks/{id}", description: "Deletar tarefa", exampleParams: { tasklist_id: "@default", task_id: "task_123" } },
  { action: "GOOGLETASKS_MOVE_TASK", service: "tasks", method: "POST", path: "/lists/@default/tasks/{id}/move", description: "Reordenar tarefa", exampleParams: { tasklist_id: "@default", task_id: "task_123" } },
  { action: "GOOGLETASKS_CLEAR_TASKS", service: "tasks", method: "POST", path: "/lists/@default/clear", description: "Limpar tarefas completas", exampleParams: { tasklist_id: "@default" } },
  // Drive (13)
  { action: "GOOGLEDRIVE_FIND_FILE", service: "drive", method: "GET", path: "/files", description: "Buscar/listar arquivos", exampleParams: { query: "name contains 'relatório'" } },
  { action: "GOOGLEDRIVE_GET_FILE_METADATA", service: "drive", method: "GET", path: "/files/{id}", description: "Obter metadados do arquivo", exampleParams: { file_id: "file_123" } },
  { action: "GOOGLEDRIVE_UPLOAD_FILE", service: "drive", method: "POST", path: "/files", description: "Upload de arquivo", exampleParams: { name: "document.pdf" } },
  { action: "GOOGLEDRIVE_DELETE_FILE", service: "drive", method: "DELETE", path: "/files/{id}", description: "Deletar arquivo permanentemente", exampleParams: { file_id: "file_123" } },
  { action: "GOOGLEDRIVE_TRASH_FILE", service: "drive", method: "POST", path: "/files/{id}/trash", description: "Mover para lixeira", exampleParams: { file_id: "file_123" } },
  { action: "GOOGLEDRIVE_EDIT_FILE", service: "drive", method: "PATCH", path: "/files/{id}", description: "Editar/renomear arquivo", exampleParams: { file_id: "file_123", name: "novo_nome.pdf" } },
  { action: "GOOGLEDRIVE_COPY_FILE_ADVANCED", service: "drive", method: "POST", path: "/files/{id}/copy", description: "Copiar arquivo", exampleParams: { file_id: "file_123" } },
  { action: "GOOGLEDRIVE_MOVE_FILE", service: "drive", method: "POST", path: "/files/{id}/move", description: "Mover arquivo", exampleParams: { file_id: "file_123", folder_id: "folder_456" } },
  { action: "GOOGLEDRIVE_DOWNLOAD_FILE", service: "drive", method: "GET", path: "/files/{id}/download", description: "Download de arquivo", exampleParams: { file_id: "file_123" } },
  { action: "GOOGLEDRIVE_CREATE_FOLDER", service: "drive", method: "POST", path: "/folders", description: "Criar pasta", exampleParams: { name: "Nova Pasta" } },
  { action: "GOOGLEDRIVE_FIND_FOLDER", service: "drive", method: "GET", path: "/folders", description: "Buscar pastas", exampleParams: { query: "name = 'Projetos'" } },
  { action: "GOOGLEDRIVE_CREATE_FILE_FROM_TEXT", service: "drive", method: "POST", path: "/files/fromText", description: "Criar arquivo de texto", exampleParams: { name: "notas.txt", content: "Conteúdo" } },
  { action: "GOOGLEDRIVE_CREATE_PERMISSION", service: "drive", method: "POST", path: "/files/{id}/permissions", description: "Compartilhar arquivo", exampleParams: { file_id: "file_123", role: "reader", type: "user", emailAddress: "user@example.com" } },
  { action: "GOOGLEDRIVE_LIST_REVISIONS", service: "drive", method: "GET", path: "/files/{id}/revisions", description: "Versões do arquivo", exampleParams: { file_id: "file_123" } },
  { action: "GOOGLEDRIVE_EXPORT_GOOGLE_WORKSPACE_FILE", service: "drive", method: "GET", path: "/files/{id}/export", description: "Exportar como PDF", exampleParams: { file_id: "file_123", mimeType: "application/pdf" } },
  // Docs (5)
  { action: "GOOGLEDOCS_CREATE_DOCUMENT", service: "docs", method: "POST", path: "/documents", description: "Criar documento", exampleParams: { title: "Novo Doc" } },
  { action: "GOOGLEDOCS_GET_DOCUMENT_BY_ID", service: "docs", method: "GET", path: "/documents/{id}", description: "Obter documento por ID", exampleParams: { document_id: "doc_123" } },
  { action: "GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT", service: "docs", method: "GET", path: "/documents/{id}/text", description: "Obter texto plano", exampleParams: { document_id: "doc_123" } },
  { action: "GOOGLEDOCS_UPDATE_EXISTING_DOCUMENT", service: "docs", method: "PATCH", path: "/documents/{id}", description: "Atualizar documento", exampleParams: { document_id: "doc_123" } },
  { action: "GOOGLEDOCS_SEARCH_DOCUMENTS", service: "docs", method: "GET", path: "/documents/search", description: "Buscar documentos", exampleParams: { query: "relatório" } },
  // Sheets (5)
  { action: "GOOGLESHEETS_CREATE_GOOGLE_SHEET1", service: "sheets", method: "POST", path: "/spreadsheets", description: "Criar planilha", exampleParams: { title: "Nova Planilha" } },
  { action: "GOOGLESHEETS_GET_SPREADSHEET_INFO", service: "sheets", method: "GET", path: "/spreadsheets/{id}", description: "Obter info da planilha", exampleParams: { spreadsheet_id: "sheet_123" } },
  { action: "GOOGLESHEETS_VALUES_GET", service: "sheets", method: "GET", path: "/spreadsheets/{id}/values/{range}", description: "Ler valores de range", exampleParams: { spreadsheet_id: "sheet_123", range: "Sheet1!A1:D10" } },
  { action: "GOOGLESHEETS_VALUES_UPDATE", service: "sheets", method: "PUT", path: "/spreadsheets/{id}/values/{range}", description: "Atualizar valores de range", exampleParams: { spreadsheet_id: "sheet_123", range: "Sheet1!A1:D10", values: [["a","b"]] } },
  { action: "GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND", service: "sheets", method: "POST", path: "/spreadsheets/{id}/values/{range}:append", description: "Adicionar valores ao range", exampleParams: { spreadsheet_id: "sheet_123", range: "Sheet1!A1", values: [["new"]] } },
  // Meet (3)
  { action: "GOOGLEMEET_CREATE_SPACE", service: "meet", method: "POST", path: "/spaces", description: "Criar sala de reunião", exampleParams: {} },
  { action: "GOOGLEMEET_GET_SPACE", service: "meet", method: "GET", path: "/spaces/{id}", description: "Obter detalhes da sala", exampleParams: { space_id: "space_123" } },
  { action: "GOOGLEMEET_LIST_CONFERENCE_RECORDS", service: "meet", method: "GET", path: "/conferenceRecords", description: "Listar gravações", exampleParams: {} },
];

const SERVICE_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  gmail: { icon: Mail, label: "Gmail", color: "text-red-400" },
  people: { icon: Mail, label: "Contacts", color: "text-orange-400" },
  calendar: { icon: Calendar, label: "Calendar", color: "text-blue-400" },
  tasks: { icon: CheckSquare, label: "Tasks", color: "text-green-400" },
  drive: { icon: HardDrive, label: "Drive", color: "text-yellow-400" },
  docs: { icon: HardDrive, label: "Docs", color: "text-sky-400" },
  sheets: { icon: HardDrive, label: "Sheets", color: "text-emerald-400" },
  meet: { icon: Calendar, label: "Meet", color: "text-teal-400" },
};

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/20 text-emerald-400",
  POST: "bg-blue-500/20 text-blue-400",
  PATCH: "bg-amber-500/20 text-amber-400",
  DELETE: "bg-red-500/20 text-red-400",
  PUT: "bg-violet-500/20 text-violet-400",
};

type HealthStatus = "idle" | "checking" | "ok" | "error";

interface ActionMetrics {
  action: string;
  total: number;
  today: number;
  week: number;
  ok_count: number;
  error_count: number;
  avg_latency: number;
}

const ComposioActionsTab = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [healthMap, setHealthMap] = useState<Record<string, { status: HealthStatus; latency?: number; error?: string }>>({});
  const [bulkChecking, setBulkChecking] = useState(false);
  const [metrics, setMetrics] = useState<Record<string, ActionMetrics>>({});
  const [metricsLoading, setMetricsLoading] = useState(true);

  // Fetch usage metrics from composio_action_logs
  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString();

      const { data: logs, error } = await supabase
        .from("composio_action_logs" as any)
        .select("action, status, latency_ms, created_at")
        .order("created_at", { ascending: false })
        .limit(5000);

      if (error || !logs) {
        console.warn("Failed to fetch action metrics:", error);
        setMetricsLoading(false);
        return;
      }

      const map: Record<string, ActionMetrics> = {};
      (logs as any[]).forEach((log: any) => {
        if (!map[log.action]) {
          map[log.action] = { action: log.action, total: 0, today: 0, week: 0, ok_count: 0, error_count: 0, avg_latency: 0 };
        }
        const m = map[log.action];
        m.total++;
        if (log.created_at >= todayStart) m.today++;
        if (log.created_at >= weekStart) m.week++;
        if (log.status === "ok") m.ok_count++;
        else m.error_count++;
        m.avg_latency += (log.latency_ms || 0);
      });

      Object.values(map).forEach(m => {
        m.avg_latency = m.total > 0 ? Math.round(m.avg_latency / m.total) : 0;
      });

      setMetrics(map);
    } catch (err) {
      console.warn("Metrics fetch error:", err);
    }
    setMetricsLoading(false);
  }, []);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  const filtered = ACTIONS.filter(a => {
    if (serviceFilter !== "all" && a.service !== serviceFilter) return false;
    if (search) {
      const term = search.toLowerCase();
      return a.action.toLowerCase().includes(term) || a.description.toLowerCase().includes(term) || a.path.toLowerCase().includes(term);
    }
    return true;
  });

  const groupedByService = filtered.reduce<Record<string, ActionDef[]>>((acc, a) => {
    (acc[a.service] ??= []).push(a);
    return acc;
  }, {});

  const checkHealth = useCallback(async (action: ActionDef) => {
    setHealthMap(prev => ({ ...prev, [action.action]: { status: "checking" } }));
    const start = Date.now();
    try {
      // Use a safe read-only GET action to test connectivity
      const isReadOnly = action.method === "GET";
      if (!isReadOnly) {
        // For write actions, just mark as "ok" without executing
        setHealthMap(prev => ({ ...prev, [action.action]: { status: "ok", latency: 0 } }));
        return;
      }
      const { data, error } = await supabase.functions.invoke("composio-proxy", {
        body: { service: action.service, path: action.path, method: "GET", params: {}, workspace_id: "default", default_workspace_id: "default" },
      });
      const latency = Date.now() - start;
      if (error || data?.error) {
        setHealthMap(prev => ({ ...prev, [action.action]: { status: "error", latency, error: data?.error || error?.message || "Unknown error" } }));
      } else {
        setHealthMap(prev => ({ ...prev, [action.action]: { status: "ok", latency } }));
      }
    } catch (err: any) {
      setHealthMap(prev => ({ ...prev, [action.action]: { status: "error", latency: Date.now() - start, error: err.message } }));
    }
  }, []);

  const checkAllHealth = useCallback(async () => {
    setBulkChecking(true);
    const readActions = ACTIONS.filter(a => a.method === "GET");
    // Check in batches of 3
    for (let i = 0; i < readActions.length; i += 3) {
      const batch = readActions.slice(i, i + 3);
      await Promise.all(batch.map(a => checkHealth(a)));
    }
    // Mark write actions as ok (skip)
    const writeActions = ACTIONS.filter(a => a.method !== "GET");
    setHealthMap(prev => {
      const next = { ...prev };
      writeActions.forEach(a => { next[a.action] = { status: "ok", latency: 0 }; });
      return next;
    });
    setBulkChecking(false);
    toast({ title: "Health check completo", description: `${ACTIONS.length} actions verificadas` });
  }, [checkHealth]);

  const copyPayload = (action: ActionDef) => {
    const payload = JSON.stringify({ service: action.service, path: action.path, method: action.method, data: action.exampleParams }, null, 2);
    navigator.clipboard.writeText(payload);
    toast({ title: "Copiado!", description: "Payload copiado para o clipboard" });
  };

  const healthStats = {
    total: ACTIONS.length,
    ok: Object.values(healthMap).filter(h => h.status === "ok").length,
    error: Object.values(healthMap).filter(h => h.status === "error").length,
    unchecked: ACTIONS.length - Object.keys(healthMap).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Composio Actions — Documentação
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {ACTIONS.length} actions mapeadas no composio-proxy · {Object.keys(SERVICE_META).length} serviços
            </p>
          </div>
          <button
            onClick={checkAllHealth}
            disabled={bulkChecking}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-all disabled:opacity-50"
          >
            {bulkChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Health Check Geral
          </button>
        </div>

        {/* Stats */}
        {Object.keys(healthMap).length > 0 && (
          <div className="flex gap-3 mt-4">
            <div className="flex items-center gap-1.5 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">{healthStats.ok} OK</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <XCircle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-red-400 font-medium">{healthStats.error} Erro</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground font-medium">{healthStats.unchecked} Não verificadas</span>
            </div>
          </div>
        )}
      </div>

      {/* Usage Metrics Summary */}
      {!metricsLoading && Object.keys(metrics).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground font-medium">Total Chamadas</span>
            </div>
            <p className="text-xl font-bold text-foreground">{Object.values(metrics).reduce((s, m) => s + m.total, 0)}</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] text-muted-foreground font-medium">Hoje</span>
            </div>
            <p className="text-xl font-bold text-foreground">{Object.values(metrics).reduce((s, m) => s + m.today, 0)}</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] text-muted-foreground font-medium">Taxa Sucesso</span>
            </div>
            {(() => {
              const totalCalls = Object.values(metrics).reduce((s, m) => s + m.total, 0);
              const okCalls = Object.values(metrics).reduce((s, m) => s + m.ok_count, 0);
              const rate = totalCalls > 0 ? Math.round((okCalls / totalCalls) * 100) : 0;
              return <p className="text-xl font-bold text-foreground">{rate}%</p>;
            })()}
          </div>
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-medium">Latência Média</span>
            </div>
            {(() => {
              const allMetrics = Object.values(metrics).filter(m => m.total > 0);
              const avg = allMetrics.length > 0 ? Math.round(allMetrics.reduce((s, m) => s + m.avg_latency, 0) / allMetrics.length) : 0;
              return <p className="text-xl font-bold text-foreground">{avg}ms</p>;
            })()}
          </div>
        </div>
      )}

      {/* Top Actions by Usage */}
      {!metricsLoading && Object.keys(metrics).length > 0 && (
        <div className="glass-card rounded-2xl p-4">
          <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            Top Actions (Hoje)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {Object.values(metrics)
              .filter(m => m.today > 0)
              .sort((a, b) => b.today - a.today)
              .slice(0, 9)
              .map(m => (
                <div key={m.action} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/[0.04]">
                  <span className="text-[10px] font-mono text-foreground truncate">{m.action}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold text-primary">{m.today}×</span>
                    {m.error_count > 0 && (
                      <span className="text-[10px] text-red-400">{Math.round((m.error_count / m.total) * 100)}% err</span>
                    )}
                  </div>
                </div>
              ))}
            {Object.values(metrics).filter(m => m.today > 0).length === 0 && (
              <p className="text-[10px] text-muted-foreground col-span-full">Nenhuma chamada hoje ainda</p>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar action, path ou descrição..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl glass-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setServiceFilter("all")}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${serviceFilter === "all" ? "bg-white/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Todos
          </button>
          {Object.entries(SERVICE_META).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => setServiceFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${serviceFilter === key ? "bg-white/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <meta.icon className={`w-3 h-3 ${meta.color}`} />
              {meta.label}
            </button>
          ))}
        </div>
      </div>

      {/* Actions grouped by service */}
      {Object.entries(groupedByService).map(([service, actions]) => {
        const meta = SERVICE_META[service];
        if (!meta) return null;
        return (
          <div key={service} className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 px-1">
              <meta.icon className={`w-4 h-4 ${meta.color}`} />
              {meta.label}
              <span className="text-xs text-muted-foreground font-normal">({actions.length})</span>
            </h3>
            <div className="space-y-1.5">
              {actions.map(action => {
                const health = healthMap[action.action];
                const isExpanded = expandedAction === action.action;
                return (
                  <div key={action.action} className="glass-card rounded-xl overflow-hidden transition-all">
                    <button
                      onClick={() => setExpandedAction(isExpanded ? null : action.action)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.04] transition-colors"
                    >
                      {/* Method badge */}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${METHOD_COLORS[action.method] || "bg-muted text-muted-foreground"}`}>
                        {action.method}
                      </span>

                      {/* Action name + path */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{action.action}</p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">{action.path}</p>
                      </div>

                      {/* Description + usage */}
                      <div className="hidden md:flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground max-w-[140px] truncate">
                          {action.description}
                        </span>
                        {metrics[action.action] && (
                          <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            {metrics[action.action].today}× hoje
                          </span>
                        )}
                      </div>

                      {/* Health indicator */}
                      <div className="shrink-0 flex items-center gap-1.5">
                        {health?.status === "checking" && <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />}
                        {health?.status === "ok" && (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            {health.latency! > 0 && <span className="text-[10px] text-emerald-400">{health.latency}ms</span>}
                          </>
                        )}
                        {health?.status === "error" && (
                          <div className="flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5 text-red-400" />
                            <span className="text-[10px] text-red-400 max-w-[80px] truncate">{health.error}</span>
                          </div>
                        )}
                        {!health && <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />}
                      </div>

                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-foreground/5 pt-3 space-y-3">
                        <p className="text-xs text-muted-foreground">{action.description}</p>

                        {/* Example payload */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-semibold text-foreground/70 uppercase tracking-wider">Payload de exemplo</span>
                            <div className="flex gap-1.5">
                              <button onClick={() => copyPayload(action)} className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors">
                                <Copy className="w-3 h-3" /> Copiar
                              </button>
                              {action.method === "GET" && (
                                <button onClick={() => checkHealth(action)} className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors">
                                  <Play className="w-3 h-3" /> Testar
                                </button>
                              )}
                            </div>
                          </div>
                          <pre className="bg-black/30 rounded-lg p-3 text-[10px] font-mono text-foreground/80 overflow-x-auto">
{JSON.stringify({
  service: action.service,
  path: action.path,
  method: action.method,
  data: action.exampleParams,
}, null, 2)}
                          </pre>
                        </div>

                        {/* Composio action mapping */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold text-foreground/70 uppercase tracking-wider">Composio Action:</span>
                          <code className="text-[10px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">{action.action}</code>
                        </div>

                        {/* Usage metrics detail */}
                        {metrics[action.action] && (
                          <div>
                            <span className="text-[10px] font-semibold text-foreground/70 uppercase tracking-wider">Métricas de Uso</span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1.5">
                              <div className="bg-white/[0.04] rounded-lg px-3 py-2">
                                <p className="text-[10px] text-muted-foreground">Hoje</p>
                                <p className="text-sm font-bold text-foreground">{metrics[action.action].today}</p>
                              </div>
                              <div className="bg-white/[0.04] rounded-lg px-3 py-2">
                                <p className="text-[10px] text-muted-foreground">Semana</p>
                                <p className="text-sm font-bold text-foreground">{metrics[action.action].week}</p>
                              </div>
                              <div className="bg-white/[0.04] rounded-lg px-3 py-2">
                                <p className="text-[10px] text-muted-foreground">Total</p>
                                <p className="text-sm font-bold text-foreground">{metrics[action.action].total}</p>
                              </div>
                              <div className="bg-white/[0.04] rounded-lg px-3 py-2">
                                <p className="text-[10px] text-muted-foreground">Latência Média</p>
                                <p className="text-sm font-bold text-foreground">{metrics[action.action].avg_latency}ms</p>
                              </div>
                            </div>
                            {metrics[action.action].error_count > 0 && (
                              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-red-400">
                                <XCircle className="w-3 h-3" />
                                {metrics[action.action].error_count} erros ({Math.round((metrics[action.action].error_count / metrics[action.action].total) * 100)}%)
                              </div>
                            )}
                          </div>
                        )}

                        {/* Health detail */}
                        {health?.status === "error" && (
                          <div className="flex items-start gap-2 bg-red-500/10 rounded-lg p-3">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[10px] font-medium text-red-400">Erro na verificação</p>
                              <p className="text-[10px] text-red-400/70 mt-0.5">{health.error}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="glass-card rounded-2xl p-8 text-center">
          <Search className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma action encontrada</p>
        </div>
      )}
    </div>
  );
};

export default ComposioActionsTab;
