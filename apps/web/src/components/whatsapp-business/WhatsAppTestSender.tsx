/**
 * WhatsAppTestSender — dashboard panel to assemble + dispatch a real WhatsApp
 * message for testing. Lets the operator pick:
 *   • WABA account
 *   • Destino: contato salvo OU número manual (E.164)
 *   • Modo: texto livre OU template aprovado (com variáveis dinâmicas)
 * Then shows a live preview, dispatches via `useSendWhatsAppMessage`, and
 * renders the resulting `DeliverySummary` (per-attempt log + outcome).
 */
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Loader2,
  Search,
  Send,
  TestTube2,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  useZernioWhatsApp,
  type WABAAccount,
  type WABATemplate,
} from "@/hooks/whatsapp/useZernioWhatsApp";
import { useSendWhatsAppMessage } from "@/hooks/whatsapp/useSendWhatsAppMessage";
import { useDbContacts } from "@/hooks/contacts/useDbContacts";
import WhatsAppPayloadPreview from "./WhatsAppPayloadPreview";

interface Props {
  accountId?: string | null;
}

type SendMode = "text" | "template";
type DestMode = "contact" | "manual";

/** Extract `{{1}} … {{N}}` placeholders from template components. */
function extractVariableCount(tpl: WABATemplate | null): number {
  if (!tpl) return 0;
  const all = JSON.stringify(tpl.components ?? []);
  const matches = all.match(/{{\s*\d+\s*}}/g) ?? [];
  return new Set(matches).size;
}

/** Build a human preview by replacing `{{i}}` with the supplied variable. */
function renderTemplatePreview(tpl: WABATemplate | null, vars: string[]): string {
  if (!tpl) return "";
  const body = (tpl.components ?? []).find(
    (c: any) => String(c?.type ?? "").toLowerCase() === "body",
  );
  let text: string = body?.text ?? "";
  vars.forEach((v, i) => {
    text = text.split(`{{${i + 1}}}`).join(v || `{{${i + 1}}}`);
  });
  return text;
}

function isValidE164(phone: string): boolean {
  return /^\+?\d{10,15}$/.test(phone.replace(/\s|-/g, ""));
}

