import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Cookie, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CONSENT_KEY = "desh_cookie_consent";

export function CookieConsentBanner() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      // Delay so it doesn't flash on first render
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(CONSENT_KEY, "essential_only");
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-4 left-4 right-4 z-50 flex justify-center pointer-events-none"
        >
          <div
            className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-white/10 bg-[#161616]/95 backdrop-blur-xl shadow-2xl px-5 py-4"
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="shrink-0 mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center bg-[#ae9277]/15">
                <Cookie className="w-4 h-4 text-[#ae9277]" />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white mb-0.5">
                  Cookies e Privacidade
                </p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Usamos cookies essenciais para manter sua sessão e preferências. Não usamos cookies de publicidade ou rastreamento de terceiros.{" "}
                  <button
                    onClick={() => navigate("/privacy")}
                    className="text-[#ae9277] underline underline-offset-2 hover:text-[#c4a98d] transition-colors"
                  >
                    Política de Privacidade
                  </button>
                  {" "}(LGPD/GDPR).
                </p>
              </div>

              {/* Dismiss (essential only) */}
              <button
                onClick={decline}
                className="shrink-0 text-gray-600 hover:text-gray-300 transition-colors mt-0.5"
                aria-label="Fechar — aceitar apenas essenciais"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3 ml-11">
              <button
                onClick={accept}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
                style={{ background: "linear-gradient(135deg, #ae9277, #8d7054)" }}
              >
                Aceitar todos
              </button>
              <button
                onClick={decline}
                className="px-4 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-colors bg-white/[0.04]"
              >
                Apenas essenciais
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
