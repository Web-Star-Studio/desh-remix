import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  ListTodo,
  Users,
  FolderOpen,
  StickyNote,
  Mail,
  CalendarDays,
  Search,
  Settings,
  BarChart3,
  MessageSquare,
  Sparkles,
  Home,
  FileText,
  CheckCircle2,
  Circle,
  Star,
  ExternalLink,
  Loader2,
  Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGoogleSearch } from "@/hooks/search/useGoogleSearch";
import type { GoogleSearchItem } from "@/components/search/GoogleSearchResults";

interface SearchResult {
  id: string;
  type: "task" | "contact" | "file" | "note" | "page";
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
}

const PAGES: Array<{ label: string; path: string; icon: React.ReactNode; keywords: string }> = [
  { label: "Início", path: "/", icon: <Home className="w-4 h-4" />, keywords: "home dashboard início" },
  { label: "Buscar na Web", path: "/search", icon: <Search className="w-4 h-4" />, keywords: "search pesquisar web" },
  { label: "Calendário", path: "/calendar", icon: <CalendarDays className="w-4 h-4" />, keywords: "calendar agenda eventos" },
  { label: "E-mail", path: "/email", icon: <Mail className="w-4 h-4" />, keywords: "email gmail correio" },
  { label: "Tarefas", path: "/tasks", icon: <ListTodo className="w-4 h-4" />, keywords: "tasks todo afazeres" },
  { label: "Notas", path: "/notes", icon: <StickyNote className="w-4 h-4" />, keywords: "notes anotações" },
  { label: "Contatos", path: "/contacts", icon: <Users className="w-4 h-4" />, keywords: "contacts pessoas" },
  { label: "Arquivos", path: "/files", icon: <FolderOpen className="w-4 h-4" />, keywords: "files documentos drive" },
  { label: "Mensagens", path: "/messages", icon: <MessageSquare className="w-4 h-4" />, keywords: "messages chat" },
  { label: "Finanças", path: "/finances", icon: <BarChart3 className="w-4 h-4" />, keywords: "finances dinheiro money" },
  { label: "IA", path: "/ai", icon: <Sparkles className="w-4 h-4" />, keywords: "ai inteligência artificial chat gpt" },
  { label: "Configurações", path: "/settings", icon: <Settings className="w-4 h-4" />, keywords: "settings configurações tema" },
];

const GOOGLE_ICON_MAP: Record<string, React.ReactNode> = {
  email: <Mail className="w-4 h-4 text-blue-500" />,
  event: <Calendar className="w-4 h-4 text-green-500" />,
  file: <FileText className="w-4 h-4 text-amber-500" />,
  contact: <Users className="w-4 h-4 text-purple-500" />,
};

