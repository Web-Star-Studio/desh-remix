import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Report to global error handler instead of console.log
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(
        new CustomEvent("desh:error", {
          detail: {
            code: "widget_crash",
            message: error.message,
            stack: info.componentStack,
            module: undefined,
            severity: "error" as const,
          },
        })
      );
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 px-4 text-center min-h-[50vh]">
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-destructive/60" />
        </div>
        <div>
          <p className="text-base font-semibold text-foreground mb-1">
            {this.props.fallbackLabel || "Algo deu errado"}
          </p>
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
            Ocorreu um erro inesperado. Tente recarregar esta seção.
          </p>
        </div>
        <button
          onClick={this.handleRetry}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/15 text-primary text-sm font-medium hover:bg-primary/25 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Tentar novamente
        </button>
      </div>
    );
  }
}

export default AppErrorBoundary;
