/**
 * @function demo-seed
 * @description Seed de dados demo para onboarding
 * @status active
 * @calledBy Onboarding flow
 */
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { corsHeaders } from "../_shared/utils.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authErr } = await userClient.auth.getClaims(token);
    if (authErr || !claimsData?.claims) return json({ error: "Invalid token" }, 401);
    const userId = claimsData.claims.sub;

    // Service client for seeding
    const admin = createClient(supabaseUrl, serviceKey);

    const { action, workspaceId } = await req.json();

    if (action === "activate") {
      // Create demo workspace
      const { data: ws, error: wsErr } = await admin
        .from("workspaces")
        .insert({
          user_id: userId,
          name: "Demo",
          icon: "🎮",
          color: "hsl(45, 90%, 50%)",
          is_default: false,
          sort_order: 99,
        })
        .select("id")
        .single();

      if (wsErr) return json({ error: "Failed to create workspace", detail: wsErr.message }, 500);
      const wId = ws.id;

      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      const d = now.getDate();
      function dateStr(offset: number) {
        return new Date(y, m, d + offset).toISOString().split("T")[0];
      }

      // ── Tasks ──
      const tasks = [
        { user_id: userId, workspace_id: wId, title: "Revisar proposta comercial", status: "todo", priority: "high", due_date: dateStr(1), description: "Revisar a proposta antes de enviar ao cliente" },
        { user_id: userId, workspace_id: wId, title: "Enviar relatório mensal", status: "todo", priority: "high", due_date: dateStr(2), description: "Relatório de métricas do mês" },
        { user_id: userId, workspace_id: wId, title: "Reunião com equipe de marketing", status: "done", priority: "medium", due_date: dateStr(-1), description: "Alinhar campanhas Q2" },
        { user_id: userId, workspace_id: wId, title: "Atualizar planilha de OKRs", status: "todo", priority: "medium", due_date: dateStr(3), description: "Atualizar progresso dos OKRs do trimestre" },
        { user_id: userId, workspace_id: wId, title: "Ligar para fornecedor", status: "done", priority: "low", description: "Negociar condições de contrato" },
        { user_id: userId, workspace_id: wId, title: "Preparar apresentação Q1", status: "todo", priority: "high", due_date: dateStr(5), description: "Slide deck para a reunião do board" },
        { user_id: userId, workspace_id: wId, title: "Responder e-mails pendentes", status: "done", priority: "medium", description: "Inbox zero!" },
        { user_id: userId, workspace_id: wId, title: "Organizar arquivos do projeto", status: "todo", priority: "low", due_date: dateStr(7), description: "Limpar pastas do Drive" },
      ];

      // ── Contacts ──
      const contacts = [
        { user_id: userId, workspace_id: wId, name: "Carlos Mendes", email: "carlos@empresa.com", phone: "(11) 98765-4321", company: "TechCorp", role: "CEO", tags: ["cliente", "vip"] },
        { user_id: userId, workspace_id: wId, name: "Fernanda Silva", email: "fernanda@startup.io", phone: "(21) 99876-5432", company: "StartupIO", role: "CTO", tags: ["parceiro"] },
        { user_id: userId, workspace_id: wId, name: "Pedro Almeida", email: "pedro@tech.com", phone: "(31) 97654-3210", company: "DevHouse", role: "Desenvolvedor", tags: ["tech"] },
        { user_id: userId, workspace_id: wId, name: "Ana Rodrigues", email: "ana@design.co", phone: "(41) 96543-2109", company: "DesignCo", role: "Designer Lead", tags: ["design"] },
        { user_id: userId, workspace_id: wId, name: "Lucas Oliveira", email: "lucas@consulting.com", phone: "(11) 95432-1098", company: "ConsultPro", role: "Consultor", tags: ["consultor"] },
        { user_id: userId, workspace_id: wId, name: "Mariana Santos", email: "mariana@agency.com", phone: "(21) 94321-0987", company: "AgencyMKT", role: "Account Manager", tags: ["marketing"] },
        { user_id: userId, workspace_id: wId, name: "Rafael Souza", email: "rafael@finance.com", phone: "(11) 93210-9876", company: "FinanceBank", role: "Analista", tags: ["finanças"] },
        { user_id: userId, workspace_id: wId, name: "Juliana Lima", email: "juliana@law.com", phone: "(31) 92109-8765", company: "JusLaw", role: "Advogada", tags: ["jurídico"] },
        { user_id: userId, workspace_id: wId, name: "Thiago Pereira", email: "thiago@dev.io", phone: "(41) 91098-7654", company: "CodeLab", role: "Tech Lead", tags: ["tech"] },
        { user_id: userId, workspace_id: wId, name: "Camila Ferreira", email: "camila@mkt.com", phone: "(11) 90987-6543", company: "GrowthCo", role: "Growth Hacker", tags: ["marketing"] },
      ];

      // ── Finance Transactions ──
      const transactions = [
        { user_id: userId, workspace_id: wId, description: "Salário", type: "income", amount: 12000, category: "Salário", date: dateStr(-5) },
        { user_id: userId, workspace_id: wId, description: "Aluguel", type: "expense", amount: 3200, category: "Moradia", date: dateStr(-3) },
        { user_id: userId, workspace_id: wId, description: "Supermercado", type: "expense", amount: 850, category: "Alimentação", date: dateStr(-2) },
        { user_id: userId, workspace_id: wId, description: "Uber", type: "expense", amount: 145, category: "Transporte", date: dateStr(-1) },
        { user_id: userId, workspace_id: wId, description: "Netflix", type: "expense", amount: 55.90, category: "Assinaturas", date: dateStr(-4) },
        { user_id: userId, workspace_id: wId, description: "Freelance Design", type: "income", amount: 3500, category: "Freelance", date: dateStr(-6) },
        { user_id: userId, workspace_id: wId, description: "Academia", type: "expense", amount: 120, category: "Saúde", date: dateStr(-7) },
        { user_id: userId, workspace_id: wId, description: "Restaurante", type: "expense", amount: 230, category: "Alimentação", date: dateStr(-1) },
        { user_id: userId, workspace_id: wId, description: "Farmácia", type: "expense", amount: 89, category: "Saúde", date: dateStr(-2) },
        { user_id: userId, workspace_id: wId, description: "Investimento CDB", type: "expense", amount: 2000, category: "Investimentos", date: dateStr(-8) },
        { user_id: userId, workspace_id: wId, description: "Dividendos PETR4", type: "income", amount: 450, category: "Investimentos", date: dateStr(-10) },
        { user_id: userId, workspace_id: wId, description: "Internet", type: "expense", amount: 130, category: "Assinaturas", date: dateStr(-5) },
        { user_id: userId, workspace_id: wId, description: "Energia elétrica", type: "expense", amount: 280, category: "Moradia", date: dateStr(-4) },
        { user_id: userId, workspace_id: wId, description: "Presente aniversário", type: "expense", amount: 180, category: "Outros", date: dateStr(-3) },
        { user_id: userId, workspace_id: wId, description: "Consultoria extra", type: "income", amount: 2200, category: "Freelance", date: dateStr(-12) },
      ];

      // ── Finance Goals ──
      const goals = [
        { user_id: userId, workspace_id: wId, name: "Fundo de emergência", target: 30000, current: 18500, color: "hsl(220, 80%, 50%)" },
        { user_id: userId, workspace_id: wId, name: "Viagem Europa", target: 15000, current: 6200, color: "hsl(45, 90%, 50%)" },
      ];

      // ── Notes (user_data) — individual rows with data_type "note" ──
      const noteRows = [
        { title: "Ideias para o projeto Q1", content: "<p>Focar em automação de processos. Considerar integração com IA para atendimento. Benchmark: Notion, Linear.</p>", pinned: true, color: "border-l-primary" },
        { title: "Anotações da reunião de segunda", content: "<p>Time concordou em priorizar mobile. Deadline: 15/03. Budget aprovado.</p>", pinned: false, color: "border-l-blue-400" },
        { title: "Lista de leitura", content: "<p>Atomic Habits, Deep Work, The Lean Startup, Thinking Fast and Slow</p>", pinned: false, color: "border-l-yellow-400" },
        { title: "Metas pessoais 2026", content: "<p>1. Ler 24 livros</p><p>2. Correr meia maratona</p><p>3. Economizar R$30k</p><p>4. Aprender espanhol</p>", pinned: true, color: "border-l-emerald-400" },
        { title: "Receita de bolo de cenoura", content: "<p>3 cenouras, 3 ovos, 2 xícaras de açúcar, 1 xícara de óleo, 2 xícaras de farinha, 1 colher de fermento.</p>", pinned: false, color: "border-l-orange-400" },
      ].map((n) => ({
        user_id: userId,
        workspace_id: wId,
        data_type: "note",
        data: { ...n, tags: [], favorited: false, deleted_at: null },
      }));

      // ── Calendar Events (user_data) — individual rows with data_type "event" ──
      const calendarEventDefs = [
        { day: d, label: "08:30 - Reunião de alinhamento semanal", color: "bg-blue-500", month: m, year: y, category: "trabalho", recurrence: "none" },
        { day: d, label: "10:00 - Revisar proposta comercial TechCorp", color: "bg-blue-500", month: m, year: y, category: "trabalho", recurrence: "none" },
        { day: d, label: "12:30 - Almoço com Carlos Mendes", color: "bg-emerald-500", month: m, year: y, category: "pessoal", recurrence: "none" },
        { day: d, label: "15:00 - Review de sprint da equipe", color: "bg-blue-500", month: m, year: y, category: "trabalho", recurrence: "none" },
        { day: d, label: "18:00 - Treino funcional", color: "bg-rose-500", month: m, year: y, category: "saúde", recurrence: "none" },
        { day: d + 1, label: "09:00 - Dentista — Dr. Ferreira", color: "bg-rose-500", month: m, year: y, category: "saúde", recurrence: "none" },
        { day: d + 1, label: "14:00 - Workshop de IA generativa", color: "bg-amber-500", month: m, year: y, category: "educação", recurrence: "none" },
        { day: d + 1, label: "19:30 - Jantar em família", color: "bg-emerald-500", month: m, year: y, category: "pessoal", recurrence: "none" },
        { day: d + 2, label: "07:00 - Pilates", color: "bg-rose-500", month: m, year: y, category: "saúde", recurrence: "none" },
        { day: d + 2, label: "11:00 - Call com investidor", color: "bg-blue-500", month: m, year: y, category: "trabalho", recurrence: "none" },
        { day: d + 2, label: "16:00 - Reunião do conselho", color: "bg-blue-500", month: m, year: y, category: "trabalho", recurrence: "none" },
        { day: d + 3, label: "Aniversário da Ana Rodrigues", color: "bg-violet-500", month: m, year: y, category: "pessoal", recurrence: "none" },
        { day: d + 3, label: "20:00 - Cinema com amigos", color: "bg-violet-500", month: m, year: y, category: "lazer", recurrence: "none" },
        { day: d + 5, label: "06:00 - Viagem SP → RJ (voo)", color: "bg-violet-500", month: m, year: y, category: "lazer", recurrence: "none" },
        { day: d + 5, label: "14:00 - Apresentação para cliente RJ", color: "bg-blue-500", month: m, year: y, category: "trabalho", recurrence: "none" },
        { day: d + 7, label: "09:00 - Hackathon interno", color: "bg-amber-500", month: m, year: y, category: "educação", recurrence: "none" },
        { day: d + 7, label: "13:00 - Aula de espanhol", color: "bg-amber-500", month: m, year: y, category: "educação", recurrence: "none" },
        { day: d - 1, label: "18:00 - Entrega do relatório mensal", color: "bg-blue-500", month: m, year: y, category: "trabalho", recurrence: "none" },
        { day: d - 2, label: "10:00 - Sessão de coaching", color: "bg-amber-500", month: m, year: y, category: "educação", recurrence: "none" },
        { day: d - 2, label: "15:00 - Corrida no parque", color: "bg-rose-500", month: m, year: y, category: "saúde", recurrence: "none" },
      ].map((e) => ({
        user_id: userId,
        workspace_id: wId,
        data_type: "event",
        data: e,
      }));

      // ── Habits (user_data) ──
      const today = now.toDateString();
      const history: Record<string, string[]> = {};
      for (let i = 6; i >= 0; i--) {
        const dt = new Date(y, m, d - i);
        history[dt.toDateString()] = ["dh1", "dh2", "dh3", "dh4", "dh5"].filter(() => Math.random() > 0.3);
      }
      const habits = {
        user_id: userId,
        workspace_id: wId,
        data_type: "habits",
        data: {
          habits: [
            { id: "dh1", name: "Meditar 10min", streak: 12, completedToday: true, category: "Bem-estar" },
            { id: "dh2", name: "Exercício físico", streak: 8, completedToday: false, category: "Fitness" },
            { id: "dh3", name: "Leitura 30min", streak: 15, completedToday: true, category: "Aprendizado" },
            { id: "dh4", name: "Beber 2L de água", streak: 5, completedToday: false, category: "Saúde" },
            { id: "dh5", name: "Journaling", streak: 3, completedToday: true, category: "Bem-estar" },
          ],
          date: today,
          dailyGoal: 4,
          history,
          reminderEnabled: true,
          reminderTime: "20:00",
          lastNotifiedDate: null,
        },
      };

      // ── Quick Links (user_data) ──
      const quickLinks = {
        user_id: userId,
        workspace_id: wId,
        data_type: "quick_links",
        data: {
          links: [
            { id: "dl1", name: "Google", url: "https://google.com", favicon: "https://www.google.com/s2/favicons?domain=google.com&sz=32", clicks: 24, folder: "Outro" },
            { id: "dl2", name: "Gmail", url: "https://mail.google.com", favicon: "https://www.google.com/s2/favicons?domain=mail.google.com&sz=32", clicks: 18, folder: "Trabalho" },
            { id: "dl3", name: "LinkedIn", url: "https://linkedin.com", favicon: "https://www.google.com/s2/favicons?domain=linkedin.com&sz=32", clicks: 12, folder: "Trabalho", pinned: true },
            { id: "dl4", name: "YouTube", url: "https://youtube.com", favicon: "https://www.google.com/s2/favicons?domain=youtube.com&sz=32", clicks: 30, folder: "Mídia" },
            { id: "dl5", name: "GitHub", url: "https://github.com", favicon: "https://www.google.com/s2/favicons?domain=github.com&sz=32", clicks: 45, folder: "Dev", pinned: true },
            { id: "dl6", name: "Notion", url: "https://notion.so", favicon: "https://www.google.com/s2/favicons?domain=notion.so&sz=32", clicks: 15, folder: "Trabalho" },
          ],
          sortMode: "manual",
        },
      };

      // ── World Clocks (user_data) ──
      const worldClocks = {
        user_id: userId,
        workspace_id: wId,
        data_type: "world_clocks",
        data: [
          { id: "dwc1", city: "São Paulo", timezone: "America/Sao_Paulo", label: "🇧🇷" },
          { id: "dwc2", city: "Nova York", timezone: "America/New_York", label: "🇺🇸" },
          { id: "dwc3", city: "Tóquio", timezone: "Asia/Tokyo", label: "🇯🇵" },
          { id: "dwc4", city: "Londres", timezone: "Europe/London", label: "🇬🇧" },
        ],
      };

      // ── Music Library (user_data) ──
      const musicLibrary = {
        user_id: userId,
        workspace_id: wId,
        data_type: "music_library",
        data: {
          tracks: [
            { id: "dm1", title: "Lofi Hip Hop Radio", artist: "Lofi Girl", source: "youtube", embedUrl: "https://www.youtube.com/embed/jfKfPfyJRdk", thumbnail: "https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg", favorite: true, addedAt: dateStr(-5) },
            { id: "dm2", title: "Jazz Relaxante para Trabalhar", artist: "Café Music BGM", source: "youtube", embedUrl: "https://www.youtube.com/embed/DSGyEsJ17cI", thumbnail: "https://i.ytimg.com/vi/DSGyEsJ17cI/hqdefault.jpg", favorite: false, addedAt: dateStr(-3) },
          ],
          activeTrackId: "dm1",
        },
      };

      const results = await Promise.all([
        admin.from("tasks").insert(tasks),
        admin.from("contacts").insert(contacts),
        admin.from("finance_transactions").insert(transactions),
        admin.from("finance_goals").insert(goals),
        admin.from("user_data").insert(noteRows),
        admin.from("user_data").insert(calendarEventDefs),
        admin.from("user_data").insert(habits),
        admin.from("user_data").insert(quickLinks),
        admin.from("user_data").insert(worldClocks),
        admin.from("user_data").insert(musicLibrary),
      ]);

      const errors = results.filter((r) => r.error).map((r) => r.error!.message);
      if (errors.length > 0) {
        console.error("Demo seed partial errors:", errors);
      }

      // Switch user's active workspace
      await admin.from("profiles").update({ active_workspace_id: wId }).eq("user_id", userId);

      return json({ ok: true, workspaceId: wId });
    }

    if (action === "deactivate") {
      if (!workspaceId) return json({ error: "workspaceId required" }, 400);

      // Delete all data in the demo workspace
      await Promise.all([
        admin.from("tasks").delete().eq("workspace_id", workspaceId).eq("user_id", userId),
        admin.from("contacts").delete().eq("workspace_id", workspaceId).eq("user_id", userId),
        admin.from("finance_transactions").delete().eq("workspace_id", workspaceId).eq("user_id", userId),
        admin.from("finance_goals").delete().eq("workspace_id", workspaceId).eq("user_id", userId),
        admin.from("user_data").delete().eq("workspace_id", workspaceId).eq("user_id", userId),
      ]);

      // Delete the workspace itself
      await admin.from("workspaces").delete().eq("id", workspaceId).eq("user_id", userId);

      // Reset active workspace to null (view all)
      await admin.from("profiles").update({ active_workspace_id: null }).eq("user_id", userId);

      return json({ ok: true });
    }

    return json({ error: "Invalid action. Use 'activate' or 'deactivate'" }, 400);
  } catch (err) {
    console.error("demo-seed error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
