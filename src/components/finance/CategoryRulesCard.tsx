import { useState, useEffect } from "react";
import GlassCard from "@/components/dashboard/GlassCard";
import { Tag, Plus, Loader2, RefreshCw, Trash2 } from "lucide-react";
import type { PluggyCategory } from "@/hooks/finance/usePluggyInsights";

interface Props {
  categories: PluggyCategory[];
  onFetchCategories: () => Promise<any[]>;
  onFetchRules: () => Promise<any[]>;
  onCreateRule: (data: { description: string; categoryId: string }) => Promise<any>;
  hasConnections: boolean;
}

export default function CategoryRulesCard({ categories, onFetchCategories, onFetchRules, onCreateRule, hasConnections }: Props) {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [desc, setDesc] = useState("");
  const [catId, setCatId] = useState("");

  if (!hasConnections) return null;

  const loadData = async () => {
    setLoading(true);
    const [cats, r] = await Promise.all([onFetchCategories(), onFetchRules()]);
    setRules(r);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!desc.trim() || !catId) return;
    setLoading(true);
    await onCreateRule({ description: desc.trim(), categoryId: catId });
    setDesc("");
    setCatId("");
    setShowForm(false);
    const r = await onFetchRules();
    setRules(r);
    setLoading(false);
  };

  // Group categories by parent for select
  const parentCats = categories.filter(c => !c.parentId);
  const childCats = categories.filter(c => c.parentId);

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Tag className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground text-base">Regras de Categorização</h3>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} disabled={loading}
            className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
          <button onClick={() => setShowForm(!showForm)}
            className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        Crie regras para categorizar automaticamente transações com base na descrição.
      </p>

      {showForm && (
        <div className="border border-border/40 rounded-lg p-3 mb-3 space-y-2">
          <input
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Padrão de descrição (ex: UBER, NETFLIX)"
            className="w-full text-sm bg-background/50 border border-border/40 rounded-md px-3 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <select
            value={catId}
            onChange={e => setCatId(e.target.value)}
            className="w-full text-sm bg-background/50 border border-border/40 rounded-md px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Selecione categoria</option>
            {parentCats.map(pc => (
              <optgroup key={pc.id} label={pc.descriptionTranslated || pc.description}>
                {childCats.filter(cc => cc.parentId === pc.id).map(cc => (
                  <option key={cc.id} value={cc.id}>{cc.descriptionTranslated || cc.description}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={loading || !desc.trim() || !catId}
              className="flex-1 text-sm bg-primary/20 text-primary rounded-md py-1.5 hover:bg-primary/30 transition-colors disabled:opacity-50">
              Criar regra
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-3 text-sm bg-muted/50 text-muted-foreground rounded-md py-1.5 hover:bg-muted/80 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          {loading ? "Carregando..." : "Nenhuma regra personalizada. Clique em + para criar."}
        </p>
      ) : (
        <div className="space-y-1.5">
          {rules.map((r: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-sm border border-border/30 rounded-md px-3 py-2">
              <div>
                <span className="font-mono text-xs text-foreground">{r.description || r.match}</span>
                <span className="text-muted-foreground ml-2">→ {r.categoryDescription || r.categoryId}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
