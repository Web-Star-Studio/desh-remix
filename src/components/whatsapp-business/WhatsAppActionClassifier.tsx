/**
 * WhatsAppActionClassifier — diagnostic panel that previews which credit
 * action (`wa_message_send` vs `wa_broadcast_send`) the late-proxy would
 * charge for a given /posts payload, and explains *why* by listing the
 * exact payload fields that drove the decision.
 *
 * Calls the late-proxy `__classify_action` dry-run route — pure inspection,
 * no upstream send, no credit deduction.
 *
 * Fixtures come from `src/lib/whatsapp/postsFixtures.ts` — the SAME source
 * the Deno test suite uses, so the UI replay is guaranteed to match what
 * automated tests assert. Use the "Replay all" button to dry-run every
 * fixture and verify expected vs. actual credit action when payload schemas
 * change.
 */
import { useMemo, useState } from "react";
import {
  Loader2,
  Sparkles,
  Copy,
  FileJson,
  AlertTriangle,
  CheckCircle2,
  PlayCircle,
  XCircle,
  Download,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  WHATSAPP_POSTS_FIXTURES,
  FIXTURES_SCHEMA_VERSION,
  groupFixturesByCategory,
  type WhatsAppPostsFixture,
  type ExpectedAction,
} from "@/lib/whatsapp/postsFixtures";

type ClassifyResult = {
  action: ExpectedAction;
  isWhatsApp: boolean;
  detectedFields: string[];
  reason: string;
  shape: {
    hasPlatformsArray: boolean;
    waPlatformIndex: number | null;
    hasTopLevelWhatsappOptions: boolean;
    waOptionKeys: string[];
  };
};

type ReplayRow = {
  id: string;
  label: string;
  expected: ExpectedAction;
  actual: ExpectedAction | "error";
  pass: boolean;
  reason?: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  message: "Mensagem",
  template: "Template",
  media: "Mídia",
  broadcast: "Broadcast",
  mixed: "Mistura de plataformas",
  alias: "Aliases / normalização",
  edge: "Edge cases",
};

