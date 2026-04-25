import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, RotateCw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional label describing the chunk/page that failed to load */
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function isChunkLoadError(err: Error | null): boolean {
  if (!err) return false;
  const msg = err.message?.toLowerCase?.() || "";
  return (
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("loading chunk") ||
    msg.includes("loading css chunk") ||
    msg.includes("module script failed") ||
    msg.includes("dynamically imported module")
  );
}

/**
 * ChunkErrorBoundary
 * ------------------
 * Specialized boundary for lazy-loaded route chunks. Detects chunk loading
 * failures (common after deploys or with flaky networks) and presents a
 * clear recovery UI so the user is never stuck on the loading screen.
 *
 * Differences from the generic AppErrorBoundary:
 *   - Tailored copy for module/chunk failures
 *   - "Recarregar página" performs a hard reload (bypasses cached manifest)
 *   - "Tentar novamente" resets boundary state (re-attempts the import)
 */
class ChunkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ChunkErrorBoundary] Caught render-time error", {
      label: this.props.label,
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("desh:error", {
          detail: {
            code: isChunkLoadError(error) ? "chunk_load_failed" : "lazy_render_error",
            message: error.message,
            module: this.props.label,
            severity: "error" as const,
          },
        })
      );
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleHardReload = () => {
    try {
      // Best effort: clear caches before reload to bypass stale chunks.
      caches?.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
    } catch {}
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isChunk = isChunkLoadError(this.state.error);
    const label = this.props.label || "esta seção";

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-6 py-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-destructive/70" />
        </div>
        <div className="max-w-md">
          <p className="text-lg font-semibold text-foreground mb-1.5">
            {isChunk ? "Não foi possível carregar este módulo" : `Erro ao abrir ${label}`}
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isChunk
              ? "Isso geralmente acontece após uma atualização do app. Recarregar a página costuma resolver."
              : "Ocorreu um erro inesperado. Você pode tentar novamente ou recarregar a página."}
          </p>
          {this.state.error?.message && (
            <p className="text-[11px] text-muted-foreground/60 mt-3 font-mono break-all">
              {this.state.error.message.slice(0, 200)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground/10 text-foreground text-sm font-medium hover:bg-foreground/15 transition-colors focusable"
          >
            <RotateCw className="w-4 h-4" />
            Tentar novamente
          </button>
          <button
            onClick={this.handleHardReload}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors focusable"
          >
            <RefreshCw className="w-4 h-4" />
            Recarregar página
          </button>
        </div>
      </div>
    );
  }
}

export default ChunkErrorBoundary;
