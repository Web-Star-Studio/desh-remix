import React from "react";
import { getPlainTextFromHtml } from "@/components/notes/RichTextEditor";

// ── Color palette ─────────────────────────────────────────────────────────────
export const colorOptions = [
  { value: "border-l-primary",            label: "Azul",         dot: "bg-primary" },
  { value: "border-l-accent",             label: "Acento",       dot: "bg-accent" },
  { value: "border-l-muted-foreground",   label: "Cinza",        dot: "bg-muted-foreground" },
  { value: "border-l-destructive",        label: "Vermelho",     dot: "bg-destructive" },
  { value: "border-l-yellow-500",         label: "Amarelo",      dot: "bg-yellow-500" },
  { value: "border-l-green-500",          label: "Verde",        dot: "bg-green-500" },
];

// ── Note templates (dynamic to recalculate dates) ─────────────────────────────
export const getNoteTemplates = () => [
  {
    label: "Ata de Reunião",
    icon: "📋",
    title: "Ata de Reunião",
    content: `<h2>Reunião — ${new Date().toLocaleDateString("pt-BR")}</h2><h3>Participantes</h3><ul><li></li></ul><h3>Pauta</h3><ol><li></li></ol><h3>Decisões</h3><ul><li></li></ul><h3>Próximos Passos</h3><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label></li></ul>`,
    tags: ["reunião"],
    notebook: "Reuniões",
  },
  {
    label: "Diário",
    icon: "📓",
    title: `Diário — ${new Date().toLocaleDateString("pt-BR")}`,
    content: `<h2>${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</h2><h3>Como estou me sentindo</h3><p></p><h3>O que fiz hoje</h3><ul><li></li></ul><h3>Gratidão</h3><ul><li></li></ul><h3>Reflexões</h3><p></p>`,
    tags: ["diário"],
    notebook: "Diário",
  },
  {
    label: "Lista de Tarefas",
    icon: "✅",
    title: "Lista de Tarefas",
    content: `<h2>Tarefas</h2><h3>Alta Prioridade</h3><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label></li></ul><h3>Média Prioridade</h3><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label></li></ul><h3>Baixa Prioridade</h3><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label></li></ul>`,
    tags: ["tarefas"],
  },
  {
    label: "Estudo / Pesquisa",
    icon: "🔬",
    title: "Notas de Estudo",
    content: `<h2>Tema: </h2><h3>Conceitos-Chave</h3><ul><li></li></ul><h3>Detalhes</h3><p></p><h3>Perguntas</h3><ul><li></li></ul><h3>Referências</h3><ul><li></li></ul>`,
    tags: ["estudo"],
    notebook: "Estudos",
  },
  {
    label: "Brainstorm",
    icon: "💡",
    title: "Brainstorm",
    content: `<h2>Brainstorm: </h2><h3>Ideias</h3><ul><li></li><li></li><li></li></ul><h3>Próximos passos</h3><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label></li></ul>`,
    tags: ["brainstorm"],
  },
  {
    label: "Retrospectiva",
    icon: "🔄",
    title: `Retrospectiva — ${new Date().toLocaleDateString("pt-BR")}`,
    content: `<h2>Retrospectiva</h2><h3>✅ O que funcionou bem</h3><ul><li></li></ul><h3>⚠️ O que pode melhorar</h3><ul><li></li></ul><h3>🚀 Ações para próxima sprint</h3><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label></li></ul><h3>💬 Observações</h3><p></p>`,
    tags: ["retrospectiva"],
    notebook: "Projetos",
  },
  {
    label: "1:1 / Feedback",
    icon: "🤝",
    title: `1:1 — ${new Date().toLocaleDateString("pt-BR")}`,
    content: `<h2>1:1 Meeting</h2><h3>Agenda</h3><ul><li></li></ul><h3>Feedback dado</h3><p></p><h3>Feedback recebido</h3><p></p><h3>Action items</h3><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label></li></ul>`,
    tags: ["1:1", "feedback"],
    notebook: "Reuniões",
  },
];

// ── Word / read-time counter ──────────────────────────────────────────────────
export const getTextStats = (text: string) => {
  const plain = typeof text === "string" ? getPlainTextFromHtml(text).trim() : "";
  const words = plain ? plain.split(/\s+/).filter(Boolean).length : 0;
  const chars = plain.length;
  const lines = plain.split("\n").length;
  const readMin = Math.max(1, Math.ceil(words / 200));
  return { words, chars, lines, readMin };
};

// ── Search highlight helper ───────────────────────────────────────────────────
export const highlightMatch = (text: string, query: string): React.ReactNode => {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return React.createElement(React.Fragment, null,
    text.slice(0, idx),
    React.createElement("mark", { className: "bg-primary/25 text-foreground rounded-sm px-0.5" }, text.slice(idx, idx + query.length)),
    text.slice(idx + query.length),
  );
};

// ── Parse .md frontmatter ─────────────────────────────────────────────────────
export const parseMdFile = (raw: string): { title: string; content: string; tags: string[]; notebook?: string } => {
  let title = "Nota importada";
  let content = raw;
  let tags: string[] = [];
  let notebook: string | undefined;

  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (fmMatch) {
    const fm = fmMatch[1];
    content = fmMatch[2];
    const titleMatch = fm.match(/title:\s*"?([^"\n]+)"?/);
    if (titleMatch) title = titleMatch[1].trim();
    const tagsMatch = fm.match(/tags:\s*\[([^\]]*)\]/);
    if (tagsMatch) tags = tagsMatch[1].split(",").map(t => t.trim().replace(/"/g, "")).filter(Boolean);
    const nbMatch = fm.match(/notebook:\s*"?([^"\n]+)"?/);
    if (nbMatch) notebook = nbMatch[1].trim();
  } else {
    const h1 = raw.match(/^#\s+(.+)$/m);
    if (h1) title = h1[1].trim();
  }

  return { title, content: content.trim(), tags, notebook };
};

// ── Snippet helper ───────────────────────────────────────────────────────────
export const getSnippet = (content: string) => getPlainTextFromHtml(content).trim().slice(0, 120) || "Nota vazia";
