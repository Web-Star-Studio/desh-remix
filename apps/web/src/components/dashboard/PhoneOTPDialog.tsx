import { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Shield, Mail, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PhoneOTPDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phoneNumber: string;
  workspaceId: string | null;
  onVerified: (phoneNumber: string) => void;
}

const STORAGE_KEY = "wa_otp_verification";
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface PersistedState {
  workspaceId: string | null;
  phoneNumber: string;
  maskedEmail: string;
  sent: boolean;
  requestedAt: number;
}

function getStorageKey(workspaceId: string | null) {
  return `${STORAGE_KEY}:${workspaceId ?? "default"}`;
}

function clearLegacyPersistedState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
}

function loadPersistedState(phoneNumber: string, workspaceId: string | null): PersistedState | null {
  try {
    clearLegacyPersistedState();

    const raw = localStorage.getItem(getStorageKey(workspaceId));
    if (!raw) return null;

    const state: PersistedState = JSON.parse(raw);
    if (state.phoneNumber !== phoneNumber) return null;
    if ((state.workspaceId ?? workspaceId ?? null) !== (workspaceId ?? null)) return null;

    if (Date.now() - state.requestedAt > OTP_TTL_MS) {
      localStorage.removeItem(getStorageKey(workspaceId));
      return null;
    }

    return state;
  } catch {
    return null;
  }
}

function savePersistedState(state: PersistedState) {
  localStorage.setItem(getStorageKey(state.workspaceId), JSON.stringify(state));
}

function clearPersistedState(workspaceId: string | null) {
  localStorage.removeItem(getStorageKey(workspaceId));
}

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

function formatPhone(phone: string): string {
  const d = normalizePhone(phone);
  if (d.length === 13) {
    return `+${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  return `+${d}`;
}

export default function PhoneOTPDialog({ open, onOpenChange, phoneNumber, workspaceId, onVerified }: PhoneOTPDialogProps) {
  const [otpValue, setOtpValue] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [sent, setSent] = useState(false);

  // Track which workspace+phone we already auto-requested for in this component lifecycle
  const autoRequestedKey = useRef<string | null>(null);
  const requestKey = `${workspaceId ?? "default"}:${phoneNumber}`;

  // On open: hydrate from localStorage OR auto-request (once per phone)
  useEffect(() => {
    if (!open || !phoneNumber) return;

    // Check persisted state first
    const persisted = loadPersistedState(phoneNumber, workspaceId);
    if (persisted && persisted.sent) {
      setSent(true);
      setMaskedEmail(persisted.maskedEmail);
      setOtpValue("");
      const elapsed = Math.floor((Date.now() - persisted.requestedAt) / 1000);
      setResendCooldown(Math.max(0, 60 - elapsed));
      // Mark as already handled so we don't auto-request
      autoRequestedKey.current = requestKey;
      return;
    }

    // Only auto-request if we haven't already for this workspace+phone
    if (autoRequestedKey.current === requestKey) return;
    autoRequestedKey.current = requestKey;
    setOtpValue("");
    setSent(false);
    setMaskedEmail("");
    // Fire request
    doRequestOTP();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phoneNumber, workspaceId, requestKey]);

  const doRequestOTP = async () => {
    if (!workspaceId) {
      toast.error("Selecione um workspace antes de verificar o número");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("auth-phone-otp", {
        body: { action: "request", phone_number: phoneNumber, workspace_id: workspaceId },
      });
      if (error) throw error;
      const email = data?.masked_email || "";
      setMaskedEmail(email);
      setSent(true);
      setResendCooldown(60);
      savePersistedState({
        workspaceId,
        phoneNumber,
        maskedEmail: email,
        sent: true,
        requestedAt: Date.now(),
      });
    } catch (err: any) {
      if (err?.message?.includes("rate_limited") || err?.context?.status === 429) {
        toast.error("Muitas solicitações. Tente novamente em 1 hora.");
      } else {
        toast.error("Erro ao enviar código de verificação");
      }
    } finally {
      setLoading(false);
    }
  };

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleVerify = async () => {
    if (otpValue.length !== 6) return;
    if (!workspaceId) {
      toast.error("Selecione um workspace antes de verificar o número");
      return;
    }

    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("auth-phone-otp", {
        body: { action: "verify", phone_number: phoneNumber, otp_code: otpValue, workspace_id: workspaceId },
      });
      if (error) throw error;
      if (data?.verified) {
        toast.success("Número verificado com sucesso!");
        clearPersistedState(workspaceId);
        onVerified(phoneNumber);
        onOpenChange(false);
      } else {
        const remaining = data?.attempts_remaining;
        if (remaining !== undefined && remaining <= 0) {
          toast.error("Código expirado. Solicite um novo código.");
          setSent(false);
          clearPersistedState(workspaceId);
          autoRequestedKey.current = null; // Allow re-request
        } else {
          toast.error(`Código inválido. ${remaining !== undefined ? `${remaining} tentativa(s) restante(s).` : ""}`);
        }
        setOtpValue("");
      }
    } catch {
      toast.error("Erro ao verificar código");
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = () => {
    if (resendCooldown > 0) return;
    setOtpValue("");
    autoRequestedKey.current = requestKey; // prevent double-fire
    doRequestOTP();
  };

  const handleCancel = () => {
    clearPersistedState(workspaceId);
    autoRequestedKey.current = null;
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Verificação de Segurança
          </DialogTitle>
          <DialogDescription>
            Para autorizar o número <strong>{formatPhone(phoneNumber)}</strong> a interagir com a Pandora,
            enviamos um código de verificação para:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {maskedEmail && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
              <Mail className="w-4 h-4 shrink-0" />
              <span>{maskedEmail}</span>
            </div>
          )}

          {sent ? (
            <div className="flex flex-col items-center gap-4">
              <InputOTP maxLength={6} value={otpValue} onChange={setOtpValue}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>

              <p className="text-xs text-muted-foreground">Código válido por 10 minutos — você pode sair desta tela e voltar</p>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleResend}
                disabled={resendCooldown > 0 || loading}
                className="text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : "Reenviar código"}
              </Button>
            </div>
          ) : (
            <div className="flex justify-center">
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              ) : (
                <Button onClick={() => { autoRequestedKey.current = requestKey; doRequestOTP(); }}>Enviar código</Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleVerify} disabled={otpValue.length !== 6 || verifying || !sent}>
            {verifying && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Verificar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
