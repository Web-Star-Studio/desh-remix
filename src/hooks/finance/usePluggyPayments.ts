import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceSafe } from '@/contexts/WorkspaceContext';
import { toast } from '@/hooks/use-toast';

export interface PaymentRecipient {
  id: string;
  provider_recipient_id: string;
  name: string;
  tax_number: string | null;
  institution_name: string | null;
  pix_key: string | null;
  is_default: boolean;
}

export interface PaymentRequest {
  id: string;
  provider_request_id: string;
  recipient_id: string | null;
  amount: number;
  description: string | null;
  status: string;
  payment_url: string | null;
  payment_type: string;
  schedule_type: string | null;
  schedule_start_date: string | null;
  schedule_occurrences: number | null;
  pix_auto_interval: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentIntent {
  id: string;
  provider_intent_id: string;
  status: string;
  error_code: string | null;
  end_to_end_id: string | null;
  created_at: string;
}

export interface ScheduledPayment {
  id: string;
  provider_scheduled_id: string;
  status: string;
  scheduled_date: string | null;
  amount: number | null;
  error_code: string | null;
  created_at: string;
}

export interface PaymentConnector {
  id: number;
  name: string;
  imageUrl: string;
  supportsPaymentInitiation: boolean;
  supportsScheduledPayments: boolean;
  supportsSmartTransfers: boolean;
  health: { status?: string };
}

export function usePluggyPayments() {
  const [recipients, setRecipients] = useState<PaymentRecipient[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [connectors, setConnectors] = useState<PaymentConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const wsCtx = useWorkspaceSafe();
  const workspaceId = wsCtx?.activeWorkspaceId ?? null;

  const loadData = useCallback(async () => {
    const [recipientsRes, requestsRes] = await Promise.all([
      (supabase as any).from('financial_payment_recipients').select('*').order('created_at', { ascending: false }),
      (supabase as any).from('financial_payment_requests').select('*').order('created_at', { ascending: false }),
    ]);
    setRecipients(recipientsRes.data || []);
    setRequests(requestsRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [workspaceId, loadData]);

  const loadConnectors = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('pluggy-proxy', {
        body: { action: 'list_connectors' },
      });
      if (error) throw error;
      setConnectors(data?.connectors || []);
      return data?.connectors || [];
    } catch (err: any) {
      console.error('loadConnectors error:', err);
      return [];
    }
  }, []);

  const invokePayments = useCallback(async (body: Record<string, any>) => {
    const { data, error } = await supabase.functions.invoke('pluggy-proxy', { body });
    if (error) {
      const msg = data?.error || error?.message || 'Erro desconhecido';
      throw new Error(msg);
    }
    // Edge function returns 200 with error field for known API errors
    if (data?.error) {
      throw new Error(data.error);
    }
    return data;
  }, []);

  const createRecipient = useCallback(async (params: {
    name: string;
    tax_number?: string;
    institution_id?: string;
    account?: { branch: string; number: string; type: string };
    pix_key?: string;
  }) => {
    setActing(true);
    try {
      const data = await invokePayments({ action: 'create_recipient', ...params, workspace_id: workspaceId });
      toast({ title: 'Destinatário criado', description: `${params.name} registrado com sucesso.` });
      await loadData();
      return data?.recipient;
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
      return null;
    } finally { setActing(false); }
  }, [workspaceId, invokePayments]);

  const createRecipientFromQR = useCallback(async (qrCode: string) => {
    setActing(true);
    try {
      const data = await invokePayments({ action: 'create_recipient_qr', qr_code: qrCode, workspace_id: workspaceId });
      toast({ title: 'QR Code processado', description: 'Destinatário criado a partir do PIX QR.' });
      await loadData();
      return data?.recipient;
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
      return null;
    } finally { setActing(false); }
  }, [workspaceId, invokePayments]);

  const createPayment = useCallback(async (params: {
    recipient_id: string;
    amount: number;
    description?: string;
  }) => {
    setActing(true);
    try {
      const data = await invokePayments({ action: 'create_payment', ...params, workspace_id: workspaceId });
      toast({ title: 'Pagamento criado', description: 'Link de pagamento gerado com sucesso.' });
      await loadData();
      return data?.payment;
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
      return null;
    } finally { setActing(false); }
  }, [workspaceId, invokePayments]);

  const createScheduledPayment = useCallback(async (params: {
    recipient_id: string;
    amount: number;
    description?: string;
    schedule: {
      type: 'SINGLE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
      start_date: string;
      occurrences?: number;
      dates?: string[];
    };
  }) => {
    setActing(true);
    try {
      const data = await invokePayments({ action: 'create_scheduled_payment', ...params, workspace_id: workspaceId });
      toast({ title: 'Pagamento agendado', description: `Agendamento ${params.schedule.type} criado.` });
      await loadData();
      return data?.payment;
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
      return null;
    } finally { setActing(false); }
  }, [workspaceId, invokePayments]);

  const createPixAutomatico = useCallback(async (params: {
    recipient_id: string;
    description?: string;
    interval: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL';
    start_date: string;
    fixed_amount?: number;
    min_variable?: number;
    max_variable?: number;
    scheduler_enabled?: boolean;
    scheduler_description?: string;
    first_payment?: {
      date: string;
      amount: number;
      description?: string;
    };
  }) => {
    setActing(true);
    try {
      const data = await invokePayments({ action: 'create_pix_automatico', ...params, workspace_id: workspaceId });
      toast({ title: 'Pix Automático criado', description: 'Mandato de pagamento recorrente criado. Redirecione o pagador ao link gerado.' });
      await loadData();
      return data?.payment;
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
      return null;
    } finally { setActing(false); }
  }, [workspaceId, invokePayments]);

  const cancelPayment = useCallback(async (providerRequestId: string) => {
    setActing(true);
    try {
      await invokePayments({ action: 'delete_payment', provider_request_id: providerRequestId });
      toast({ title: 'Pagamento cancelado' });
      await loadData();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally { setActing(false); }
  }, [invokePayments]);

  const refreshPaymentStatus = useCallback(async (providerRequestId: string) => {
    try {
      const data = await invokePayments({ action: 'get_payment', provider_request_id: providerRequestId });
      await loadData();
      return data?.payment;
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar', description: err.message, variant: 'destructive' });
      return null;
    }
  }, [invokePayments]);
  return {
    recipients,
    requests,
    connectors,
    loading,
    acting,
    loadConnectors,
    createRecipient,
    createRecipientFromQR,
    createPayment,
    createScheduledPayment,
    createPixAutomatico,
    cancelPayment,
    refreshPaymentStatus,
    refresh: loadData,
  };
}
