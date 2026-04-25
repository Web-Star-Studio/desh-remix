import { useNavigate } from "react-router-dom";
import { useComposioConnection } from "@/hooks/integrations/useComposioConnection";
import { Mail, Calendar, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Shows a CTA banner on the dashboard when no Google services are connected.
 * Dismissible per session via sessionStorage.
 */
export default function ComposioOnboardingBanner() {
  const { isConnected, loading } = useComposioConnection();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("composio-onboarding-dismissed") === "1"
  );

  if (loading || dismissed) return null;

  const hasGmail = isConnected("gmail");
  const hasCalendar = isConnected("googlecalendar");
  if (hasGmail && hasCalendar) return null;

  const dismiss = () => {
    sessionStorage.setItem("composio-onboarding-dismissed", "1");
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="relative rounded-xl border border-primary/20 bg-primary/[0.06] p-4 flex items-center gap-4 overflow-hidden"
        >
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <div className="h-9 w-9 rounded-lg bg-[#EA4335]/15 flex items-center justify-center">
              <Mail className="h-4 w-4" style={{ color: "#EA4335" }} />
            </div>
            <div className="h-9 w-9 rounded-lg bg-[#4285F4]/15 flex items-center justify-center">
              <Calendar className="h-4 w-4" style={{ color: "#4285F4" }} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Conecte seu Gmail e Calendar
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Desbloqueie todo o potencial do DESH com suas integrações Google
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => navigate("/integrations")}
            className="focusable shrink-0 gap-1.5 text-xs"
          >
            Conectar agora
            <ArrowRight className="h-3 w-3" />
          </Button>
          <button
            onClick={dismiss}
            className="focusable absolute top-2 right-2 p-1 rounded-md hover:bg-foreground/10 transition-colors"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
