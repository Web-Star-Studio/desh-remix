/**
 * Pandora — Cartões de confirmação ricos para WhatsApp/MCP/Chat.
 *
 * Os formatters retornam strings amigáveis (estilo WhatsApp: *negrito*).
 * O response cleaner converte para markdown padrão quando for chat web.
 */

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export interface EventConfirmationInput {
  title: string;
  day: number;
  month: number; // 0-indexed
  year: number;
  startTime?: string | null; // "HH:MM"
  endTime?: string | null;   // "HH:MM"
  location?: string | null;
  description?: string | null;
  attendees?: string[] | null;
  googleSynced?: boolean;
  action?: "created" | "updated" | "deleted";
}

export function formatEventConfirmation(input: EventConfirmationInput): string {
  const verb = input.action === "updated" ? "atualizado" : input.action === "deleted" ? "removido" : "criado";
  const icon = input.action === "deleted" ? "🗑️" : input.action === "updated" ? "✏️" : "✅";
  const weekday = WEEKDAYS[new Date(input.year, input.month, input.day).getDay()];
  const dateLabel = `${weekday}, ${pad2(input.day)}/${pad2(input.month + 1)}`;

  const lines: string[] = [];
  lines.push(`${icon} *${input.title}* ${verb}`);

  let timeLabel = "";
  if (input.startTime && input.endTime) timeLabel = ` · ${input.startTime} - ${input.endTime}`;
  else if (input.startTime) timeLabel = ` · ${input.startTime}`;
  lines.push(`📅 ${dateLabel}${timeLabel}`);

  if (input.location) lines.push(`📍 ${input.location}`);
  if (input.description) lines.push(`📝 ${input.description}`);
  if (input.attendees?.length) lines.push(`👥 ${input.attendees.join(", ")}`);
  if (input.googleSynced) lines.push(`🔄 Sincronizado com Google Calendar`);

  return lines.join("\n");
}

export interface TaskConfirmationInput {
  title: string;
  priority?: string | null;
  dueDate?: string | null; // YYYY-MM-DD
  action?: "created" | "completed" | "updated" | "deleted";
}

export function formatTaskConfirmation(input: TaskConfirmationInput): string {
  const map = { created: ["✅", "criada"], completed: ["✔️", "concluída"], updated: ["✏️", "atualizada"], deleted: ["🗑️", "removida"] } as const;
  const [icon, verb] = map[input.action || "created"];
  const lines: string[] = [`${icon} *${input.title}* ${verb}`];

  const tags: string[] = [];
  if (input.priority && input.priority !== "medium") {
    const pmap: Record<string, string> = { urgent: "🔴 Urgente", high: "🟠 Alta", low: "🟢 Baixa" };
    tags.push(pmap[input.priority] || input.priority);
  }
  if (input.dueDate) {
    const d = new Date(input.dueDate + "T00:00:00");
    tags.push(`📅 ${pad2(d.getDate())}/${MONTHS_SHORT[d.getMonth()]}`);
  }
  if (tags.length) lines.push(tags.join(" · "));
  return lines.join("\n");
}

/**
 * Captura exceções de uma execução de tool e retorna sempre uma string
 * previsível ([ERRO_INTERNO]/[ERRO]/[OK]). Evita que stack traces virem
 * texto da Pandora.
 */
export async function safeToolExecute<T extends string>(
  toolName: string,
  fn: () => Promise<T>,
): Promise<string> {
  try {
    const result = await fn();
    if (typeof result === "string" && result.length > 0) return result;
    return `[OK] ${toolName} executado`;
  } catch (err: any) {
    const msg = err?.message || String(err) || "erro desconhecido";
    console.error(`[safeToolExecute] ${toolName} falhou:`, msg, err?.stack);
    // Sinaliza erro técnico — o prompt instrui a IA a responder graciosamente
    return `[ERRO_INTERNO] ${toolName}: ${msg.substring(0, 180)}`;
  }
}
