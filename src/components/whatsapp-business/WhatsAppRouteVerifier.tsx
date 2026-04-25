/**
 * WhatsAppRouteVerifier — diagnostic card that probes the Zernio API to
 * confirm which WhatsApp send route is live before the operator attempts
 * a real send. Surfaces per-candidate status (200/401/404) so misconfigured
 * tenants get an actionable signal instead of an opaque 404 mid-send.
 */
import { useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, XCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { verifyZernioSendRoute, type ZernioSendRouteResult } from "@/services/zernio/client";

interface Props {
  onVerified?: (route: string | null) => void;
}

export default function WhatsAppRouteVerifier({ onVerified }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ZernioSendRouteResult | null>(null);

  const handleVerify = async () => {
    setLoading(true);
    try {
      const res = await verifyZernioSendRoute();
      setResult(res);
      onVerified?.(res.ok ? res.activeRoute : null);
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (status: number, exists: boolean) => {
    if (status === 0) return <Badge variant="destructive" className="text-[10px]">offline</Badge>;
    if (!exists) return <Badge variant="destructive" className="text-[10px]">404</Badge>;
    if (status >= 200 && status < 300) {
      return <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 text-[10px]">{status}</Badge>;
    }
    if (status === 401 || status === 403) {
      return <Badge className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/20 text-[10px]">{status}</Badge>;
    }
    return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
  };

  return (
    <Card className="border-border/60 bg-card/40 backdrop-blur-sm shadow-sm">
      <CardHeader className="pb-3 border-b border-border/40">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ backgroundColor: "hsl(142 70% 45% / 0.15)" }}
          >
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: "hsl(142,70%,45%)" }} />
          </span>
          Verificar rota de envio Zernio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Antes de enviar uma mensagem, valide qual endpoint da API Zernio está ativo.
          Útil para diagnosticar erros 404 sem gastar créditos.
        </p>

        <Button
          onClick={handleVerify}
          disabled={loading}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          {loading ? "Verificando..." : "Testar rotas"}
        </Button>

        {result?.ok === true && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            <div className="space-y-0.5">
              <p className="text-xs font-medium">Rota ativa confirmada</p>
              <code className="text-[11px] font-mono text-muted-foreground">
                POST {result.activeRoute}
              </code>
            </div>
          </div>
        )}

        {result?.ok === false && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-destructive">
                Nenhuma rota disponível
              </p>
              <p className="text-[11px] text-muted-foreground">{result.message}</p>
            </div>
          </div>
        )}

        {result && result.checked.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Resultado por rota
            </p>
            <div className="rounded-lg border border-border/50 bg-muted/30 divide-y divide-border/40">
              {result.checked.map((c) => (
                <div key={c.route} className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {c.exists ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    )}
                    <code className="text-[11px] font-mono truncate">{c.route}</code>
                  </div>
                  {statusBadge(c.status, c.exists)}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
