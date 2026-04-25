/**
 * @module pandora-tools/calendar-tools
 * @description Tool definitions for Calendar (rich schema)
 *
 * Campos opcionais: start_time, end_time, duration_minutes, location, description, attendees_emails.
 * O handler também aceita o formato legado "HH:MM - Descrição" no label (backwards-compat).
 */

const richEventProps = {
  day: { type: "number", description: "Dia do mês" },
  month: { type: "number", description: "Mês 1-12 (Janeiro=1, Dezembro=12)" },
  year: { type: "number", description: "Ano (4 dígitos)" },
  label: { type: "string", description: "Título do evento — apenas o nome, ex: 'Consulta Cardiologista'. Hora vai em start_time, não embuta no label." },
  start_time: { type: "string", description: "Horário de início HH:MM (24h). Ex: '16:30'." },
  end_time: { type: "string", description: "Horário de término HH:MM (24h). Opcional — se omitido, usa duration_minutes ou 60min." },
  duration_minutes: { type: "number", description: "Duração em minutos. Alternativa a end_time. Default 60." },
  location: { type: "string", description: "Local físico ou link da reunião. Ex: 'Empresarial Rio Mar, Torre 4, Sala 1620' ou 'meet.google.com/abc-defg-hij'." },
  description: { type: "string", description: "Descrição/notas adicionais sobre o evento." },
  attendees_emails: { type: "array", items: { type: "string" }, description: "E-mails dos convidados para o Google Calendar." },
  category: { type: "string", enum: ["trabalho", "pessoal", "saúde", "educação", "lazer", "outro"] },
};

const richEditEventProps = {
  event_identifier: { type: "string", description: "Título atual ou ID do evento" },
  new_label: { type: "string" },
  new_day: { type: "number" },
  new_month: { type: "number", description: "Mês 1-12" },
  new_year: { type: "number" },
  new_start_time: { type: "string", description: "Novo horário de início HH:MM" },
  new_end_time: { type: "string", description: "Novo horário de término HH:MM" },
  new_duration_minutes: { type: "number" },
  new_location: { type: "string" },
  new_description: { type: "string" },
  new_category: { type: "string", enum: ["trabalho", "pessoal", "saúde", "educação", "lazer", "outro"] },
};

export const calendarToolDefinitions = [
  { type: "function", function: { name: "add_calendar_event", description: "Adicionar evento ao calendário (sincroniza com Google Calendar quando conectado). month é 1-indexed.", parameters: { type: "object", properties: richEventProps, required: ["day", "label"], additionalProperties: false } } },
  { type: "function", function: { name: "edit_calendar_event", description: "Editar um evento existente do calendário", parameters: { type: "object", properties: richEditEventProps, required: ["event_identifier"], additionalProperties: false } } },
  { type: "function", function: { name: "delete_calendar_event", description: "Excluir um evento do calendário pelo label ou ID. PERGUNTE confirmação ao usuário antes de chamar, a menos que ele já tenha usado verbo explícito ('apague', 'remova', 'delete').", parameters: { type: "object", properties: { event_identifier: { type: "string" } }, required: ["event_identifier"], additionalProperties: false } } },
  { type: "function", function: { name: "set_event_category", description: "Definir a categoria de um evento", parameters: { type: "object", properties: { event_identifier: { type: "string" }, category: { type: "string", enum: ["trabalho", "pessoal", "saúde", "educação", "lazer", "outro"] } }, required: ["event_identifier", "category"], additionalProperties: false } } },
  { type: "function", function: { name: "get_calendar_events", description: "Listar todos os eventos do calendário", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "find_free_time", description: "Encontrar horários livres no Google Calendar.", parameters: { type: "object", properties: { date_start: { type: "string", description: "Início do período (ISO 8601, padrão: agora)" }, date_end: { type: "string", description: "Fim do período (ISO 8601, padrão: 7 dias à frente)" } }, additionalProperties: false } } },
];

export const calendarToolDefinitionsCompact = [
  { type: "function", function: { name: "add_calendar_event", description: "Adicionar evento ao calendário (sincroniza com Google Calendar). IMPORTANTE: month é 1-indexed (Janeiro=1). label deve conter APENAS o nome do evento — coloque hora em start_time e local em location, NÃO embuta no label.", parameters: { type: "object", properties: richEventProps, required: ["day", "label"], additionalProperties: false } } },
  { type: "function", function: { name: "get_calendar_events", description: "Listar eventos do calendário", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "edit_calendar_event", description: "Editar evento do calendário. month é 1-indexed.", parameters: { type: "object", properties: richEditEventProps, required: ["event_identifier"], additionalProperties: false } } },
  { type: "function", function: { name: "delete_calendar_event", description: "Excluir evento do calendário. Confirme antes se o usuário não foi explícito.", parameters: { type: "object", properties: { event_identifier: { type: "string" } }, required: ["event_identifier"], additionalProperties: false } } },
];
