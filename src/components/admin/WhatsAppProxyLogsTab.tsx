import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, ScrollText, Filter, X, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Admin dashboard for `whatsapp_proxy_logs`.
 *
 * Privacy guarantee: this view never renders `request_body`, `response_body`
 * or `response_text`. It only surfaces structural diagnostics (route, status,
 * latency, error code) and a derived "redacted bytes" metric extracted from
 * `[REDACTED:N]` markers inserted by the late-proxy edge function.
 */

interface ProxyLogRow {
  id: string;
  user_id: string;
  workspace_id: string | null;
  route_path: string;
  method: string;
  request_body: unknown;
  response_status: number | null;
  duration_ms: number | null;
  error_code: string | null;
  action: string | null;
  created_at: string;
}

type StatusFilter = "all" | "2xx" | "4xx" | "5xx" | "pending";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos os status" },
  { value: "2xx", label: "Sucesso (2xx)" },
  { value: "4xx", label: "Cliente (4xx)" },
  { value: "5xx", label: "Servidor (5xx)" },
  { value: "pending", label: "Sem status" },
];

const REDACTION_RE = /\[REDACTED:(\d+)\]/g;

/**
 * Walk a JSON body and sum the `N` values from every `[REDACTED:N]` marker.
 * Returns 0 if no markers are present. Pure — never inspects raw text.
 */
