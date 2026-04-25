/**
 * AI Tool Handlers — Email, WhatsApp, Social, Files, Search, Media
 * Extracted from useAIToolExecution for maintainability.
 */
import type { ToolContext } from "./toolContext";

export async function handleIntegrationTool(name: string, args: Record<string, any>, ctx: ToolContext): Promise<string | null> {
  const { user, supabase, invokeEdge, contactsRef, recentEmailsRef, filesRef, filesCountRef, socialAccountsRef, bankAccountsRef, investmentsRef, financialConnectionsRef, whatsappStatusRef, waConversationsRef, resolveEmail, resolvePhone, invalidateGoogleCache, financeTransactionsRef, financeGoalsRef, financeRecurringRef, budgetsRef, interactionsRef } = ctx;

  switch (name) {
    // === Email Tools ===
    case "get_emails": {
      const limit = args.limit || 10;
      if (user) {
        const { data: cached } = await supabase.from('emails_cache').select('*').eq('user_id', user.id).order('received_at', { ascending: false }).limit(limit);
        if (cached && cached.length > 0) {
          return `📧 Últimos e-mails (${cached.length}, do cache):\n${cached.map((e: any) => `- ${!e.is_read ? "🔵" : "⚪"} **${e.from_name || e.from_email || "Desconhecido"}**: ${e.subject || "(sem assunto)"}`).join("\n")}`;
        }
      }
      const emails = recentEmailsRef.current.slice(0, limit);
      if (emails.length === 0) return "Nenhum e-mail encontrado no cache.";
      return `📧 Últimos e-mails (${emails.length}):\n${emails.map((e: any) => `- ${e.is_unread ? "🔵" : "⚪"} **${e.from_name || e.from_email}**: ${e.subject || "(sem assunto)"}`).join("\n")}`;
    }
    case "search_emails": {
      try {
        const { data: gResults } = await invokeEdge<any>({ fn: "composio-proxy", body: { service: "gmail", path: "/gmail/v1/users/me/messages", method: "GET", params: { q: args.query, maxResults: "15" } } });
        const messages = gResults?.messages || gResults?.data?.messages || (Array.isArray(gResults) ? gResults : []);
        if (messages.length > 0) {
          const formatted = messages.slice(0, 15).map((m: any) => { const subject = m.subject || m.snippet?.substring(0, 60) || "(sem assunto)"; const from = m.from || m.sender || "Desconhecido"; return `- **${from}**: ${subject}`; });
          return `📧 E-mails encontrados no Gmail (${messages.length}):\n${formatted.join("\n")}`;
        }
      } catch { /* fallback to local */ }
      const q = args.query.toLowerCase();
      const results = recentEmailsRef.current.filter((e: any) => e.subject?.toLowerCase().includes(q) || e.from_name?.toLowerCase().includes(q) || e.from_email?.toLowerCase().includes(q));
      if (results.length === 0) return `Nenhum e-mail encontrado para "${args.query}".`;
      return `📧 E-mails encontrados (${results.length}):\n${results.map((e: any) => `- ${e.is_unread ? "🔵" : "⚪"} **${e.from_name || e.from_email}**: ${e.subject}`).join("\n")}`;
    }
    case "get_email_stats": {
      const emails = recentEmailsRef.current;
      const unread = emails.filter((e: any) => e.is_unread).length;
      const starred = emails.filter((e: any) => e.is_starred).length;
      return `📧 **Estatísticas de E-mail**\n- Total no cache: ${emails.length}\n- Não lidos: ${unread}\n- Com estrela: ${starred}`;
    }
    case "trash_emails":
    case "archive_emails":
    case "star_emails":
    case "mark_emails_read": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      try {
        const q = (args.query as string).toLowerCase();
        const limit = Math.min(args.limit || 10, 50);
        const matches = recentEmailsRef.current.filter((e: any) => e.subject?.toLowerCase().includes(q) || e.from_name?.toLowerCase().includes(q) || e.from_email?.toLowerCase().includes(q)).slice(0, limit);
        if (matches.length === 0) return `Nenhum e-mail encontrado para "${args.query}".`;
        let successCount = 0;
        let actionLabel = "";
        for (const email of matches) {
          const gmailId = (email as any).gmail_id;
          if (!gmailId) continue;
          let reqBody: any;
          switch (name) {
            case "trash_emails": reqBody = { service: "gmail", path: `/gmail/v1/users/me/messages/${gmailId}/trash`, method: "POST" }; actionLabel = "movidos para a lixeira"; break;
            case "archive_emails": reqBody = { service: "gmail", path: `/gmail/v1/users/me/messages/${gmailId}/modify`, method: "POST", body: { removeLabelIds: ["INBOX"] } }; actionLabel = "arquivados"; break;
            case "star_emails": reqBody = { service: "gmail", path: `/gmail/v1/users/me/messages/${gmailId}/modify`, method: "POST", body: { addLabelIds: ["STARRED"] } }; actionLabel = "marcados com estrela"; break;
            case "mark_emails_read": reqBody = { service: "gmail", path: `/gmail/v1/users/me/messages/${gmailId}/modify`, method: "POST", body: { removeLabelIds: ["UNREAD"] } }; actionLabel = "marcados como lidos"; break;
          }
          const { error } = await invokeEdge<any>({ fn: "composio-proxy", body: reqBody });
          if (!error) successCount++;
        }
        if (successCount === 0) return `[ERRO] Não foi possível processar os e-mails.`;
        return `[OK] ✅ ${successCount} e-mail(s) ${actionLabel} com sucesso.`;
      } catch (err: any) {
        return `[ERRO] Falha ao gerenciar e-mails: ${err.message || err}`;
      }
    }
    case "send_email": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      try {
        const rawMessage = [`To: ${args.to}`, `Subject: ${args.subject}`, `Content-Type: text/plain; charset=utf-8`, ``, args.body].join("\r\n");
        const encodedMessage = btoa(unescape(encodeURIComponent(rawMessage))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const { data: result, error: sendError } = await invokeEdge<any>({ fn: "composio-proxy", body: { service: "gmail", path: "/gmail/v1/users/me/messages/send", method: "POST", body: { raw: encodedMessage } } });
        if (sendError) return `[ERRO] Falha ao enviar e-mail: ${sendError}`;
        if (result?.error) return `[ERRO] Falha ao enviar e-mail: ${typeof result.error === 'string' ? result.error : JSON.stringify(result.error)}`;
        if (!result?.id && !result?.threadId) return `[ERRO] Falha ao enviar e-mail: resposta inesperada do servidor.`;
        const contact = contactsRef.current.find((c: any) => resolveEmail(c)?.toLowerCase() === args.to.toLowerCase());
        if (contact) {
          await supabase.from("contact_interactions").insert({ user_id: user.id, contact_id: contact.id, title: `E-mail enviado: ${args.subject}`, type: "email", description: args.body.substring(0, 500) });
        }
        return `[OK] 📧 E-mail enviado para ${args.contact_name || args.to}: "${args.subject}"`;
      } catch (e: any) { return `[ERRO] Falha ao enviar e-mail: ${e.message}`; }
    }
    case "reply_email": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      try {
        let originalEmail: any = null;
        const { data: composioCache } = await supabase.from("emails_cache").select("gmail_id,subject,from_name,from_email").eq("user_id", user.id).eq("gmail_id", args.email_id).single();
        if (composioCache) { originalEmail = composioCache; }
        else {
          const { data: legacyCache } = await supabase.from("gmail_messages_cache" as any).select("gmail_id,subject,from_email,from_name").eq("user_id", user.id).eq("id", args.email_id).single();
          originalEmail = legacyCache;
        }
        if (!originalEmail) return `[ERRO] E-mail original "${args.email_id}" não encontrado no cache.`;
        const { data: fullMsg } = await invokeEdge<any>({ fn: "composio-proxy", body: { service: "gmail", path: `/gmail/v1/users/me/messages/${originalEmail.gmail_id}`, method: "GET", params: { format: "metadata", metadataHeaders: "Message-Id" } } });
        const threadId = fullMsg?.threadId || "";
        const replyTo = originalEmail.from_email || "";
        const subject = `Re: ${(originalEmail.subject || "").replace(/^Re:\s*/i, "")}`;
        const headers = fullMsg?.payload?.headers || [];
        const messageIdHeader = headers.find((h: any) => h.name?.toLowerCase() === "message-id")?.value || "";
        const rawMessage = [`To: ${replyTo}`, `Subject: ${subject}`, ...(messageIdHeader ? [`In-Reply-To: ${messageIdHeader}`, `References: ${messageIdHeader}`] : []), `Content-Type: text/plain; charset=utf-8`, ``, args.reply_text].join("\r\n");
        const encodedMessage = btoa(unescape(encodeURIComponent(rawMessage))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const { data: sendResult, error: sendError } = await invokeEdge<any>({ fn: "composio-proxy", body: { service: "gmail", path: "/gmail/v1/users/me/messages/send", method: "POST", body: { raw: encodedMessage, threadId } } });
        if (sendError) return `[ERRO] Falha ao responder e-mail: ${sendError}`;
        if (sendResult?.error) return `[ERRO] Falha ao responder e-mail: ${typeof sendResult.error === 'string' ? sendResult.error : JSON.stringify(sendResult.error)}`;
        if (!sendResult?.id && !sendResult?.threadId) return `[ERRO] Falha ao responder e-mail: resposta inesperada do servidor.`;
        return `[OK] 📧 Resposta enviada para ${originalEmail.from_name || replyTo} (${subject})`;
      } catch (e: any) { return `[ERRO] Falha ao responder e-mail: ${e.message}`; }
    }
    case "create_draft_email": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      try {
        const rawMessage = [`To: ${args.to || ""}`, `Subject: ${args.subject}`, `Content-Type: text/plain; charset=utf-8`, ``, args.body].join("\r\n");
        const encodedMessage = btoa(unescape(encodeURIComponent(rawMessage))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const { data: draftResult, error: draftErr } = await invokeEdge<any>({ fn: "composio-proxy", body: { service: "gmail", path: "/gmail/v1/users/me/drafts", method: "POST", data: { raw: encodedMessage } } });
        if (draftErr) return `[ERRO] Falha ao criar rascunho: ${draftErr}`;
        if (draftResult?.error) return `[ERRO] Falha ao criar rascunho: ${JSON.stringify(draftResult.error)}`;
        return `[OK] 📝 Rascunho criado: "${args.subject}"${args.to ? ` para ${args.to}` : ""}`;
      } catch (e: any) { return `[ERRO] Falha ao criar rascunho: ${e.message}`; }
    }

    // === Files ===
    case "get_files": {
      const limit = args.limit || 20;
      const files = filesRef.current.slice(0, limit);
      if (files.length === 0) return "Nenhum arquivo encontrado.";
      return `📁 Arquivos (${files.length}):\n${files.map((f: any) => `- **${f.name}** (${f.mime_type}, ${(f.size_bytes / 1024).toFixed(1)} KB)`).join("\n")}`;
    }
    case "search_files": {
      const q = args.query.toLowerCase();
      const results = filesRef.current.filter((f: any) => f.name?.toLowerCase().includes(q));
      if (results.length === 0) return `Nenhum arquivo encontrado para "${args.query}".`;
      return `📁 Arquivos encontrados (${results.length}):\n${results.map((f: any) => `- **${f.name}** (${f.mime_type})`).join("\n")}`;
    }
    case "delete_file": {
      const file = filesRef.current.find((f: any) => f.name?.toLowerCase().includes(args.file_identifier.toLowerCase()) || f.id === args.file_identifier);
      if (!file) return `[ERRO] Arquivo "${args.file_identifier}" não encontrado.`;
      const { error } = await supabase.from("user_files" as any).delete().eq("id", file.id);
      if (error) return `[ERRO] Falha ao excluir arquivo: ${error.message}`;
      filesRef.current = filesRef.current.filter((f: any) => f.id !== file.id);
      filesCountRef.current = Math.max(0, filesCountRef.current - 1);
      return `[OK] 📁 Arquivo "${file.name}" excluído.`;
    }
    case "move_file_to_folder": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const file = filesRef.current.find((f: any) => f.name?.toLowerCase().includes(args.file_identifier.toLowerCase()) || f.id === args.file_identifier);
      if (!file) return `[ERRO] Arquivo "${args.file_identifier}" não encontrado.`;
      const { data: folders } = await supabase.from("file_folders").select("id,name").eq("user_id", user.id).ilike("name", `%${args.folder_name}%`).limit(1);
      let folderId = folders?.[0]?.id;
      if (!folderId) {
        const { data: newFolder } = await supabase.from("file_folders").insert({ user_id: user.id, name: args.folder_name }).select("id").single();
        folderId = newFolder?.id;
      }
      if (!folderId) return `[ERRO] Falha ao encontrar/criar pasta "${args.folder_name}".`;
      const { error } = await supabase.from("files").update({ folder_id: folderId }).eq("id", file.id);
      if (error) return `[ERRO] Falha ao mover arquivo: ${error.message}`;
      return `[OK] 📁 Arquivo "${file.name}" movido para pasta "${args.folder_name}".`;
    }
    case "get_folders": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const { data: folders } = await supabase.from("file_folders").select("id,name,color,icon").eq("user_id", user.id).order("name", { ascending: true });
      if (!folders?.length) return "Nenhuma pasta encontrada.";
      return `📂 **Pastas** (${folders.length}):\n${folders.map((f: any) => `- ${f.icon || "📁"} **${f.name}**`).join("\n")}`;
    }
    case "trash_file": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const target = filesRef.current.find((f: any) => f.name?.toLowerCase().includes(args.file_identifier.toLowerCase()) || f.id === args.file_identifier);
      if (!target) return `[ERRO] Arquivo "${args.file_identifier}" não encontrado.`;
      const { error } = await supabase.from("files").update({ is_trashed: true, trashed_at: new Date().toISOString() }).eq("id", target.id);
      if (error) return `[ERRO] Falha: ${error.message}`;
      return `[OK] 🗑️ Arquivo "${target.name}" movido para a lixeira.`;
    }
    case "restore_file": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const { data: trashed } = await supabase.from("files").select("id,name").eq("user_id", user.id).eq("is_trashed", true).ilike("name", `%${args.file_identifier}%`).limit(1);
      const target = trashed?.[0];
      if (!target) return `[ERRO] Arquivo "${args.file_identifier}" não encontrado na lixeira.`;
      const { error } = await supabase.from("files").update({ is_trashed: false, trashed_at: null }).eq("id", target.id);
      if (error) return `[ERRO] Falha: ${error.message}`;
      return `[OK] ♻️ Arquivo "${target.name}" restaurado da lixeira.`;
    }
    case "get_file_stats": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      try {
        const { data } = await supabase.rpc("get_file_storage_stats", { _user_id: user.id });
        if (!data) return "Nenhum arquivo encontrado.";
        const stats = data as any;
        const formatSize = (bytes: number) => { if (bytes < 1024) return `${bytes} B`; if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`; if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`; return `${(bytes / 1073741824).toFixed(2)} GB`; };
        let result = `📁 **Estatísticas de Armazenamento**\n\n📊 **Total**: ${stats.total_files} arquivos (${formatSize(stats.total_size)})\n🗑️ **Lixeira**: ${stats.trashed_files} arquivos (${formatSize(stats.trashed_size)})\n🔄 **Duplicatas**: ${stats.duplicates} grupo(s)\n\n`;
        if (stats.by_category?.length) result += `📂 **Por categoria**:\n${stats.by_category.map((c: any) => `- **${c.category || "Sem categoria"}**: ${c.count} arquivos (${formatSize(c.size)})`).join("\n")}`;
        return result;
      } catch (e: any) { return `[ERRO] Falha ao obter estatísticas: ${e.message}`; }
    }

    // === WhatsApp ===
    case "get_whatsapp_status":
      return `📱 Status do WhatsApp Web: **${whatsappStatusRef.current}**`;
    case "send_whatsapp": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      if (whatsappStatusRef.current !== "CONNECTED") return "[ERRO] 📱 WhatsApp Web não está conectado. Conecte primeiro em Configurações > WhatsApp.";
      let phone = (args.phone_number || "").replace(/\D/g, "");
      if ((!phone || phone.length < 10) && args.contact_name) {
        const q = args.contact_name.toLowerCase();
        let found = contactsRef.current.find((c: any) => c.name?.toLowerCase().includes(q));
        if (!found) {
          const { data } = await supabase.from("contacts").select("id,name,phone,phones").eq("user_id", user.id).ilike("name", `%${q}%`).limit(1);
          if (data?.length) found = data[0];
        }
        const resolvedPhone = found ? resolvePhone(found) : null;
        if (resolvedPhone) { phone = resolvedPhone.replace(/\D/g, ""); }
        else { return `[ERRO] Não encontrei o número de ${args.contact_name}. Forneça o phone_number.`; }
      }
      if (!phone || phone.length < 10) return "[ERRO] Número de telefone inválido.";
      if (!phone.startsWith("55")) phone = "55" + phone;
      try {
        const { data, error } = await invokeEdge<any>({ fn: "whatsapp-web", body: { action: "send_message", phone_number: phone, message: args.message } });
        if (error) return `[ERRO] Falha ao enviar WhatsApp: ${error}`;
        if (data?.error) return `[ERRO] ${data.error}`;
        const contact = contactsRef.current.find((c: any) => { const cp = resolvePhone(c)?.replace(/\D/g, "") || ""; return cp === phone || phone.endsWith(cp) || cp.endsWith(phone.replace(/^55/, "")); });
        if (contact) {
          await supabase.from("contact_interactions").insert({ user_id: user.id, contact_id: contact.id, title: `WhatsApp: ${args.message.substring(0, 50)}...`, type: "whatsapp", description: args.message.substring(0, 500) });
        }
        return `[OK] 📱 WhatsApp enviado para ${args.contact_name || phone}: "${args.message.substring(0, 100)}${args.message.length > 100 ? "..." : ""}"`;
      } catch (e: any) { return `[ERRO] Falha ao enviar WhatsApp: ${e.message}`; }
    }
    case "get_whatsapp_conversations": {
      const convos = waConversationsRef.current;
      if (convos.length === 0) return "Nenhuma conversa WhatsApp encontrada.";
      return `📱 **Conversas WhatsApp** (${convos.length}):\n${convos.slice(0, 15).map((c: any) => `- **${c.title || c.external_contact_id}** ${c.unread_count > 0 ? `(${c.unread_count} não lidas)` : ""} — ${c.last_message_at ? new Date(c.last_message_at).toLocaleDateString("pt-BR") : ""}`).join("\n")}`;
    }
    case "get_whatsapp_chat_history": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const q = args.contact_name.toLowerCase();
      const conv = waConversationsRef.current.find((c: any) => (c.title || c.external_contact_id || "").toLowerCase().includes(q));
      if (!conv) return `Conversa com "${args.contact_name}" não encontrada.`;
      const limit = args.limit || 20;
      const { data: msgs } = await supabase.from("whatsapp_messages").select("direction,content_text,sent_at,status").eq("conversation_id", conv.id).order("sent_at", { ascending: false }).limit(limit);
      if (!msgs?.length) return `Nenhuma mensagem encontrada com "${args.contact_name}".`;
      return `📱 **Histórico com ${conv.title || conv.external_contact_id}** (${msgs.length}):\n${msgs.reverse().map((m: any) => `${m.direction === "outgoing" ? "➡️ Eu" : "⬅️ " + (conv.title || "Contato")}: ${(m.content_text || "").substring(0, 150)} — ${new Date(m.sent_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`).join("\n")}`;
    }

    // === Social ===
    case "get_social_accounts": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      if (socialAccountsRef.current.length === 0) {
        const { data } = await (supabase as any).from("social_accounts").select("id,platform,username,profile_name,profile_picture_url,is_active").eq("user_id", user.id).limit(20);
        socialAccountsRef.current = data || [];
      }
      if (socialAccountsRef.current.length === 0) return "Nenhuma conta de rede social conectada. Conecte em Social Media > Contas.";
      const platformEmoji: Record<string, string> = { instagram: "📸", facebook: "📘", twitter: "🐦", linkedin: "💼", tiktok: "🎵", youtube: "▶️", threads: "🧵", pinterest: "📌", bluesky: "🦋" };
      return `📱 **Contas Sociais** (${socialAccountsRef.current.length}):\n${socialAccountsRef.current.map((a: any) => `- ${platformEmoji[a.platform] || "📱"} **${a.profile_name || a.username}** (${a.platform}) ${a.is_active ? "✅" : "❌"}`).join("\n")}`;
    }
    case "create_social_post": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      try {
        const { data, error } = await invokeEdge<any>({ fn: "late-proxy", body: { path: "/post/create", method: "POST", body: { text: args.content, platforms: args.platforms, ...(args.schedule_date ? { scheduledDate: args.schedule_date } : {}), ...(args.media_urls?.length ? { mediaUrls: args.media_urls } : {}) } } });
        if (error) return `[ERRO] Falha ao criar post: ${error}`;
        if (data?.error) return `[ERRO] ${typeof data.error === 'string' ? data.error : JSON.stringify(data.error)}`;
        const status = args.schedule_date ? "agendado" : "publicado";
        return `[OK] 📝 Post ${status} em ${args.platforms.join(", ")}!\n\n"${args.content.substring(0, 100)}${args.content.length > 100 ? "..." : ""}"${args.schedule_date ? `\n📅 Agendado para: ${new Date(args.schedule_date).toLocaleString("pt-BR")}` : ""}`;
      } catch (e: any) { return `[ERRO] Falha ao criar post: ${e.message}`; }
    }
    case "get_social_posts": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const limit = args.limit || 10;
      const statusFilter = args.status || "all";
      let query = (supabase as any).from("social_posts").select("id,content,platforms,status,scheduled_at,published_at,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(limit);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data: posts } = await query;
      if (!posts?.length) return `Nenhum post ${statusFilter !== "all" ? `(${statusFilter}) ` : ""}encontrado.`;
      const statusEmoji: Record<string, string> = { published: "✅", scheduled: "📅", draft: "📝", failed: "❌", partial: "⚠️" };
      return `📱 **Posts** (${posts.length}):\n${posts.map((p: any) => `- ${statusEmoji[p.status] || "📋"} ${(p.content || "").substring(0, 60)}${(p.content || "").length > 60 ? "..." : ""}\n  Plataformas: ${Array.isArray(p.platforms) ? p.platforms.join(", ") : p.platforms} | ${p.status}${p.scheduled_at ? ` | 📅 ${new Date(p.scheduled_at).toLocaleString("pt-BR")}` : ""}`).join("\n")}`;
    }
    case "delete_social_post": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const { data: posts } = await (supabase as any).from("social_posts").select("id,content,status").eq("user_id", user.id).or(`content.ilike.%${args.post_identifier}%`).limit(5);
      let target = posts?.find((p: any) => p.id === args.post_identifier) || posts?.[0];
      if (!target) return `[ERRO] Post "${args.post_identifier}" não encontrado.`;
      if (target.status === "published") return `[ERRO] Não é possível excluir um post já publicado via esta interface.`;
      const { error } = await (supabase as any).from("social_posts").delete().eq("id", target.id);
      if (error) return `[ERRO] Falha ao excluir: ${error.message}`;
      return `[OK] 🗑️ Post excluído: "${(target.content || "").substring(0, 60)}..."`;
    }

    // === Open Banking ===
    case "get_bank_accounts": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      if (bankAccountsRef.current.length === 0) {
        const { data } = await (supabase as any).from("financial_accounts").select("id,name,type,current_balance,available_balance,institution_name,currency,credit_limit,connection_id").eq("user_id", user.id);
        bankAccountsRef.current = data || [];
      }
      if (bankAccountsRef.current.length === 0) return "Nenhuma conta bancária conectada. Conecte seus bancos em Finanças > Open Banking.";
      const typeEmoji: Record<string, string> = { checking: "🏦", savings: "💰", credit: "💳", investment: "📈" };
      const total = bankAccountsRef.current.reduce((s: number, a: any) => s + (["checking", "savings"].includes(a.type) ? (a.current_balance || 0) : 0), 0);
      return `🏦 **Contas Bancárias** (${bankAccountsRef.current.length}):\n${bankAccountsRef.current.map((a: any) => `- ${typeEmoji[a.type] || "🏦"} **${a.name || a.institution_name}** (${a.type})\n  Saldo: R$ ${(a.current_balance || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${a.credit_limit ? ` | Limite: R$ ${a.credit_limit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}`).join("\n")}\n\n💰 **Saldo total (corrente + poupança)**: R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    }
    case "get_investments": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      if (investmentsRef.current.length === 0) {
        const { data } = await (supabase as any).from("financial_investments").select("id,name,type,current_value,ticker,quantity,currency,cost_basis").eq("user_id", user.id);
        investmentsRef.current = data || [];
      }
      if (investmentsRef.current.length === 0) return "Nenhum investimento encontrado. Conecte seus bancos/corretoras em Finanças > Open Banking.";
      const total = investmentsRef.current.reduce((s: number, i: any) => s + (i.current_value || 0), 0);
      const typeEmoji: Record<string, string> = { MUTUAL_FUND: "📊", FIXED_INCOME: "🔒", EQUITY: "📈", ETF: "📉", CRYPTO: "₿", COE: "📋" };
      return `📈 **Investimentos** (${investmentsRef.current.length}):\n${investmentsRef.current.map((i: any) => `- ${typeEmoji[i.type] || "📊"} **${i.name}**${i.ticker ? ` (${i.ticker})` : ""}\n  Valor: R$ ${(i.current_value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${i.quantity ? ` | Qtd: ${i.quantity}` : ""}${i.cost_basis ? ` | Custo: R$ ${i.cost_basis.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}`).join("\n")}\n\n💎 **Total investido**: R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    }
    case "get_financial_connections": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      if (financialConnectionsRef.current.length === 0) {
        const { data } = await (supabase as any).from("financial_connections").select("id,provider,institution_name,status,last_synced_at").eq("user_id", user.id);
        financialConnectionsRef.current = data || [];
      }
      if (financialConnectionsRef.current.length === 0) return "Nenhuma instituição financeira conectada. Use Finanças > Open Banking para conectar seus bancos.";
      const statusEmoji: Record<string, string> = { active: "🟢", syncing: "🔄", error: "🔴", credentials_error: "🟡" };
      return `🔗 **Conexões Financeiras** (${financialConnectionsRef.current.length}):\n${financialConnectionsRef.current.map((c: any) => `- ${statusEmoji[c.status] || "⚪"} **${c.institution_name || c.provider}** — ${c.status}${c.last_synced_at ? `\n  Última sync: ${new Date(c.last_synced_at).toLocaleString("pt-BR")}` : ""}`).join("\n")}`;
    }
    case "get_bank_transactions": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const limit = args.limit || 20;
      let query = (supabase as any).from("financial_transactions_unified").select("id,description,amount,type,category,date,account_name,currency").eq("user_id", user.id).order("date", { ascending: false }).limit(limit);
      if (args.account_id) query = query.eq("account_id", args.account_id);
      const { data: txs } = await query;
      if (!txs?.length) return "Nenhuma transação bancária encontrada.";
      return `🏦 **Transações Bancárias** (${txs.length}):\n${txs.map((t: any) => `- ${t.type === "inflow" ? "📈" : "📉"} **${t.description || "Sem descrição"}**: R$ ${Math.abs(t.amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n  ${t.category || "Sem categoria"} | ${t.account_name || ""} | ${new Date(t.date).toLocaleDateString("pt-BR")}`).join("\n")}`;
    }

    // === Media Generation ===
    case "generate_image": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      try {
        const { data, error } = await invokeEdge<any>({ fn: "media-gen", body: { action: "image", prompt: args.prompt, style: args.style || "artistic", high_quality: args.style === "infographic" || args.style === "photo-realistic" } });
        if (error) return `[ERRO] Falha ao gerar imagem: ${error}`;
        if (data?.error) return `[ERRO] ${data.error}`;
        if (!data?.url) return "[ERRO] Não foi possível gerar a imagem. Tente um prompt diferente.";
        return `[OK] 🖼️ Imagem gerada com sucesso!\n\n![Imagem gerada](${data.url})\n\n[📥 Baixar imagem](${data.url})${data.text ? `\n\n${data.text}` : ""}`;
      } catch (e: any) { return `[ERRO] Falha ao gerar imagem: ${e.message}`; }
    }
    case "generate_pdf_report": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      try {
        const reportData: any = {};
        const rt = args.report_type;
        if (rt === "financial_report" || rt === "life_infographic" || rt === "weekly_summary") {
          const txs = financeTransactionsRef.current;
          const income = txs.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
          const expense = txs.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
          reportData.finance_summary = { income, expense, balance: income - expense };
          reportData.finance_goals = financeGoalsRef.current;
          reportData.finance_recurring = financeRecurringRef.current;
          reportData.recent_transactions = financeTransactionsRef.current.slice(0, 20);
          reportData.budgets = budgetsRef.current;
        }
        if (rt === "weekly_summary" || rt === "life_infographic") {
          reportData.tasks = ctx.state.tasks.map(t => ({ text: t.text, done: t.done, priority: t.priority, due_date: (t as any).due_date || null }));
          reportData.events = ctx.state.events.map(e => ({ day: e.day, month: e.month, year: e.year, label: e.label, category: e.category }));
          reportData.habits = ctx.habitsRef.current.data?.habits || [];
          reportData.contacts_count = contactsRef.current.length;
        }
        if (rt === "contacts_report") {
          reportData.contacts = contactsRef.current.map((c: any) => ({ name: c.name, email: resolveEmail(c), phone: resolvePhone(c), company: c.company, role: c.role, tags: c.tags }));
          reportData.interactions = interactionsRef.current.slice(0, 30);
        }
        const { data, error } = await invokeEdge<any>({ fn: "media-gen", body: { action: "pdf", report_type: rt, title: args.title || "Relatório", data: reportData } });
        if (error) return `[ERRO] Falha ao gerar relatório: ${error}`;
        if (data?.error) return `[ERRO] ${data.error}`;
        if (!data?.url) return "[ERRO] Não foi possível gerar o relatório.";
        return `[OK] 📄 Relatório gerado!\n\n[📥 Baixar PDF](${data.url})`;
      } catch (e: any) { return `[ERRO] Falha ao gerar relatório: ${e.message}`; }
    }

    // === Search ===
    case "search_web": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      try {
        const { data, error } = await invokeEdge<any>({ fn: "composio-proxy", body: { service: "serpapi", path: "/search", method: "GET", params: { q: args.query, num: String(args.limit || 5), gl: "br", hl: "pt-br" } } });
        if (error) return `[ERRO] Falha na busca: ${error}`;
        const results = data?.organic_results || data?.data?.organic_results || (Array.isArray(data) ? data : []);
        if (results.length === 0) return `Nenhum resultado encontrado para "${args.query}".`;
        return `🔍 **Resultados para "${args.query}"**:\n\n${results.slice(0, 5).map((r: any) => `🔗 **${r.title}**\n${r.snippet || ""}\n${r.link || ""}`).join("\n\n")}`;
      } catch (e: any) { return `[ERRO] Falha na busca: ${e.message}`; }
    }
    case "serp_search": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      try {
        const engine = args.engine || "google";
        const params: Record<string, string> = { q: args.query, num: String(args.num_results || 5), gl: args.country || "br", hl: args.language || "pt-br", engine };
        if (args.location) params.location = args.location;
        if (args.time_range) params.tbs = `qdr:${args.time_range}`;
        const { data, error } = await invokeEdge<any>({ fn: "serp-proxy", body: { action: "search", params } });
        if (error) return `[ERRO] Falha na busca: ${error}`;
        if (!data) return `Nenhum resultado para "${args.query}".`;
        let result = `🔍 **Busca ${engine}**: "${args.query}"\n\n`;
        if (engine === "google_shopping" && data?.shopping_results) { result += (data.shopping_results || []).slice(0, 5).map((s: any) => `🛒 **${s.title}** — ${s.price || "?"}\n  ${s.source || ""} ⭐${s.rating || "?"} (${s.reviews || 0})`).join("\n\n"); }
        else if (engine === "google_jobs" && data?.jobs_results) { result += (data.jobs_results || []).slice(0, 5).map((j: any) => `💼 **${j.title}** — ${j.company_name}\n  📍 ${j.location || "Remoto"} | ${j.via || ""}`).join("\n\n"); }
        else if (engine === "google_scholar" && data?.organic_results) { result += (data.organic_results || []).slice(0, 5).map((a: any) => `📄 **${a.title}**\n  ${a.publication_info?.summary || ""} | Citações: ${a.inline_links?.cited_by?.total || 0}`).join("\n\n"); }
        else if (engine === "google_news" && data?.news_results) { result += (data.news_results || []).slice(0, 5).map((n: any) => `📰 **${n.title}**\n  ${n.source?.name || ""} — ${n.date || ""}\n  ${n.link || ""}`).join("\n\n"); }
        else if (engine === "google_events" && data?.events_results) { result += (data.events_results || []).slice(0, 5).map((e: any) => `🎪 **${e.title}**\n  📍 ${e.venue?.name || ""} | 📅 ${e.date?.start_date || ""}`).join("\n\n"); }
        else if (engine === "youtube" && data?.video_results) { result += (data.video_results || []).slice(0, 5).map((v: any) => `🎬 **${v.title}**\n  📺 ${v.channel || ""} | 👁 ${v.views || ""} views | ${v.length || ""}\n  ${v.link || ""}`).join("\n\n"); }
        else if (engine === "google_maps" && data?.local_results) { result += (data.local_results || []).slice(0, 5).map((p: any) => `📍 **${p.title}**\n  ⭐ ${p.rating || "?"} (${p.reviews || 0}) | ${p.address || ""}\n  ${p.phone || ""} ${p.website ? `| [Site](${p.website})` : ""}`).join("\n\n"); }
        else if (engine === "google_patents" && data?.patent_results) { result += (data.patent_results || []).slice(0, 5).map((p: any) => `📜 **${p.title}**\n  ${p.patent_id || ""} | Inventor: ${p.inventor || "?"} | ${p.filing_date || ""}`).join("\n\n"); }
        else if (engine === "google_trends" && data?.interest_over_time) {
          const latest = data.interest_over_time?.slice(-3) || [];
          result += `📊 Interesse ao longo do tempo (últimos pontos):\n`;
          result += latest.map((t: any) => `  ${t.date}: ${(t.values || []).map((v: any) => `${v.query}=${v.value}`).join(", ")}`).join("\n");
          if (data.related_queries?.length) { result += `\n\n🔗 Consultas relacionadas:\n`; result += data.related_queries.flatMap((rq: any) => (rq.items || []).slice(0, 3).map((i: any) => `  • ${i.query} (${i.value || ""})`)).join("\n"); }
        } else if (data?.organic_results) { result += (data.organic_results || []).slice(0, 5).map((r: any) => `🔗 **${r.title}**\n  ${r.snippet || ""}\n  ${r.link || ""}`).join("\n\n"); }
        else { result += JSON.stringify(data).substring(0, 800); }
        return result;
      } catch (e: any) { return `[ERRO] Falha na busca especializada: ${e.message}`; }
    }

    // === Calendar Free Time ===
    case "find_free_time": {
      try {
        const now = new Date();
        const timeMin = args.date_start || now.toISOString();
        const timeMax = args.date_end || new Date(now.getTime() + 7 * 86400000).toISOString();
        const { data: freeSlots, error: freeErr } = await invokeEdge<any>({ fn: "composio-proxy", body: { service: "calendar", path: "/freeBusy", method: "POST", data: { time_min: timeMin, time_max: timeMax, calendar_id: "primary" } } });
        if (freeErr) return `[ERRO] Falha ao buscar horários livres: ${freeErr}`;
        const busy = freeSlots?.calendars?.primary?.busy || freeSlots?.busy || freeSlots?.data?.busy || [];
        if (busy.length === 0) return `[OK] 📅 Você está completamente livre entre ${new Date(timeMin).toLocaleDateString("pt-BR")} e ${new Date(timeMax).toLocaleDateString("pt-BR")}!`;
        const busyFormatted = busy.map((b: any) => { const start = new Date(b.start); const end = new Date(b.end); return `- ${start.toLocaleDateString("pt-BR")} ${start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} – ${end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`; }).join("\n");
        return `[OK] 📅 Horários **ocupados** no período:\n${busyFormatted}\n\nOs demais horários estão livres.`;
      } catch (e: any) { return `[ERRO] Falha ao buscar horários: ${e.message}`; }
    }

    default:
      return null; // Not handled by this module
  }
}

/** Tool names handled by this module */
export const INTEGRATION_TOOL_NAMES = new Set([
  "get_emails", "search_emails", "get_email_stats", "trash_emails", "archive_emails",
  "star_emails", "mark_emails_read", "send_email", "reply_email", "create_draft_email",
  "get_files", "search_files", "delete_file", "move_file_to_folder", "get_folders",
  "trash_file", "restore_file", "get_file_stats",
  "get_whatsapp_status", "send_whatsapp", "get_whatsapp_conversations", "get_whatsapp_chat_history",
  "send_whatsapp_media", "mark_whatsapp_read", "react_to_whatsapp",
  "create_social_post", "get_social_accounts", "get_social_posts", "delete_social_post",
  "find_free_time",
]);
