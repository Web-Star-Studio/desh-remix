import { Mail, Calendar, FileText, Users, ExternalLink, Loader2 } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import { motion } from "framer-motion";

export interface GoogleSearchItem {
  type: "email" | "event" | "file" | "contact";
  id: string;
  title: string;
  subtitle: string;
  date?: string;
  url?: string;
}

const ICON_MAP = {
  email: Mail,
  event: Calendar,
  file: FileText,
  contact: Users,
};

const LABEL_MAP: Record<string, string> = {
  email: "E-mail",
  event: "Evento",
  file: "Arquivo",
  contact: "Contato",
};

const COLOR_MAP: Record<string, string> = {
  email: "text-blue-400",
  event: "text-green-400",
  file: "text-amber-400",
  contact: "text-purple-400",
};

interface Props {
  items: GoogleSearchItem[];
  loading: boolean;
  query: string;
}

const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const GoogleSearchResults = ({ items, loading, query }: Props) => {
  if (loading) {
    return (
      <GlassCard size="auto">
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          Buscando nos seus serviços Google...
        </div>
      </GlassCard>
    );
  }

  if (!items.length) {
    return (
      <GlassCard size="auto">
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum resultado encontrado em seus serviços Google para "{query}"
        </p>
      </GlassCard>
    );
  }

  // Group by type
  const grouped: Record<string, GoogleSearchItem[]> = {};
  items.forEach(item => {
    if (!grouped[item.type]) grouped[item.type] = [];
    grouped[item.type].push(item);
  });

  return (
    <motion.div
      className="space-y-4"
      initial="hidden"
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
    >
      {Object.entries(grouped).map(([type, groupItems]) => {
        const Icon = ICON_MAP[type as keyof typeof ICON_MAP] || FileText;
        return (
          <motion.div key={type} variants={staggerItem}>
            <GlassCard size="auto">
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`w-4 h-4 ${COLOR_MAP[type] || "text-primary"}`} />
                <p className="widget-title">{LABEL_MAP[type] || type} ({groupItems.length})</p>
              </div>
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {groupItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-foreground/5 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                    </div>
                    {item.date && (
                      <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">{item.date}</span>
                    )}
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        );
      })}
    </motion.div>
  );
};

export default GoogleSearchResults;
