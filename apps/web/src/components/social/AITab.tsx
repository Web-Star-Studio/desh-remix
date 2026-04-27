import { useState } from "react";
import { Sparkles, Send, BarChart3, Target, Clock, Users, TrendingUp, Zap, History, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useSocialAIInsights } from "@/hooks/social/useSocialAIInsights";
import { Streamdown } from "streamdown";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface QuickAction {
  label: string;
  action: string;
  icon: React.ReactNode;
  description: string;
  prompt: string;
}

const quickActions: QuickAction[] = [
  {
    label: "Resumo de performance",
    action: "analyze_performance",
    icon: <BarChart3 className="w-4 h-4" />,
    description: "Visão geral dos resultados em todas as plataformas",
    prompt: "Analise a performance das minhas redes sociais. Dados disponíveis: ",
  },
  {
    label: "Sugestões de crescimento",
    action: "growth_recommendations",
    icon: <TrendingUp className="w-4 h-4" />,
    description: "Recomendações para aumentar engajamento e alcance",
    prompt: "Com base nos dados das minhas redes sociais, sugira estratégias de crescimento. Dados: ",
  },
  {
    label: "Análise de ROI de Ads",
    action: "ads_roi_analysis",
    icon: <Target className="w-4 h-4" />,
    description: "Retorno sobre investimento em campanhas",
    prompt: "Analise o ROI das minhas campanhas de anúncios e sugira otimizações. Dados: ",
  },
  {
    label: "Melhor horário p/ postar",
    action: "posting_suggestions",
    icon: <Clock className="w-4 h-4" />,
    description: "Horários ideais baseados no seu público",
    prompt: "Sugira os melhores horários para publicar nas minhas redes sociais com base no perfil do meu público. Dados: ",
  },
  {
    label: "Análise de audiência",
    action: "audience_insights",
    icon: <Users className="w-4 h-4" />,
    description: "Perfil demográfico e comportamental",
    prompt: "Analise o perfil da minha audiência nas redes sociais. Dados: ",
  },
  {
    label: "Sugestões de conteúdo",
    action: "content_suggestions",
    icon: <Zap className="w-4 h-4" />,
    description: "Tópicos e formatos com maior potencial de engajamento",
    prompt: "Com base nos posts de maior engajamento, sugira 5 ideias de conteúdo com tópico, formato (carrossel, vídeo, story, reels) e exemplo de copywriting. Dados: ",
  },
];

export function AITab() {
  const { user } = useAuth();
  const { insights, removeInsight } = useSocialAIInsights();
  const [showHistory, setShowHistory] = useState(false);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);

  // Inline analysis generation lived on Supabase's `chat` edge fn — that
  // route is in the deferred ai-router migration wave (see CLAUDE.md). Until
  // it lands on apps/api, the quick-action buttons funnel the user into
  // Pandora with the chosen prompt pre-loaded; Pandora has the same data
  // available via the `desh` MCP and richer reasoning loop anyway.
  const goToPandoraWith = (qa: QuickAction) => {
    if (!user) return;
    const params = new URLSearchParams({
      action: "social_analysis",
      preset: qa.action,
      prompt: qa.prompt,
    });
    window.location.href = `/pandora?${params.toString()}`;
  };
  const goToPandora = () => {
    window.location.href = `/pandora?action=social_analysis`;
  };

  return (
    <>
      {/* Quick actions grid */}
      <GlassCard size="auto">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-primary" /> Análise Inteligente
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Selecione uma análise para gerar insights em tempo real com base nos seus dados conectados.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {quickActions.map((qa) => (
            <button
              key={qa.action}
              onClick={() => goToPandoraWith(qa)}
              className="flex items-start gap-3 p-3.5 rounded-xl border transition-all text-left group border-foreground/5 bg-foreground/[0.02] hover:bg-foreground/[0.05] hover:border-primary/20"
            >
              <div className="p-1.5 rounded-lg shrink-0 bg-foreground/5 text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                {qa.icon}
              </div>
              <div className="min-w-0">
                <span className="text-sm font-medium text-foreground block">{qa.label}</span>
                <span className="text-[11px] text-muted-foreground leading-snug">{qa.description}</span>
              </div>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Análises rodam pela Pandora com seus dados conectados — clique em uma ação acima.
        </p>
      </GlassCard>

      {/* History */}
      {insights.length > 0 && (
        <GlassCard size="auto">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between"
          >
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" /> Histórico de Análises
              <span className="text-xs font-normal text-muted-foreground">({insights.length})</span>
            </h3>
            {showHistory ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {showHistory && (
            <div className="mt-3 space-y-2">
              {insights.map((ins) => (
                <div key={ins.id} className="border border-foreground/5 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedInsight(expandedInsight === ins.id ? null : ins.id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-foreground/[0.02] transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="text-sm font-medium text-foreground truncate">{ins.actionLabel}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(ins.createdAt), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); removeInsight(ins.id); }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                      {expandedInsight === ins.id ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                    </div>
                  </button>
                  {expandedInsight === ins.id && (
                    <div className="px-3 pb-3">
                      <Streamdown>{ins.resultText}</Streamdown>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {/* Go to Pandora for deeper analysis */}
      <div className="flex justify-center">
        <Button variant="outline" size="sm" className="gap-2" onClick={goToPandora}>
          <Send className="h-3.5 w-3.5" /> Análise completa com Pandora
        </Button>
      </div>
    </>
  );
}
