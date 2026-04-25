import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("app-error", {
      detail: { type: "404", path: location.pathname },
    }));
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="relative max-w-md w-full text-center">
        {/* Glassmorphic card */}
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-10 shadow-2xl">
          {/* Big 404 */}
          <h1
            className="text-8xl font-black tracking-tighter"
            style={{
              background: "linear-gradient(135deg, #C8956C 0%, #E8C49A 50%, #C8956C 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            404
          </h1>

          <p className="mt-4 text-lg font-medium text-foreground/80">
            Página não encontrada
          </p>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            O endereço <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">{location.pathname}</code> não existe ou foi movido.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #C8956C, #E8C49A)" }}
            >
              <Home className="w-4 h-4" />
              Ir para o início
            </a>
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-foreground/80 transition-all hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>
          </div>
        </div>

        {/* Decorative glow */}
        <div
          className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #C8956C 0%, transparent 70%)" }}
        />
      </div>
    </div>
  );
};

export default NotFound;