export default function WhatsAppActionClassifier() {
  const grouped = useMemo(() => groupFixturesByCategory(), []);
  const [activeId, setActiveId] = useState<string>(WHATSAPP_POSTS_FIXTURES[0].id);
  const [payload, setPayload] = useState<string>(() =>
    JSON.stringify(WHATSAPP_POSTS_FIXTURES[0].body, null, 2),
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClassifyResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Replay-all state
  const [replaying, setReplaying] = useState(false);
  const [replayRows, setReplayRows] = useState<ReplayRow[]>([]);
  const [replayProgress, setReplayProgress] = useState<{ done: number; total: number } | null>(null);

  const handleClassify = async () => {
    setParseError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch (err) {
      setParseError(`JSON inválido: ${(err as Error).message}`);
      setResult(null);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("late-proxy", {
        body: { route: "__classify_action", method: "POST", body: parsed },
      });
      if (error) {
        toast.error("Falha ao classificar", { description: error.message });
        return;
      }
      setResult(data as ClassifyResult);
    } finally {
      setLoading(false);
    }
  };

  const handlePickFixture = (fixture: WhatsAppPostsFixture) => {
    setActiveId(fixture.id);
    setPayload(JSON.stringify(fixture.body, null, 2));
    setResult(null);
    setParseError(null);
  };

  const handleCopyPayload = async () => {
    await navigator.clipboard.writeText(payload);
    toast.success("Payload copiado");
  };

  const runReplay = async (subset: WhatsAppPostsFixture[]) => {
    if (subset.length === 0) {
      toast.info("Nada para reexecutar — todos os fixtures passaram.");
      return;
    }
    setReplaying(true);
    // When re-running a subset, keep previously-passed rows visible and only
    // refresh the failed entries — operators see deltas without losing history.
    const previousById = new Map(replayRows.map((r) => [r.id, r]));
    setReplayProgress({ done: 0, total: subset.length });
    let passed = 0;

    for (let i = 0; i < subset.length; i++) {
      const fx = subset[i];
      let row: ReplayRow;
      try {
        const { data, error } = await supabase.functions.invoke("late-proxy", {
          body: { route: "__classify_action", method: "POST", body: fx.body },
        });
        if (error) {
          row = {
            id: fx.id,
            label: fx.label,
            expected: fx.expectedAction,
            actual: "error",
            pass: false,
            reason: error.message,
          };
        } else {
          const r = data as ClassifyResult;
          const pass = r.action === fx.expectedAction;
          if (pass) passed++;
          row = {
            id: fx.id,
            label: fx.label,
            expected: fx.expectedAction,
            actual: r.action,
            pass,
            reason: r.reason,
          };
        }
      } catch (err) {
        row = {
          id: fx.id,
          label: fx.label,
          expected: fx.expectedAction,
          actual: "error",
          pass: false,
          reason: (err as Error).message,
        };
      }
      previousById.set(fx.id, row);
      setReplayProgress({ done: i + 1, total: subset.length });
      // Preserve original fixture order (not insertion order).
      setReplayRows(
        WHATSAPP_POSTS_FIXTURES.map((f) => previousById.get(f.id)).filter(
          (r): r is ReplayRow => !!r,
        ),
      );
    }
    setReplaying(false);
    if (passed === subset.length) {
      toast.success(`Todos os ${passed} fixture(s) passaram`);
    } else {
      toast.error(`${subset.length - passed} fixture(s) divergiram`, {
        description: "Verifique a tabela de replay para detalhes",
      });
    }
  };

  const handleReplayAll = () => runReplay(WHATSAPP_POSTS_FIXTURES);

  const handleReplayFailures = () => {
    const failedIds = new Set(replayRows.filter((r) => !r.pass).map((r) => r.id));
    const subset = WHATSAPP_POSTS_FIXTURES.filter((f) => failedIds.has(f.id));
    void runReplay(subset);
  };

  const handleExportResults = () => {
    if (replayRows.length === 0) {
      toast.info("Nada para exportar — rode o Replay primeiro.");
      return;
    }
    const payload = {
      exportedAt: new Date().toISOString(),
      schemaVersion: FIXTURES_SCHEMA_VERSION,
      summary: {
        total: replayRows.length,
        passed: replayRows.filter((r) => r.pass).length,
        failed: replayRows.filter((r) => !r.pass).length,
      },
      results: replayRows,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `whatsapp-classifier-replay-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Resultados exportados");
  };

  const actionBadge = (action: ExpectedAction) => {
    if (action === "wa_message_send") {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 font-mono text-[11px]">
          wa_message_send
        </Badge>
      );
    }
    if (action === "wa_broadcast_send") {
      return (
        <Badge className="bg-violet-500/15 text-violet-600 hover:bg-violet-500/20 font-mono text-[11px]">
          wa_broadcast_send
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="font-mono text-[11px]">
        sem cobrança
      </Badge>
    );
  };

  const activeFixture = WHATSAPP_POSTS_FIXTURES.find((f) => f.id === activeId);

  return (
    <Card className="border-border/60 bg-card/40 backdrop-blur-sm shadow-sm">
      <CardHeader className="pb-3 border-b border-border/40">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ backgroundColor: "hsl(262 70% 55% / 0.15)" }}
          >
            <Sparkles className="h-3.5 w-3.5" style={{ color: "hsl(262,70%,55%)" }} />
          </span>
          Classificador de ação de crédito (/posts)
          <Badge variant="outline" className="ml-auto text-[10px] font-mono">
            v{FIXTURES_SCHEMA_VERSION}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Replay de payloads <code className="px-1 py-0.5 rounded bg-muted/50 text-[10px]">/posts</code> usando
          fixtures reutilizáveis (mesmo arquivo do test suite). Cada fixture documenta a ação esperada
          (<code className="text-[10px]">wa_message_send</code> ou <code className="text-[10px]">wa_broadcast_send</code>);
          o botão <strong>Replay all</strong> roda todas em modo dry-run para verificar regressões quando
          o schema do payload muda. Não envia nada nem cobra créditos.
        </p>

        {/* Fixture picker — grouped by category */}
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Fixtures ({WHATSAPP_POSTS_FIXTURES.length})
          </p>
          <div className="space-y-2.5">
            {(Object.keys(grouped) as Array<keyof typeof grouped>).map((cat) => {
              const items = grouped[cat];
              if (items.length === 0) return null;
              return (
                <div key={cat} className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground/80">{CATEGORY_LABELS[cat]}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((fx) => (
                      <Button
                        key={fx.id}
                        variant={activeId === fx.id ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-[11px] px-2.5"
                        onClick={() => handlePickFixture(fx)}
                        title={fx.description}
                      >
                        {fx.label}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {activeFixture && (
          <div className="rounded-md border border-border/40 bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground flex items-center justify-between gap-3 flex-wrap">
            <span>
              <span className="text-foreground/80">{activeFixture.description}</span>
            </span>
            <span className="flex items-center gap-1.5">
              esperado: {actionBadge(activeFixture.expectedAction)}
            </span>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
              <FileJson className="h-3 w-3" />
              Payload (JSON)
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] gap-1"
              onClick={handleCopyPayload}
            >
              <Copy className="h-3 w-3" />
              Copiar
            </Button>
          </div>
          <Textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            spellCheck={false}
            rows={12}
            className="font-mono text-[11px] leading-relaxed resize-y bg-muted/20 border-border/50"
          />
          {parseError && (
            <p className="text-[11px] text-destructive flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3" />
              {parseError}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleClassify}
            disabled={loading || replaying}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Classificando..." : "Classificar este payload"}
          </Button>
          <Button
            onClick={handleReplayAll}
            disabled={loading || replaying}
            variant="default"
            size="sm"
            className="gap-2"
          >
            {replaying ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            {replaying
              ? `Replay ${replayProgress?.done ?? 0}/${replayProgress?.total ?? 0}`
              : `Replay all (${WHATSAPP_POSTS_FIXTURES.length})`}
          </Button>
          {replayRows.some((r) => !r.pass) && (
            <Button
              onClick={handleReplayFailures}
              disabled={loading || replaying}
              variant="secondary"
              size="sm"
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Re-rodar falhas ({replayRows.filter((r) => !r.pass).length})
            </Button>
          )}
          {replayRows.length > 0 && (
            <Button
              onClick={handleExportResults}
              disabled={replaying}
              variant="ghost"
              size="sm"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar JSON
            </Button>
          )}
        </div>

        {result && (
          <div className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-medium">Ação cobrada:</span>
                {actionBadge(result.action)}
              </div>
              <Badge variant="outline" className="text-[10px]">
                {result.isWhatsApp ? "WhatsApp detectado" : "Sem WhatsApp"}
              </Badge>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Por quê?
              </p>
              <p className="text-xs leading-relaxed text-foreground/90">{result.reason}</p>
            </div>

            {result.detectedFields.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Campos detectados ({result.detectedFields.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {result.detectedFields.map((f) => (
                    <code
                      key={f}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-background/70 border border-border/50"
                    >
                      {f}
                    </code>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Estrutura do payload
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <ShapeRow
                  label="platforms[]"
                  value={result.shape.hasPlatformsArray ? "presente" : "ausente"}
                  ok={result.shape.hasPlatformsArray}
                />
                <ShapeRow
                  label="WA platform index"
                  value={result.shape.waPlatformIndex !== null ? `[${result.shape.waPlatformIndex}]` : "—"}
                  ok={result.shape.waPlatformIndex !== null}
                />
                <ShapeRow
                  label="whatsappOptions top-level"
                  value={result.shape.hasTopLevelWhatsappOptions ? "presente" : "ausente"}
                  ok={result.shape.hasTopLevelWhatsappOptions}
                />
                <ShapeRow
                  label="waOptions keys"
                  value={result.shape.waOptionKeys.length > 0 ? result.shape.waOptionKeys.join(", ") : "—"}
                  ok={result.shape.waOptionKeys.length > 0}
                />
              </div>
            </div>
          </div>
        )}

        {/* Replay-all results table */}
        {replayRows.length > 0 && (
          <div className="space-y-2 rounded-lg border border-border/50 bg-muted/10 p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Replay results — {replayRows.filter((r) => r.pass).length}/{replayRows.length} passaram
              </p>
              <Badge variant="outline" className="text-[10px]">
                {replaying ? "rodando..." : "concluído"}
              </Badge>
            </div>
            <div className="space-y-1 max-h-[260px] overflow-y-auto pr-1">
              {replayRows.map((row) => (
                <div
                  key={row.id}
                  className={`flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-[11px] ${
                    row.pass
                      ? "border-border/40 bg-background/40"
                      : "border-destructive/40 bg-destructive/5"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {row.pass ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    )}
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                      [{row.id}]
                    </span>
                    <span className="truncate">{row.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <code className="text-[9px] text-muted-foreground/70">
                      esperado: {row.expected ?? "null"}
                    </code>
                    <span className="text-muted-foreground/40">→</span>
                    <code
                      className={`text-[9px] font-mono ${
                        row.pass ? "text-foreground/80" : "text-destructive"
                      }`}
                    >
                      {row.actual ?? "null"}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ShapeRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-border/40 bg-background/50 px-2.5 py-1.5">
      <span className="text-muted-foreground truncate">{label}</span>
      <code
        className={`font-mono text-[10px] truncate max-w-[60%] text-right ${
          ok ? "text-foreground" : "text-muted-foreground/60"
        }`}
        title={value}
      >
        {value}
      </code>
    </div>
  );
}