export default function WhatsAppTestSender({ accountId: defaultAccountId }: Props) {
  const { getAccounts, getTemplates } = useZernioWhatsApp();
  const send = useSendWhatsAppMessage();
  const { contacts } = useDbContacts();

  // Accounts
  const [accounts, setAccounts] = useState<WABAAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accountId, setAccountId] = useState<string>(defaultAccountId ?? "");

  // Destino
  const [destMode, setDestMode] = useState<DestMode>("contact");
  const [contactId, setContactId] = useState<string>("");
  const [manualPhone, setManualPhone] = useState("");
  const [contactPickerOpen, setContactPickerOpen] = useState(false);

  // Modo
  const [mode, setMode] = useState<SendMode>("text");
  const [text, setText] = useState("Olá! Esta é uma mensagem de teste do DESH.");

  // Templates
  const [templates, setTemplates] = useState<WABATemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("");
  const [templateVars, setTemplateVars] = useState<string[]>([]);

  // Result
  // Per-attempt summary lived in `whatsappMessenger` (now removed) — the new
  // server-side route handles retries opaquely. We surface message id only.
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);
  const [lastOutcome, setLastOutcome] = useState<"delivered" | "failed" | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [logsOpen, setLogsOpen] = useState(true);

  // ── Load accounts ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingAccounts(true);
      try {
        const res = await getAccounts();
        if (cancelled) return;
        const data = res as {
          data?: { accounts?: WABAAccount[] };
          accounts?: WABAAccount[];
        };
        const list = (data.data?.accounts ?? data.accounts ?? []).filter(
          (a) => a.platform === "whatsapp",
        );
        setAccounts(list);
        if (!accountId && list.length > 0) {
          setAccountId(defaultAccountId ?? list[0].accountId);
        }
      } finally {
        if (!cancelled) setLoadingAccounts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load templates when account changes ───────────────────
  useEffect(() => {
    if (!accountId) {
      setTemplates([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingTemplates(true);
      try {
        const res = await getTemplates(accountId);
        if (cancelled) return;
        const data = res as {
          data?: { templates?: WABATemplate[] };
          templates?: WABATemplate[];
        };
        const list = data.data?.templates ?? data.templates ?? [];
        setTemplates(
          list.filter((t) => String(t.status).toLowerCase() === "approved"),
        );
      } finally {
        if (!cancelled) setLoadingTemplates(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, getTemplates]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.name === templateName) ?? null,
    [templates, templateName],
  );
  const variableCount = useMemo(
    () => extractVariableCount(selectedTemplate),
    [selectedTemplate],
  );

  useEffect(() => {
    setTemplateVars(Array.from({ length: variableCount }, () => ""));
  }, [variableCount]);

  useEffect(() => {
    if (selectedTemplate) setTemplateLanguage(selectedTemplate.language);
  }, [selectedTemplate]);

  // ── Resolved destino ──────────────────────────────────────
  const contactsWithPhone = useMemo(
    () => contacts.filter((c) => Boolean(c.phone)),
    [contacts],
  );
  const selectedContact = useMemo(
    () => contactsWithPhone.find((c) => c.id === contactId) ?? null,
    [contactsWithPhone, contactId],
  );
  const resolvedTo =
    destMode === "contact" ? selectedContact?.phone ?? "" : manualPhone.trim();
  const phoneValid = resolvedTo.length > 0 && isValidE164(resolvedTo);

  // ── Preview ───────────────────────────────────────────────
  const preview =
    mode === "text"
      ? text
      : selectedTemplate
        ? renderTemplatePreview(selectedTemplate, templateVars)
        : "";

  const canSend =
    !!accountId &&
    phoneValid &&
    (mode === "text"
      ? text.trim().length > 0
      : !!templateName && !!templateLanguage);

  // ── Payloads (memoized for live preview + dispatch) ───────
  const hookPayload = useMemo(() => {
    if (!accountId || !resolvedTo) return null;
    if (mode === "text") {
      if (!text.trim()) return null;
      return {
        kind: "text" as const,
        accountId,
        to: resolvedTo,
        text: text.trim(),
        contactId: destMode === "contact" ? contactId || null : null,
      };
    }
    if (!templateName || !templateLanguage) return null;
    return {
      kind: "template" as const,
      accountId,
      to: resolvedTo,
      templateName,
      language: templateLanguage,
      variables: templateVars,
      contactId: destMode === "contact" ? contactId || null : null,
    };
  }, [
    accountId,
    resolvedTo,
    mode,
    text,
    templateName,
    templateLanguage,
    templateVars,
    destMode,
    contactId,
  ]);

  const wirePayload = useMemo(() => {
    if (!hookPayload) return null;
    const base = {
      content: hookPayload.kind === "text" ? hookPayload.text : "",
      publishNow: true,
      platforms: [
        {
          platform: "whatsapp",
          accountId: hookPayload.accountId,
          whatsappOptions:
            hookPayload.kind === "text"
              ? {
                  to: hookPayload.to,
                  type: "text",
                  text: hookPayload.text,
                }
              : {
                  to: hookPayload.to,
                  type: "template",
                  template: {
                    name: hookPayload.templateName,
                    language: { code: hookPayload.language },
                    components:
                      hookPayload.variables.length > 0
                        ? [
                            {
                              type: "body",
                              parameters: hookPayload.variables.map((v) => ({
                                type: "text",
                                text: v,
                              })),
                            },
                          ]
                        : [],
                  },
                },
        },
      ],
    };
    return base;
  }, [hookPayload]);

  // ── Dispatch ──────────────────────────────────────────────
  const handleSend = () => {
    if (!canSend || !hookPayload) return;
    setLastMessageId(null);
    setLastOutcome(null);
    setLastError(null);

    send.mutate(hookPayload, {
      onSuccess: (res) => {
        setLastMessageId(res.messageId ?? null);
        setLastOutcome("delivered");
      },
      onError: (err) => {
        setLastOutcome("failed");
        setLastError(err.message ?? "Erro desconhecido");
      },
    });
  };

  const wa = "hsl(142,70%,45%)";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── Configuração ───────────────────────────────────── */}
      <Card className="border-border/60 bg-card/40 backdrop-blur-sm shadow-sm">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ backgroundColor: "hsl(142 70% 45% / 0.15)" }}
            >
              <TestTube2 className="h-3.5 w-3.5" style={{ color: wa }} />
            </span>
            Configurar envio de teste
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          {/* Account */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Conta WABA
            </Label>
            <Select
              value={accountId}
              onValueChange={setAccountId}
              disabled={loadingAccounts || accounts.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loadingAccounts ? "Carregando..." : "Selecione uma conta"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.accountId} value={a.accountId}>
                    {a.name ?? a.phoneNumber ?? a.accountId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Destino */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Destinatário
            </Label>
            <Tabs value={destMode} onValueChange={(v) => setDestMode(v as DestMode)}>
              <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 h-9">
                <TabsTrigger value="contact" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Contato salvo
                </TabsTrigger>
                <TabsTrigger value="manual" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Número manual
                </TabsTrigger>
              </TabsList>

              <TabsContent value="contact" className="pt-3">
                <Popover open={contactPickerOpen} onOpenChange={setContactPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal h-10 bg-background/60"
                    >
                      {selectedContact ? (
                        <span className="truncate">
                          {selectedContact.name}{" "}
                          <span className="text-muted-foreground">
                            · {selectedContact.phone}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          Buscar contato...
                        </span>
                      )}
                      <Search className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                    <Command>
                      <CommandInput placeholder="Nome, telefone ou empresa..." />
                      <CommandList>
                        <CommandEmpty>Nenhum contato com telefone.</CommandEmpty>
                        <CommandGroup>
                          {contactsWithPhone.slice(0, 50).map((c) => (
                            <CommandItem
                              key={c.id}
                              value={`${c.name} ${c.phone} ${c.company ?? ""}`}
                              onSelect={() => {
                                setContactId(c.id);
                                setContactPickerOpen(false);
                              }}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{c.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {c.phone}
                                  {c.company ? ` · ${c.company}` : ""}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </TabsContent>

              <TabsContent value="manual" className="pt-3">
                <Input
                  placeholder="+5511999999999"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  className="h-10 bg-background/60"
                />
                {manualPhone && !isValidE164(manualPhone) && (
                  <p className="text-xs text-destructive mt-1.5">
                    Formato inválido. Use E.164 (ex.: +5511999999999).
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Modo */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Conteúdo
            </Label>
            <Tabs value={mode} onValueChange={(v) => setMode(v as SendMode)}>
              <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 h-9">
                <TabsTrigger value="text" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Texto livre
                </TabsTrigger>
                <TabsTrigger value="template" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Template aprovado
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="pt-3 space-y-1.5">
                <Textarea
                  rows={4}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Digite a mensagem..."
                  className="bg-background/60 resize-none"
                />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Texto livre só funciona dentro da janela de 24h após a última
                  resposta do contato.
                </p>
              </TabsContent>

              <TabsContent value="template" className="pt-3 space-y-3">
                <Select
                  value={templateName}
                  onValueChange={setTemplateName}
                  disabled={!accountId || loadingTemplates}
                >
                  <SelectTrigger className="h-10 bg-background/60">
                    <SelectValue
                      placeholder={
                        loadingTemplates
                          ? "Carregando templates..."
                          : "Selecione um template aprovado"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.name}>
                        {t.name} · {t.language}
                      </SelectItem>
                    ))}
                    {!loadingTemplates && templates.length === 0 && accountId && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        Nenhum template aprovado nesta conta.
                      </div>
                    )}
                  </SelectContent>
                </Select>

                {variableCount > 0 && (
                  <div className="space-y-2 rounded-lg border border-border/50 bg-muted/30 p-3">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Variáveis ({variableCount})
                    </Label>
                    {templateVars.map((v, i) => (
                      <Input
                        key={i}
                        placeholder={`Valor para {{${i + 1}}}`}
                        value={v}
                        onChange={(e) => {
                          const next = [...templateVars];
                          next[i] = e.target.value;
                          setTemplateVars(next);
                        }}
                        className="h-9 bg-background/80"
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <Button
            className="w-full gap-2 h-11 font-medium text-white shadow-md transition-all hover:shadow-lg hover:brightness-110 disabled:opacity-50"
            style={{ backgroundColor: wa }}
            onClick={handleSend}
            disabled={!canSend || send.isPending}
          >
            {send.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar mensagem de teste
          </Button>
        </CardContent>
      </Card>

      {/* ── Preview + Resultado ────────────────────────────── */}
      <div className="space-y-6">
        <Card className="border-border/60 bg-card/40 backdrop-blur-sm shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full animate-pulse"
                style={{ backgroundColor: wa }}
              />
              Pré-visualização
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <div
              className="rounded-xl p-4 min-h-[140px] relative overflow-hidden"
              style={{
                backgroundColor: "hsl(220 15% 8%)",
                backgroundImage:
                  "radial-gradient(circle at 20% 30%, hsl(142 70% 45% / 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 70%, hsl(142 70% 45% / 0.04) 0%, transparent 50%)",
              }}
            >
              <div className="flex justify-end">
                <div
                  className="relative max-w-[85%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 shadow-md"
                  style={{
                    backgroundColor: "hsl(142 60% 28%)",
                    color: "hsl(0 0% 98%)",
                  }}
                >
                  {preview ? (
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {preview}
                    </p>
                  ) : (
                    <p className="text-sm italic opacity-70">
                      {mode === "template"
                        ? "Selecione um template para visualizar."
                        : "Digite uma mensagem para visualizar."}
                    </p>
                  )}
                  <div className="flex items-center justify-end gap-1 mt-1 text-[10px] opacity-70">
                    <span>agora</span>
                    <CheckCircle2 className="h-3 w-3" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              <Badge
                variant="outline"
                className="text-[10px] font-normal border-border/60 bg-muted/40"
              >
                Para: <span className="ml-1 font-medium">{resolvedTo || "—"}</span>
              </Badge>
              {mode === "template" && templateName && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-normal border-border/60 bg-muted/40"
                >
                  {templateName} · {templateLanguage}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <WhatsAppPayloadPreview
          hookPayload={hookPayload}
          wirePayload={wirePayload}
        />

        {(lastOutcome || send.isPending) && (
          <Card className="border-border/60 bg-card/40 backdrop-blur-sm shadow-sm">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                {send.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : lastOutcome === "delivered" ? (
                  <CheckCircle2 className="h-4 w-4" style={{ color: wa }} />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                Resultado da entrega
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {send.isPending && (
                <p className="text-sm text-muted-foreground">
                  Enviando mensagem...
                </p>
              )}

              {!send.isPending && lastOutcome && (
                <>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <Stat
                      label="Status"
                      value={lastOutcome === "delivered" ? "OK" : "FALHA"}
                      tone={lastOutcome === "delivered" ? "success" : "error"}
                    />
                    <Stat
                      label="Mensagem"
                      value={lastMessageId ? "Aceita" : "—"}
                      tone={lastMessageId ? "success" : "error"}
                    />
                  </div>

                  {lastMessageId && (
                    <p className="text-xs text-muted-foreground break-all">
                      <span className="font-medium">Message ID:</span> {lastMessageId}
                    </p>
                  )}

                  {lastError && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                      {lastError}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "error";
}) {
  const color =
    tone === "success"
      ? "text-[hsl(142,70%,45%)]"
      : tone === "error"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div className="rounded-md border bg-card p-2">
      <div className={`text-base font-semibold ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