function countRedactedBytes(value: unknown): { bytes: number; occurrences: number } {
  if (value == null) return { bytes: 0, occurrences: 0 };
  let bytes = 0;
  let occurrences = 0;
  const visit = (node: unknown) => {
    if (node == null) return;
    if (typeof node === "string") {
      let m: RegExpExecArray | null;
      REDACTION_RE.lastIndex = 0;
      while ((m = REDACTION_RE.exec(node)) !== null) {
        bytes += Number.parseInt(m[1], 10) || 0;
        occurrences += 1;
      }
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (typeof node === "object") {
      for (const v of Object.values(node as Record<string, unknown>)) visit(v);
    }
  };
  visit(value);
  return { bytes, occurrences };
}

function statusVariant(status: number | null): "default" | "secondary" | "destructive" {
  if (status == null) return "secondary";
  if (status >= 500 || status >= 400) return "destructive";
  if (status >= 200 && status < 300) return "default";
  return "secondary";
}

function statusBucket(status: number | null): StatusFilter {
  if (status == null) return "pending";
  if (status >= 500) return "5xx";
  if (status >= 400) return "4xx";
  if (status >= 200 && status < 300) return "2xx";
  return "pending";
}

const PAGE_SIZE = 100;

export default function WhatsAppProxyLogsTab() {
  const [rows, setRows] = useState<ProxyLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [minRedactedBytes, setMinRedactedBytes] = useState<string>("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_proxy_logs")
      .select(
        "id,user_id,workspace_id,route_path,method,request_body,response_status,duration_ms,error_code,action,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);
    setLoading(false);
    if (error) {
      toast.error("Falha ao carregar logs do proxy");
      return;
    }
    setRows((data ?? []) as ProxyLogRow[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const enriched = useMemo(
    () =>
      rows.map((row) => {
        const redacted = countRedactedBytes(row.request_body);
        return { row, redacted, bucket: statusBucket(row.response_status) };
      }),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const minBytes = Number.parseInt(minRedactedBytes, 10);
    return enriched.filter(({ row, redacted, bucket }) => {
      if (statusFilter !== "all" && bucket !== statusFilter) return false;
      if (Number.isFinite(minBytes) && minBytes > 0 && redacted.bytes < minBytes) return false;
      if (q) {
        const hay = `${row.route_path} ${row.method} ${row.error_code ?? ""} ${
          row.action ?? ""
        } ${row.response_status ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [enriched, search, statusFilter, minRedactedBytes]);

  const totals = useMemo(() => {
    let totalRedactedBytes = 0;
    let totalOccurrences = 0;
    let errors = 0;
    for (const { row, redacted, bucket } of enriched) {
      totalRedactedBytes += redacted.bytes;
      totalOccurrences += redacted.occurrences;
      if (bucket === "4xx" || bucket === "5xx") errors++;
      void row;
    }
    return { totalRedactedBytes, totalOccurrences, errors };
  }, [enriched]);

  const hasActiveFilter =
    search.trim().length > 0 || statusFilter !== "all" || minRedactedBytes.trim().length > 0;

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setMinRedactedBytes("");
  };

  return (
    <Card className="border-border/60 bg-card/40 backdrop-blur-sm shadow-sm">
      <CardHeader className="pb-3 border-b border-border/40 flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60">
            <ScrollText className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          WhatsApp Proxy Logs
          <Badge variant="outline" className="text-[10px] font-mono ml-1">
            {filtered.length}/{enriched.length}
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
        {/* Privacy notice */}
        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
          <span>
            Esta visão nunca expõe o conteúdo das mensagens. Campos sensíveis são
            redigidos pelo proxy como{" "}
            <code className="font-mono text-foreground/80">[REDACTED:N]</code> — apenas o
            tamanho original (em caracteres) é exibido aqui.
          </span>
        </div>

        {/* Aggregate stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatPill label="Logs (página)" value={enriched.length} />
          <StatPill label="Filtrados" value={filtered.length} />
          <StatPill label="Erros (4xx/5xx)" value={totals.errors} tone="destructive" />
          <StatPill
            label="Bytes redigidos"
            value={totals.totalRedactedBytes}
            sub={`${totals.totalOccurrences} ocorrência(s)`}
          />
        </div>

        {/* Filters */}
        <div className="space-y-2.5 rounded-lg border border-border/50 bg-muted/10 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
              <Filter className="h-3 w-3" />
              Filtros
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por route_path / status / erro..."
                className="h-8 text-xs pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={0}
              value={minRedactedBytes}
              onChange={(e) => setMinRedactedBytes(e.target.value)}
              placeholder="Bytes redigidos mínimos"
              className="h-8 text-xs"
            />
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {loading
              ? "Carregando..."
              : hasActiveFilter
              ? "Nenhum log corresponde aos filtros."
              : "Nenhum log registrado ainda."}
          </p>
        ) : (
          <div className="rounded-lg border border-border/40 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20">
                  <TableHead className="text-[10px] uppercase tracking-wider">Quando</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">Método</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">Rota</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-right">
                    Latência
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-right">
                    Redigido
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">Ação</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider">Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(({ row, redacted }) => (
                  <TableRow key={row.id} className="text-xs">
                    <TableCell className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                      {format(new Date(row.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusVariant(row.response_status)}
                        className="text-[10px] font-mono min-w-12 justify-center"
                      >
                        {row.response_status ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-[10px] font-semibold">
                      {row.method}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] max-w-[280px] truncate" title={row.route_path}>
                      {row.route_path}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] text-right text-muted-foreground">
                      {row.duration_ms != null ? `${row.duration_ms}ms` : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] text-right">
                      {redacted.occurrences > 0 ? (
                        <span title={`${redacted.occurrences} marcador(es) [REDACTED:N]`}>
                          {redacted.bytes}b
                          <span className="text-muted-foreground/60">
                            {" "}
                            ×{redacted.occurrences}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">0</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">
                      {row.action ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] text-destructive/80 max-w-[120px] truncate" title={row.error_code ?? undefined}>
                      {row.error_code ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatPill({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: "default" | "destructive";
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        tone === "destructive"
          ? "border-destructive/30 bg-destructive/5"
          : "border-border/50 bg-muted/10"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </p>
      <p
        className={`text-lg font-semibold font-mono mt-0.5 ${
          tone === "destructive" ? "text-destructive" : "text-foreground"
        }`}
      >
        {value.toLocaleString("pt-BR")}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
