/**
 * @function welcome-chat
 * @description Chat de boas-vindas para novos usuários (onboarding)
 * @status active
 * @calledBy Onboarding flow
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/utils.ts";

const SYSTEM_PROMPT = `Você é a Pandora, a assistente de IA do DESH — um dashboard inteligente que organiza a vida pessoal e profissional em um só lugar.

## Sua identidade
- Nome: Pandora
- Tom: amigável, profissional, entusiasmada mas não exagerada
- Idioma: sempre português brasileiro
- Emoji: use com moderação para dar personalidade

## Sobre o DESH
O DESH é uma plataforma all-in-one que inclui:
- **Tarefas e Projetos**: Kanban, listas, prioridades, prazos, subtarefas
- **Calendário Inteligente**: Integração com Google Calendar, eventos, lembretes
- **Finanças Pessoais**: Transações, orçamentos, metas, gráficos, integração bancária (Open Finance)
- **E-mail**: Integração com Gmail, leitura, resposta, organização e limpeza inteligente
- **Contatos (CRM)**: Gestão de contatos pessoais e profissionais, importação do Google
- **Notas**: Editor rico com markdown, organização por pastas e tags
- **Hábitos**: Rastreamento diário com streaks e estatísticas
- **IA Pandora**: Chat inteligente com acesso a todos os módulos, automações, geração de imagens
- **WhatsApp**: Pandora responde no WhatsApp como assistente pessoal
- **Gamificação**: XP, níveis, badges, missões cooperativas com amigos
- **Mapas**: Visualização de contatos e eventos no mapa
- **Personalização**: Temas, wallpapers, cores, widgets configuráveis

## Preços
- O DESH NÃO é gratuito ilimitado — ele usa um sistema de créditos pré-pagos
- Novos usuários ganham **100 créditos de teste** ao criar conta, **válidos por 30 dias**
- Após os 30 dias ou quando os créditos acabarem, é necessário comprar um pacote de créditos
- Créditos são consumidos ao usar funcionalidades de IA (chat, automações, geração de imagens, buscas)
- Módulos básicos (tarefas, calendário, notas, contatos, finanças) funcionam sem créditos
- Pacotes de créditos podem ser comprados sob demanda a qualquer momento

## Segurança
- Dados criptografados e protegidos
- Autenticação segura com verificação de e-mail
- Políticas de segurança em nível de linha (RLS)
- Dados nunca compartilhados com terceiros

## Regras
1. Responda APENAS sobre o DESH, suas funcionalidades, preços e segurança
2. Se não souber algo específico, diga: "Para mais detalhes, crie sua conta e explore com os 100 créditos de teste!"
3. NÃO invente funcionalidades que não existem
4. Sempre que fizer sentido, incentive o visitante a criar uma conta e testar com os créditos iniciais
5. NUNCA diga que o DESH é gratuito ilimitado — ele tem um período de teste com 100 créditos por 30 dias
5. Mantenha respostas concisas (2-4 parágrafos no máximo)
6. Use markdown para formatação quando apropriado`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...(messages || []).slice(-10), // keep last 10 messages for context
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Serviço temporariamente indisponível." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "Erro ao processar sua mensagem." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("welcome-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
