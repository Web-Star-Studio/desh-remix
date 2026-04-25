import { useState, useCallback } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAdminRole } from "@/hooks/admin/useAdminRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Zap,
  AlertTriangle,
  Copy,
  Rocket,
} from "lucide-react";

type StepStatus = "idle" | "running" | "ok" | "fail";

interface CheckStep {
  id: string;
  label: string;
  status: StepStatus;
  durationMs?: number;
  detail?: string;
  payload?: unknown;
}

const TARGET_FUNCTION = "integrations-connect";

export default function PreDeployCheckPage() {
  const { isAdmin, loading: roleLoading } = useAdminRole();
  const navigate = useNavigate();
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<CheckStep[]>([]);
  const [overall, setOverall] = useState<StepStatus>("idle");
  const [startedAt, setStartedAt] = useState<string | null>(null);

  const updateStep = useCallback((id: string, patch: Partial<CheckStep>) => {
    setSteps(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const runChecks = useCallback(async () => {
    setRunning(true);
    setOverall("running");
    setStartedAt(new Date().toISOString());

    const initial: CheckStep[] = [
      { id: "session", label: "Verificar sessão autenticada", status: "idle" },
      { id: "boot", label: `Boot da função "${TARGET_FUNCTION}"`, status: "idle" },
      { id: "response", label: "Validar contrato da resposta", status: "idle" },
      { id: "latency", label: "Latência aceitável (< 5s)", status: "idle" },
    ];
    setSteps(initial);

    let finalOk = true;

    // Step 1 — session
    updateStep("session", { status: "running" });
    const t0 = performance.now();
    const { data: { session } } = await supabase.auth.getSession();
    const sessionMs = Math.round(performance.now() - t0);

    if (!session?.access_token) {
      updateStep("session", {
        status: "fail",
        durationMs: sessionMs,
        detail: "Nenhuma sessão ativa — faça login antes de executar o teste.",
      });
      setOverall("fail");
      setRunning(false);
      return;
    }
    updateStep("session", {
      status: "ok",
      durationMs: sessionMs,
      detail: `User ID: ${session.user.id}`,
    });

    // Step 2 — boot
    updateStep("boot", { status: "running" });
    const bootStart = performance.now();
    let bootMs = 0;
    let rawBody: unknown = null;
    let bootError: string | null = null;
    let httpStatus: number | null = null;

    try {
      const { data, error } = await supabase.functions.invoke(TARGET_FUNCTION, {
        body: { action: "status", workspace_id: "default" },
      });
      bootMs = Math.round(performance.now() - bootStart);
      rawBody = data ?? error;
      if (error) {
        bootError = error.message || "Erro desconhecido";
        // FunctionsHttpError exposes context
        const ctx = (error as { context?: { status?: number } }).context;
        httpStatus = ctx?.status ?? null;
      }
    } catch (e) {
      bootMs = Math.round(performance.now() - bootStart);
      bootError = e instanceof Error ? e.message : String(e);
    }

    if (bootError) {
      updateStep("boot", {
        status: "fail",
        durationMs: bootMs,
        detail: `${httpStatus ? `HTTP ${httpStatus} — ` : ""}${bootError}`,
        payload: rawBody,
      });
      finalOk = false;
      // Skip remaining steps but mark them as failed for clarity
      updateStep("response", { status: "fail", detail: "Pulado — boot falhou" });
      updateStep("latency", {
        status: bootMs < 5000 ? "ok" : "fail",
        durationMs: bootMs,
        detail: bootMs < 5000 ? "Função respondeu dentro do limite (mesmo com erro)" : "Tempo de resposta acima de 5s",
      });
      setOverall("fail");
      setRunning(false);
      return;
    }

    updateStep("boot", {
      status: "ok",
      durationMs: bootMs,
      detail: `Função iniciou e respondeu com sucesso`,
      payload: rawBody,
    });

    // Step 3 — response contract
    updateStep("response", { status: "running" });
    const body = rawBody as { connected?: unknown; detailed?: unknown } | null;
    const hasConnected = Array.isArray(body?.connected);
    const hasDetailed = Array.isArray(body?.detailed);

    if (!hasConnected || !hasDetailed) {
      updateStep("response", {
        status: "fail",
        detail: `Esperado { connected: [], detailed: [] }. Recebido: ${JSON.stringify(body).slice(0, 200)}`,
      });
      finalOk = false;
    } else {
      updateStep("response", {
        status: "ok",
        detail: `connected=${(body!.connected as unknown[]).length} • detailed=${(body!.detailed as unknown[]).length}`,
      });
    }

    // Step 4 — latency
    updateStep("latency", {
      status: bootMs < 5000 ? "ok" : "fail",
      durationMs: bootMs,
      detail: bootMs < 5000 ? `${bootMs}ms` : `${bootMs}ms — acima do limite de 5000ms`,
    });
    if (bootMs >= 5000) finalOk = false;

    setOverall(finalOk ? "ok" : "fail");
    setRunning(false);
  }, [updateStep]);

  const copyReport = useCallback(() => {
    const report = {
      function: TARGET_FUNCTION,
      ranAt: startedAt,
      overall,
      steps,
    };
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
  }, [steps, overall, startedAt]);

  if (roleLoading) {
    return <div className="flex items-center justify-center h-screen text-muted-foreground">Carregando…</div>;
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Rocket className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Pre-Deploy Check</h1>
            <p className="text-xs text-muted-foreground">
              Validação de boot e contrato para <code className="text-foreground">{TARGET_FUNCTION}</code>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {steps.length > 0 && (
            <Button variant="outline" size="sm" onClick={copyReport}>
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              Copiar relatório
            </Button>
          )}
          <Button onClick={runChecks} disabled={running} size="sm">
            {running ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Executando…</>
            ) : (
              <><PlayCircle className="w-3.5 h-3.5 mr-1.5" /> Executar verificação</>
            )}
          </Button>
        </div>
      </div>

      {/* Overall status */}
      <Card className={
        overall === "ok" ? "border-emerald-500/40 bg-emerald-500/5" :
        overall === "fail" ? "border-destructive/50 bg-destructive/5" :
        overall === "running" ? "border-primary/40 bg-primary/5" :
        "border-border"
      }>
        <CardContent className="p-4 flex items-center gap-3">
          <OverallIcon status={overall} />
          <div className="flex-1">
            <p className="text-sm font-medium">{overallLabel(overall)}</p>
            {startedAt && (
              <p className="text-xs text-muted-foreground">
                Última execução: {new Date(startedAt).toLocaleString("pt-BR")}
              </p>
            )}
          </div>
          {overall !== "idle" && (
            <Badge variant="outline" className="font-mono text-[10px]">
              {steps.filter(s => s.status === "ok").length}/{steps.length} ok
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Steps */}
      {steps.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Clique em <strong className="text-foreground">Executar verificação</strong> para iniciar o teste de boot.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {steps.map(step => (
            <StepRow key={step.id} step={step} />
          ))}
        </div>
      )}

      {/* Help */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-muted-foreground" />
            Em caso de falha
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1.5">
          <p>• Verifique se as variáveis <code>SUPABASE_URL</code> e <code>SUPABASE_SERVICE_ROLE_KEY</code> estão configuradas.</p>
          <p>• Confirme que o secret <code>COMPOSIO_API_KEY</code> existe no projeto Cloud.</p>
          <p>• Inspecione os logs do edge function para erros de import ou runtime.</p>
          <p>• Se o erro for HTTP 401, valide o token de sessão com logout/login.</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────────────────────

function OverallIcon({ status }: { status: StepStatus }) {
  if (status === "running") return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
  if (status === "ok") return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
  if (status === "fail") return <XCircle className="w-5 h-5 text-destructive" />;
  return <Zap className="w-5 h-5 text-muted-foreground" />;
}

function overallLabel(status: StepStatus) {
  switch (status) {
    case "ok": return "Tudo certo — função pronta para deploy";
    case "fail": return "Falha detectada — revise os passos abaixo";
    case "running": return "Executando verificações…";
    default: return "Aguardando execução";
  }
}

function StepRow({ step }: { step: CheckStep }) {
  return (
    <Card className={
      step.status === "fail" ? "border-destructive/40" :
      step.status === "ok" ? "border-emerald-500/30" :
      "border-border"
    }>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            {step.status === "running" && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
            {step.status === "ok" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            {step.status === "fail" && <XCircle className="w-4 h-4 text-destructive" />}
            {step.status === "idle" && <Clock className="w-4 h-4 text-muted-foreground" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{step.label}</p>
              {step.durationMs !== undefined && (
                <Badge variant="outline" className="font-mono text-[10px]">
                  {step.durationMs}ms
                </Badge>
              )}
            </div>
            {step.detail && (
              <p className={`text-xs mt-1 break-words ${step.status === "fail" ? "text-destructive" : "text-muted-foreground"}`}>
                {step.detail}
              </p>
            )}
          </div>
        </div>
        {step.payload !== undefined && step.payload !== null && (
          <details className="ml-7">
            <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
              Ver payload bruto
            </summary>
            <pre className="mt-2 p-2 rounded bg-muted/40 text-[10px] overflow-x-auto max-h-64">
              {JSON.stringify(step.payload, null, 2)}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
