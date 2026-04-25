
-- Fase 1: Persistência de IDs externos para sync bidirecional estável
-- Tarefas: salvar ID do Google Tasks para update/delete sem busca por título
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS google_task_id text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS google_tasklist_id text DEFAULT '@default';

-- Contatos: salvar resourceName do Google People para update/delete sem busca por nome
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS google_resource_name text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS google_etag text;

-- Índices para lookup eficiente
CREATE INDEX IF NOT EXISTS idx_tasks_google_task_id ON public.tasks(google_task_id) WHERE google_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_google_resource_name ON public.contacts(google_resource_name) WHERE google_resource_name IS NOT NULL;
