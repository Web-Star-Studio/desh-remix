// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export type TemplateCategory = "saudação" | "despedida" | "follow-up" | "informativo" | "outro";

export const TEMPLATE_CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: "saudação", label: "Saudação" },
  { value: "despedida", label: "Despedida" },
  { value: "follow-up", label: "Follow-up" },
  { value: "informativo", label: "Informativo" },
  { value: "outro", label: "Outro" },
];

export interface EmailTemplate {
  id: string;
  name: string;
  body: string;
  category: TemplateCategory;
  favorited?: boolean;
}

const DEFAULT_TEMPLATES: EmailTemplate[] = [
  { id: "t1", name: "Agradecimento", body: "Muito obrigado(a) pela sua mensagem. Agradeço a atenção e retorno em breve.", category: "saudação" },
  { id: "t2", name: "Confirmação de recebimento", body: "Confirmo o recebimento da sua mensagem. Analisarei o conteúdo e retornarei o mais breve possível.", category: "informativo" },
  { id: "t3", name: "Ausência temporária", body: "No momento estou ausente e com acesso limitado ao e-mail. Retornarei sua mensagem assim que possível.", category: "informativo" },
];

export function useEmailTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>(DEFAULT_TEMPLATES);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState<"reply" | "compose" | null>(null);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateBody, setNewTemplateBody] = useState("");
  const [newTemplateCategory, setNewTemplateCategory] = useState<TemplateCategory>("outro");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateSort, setTemplateSort] = useState<"manual" | "favorites" | "name-asc" | "name-desc" | "newest" | "oldest">("manual");
  const [dragTemplateId, setDragTemplateId] = useState<string | null>(null);
  const [dragOverTemplateId, setDragOverTemplateId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<"above" | "below">("above");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredTemplates = useMemo(() => {
    let list = templates;
    if (templateSearch.trim()) {
      const q = templateSearch.toLowerCase();
      list = list.filter(t => t.name.toLowerCase().includes(q) || t.body.toLowerCase().includes(q));
    }
    if (templateSort === "favorites") {
      list = [...list].sort((a, b) => (b.favorited ? 1 : 0) - (a.favorited ? 1 : 0));
    } else if (templateSort !== "manual") {
      const sorted = [...list];
      switch (templateSort) {
        case "name-asc": sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
        case "name-desc": sorted.sort((a, b) => b.name.localeCompare(a.name)); break;
        case "newest": sorted.sort((a, b) => b.id.localeCompare(a.id)); break;
        case "oldest": sorted.sort((a, b) => a.id.localeCompare(b.id)); break;
      }
      list = sorted;
    }
    return list;
  }, [templates, templateSearch, templateSort]);

  const toggleTemplateFavorite = useCallback((id: string) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, favorited: !t.favorited } : t));
  }, []);

  const handleTemplateDragOver = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragTemplateId || dragTemplateId === targetId || templateSort !== "manual") return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    setDragOverTemplateId(targetId);
    setDragOverPosition(e.clientY < midY ? "above" : "below");
  }, [dragTemplateId, templateSort]);

  const handleTemplateDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!dragTemplateId || !dragOverTemplateId || dragTemplateId === dragOverTemplateId || templateSort !== "manual") return;
    setTemplates(prev => {
      const fromIdx = prev.findIndex(t => t.id === dragTemplateId);
      const toIdx = prev.findIndex(t => t.id === dragOverTemplateId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      const insertIdx = dragOverPosition === "below" ? (toIdx > fromIdx ? toIdx : toIdx + 1) : (toIdx > fromIdx ? toIdx - 1 : toIdx);
      next.splice(Math.max(0, insertIdx), 0, moved);
      return next;
    });
    setDragTemplateId(null);
    setDragOverTemplateId(null);
  }, [dragTemplateId, dragOverTemplateId, dragOverPosition, templateSort]);

  // Load templates from DB
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("user_data")
        .select("data")
        .eq("user_id", user.id)
        .eq("data_type", "email_templates")
        .maybeSingle();
      if (data?.data) {
        const parsed = data.data as unknown as EmailTemplate[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTemplates(parsed);
        }
      }
      setTemplatesLoaded(true);
    };
    load();
  }, [user]);

  // Save templates to DB with 1.5s debounce
  useEffect(() => {
    if (!user || !templatesLoaded) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const { data: existing } = await supabase
        .from("user_data")
        .select("id")
        .eq("user_id", user.id)
        .eq("data_type", "email_templates")
        .maybeSingle();
      if (existing) {
        await supabase.from("user_data").update({ data: JSON.parse(JSON.stringify(templates)) }).eq("id", existing.id);
      } else {
        await supabase.from("user_data").insert([{ user_id: user.id, data_type: "email_templates", data: JSON.parse(JSON.stringify(templates)) }]);
      }
    }, 1500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [templates, user, templatesLoaded]);

  const addTemplate = useCallback(() => {
    if (!newTemplateName.trim() || !newTemplateBody.trim()) return;
    const id = "tpl-" + Date.now();
    setTemplates(prev => [...prev, { id, name: newTemplateName.trim(), body: newTemplateBody.trim(), category: newTemplateCategory }]);
    setNewTemplateName("");
    setNewTemplateBody("");
    toast({ title: "Template salvo", description: newTemplateName.trim() });
  }, [newTemplateName, newTemplateBody, newTemplateCategory]);

  const duplicateTemplate = useCallback((tpl: EmailTemplate) => {
    const dup: EmailTemplate = {
      id: "tpl-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      name: tpl.name + " (cópia)",
      body: tpl.body,
      category: tpl.category,
    };
    setTemplates(prev => [...prev, dup]);
    toast({ title: "Template duplicado", description: dup.name });
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast({ title: "Template removido" });
  }, []);

  const startEditTemplate = useCallback((tpl: EmailTemplate) => {
    setEditingTemplateId(tpl.id);
    setNewTemplateName(tpl.name);
    setNewTemplateBody(tpl.body);
    setNewTemplateCategory(tpl.category);
  }, []);

  const saveEditTemplate = useCallback(() => {
    if (!editingTemplateId || !newTemplateName.trim() || !newTemplateBody.trim()) return;
    setTemplates(prev => prev.map(t => t.id === editingTemplateId ? { ...t, name: newTemplateName.trim(), body: newTemplateBody.trim(), category: newTemplateCategory } : t));
    setEditingTemplateId(null);
    setNewTemplateName("");
    setNewTemplateBody("");
    setNewTemplateCategory("outro");
    toast({ title: "Template atualizado" });
  }, [editingTemplateId, newTemplateName, newTemplateBody, newTemplateCategory]);

  const insertTemplate = useCallback((tpl: EmailTemplate, target: "reply" | "compose"): { target: "reply" | "compose"; body: string } => {
    setShowTemplateMenu(null);
    setTemplateSearch("");
    toast({ title: "Template inserido", description: tpl.name });
    return { target, body: tpl.body };
  }, []);

  const saveAsTemplate = useCallback((body: string) => {
    if (!body.trim()) return;
    const name = window.prompt("Nome do template:");
    if (!name?.trim()) return;
    const id = "tpl-" + Date.now();
    setTemplates(prev => [...prev, { id, name: name.trim(), body: body.trim(), category: "outro" as TemplateCategory }]);
    toast({ title: "Template salvo", description: name.trim() });
  }, []);

  const exportTemplates = useCallback(() => {
    const json = JSON.stringify(templates, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `email-templates-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Templates exportados", description: `${templates.length} template(s)` });
  }, [templates]);

  const importTemplates = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) throw new Error("Formato inválido");
        const valid = parsed.filter((t: any) => t.name && t.body);
        if (valid.length === 0) throw new Error("Nenhum template válido encontrado");
        const imported: EmailTemplate[] = valid.map((t: any) => ({
          id: "tpl-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
          name: String(t.name),
          body: String(t.body),
          category: TEMPLATE_CATEGORIES.some(c => c.value === t.category) ? t.category : "outro",
        }));
        setTemplates(prev => [...prev, ...imported]);
        toast({ title: "Templates importados", description: `${imported.length} template(s) adicionados` });
      } catch (err: any) {
        toast({ title: "Erro ao importar", description: err?.message || "Arquivo JSON inválido", variant: "destructive" });
      }
    };
    input.click();
  }, []);

  return {
    templates,
    setTemplates,
    templatesLoaded,
    filteredTemplates,
    showTemplateManager,
    setShowTemplateManager,
    showTemplateMenu,
    setShowTemplateMenu,
    newTemplateName,
    setNewTemplateName,
    newTemplateBody,
    setNewTemplateBody,
    newTemplateCategory,
    setNewTemplateCategory,
    editingTemplateId,
    setEditingTemplateId,
    templateSearch,
    setTemplateSearch,
    templateSort,
    setTemplateSort,
    dragTemplateId,
    setDragTemplateId,
    dragOverTemplateId,
    setDragOverTemplateId,
    dragOverPosition,
    toggleTemplateFavorite,
    handleTemplateDragOver,
    handleTemplateDrop,
    addTemplate,
    duplicateTemplate,
    deleteTemplate,
    startEditTemplate,
    saveEditTemplate,
    insertTemplate,
    saveAsTemplate,
    exportTemplates,
    importTemplates,
    TEMPLATE_CATEGORIES,
  };
}
