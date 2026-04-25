
-- Create ai_skills table
CREATE TABLE IF NOT EXISTS public.ai_skills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT DEFAULT '⚡',
  category TEXT NOT NULL CHECK (category IN (
    'analysis', 'writing', 'planning', 'communication',
    'finance', 'marketing', 'development', 'management',
    'sales', 'support', 'legal', 'data', 'other'
  )),
  instructions TEXT NOT NULL,
  trigger_description TEXT,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  token_estimate INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for workspace-scoped queries
CREATE INDEX idx_skills_ws ON public.ai_skills(workspace_id, is_active);

-- Enable RLS
ALTER TABLE public.ai_skills ENABLE ROW LEVEL SECURITY;

-- Policy: users manage their own skills OR view system skills
CREATE POLICY "Users manage own skills or view system"
  ON public.ai_skills FOR ALL
  USING (auth.uid() = user_id OR is_system = true)
  WITH CHECK (auth.uid() = user_id);

-- Timestamp trigger
CREATE TRIGGER update_ai_skills_updated_at
  BEFORE UPDATE ON public.ai_skills
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert 8 system skills
INSERT INTO public.ai_skills (user_id, workspace_id, name, description, icon, category, instructions, trigger_description, is_system, is_active, token_estimate) VALUES
(NULL, NULL, 'Análise SEO', 'Checklist completo de SEO para páginas e sites', '⚡', 'marketing',
 'Checklist SEO: 1) Title tag (50-60 chars, keyword no início), 2) Meta description (150-160, CTA), 3) H1 único, 4) Hierarquia headings, 5) URL amigável, 6) Alt text, 7) Links internos, 8) Core Web Vitals (LCP<2.5s, FID<100ms, CLS<0.1), 9) Mobile-friendly, 10) Schema markup. Classifique: ✅ OK, ⚠️ Melhorar, ❌ Crítico. Nota 0-100.',
 'analisar SEO site página otimização busca orgânico', true, true, 100),

(NULL, NULL, 'Sprint Planning', 'Planejamento de sprints com estimativa de esforço', '📋', 'planning',
 'Sprint: 1) Duração (2 semanas padrão), 2) Listar tarefas com esforço (P/M/G), 3) Capacidade = dias úteis × 6h, 4) Priorizar Eisenhower (urgente+importante), 5) Não exceder 80% capacidade, 6) Dividir G em sub-tarefas, 7) Definition of Done cada tarefa, 8) Daily standup (15min) + review/retro último dia.',
 'planejar sprint organizar tarefas ciclo semana priorizar backlog', true, true, 85),

(NULL, NULL, 'Follow-up de Vendas', 'Regras e templates para acompanhamento comercial', '🤝', 'sales',
 'Regras: 1) Primeiro follow: 24h após contato, 2) Segundo: 3 dias, 3) Terceiro: 7 dias, 4) Último: 14 dias com deadline. Tom: profissional + valor (insight, case, conteúdo). Nunca: pressionar, genérico, ''e aí?''. Template: [Saudação pessoal] + [Ref último contato] + [Valor] + [Próximo passo com data].',
 'follow-up acompanhar lead lembrete comercial vendas pipeline', true, true, 80),

(NULL, NULL, 'Relatório Semanal', 'Formato padrão para relatórios semanais de progresso', '📊', 'management',
 'Formato: 1) RESUMO (3 linhas), 2) CONQUISTAS (concluído), 3) EM ANDAMENTO (status), 4) BLOQUEIOS, 5) PRÓXIMA SEMANA (top 3), 6) MÉTRICAS (KPIs + variação). Use dados reais de tarefas, calendário e finanças.',
 'relatório semanal resumo semana weekly report status', true, true, 70),

(NULL, NULL, 'Análise Financeira', 'Análise completa de receitas, despesas e projeções', '💰', 'finance',
 'Análise: 1) Período, 2) Receitas (total, fonte, variação), 3) Despesas (total, categoria, variação), 4) Resultado (lucro/prejuízo, margem), 5) Top 5 despesas, 6) Acima do orçamento, 7) Projeção fim do mês, 8) Recomendações com valor estimado. BRL, separador de milhar.',
 'analisar finanças gastos orçamento DRE fluxo caixa receita despesa', true, true, 85),

(NULL, NULL, 'Briefing de Conteúdo', 'Estrutura para briefings de conteúdo e pautas', '✍️', 'writing',
 'Brief: 1) OBJETIVO, 2) PÚBLICO-ALVO (persona, dor, desejo), 3) FORMATO (blog/vídeo/carrossel/story), 4) TOM, 5) KEYWORDS (principal + secundárias), 6) ESTRUTURA (outline com H2s), 7) CTA, 8) REFERÊNCIAS (3 similares), 9) PRAZO e RESPONSÁVEL.',
 'briefing brief pauta conteúdo criar texto artigo post', true, true, 75),

(NULL, NULL, 'Análise de Contrato', 'Checklist para revisão de contratos e termos', '⚖️', 'legal',
 'Checklist: 1) Partes, 2) Objeto, 3) Prazo/vigência, 4) Valor/pagamento, 5) Multas, 6) Rescisão, 7) Confidencialidade, 8) Propriedade intelectual, 9) Foro, 10) Cláusulas abusivas. 🟢 OK, 🟡 Atenção, 🔴 Risco. SEMPRE recomendar revisão por advogado.',
 'analisar contrato revisar cláusulas termos acordo NDA', true, true, 80),

(NULL, NULL, 'Onboarding de Cliente', 'Fluxo completo de integração de novos clientes', '💬', 'support',
 'Fluxo: 1) Email boas-vindas (pessoal), 2) Call kickoff (30min), 3) Formulário briefing, 4) Workspace do cliente, 5) Canais comunicação, 6) Cronograma milestones, 7) Quick win em 7 dias, 8) Check-in semanal primeiras 4 semanas.',
 'onboarding integração cliente boas-vindas kickoff novo cliente', true, true, 70);
