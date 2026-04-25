import { Sparkles, Loader2 } from "lucide-react";

interface Props {
  fetching: boolean;
  onEnrich: () => void;
}

export default function EnrichButton({ fetching, onEnrich }: Props) {
  return (
    <button
      onClick={onEnrich}
      disabled={fetching}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors disabled:opacity-50"
      title="Enriquecer transações com categorização e dados de comerciante via Pluggy"
    >
      {fetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
      Enriquecer
    </button>
  );
}
