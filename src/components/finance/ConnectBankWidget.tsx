import { useState, useCallback, useRef, useEffect } from "react";
import { useProviderSettings, useConnectToken, useFinancialConnections } from "@/hooks/finance/useFinance";
import { toast } from "@/hooks/use-toast";
import { Landmark, Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import type { FinanceProvider } from "@/types/finance";

declare global {
  interface Window {
    PluggyConnect?: any;
  }
}

function loadPluggyScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PluggyConnect) { resolve(); return; }
    const script = document.createElement("script");
    script.src = "https://cdn.pluggy.ai/pluggy-connect/latest/pluggy-connect.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Pluggy SDK"));
    document.head.appendChild(script);
  });
}

// Map Pluggy execution statuses to user-friendly messages
const EXECUTION_STATUS_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "Credenciais inválidas. Verifique seus dados e tente novamente.",
  ALREADY_LOGGED_IN: "Já existe uma sessão ativa no banco. Feche-a e tente novamente.",
  SITE_NOT_AVAILABLE: "O site do banco está indisponível no momento. Tente mais tarde.",
  ACCOUNT_LOCKED: "Sua conta está bloqueada no banco. Desbloqueie e tente novamente.",
  USER_AUTHORIZATION_PENDING: "Autorização pendente no seu banco. Verifique o app do banco e aprove a conexão.",
  USER_AUTHORIZATION_NOT_GRANTED: "Autorização não concedida. Aprove a conexão no app do banco.",
  USER_INPUT_TIMEOUT: "Tempo esgotado para inserir os dados. Tente novamente.",
  CONNECTION_ERROR: "Erro de conexão com o banco. Tente novamente.",
  UNEXPECTED_ERROR: "Erro inesperado. Tente novamente mais tarde.",
};

interface ConnectBankWidgetProps {
  onSuccess?: () => void;
  updateItemId?: string;
}

const ConnectBankWidget = ({ onSuccess, updateItemId }: ConnectBankWidgetProps) => {
  const { fetchToken, loading: tokenLoading } = useConnectToken();
  const { resolvedTheme } = useTheme();
  const { saveConnection } = useFinancialConnections();
  const [isLoading, setIsLoading] = useState(false);
  const pluggyRef = useRef<any>(null);
  const lastAutoOpenedItemId = useRef<string | null>(null);

  async function handleSuccess(provider: FinanceProvider, connectionId: string, institutionName: string) {
    await saveConnection(provider, connectionId, institutionName);
    toast({ title: "Banco conectado!", description: `${institutionName} foi conectado com sucesso.` });
    setIsLoading(false);
    onSuccess?.();
  }

  function handleError(message?: string, executionStatus?: string) {
    const statusMsg = executionStatus ? EXECUTION_STATUS_MESSAGES[executionStatus] : null;
    const description = statusMsg || message || "Não foi possível conectar ao banco.";
    
    // USER_AUTHORIZATION_PENDING is not a final error — inform user to check their bank app
    const isWarning = executionStatus === "USER_AUTHORIZATION_PENDING";
    
    toast({
      title: isWarning ? "Aguardando autorização" : "Erro na conexão",
      description,
      variant: isWarning ? "default" : "destructive",
    });
    setIsLoading(false);
  }

  const openPluggy = useCallback(async (token: string, widgetUpdateItemId?: string) => {
    try {
      await loadPluggyScript();
      if (!window.PluggyConnect) {
        throw new Error("PluggyConnect not available after script load");
      }
      const pluggy = new window.PluggyConnect({
        connectToken: token,
        updateItem: widgetUpdateItemId,
        includeSandbox: false,
        language: "pt",
        theme: resolvedTheme === "dark" ? "dark" : "light",
        products: ["ACCOUNTS", "CREDIT_CARDS", "TRANSACTIONS", "INVESTMENTS", "IDENTITY"],
        // Force OAuth to open in system browser to avoid webview issues (per Pluggy docs)
        forceOauthInBrowser: true,
        // Allow background connection for long OAuth flows (e.g. Caixa 30min auth)
        allowConnectInBackground: true,
        onEvent: (payload: any) => {
          console.debug("[Pluggy Event]", payload?.event, payload);
          // Handle ITEM_RESPONSE events to detect pending auth
          if (payload?.event === "ITEM_RESPONSE" && payload?.item) {
            const status = payload.item.executionStatus;
            if (status === "USER_AUTHORIZATION_PENDING") {
              toast({
                title: "Autorização pendente",
                description: "Verifique o aplicativo do seu banco para aprovar a conexão.",
              });
            }
          }
        },
        onOpen: () => setIsLoading(false),
        onSuccess: (data: { item: { id: string; connector?: { name?: string } } }) => {
          const itemId = data.item.id;
          const name = data.item.connector?.name || "Banco";
          handleSuccess("pluggy", itemId, name);
        },
        onError: (error: { message?: string; data?: { item?: { executionStatus?: string } } }) => {
          const executionStatus = error?.data?.item?.executionStatus;
          handleError(error?.message, executionStatus);
        },
        onClose: () => setIsLoading(false),
      });
      pluggyRef.current = pluggy;
      pluggy.init().catch((err: any) => {
        console.error("Pluggy init error:", err);
        handleError(err?.message);
      });
    } catch (err: any) {
      console.error("Pluggy widget error:", err);
      handleError(err?.message);
    }
  }, [resolvedTheme]);

  const openWidget = useCallback(async () => {
    setIsLoading(true);

    let widgetUpdateItemId = updateItemId;
    let { tokenData, error } = await fetchToken(widgetUpdateItemId);

    if (!tokenData && widgetUpdateItemId && error === "ITEM_NOT_FOUND") {
      toast({
        title: "Conexão expirada",
        description: "Essa conexão expirou no banco. Vamos abrir uma nova conexão para reconectar.",
      });
      widgetUpdateItemId = undefined;
      const fallbackResult = await fetchToken();
      tokenData = fallbackResult.tokenData;
      error = fallbackResult.error;
    }

    if (!tokenData) {
      const description = error === "ITEM_NOT_FOUND"
        ? "Esta conexão expirou e não pôde ser reutilizada. Tente conectar o banco novamente."
        : "Não foi possível obter token de conexão.";
      toast({ title: "Erro", description, variant: "destructive" });
      setIsLoading(false);
      return;
    }

    await openPluggy(tokenData.token, widgetUpdateItemId);
  }, [fetchToken, openPluggy, updateItemId]);

  useEffect(() => {
    if (!updateItemId) {
      lastAutoOpenedItemId.current = null;
      return;
    }

    if (lastAutoOpenedItemId.current === updateItemId || isLoading) return;

    lastAutoOpenedItemId.current = updateItemId;
    openWidget();
  }, [updateItemId, openWidget, isLoading]);

  return (
    <button
      onClick={openWidget}
      disabled={isLoading || tokenLoading}
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/20 text-primary text-sm font-medium hover:bg-primary/30 transition-colors disabled:opacity-50"
    >
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Landmark className="w-4 h-4" />}
      Conectar Banco
    </button>
  );
};

export default ConnectBankWidget;
