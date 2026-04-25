import { useState } from "react";
import { Check, Copy, FileJson } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export interface WhatsAppPayloadPreviewProps {
  /** Higher-level payload sent into the `useSendWhatsAppMessage` hook. */
  hookPayload: Record<string, unknown> | null;
  /** Effective body posted to Zernio's `/posts` endpoint. */
  wirePayload: Record<string, unknown> | null;
  /** Endpoint hit by the proxy (defaults to `/posts`). */
  endpoint?: string;
}

/**
 * Debug card that mirrors the exact payload being shipped to the WhatsApp
 * delivery pipeline so operators can copy it and reproduce calls manually.
 */
export default function WhatsAppPayloadPreview({
  hookPayload,
  wirePayload,
  endpoint = "POST /posts",
}: WhatsAppPayloadPreviewProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (label: string, value: unknown) => {
    const text = JSON.stringify(value ?? {}, null, 2);
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(label);
        toast.success("Payload copiado para a área de transferência");
        setTimeout(() => setCopied(null), 1800);
      },
      () => toast.error("Não foi possível copiar"),
    );
  };

  const renderBlock = (label: string, value: Record<string, unknown> | null) => {
    const json = value ? JSON.stringify(value, null, 2) : "// sem dados ainda — preencha os campos acima";
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Badge
            variant="outline"
            className="text-[10px] font-normal border-border/60 bg-muted/40"
          >
            {label}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => copy(label, value)}
            disabled={!value}
          >
            {copied === label ? (
              <>
                <Check className="h-3.5 w-3.5" /> Copiado
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Copiar
              </>
            )}
          </Button>
        </div>
        <pre className="rounded-md border border-border/60 bg-muted/30 p-3 text-[11px] leading-relaxed overflow-x-auto max-h-72 whitespace-pre-wrap break-words font-mono">
          {json}
        </pre>
      </div>
    );
  };

  return (
    <Card className="border-border/60 bg-card/40 backdrop-blur-sm shadow-sm">
      <CardHeader className="pb-3 border-b border-border/40">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60">
            <FileJson className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          Payload de envio
          <Badge variant="secondary" className="ml-auto text-[10px] font-mono">
            {endpoint}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <Tabs defaultValue="wire">
          <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 h-9">
            <TabsTrigger value="wire" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Wire (Zernio)
            </TabsTrigger>
            <TabsTrigger value="hook" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Hook (interno)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wire" className="pt-4">
            {renderBlock("body /posts", wirePayload)}
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
              Corpo exato enviado pelo proxy para o endpoint <code>/posts</code> da Zernio.
              Inclui <code>platforms[].whatsappOptions</code> com <code>to</code>, <code>type</code> e conteúdo.
            </p>
          </TabsContent>

          <TabsContent value="hook" className="pt-4">
            {renderBlock("useSendWhatsAppMessage", hookPayload)}
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
              Argumento passado ao hook <code>useSendWhatsAppMessage.mutate(...)</code> antes da
              tradução para o formato Zernio.
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
