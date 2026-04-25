import { useState, useEffect } from "react";
import { Bot, Plus, X, Clock, Shield, MessageCircle, Brain, Zap, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useWhatsappAISettings } from "@/hooks/whatsapp/useWhatsappAISettings";
import { useWorkspaceSafe } from "@/contexts/WorkspaceContext";
import PhoneOTPDialog from "./PhoneOTPDialog";
import GlassCard from "./GlassCard";
import pandoraAvatar from "@/assets/pandora-avatar.png";
import { toast } from "sonner";

function normalizePhone(phone: string): string {
  let digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length <= 11 && digits.length >= 10) digits = "55" + digits;
  if (digits.length === 12 && digits.startsWith("55")) {
    const ddd = parseInt(digits.slice(2, 4), 10);
    if (ddd >= 11 && ddd <= 99) digits = digits.slice(0, 4) + "9" + digits.slice(4);
  }
  return digits;
}

const DEFAULT_MODEL = "google/gemini-2.5-pro";
const OTP_STORAGE_KEY = "wa_otp_verification";
const OTP_TTL_MS = 10 * 60 * 1000;

interface PersistedOtpSession {
  phoneNumber: string;
  requestedAt: number;
  workspaceId?: string | null;
}

function getOtpStorageKey(workspaceId: string | null) {
  return `${OTP_STORAGE_KEY}:${workspaceId ?? "default"}`;
}

function clearLegacyOtpSession() {
  try {
    localStorage.removeItem(OTP_STORAGE_KEY);
  } catch {
    // noop
  }
}

