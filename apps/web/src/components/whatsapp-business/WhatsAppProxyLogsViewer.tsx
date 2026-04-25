import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Copy, Filter, RefreshCw, ScrollText, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  classifyWhatsAppPayloadKind,
  previewCreditAction,
  type WhatsAppPayloadKind,
} from "@/lib/whatsapp/postsFixtures";

interface ProxyLog {
  id: string;
  route_path: string;
  external_url: string;
  method: string;
  request_body: unknown;
  response_status: number | null;
  response_body: unknown;
  response_text: string | null;
  duration_ms: number | null;
  error_code: string | null;
  action: string | null;
  created_at: string;
}

type ActionFilter = "all" | "wa_message_send" | "wa_broadcast_send" | "none";
type PayloadFilter = "all" | WhatsAppPayloadKind;
type RouteFilter = "all" | "/posts" | "other";

const FILTERS_STORAGE_KEY = "wa-proxy-logs-filters-v1";

interface PersistedFilters {
  routeFilter: RouteFilter;
  payloadFilter: PayloadFilter;
  actionFilter: ActionFilter;
  search: string;
}

function loadPersistedFilters(): PersistedFilters {
  if (typeof window === "undefined") {
    return { routeFilter: "all", payloadFilter: "all", actionFilter: "all", search: "" };
  }
  try {
    const raw = window.localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw) as Partial<PersistedFilters>;
    return {
      routeFilter: parsed.routeFilter ?? "all",
      payloadFilter: parsed.payloadFilter ?? "all",
      actionFilter: parsed.actionFilter ?? "all",
      search: parsed.search ?? "",
    };
  } catch {
    return { routeFilter: "all", payloadFilter: "all", actionFilter: "all", search: "" };
  }
}

const PAYLOAD_LABEL: Record<WhatsAppPayloadKind, string> = {
  text: "Texto",
  template: "Template",
  media: "Mídia",
  broadcast: "Broadcast",
  other: "Outro",
  "n/a": "—",
};

const PAYLOAD_TONE: Record<WhatsAppPayloadKind, string> = {
  text: "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20",
  template: "bg-sky-500/15 text-sky-600 hover:bg-sky-500/20",
  media: "bg-amber-500/15 text-amber-600 hover:bg-amber-500/20",
  broadcast: "bg-violet-500/15 text-violet-600 hover:bg-violet-500/20",
  other: "bg-muted text-muted-foreground hover:bg-muted/80",
  "n/a": "bg-muted/40 text-muted-foreground/60",
};

