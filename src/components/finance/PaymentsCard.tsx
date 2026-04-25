import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "@/components/dashboard/GlassCard";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import { Button } from "@/components/ui/button";
import {
  CreditCard, Plus, X, Loader2, ExternalLink, Copy, Trash2, Clock,
  CalendarClock, RefreshCw, QrCode, ChevronDown, ChevronUp, CheckCircle2,
  AlertCircle, Ban, Send, Zap,
} from "lucide-react";
import type { PaymentRecipient, PaymentRequest } from "@/hooks/finance/usePluggyPayments";
import { formatCurrency } from "@/components/finance/financeConstants";

const STATUS_META: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  CREATED: { icon: Clock, color: "text-amber-400", label: "Aguardando" },
  WAITING_PAYER_AUTHORIZATION: { icon: Clock, color: "text-amber-400", label: "Aguardando autorização" },
  AUTHORIZED: { icon: CheckCircle2, color: "text-blue-400", label: "Autorizado" },
  SCHEDULED: { icon: CalendarClock, color: "text-blue-400", label: "Agendado" },
  PAYMENT_COMPLETED: { icon: CheckCircle2, color: "text-green-400", label: "Pago" },
  COMPLETED: { icon: CheckCircle2, color: "text-green-400", label: "Concluído" },
  CONSENT_REJECTED: { icon: Ban, color: "text-destructive", label: "Rejeitado" },
  PAYMENT_REJECTED: { icon: Ban, color: "text-destructive", label: "Rejeitado" },
  ERROR: { icon: AlertCircle, color: "text-destructive", label: "Erro" },
  CANCELED: { icon: Ban, color: "text-muted-foreground", label: "Cancelado" },
  EXPIRED: { icon: Clock, color: "text-muted-foreground", label: "Expirado" },
  IN_PROGRESS: { icon: Loader2, color: "text-primary", label: "Em progresso" },
  PAYMENT_PARTIALLY_ACCEPTED: { icon: Clock, color: "text-amber-400", label: "Autorização pendente" },
};

const TYPE_LABELS: Record<string, string> = {
  instant: "PIX Instantâneo",
  scheduled: "PIX Agendado",
  pix_automatico: "Pix Automático",
};

const SCHEDULE_LABELS: Record<string, string> = {
  SINGLE: "Único",
  DAILY: "Diário",
  WEEKLY: "Semanal",
  MONTHLY: "Mensal",
  CUSTOM: "Personalizado",
};

const INTERVAL_LABELS: Record<string, string> = {
  WEEKLY: "Semanal",
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
};

interface Props {
  recipients: PaymentRecipient[];
  requests: PaymentRequest[];
  acting: boolean;
  hasConnections: boolean;
  onCreatePayment: (recipientId: string, amount: number, description: string) => Promise<any>;
  onCreateScheduled: (recipientId: string, amount: number, description: string, schedule: any) => Promise<any>;
  onCreatePixAuto: (params: any) => Promise<any>;
  onCancel: (providerRequestId: string) => void;
  onRefreshStatus: (providerRequestId: string) => void;
  onCreateRecipientQR: (qr: string) => Promise<any>;
  onCreateRecipient: (params: { name: string; tax_number?: string; pix_key?: string; institution_id?: string; account?: { branch: string; number: string; type: string } }) => Promise<any>;
}



