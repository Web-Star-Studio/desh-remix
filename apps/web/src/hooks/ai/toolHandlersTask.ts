/**
 * AI Tool Handlers — Tasks, Notes, Calendar, Habits, Subtasks
 * Extracted from useAIToolExecution for maintainability.
 */
import type { ToolContext } from "./toolContext";

export async function handleTaskTool(name: string, args: Record<string, any>, ctx: ToolContext): Promise<string | null> {
  const { state, addTask, toggleTask, updateTask, deleteTask, addNote, updateNote, deleteNote, addEvent, updateEvent, deleteEvent, user, supabase, invokeEdge, subtasksRef, habitsRef, verifyTaskInDb, verifyNoteInDb, invalidateGoogleCache } = ctx;

  switch (name) {
    case "add_task": {
      try {
        addTask(args.title, args.priority || "medium");
        if (args.due_date && user) {
          const verified = await verifyTaskInDb(user.id, args.title);
          if (verified) {
            await supabase.from("tasks").update({ due_date: args.due_date, project: args.project || null } as any)
              .eq("user_id", user.id).ilike("title", args.title);
          }
        } else {
          await verifyTaskInDb(user!.id, args.title);
        }
        const extras = [args.due_date ? `prazo: ${args.due_date}` : "", args.project ? `projeto: ${args.project}` : ""].filter(Boolean).join(", ");
        return `[OK] Tarefa "${args.title}" criada (${args.priority || "medium"})${extras ? ` [${extras}]` : ""}.`;
      } catch (e) {
        return `[ERRO] Falha ao criar tarefa: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    case "complete_task": {
      const task = state.tasks.find(t => t.text.toLowerCase().includes(args.task_identifier.toLowerCase()) || t.id === args.task_identifier);
      if (task) { toggleTask(task.id); return `[OK] Tarefa "${task.text}" marcada como ${task.done ? "pendente" : "concluída"}.`; }
      return `[ERRO] Tarefa "${args.task_identifier}" não encontrada.`;
    }
    case "batch_complete_tasks": {
      const ids = args.task_identifiers || [];
      const results: string[] = [];
      for (const id of ids) {
        const task = state.tasks.find(t => t.text.toLowerCase().includes(id.toLowerCase()) || t.id === id);
        if (task) { toggleTask(task.id); results.push(`✅ ${task.text}`); }
        else results.push(`❌ "${id}" não encontrada`);
      }
      const ok = results.filter(r => r.startsWith("✅")).length;
      return `[OK] ${ok}/${ids.length} tarefas concluídas:\n${results.join("\n")}`;
    }
    case "delete_task": {
      const task = state.tasks.find(t => t.text.toLowerCase().includes(args.task_identifier.toLowerCase()) || t.id === args.task_identifier);
      if (task) { deleteTask(task.id); return `[OK] Tarefa "${task.text}" excluída.`; }
      return `[ERRO] Tarefa "${args.task_identifier}" não encontrada.`;
    }
    case "edit_task": {
      const task = state.tasks.find(t => t.text.toLowerCase().includes(args.task_identifier.toLowerCase()) || t.id === args.task_identifier);
      if (!task) return `[ERRO] Tarefa "${args.task_identifier}" não encontrada.`;
      const changes: Record<string, any> = {};
      if (args.new_title) changes.text = args.new_title;
      if (args.new_priority) changes.priority = args.new_priority;
      if (args.new_due_date) changes.due_date = args.new_due_date;
      if (args.new_project) changes.project = args.new_project;
      if (Object.keys(changes).length === 0) return `Nenhuma alteração especificada para a tarefa "${task.text}".`;
      updateTask(task.id, changes);
      if (args.new_due_date || args.new_project) {
        await supabase.from("tasks").update({ due_date: args.new_due_date || null, project: args.new_project || null } as any).eq("id", task.id);
      }
      return `[OK] Tarefa "${task.text}" atualizada.`;
    }
    case "get_tasks": {
      const filter = args.filter || "all";
      let filtered = state.tasks;
      if (filter === "pending") filtered = state.tasks.filter(t => !t.done);
      else if (filter === "done") filtered = state.tasks.filter(t => t.done);
      else if (filter === "high_priority") filtered = state.tasks.filter(t => t.priority === "high" || (t as any).priority === "urgent");
      else if (filter === "overdue") {
        const today = new Date().toISOString().split("T")[0];
        filtered = state.tasks.filter(t => !t.done && (t as any).due_date && (t as any).due_date < today);
      }
      if (filtered.length === 0) return filter === "all" ? "Nenhuma tarefa encontrada." : `Nenhuma tarefa ${filter} encontrada.`;
      return `Tarefas${filter !== "all" ? ` (${filter})` : ""} (${filtered.length}):\n${filtered.map(t => `- ${t.done ? "✅" : "⬜"} ${t.text} (${t.priority || "medium"})${(t as any).due_date ? ` 📅${(t as any).due_date}` : ""}${(t as any).project ? ` 📁${(t as any).project}` : ""}`).join("\n")}`;
    }
    case "add_note": {
      try {
        const note = addNote(args.title, args.content);
        const verified = await verifyNoteInDb(note.id);
        if (!verified) return `[ERRO] Nota "${args.title}" foi criada localmente mas NÃO foi confirmada no banco de dados.`;
        return `[OK] Nota "${args.title}" criada e verificada no banco.`;
      } catch (e) {
        return `[ERRO] Falha ao criar nota: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    case "edit_note": {
      const note = state.notes.find(n => n.title.toLowerCase().includes(args.note_identifier.toLowerCase()) || n.id === args.note_identifier);
      if (!note) return `[ERRO] Nota "${args.note_identifier}" não encontrada.`;
      const changes: Partial<{ title: string; content: string }> = {};
      if (args.new_title) changes.title = args.new_title;
      if (args.new_content) changes.content = args.new_content;
      updateNote(note.id, changes);
      return `[OK] Nota "${note.title}" atualizada.`;
    }
    case "delete_note": {
      const note = state.notes.find(n => n.title.toLowerCase().includes(args.note_identifier.toLowerCase()) || n.id === args.note_identifier);
      if (note) { deleteNote(note.id); return `[OK] Nota "${note.title}" excluída.`; }
      return `[ERRO] Nota "${args.note_identifier}" não encontrada.`;
    }
    case "favorite_note": {
      const note = state.notes.find(n => n.title.toLowerCase().includes(args.note_identifier.toLowerCase()) || n.id === args.note_identifier);
      if (!note) return `[ERRO] Nota "${args.note_identifier}" não encontrada.`;
      updateNote(note.id, { favorited: args.favorited });
      return `[OK] Nota "${note.title}" ${args.favorited ? "favoritada" : "desfavoritada"}.`;
    }
    case "set_note_tags": {
      const note = state.notes.find(n => n.title.toLowerCase().includes(args.note_identifier.toLowerCase()) || n.id === args.note_identifier);
      if (!note) return `[ERRO] Nota "${args.note_identifier}" não encontrada.`;
      updateNote(note.id, { tags: args.tags });
      return `[OK] Tags da nota "${note.title}" definidas como: ${args.tags.join(", ")}.`;
    }
    case "get_notes":
      if (state.notes.length === 0) return "Nenhuma nota encontrada.";
      return `Notas atuais:\n${state.notes.map(n => `- **${n.title}**: ${n.content.substring(0, 50)}...`).join("\n")}`;
    case "add_calendar_event": {
      const now = new Date();
      const day = args.day;
      const rawMonth = args.month as number | undefined;
      const month = rawMonth != null ? rawMonth - 1 : now.getMonth();
      const year = args.year ?? now.getFullYear();
      try {
        addEvent(day, month, year, args.label, args.category || "outro");
        let googleOk = false;
        try {
          const timeMatch = (args.label as string).match(/^(\d{1,2}):(\d{2})\s*[-–]\s*/);
          let eventSummary = args.label;
          let eventStart = new Date(year, month, day, 9, 0).toISOString();
          let eventEnd = new Date(year, month, day, 10, 0).toISOString();
          if (timeMatch) {
            const h = parseInt(timeMatch[1], 10);
            const m = parseInt(timeMatch[2], 10);
            eventStart = new Date(year, month, day, h, m).toISOString();
            eventEnd = new Date(year, month, day, h + 1, m).toISOString();
            eventSummary = (args.label as string).replace(timeMatch[0], "").trim();
          }
          const { error: gErr } = await invokeEdge<any>({
            fn: "composio-proxy",
            body: { service: "calendar", path: "/calendars/primary/events", method: "POST", data: { summary: eventSummary, start_datetime: eventStart, end_datetime: eventEnd, calendar_id: "primary" } },
          });
          googleOk = !gErr;
          if (googleOk) invalidateGoogleCache("calendar");
        } catch { /* Google creation is best-effort */ }
        if (!googleOk) invalidateGoogleCache("calendar");
        const googleStatus = googleOk ? " + Google Calendar" : "";
        return `[OK] Evento "${args.label}" criado e salvo para ${day}/${month + 1}/${year}${googleStatus}.`;
      } catch (e) {
        return `[ERRO] Falha ao criar evento: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    case "edit_calendar_event": {
      const event = state.events.find(e => e.label.toLowerCase().includes(args.event_identifier.toLowerCase()) || e.id === args.event_identifier);
      if (!event) {
        try {
          const now = new Date();
          const timeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          const timeMax = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();
          const { data: gEvents } = await invokeEdge<any>({ fn: "composio-proxy", body: { service: "calendar", path: "/calendars/primary/events", method: "GET", params: { timeMin, timeMax, singleEvents: "true", maxResults: "50" } } });
          const items = gEvents?.event_data || gEvents?.data?.event_data || gEvents?.items || (Array.isArray(gEvents) ? gEvents : []);
          const match = items.find((e: any) => (e.summary || "").toLowerCase().includes(args.event_identifier.toLowerCase()) || e.id === args.event_identifier);
          if (match) {
            const patchBody: any = { event_id: match.id, calendar_id: "primary" };
            if (args.new_label) patchBody.summary = args.new_label;
            if (args.new_day !== undefined || args.new_month !== undefined || args.new_year !== undefined) {
              const origStart = new Date(match.start?.dateTime || match.start?.date);
              const nd = args.new_day ?? origStart.getDate();
              const nm = args.new_month != null ? args.new_month - 1 : origStart.getMonth();
              const ny = args.new_year ?? origStart.getFullYear();
              patchBody.start_datetime = new Date(ny, nm, nd, origStart.getHours(), origStart.getMinutes()).toISOString();
              patchBody.end_datetime = new Date(ny, nm, nd, origStart.getHours() + 1, origStart.getMinutes()).toISOString();
            }
            const { error: gErr } = await invokeEdge<any>({ fn: "composio-proxy", body: { service: "calendar", path: `/calendars/primary/events/${match.id}`, method: "PATCH", data: patchBody } });
            if (gErr) return `[ERRO] Falha ao editar evento no Google Calendar: ${gErr}`;
            return `[OK] Evento "${match.summary}" atualizado no Google Calendar.`;
          }
        } catch { /* fallthrough */ }
        return `[ERRO] Evento "${args.event_identifier}" não encontrado.`;
      }
      const changes: Record<string, any> = {};
      if (args.new_label) changes.label = args.new_label;
      if (args.new_day !== undefined) changes.day = args.new_day;
      if (args.new_month !== undefined) changes.month = args.new_month - 1;
      if (args.new_year !== undefined) changes.year = args.new_year;
      if (args.new_category) changes.category = args.new_category;
      updateEvent(event.id, changes);
      invalidateGoogleCache("calendar");
      return `[OK] Evento "${event.label}" atualizado.`;
    }
    case "delete_calendar_event": {
      const event = state.events.find(e => e.label.toLowerCase().includes(args.event_identifier.toLowerCase()) || e.id === args.event_identifier);
      if (!event) {
        try {
          const now = new Date();
          const timeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          const timeMax = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();
          const { data: gEvents } = await invokeEdge<any>({ fn: "composio-proxy", body: { service: "calendar", path: "/calendars/primary/events", method: "GET", params: { timeMin, timeMax, singleEvents: "true", maxResults: "50" } } });
          const items = gEvents?.event_data || gEvents?.data?.event_data || gEvents?.items || (Array.isArray(gEvents) ? gEvents : []);
          const match = items.find((e: any) => (e.summary || "").toLowerCase().includes(args.event_identifier.toLowerCase()) || e.id === args.event_identifier);
          if (match) {
            const { error: gErr } = await invokeEdge<any>({ fn: "composio-proxy", body: { service: "calendar", path: `/calendars/primary/events/${match.id}`, method: "DELETE", data: { event_id: match.id, calendar_id: "primary" } } });
            if (gErr) return `[ERRO] Falha ao excluir evento no Google Calendar: ${gErr}`;
            invalidateGoogleCache("calendar");
            return `[OK] Evento "${match.summary}" excluído do Google Calendar.`;
          }
        } catch { /* fallthrough */ }
        return `[ERRO] Evento "${args.event_identifier}" não encontrado.`;
      }
      deleteEvent(event.id);
      invalidateGoogleCache("calendar");
      return `[OK] Evento "${event.label}" excluído.`;
    }
    case "set_event_category": {
      const event = state.events.find(e => e.label.toLowerCase().includes(args.event_identifier.toLowerCase()) || e.id === args.event_identifier);
      if (!event) return `[ERRO] Evento "${args.event_identifier}" não encontrado.`;
      updateEvent(event.id, { category: args.category });
      return `[OK] Categoria do evento "${event.label}" definida como "${args.category}".`;
    }
    case "get_calendar_events": {
      if (user) {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
        const { data: cached } = await supabase.from('calendar_events_cache').select('*').eq('user_id', user.id).gte('start_at', monthStart).lte('start_at', monthEnd).order('start_at', { ascending: true }).limit(50);
        if (cached && cached.length > 0) {
          const formatted = cached.map((e: any) => { const d = new Date(e.start_at); return `- ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}: ${e.title || "Sem título"}`; }).join("\n");
          const localEvents = state.events.filter(e => e.month === now.getMonth() && e.year === now.getFullYear());
          const localFormatted = localEvents.length > 0 ? "\n[Eventos locais]:\n" + localEvents.map(e => `- ${e.day}/${e.month + 1}/${e.year}: ${e.label} (${e.category || "outro"})`).join("\n") : "";
          return `Eventos do calendário (cache, ${cached.length}):\n${formatted}${localFormatted}`;
        }
      }
      try {
        const now = new Date();
        const timeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const timeMax = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
        const { data: gEvents } = await invokeEdge<any>({ fn: "composio-proxy", body: { service: "calendar", path: "/calendars/primary/events", method: "GET", params: { timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "50" } } });
        const items = gEvents?.event_data || gEvents?.data?.event_data || gEvents?.items || (Array.isArray(gEvents) ? gEvents : []);
        if (items.length > 0) {
          const formatted = items.map((e: any) => { const start = e.start?.dateTime || e.start?.date || ""; const d = new Date(start); return `- ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}: ${e.summary || "Sem título"}`; }).join("\n");
          const localEvents = state.events.filter(e => e.month === now.getMonth() && e.year === now.getFullYear());
          const localFormatted = localEvents.length > 0 ? "\n[Eventos locais]:\n" + localEvents.map(e => `- ${e.day}/${e.month + 1}/${e.year}: ${e.label} (${e.category || "outro"})`).join("\n") : "";
          return `Eventos do Google Calendar:\n${formatted}${localFormatted}`;
        }
      } catch { /* fallback to local */ }
      if (state.events.length === 0) return "Nenhum evento encontrado.";
      return `Eventos:\n${state.events.map(e => `- ${e.day}/${e.month + 1}/${e.year}: ${e.label} (${e.category || "outro"})`).join("\n")}`;
    }
    // Subtasks
    case "add_subtask": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const task = state.tasks.find(t => t.text.toLowerCase().includes(args.task_identifier.toLowerCase()) || t.id === args.task_identifier);
      if (!task) return `[ERRO] Tarefa "${args.task_identifier}" não encontrada.`;
      const { data: inserted, error } = await supabase.from("task_subtasks" as any).insert({ task_id: task.id, title: args.title, sort_order: subtasksRef.current.filter((s: any) => s.task_id === task.id).length } as any).select("id,title,completed,task_id,sort_order").single();
      if (error || !inserted) return `[ERRO] Falha ao criar subtarefa: ${error?.message || "sem retorno"}`;
      subtasksRef.current = [...subtasksRef.current, inserted];
      return `[OK] Subtarefa "${args.title}" adicionada à tarefa "${task.text}".`;
    }
    case "complete_subtask": {
      const task = state.tasks.find(t => t.text.toLowerCase().includes(args.task_identifier.toLowerCase()) || t.id === args.task_identifier);
      if (!task) return `[ERRO] Tarefa "${args.task_identifier}" não encontrada.`;
      const subtask = subtasksRef.current.find((s: any) => s.task_id === task.id && s.title.toLowerCase().includes(args.subtask_title.toLowerCase()));
      if (!subtask) return `[ERRO] Subtarefa "${args.subtask_title}" não encontrada.`;
      const newCompleted = !subtask.completed;
      const { error } = await supabase.from("task_subtasks" as any).update({ completed: newCompleted } as any).eq("id", subtask.id);
      if (error) return `[ERRO] Falha ao atualizar subtarefa: ${error.message}`;
      subtask.completed = newCompleted;
      return `[OK] Subtarefa "${subtask.title}" marcada como ${newCompleted ? "concluída ✅" : "pendente ⬜"}.`;
    }
    case "delete_subtask": {
      const task = state.tasks.find(t => t.text.toLowerCase().includes(args.task_identifier.toLowerCase()) || t.id === args.task_identifier);
      if (!task) return `[ERRO] Tarefa "${args.task_identifier}" não encontrada.`;
      const subtask = subtasksRef.current.find((s: any) => s.task_id === task.id && s.title.toLowerCase().includes(args.subtask_title.toLowerCase()));
      if (!subtask) return `[ERRO] Subtarefa "${args.subtask_title}" não encontrada.`;
      const { error } = await supabase.from("task_subtasks" as any).delete().eq("id", subtask.id);
      if (error) return `[ERRO] Falha ao excluir subtarefa: ${error.message}`;
      subtasksRef.current = subtasksRef.current.filter((s: any) => s.id !== subtask.id);
      return `[OK] Subtarefa "${subtask.title}" excluída.`;
    }
    case "get_subtasks": {
      const task = state.tasks.find(t => t.text.toLowerCase().includes(args.task_identifier.toLowerCase()) || t.id === args.task_identifier);
      if (!task) return `[ERRO] Tarefa "${args.task_identifier}" não encontrada.`;
      const subs = subtasksRef.current.filter((s: any) => s.task_id === task.id);
      if (subs.length === 0) return `Tarefa "${task.text}" não tem subtarefas.`;
      return `Subtarefas de "${task.text}":\n${subs.map((s: any) => `- ${s.completed ? "✅" : "⬜"} ${s.title}`).join("\n")}`;
    }
    // Habits
    case "get_habits": {
      const habits = habitsRef.current.data?.habits || [];
      if (habits.length === 0) return "Nenhum hábito cadastrado.";
      return `Hábitos (${habits.length}):\n${habits.map((h: any) => `- ${h.completedToday ? "✅" : "⬜"} **${h.name}** 🔥${h.streak} ${h.category ? `(${h.category})` : ""}`).join("\n")}`;
    }
    case "add_habit": {
      if (!user) return "[ERRO] Usuário não autenticado.";
      const hData = habitsRef.current.data || { habits: [], date: new Date().toDateString(), dailyGoal: 3, history: {}, reminderEnabled: false, reminderTime: "08:00", lastNotifiedDate: null };
      const newHabit = { id: crypto.randomUUID(), name: args.name, streak: 0, completedToday: false, category: args.category || "Outro" };
      hData.habits = [...hData.habits, newHabit];
      try {
        if (habitsRef.current.rowId) {
          const { error: hErr } = await supabase.from("user_data").update({ data: hData as any, updated_at: new Date().toISOString() }).eq("id", habitsRef.current.rowId);
          if (hErr) return `[ERRO] Falha ao salvar hábito: ${hErr.message}`;
        } else {
          const { data: inserted, error: hErr } = await supabase.from("user_data").insert({ user_id: user.id, data_type: "habits", data: hData as any } as any).select("id").single();
          if (hErr || !inserted) return `[ERRO] Falha ao criar hábito: ${hErr?.message || "sem retorno"}`;
          habitsRef.current.rowId = inserted.id;
        }
        habitsRef.current.data = hData;
        return `[OK] Hábito "${args.name}" criado ${args.category ? `na categoria ${args.category}` : ""}.`;
      } catch (e) {
        return `[ERRO] Falha ao criar hábito: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    case "complete_habit": {
      const hData = habitsRef.current.data;
      if (!hData?.habits?.length) return "[ERRO] Nenhum hábito cadastrado.";
      const habit = hData.habits.find((h: any) => h.name.toLowerCase().includes(args.habit_identifier.toLowerCase()) || h.id === args.habit_identifier);
      if (!habit) return `[ERRO] Hábito "${args.habit_identifier}" não encontrado.`;
      const today = new Date().toDateString();
      if (hData.date !== today) { hData.habits.forEach((h: any) => { if (!h.completedToday) h.streak = 0; h.completedToday = false; }); hData.date = today; }
      habit.completedToday = !habit.completedToday;
      if (habit.completedToday) habit.streak = (habit.streak || 0) + 1;
      else habit.streak = Math.max(0, (habit.streak || 0) - 1);
      if (habitsRef.current.rowId) {
        const { error } = await supabase.from("user_data").update({ data: hData as any, updated_at: new Date().toISOString() }).eq("id", habitsRef.current.rowId);
        if (error) return `[ERRO] Falha ao salvar hábito: ${error.message}`;
      }
      habitsRef.current.data = hData;
      return `[OK] Hábito "${habit.name}" ${habit.completedToday ? "completado ✅" : "desmarcado ⬜"} (🔥 ${habit.streak} dias).`;
    }
    case "delete_habit": {
      const hData = habitsRef.current.data;
      if (!hData?.habits?.length) return "[ERRO] Nenhum hábito cadastrado.";
      const habit = hData.habits.find((h: any) => h.name.toLowerCase().includes(args.habit_identifier.toLowerCase()) || h.id === args.habit_identifier);
      if (!habit) return `[ERRO] Hábito "${args.habit_identifier}" não encontrado.`;
      hData.habits = hData.habits.filter((h: any) => h.id !== habit.id);
      if (habitsRef.current.rowId) {
        const { error } = await supabase.from("user_data").update({ data: hData as any, updated_at: new Date().toISOString() }).eq("id", habitsRef.current.rowId);
        if (error) return `[ERRO] Falha ao excluir hábito: ${error.message}`;
      }
      habitsRef.current.data = hData;
      return `[OK] Hábito "${habit.name}" excluído.`;
    }
    // Smart tools that combine tasks + calendar
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
        else if (hint.includes("sábado") || hint.includes("sabado")) targetDate.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7 || 7));
        else if (hint.includes("domingo")) targetDate.setDate(now.getDate() + ((0 - now.getDay() + 7) % 7 || 7));
        else targetDate.setDate(now.getDate() + 1);
        const dueDate = targetDate.toISOString().split("T")[0];
        if (user) {
          const verified = await verifyTaskInDb(user.id, what);
          if (verified) await supabase.from("tasks").update({ due_date: dueDate } as any).eq("user_id", user.id).ilike("title", what);
        }
        let eventHour = 9;
        if (hint.includes("manhã") || hint.includes("manha")) eventHour = 9;
        else if (hint.includes("tarde")) eventHour = 14;
        else if (hint.includes("noite")) eventHour = 19;
        const eventLabel = `${String(eventHour).padStart(2, "0")}:00 - 🔔 ${what}`;
        addEvent(targetDate.getDate(), targetDate.getMonth(), targetDate.getFullYear(), eventLabel, "pessoal");
        return `[OK] 🔔 Lembrete criado!\n- 📋 Tarefa: "${what}" (${priority}) — prazo: ${dueDate}\n- 📅 Evento: ${targetDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })} às ${eventHour}h`;
      } catch (e) {
        return `[ERRO] Falha ao criar lembrete: ${e instanceof Error ? e.message : String(e)}`;
      }
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
      plan += `💡 _Dica: Complete primeiro as tarefas atrasadas e de alta prioridade!_`;
      return plan;
    }
    case "weekly_review": {
      const done = state.tasks.filter(t => t.done);
      const pending = state.tasks.filter(t => !t.done);
      const txs = ctx.financeTransactionsRef.current;
      const income = txs.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const expense = txs.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const habits = habitsRef.current.data?.habits || [];
      const completedHabits = habits.filter((h: any) => h.completedToday).length;
      const topStreak = habits.reduce((max: any, h: any) => (h.streak > (max?.streak || 0) ? h : max), null as any);
      let review = `📊 **Revisão Semanal**\n\n`;
      review += `✅ **Tarefas**: ${done.length} concluídas, ${pending.length} pendentes\n`;
      review += `💰 **Finanças**: Receita R$${income.toFixed(2)} | Despesa R$${expense.toFixed(2)} | Saldo R$${(income - expense).toFixed(2)}\n`;
      review += `🏋️ **Hábitos**: ${completedHabits}/${habits.length} completados hoje${topStreak ? ` | 🔥 Melhor streak: ${topStreak.name} (${topStreak.streak} dias)` : ""}\n`;
      review += `📅 **Eventos**: ${state.events.length} no calendário\n`;
      if (pending.filter(t => t.priority === "high").length > 0) review += `\n⚠️ **Atenção**: ${pending.filter(t => t.priority === "high").length} tarefa(s) de alta prioridade pendente(s)!`;
      return review;
    }
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
      } catch (e: any) {
        return `[ERRO] Falha ao buscar horários: ${e.message}`;
      }
    }
    default:
      return null; // Not handled by this module
  }
}

/** Tool names handled by this module */
export const TASK_TOOL_NAMES = new Set([
  "add_task", "complete_task", "batch_complete_tasks", "delete_task", "edit_task", "get_tasks",
  "add_note", "edit_note", "delete_note", "favorite_note", "set_note_tags", "get_notes",
  "add_calendar_event", "edit_calendar_event", "delete_calendar_event", "set_event_category", "get_calendar_events",
  "add_subtask", "complete_subtask", "delete_subtask", "get_subtasks",
  "get_habits", "add_habit", "complete_habit", "delete_habit",
  "smart_reminder", "plan_my_day", "weekly_review", "find_free_time",
]);
