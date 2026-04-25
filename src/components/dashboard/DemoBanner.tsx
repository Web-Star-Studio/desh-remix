import { motion } from "framer-motion";
import { Eye, Plug, X, Loader2 } from "lucide-react";
import { useDemo } from "@/contexts/DemoContext";
import { useNavigate } from "react-router-dom";

const DemoBanner = () => {
  const { isDemoMode, isLoading, deactivateDemo } = useDemo();
  const navigate = useNavigate();

  if (!isDemoMode) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 backdrop-blur-sm"
    >
      <Eye className="w-4 h-4 text-amber-400 shrink-0" />
      <p className="text-xs text-amber-300 flex-1">
        <span className="font-semibold">Modo Demo ativo</span> — você está usando dados simulados. Todas as funções de IA consomem créditos normalmente.
      </p>
      <button
        onClick={() => navigate("/integrations")}
        className="focusable flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors font-medium shrink-0"
      >
        <Plug className="w-3 h-3" /> Conectar
      </button>
      <button
        onClick={deactivateDemo}
        disabled={isLoading}
        className="focusable text-amber-400/60 hover:text-amber-300 transition-colors shrink-0 disabled:opacity-50"
        title="Desativar demo"
      >
        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
      </button>
    </motion.div>
  );
};

export default DemoBanner;