const GOOGLE_LABEL_MAP: Record<string, string> = {
  email: "Gmail",
  event: "Google Calendar",
  file: "Google Drive",
  contact: "Google Contacts",
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();
  const googleSearch = useGoogleSearch();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for Cmd+Shift+K (Cmd+K now handled by GlobalSearchBar)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Fetch local data when opened
  useEffect(() => {
    if (!open || !user) return;
    setQuery("");

    const fetchData = async () => {
      const [tasksRes, contactsRes, notesRes, filesRes] = await Promise.all([
        supabase.from("tasks").select("id, title, status, priority").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("contacts").select("id, name, email, company").eq("user_id", user.id).order("name").limit(50),
        supabase.from("user_data").select("id, data").eq("user_id", user.id).eq("data_type", "note").limit(50),
        supabase.from("files").select("id, name, mime_type, ai_category, ai_tags").eq("user_id", user.id).eq("is_trashed", false).order("created_at", { ascending: false }).limit(50),
      ]);

      setTasks(tasksRes.data || []);
      setContacts(contactsRes.data || []);
      setFiles(filesRes.data || []);
      setNotes(notesRes.data || []);
    };

    fetchData();
  }, [open, user]);

  // Debounced Google search when query changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!open || query.trim().length < 2) return;

    debounceRef.current = setTimeout(() => {
      googleSearch.search(query.trim());
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = useCallback((path: string) => {
    setOpen(false);
    navigate(path);
  }, [navigate]);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();

    // Pages always show
    const pageResults: SearchResult[] = PAGES
      .filter(p => !q || p.label.toLowerCase().includes(q) || p.keywords.includes(q))
      .map(p => ({
        id: `page-${p.path}`,
        type: "page" as const,
        title: p.label,
        icon: p.icon,
        action: () => go(p.path),
      }));

    if (!q) return { pages: pageResults, tasks: [], contacts: [], files: [], notes: [] };

    const taskResults: SearchResult[] = tasks
      .filter(t => t.title.toLowerCase().includes(q))
      .slice(0, 6)
      .map(t => ({
        id: `task-${t.id}`,
        type: "task" as const,
        title: t.title,
        subtitle: t.status === "done" ? "Concluída" : t.status === "in_progress" ? "Em progresso" : "Pendente",
        icon: t.status === "done" ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-muted-foreground" />,
        action: () => go(`/tasks?highlight=${t.id}`),
      }));

    const contactResults: SearchResult[] = contacts
      .filter(c => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q))
      .slice(0, 6)
      .map(c => ({
        id: `contact-${c.id}`,
        type: "contact" as const,
        title: c.name,
        subtitle: [c.email, c.company].filter(Boolean).join(" · "),
        icon: <Users className="w-4 h-4 text-blue-500" />,
        action: () => go(`/contacts?search=${encodeURIComponent(c.name)}`),
      }));

    const fileResults: SearchResult[] = files
      .filter(f => {
        const nameMatch = f.name?.toLowerCase().includes(q);
        const categoryMatch = f.ai_category?.toLowerCase().includes(q);
        const tagMatch = f.ai_tags?.some((t: string) => t.toLowerCase().includes(q));
        return nameMatch || categoryMatch || tagMatch;
      })
      .slice(0, 6)
      .map(f => ({
        id: `file-${f.id}`,
        type: "file" as const,
        title: f.name,
        subtitle: [f.ai_category, f.mime_type?.split("/").pop()].filter(Boolean).join(" · "),
        icon: <FileText className="w-4 h-4 text-orange-500" />,
        action: () => go("/files"),
      }));

    const noteResults: SearchResult[] = notes
      .filter(n => {
        const data = n.data as any;
        const title = data?.title || "";
        const content = data?.content || "";
        return title.toLowerCase().includes(q) || content.toLowerCase().includes(q);
      })
      .slice(0, 6)
      .map(n => {
        const data = n.data as any;
        const rawContent = data?.content || "";
        const cleanContent = rawContent.replace(/<[^>]*>/g, "").trim();
        return {
          id: `note-${n.id}`,
          type: "note" as const,
          title: data?.title || "Sem título",
          subtitle: cleanContent.slice(0, 60),
          icon: <StickyNote className="w-4 h-4 text-yellow-500" />,
          action: () => go(`/notes?id=${n.id}`),
        };
      });

    return { pages: pageResults, tasks: taskResults, contacts: contactResults, files: fileResults, notes: noteResults };
  }, [query, tasks, contacts, files, notes, go]);

  // Group Google results by type
  const googleGroups = useMemo(() => {
    const grouped: Record<string, GoogleSearchItem[]> = {};
    googleSearch.results.forEach(item => {
      if (!grouped[item.type]) grouped[item.type] = [];
      grouped[item.type].push(item);
    });
    return grouped;
  }, [googleSearch.results]);

  const hasLocalResults = results.tasks.length + results.contacts.length + results.files.length + results.notes.length > 0;
  const hasGoogleResults = googleSearch.results.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Pesquisar tarefas, contatos, e-mails, eventos..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {googleSearch.loading ? (
            <span className="flex items-center justify-center gap-2 text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Buscando no Google...
            </span>
          ) : (
            "Nenhum resultado encontrado."
          )}
        </CommandEmpty>

        {results.tasks.length > 0 && (
          <CommandGroup heading="Tarefas">
            {results.tasks.map(r => (
              <CommandItem key={r.id} onSelect={r.action} className="gap-2">
                {r.icon}
                <span className="flex-1 truncate">{r.title}</span>
                <span className="text-xs text-muted-foreground">{r.subtitle}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.contacts.length > 0 && (
          <CommandGroup heading="Contatos">
            {results.contacts.map(r => (
              <CommandItem key={r.id} onSelect={r.action} className="gap-2">
                {r.icon}
                <span className="flex-1 truncate">{r.title}</span>
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">{r.subtitle}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.files.length > 0 && (
          <CommandGroup heading="Arquivos">
            {results.files.map(r => (
              <CommandItem key={r.id} onSelect={r.action} className="gap-2">
                {r.icon}
                <span className="flex-1 truncate">{r.title}</span>
                <span className="text-xs text-muted-foreground">{r.subtitle}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.notes.length > 0 && (
          <CommandGroup heading="Notas">
            {results.notes.map(r => (
              <CommandItem key={r.id} onSelect={r.action} className="gap-2">
                {r.icon}
                <span className="flex-1 truncate">{r.title}</span>
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">{r.subtitle}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Google results */}
        {(hasGoogleResults || googleSearch.loading) && hasLocalResults && <CommandSeparator />}

        {googleSearch.loading && !hasGoogleResults && query.trim().length >= 2 && (
          <CommandGroup heading="Google">
            <CommandItem disabled className="gap-2 justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground text-xs">Buscando no Google...</span>
            </CommandItem>
          </CommandGroup>
        )}

        {Object.entries(googleGroups).map(([type, items]) => (
          <CommandGroup key={`google-${type}`} heading={GOOGLE_LABEL_MAP[type] || type}>
            {items.slice(0, 4).map(item => (
              <CommandItem
                key={`g-${item.id}`}
                onSelect={() => {
                  if (item.url) {
                    window.open(item.url, "_blank");
                  }
                  setOpen(false);
                }}
                className="gap-2"
              >
                {GOOGLE_ICON_MAP[item.type] || <FileText className="w-4 h-4" />}
                <span className="flex-1 truncate">{item.title}</span>
                <span className="text-xs text-muted-foreground truncate max-w-[180px]">{item.subtitle}</span>
                {item.date && <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">{item.date}</span>}
                {item.url && <ExternalLink className="w-3 h-3 text-muted-foreground/40" />}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}

        {(hasLocalResults || hasGoogleResults) && <CommandSeparator />}

        {results.pages.length > 0 && (
          <CommandGroup heading="Páginas">
            {results.pages.map(r => (
              <CommandItem key={r.id} onSelect={r.action} className="gap-2">
                {r.icon}
                <span>{r.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {query.trim() && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Busca Web">
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  navigate(`/search?q=${encodeURIComponent(query.trim())}`);
                }}
                className="gap-2"
              >
                <Search className="w-4 h-4" />
                <span>Pesquisar "{query.trim()}" na web</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