function loadPersistedOtpSession(workspaceId: string | null): PersistedOtpSession | null {
  try {
    clearLegacyOtpSession();

    const raw = localStorage.getItem(getOtpStorageKey(workspaceId));
    if (!raw) return null;

    const session = JSON.parse(raw) as PersistedOtpSession;
    if (!session?.phoneNumber || !session?.requestedAt) return null;
    if ((session.workspaceId ?? workspaceId ?? null) !== (workspaceId ?? null)) return null;

    if (Date.now() - session.requestedAt > OTP_TTL_MS) {
      localStorage.removeItem(getOtpStorageKey(workspaceId));
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export default function PandoraWhatsAppSettings() {
  const wsCtx = useWorkspaceSafe();
  const effectiveWorkspaceId = wsCtx?.activeWorkspaceId ?? wsCtx?.defaultWorkspace?.id ?? null;
  const { settings, loading, upsertSettings, refetch } = useWhatsappAISettings();

  const [enabled, setEnabled] = useState(false);
  const [allowedNumbers, setAllowedNumbers] = useState<string[]>([]);
  const [verifiedNumbers, setVerifiedNumbers] = useState<string[]>([]);
  const [newNumber, setNewNumber] = useState("");
  const [greeting, setGreeting] = useState("");
  const [hoursStart, setHoursStart] = useState(6);
  const [hoursEnd, setHoursEnd] = useState(23);
  const [preferredModel, setPreferredModel] = useState("google/gemini-2.5-pro");
  const [useMcp, setUseMcp] = useState(false);

  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpPhone, setOtpPhone] = useState("");
  const [pendingOtpPhone, setPendingOtpPhone] = useState("");

  // Remove confirmation
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState("");

  useEffect(() => {
    if (!settings) {
      setEnabled(false);
      setAllowedNumbers([]);
      setVerifiedNumbers([]);
      setGreeting("");
      setHoursStart(6);
      setHoursEnd(23);
      setPreferredModel(DEFAULT_MODEL);
      setUseMcp(false);
      return;
    }

    setEnabled(settings.enabled);
    setAllowedNumbers(settings.allowed_numbers ?? []);
    setVerifiedNumbers(settings.verified_numbers ?? []);
    setGreeting(settings.greeting_message ?? "");
    setHoursStart(settings.active_hours_start ?? 6);
    setHoursEnd(settings.active_hours_end ?? 23);
    setPreferredModel(settings.preferred_model ?? DEFAULT_MODEL);
    setUseMcp(settings.use_mcp ?? false);
  }, [settings]);

  useEffect(() => {
    const persistedPhone = loadPersistedOtpSession(effectiveWorkspaceId)?.phoneNumber || "";
    setPendingOtpPhone(persistedPhone);
    if (!otpDialogOpen) {
      setOtpPhone(persistedPhone);
    }
  }, [effectiveWorkspaceId, otpDialogOpen]);

  const handleToggle = (val: boolean) => {
    setEnabled(val);
    upsertSettings({ enabled: val });
  };

  const handleMcpToggle = (val: boolean) => {
    setUseMcp(val);
    upsertSettings({ use_mcp: val } as any);
  };

  const addNumber = () => {
    const clean = newNumber.replace(/\D/g, "");
    if (clean.length < 10) return;
    const normalized = normalizePhone(clean);
    if (allowedNumbers.includes(normalized)) {
      toast.error("Número já está na lista");
      return;
    }
    // Open OTP dialog instead of adding directly
    setOtpPhone(normalized);
    setPendingOtpPhone(normalized);
    setOtpDialogOpen(true);
    setNewNumber("");
  };

  const handleOTPVerified = (phone: string) => {
    // OTP verified — refetch settings to get updated allowed/verified lists
    setPendingOtpPhone("");
    setOtpPhone("");
    refetch();
  };

  const handleOtpDialogOpenChange = (open: boolean) => {
    setOtpDialogOpen(open);

    if (!open) {
      const session = loadPersistedOtpSession(effectiveWorkspaceId);
      const persistedPhone = session?.phoneNumber || "";
      setPendingOtpPhone(persistedPhone);
      setOtpPhone(persistedPhone);
    }
  };

  const continuePendingVerification = () => {
    if (!pendingOtpPhone) return;
    setOtpPhone(normalizePhone(pendingOtpPhone));
    setOtpDialogOpen(true);
  };

  const handleVerifyExisting = (num: string) => {
    const normalized = normalizePhone(num);
    setOtpPhone(normalized);
    setPendingOtpPhone(normalized);
    setOtpDialogOpen(true);
  };

  const confirmRemoveNumber = (num: string) => {
    setRemoveTarget(num);
    setRemoveDialogOpen(true);
  };

  const removeNumber = () => {
    const normalized = normalizePhone(removeTarget);
    const updatedAllowed = allowedNumbers.filter(n => normalizePhone(n) !== normalized);
    const updatedVerified = verifiedNumbers.filter(n => normalizePhone(n) !== normalized);
    setAllowedNumbers(updatedAllowed);
    setVerifiedNumbers(updatedVerified);
    upsertSettings({ allowed_numbers: updatedAllowed, verified_numbers: updatedVerified } as any);
    setRemoveDialogOpen(false);
    setRemoveTarget("");
  };

  const isVerified = (num: string) => {
    const normalized = normalizePhone(num);
    return verifiedNumbers.some(v => normalizePhone(v) === normalized);
  };

  const unverifiedCount = allowedNumbers.filter(n => !isVerified(n)).length;

  const saveHours = () => {
    upsertSettings({ active_hours_start: hoursStart, active_hours_end: hoursEnd });
  };

  const saveModel = () => {
    upsertSettings({ preferred_model: preferredModel } as any);
  };

  const saveGreeting = () => {
    upsertSettings({ greeting_message: greeting });
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);

  if (loading) return null;

  return (
    <>
      <GlassCard size="auto">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={pandoraAvatar} alt="Pandora" className="w-10 h-10 rounded-full" />
              <div>
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  Pandora no WhatsApp
                  <Badge variant={enabled ? "default" : "secondary"} className="text-xs">
                    {enabled ? "Ativo" : "Inativo"}
                  </Badge>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Interaja com a IA do DESH diretamente pelo WhatsApp
                </p>
              </div>
            </div>
            <Switch checked={enabled} onCheckedChange={handleToggle} />
          </div>

          {/* Revalidation Alert */}
          {unverifiedCount > 0 && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs space-y-1">
              <p className="font-medium text-destructive flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                {unverifiedCount} número(s) pendente(s) de verificação
              </p>
              <p className="text-muted-foreground">
                Números não verificados estão bloqueados. Clique em "Verificar" para ativar via OTP.
              </p>
            </div>
          )}

          {pendingOtpPhone && !otpDialogOpen && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-center justify-between gap-3">
              <div className="space-y-1 text-xs">
                <p className="font-medium text-foreground flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-primary" />
                  Verificação em andamento
                </p>
                <p className="text-muted-foreground">
                  O código do número +{pendingOtpPhone} continua válido por até 10 minutos.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={continuePendingVerification}>
                Continuar
              </Button>
            </div>
          )}

          {/* Allowed Numbers */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <Label className="font-medium">Números Autorizados</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Somente mensagens desses números serão processadas pela Pandora.
              Cada número requer verificação por OTP enviado ao seu email.
            </p>

            <div className="flex gap-2">
              <Input
                placeholder="5511999999999"
                value={newNumber}
                onChange={e => setNewNumber(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addNumber()}
                className="flex-1"
              />
              <Button size="sm" onClick={addNumber} disabled={newNumber.replace(/\D/g, "").length < 10}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {allowedNumbers.map(num => {
                const verified = isVerified(num);
                return (
                  <Badge
                    key={num}
                    variant="outline"
                    className={`gap-1 px-2 py-1 ${verified ? "" : "border-dashed opacity-70"}`}
                  >
                    {verified ? (
                      <ShieldCheck className="w-3 h-3 text-green-500" />
                    ) : (
                      <ShieldAlert className="w-3 h-3 text-amber-500" />
                    )}
                    <MessageCircle className="w-3 h-3" />
                    +{num}
                    {!verified && (
                      <button
                        onClick={() => handleVerifyExisting(num)}
                        className="ml-1 text-[10px] text-primary hover:underline"
                      >
                        Verificar
                      </button>
                    )}
                    <button onClick={() => confirmRemoveNumber(num)} className="ml-1 hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                );
              })}
              {allowedNumbers.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  Nenhum número autorizado. Adicione ao menos o seu número.
                </p>
              )}
            </div>
          </div>

          {/* Active Hours */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <Label className="font-medium">Horário Ativo</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              A Pandora só responderá dentro desse horário. Fora dele, as mensagens são ignoradas.
            </p>

            <div className="flex items-center gap-3">
              <Select value={String(hoursStart)} onValueChange={v => setHoursStart(Number(v))}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {hours.map(h => (
                    <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground">até</span>
              <Select value={String(hoursEnd)} onValueChange={v => setHoursEnd(Number(v))}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {hours.map(h => (
                    <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={saveHours}>Salvar</Button>
            </div>
          </div>

          {/* AI Model Selector */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              <Label className="font-medium">Modelo de IA</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Escolha qual modelo a Pandora usará para responder no chat e no WhatsApp.
            </p>

            <div className="flex items-center gap-3">
              <Select value={preferredModel} onValueChange={setPreferredModel}>
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="google/gemini-3-flash-preview">
                    <div className="flex flex-col">
                      <span>Gemini 3 Flash</span>
                      <span className="text-xs text-muted-foreground">Rápido e equilibrado (padrão)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="google/gemini-2.5-flash">
                    <div className="flex flex-col">
                      <span>Gemini 2.5 Flash</span>
                      <span className="text-xs text-muted-foreground">Bom custo-benefício</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="google/gemini-2.5-pro">
                    <div className="flex flex-col">
                      <span>Gemini 2.5 Pro</span>
                      <span className="text-xs text-muted-foreground">Máximo raciocínio</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="google/gemini-3-pro-preview">
                    <div className="flex flex-col">
                      <span>Gemini 3 Pro</span>
                      <span className="text-xs text-muted-foreground">Nova geração premium</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="openai/gpt-5-mini">
                    <div className="flex flex-col">
                      <span>GPT-5 Mini</span>
                      <span className="text-xs text-muted-foreground">Forte e versátil</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="openai/gpt-5">
                    <div className="flex flex-col">
                      <span>GPT-5</span>
                      <span className="text-xs text-muted-foreground">Máximo desempenho OpenAI</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={saveModel}>Salvar</Button>
            </div>

            {preferredModel === "google/gemini-2.5-pro" && (
              <Badge variant="secondary" className="text-xs">Modelo padrão</Badge>
            )}
          </div>

          {/* MCP Mode Toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <Label className="font-medium">Modo MCP (Google Services)</Label>
              </div>
              <Switch checked={useMcp} onCheckedChange={handleMcpToggle} />
            </div>
            <p className="text-xs text-muted-foreground">
              Quando ativado, a Pandora usa Claude + Composio para acessar Gmail, Google Calendar, 
              Tasks e Drive diretamente pelo WhatsApp. Requer conexões Google configuradas em Integrações.
            </p>
            {useMcp && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground space-y-1">
                <p>⚡ <strong>Modo MCP ativo:</strong> A Pandora usará Claude (Anthropic) com acesso direto ao Google Workspace.</p>
                <p>📧 Ler e enviar emails, gerenciar calendário, tarefas e Drive pelo WhatsApp.</p>
                <p>🔄 Se o MCP falhar, a Pandora volta automaticamente ao modo clássico.</p>
              </div>
            )}
          </div>

          {/* Greeting Message */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              <Label className="font-medium">Mensagem de Boas-vindas (opcional)</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Enviada na primeira mensagem de uma conversa. Deixe vazio para a Pandora responder normalmente.
            </p>
            <Textarea
              placeholder="Ex: Oi! Sou a Pandora, assistente do DESH. Como posso ajudar?"
              value={greeting}
              onChange={e => setGreeting(e.target.value)}
              rows={2}
            />
            <Button size="sm" variant="outline" onClick={saveGreeting}>Salvar mensagem</Button>
          </div>

          {/* Info */}
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
            <p>💡 <strong>Como funciona:</strong> Quando alguém de um número autorizado e verificado enviar uma mensagem para seu WhatsApp conectado, a Pandora processa e responde automaticamente.</p>
            <p>🔒 Números não autorizados ou não verificados são ignorados silenciosamente.</p>
            <p>🔐 Novos números exigem verificação por OTP enviado ao seu email.</p>
            <p>💳 Cada mensagem processada consome 5 créditos{useMcp ? " (modo MCP ou clássico)" : ""}.</p>
          </div>
        </div>
      </GlassCard>

      {/* OTP Dialog */}
      <PhoneOTPDialog
        open={otpDialogOpen}
        onOpenChange={handleOtpDialogOpenChange}
        phoneNumber={otpPhone}
        workspaceId={effectiveWorkspaceId}
        onVerified={handleOTPVerified}
      />

      {/* Remove Confirmation Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover número</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover o número +{removeTarget} da lista de autorizados?
              A Pandora deixará de responder mensagens desse número.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={removeNumber}>Remover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
