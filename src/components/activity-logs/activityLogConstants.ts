import {
  StickyNote, CheckSquare, CalendarDays, Users, DollarSign,
  Mail, MessageCircle, FolderOpen, Sparkles, Settings, LogIn,
  Zap, LayoutGrid,
} from "lucide-react";

export const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  notas:         { label: "Notas",         icon: StickyNote,     color: "text-yellow-500" },
  tarefas:       { label: "Tarefas",       icon: CheckSquare,    color: "text-primary" },
  calendario:    { label: "Calendário",    icon: CalendarDays,   color: "text-blue-500" },
  contatos:      { label: "Contatos",      icon: Users,          color: "text-green-500" },
  financas:      { label: "Finanças",      icon: DollarSign,     color: "text-emerald-500" },
  email:         { label: "E-mail",        icon: Mail,           color: "text-red-400" },
  mensagens:     { label: "Mensagens",     icon: MessageCircle,  color: "text-teal-500" },
  arquivos:      { label: "Arquivos",      icon: FolderOpen,     color: "text-orange-500" },
  ia:            { label: "IA",            icon: Sparkles,       color: "text-purple-500" },
  configuracoes: { label: "Configurações", icon: Settings,       color: "text-muted-foreground" },
  autenticacao:  { label: "Autenticação",  icon: LogIn,          color: "text-cyan-500" },
  automacoes:    { label: "Automações",    icon: Zap,            color: "text-amber-500" },
  geral:         { label: "Geral",         icon: LayoutGrid,     color: "text-muted-foreground" },
};
