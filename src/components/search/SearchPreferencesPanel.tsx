import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings2, Sparkles, Globe, RotateCcw, ChevronDown, ChevronUp, ShoppingBag, Newspaper, HelpCircle, List, Image, Layers, DollarSign, Plane, Hotel, Briefcase, Calendar, GraduationCap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import GlassCard from "@/components/dashboard/GlassCard";
import { type SearchPreferences } from "@/hooks/search/useSearchPreferences";

const PROVIDER_OPTIONS = [
  { value: "perplexity" as const, label: "Perplexity", desc: "Síntese IA com citações" },
  { value: "serpapi" as const, label: "SerpAPI", desc: "Dados estruturados do Google" },
  { value: "both" as const, label: "Ambos", desc: "Máxima cobertura (recomendado)" },
];

export default function SearchPreferencesPanel({
  prefs,
  onUpdate,
  onReset,
}: {
  prefs: SearchPreferences;
  onUpdate: (partial: Partial<SearchPreferences>) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
          open ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
        }`}
        title="Preferências de busca"
      >
        <Settings2 className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-[199]" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              className="absolute right-0 top-full mt-2 z-[200] w-[340px] sm:w-[380px]"
            >
              <GlassCard size="auto" className="!p-4 shadow-xl border border-foreground/10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Preferências de Busca</span>
                  </div>
                  <button onClick={onReset} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                    <RotateCcw className="w-3 h-3" /> Resetar
                  </button>
                </div>

                {/* Main engines */}
                <div className="space-y-3 mb-4">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Motores de Busca</p>
                  
                  <div className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                      <div>
                        <span className="text-xs font-medium text-foreground">Perplexity AI</span>
                        <p className="text-[10px] text-muted-foreground">Respostas sintetizadas com IA</p>
                      </div>
                    </div>
                    <Switch checked={prefs.perplexity_enabled} onCheckedChange={v => onUpdate({ perplexity_enabled: v })} />
                  </div>

                  <div className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-emerald-500" />
                      <div>
                        <span className="text-xs font-medium text-foreground">SerpAPI (Google)</span>
                        <p className="text-[10px] text-muted-foreground">Dados estruturados, snippets, shopping</p>
                      </div>
                    </div>
                    <Switch checked={prefs.serpapi_enabled} onCheckedChange={v => onUpdate({ serpapi_enabled: v })} />
                  </div>

                  {!prefs.perplexity_enabled && !prefs.serpapi_enabled && (
                    <p className="text-[10px] text-destructive bg-destructive/10 rounded-lg px-2.5 py-1.5">
                      ⚠️ Pelo menos um motor deve estar ativo para buscar.
                    </p>
                  )}
                </div>

                {/* SerpAPI sub-modules */}
                {prefs.serpapi_enabled && (
                  <>
                    <div className="space-y-2.5 mb-4 pt-3 border-t border-foreground/5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Módulos SerpAPI</p>
                      
                      {[
                        { key: "serp_show_knowledge_graph" as const, icon: Layers, label: "Knowledge Graph", desc: "Painel de informações" },
                        { key: "serp_show_people_also_ask" as const, icon: HelpCircle, label: "Perguntas Relacionadas", desc: "People Also Ask" },
                        { key: "serp_show_shopping" as const, icon: ShoppingBag, label: "Shopping/Produtos", desc: "Resultados de compras" },
                        { key: "serp_show_news" as const, icon: Newspaper, label: "Notícias", desc: "Resultados de notícias" },
                        { key: "serp_show_organic" as const, icon: List, label: "Resultados Orgânicos", desc: "Links do Google" },
                        { key: "serp_show_images" as const, icon: Image, label: "Imagens", desc: "Galeria de imagens" },
                      ].map(item => (
                        <div key={item.key} className="flex items-center justify-between py-0.5">
                          <div className="flex items-center gap-2">
                            <item.icon className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-foreground/80">{item.label}</span>
                          </div>
                          <Switch
                            checked={prefs[item.key]}
                            onCheckedChange={v => onUpdate({ [item.key]: v })}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2.5 mb-4 pt-3 border-t border-foreground/5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Engines Especializados</p>
                      {[
                        { key: "serp_show_finance" as const, icon: DollarSign, label: "Google Finance", colorClass: "text-emerald-500" },
                        { key: "serp_show_flights" as const, icon: Plane, label: "Google Flights", colorClass: "text-sky-500" },
                        { key: "serp_show_hotels" as const, icon: Hotel, label: "Google Hotels", colorClass: "text-amber-500" },
                        { key: "serp_show_jobs" as const, icon: Briefcase, label: "Google Jobs", colorClass: "text-indigo-500" },
                        { key: "serp_show_events" as const, icon: Calendar, label: "Google Events", colorClass: "text-violet-500" },
                        { key: "serp_show_scholar" as const, icon: GraduationCap, label: "Google Scholar", colorClass: "text-slate-500" },
                      ].map(item => (
                        <div key={item.key} className="flex items-center justify-between py-0.5">
                          <div className="flex items-center gap-2">
                            <item.icon className={`w-3 h-3 ${item.colorClass}`} />
                            <span className="text-xs text-foreground/80">{item.label}</span>
                          </div>
                          <Switch
                            checked={prefs[item.key] !== false}
                            onCheckedChange={v => onUpdate({ [item.key]: v })}
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Advanced */}
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center justify-between w-full text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pt-3 border-t border-foreground/5"
                >
                  Avançado
                  {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-2.5 pt-2.5">
                        <div className="flex items-center justify-between py-0.5">
                          <span className="text-xs text-foreground/70">SerpAPI automático (Web)</span>
                          <Switch checked={prefs.auto_serp_on_web} onCheckedChange={v => onUpdate({ auto_serp_on_web: v })} />
                        </div>
                        <div className="flex items-center justify-between py-0.5">
                          <span className="text-xs text-foreground/70">SerpAPI automático (Notícias)</span>
                          <Switch checked={prefs.auto_serp_on_news} onCheckedChange={v => onUpdate({ auto_serp_on_news: v })} />
                        </div>
                        <div className="flex items-center justify-between py-0.5">
                          <span className="text-xs text-foreground/70">SerpAPI automático (Imagens)</span>
                          <Switch checked={prefs.auto_serp_on_images} onCheckedChange={v => onUpdate({ auto_serp_on_images: v })} />
                        </div>

                        <div className="pt-2">
                          <p className="text-[10px] text-muted-foreground mb-2">Provedor padrão para monitores:</p>
                          <div className="flex gap-1.5">
                            {PROVIDER_OPTIONS.map(opt => (
                              <button
                                key={opt.value}
                                onClick={() => onUpdate({ monitor_default_provider: opt.value })}
                                className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all text-center ${
                                  prefs.monitor_default_provider === opt.value
                                    ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                                    : "text-muted-foreground hover:bg-foreground/5"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Cost info */}
                <div className="mt-4 pt-3 border-t border-foreground/5">
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-violet-400" /> Perplexity: 8 créditos
                    </span>
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3 text-emerald-400" /> SerpAPI: +3 créditos
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/40 mt-1">
                    {prefs.perplexity_enabled && prefs.serpapi_enabled
                      ? "Busca dual: ~11 créditos por pesquisa"
                      : prefs.perplexity_enabled
                      ? "Apenas Perplexity: ~8 créditos por pesquisa"
                      : prefs.serpapi_enabled
                      ? "Apenas SerpAPI: ~3 créditos por pesquisa"
                      : "Nenhum motor ativo"}
                  </p>
                </div>
              </GlassCard>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
