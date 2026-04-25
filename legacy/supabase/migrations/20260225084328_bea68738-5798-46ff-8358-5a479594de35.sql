
-- Changelogs table for tracking all updates/releases
CREATE TABLE public.changelogs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version text NOT NULL,
  title text NOT NULL,
  description text,
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  type text NOT NULL DEFAULT 'update',
  published_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for ordering
CREATE INDEX idx_changelogs_published ON public.changelogs (published_at DESC);

-- Enable RLS
ALTER TABLE public.changelogs ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read changelogs
CREATE POLICY "Authenticated users can read changelogs"
ON public.changelogs
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only admins can manage changelogs
CREATE POLICY "Admins can insert changelogs"
ON public.changelogs
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update changelogs"
ON public.changelogs
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete changelogs"
ON public.changelogs
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed initial changelog entries
INSERT INTO public.changelogs (version, title, description, type, changes, published_at) VALUES
('1.0.0', 'Lançamento Inicial', 'Primeira versão estável do Desh — Personal OS.', 'release', '[
  {"type": "feature", "text": "Dashboard principal com widgets personalizáveis"},
  {"type": "feature", "text": "Sistema de notas com editor rich-text"},
  {"type": "feature", "text": "Gerenciador de tarefas com prioridades"},
  {"type": "feature", "text": "Calendário com eventos e recorrências"},
  {"type": "feature", "text": "Módulo de finanças pessoais"},
  {"type": "feature", "text": "Chat IA integrado com múltiplos modelos"},
  {"type": "feature", "text": "Sistema de contatos"},
  {"type": "feature", "text": "Integração com Gmail e Google Contacts"},
  {"type": "feature", "text": "Tema claro/escuro com wallpapers"},
  {"type": "feature", "text": "Sistema de gamificação com XP e badges"}
]'::jsonb, '2025-06-01T00:00:00Z'),
('1.1.0', 'Lixeira Inteligente & Logs', 'Soft-delete para notas com lixeira de 30 dias e sistema de logs de atividade.', 'update', '[
  {"type": "feature", "text": "Lixeira para notas com recuperação em 30 dias"},
  {"type": "feature", "text": "Barra de progresso de dias restantes na lixeira"},
  {"type": "feature", "text": "Página de logs de atividade do usuário"},
  {"type": "improvement", "text": "Notas são movidas para lixeira antes da exclusão permanente"},
  {"type": "improvement", "text": "Limpeza automática de notas expiradas (30 dias)"}
]'::jsonb, '2025-07-15T00:00:00Z'),
('1.2.0', 'Changelogs & Versionamento', 'Sistema de changelogs automático com versionamento sincronizado.', 'update', '[
  {"type": "feature", "text": "Página de changelogs com histórico completo"},
  {"type": "feature", "text": "Versão dinâmica sincronizada com changelogs"},
  {"type": "feature", "text": "Categorização de mudanças: features, melhorias, correções"},
  {"type": "improvement", "text": "Acesso rápido ao changelog via Configurações > Sobre"}
]'::jsonb, now());
