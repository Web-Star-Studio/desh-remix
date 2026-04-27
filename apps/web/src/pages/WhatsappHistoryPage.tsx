/**
 * WhatsappHistoryPage — /messages/whatsapp/history
 *
 * Displays delivery/read status for every message sent via Zernio.
 * Live updates flow in through `useWhatsAppSendLogs` (Supabase Realtime).
 */
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { History, Search, Phone, RefreshCw, Send, CheckCheck, Eye, AlertTriangle, X } from "lucide-react";
import PageLayout from "@/components/dashboard/PageLayout";
import PageHeader from "@/components/dashboard/PageHeader";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeliveryStatusBadge } from "@/components/whatsapp-business/DeliveryStatusBadge";
import { HighlightedText } from "@/components/ui/highlighted-text";
import {
  useWhatsAppSendLogs,
  computeStats,
  type DeliveryStatus,
} from "@/hooks/whatsapp/useWhatsAppSendLogs";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_OPTIONS: Array<{ value: DeliveryStatus | "all"; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "sent", label: "Enviadas" },
  { value: "delivered", label: "Entregues" },
  { value: "read", label: "Lidas" },
  { value: "failed", label: "Falharam" },
];

export default function WhatsappHistoryPage() {
  const [phone, setPhone] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<DeliveryStatus | "all">("all");

  const { data: logs = [], isLoading, refetch, isFetching } = useWhatsAppSendLogs({
    phone,
    content,
    status,
    limit: 300,
  });

  const stats = useMemo(() => computeStats(logs), [logs]);

  // Highlight inputs derived from active filters
  const phoneDigits = phone.replace(/\D+/g, "");
  const contentTerms = content.trim() ? [content.trim()] : [];
  const hasFilters = phone.trim() !== "" || content.trim() !== "" || status !== "all";

  return (
    <PageLayout maxWidth="7xl">
      <PageHeader
        title="Histórico de WhatsApp"
        icon={<History className="w-5 h-5 text-[hsl(142,70%,45%)] drop-shadow" />}
        subtitle="Status de entrega e leitura de cada mensagem enviada via Zernio"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        }
      />

      {/* Stats */}
      <AnimatedItem index={0}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard
            label="Total"
            value={stats.total}
            icon={<Send className="w-4 h-4" />}
            tone="muted"
          />
          <StatCard
            label="Enviadas"
            value={stats.sent}
            icon={<Send className="w-4 h-4" />}
            tone="muted"
          />
          <StatCard
            label="Entregues"
            value={stats.delivered + stats.read}
            sub={`${stats.deliveryRate}% taxa`}
            icon={<CheckCheck className="w-4 h-4" />}
            tone="info"
          />
          <StatCard
            label="Lidas"
            value={stats.read}
            sub={`${stats.readRate}% taxa`}
            icon={<Eye className="w-4 h-4" />}
            tone="success"
          />
          <StatCard
            label="Falharam"
            value={stats.failed}
            icon={<AlertTriangle className="w-4 h-4" />}
            tone="destructive"
          />
        </div>
      </AnimatedItem>

      {/* Filters */}
      <AnimatedItem index={1}>
        <Card className="p-4 mb-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Telefone (ex.: 11 99999, +55 11, 5511…)"
                className="pl-9 pr-9"
                inputMode="tel"
                aria-label="Filtrar por telefone"
              />
              {phone && (
                <button
                  type="button"
                  onClick={() => setPhone("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground"
                  aria-label="Limpar filtro de telefone"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Conteúdo da mensagem ou nome do template…"
                className="pl-9 pr-9"
                aria-label="Filtrar por conteúdo"
              />
              {content && (
                <button
                  type="button"
                  onClick={() => setContent("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground"
                  aria-label="Limpar filtro de conteúdo"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as DeliveryStatus | "all")}>
              <SelectTrigger className="md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasFilters && (
            <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                {logs.length} {logs.length === 1 ? "resultado" : "resultados"}
                {phoneDigits.length >= 3 && (
                  <span className="ml-2">
                    · telefone <span className="font-mono">{phoneDigits}</span>
                  </span>
                )}
                {content.trim() && (
                  <span className="ml-2">· conteúdo "{content.trim()}"</span>
                )}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  setPhone("");
                  setContent("");
                  setStatus("all");
                }}
              >
                <X className="w-3.5 h-3.5" />
                Limpar filtros
              </Button>
            </div>
          )}
        </Card>
      </AnimatedItem>

      {/* Table */}
      <AnimatedItem index={2}>
        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Carregando histórico…
            </div>
          ) : logs.length === 0 ? (
            <div className="p-16 text-center">
              <History className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Nenhuma mensagem encontrada com os filtros atuais.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Status</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Conteúdo</TableHead>
                    <TableHead className="w-[100px]">Tipo</TableHead>
                    <TableHead className="w-[160px]">Enviado</TableHead>
                    <TableHead className="w-[120px]">Lida</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b transition-colors hover:bg-muted/30"
                    >
                      <TableCell>
                        <DeliveryStatusBadge
                          status={
                            log.deliveryStatus ??
                            (log.status === "failed" ? "failed" : "sent")
                          }
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <HighlightedText
                          text={log.toPhone}
                          digits={phoneDigits.length >= 3 ? phoneDigits : undefined}
                        />
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        <div className="truncate text-sm">
                          {log.messagePreview ? (
                            <HighlightedText
                              text={log.messagePreview}
                              terms={contentTerms}
                            />
                          ) : (
                            <span className="text-muted-foreground italic">—</span>
                          )}
                        </div>
                        {log.templateName && (
                          <div className="text-[11px] text-muted-foreground/80 truncate mt-0.5">
                            <HighlightedText
                              text={`Template: ${log.templateName}`}
                              terms={contentTerms}
                            />
                          </div>
                        )}
                        {log.errorMessage && (
                          <div className="text-[11px] text-destructive truncate mt-0.5">
                            {log.errorMessage}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-0.5 rounded bg-muted">
                          {log.messageType === "template" ? "Template" : "Texto"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.createdAt), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.readAt
                          ? formatDistanceToNow(new Date(log.readAt), {
                              addSuffix: true,
                              locale: ptBR,
                            })
                          : "—"}
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </AnimatedItem>
    </PageLayout>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  sub?: string;
  icon: React.ReactNode;
  tone: "muted" | "info" | "success" | "destructive";
}

function StatCard({ label, value, sub, icon, tone }: StatCardProps) {
  const toneClass = {
    muted: "text-muted-foreground",
    info: "text-[hsl(220,80%,55%)]",
    success: "text-[hsl(142,70%,45%)]",
    destructive: "text-destructive",
  }[tone];

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <span className={toneClass}>{icon}</span>
      </div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}