export default function PaymentsCard({
  recipients, requests, acting, hasConnections,
  onCreatePayment, onCreateScheduled, onCreatePixAuto,
  onCancel, onRefreshStatus, onCreateRecipientQR, onCreateRecipient,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showNewPayment, setShowNewPayment] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [showNewRecipient, setShowNewRecipient] = useState(false);

  // New payment form
  const [payType, setPayType] = useState<"instant" | "scheduled" | "pix_automatico">("instant");
  const [selectedRecipient, setSelectedRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  // Schedule fields
  const [scheduleType, setScheduleType] = useState<"SINGLE" | "DAILY" | "WEEKLY" | "MONTHLY">("MONTHLY");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [occurrences, setOccurrences] = useState("3");
  // Pix Auto fields
  const [pixInterval, setPixInterval] = useState<"MONTHLY">("MONTHLY");
  const [fixedAmount, setFixedAmount] = useState("");
  const [minVariable, setMinVariable] = useState("");
  const [maxVariable, setMaxVariable] = useState("");
  const [amountMode, setAmountMode] = useState<"fixed" | "variable">("fixed");
  const [schedulerEnabled, setSchedulerEnabled] = useState(true);
  // First payment fields
  const [firstPaymentEnabled, setFirstPaymentEnabled] = useState(false);
  const [firstPaymentDate, setFirstPaymentDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [firstPaymentAmount, setFirstPaymentAmount] = useState("");
  const [firstPaymentDescription, setFirstPaymentDescription] = useState("");
  // Recipient form fields
  const [recipientName, setRecipientName] = useState("");
  const [recipientTaxNumber, setRecipientTaxNumber] = useState("");
  const [recipientBranch, setRecipientBranch] = useState("");
  const [recipientAccountNumber, setRecipientAccountNumber] = useState("");
  const [recipientAccountType, setRecipientAccountType] = useState<"CHECKING_ACCOUNT" | "SAVINGS_ACCOUNT">("CHECKING_ACCOUNT");
  const [recipientInstitutionId, setRecipientInstitutionId] = useState("");
  const [institutions, setInstitutions] = useState<{ id: string; name: string }[]>([]);
  const [loadingInstitutions, setLoadingInstitutions] = useState(false);

  if (!hasConnections) return null;

  const activeRequests = requests.filter(r => !["CANCELED", "EXPIRED"].includes(r.status));
  const completedCount = requests.filter(r => ["PAYMENT_COMPLETED", "COMPLETED"].includes(r.status)).length;
  const pendingCount = requests.filter(r => r.status === "CREATED").length;

  const handleSubmit = async () => {
    if (!selectedRecipient) return;

    if (payType === "instant") {
      if (!amount) return;
      const amt = parseFloat(amount);
      if (isNaN(amt) || amt <= 0) return;
      await onCreatePayment(selectedRecipient, amt, description);
    } else if (payType === "scheduled") {
      if (!amount) return;
      const amt = parseFloat(amount);
      if (isNaN(amt) || amt <= 0) return;
      await onCreateScheduled(selectedRecipient, amt, description, {
        type: scheduleType,
        start_date: startDate,
        occurrences: parseInt(occurrences) || 1,
      });
    } else if (payType === "pix_automatico") {
      const params: any = {
        recipient_id: selectedRecipient,
        description,
        interval: pixInterval,
        start_date: startDate,
        scheduler_enabled: schedulerEnabled,
      };
      if (amountMode === "fixed") {
        params.fixed_amount = fixedAmount ? parseFloat(fixedAmount) : undefined;
      } else {
        params.min_variable = minVariable ? parseFloat(minVariable) : undefined;
        params.max_variable = maxVariable ? parseFloat(maxVariable) : undefined;
      }
      if (firstPaymentEnabled && firstPaymentDate && firstPaymentAmount) {
        params.first_payment = {
          date: firstPaymentDate,
          amount: parseFloat(firstPaymentAmount),
          description: firstPaymentDescription || undefined,
        };
      }
      await onCreatePixAuto(params);
    }

    setShowNewPayment(false);
    setAmount("");
    setDescription("");
    setFirstPaymentEnabled(false);
    setFirstPaymentAmount("");
    setFirstPaymentDescription("");
  };

  const handleQRSubmit = async () => {
    if (!qrCode.trim()) return;
    await onCreateRecipientQR(qrCode.trim());
    setQrCode("");
    setShowQR(false);
  };

  const loadInstitutions = async () => {
    if (institutions.length > 0) return;
    setLoadingInstitutions(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.functions.invoke("pluggy-proxy", {
        body: { action: "list_institutions" },
      });
      if (!error && data?.institutions) {
        setInstitutions(data.institutions.map((i: any) => ({ id: i.id, name: i.name })));
      }
    } catch {} finally { setLoadingInstitutions(false); }
  };

  const handleRecipientSubmit = async () => {
    if (!recipientName.trim() || !recipientTaxNumber.trim() || !recipientBranch.trim() || !recipientAccountNumber.trim() || !recipientInstitutionId) return;
    const cleanNumber = recipientAccountNumber.trim().replace(/\D/g, "");
    await onCreateRecipient({
      name: recipientName.trim(),
      tax_number: recipientTaxNumber.trim().replace(/\D/g, ""),
      institution_id: recipientInstitutionId,
      account: {
        branch: recipientBranch.trim().replace(/\D/g, ""),
        number: cleanNumber,
        type: recipientAccountType,
      },
    });
    setRecipientName("");
    setRecipientTaxNumber("");
    setRecipientBranch("");
    setRecipientAccountNumber("");
    setRecipientAccountType("CHECKING_ACCOUNT");
    setRecipientInstitutionId("");
    setShowNewRecipient(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <AnimatedItem index={12}>
      <GlassCard size="auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
              <Send className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="widget-title">Pagamentos PIX</p>
              <p className="text-[9px] text-muted-foreground">
                {completedCount} pagos · {pendingCount} pendentes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowQR(!showQR)}
              className="p-1.5 rounded-lg hover:bg-foreground/5 transition-colors text-muted-foreground hover:text-foreground"
              title="Pagar QR Code"
            >
              <QrCode className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setShowNewRecipient(!showNewRecipient); if (showNewPayment) setShowNewPayment(false); }}
              className="p-1.5 rounded-lg hover:bg-foreground/5 transition-colors text-muted-foreground hover:text-foreground"
              title="Novo destinatário"
            >
              <CreditCard className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setShowNewPayment(!showNewPayment); if (showNewRecipient) setShowNewRecipient(false); }}
              className="p-1.5 rounded-lg hover:bg-foreground/5 transition-colors text-primary"
            >
              {showNewPayment ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </button>
            {requests.length > 3 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 rounded-lg hover:bg-foreground/5 transition-colors text-muted-foreground"
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* QR Code Import */}
        <AnimatePresence>
          {showQR && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mb-3 p-3 rounded-xl bg-foreground/5 border border-foreground/10 space-y-2">
                <p className="text-[10px] text-muted-foreground font-medium">Cole o código PIX QR (copia-e-cola)</p>
                <textarea
                  value={qrCode}
                  onChange={e => setQrCode(e.target.value)}
                  placeholder="00020126490014br.gov.bcb.pix..."
                  rows={3}
                  className="w-full bg-foreground/5 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/20 resize-none font-mono"
                />
                <Button size="sm" onClick={handleQRSubmit} disabled={acting || !qrCode.trim()} className="text-xs">
                  {acting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <QrCode className="w-3 h-3 mr-1" />}
                  Processar QR
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* New Recipient Form */}
        <AnimatePresence>
          {showNewRecipient && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mb-3 p-3 rounded-xl bg-foreground/5 border border-foreground/10 space-y-2">
                <p className="text-[10px] text-muted-foreground font-medium">Cadastrar novo destinatário (agência e conta)</p>
                <input
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  placeholder="Nome do destinatário *"
                  className="w-full bg-foreground/5 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/20"
                />
                <input
                  value={recipientTaxNumber}
                  onChange={e => setRecipientTaxNumber(e.target.value)}
                  placeholder="CPF ou CNPJ (somente números) *"
                  className="w-full bg-foreground/5 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/20"
                />
                <select
                  value={recipientInstitutionId}
                  onChange={e => setRecipientInstitutionId(e.target.value)}
                  onFocus={loadInstitutions}
                  className="w-full bg-foreground/5 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/20"
                >
                  <option value="">{loadingInstitutions ? "Carregando instituições..." : "Selecione a instituição *"}</option>
                  {institutions.map(i => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    value={recipientBranch}
                    onChange={e => setRecipientBranch(e.target.value)}
                    placeholder="Agência *"
                    className="flex-1 bg-foreground/5 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/20"
                  />
                  <input
                    value={recipientAccountNumber}
                    onChange={e => setRecipientAccountNumber(e.target.value)}
                    placeholder="Nº da Conta (somente números) *"
                    className="flex-1 bg-foreground/5 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/20"
                  />
                </div>
                <select
                  value={recipientAccountType}
                  onChange={e => setRecipientAccountType(e.target.value as "CHECKING_ACCOUNT" | "SAVINGS_ACCOUNT")}
                  className="w-full bg-foreground/5 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/20"
                >
                  <option value="CHECKING_ACCOUNT">Conta Corrente</option>
                  <option value="SAVINGS_ACCOUNT">Conta Poupança</option>
                </select>
                <Button size="sm" onClick={handleRecipientSubmit} disabled={acting || !recipientName.trim() || !recipientTaxNumber.trim() || !recipientBranch.trim() || !recipientAccountNumber.trim() || !recipientInstitutionId} className="text-xs w-full">
                  {acting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CreditCard className="w-3 h-3 mr-1" />}
                  Cadastrar Destinatário
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* New Payment Form */}
        <AnimatePresence>
          {showNewPayment && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mb-3 p-3 rounded-xl bg-foreground/5 border border-foreground/10 space-y-3">
                {/* Payment type selector */}
                <div className="flex gap-1">
                  {([
                    { key: "instant", label: "Instantâneo", icon: Zap },
                    { key: "scheduled", label: "Agendado", icon: CalendarClock },
                    { key: "pix_automatico", label: "Pix Auto", icon: RefreshCw },
                  ] as const).map(t => (
                    <button
                      key={t.key}
                      onClick={() => setPayType(t.key)}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                        payType === t.key ? "bg-primary/20 text-primary" : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
                      }`}
                    >
                      <t.icon className="w-3 h-3" />
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Recipient */}
                <select
                  value={selectedRecipient}
                  onChange={e => setSelectedRecipient(e.target.value)}
                  className="w-full bg-foreground/5 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/20"
                >
                  <option value="">Selecione o destinatário</option>
                  {recipients.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.institution_name ? `(${r.institution_name})` : ""} {r.pix_key ? `• ${r.pix_key}` : ""}
                    </option>
                  ))}
                </select>

                {/* Amount */}
                {payType !== "pix_automatico" && (
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="Valor (R$)"
                    step="0.01"
                    className="w-full bg-foreground/5 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/20"
                  />
                )}

                <input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Descrição (opcional)"
                  className="w-full bg-foreground/5 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/20"
                />

                {/* Schedule fields */}
                {payType === "scheduled" && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={scheduleType}
                        onChange={e => setScheduleType(e.target.value as any)}
                        className="flex-1 bg-foreground/5 rounded-lg px-3 py-2 text-xs text-foreground outline-none"
                      >
                        <option value="SINGLE">Único</option>
                        <option value="DAILY">Diário</option>
                        <option value="WEEKLY">Semanal</option>
                        <option value="MONTHLY">Mensal</option>
                      </select>
                      <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="flex-1 bg-foreground/5 rounded-lg px-3 py-2 text-xs text-foreground outline-none"
                      />
                    </div>
                    {scheduleType !== "SINGLE" && (
                      <input
                        type="number"
                        value={occurrences}
                        onChange={e => setOccurrences(e.target.value)}
                        placeholder="Nº de repetições"
                        className="w-full bg-foreground/5 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none"
                      />
                    )}
                  </div>
                )}

                {/* Pix Automático fields */}
                {payType === "pix_automatico" && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={pixInterval}
                        onChange={e => setPixInterval(e.target.value as any)}
                        className="flex-1 bg-foreground/5 rounded-lg px-3 py-2 text-xs text-foreground outline-none"
                      >
                        <option value="WEEKLY">Semanal</option>
                        <option value="MONTHLY">Mensal</option>
                        <option value="QUARTERLY">Trimestral</option>
                        <option value="SEMIANNUAL">Semestral</option>
                        <option value="ANNUAL">Anual</option>
                      </select>
                      <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="flex-1 bg-foreground/5 rounded-lg px-3 py-2 text-xs text-foreground outline-none"
                      />
                    </div>

                    {/* Amount mode selector */}
                    <div className="flex gap-1">
                      <button
                        onClick={() => setAmountMode("fixed")}
                        className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                          amountMode === "fixed" ? "bg-primary/20 text-primary" : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
                        }`}
                      >
                        Valor Fixo
                      </button>
                      <button
                        onClick={() => setAmountMode("variable")}
                        className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                          amountMode === "variable" ? "bg-primary/20 text-primary" : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
                        }`}
                      >
                        Valor Variável
                      </button>
                    </div>

                    {amountMode === "fixed" ? (
                      <input
                        type="number"
                        value={fixedAmount}
                        onChange={e => setFixedAmount(e.target.value)}
                        placeholder="Valor fixo por recorrência (R$)"
                        step="0.01"
                        className="w-full bg-foreground/5 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none"
                      />
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={minVariable}
                          onChange={e => setMinVariable(e.target.value)}
                          placeholder="Mínimo (R$)"
                          step="0.01"
                          className="flex-1 bg-foreground/5 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none"
                        />
                        <input
                          type="number"
                          value={maxVariable}
                          onChange={e => setMaxVariable(e.target.value)}
                          placeholder="Máximo (R$)"
                          step="0.01"
                          className="flex-1 bg-foreground/5 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none"
                        />
                      </div>
                    )}

                    {/* First Payment */}
                    <label className="flex items-center gap-2 text-[10px] text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={firstPaymentEnabled}
                        onChange={e => setFirstPaymentEnabled(e.target.checked)}
                        className="rounded border-foreground/20"
                      />
                      Incluir primeiro pagamento imediato
                    </label>
                    {firstPaymentEnabled && (
                      <div className="space-y-1.5 pl-4 border-l-2 border-primary/20">
                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={firstPaymentDate}
                            onChange={e => setFirstPaymentDate(e.target.value)}
                            className="flex-1 bg-foreground/5 rounded-lg px-3 py-2 text-xs text-foreground outline-none"
                          />
                          <input
                            type="number"
                            value={firstPaymentAmount}
                            onChange={e => setFirstPaymentAmount(e.target.value)}
                            placeholder="Valor (R$)"
                            step="0.01"
                            className="flex-1 bg-foreground/5 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none"
                          />
                        </div>
                        <input
                          value={firstPaymentDescription}
                          onChange={e => setFirstPaymentDescription(e.target.value)}
                          placeholder="Descrição do 1º pagamento (opcional)"
                          className="w-full bg-foreground/5 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none"
                        />
                      </div>
                    )}

                    <label className="flex items-center gap-2 text-[10px] text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={schedulerEnabled}
                        onChange={e => setSchedulerEnabled(e.target.checked)}
                        className="rounded border-foreground/20"
                      />
                      Agendar pagamentos automaticamente (D+2 a D+10)
                    </label>
                    <p className="text-[9px] text-muted-foreground/60 leading-tight">
                      {amountMode === "fixed" 
                        ? "O mesmo valor será cobrado em cada recorrência." 
                        : "O valor pode variar entre o mínimo e máximo a cada cobrança."}
                      {schedulerEnabled && " O sistema agenda cobranças automaticamente dentro da janela D+2 a D+10."}
                    </p>
                  </div>
                )}

                <Button size="sm" onClick={handleSubmit} disabled={acting || !selectedRecipient} className="text-xs w-full">
                  {acting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
                  {payType === "instant" ? "Criar Link de Pagamento" : payType === "scheduled" ? "Agendar Pagamento" : "Criar Mandato Pix Auto"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Payment Requests List */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin pr-0.5">
          {(expanded ? requests : requests.slice(0, 5)).map(req => {
            const meta = STATUS_META[req.status] || STATUS_META.CREATED;
            const StatusIcon = meta.icon;
            return (
              <div key={req.id} className="group p-2.5 rounded-xl bg-foreground/[0.03] border border-foreground/8 hover:border-foreground/15 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <StatusIcon className={`w-3 h-3 ${meta.color} flex-shrink-0 ${req.status === "IN_PROGRESS" ? "animate-spin" : ""}`} />
                      <span className="text-[10px] font-semibold text-foreground truncate">
                        {req.description || "Pagamento"}
                      </span>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${meta.color} bg-foreground/5`}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground flex-wrap">
                      <span className="font-semibold tabular-nums">R$ {formatCurrency(Number(req.amount))}</span>
                      <span>•</span>
                      <span>{TYPE_LABELS[req.payment_type] || req.payment_type}</span>
                      {req.schedule_type && (
                        <>
                          <span>•</span>
                          <span>{SCHEDULE_LABELS[req.schedule_type] || req.schedule_type}</span>
                        </>
                      )}
                      {req.pix_auto_interval && (
                        <>
                          <span>•</span>
                          <span>{INTERVAL_LABELS[req.pix_auto_interval] || req.pix_auto_interval}</span>
                        </>
                      )}
                    </div>
                    {req.schedule_start_date && (
                      <p className="text-[8px] text-muted-foreground/60 mt-0.5">
                        Início: {new Date(req.schedule_start_date + "T12:00:00").toLocaleDateString("pt-BR")}
                      </p>
                    )}
                    <p className="text-[8px] text-muted-foreground/60 mt-0.5">
                      {new Date(req.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {req.payment_url && (
                      <>
                        <button
                          onClick={() => copyToClipboard(req.payment_url!)}
                          className="p-1 rounded hover:bg-foreground/5 text-muted-foreground hover:text-foreground transition-colors"
                          title="Copiar link de autorização"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <a
                          href={req.payment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-foreground/5 text-muted-foreground hover:text-primary transition-colors"
                          title="Abrir link de autorização"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </>
                    )}
                    <button
                      onClick={() => onRefreshStatus(req.provider_request_id)}
                      className="p-1 rounded hover:bg-foreground/5 text-muted-foreground hover:text-foreground transition-colors"
                      title="Atualizar status"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                    {["CREATED", "AUTHORIZED", "WAITING_PAYER_AUTHORIZATION"].includes(req.status) && (
                      <button
                        onClick={() => onCancel(req.provider_request_id)}
                        className="p-1 rounded hover:bg-foreground/5 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                        title="Cancelar"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {requests.length === 0 && (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Send className="w-7 h-7 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">Nenhum pagamento criado</p>
              <p className="text-[9px] text-muted-foreground/60 mt-0.5">Crie um pagamento PIX instantâneo, agendado ou automático</p>
            </div>
          )}
        </div>
      </GlassCard>
    </AnimatedItem>
  );
}
