import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, X, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type FilterValue = string | number | undefined;

interface FilterOption {
  label: string;
  value: FilterValue;
}

interface FilterGroup {
  key: string;
  label: string;
  options: FilterOption[];
  type?: "chips" | "input";
}

const ENGINE_FILTERS: Record<string, FilterGroup[]> = {
  google_shopping: [
    {
      key: "tbs_price",
      label: "Preço",
      options: [
        { label: "Qualquer", value: undefined },
        { label: "Até R$50", value: "mr:1,price:1,ppr_max:50" },
        { label: "R$50-200", value: "mr:1,price:1,ppr_min:50,ppr_max:200" },
        { label: "R$200-500", value: "mr:1,price:1,ppr_min:200,ppr_max:500" },
        { label: "R$500+", value: "mr:1,price:1,ppr_min:500" },
      ],
    },
    {
      key: "tbs_condition",
      label: "Condição",
      options: [
        { label: "Qualquer", value: undefined },
        { label: "Novo", value: "mr:1,condition:1" },
        { label: "Usado", value: "mr:1,condition:2" },
        { label: "Recondicionado", value: "mr:1,condition:3" },
      ],
    },
    {
      key: "tbs_free_shipping",
      label: "Frete",
      options: [
        { label: "Qualquer", value: undefined },
        { label: "Frete grátis", value: "mr:1,ship:1" },
      ],
    },
  ],
  google_news: [
    {
      key: "tbs",
      label: "Período",
      options: [
        { label: "Qualquer", value: undefined },
        { label: "Última hora", value: "qdr:h" },
        { label: "Hoje", value: "qdr:d" },
        { label: "Esta semana", value: "qdr:w" },
        { label: "Este mês", value: "qdr:m" },
        { label: "Este ano", value: "qdr:y" },
      ],
    },
  ],
  google_images: [
    {
      key: "tbs_size",
      label: "Tamanho",
      options: [
        { label: "Qualquer", value: undefined },
        { label: "Grande", value: "isz:l" },
        { label: "Médio", value: "isz:m" },
        { label: "Ícone", value: "isz:i" },
      ],
    },
    {
      key: "tbs_color",
      label: "Cor",
      options: [
        { label: "Qualquer", value: undefined },
        { label: "Colorido", value: "ic:full" },
        { label: "P&B", value: "ic:gray" },
        { label: "Transparente", value: "ic:trans" },
      ],
    },
    {
      key: "tbs_type",
      label: "Tipo",
      options: [
        { label: "Qualquer", value: undefined },
        { label: "Foto", value: "itp:photo" },
        { label: "Clipart", value: "itp:clipart" },
        { label: "Animado", value: "itp:animated" },
      ],
    },
  ],
  google_maps: [
    {
      key: "type",
      label: "Tipo",
      options: [
        { label: "Busca", value: undefined },
        { label: "Lugares", value: "search" },
      ],
    },
    {
      key: "rating",
      label: "Avaliação",
      options: [
        { label: "Qualquer", value: undefined },
        { label: "3.5+", value: "3.5" },
        { label: "4+", value: "4.0" },
        { label: "4.5+", value: "4.5" },
      ],
    },
  ],
  youtube: [
    {
      key: "sp",
      label: "Ordenar",
      options: [
        { label: "Relevância", value: undefined },
        { label: "Data", value: "CAI%3D" },
        { label: "Visualizações", value: "CAM%3D" },
        { label: "Avaliação", value: "CAE%3D" },
      ],
    },
    {
      key: "sp_date",
      label: "Upload",
      options: [
        { label: "Qualquer", value: undefined },
        { label: "Hoje", value: "EgIIAg%3D%3D" },
        { label: "Semana", value: "EgIIAw%3D%3D" },
        { label: "Mês", value: "EgIIBA%3D%3D" },
        { label: "Ano", value: "EgIIBQ%3D%3D" },
      ],
    },
  ],
  google_trends: [
    {
      key: "date",
      label: "Período",
      options: [
        { label: "12 meses", value: undefined },
        { label: "1h", value: "now 1-H" },
        { label: "4h", value: "now 4-H" },
        { label: "1 dia", value: "now 1-d" },
        { label: "7 dias", value: "now 7-d" },
        { label: "30 dias", value: "today 1-m" },
        { label: "90 dias", value: "today 3-m" },
        { label: "5 anos", value: "today 5-y" },
        { label: "Tudo", value: "all" },
      ],
    },
    {
      key: "gprop",
      label: "Propriedade",
      options: [
        { label: "Web", value: undefined },
        { label: "Imagens", value: "images" },
        { label: "Notícias", value: "news" },
        { label: "Shopping", value: "froogle" },
        { label: "YouTube", value: "youtube" },
      ],
    },
    {
      key: "cat",
      label: "Categoria",
      options: [
        { label: "Todas", value: undefined },
        { label: "Negócios", value: "12" },
        { label: "Tecnologia", value: "5" },
        { label: "Entretenimento", value: "3" },
        { label: "Esportes", value: "20" },
      ],
    },
  ],
};



