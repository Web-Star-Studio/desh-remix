# 🔒 REGRAS DE SEGURANÇA INVIOLÁVEIS — DESH v3

> **ATENÇÃO**: Este documento define 7 REGRAS INVIOLÁVEIS que devem ser respeitadas em TODA implementação futura neste projeto. Estas regras existem para prevenir vazamento de dados entre workspaces, hallucination da IA, e falhas de segurança.

---

## REGRA 1 — WORKSPACE COMO NAMESPACE ABSOLUTO

TODA query ao Supabase que acessa dados do usuário DEVE incluir `workspace_id` como filtro.

**ERRADO:**
```typescript
const { data } = await supabase
  .from('notes')
  .select('*')
  .eq('user_id', userId);
```

**CORRETO:**
```typescript
const { data } = await supabase
  .from('notes')
  .select('*')
  .eq('user_id', userId)
  .eq('workspace_id', workspaceId);
```

**EXCEÇÕES** (tabelas que NÃO são workspace-scoped):
- `profiles`
- `user_roles`
- `user_workspace_preferences`
- `credit_transactions` / `credit_packages`
- `billing_preferences`
- `notification_tokens`
- `pandora_wa_audit_log`

TUDO o resto é workspace-scoped. Se uma tabela não tem coluna `workspace_id`, ADICIONE antes de usar.

Para TanStack Query, TODA query key DEVE incluir `workspaceId`:

**ERRADO:**
```typescript
useQuery({ queryKey: ['emails'], queryFn: ... })
```

**CORRETO:**
```typescript
useQuery({ queryKey: ['emails', workspaceId], queryFn: ... })
```

Para Composio entity ID, SEMPRE usar workspace ativo:
```typescript
entityId: `${userId}_${workspaceId}`  // NUNCA omitir workspaceId
```

---

## REGRA 2 — CONVERSAS SÃO WORKSPACE-SCOPED

Cada conversa com a Pandora pertence a UM workspace.

- Trocar workspace = nova conversa automaticamente
- A conversa anterior fica associada ao workspace anterior
- O histórico de mensagens NUNCA cruza workspaces
- A tabela `ai_conversations` DEVE ter `workspace_id`

Ao trocar workspace no frontend:
1. Salvar conversa atual
2. Buscar ou criar nova conversa no workspace novo
3. Limpar histórico de mensagens da UI
4. Recarregar contexto da Pandora

NUNCA manter a mesma conversa ao trocar workspace. Isso previne contaminação de histórico.

---

## REGRA 3 — PROMPT AUDITÁVEL

TODA mensagem processada pela Pandora (chat, MCP, WhatsApp) DEVE salvar o system prompt completo que foi usado.

Adicione ao `pandora_tool_calls` ou crie coluna em `ai_messages`:
```sql
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS system_prompt_used TEXT;
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS agent_id UUID;
```

Quando a Pandora processa uma mensagem:
```typescript
// Salvar junto com a resposta:
await supabase.from('ai_messages').insert({
  conversation_id,
  role: 'assistant',
  content: response,
  system_prompt_used: fullSystemPrompt, // O PROMPT COMPLETO montado
  workspace_id: activeWorkspaceId,
  agent_id: activeAgentId,
  tokens_used: tokenCount,
});
```

Isso permite:
- Debugar quando a Pandora erra
- Auditar que dados de qual workspace foram injetados
- Verificar que skills/docs corretos foram usados

---

## REGRA 4 — SKILLS SÃO LAZY-LOADED

Skills NÃO são injetados em toda mensagem. Apenas quando relevantes.

Na v3.0, usar keyword matching simples:
```typescript
function shouldInjectSkill(skill: Skill, userMessage: string): boolean {
  if (!skill.trigger_description) return false;
  
  // Extrair palavras-chave do trigger
  const triggerWords = skill.trigger_description
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3); // ignorar palavras curtas
  
  const messageLower = userMessage.toLowerCase();
  
  // Precisa ter pelo menos 2 palavras-chave presentes
  const matches = triggerWords.filter(w => messageLower.includes(w));
  return matches.length >= 2;
}
```

