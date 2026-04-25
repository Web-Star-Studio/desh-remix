/**
 * AI Tool Handlers — Navigation, Theme, Memory, Knowledge, Contacts, Automations, Cross-module
 * Extracted from useAIToolExecution for maintainability.
 */
import type { ToolContext } from "./toolContext";

export async function handleSystemTool(name: string, args: Record<string, any>, ctx: ToolContext): Promise<string | null> {
  const { user, supabase, state, navigate, setMode, setColor, setWallpaper, contactsRef, memoriesRef, knowledgeBaseRef, automationsRef, connectionsRef, workspacesRef, workspaceRef, interactionsRef, waConversationsRef, budgetsRef, financeTransactionsRef, financeGoalsRef, habitsRef, filesRef, resolveEmail, resolvePhone, getInsertWorkspaceId, addTask, opts } = ctx;

  switch (name) {
    // === Navigation ===
    case "navigate_to": {
      const pageMap: Record<string, string> = {
        dashboard: "/", home: "/", inicio: "/",
        tarefas: "/tasks", tasks: "/tasks",
        notas: "/notes", notes: "/notes",
        calendario: "/calendar", calendar: "/calendar",
        contatos: "/contacts", contacts: "/contacts",
        financas: "/finances", finances: "/finances", finanças: "/finances",
        arquivos: "/files", files: "/files",
        mensagens: "/messages", messages: "/messages",
        email: "/email", emails: "/email",
        perfil: "/profile", profile: "/profile",
        configuracoes: "/settings", settings: "/settings", configurações: "/settings",
        conexoes: "/integrations", connections: "/integrations", conexões: "/integrations",
        admin: "/admin", widgets: "/widgets",
        busca: "/search", search: "/search",
        ia: "/ai", ai: "/ai",
        automacoes: "/automations", automations: "/automations", automações: "/automations",
        inbox: "/inbox",
      };
      const page = args.page.toLowerCase().trim();
      const route = pageMap[page];
      if (!route) return `[ERRO] Página "${args.page}" não encontrada. Páginas disponíveis: ${Object.keys(pageMap).filter((_, i) => i % 2 === 0).join(", ")}`;
      navigate(route);
      return `[OK] Navegando para ${args.page}.`;
    }

    // === Theme ===
    case "set_theme":
      if (args.mode) setMode(args.mode);
      if (args.color) setColor(args.color);
      return `[OK] Tema atualizado${args.mode ? ` (modo: ${args.mode})` : ""}${args.color ? ` (cor: ${args.color})` : ""}.`;
    case "set_wallpaper":
      setWallpaper(args.wallpaper_id);
      return `[OK] Wallpaper alterado para "${args.wallpaper_id}".`;

    // === Memory ===
    case "save_memory": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const { error } = await supabase.from("ai_memories").insert({ user_id: user.id, content: args.content, category: args.category || "general", importance: args.importance || "medium" });
      if (error) return `[ERRO] Falha ao salvar memória: ${error.message}`;
      memoriesRef.current = [...memoriesRef.current, { id: crypto.randomUUID(), content: args.content, category: args.category || "general", importance: args.importance || "medium" }];
      return `[OK] Memória salva: "${args.content.substring(0, 50)}..."`;
    }
    case "get_memories":
      if (memoriesRef.current.length === 0) return "Nenhuma memória salva.";
      return `Memórias (${memoriesRef.current.length}):\n${memoriesRef.current.map((m: any) => `- [${m.importance}] ${m.content} (${m.category})`).join("\n")}`;
    case "delete_memory": {
      const mem = memoriesRef.current.find((m: any) => m.content.toLowerCase().includes(args.memory_identifier.toLowerCase()) || m.id === args.memory_identifier);
      if (!mem) return `[ERRO] Memória "${args.memory_identifier}" não encontrada.`;
      const { error } = await supabase.from("ai_memories").delete().eq("id", mem.id);
      if (error) return `[ERRO] Falha ao excluir memória: ${error.message}`;
      memoriesRef.current = memoriesRef.current.filter((m: any) => m.id !== mem.id);
      return `[OK] Memória excluída.`;
    }

    // === Knowledge Base ===
    case "add_knowledge": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const { data: inserted, error } = await supabase.from("ai_knowledge_base" as any).insert({ user_id: user.id, title: args.title, content: args.content, category: args.category || "general", tags: args.tags || [] } as any).select("id,title,content,category,tags").single();
      if (error || !inserted) return `[ERRO] Falha ao adicionar conhecimento: ${error?.message || "sem retorno"}`;
      knowledgeBaseRef.current = [...knowledgeBaseRef.current, inserted];
      return `[OK] 📚 Conhecimento "${args.title}" adicionado à base.`;
    }
    case "get_knowledge":
      if (knowledgeBaseRef.current.length === 0) return "Base de conhecimento vazia.";
      return `📚 Base de Conhecimento (${knowledgeBaseRef.current.length}):\n${knowledgeBaseRef.current.map((k: any) => `- **${k.title}** [${k.category}] ${k.tags?.length ? `🏷️${k.tags.join(",")}` : ""}`).join("\n")}`;
    case "search_knowledge": {
      const q = args.query.toLowerCase();
      const results = knowledgeBaseRef.current.filter((k: any) => k.title?.toLowerCase().includes(q) || k.content?.toLowerCase().includes(q) || k.tags?.some((t: string) => t.toLowerCase().includes(q)));
      if (results.length === 0) return `Nenhum conhecimento encontrado para "${args.query}".`;
      return `📚 Resultados (${results.length}):\n${results.map((k: any) => `- **${k.title}**: ${(k.content || "").substring(0, 100)}...`).join("\n")}`;
    }
    case "delete_knowledge": {
      const item = knowledgeBaseRef.current.find((k: any) => k.title?.toLowerCase().includes(args.knowledge_identifier.toLowerCase()) || k.id === args.knowledge_identifier);
      if (!item) return `[ERRO] Conhecimento "${args.knowledge_identifier}" não encontrado.`;
      const { error } = await supabase.from("ai_knowledge_base" as any).delete().eq("id", item.id);
      if (error) return `[ERRO] Falha ao excluir: ${error.message}`;
      knowledgeBaseRef.current = knowledgeBaseRef.current.filter((k: any) => k.id !== item.id);
      return `[OK] 📚 Conhecimento "${item.title}" excluído.`;
    }

    // === Automations ===
    case "get_automations":
      if (automationsRef.current.length === 0) return "Nenhuma automação encontrada.";
      return `⚡ Automações (${automationsRef.current.length}):\n${automationsRef.current.map((a: any) => `- ${a.enabled ? "✅" : "⏸️"} **${a.name}** (${a.trigger_type} → ${a.action_type}) — ${a.execution_count} execuções`).join("\n")}`;
    case "create_automation": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const { data: inserted, error } = await supabase.from("automation_rules").insert({ user_id: user.id, name: args.name, trigger_type: args.trigger_type, trigger_config: args.trigger_config || {}, action_type: args.action_type, action_config: args.action_config || {} }).select("id,name,trigger_type,action_type,enabled,execution_count").single();
      if (error || !inserted) return `[ERRO] Falha ao criar automação: ${error?.message || "sem retorno"}`;
      automationsRef.current = [...automationsRef.current, inserted];
      return `[OK] ⚡ Automação "${args.name}" criada (${args.trigger_type} → ${args.action_type}).`;
    }
    case "toggle_automation": {
      const auto = automationsRef.current.find((a: any) => a.name?.toLowerCase().includes(args.automation_identifier.toLowerCase()) || a.id === args.automation_identifier);
      if (!auto) return `[ERRO] Automação "${args.automation_identifier}" não encontrada.`;
      const { error } = await supabase.from("automation_rules").update({ enabled: args.enabled }).eq("id", auto.id);
      if (error) return `[ERRO] Falha ao alterar automação: ${error.message}`;
      auto.enabled = args.enabled;
      return `[OK] ⚡ Automação "${auto.name}" ${args.enabled ? "ativada" : "desativada"}.`;
    }
    case "delete_automation": {
      const auto = automationsRef.current.find((a: any) => a.name?.toLowerCase().includes(args.automation_identifier.toLowerCase()) || a.id === args.automation_identifier);
      if (!auto) return `[ERRO] Automação "${args.automation_identifier}" não encontrada.`;
      const { error } = await supabase.from("automation_rules").delete().eq("id", auto.id);
      if (error) return `[ERRO] Falha ao excluir automação: ${error.message}`;
      automationsRef.current = automationsRef.current.filter((a: any) => a.id !== auto.id);
      return `[OK] ⚡ Automação "${auto.name}" excluída.`;
    }

    // === Connections & Workspaces ===
    case "get_connections":
      if (connectionsRef.current.length === 0) return "Nenhuma conexão encontrada.";
      return `🔗 Conexões (${connectionsRef.current.length}):\n${connectionsRef.current.map((c: any) => `- **${c.name}** (${c.platform}) — ${c.status}`).join("\n")}`;
    case "get_workspaces":
      if (workspacesRef.current.length === 0) return "Nenhum workspace encontrado.";
      return `🏢 Workspaces (${workspacesRef.current.length}):\n${workspacesRef.current.map((w: any) => `- ${w.icon} **${w.name}**${w.is_default ? " (ativo)" : ""}`).join("\n")}`;
    case "switch_workspace": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const ws = workspacesRef.current.find((w: any) => w.name?.toLowerCase().includes(args.workspace_identifier.toLowerCase()) || w.id === args.workspace_identifier);
      if (!ws) return `[ERRO] Workspace "${args.workspace_identifier}" não encontrado.`;
      const { error } = await supabase.from("profiles").update({ active_workspace_id: ws.id }).eq("user_id", user.id);
      if (error) return `[ERRO] Falha ao trocar workspace: ${error.message}`;
      workspaceRef.current.name = ws.name;
      return `[OK] 🏢 Workspace ativo alterado para "${ws.name}". Recarregue para aplicar.`;
    }

    // === Contacts ===
    case "add_contact": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const wsId = getInsertWorkspaceId();
      const { data: inserted, error } = await supabase.from("contacts").insert({
        user_id: user.id, name: args.name, email: args.email || null, phone: args.phone || null, company: args.company || null, role: args.role || null,
        ...(wsId ? { workspace_id: wsId } : {}),
      }).select("id,name,email,phone,company,role").single();
      if (error || !inserted) return `[ERRO] Falha ao criar contato: ${error?.message || "sem retorno"}`;
      contactsRef.current = [...contactsRef.current, inserted];
      return `[OK] Contato "${args.name}" criado.`;
    }
    case "edit_contact": {
      const contact = contactsRef.current.find((c: any) => c.name.toLowerCase().includes(args.contact_identifier.toLowerCase()) || c.id === args.contact_identifier);
      if (!contact) return `[ERRO] Contato "${args.contact_identifier}" não encontrado.`;
      const updates: Record<string, any> = {};
      if (args.new_name) updates.name = args.new_name;
      if (args.new_email) updates.email = args.new_email;
      if (args.new_phone) updates.phone = args.new_phone;
      if (args.new_company) updates.company = args.new_company;
      if (args.new_role) updates.role = args.new_role;
      const { error } = await supabase.from("contacts").update(updates).eq("id", contact.id);
      if (error) return `[ERRO] Falha ao editar contato: ${error.message}`;
      Object.assign(contact, updates);
      return `[OK] Contato "${contact.name}" atualizado.`;
    }
    case "delete_contact": {
      const contact = contactsRef.current.find((c: any) => c.name.toLowerCase().includes(args.contact_identifier.toLowerCase()) || c.id === args.contact_identifier);
      if (!contact) return `[ERRO] Contato "${args.contact_identifier}" não encontrado.`;
      const { error } = await supabase.from("contacts").delete().eq("id", contact.id);
      if (error) return `[ERRO] Falha ao excluir contato: ${error.message}`;
      contactsRef.current = contactsRef.current.filter((c: any) => c.id !== contact.id);
      return `[OK] Contato "${contact.name}" excluído.`;
    }
    case "search_contacts": {
      if (!user) return "Usuário não autenticado.";
      const q = args.query.toLowerCase();
      const { data: dbResults } = await supabase.from("contacts").select("id,name,email,phone,company,role,tags").eq("user_id", user.id).or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,company.ilike.%${q}%,role.ilike.%${q}%`).limit(15);
      const results = dbResults || [];
      if (results.length === 0) return `Nenhum contato encontrado para "${args.query}".`;
      return `Contatos encontrados (${results.length}):\n${results.map((c: any) => `- **${c.name}** ${c.email ? `(${c.email})` : ""} ${c.phone ? `📞${c.phone}` : ""} ${c.company ? `- ${c.company}` : ""} ${c.role ? `[${c.role}]` : ""} ${c.tags?.length ? `🏷️${c.tags.join(", ")}` : ""}`).join("\n")}`;
    }
    case "get_contacts":
      if (contactsRef.current.length === 0) return "Nenhum contato encontrado.";
      return `Contatos (${contactsRef.current.length}):\n${contactsRef.current.map((c: any) => `- **${c.name}** ${c.email ? `(${c.email})` : ""} ${c.phone ? `📞${c.phone}` : ""} ${c.company ? `- ${c.company}` : ""} ${c.role ? `[${c.role}]` : ""} ${c.tags?.length ? `🏷️${c.tags.join(", ")}` : ""}`).join("\n")}`;

    // === Contact Details & CRM ===
    case "get_contact_details": {
      if (!user) return "Usuário não autenticado.";
      let contact = contactsRef.current.find((c: any) => c.name?.toLowerCase().includes(args.contact_identifier.toLowerCase()) || c.id === args.contact_identifier);
      if (!contact) { const { data } = await supabase.from("contacts").select("id,name,email,phone,company,role,tags,notes,birthday,created_at,avatar_url,phones,emails,addresses,social_links,website,company_industry").eq("user_id", user.id).ilike("name", `%${args.contact_identifier}%`).limit(1); if (data?.length) contact = data[0]; }
      if (!contact) return `Contato "${args.contact_identifier}" não encontrado.`;
      const { data: fullContact } = await supabase.from("contacts").select("*").eq("id", contact.id).single();
      const { data: interactions } = await supabase.from("contact_interactions").select("title,type,description,interaction_date").eq("contact_id", contact.id).order("interaction_date", { ascending: false }).limit(10);
      const phone = (resolvePhone(fullContact || contact) || "").replace(/\D/g, "");
      let waInfo = "Nenhuma conversa WhatsApp encontrada";
      if (phone && phone.length >= 8) {
        const { data: waConvos } = await supabase.from("whatsapp_conversations").select("title,last_message_at,unread_count").eq("user_id", user.id).ilike("external_contact_id", `%${phone.slice(-8)}%`).limit(3);
        if (waConvos?.length) waInfo = waConvos.map((c: any) => `${c.title || "Conversa"} — último msg: ${new Date(c.last_message_at).toLocaleDateString("pt-BR")}${c.unread_count > 0 ? ` (${c.unread_count} não lidas)` : ""}`).join("; ");
      }
      const fc = fullContact || contact;
      const resolvedEmailAddr = resolveEmail(fc);
      const resolvedPhoneNum = resolvePhone(fc);
      let result = `👤 **${fc.name}** — Detalhes completos\n`;
      if (resolvedEmailAddr) result += `📧 Email: ${resolvedEmailAddr}\n`;
      if (resolvedPhoneNum) result += `📞 Telefone: ${resolvedPhoneNum}\n`;
      if (fc.company) { result += `🏢 Empresa: ${fc.company}`; if (fc.role) result += ` (${fc.role})`; result += "\n"; }
      if (fc.tags?.length) result += `🏷️ Tags: ${fc.tags.join(", ")}\n`;
      if (fc.birthday) result += `🎂 Aniversário: ${fc.birthday}\n`;
      if (fc.notes) result += `📝 Notas: ${fc.notes}\n`;
      if (fc.website) result += `🌐 Website: ${fc.website}\n`;
      result += `📱 WhatsApp: ${waInfo}\n📅 Criado em: ${new Date(fc.created_at).toLocaleDateString("pt-BR")}\n`;
      if (interactions?.length) { result += `\n📋 **Últimas interações** (${interactions.length}):\n`; const typeEmoji: Record<string, string> = { meeting: "🤝", call: "📞", email: "📧", note: "📝", whatsapp: "📱", other: "📋" }; result += interactions.map((i: any) => `- ${typeEmoji[i.type] || "📋"} ${i.title} — ${new Date(i.interaction_date).toLocaleDateString("pt-BR")}`).join("\n"); }
      else result += "\n📋 Nenhuma interação registrada.";
      return result;
    }
    case "smart_find_contact": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const q = args.query.toLowerCase();
      const { data: results } = await supabase.from("contacts").select("id,name,email,phone,emails,phones,company,role,tags").eq("user_id", user.id).or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,company.ilike.%${q}%,role.ilike.%${q}%`).limit(10);
      if (!results?.length) return `Nenhum contato encontrado para "${args.query}".`;
      const waConvos = waConversationsRef.current;
      const enriched = results.map((c: any) => { const cPhone = (resolvePhone(c) || "").replace(/\D/g, ""); const hasWhatsapp = cPhone.length >= 8 && waConvos.some((wc: any) => wc.external_contact_id?.includes(cPhone.slice(-8))); return { ...c, resolved_email: resolveEmail(c), resolved_phone: resolvePhone(c), has_whatsapp: hasWhatsapp }; });
      return `🔍 Contatos encontrados (${enriched.length}):\n${enriched.map((c: any) => `- **${c.name}** ${c.resolved_email ? `(${c.resolved_email})` : ""} ${c.resolved_phone ? `📞${c.resolved_phone}` : ""} ${c.company ? `- ${c.company}` : ""} ${c.role ? `[${c.role}]` : ""} ${c.tags?.length ? `🏷️${c.tags.join(",")}` : ""} ${c.has_whatsapp ? "📱WhatsApp" : ""}`).join("\n")}`;
    }
    case "update_contact_tags": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      let contact = contactsRef.current.find((c: any) => c.name?.toLowerCase().includes(args.contact_identifier.toLowerCase()) || c.id === args.contact_identifier);
      if (!contact) { const { data } = await supabase.from("contacts").select("id,name,tags").eq("user_id", user.id).ilike("name", `%${args.contact_identifier}%`).limit(1); if (data?.length) contact = data[0]; }
      if (!contact) return `[ERRO] Contato "${args.contact_identifier}" não encontrado.`;
      const mode = args.mode || "replace";
      let newTags: string[];
      const currentTags: string[] = contact.tags || [];
      if (mode === "add") newTags = [...new Set([...currentTags, ...args.tags])];
      else if (mode === "remove") newTags = currentTags.filter((t: string) => !args.tags.includes(t));
      else newTags = args.tags;
      const { error } = await supabase.from("contacts").update({ tags: newTags }).eq("id", contact.id);
      if (error) return `[ERRO] Falha ao atualizar tags: ${error.message}`;
      const idx = contactsRef.current.findIndex((c: any) => c.id === contact.id);
      if (idx >= 0) contactsRef.current[idx] = { ...contactsRef.current[idx], tags: newTags };
      return `[OK] 🏷️ Tags de "${contact.name}" atualizadas: ${newTags.join(", ") || "(nenhuma)"}`;
    }
    case "add_contact_note": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      let contact = contactsRef.current.find((c: any) => c.name?.toLowerCase().includes(args.contact_identifier.toLowerCase()) || c.id === args.contact_identifier);
      if (!contact) { const { data } = await supabase.from("contacts").select("id,name").eq("user_id", user.id).ilike("name", `%${args.contact_identifier}%`).limit(1); if (data?.length) contact = data[0]; }
      if (!contact) return `[ERRO] Contato "${args.contact_identifier}" não encontrado.`;
      const { data: inserted, error } = await supabase.from("contact_interactions").insert({ user_id: user.id, contact_id: contact.id, title: `Nota: ${args.note.substring(0, 50)}${args.note.length > 50 ? "..." : ""}`, type: "note", description: args.note }).select("id,contact_id,title,type,description,interaction_date").single();
      if (error || !inserted) return `[ERRO] Falha ao adicionar nota: ${error?.message || "sem retorno"}`;
      interactionsRef.current = [inserted, ...interactionsRef.current];
      return `[OK] 📝 Nota adicionada ao contato "${contact.name}": "${args.note.substring(0, 100)}${args.note.length > 100 ? "..." : ""}"`;
    }
    case "add_interaction": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const contact = contactsRef.current.find((c: any) => c.name?.toLowerCase().includes(args.contact_identifier.toLowerCase()) || c.id === args.contact_identifier);
      if (!contact) return `[ERRO] Contato "${args.contact_identifier}" não encontrado.`;
      const { data: inserted, error } = await supabase.from("contact_interactions").insert({ user_id: user.id, contact_id: contact.id, title: args.title, type: args.type || "other", description: args.description || null, ...(args.date ? { interaction_date: args.date } : {}) }).select("id,contact_id,title,type,description,interaction_date").single();
      if (error || !inserted) return `[ERRO] Falha ao registrar interação: ${error?.message || "sem retorno"}`;
      interactionsRef.current = [inserted, ...interactionsRef.current];
      return `[OK] 📋 Interação registrada para "${contact.name}": ${args.title}`;
    }
    case "get_interactions": {
      const contact = contactsRef.current.find((c: any) => c.name?.toLowerCase().includes(args.contact_identifier.toLowerCase()) || c.id === args.contact_identifier);
      if (!contact) return `Contato "${args.contact_identifier}" não encontrado.`;
      const limit = args.limit || 10;
      const interactions = interactionsRef.current.filter((i: any) => i.contact_id === contact.id).slice(0, limit);
      if (interactions.length === 0) return `Nenhuma interação registrada para "${contact.name}".`;
      const typeEmoji: Record<string, string> = { meeting: "🤝", call: "📞", email: "📧", note: "📝", whatsapp: "📱", other: "📋" };
      return `📋 Interações com **${contact.name}** (${interactions.length}):\n${interactions.map((i: any) => `- ${typeEmoji[i.type] || "📋"} **${i.title}** — ${new Date(i.interaction_date).toLocaleDateString("pt-BR")}`).join("\n")}`;
    }
    case "favorite_contact": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      let contact = contactsRef.current.find((c: any) => c.name?.toLowerCase().includes(args.contact_identifier.toLowerCase()) || c.id === args.contact_identifier);
      if (!contact) { const { data } = await supabase.from("contacts").select("id,name").eq("user_id", user.id).ilike("name", `%${args.contact_identifier}%`).limit(1); if (data?.length) contact = data[0]; }
      if (!contact) return `[ERRO] Contato "${args.contact_identifier}" não encontrado.`;
      const { error } = await supabase.from("contacts").update({ favorited: args.favorite }).eq("id", contact.id);
      if (error) return `[ERRO] Falha: ${error.message}`;
      return `[OK] ${args.favorite ? "⭐" : "☆"} Contato "${contact.name}" ${args.favorite ? "favoritado" : "desfavoritado"}.`;
    }
    case "get_contact_stats": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const contacts = contactsRef.current;
      if (contacts.length === 0) return "Nenhum contato cadastrado.";
      const byCompany: Record<string, number> = {};
      let withEmail = 0, withPhone = 0, withTags = 0, favorited = 0;
      for (const c of contacts) { if (c.company) byCompany[c.company] = (byCompany[c.company] || 0) + 1; if (resolveEmail(c)) withEmail++; if (resolvePhone(c)) withPhone++; if (c.tags?.length) withTags++; if ((c as any).favorited) favorited++; }
      const topCompanies = Object.entries(byCompany).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const byTag: Record<string, number> = {};
      for (const c of contacts) for (const t of (c.tags || [])) byTag[t] = (byTag[t] || 0) + 1;
      const topTags = Object.entries(byTag).sort((a, b) => b[1] - a[1]).slice(0, 8);
      const recentInt = interactionsRef.current.slice(0, 5);
      let result = `👥 **Estatísticas do CRM** (${contacts.length} contatos)\n\n📊 **Cobertura de dados**:\n- 📧 Com email: ${withEmail}/${contacts.length} (${Math.round(withEmail / contacts.length * 100)}%)\n- 📞 Com telefone: ${withPhone}/${contacts.length} (${Math.round(withPhone / contacts.length * 100)}%)\n- 🏷️ Com tags: ${withTags}/${contacts.length} (${Math.round(withTags / contacts.length * 100)}%)\n- ⭐ Favoritos: ${favorited}\n\n`;
      if (topCompanies.length > 0) result += `🏢 **Top empresas**:\n${topCompanies.map(([c, n]) => `- ${c}: ${n} contatos`).join("\n")}\n\n`;
      if (topTags.length > 0) result += `🏷️ **Tags mais usadas**:\n${topTags.map(([t, n]) => `- #${t}: ${n} contatos`).join("\n")}\n\n`;
      if (recentInt.length > 0) result += `📋 **Interações recentes**:\n${recentInt.map((i: any) => { const contact = contacts.find((c: any) => c.id === i.contact_id); return `- ${contact?.name || "?"}: ${i.title} (${new Date(i.interaction_date).toLocaleDateString("pt-BR")})`; }).join("\n")}`;
      return result;
    }
    case "get_birthday_reminders": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const daysAhead = args.days_ahead || 30;
      const { data: contactsWithBday } = await supabase.from("contacts").select("id,name,birthday,email,phone").eq("user_id", user.id).not("birthday", "is", null).limit(500);
      if (!contactsWithBday?.length) return "Nenhum contato com aniversário cadastrado.";
      const today = new Date();
      const upcoming: { name: string; birthday: string; daysUntil: number }[] = [];
      for (const c of contactsWithBday) {
        if (!c.birthday) continue;
        const [, m, d] = c.birthday.match(/(\d{2})-(\d{2})$/) || c.birthday.match(/(\d{2})\/(\d{2})/) || [];
        if (!m || !d) continue;
        const thisYear = new Date(today.getFullYear(), parseInt(m) - 1, parseInt(d));
        if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1);
        const diff = Math.ceil((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= daysAhead) upcoming.push({ name: c.name, birthday: c.birthday, daysUntil: diff });
      }
      upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
      if (upcoming.length === 0) return `Nenhum aniversário nos próximos ${daysAhead} dias.`;
      return `🎂 **Aniversários próximos** (${upcoming.length}):\n${upcoming.map(u => `- ${u.daysUntil === 0 ? "🎉 HOJE!" : u.daysUntil === 1 ? "⏰ Amanhã" : `📅 Em ${u.daysUntil} dias`} — **${u.name}** (${u.birthday})`).join("\n")}`;
    }
    case "bulk_tag_contacts": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const names: string[] = args.contact_names || [];
      const tag = args.tag;
      let success = 0, notFound: string[] = [];
      for (const n of names) {
        let contact = contactsRef.current.find((c: any) => c.name?.toLowerCase().includes(n.toLowerCase()));
        if (!contact) { const { data } = await supabase.from("contacts").select("id,name,tags").eq("user_id", user.id).ilike("name", `%${n}%`).limit(1); if (data?.length) contact = data[0]; }
        if (!contact) { notFound.push(n); continue; }
        const currentTags: string[] = contact.tags || [];
        if (currentTags.includes(tag)) { success++; continue; }
        const newTags = [...currentTags, tag];
        const { error } = await supabase.from("contacts").update({ tags: newTags }).eq("id", contact.id);
        if (!error) { success++; const idx = contactsRef.current.findIndex((c: any) => c.id === contact.id); if (idx >= 0) contactsRef.current[idx] = { ...contactsRef.current[idx], tags: newTags }; }
      }
      let result = `[OK] 🏷️ Tag "${tag}" aplicada a ${success}/${names.length} contatos.`;
      if (notFound.length > 0) result += `\n⚠️ Não encontrados: ${notFound.join(", ")}`;
      return result;
    }
    case "find_duplicate_contacts": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const { data: allContacts } = await supabase.from("contacts").select("id,name,email,phone").eq("user_id", user.id).order("name").limit(500);
      if (!allContacts?.length) return "Nenhum contato para analisar.";
      const duplicates: { group: string; contacts: any[] }[] = [];
      const seen = new Map<string, any[]>();
      for (const c of allContacts) {
        const normName = c.name?.toLowerCase().trim().replace(/\s+/g, " ");
        if (normName) { if (!seen.has(normName)) seen.set(normName, []); seen.get(normName)!.push(c); }
        const email = c.email?.toLowerCase().trim();
        if (email) { const key = `email:${email}`; if (!seen.has(key)) seen.set(key, []); seen.get(key)!.push(c); }
      }
      for (const [key, contacts] of seen) { if (contacts.length > 1) { const uniqueIds = [...new Set(contacts.map((c: any) => c.id))]; if (uniqueIds.length > 1) duplicates.push({ group: key, contacts: contacts.filter((c: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === c.id) === i) }); } }
      if (duplicates.length === 0) return "✅ Nenhum contato duplicado encontrado!";
      return `⚠️ **Possíveis duplicatas** (${duplicates.length} grupos):\n${duplicates.slice(0, 10).map(d => `\n🔄 **${d.group.startsWith("email:") ? "Mesmo email" : "Mesmo nome"}**: ${d.group.replace("email:", "")}\n${d.contacts.map((c: any) => `   - ${c.name} ${c.email ? `(${c.email})` : ""} ${c.phone || ""}`).join("\n")}`).join("\n")}`;
    }

    // === Cross-Module Intelligence ===
    case "cross_module_search": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const q = args.query.toLowerCase();
      const results: string[] = [];
      const matchedTasks = state.tasks.filter(t => t.text.toLowerCase().includes(q));
      if (matchedTasks.length) results.push(`📋 **Tarefas** (${matchedTasks.length}):\n${matchedTasks.slice(0, 3).map(t => `  - ${t.done ? "✅" : "⬜"} ${t.text}`).join("\n")}`);
      const matchedNotes = state.notes.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
      if (matchedNotes.length) results.push(`📝 **Notas** (${matchedNotes.length}):\n${matchedNotes.slice(0, 3).map(n => `  - ${n.title}`).join("\n")}`);
      const matchedContacts = contactsRef.current.filter((c: any) => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q));
      if (matchedContacts.length) results.push(`👥 **Contatos** (${matchedContacts.length}):\n${matchedContacts.slice(0, 3).map((c: any) => `  - ${c.name} ${c.company ? `(${c.company})` : ""}`).join("\n")}`);
      const matchedTxs = financeTransactionsRef.current.filter((t: any) => (t as any).description?.toLowerCase().includes(q) || (t as any).category?.toLowerCase().includes(q));
      if (matchedTxs.length) results.push(`💰 **Transações** (${matchedTxs.length}):\n${matchedTxs.slice(0, 3).map((t: any) => `  - ${(t as any).description}: R$${Number((t as any).amount).toFixed(2)}`).join("\n")}`);
      const matchedKB = knowledgeBaseRef.current.filter((k: any) => k.title?.toLowerCase().includes(q) || k.content?.toLowerCase().includes(q));
      if (matchedKB.length) results.push(`📚 **Base de Conhecimento** (${matchedKB.length}):\n${matchedKB.slice(0, 3).map((k: any) => `  - ${k.title}`).join("\n")}`);
      const matchedEvents = state.events.filter(e => e.label.toLowerCase().includes(q));
      if (matchedEvents.length) results.push(`📅 **Eventos** (${matchedEvents.length}):\n${matchedEvents.slice(0, 3).map(e => `  - ${e.day}/${e.month + 1}: ${e.label}`).join("\n")}`);
      const { data: matchedFiles } = await supabase.from("files").select("id,name,mime_type").eq("user_id", user.id).eq("is_trashed", false).ilike("name", `%${q}%`).limit(5);
      if (matchedFiles?.length) results.push(`📁 **Arquivos** (${matchedFiles.length}):\n${matchedFiles.slice(0, 3).map((f: any) => `  - ${f.name}`).join("\n")}`);
      const matchedMem = memoriesRef.current.filter((m: any) => m.content?.toLowerCase().includes(q));
      if (matchedMem.length) results.push(`🧠 **Memórias** (${matchedMem.length}):\n${matchedMem.slice(0, 3).map((m: any) => `  - ${m.content.substring(0, 80)}`).join("\n")}`);
      if (results.length === 0) return `Nenhum resultado encontrado para "${args.query}" em nenhum módulo.`;
      return `🔍 **Busca: "${args.query}"** — Encontrado em ${results.length} módulo(s):\n\n${results.join("\n\n")}`;
    }

    // === Productivity ===
    case "smart_reminder": {
      const what = args.what;
      const whenHint = args.when_hint || "amanhã";
      const priority = args.priority || "medium";
      try {
        addTask(what, priority);
        const now = new Date();
        let targetDate = new Date(now);
        const hint = whenHint.toLowerCase();
        if (hint.includes("amanhã") || hint.includes("amanha")) targetDate.setDate(now.getDate() + 1);
        else if (hint.includes("depois de amanhã")) targetDate.setDate(now.getDate() + 2);
        else if (hint.includes("semana que vem") || hint.includes("próxima semana")) targetDate.setDate(now.getDate() + 7);
        else if (hint.includes("segunda")) targetDate.setDate(now.getDate() + ((1 - now.getDay() + 7) % 7 || 7));
        else if (hint.includes("terça")) targetDate.setDate(now.getDate() + ((2 - now.getDay() + 7) % 7 || 7));
        else if (hint.includes("quarta")) targetDate.setDate(now.getDate() + ((3 - now.getDay() + 7) % 7 || 7));
        else if (hint.includes("quinta")) targetDate.setDate(now.getDate() + ((4 - now.getDay() + 7) % 7 || 7));
        else if (hint.includes("sexta")) targetDate.setDate(now.getDate() + ((5 - now.getDay() + 7) % 7 || 7));
        const dateStr = targetDate.toISOString().split("T")[0];
        if (user) {
          await ctx.verifyTaskInDb(user.id, what);
          await supabase.from("tasks").update({ due_date: dateStr } as any).eq("user_id", user.id).ilike("title", what);
        }
        return `[OK] ⏰ Lembrete criado: "${what}" para ${targetDate.toLocaleDateString("pt-BR")} (${priority})`;
      } catch (e: any) { return `[ERRO] Falha ao criar lembrete: ${e.message}`; }
    }
    case "plan_my_day": {
      const pending = state.tasks.filter(t => !t.done);
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const overdue = pending.filter(t => (t as any).due_date && (t as any).due_date < todayStr);
      const dueToday = pending.filter(t => (t as any).due_date === todayStr);
      const highPri = pending.filter(t => t.priority === "high" || (t as any).priority === "urgent");
      const todayEvents = state.events.filter(e => e.day === today.getDate() && e.month === today.getMonth() && e.year === today.getFullYear());
      const habits = habitsRef.current.data?.habits || [];
      const pendingHabits = habits.filter((h: any) => !h.completedToday);
      let plan = `📋 **Plano do Dia — ${today.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}**\n\n`;
      if (overdue.length > 0) plan += `🚨 **ATRASADAS (${overdue.length}):**\n${overdue.map(t => `- ❗ ${t.text} (prazo: ${(t as any).due_date})`).join("\n")}\n\n`;
      if (todayEvents.length > 0) plan += `📅 **Compromissos:**\n${todayEvents.map(e => `- ${e.label}`).join("\n")}\n\n`;
      if (dueToday.length > 0) plan += `⏰ **Vencem hoje:**\n${dueToday.map(t => `- ${t.text} (${t.priority})`).join("\n")}\n\n`;
      if (highPri.length > 0) plan += `🔥 **Alta prioridade:**\n${highPri.filter(t => !overdue.includes(t) && !dueToday.includes(t)).map(t => `- ${t.text}`).join("\n")}\n\n`;
      const otherPending = pending.filter(t => !overdue.includes(t) && !dueToday.includes(t) && !highPri.includes(t));
      if (otherPending.length > 0) plan += `📝 **Outras tarefas (${otherPending.length}):**\n${otherPending.slice(0, 5).map(t => `- ${t.text}`).join("\n")}${otherPending.length > 5 ? `\n  ...e mais ${otherPending.length - 5}` : ""}\n\n`;
      if (pendingHabits.length > 0) plan += `🏋️ **Hábitos pendentes (${pendingHabits.length}):**\n${pendingHabits.map((h: any) => `- ${h.name} 🔥${h.streak}`).join("\n")}\n\n`;
      plan += `💡 **Sugestão**: Comece pelas ${overdue.length > 0 ? "tarefas atrasadas" : highPri.length > 0 ? "tarefas de alta prioridade" : "tarefas com prazo mais próximo"}, intercale com os hábitos durante o dia.`;
      return plan;
    }
    case "weekly_review": {
      const done = state.tasks.filter(t => t.done);
      const pending = state.tasks.filter(t => !t.done);
      const txs = financeTransactionsRef.current;
      const income = txs.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const expense = txs.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const habits = habitsRef.current.data?.habits || [];
      const completedHabits = habits.filter((h: any) => h.completedToday).length;
      const topStreak = habits.reduce((max: any, h: any) => (h.streak > (max?.streak || 0) ? h : max), null as any);
      let review = `📊 **Revisão Semanal**\n\n✅ **Tarefas**: ${done.length} concluídas, ${pending.length} pendentes\n💰 **Finanças**: Receita R$${income.toFixed(2)} | Despesa R$${expense.toFixed(2)} | Saldo R$${(income - expense).toFixed(2)}\n🏋️ **Hábitos**: ${completedHabits}/${habits.length} completados hoje${topStreak ? ` | 🔥 Melhor streak: ${topStreak.name} (${topStreak.streak} dias)` : ""}\n📅 **Eventos**: ${state.events.length} no calendário\n`;
      if (pending.filter(t => t.priority === "high").length > 0) review += `\n⚠️ **Atenção**: ${pending.filter(t => t.priority === "high").length} tarefa(s) de alta prioridade pendente(s)!`;
      return review;
    }
    case "get_productivity_score": {
      const now = new Date();
      const totalTasks = state.tasks.length;
      const doneTasks = state.tasks.filter(t => t.done).length;
      const pendingTasks = totalTasks - doneTasks;
      const overdue = state.tasks.filter(t => !t.done && (t as any).due_date && (t as any).due_date < now.toISOString().split("T")[0]).length;
      const highPriPending = state.tasks.filter(t => !t.done && (t.priority === "high" || (t as any).priority === "urgent")).length;
      const habits = habitsRef.current.data?.habits || [];
      const habitsDoneToday = habits.filter((h: any) => h.completedToday).length;
      const avgStreak = habits.length ? habits.reduce((s: number, h: any) => s + (h.streak || 0), 0) / habits.length : 0;
      const txs = financeTransactionsRef.current;
      const income = txs.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const expense = txs.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;
      const budgetsOk = budgetsRef.current.filter((b: any) => { const spent = txs.filter((t: any) => t.type === "expense" && t.category === b.category && (() => { const d = new Date(t.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })()).reduce((s: number, t: any) => s + Number(t.amount), 0); return spent <= Number(b.monthly_limit); }).length;
      const taskScore = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100 - (overdue * 10)) : 50;
      const habitScore = habits.length > 0 ? Math.round((habitsDoneToday / habits.length) * 50 + Math.min(avgStreak * 5, 50)) : 50;
      const financeScore = Math.min(100, Math.max(0, Math.round(savingsRate + (budgetsRef.current.length > 0 ? (budgetsOk / budgetsRef.current.length) * 30 : 15))));
      const overallScore = Math.round((taskScore * 0.35 + habitScore * 0.30 + financeScore * 0.35));
      const scoreEmoji = (s: number) => s >= 80 ? "🟢" : s >= 60 ? "🟡" : s >= 40 ? "🟠" : "🔴";
      const gradeLabel = (s: number) => s >= 90 ? "Excelente" : s >= 75 ? "Muito Bom" : s >= 60 ? "Bom" : s >= 40 ? "Regular" : "Precisa melhorar";
      let result = `📊 **Score de Produtividade**: ${scoreEmoji(overallScore)} **${overallScore}/100** — ${gradeLabel(overallScore)}\n\n`;
      result += `📋 **Tarefas** ${scoreEmoji(taskScore)} ${taskScore}/100\n  ${doneTasks} concluídas, ${pendingTasks} pendentes${overdue > 0 ? `, ⚠️ ${overdue} atrasadas` : ""}${highPriPending > 0 ? `, 🔥 ${highPriPending} alta prioridade` : ""}\n\n`;
      result += `🏋️ **Hábitos** ${scoreEmoji(habitScore)} ${habitScore}/100\n  ${habitsDoneToday}/${habits.length} hoje | Streak médio: ${avgStreak.toFixed(1)} dias\n\n`;
      result += `💰 **Finanças** ${scoreEmoji(financeScore)} ${financeScore}/100\n  Taxa de economia: ${savingsRate.toFixed(1)}%${budgetsRef.current.length > 0 ? ` | Orçamentos OK: ${budgetsOk}/${budgetsRef.current.length}` : ""}\n\n`;
      const insights: string[] = [];
      if (overdue > 0) insights.push(`⚠️ Resolva ${overdue} tarefa(s) atrasada(s) para melhorar seu score`);
      if (habitsDoneToday < habits.length && habits.length > 0) insights.push(`💪 Complete mais ${habits.length - habitsDoneToday} hábito(s) hoje`);
      if (savingsRate < 20 && income > 0) insights.push(`💡 Tente economizar mais — meta ideal: >20% da receita`);
      if (highPriPending > 3) insights.push(`🔥 Muitas tarefas de alta prioridade pendentes — priorize!`);
      if (avgStreak > 7) insights.push(`🎉 Ótimos streaks de hábitos — continue assim!`);
      if (insights.length > 0) result += `\n💡 **Insights**:\n${insights.join("\n")}`;
      return result;
    }

    // === Dashboard Summary ===
    case "get_dashboard_summary": {
      const totalTasks = state.tasks.length;
      const doneTasks = state.tasks.filter(t => t.done).length;
      const pendingTasks = totalTasks - doneTasks;
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const overdue = state.tasks.filter(t => !t.done && (t as any).due_date && (t as any).due_date < todayStr).length;
      const todayEvents = state.events.filter(e => e.day === today.getDate() && e.month === today.getMonth() && e.year === today.getFullYear());
      const habits = habitsRef.current.data?.habits || [];
      const habitsDone = habits.filter((h: any) => h.completedToday).length;
      const txs = financeTransactionsRef.current;
      const monthTxs = txs.filter((t: any) => { const d = new Date(t.date); return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear(); });
      const income = monthTxs.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const expense = monthTxs.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const contacts = contactsRef.current.length;
      const files = filesRef.current.length;
      let summary = `📊 **Resumo do Dashboard**\n\n`;
      summary += `📋 **Tarefas**: ${doneTasks}/${totalTasks} concluídas${overdue > 0 ? ` | ⚠️ ${overdue} atrasadas` : ""}\n`;
      summary += `📅 **Eventos hoje**: ${todayEvents.length}${todayEvents.length > 0 ? ` (${todayEvents.map(e => e.label).join(", ")})` : ""}\n`;
      summary += `🏋️ **Hábitos**: ${habitsDone}/${habits.length} completados hoje\n`;
      summary += `💰 **Finanças (mês)**: Receita R$${income.toFixed(2)} | Despesa R$${expense.toFixed(2)} | Saldo R$${(income - expense).toFixed(2)}\n`;
      summary += `👥 **Contatos**: ${contacts} | 📁 **Arquivos**: ${files}\n`;
      if (pendingTasks > 0) summary += `\n📌 **Próximas tarefas**: ${state.tasks.filter(t => !t.done).slice(0, 3).map(t => t.text).join(", ")}`;
      return summary;
    }

    // === Current Time ===
    case "get_current_time": {
      const now = new Date();
      return `🕐 **Data e hora atual**: ${now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    }

    // === Update Profile ===
    case "update_profile": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const displayName = args.display_name;
      if (!displayName || typeof displayName !== "string") return "[ERRO] Nome de exibição inválido.";
      const { error } = await supabase.from("profiles").update({ display_name: displayName.trim() }).eq("user_id", user.id);
      if (error) return `[ERRO] Falha ao atualizar perfil: ${error.message}`;
      return `[OK] ✅ Nome de exibição atualizado para "${displayName.trim()}".`;
    }

    // === Suggest Replies (handled by client — just return the suggestions) ===
    case "suggest_replies": {
      const suggestions = args.suggestions;
      if (!Array.isArray(suggestions) || suggestions.length === 0) return null;
      // Return as structured data — the client will render these as quick-reply buttons
      return `[SUGGEST_REPLIES]${JSON.stringify(suggestions)}`;
    }

    default:
      return null; // Not handled by this module
  }
}

/** Tool names handled by this module */
export const SYSTEM_TOOL_NAMES = new Set([
  "navigate_to", "set_theme", "set_wallpaper",
  "save_memory", "get_memories", "delete_memory",
  "add_knowledge", "get_knowledge", "search_knowledge", "delete_knowledge", "edit_knowledge",
  "get_automations", "create_automation", "toggle_automation", "delete_automation",
  "get_connections", "get_workspaces", "switch_workspace",
  "add_contact", "edit_contact", "delete_contact", "search_contacts", "get_contacts",
  "get_contact_details", "smart_find_contact", "update_contact_tags",
  "add_interaction", "get_interactions",
  "get_productivity_score", "plan_my_day", "weekly_review",
  "get_dashboard_summary", "get_current_time", "update_profile", "suggest_replies",
  "create_reminder",
]);