interface Props {
  engine: string;
  onChange: (params: Record<string, any>) => void;
}

const SerpEngineFilters = ({ engine, onChange }: Props) => {
  const groups = ENGINE_FILTERS[engine];
  const [values, setValues] = useState<Record<string, FilterValue>>({});

  useEffect(() => {
    setValues({});
  }, [engine]);

  const activeCount = useMemo(() => {
    return Object.values(values).filter((v) => v !== undefined && v !== "").length;
  }, [values]);

  const buildParams = useCallback(
    (next: Record<string, FilterValue>) => {
      const params: Record<string, any> = {};
      for (const [k, v] of Object.entries(next)) {
        if (v !== undefined && v !== "") params[k] = v;
      }
      if (engine === "youtube") {
        const sp = next["sp"] || next["sp_date"];
        if (sp) params["sp"] = String(sp);
        delete params["sp_date"];
      }
      return params;
    },
    [engine]
  );

  const handleChange = useCallback(
    (key: string, val: FilterValue) => {
      setValues((prev) => {
        const next = { ...prev, [key]: val };
        onChange(buildParams(next));
        return next;
      });
    },
    [onChange, buildParams]
  );

  const handleReset = useCallback(() => {
    setValues({});
    onChange({});
  }, [onChange]);

  if (!groups || groups.length === 0) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={engine}
        initial={{ opacity: 0, height: 0, y: -4 }}
        animate={{ opacity: 1, height: "auto", y: 0 }}
        exit={{ opacity: 0, height: 0, y: -4 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="overflow-hidden"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2 px-1">
          <div className="flex items-center gap-1.5 shrink-0">
            <SlidersHorizontal className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Filtros</span>
            {activeCount > 0 && (
              <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-4 bg-primary/15 text-primary border-0">
                {activeCount}
              </Badge>
            )}
          </div>

          <div className="h-3 w-px bg-foreground/10 shrink-0 hidden sm:block" />

          {groups.map((group) => {
            if (group.type === "input") {
              return (
                <div key={group.key} className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground/70 font-medium">{group.label}:</span>
                  <input
                    type="number"
                    min="1900"
                    max="2030"
                    placeholder="Ano"
                    value={values[group.key] !== undefined ? String(values[group.key]) : ""}
                    onChange={(e) => handleChange(group.key, e.target.value || undefined)}
                    className="w-16 px-1.5 py-0.5 rounded-md text-[11px] bg-foreground/[0.04] border border-foreground/10 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/30 transition-all"
                  />
                </div>
              );
            }

            const currentVal = values[group.key];
            return (
              <div key={group.key} className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground/70 font-medium">{group.label}:</span>
                <div className="flex items-center gap-0.5 flex-wrap">
                  {group.options.map((opt) => {
                    const isActive =
                      currentVal === opt.value ||
                      (currentVal === undefined && opt.value === undefined);
                    return (
                      <button
                        key={String(opt.value ?? "default")}
                        onClick={() => handleChange(group.key, opt.value)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all duration-150 shrink-0 ${
                          isActive
                            ? "bg-primary/15 text-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]"
                            : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground/80"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {activeCount > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={handleReset}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] transition-all shrink-0"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              Limpar
            </motion.button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SerpEngineFilters;