Se ZERO skills são relevantes para a mensagem, ZERO skills são injetados no prompt.
Isso mantém o prompt enxuto e reduz hallucination.

---

## REGRA 5 — MODO TODOS É READ-ONLY NA v3.0

Quando o usuário está no modo "Todos" (visão agregada de workspaces):

**PERMITIDO:**
- Ver dados de todos os workspaces (dashboard, inbox, métricas)
- Perguntar informações: "quantos emails não lidos tenho?"
- Buscar em todos os workspaces: "buscar contato João"

**NÃO PERMITIDO (na v3.0):**
- Executar ações: "enviar email", "criar tarefa", "criar evento"
- Se o usuário tentar, a Pandora responde:
  > "Para executar ações, selecione um workspace específico ou use @workspace. Exemplo: @wss criar tarefa..."

**EXCEÇÃO:** se o usuário usar `@workspace` explicitamente no modo TODOS:
- `@rankey criar tarefa X` → permitido, executa no workspace Rankey
- A Pandora confirma: "✅ Tarefa criada no workspace Rankey"

Isso elimina 100% do risco de ação no workspace errado por ambiguidade.

---

## REGRA 6 — BUDGET DE TOKENS POR CONTEXTO

O system prompt total tem budget máximo de **8000 tokens** distribuído assim:

| Seção                      | Budget | Prioridade       | Corte                    |
|----------------------------|--------|------------------|--------------------------|
| Identidade base Pandora    | 500    | 1 (nunca cortar) | -                        |
| Agente ativo (prompt)      | 1000   | 2 (nunca cortar) | -                        |
| Contexto do workspace      | 500    | 3                | truncar                  |
| Personal context (perfil)  | 300    | 4                | truncar                  |
| Documentos de contexto     | 2000   | 5                | remover menos relevantes |
| Skills (apenas relevantes) | 1500   | 6                | remover menos relevantes |
| Memórias                   | 1000   | 7                | remover mais antigas     |
| Lista de workspaces (TODOS)| 500    | 8                | truncar descrições       |
| Sessão + tools list        | 700    | 9                | -                        |

Função de estimativa: ~4 caracteres = 1 token

Implementar `trimContextToFit()` que:
1. Monta todas as seções
2. Estima tokens de cada uma
3. Se total > 8000, corta na ordem reversa de prioridade (8 → 7 → 6 → 5)
4. NUNCA corta prioridade 1 e 2

---

## REGRA 7 — TESTE DE ISOLAMENTO

Antes de considerar qualquer feature de multi-workspace como "pronta", verificar manualmente:

### TESTE A — Isolamento de dados
1. Criar Workspace A com nota "Segredo A"
2. Criar Workspace B com nota "Segredo B"
3. No Workspace B, buscar notas → "Segredo A" NÃO deve aparecer
4. No chat Pandora do Workspace B, perguntar "quais notas tenho?" → "Segredo A" NÃO deve aparecer

### TESTE B — Isolamento de Composio
1. Workspace A conectado ao Gmail pessoal
2. Workspace B conectado ao Gmail corporativo
3. No Workspace A, listar emails → apenas emails pessoais
4. Trocar para Workspace B → apenas emails corporativos
5. Verificar entity IDs nos logs de `composio_action_logs`

### TESTE C — Isolamento de conversas
1. No Workspace A, conversar com Pandora sobre "dados financeiros A"
2. Trocar para Workspace B
3. A conversa anterior NÃO deve estar visível
4. Perguntar "o que conversamos?" → Pandora NÃO deve saber sobre "dados financeiros A"

### TESTE D — Isolamento no WhatsApp
1. Via WhatsApp, enviar "/ws" para ver workspaces
2. Enviar "/ws 1" (Workspace A)
3. Perguntar algo que só existe no Workspace B
4. Pandora NÃO deve ter acesso a dados do Workspace B

**Se QUALQUER teste falhar, a feature NÃO está pronta.**

---

> ⚠️ Estas 7 regras devem ser tratadas como **invioláveis**. Nenhum prompt futuro pode contradizê-las. Se uma implementação solicitada conflitar com estas regras, **a regra prevalece**.
