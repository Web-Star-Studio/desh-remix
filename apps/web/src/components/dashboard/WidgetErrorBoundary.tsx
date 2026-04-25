import React, { Component, type ErrorInfo, type ReactNode } from "react";
import GlassCard from "./GlassCard";
import { AlertTriangle, RefreshCw, LogIn } from "lucide-react";

interface Props {
  children: ReactNode;
  widgetName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isSessionError: boolean;
}

function isAuthError(error: Error): boolean {
  const msg = (error.message || "").toLowerCase();
  // Skip not_connected errors — these are handled gracefully by connection CTAs
  if (msg.includes("not_connected") || msg.includes("não conectou")) return false;
  return (
    msg.includes("auth session missing") ||
    msg.includes("jwt expired") ||
    msg.includes("invalid token") ||
    msg.includes("not authenticated") ||
    msg.includes("refresh_token") ||
    msg.includes("session expired") ||
    msg.includes("401") ||
    msg.includes("unauthorized")
  );
}

class WidgetErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isSessionError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, isSessionError: isAuthError(error) };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(
        new CustomEvent("desh:error", {
          detail: {
            code: "widget_crash",
            message: `${this.props.widgetName || "Widget"}: ${error.message}`,
            stack: errorInfo.componentStack,
            module: undefined,
            severity: "error" as const,
          },
        })
      );
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, isSessionError: false });
  };

  handleReconnect = async () => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      // Use the existing client from integrations
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        window.location.href = "/auth";
        return;
      }
      this.setState({ hasError: false, error: null, isSessionError: false });
    } catch {
      window.location.href = "/auth";
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.state.isSessionError) {
        return (
          <GlassCard className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <LogIn className="w-8 h-8 text-warning/70" />
            <div>
              <p className="text-sm font-medium text-foreground mb-1">
                Sessão expirada
              </p>
              <p className="text-xs text-muted-foreground max-w-[200px]">
                {this.props.widgetName
                  ? `"${this.props.widgetName}" precisa de autenticação.`
                  : "Reconecte para continuar."}
              </p>
            </div>
            <button
              onClick={this.handleReconnect}
              className="focusable flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              Reconectar
            </button>
          </GlassCard>
        );
      }

      return (
        <GlassCard className="flex flex-col items-center justify-center gap-3 py-8 text-center">
          <AlertTriangle className="w-8 h-8 text-destructive/70" />
          <div>
            <p className="text-sm font-medium text-foreground mb-1">
              {this.props.widgetName || "Widget"} falhou
            </p>
            <p className="text-xs text-muted-foreground max-w-[200px]">
              Ocorreu um erro inesperado neste widget.
            </p>
          </div>
          <button
            onClick={this.handleRetry}
            className="focusable flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Tentar novamente
          </button>
        </GlassCard>
      );
    }

    return this.props.children;
  }
}

export default WidgetErrorBoundary;
