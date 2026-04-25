export const priorityColors: Record<string, string> = {
  high: "bg-red-500/20 text-red-400",
  medium: "bg-yellow-500/20 text-yellow-500",
  low: "bg-green-500/20 text-green-400",
};

export const priorityLabels: Record<string, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

export const statusLabels: Record<string, string> = {
  todo: "A fazer",
  in_progress: "Em andamento",
  done: "Concluído",
};

export const recurrenceLabels: Record<string, string> = {
  daily: "Diária",
  weekly: "Semanal",
  monthly: "Mensal",
};

/** Milliseconds in one day */
export const MS_PER_DAY = 86400000;
