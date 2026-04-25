import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useZernioWhatsApp, type WABAAccount, type WABATemplate } from "@/hooks/whatsapp/useZernioWhatsApp";
import { useSendWhatsAppMessage } from "@/hooks/whatsapp/useSendWhatsAppMessage";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill recipient phone (E.164 or local digits) */
  defaultTo?: string;
  /** Optional contact id, used for log linkage */
  contactId?: string | null;
  /** Optional friendly recipient label shown in the header */
  recipientLabel?: string;
}

/**
 * Reusable dialog to send a WhatsApp message via Zernio (text or approved template).
 * Loads available WABA accounts and templates on demand.
 */
export default function SendWhatsAppDialog({
  open,
  onOpenChange,
  defaultTo = "",
  contactId,
  recipientLabel,
}: Props) {
  const { getAccounts, getTemplates } = useZernioWhatsApp();
  const send = useSendWhatsAppMessage();

  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accounts, setAccounts] = useState<WABAAccount[]>([]);
  const [accountId, setAccountId] = useState<string>("");

  const [to, setTo] = useState(defaultTo);
  const [text, setText] = useState("");

  const [templates, setTemplates] = useState<WABATemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("");
  const [templateVars, setTemplateVars] = useState<string[]>([]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.name === templateName) ?? null,
    [templates, templateName],
  );

  // Detect template variable placeholders ({{1}}, {{2}}, …)
  const templateVarCount = useMemo(() => {
    if (!selectedTemplate) return 0;
    const all = JSON.stringify(selectedTemplate.components ?? []);
    const matches = all.match(/{{\s*\d+\s*}}/g) ?? [];
    return new Set(matches).size;
  }, [selectedTemplate]);

  useEffect(() => {
    setTemplateVars(Array.from({ length: templateVarCount }, () => ""));
  }, [templateVarCount]);

  useEffect(() => {
    if (selectedTemplate) setTemplateLanguage(selectedTemplate.language);
  }, [selectedTemplate]);

  useEffect(() => {
    if (!open) return;
    setTo(defaultTo);
    let cancelled = false;
    (async () => {
      setLoadingAccounts(true);
      try {
        const res = await getAccounts();
        if (cancelled) return;
        const data = res as { accounts?: WABAAccount[]; data?: { accounts?: WABAAccount[] } };
        const list = (data.accounts ?? data.data?.accounts ?? []).filter(
          (a) => a.platform === "whatsapp",
        );
        setAccounts(list);
        if (list.length === 1) setAccountId(list[0].accountId);
      } finally {
        if (!cancelled) setLoadingAccounts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, defaultTo, getAccounts]);

  // Load templates when an account is chosen
  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    (async () => {
      setLoadingTemplates(true);
      try {
        const res = await getTemplates(accountId);
        if (cancelled) return;
        const data = res as {
          templates?: WABATemplate[];
          data?: { templates?: WABATemplate[] };
        };
        const list = data.templates ?? data.data?.templates ?? [];
        setTemplates(list.filter((t) => t.status === "APPROVED" || t.status === "approved"));
      } finally {
        if (!cancelled) setLoadingTemplates(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, getTemplates]);

  const handleSendText = () => {
    if (!accountId || !to || !text.trim()) return;
    send.mutate(
      { kind: "text", accountId, to, text: text.trim(), contactId },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const handleSendTemplate = () => {
    if (!accountId || !to || !templateName || !templateLanguage) return;
    send.mutate(
      {
        kind: "template",
        accountId,
        to,
        templateName,
        language: templateLanguage,
        variables: templateVars,
        contactId,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Enviar WhatsApp
          </DialogTitle>
          <DialogDescription>
            {recipientLabel ? `Para ${recipientLabel}` : "Mensagem via Zernio (WhatsApp Business)"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Conta WhatsApp Business</Label>
            <Select value={accountId} onValueChange={setAccountId} disabled={loadingAccounts}>
              <SelectTrigger>
                <SelectValue
                  placeholder={loadingAccounts ? "Carregando contas..." : "Selecione uma conta"}
                />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.accountId} value={a.accountId}>
                    {a.name ?? a.phoneNumber ?? a.accountId}
                  </SelectItem>
                ))}
                {!loadingAccounts && accounts.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Nenhuma conta conectada
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Para (telefone)</Label>
            <Input
              placeholder="+5511999999999"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          <Tabs defaultValue="text">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="text">Texto livre</TabsTrigger>
              <TabsTrigger value="template">Template aprovado</TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-3 pt-3">
              <Textarea
                rows={5}
                placeholder="Digite a mensagem..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Texto livre só funciona dentro da janela de 24h após a última mensagem do contato.
              </p>
            </TabsContent>

            <TabsContent value="template" className="space-y-3 pt-3">
              <div className="space-y-2">
                <Label>Template</Label>
                <Select
                  value={templateName}
                  onValueChange={setTemplateName}
                  disabled={!accountId || loadingTemplates}
                >
                  <SelectTrigger>
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
                        Nenhum template aprovado
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {templateVarCount > 0 && (
                <div className="space-y-2">
                  <Label>Variáveis</Label>
                  {templateVars.map((v, i) => (
                    <Input
                      key={i}
                      placeholder={`{{${i + 1}}}`}
                      value={v}
                      onChange={(e) => {
                        const next = [...templateVars];
                        next[i] = e.target.value;
                        setTemplateVars(next);
                      }}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={send.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (templateName) handleSendTemplate();
              else handleSendText();
            }}
            disabled={
              send.isPending ||
              !accountId ||
              !to ||
              (!templateName && !text.trim())
            }
          >
            {send.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