function actionBadge(action: string | null, inferred?: boolean) {
  if (action === "wa_message_send") {
    return (
      <Badge
        className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 font-mono text-[10px]"
        title={inferred ? "Inferido pelo payload (ação não registrada)" : undefined}
      >
        wa_message_send{inferred ? "*" : ""}
      </Badge>
    );
  }
  if (action === "wa_broadcast_send") {
    return (
      <Badge
        className="bg-violet-500/15 text-violet-600 hover:bg-violet-500/20 font-mono text-[10px]"
        title={inferred ? "Inferido pelo payload (ação não registrada)" : undefined}
      >
        wa_broadcast_send{inferred ? "*" : ""}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground/70">
      sem cobrança
    </Badge>
  );
}

/**
 * Diagnostic viewer that lists the most recent WhatsApp proxy calls so operators
 * can inspect URL, payload and upstream response when troubleshooting failures
 * such as 404 `route_not_found`.
 *
 * Filters allow narrowing by route, /posts payload type (text / template /
 * media / broadcast) and the credit action that was actually charged
 * (`wa_message_send`, `wa_broadcast_send`, or none) — useful to cross-check
 * billing behaviour against payload shape.
 */
export default function WhatsAppProxyLogsViewer() {
  const [logs, setLogs] = useState<ProxyLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filters — hydrated from localStorage so operators don't lose state on reload.
  const [routeFilter, setRouteFilter] = useState<RouteFilter>(() => loadPersistedFilters().routeFilter);
  const [payloadFilter, setPayloadFilter] = useState<PayloadFilter>(() => loadPersistedFilters().payloadFilter);
  const [actionFilter, setActionFilter] = useState<ActionFilter>(() => loadPersistedFilters().actionFilter);
  const [search, setSearch] = useState<string>(() => loadPersistedFilters().search);

  // Persist filter changes so reloads retain operator context.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({ routeFilter, payloadFilter, actionFilter, search }),
      );
    } catch {
      // localStorage may be full / disabled — ignore silently
    }
  }, [routeFilter, payloadFilter, actionFilter, search]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_proxy_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setLoading(false);
    if (error) {
      toast.error("Falha ao carregar logs");
      return;
    }
    setLogs((data ?? []) as ProxyLog[]);
  };

  useEffect(() => {
    void load();
  }, []);

  // Each row gets payload kind + (when action column is empty) an inferred
  // action so old logs and uncategorised /posts can still be filtered/audited.
  const enriched = useMemo(
    () =>
      logs.map((log) => {
        const payloadType = classifyWhatsAppPayloadKind(log.route_path, log.request_body);
        const inferredAction = log.action
          ? null
          : log.route_path.includes("/posts")
          ? previewCreditAction(log.request_body)
          : null;
        return {
          log,
          payloadType,
          effectiveAction: log.action ?? inferredAction,
          inferred: !log.action && inferredAction !== null,
        };
      }),
    [logs],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter(({ log, payloadType, effectiveAction }) => {
      if (routeFilter === "/posts" && !log.route_path.includes("/posts")) return false;
      if (routeFilter === "other" && log.route_path.includes("/posts")) return false;
      if (payloadFilter !== "all" && payloadType !== payloadFilter) return false;
      if (actionFilter === "none" && effectiveAction) return false;
      if (
        (actionFilter === "wa_message_send" || actionFilter === "wa_broadcast_send") &&
        effectiveAction !== actionFilter
      )
        return false;
      if (q) {
        const hay = `${log.route_path} ${log.external_url} ${log.error_code ?? ""} ${
          effectiveAction ?? ""
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [enriched, routeFilter, payloadFilter, actionFilter, search]);

  // Counters for badges — count effective (incl. inferred) action so the UI
  // matches what the filter actually selects.
  const counts = useMemo(() => {
    const c = {
      total: enriched.length,
      wa_message_send: 0,
      wa_broadcast_send: 0,
      none: 0,
      posts: 0,
      text: 0,
      template: 0,
      media: 0,
      broadcast: 0,
      inferred: 0,
    };
    for (const { log, payloadType, effectiveAction, inferred } of enriched) {
      if (effectiveAction === "wa_message_send") c.wa_message_send++;
      else if (effectiveAction === "wa_broadcast_send") c.wa_broadcast_send++;
      else c.none++;
      if (log.route_path.includes("/posts")) c.posts++;
      if (payloadType === "text") c.text++;
      else if (payloadType === "template") c.template++;
      else if (payloadType === "media") c.media++;
      else if (payloadType === "broadcast") c.broadcast++;
      if (inferred) c.inferred++;
    }
    return c;
  }, [enriched]);

  const copy = (id: string, value: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(value ?? {}, null, 2)).then(
      () => {
        setCopiedId(id);
        toast.success("Copiado");
        setTimeout(() => setCopiedId(null), 1500);
      },
      () => toast.error("Não foi possível copiar"),
    );
  };

  const statusTone = (status: number | null) => {
    if (status == null) return "secondary";
    if (status >= 500) return "destructive";
    if (status >= 400) return "destructive";
    if (status >= 200 && status < 300) return "default";
    return "secondary";
  };

  const hasActiveFilter =
    routeFilter !== "all" ||
    payloadFilter !== "all" ||
    actionFilter !== "all" ||
    search.trim().length > 0;

  const clearFilters = () => {
    setRouteFilter("all");
    setPayloadFilter("all");
    setActionFilter("all");
    setSearch("");
  };

  return (
    <Card className="border-border/60 bg-card/40 backdrop-blur-sm shadow-sm">
      <CardHeader className="pb-3 border-b border-border/40 flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60">
            <ScrollText className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          Logs de envio
          <Badge variant="outline" className="text-[10px] font-mono ml-1">
            {filtered.length}/{counts.total}
          </Badge>
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={load}
          disabled={loading}
          className="gap-1.5 text-xs h-8"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Filters */}
        <div className="space-y-2.5 rounded-lg border border-border/50 bg-muted/10 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
              <Filter className="h-3 w-3" />
              Filtros
              {counts.inferred > 0 && (
                <span
                  className="ml-1 text-[9px] font-mono normal-case tracking-normal text-muted-foreground/70"
                  title="Logs antigos sem coluna 'action' — ação inferida pelo payload (marcadas com *)"
                >
                  · {counts.inferred} inferido(s)
                </span>
              )}
            </p>
            {hasActiveFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-6 px-2 text-[10px] gap-1"
              >
                <X className="h-3 w-3" />
                Limpar
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Select value={routeFilter} onValueChange={(v) => setRouteFilter(v as RouteFilter)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Rota" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  Todas as rotas ({counts.total})
                </SelectItem>
                <SelectItem value="/posts" className="text-xs">
                  /posts ({counts.posts})
                </SelectItem>
                <SelectItem value="other" className="text-xs">
                  Outras rotas ({counts.total - counts.posts})
                </SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={payloadFilter}
              onValueChange={(v) => setPayloadFilter(v as PayloadFilter)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Tipo de payload" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  Todos os tipos
                </SelectItem>
                <SelectItem value="text" className="text-xs">
                  Texto ({counts.text})
                </SelectItem>
                <SelectItem value="template" className="text-xs">
                  Template ({counts.template})
                </SelectItem>
                <SelectItem value="media" className="text-xs">
                  Mídia ({counts.media})
                </SelectItem>
                <SelectItem value="broadcast" className="text-xs">
                  Broadcast ({counts.broadcast})
                </SelectItem>
                <SelectItem value="other" className="text-xs">
                  Outro / sem WA
                </SelectItem>
              </SelectContent>
            </Select>

            <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as ActionFilter)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Ação de crédito" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  Todas as ações
                </SelectItem>
                <SelectItem value="wa_message_send" className="text-xs">
                  wa_message_send ({counts.wa_message_send})
                </SelectItem>
                <SelectItem value="wa_broadcast_send" className="text-xs">
                  wa_broadcast_send ({counts.wa_broadcast_send})
                </SelectItem>
                <SelectItem value="none" className="text-xs">
                  Sem cobrança ({counts.none})
                </SelectItem>
              </SelectContent>
            </Select>

            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar URL / código de erro..."
              className="h-8 text-xs"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {loading
              ? "Carregando..."
              : hasActiveFilter
              ? "Nenhum log corresponde aos filtros."
              : "Nenhum envio registrado ainda."}
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map(({ log, payloadType, effectiveAction, inferred }) => {
              const isOpen = expanded === log.id;
              const isError = (log.response_status ?? 0) >= 400;
              return (
                <Collapsible
                  key={log.id}
                  open={isOpen}
                  onOpenChange={(o) => setExpanded(o ? log.id : null)}
                >
                  <div
                    className={`rounded-lg border ${
                      isError
                        ? "border-destructive/30 bg-destructive/5"
                        : "border-border/60 bg-muted/20"
                    }`}
                  >
                    <CollapsibleTrigger asChild>
                      <button className="w-full p-3 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors rounded-lg">
                        <Badge
                          variant={
                            statusTone(log.response_status) as
                              | "default"
                              | "secondary"
                              | "destructive"
                          }
                          className="text-[10px] font-mono shrink-0 min-w-12 justify-center"
                        >
                          {log.response_status ?? "—"}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs font-mono truncate">
                            <span className="font-semibold">{log.method}</span>
                            <span className="text-muted-foreground truncate">
                              {log.route_path}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {payloadType !== "n/a" && (
                              <Badge
                                className={`text-[10px] ${PAYLOAD_TONE[payloadType]}`}
                                variant="secondary"
                              >
                                {PAYLOAD_LABEL[payloadType]}
                              </Badge>
                            )}
                            {actionBadge(effectiveAction, inferred)}
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(log.created_at), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </span>
                            {log.duration_ms != null && (
                              <span className="text-[10px] text-muted-foreground">
                                · {log.duration_ms}ms
                              </span>
                            )}
                            {log.error_code && (
                              <span className="text-[10px] text-destructive">
                                · {log.error_code}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-3 pb-3 space-y-2">
                      <Detail
                        label="URL externa"
                        value={log.external_url}
                        onCopy={() => copy(`${log.id}-url`, log.external_url)}
                        copied={copiedId === `${log.id}-url`}
                        mono
                      />
                      <Detail
                        label="Request body"
                        value={
                          log.request_body
                            ? JSON.stringify(log.request_body, null, 2)
                            : "(vazio)"
                        }
                        onCopy={() => copy(`${log.id}-req`, log.request_body)}
                        copied={copiedId === `${log.id}-req`}
                        mono
                        block
                      />
                      <Detail
                        label="Response body"
                        value={
                          log.response_body
                            ? JSON.stringify(log.response_body, null, 2)
                            : log.response_text ?? "(vazio)"
                        }
                        onCopy={() =>
                          copy(`${log.id}-resp`, log.response_body ?? log.response_text)
                        }
                        copied={copiedId === `${log.id}-resp`}
                        mono
                        block
                      />
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Detail({
  label,
  value,
  onCopy,
  copied,
  mono,
  block,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  mono?: boolean;
  block?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCopy}
          className="h-6 gap-1 text-[10px]"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
      {block ? (
        <pre
          className={`rounded-md border border-border/60 bg-background/60 p-2 text-[11px] leading-relaxed overflow-x-auto max-h-48 whitespace-pre-wrap break-words ${
            mono ? "font-mono" : ""
          }`}
        >
          {value}
        </pre>
      ) : (
        <p
          className={`text-[11px] break-all text-foreground/80 ${
            mono ? "font-mono" : ""
          }`}
        >
          {value}
        </p>
      )}
    </div>
  );
}
