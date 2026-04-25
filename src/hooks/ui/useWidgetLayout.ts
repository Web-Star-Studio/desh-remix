// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFlushOnExit } from "@/hooks/common/useFlushOnExit";
import { useDemo } from "@/contexts/DemoContext";

export interface WidgetConfig {
  id: string;
  label: string;
  visible: boolean;
}

const BASE_STORAGE_KEY = "dashfy-widget-layout";

function getStorageKey(workspaceId: string | null) {
  return workspaceId ? `${BASE_STORAGE_KEY}-${workspaceId}` : BASE_STORAGE_KEY;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "calendar", label: "Calendário", visible: true },
  { id: "email", label: "E-mail", visible: true },
  { id: "messages", label: "Mensagens", visible: true },
  { id: "tasks", label: "Tarefas", visible: true },
  { id: "notes", label: "Notas", visible: true },
  { id: "contacts", label: "Contatos", visible: true },
  { id: "wallet", label: "Carteira", visible: true },
  { id: "files", label: "Arquivos", visible: true },
  { id: "system-errors", label: "Erros do Sistema (admin)", visible: false },
];

const VALID_IDS = new Set(DEFAULT_WIDGETS.map(w => w.id));

function mergeWithDefaults(saved: WidgetConfig[]): WidgetConfig[] {
  const validSaved = saved.filter(w => VALID_IDS.has(w.id));
  const ids = new Set(validSaved.map(w => w.id));
  const merged = [...validSaved];
  for (const dw of DEFAULT_WIDGETS) {
    if (!ids.has(dw.id)) merged.push(dw);
  }
  return merged;
}

function loadFromLocalStorage(storageKey: string): WidgetConfig[] {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) return mergeWithDefaults(JSON.parse(saved));
  } catch {}
  return DEFAULT_WIDGETS;
}

export function useWidgetLayout() {
  const { user } = useAuth();
  const { isDemoMode, isLoading: isDemoTransitioning, demoWorkspaceId } = useDemo();
  const { activeWorkspaceId } = useWorkspace();
  const isInDemoWorkspace = isDemoMode || isDemoTransitioning || (demoWorkspaceId != null && activeWorkspaceId === demoWorkspaceId);
  const storageKey = getStorageKey(activeWorkspaceId);
  const dbDataType = activeWorkspaceId ? `widget_layout:${activeWorkspaceId}` : "widget_layout";

  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => loadFromLocalStorage(storageKey));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowIdRef = useRef<string | null>(null);
  const hasFetchedRef = useRef<string | null>(null);

  // Flush on exit — skip when in demo workspace
  const { markPending, clearPending } = useFlushOnExit<WidgetConfig[]>(rowIdRef, dbDataType, isInDemoWorkspace);

  // Reload from localStorage when workspace changes & cancel pending debounces
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    clearPending();

    setWidgets(loadFromLocalStorage(storageKey));
    hasFetchedRef.current = null;
    rowIdRef.current = null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, clearPending]);

  // Fetch from DB on mount (if logged in) — skip during demo transitions
  useEffect(() => {
    if (!user || hasFetchedRef.current === storageKey || isInDemoWorkspace) return;
    hasFetchedRef.current = storageKey;

    (async () => {
      try {
        const { data: rows, error } = await supabase
          .from("user_data")
          .select("id, data")
          .eq("user_id", user.id)
          .eq("data_type", dbDataType)
          .limit(1);

        if (error) { console.error("widget layout fetch error:", error); return; }

        if (rows && rows.length > 0) {
          rowIdRef.current = rows[0].id;
          const dbWidgets = rows[0].data as unknown as WidgetConfig[];
          if (Array.isArray(dbWidgets)) {
            const merged = mergeWithDefaults(dbWidgets);
            setWidgets(merged);
            localStorage.setItem(storageKey, JSON.stringify(merged));
          }
        }
      } catch (err) {
        console.error("widget layout fetch error:", err);
      }
    })();
  }, [user, storageKey, dbDataType, isInDemoWorkspace]);

  // Persist to localStorage immediately, debounce DB sync
  const persistWidgets = useCallback((next: WidgetConfig[]) => {
    localStorage.setItem(storageKey, JSON.stringify(next));

    // Skip DB writes when inside a demo workspace
    if (isInDemoWorkspace) return;

    markPending(next); // Track for flush on exit

    if (!user) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        if (rowIdRef.current) {
          await supabase
            .from("user_data")
            .update({ data: next as any, updated_at: new Date().toISOString() })
            .eq("id", rowIdRef.current);
        } else {
          // Select first to check if row exists
          const { data: existing } = await supabase
            .from("user_data")
            .select("id")
            .eq("user_id", user.id)
            .eq("data_type", dbDataType)
            .limit(1)
            .single();

          if (existing) {
            rowIdRef.current = existing.id;
            await supabase
              .from("user_data")
              .update({ data: next as any, updated_at: new Date().toISOString() })
              .eq("id", existing.id);
          } else {
            const { data: inserted, error } = await supabase
              .from("user_data")
              .insert({ user_id: user.id, data_type: dbDataType, data: next as any } as any)
              .select("id")
              .single();
            if (!error && inserted) rowIdRef.current = inserted.id;
          }
        }
        clearPending(); // Sync succeeded
      } catch (err) {
        console.error("widget layout sync error:", err);
      }
    }, 1500);
  }, [user, storageKey, dbDataType, markPending, clearPending, isInDemoWorkspace]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const toggleWidget = useCallback((id: string) => {
    setWidgets(prev => {
      const next = prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
      persistWidgets(next);
      return next;
    });
  }, [persistWidgets]);

  const setWidgetVisible = useCallback((id: string, visible: boolean) => {
    setWidgets(prev => {
      const next = prev.map(w => w.id === id ? { ...w, visible } : w);
      persistWidgets(next);
      return next;
    });
  }, [persistWidgets]);

  const moveWidget = useCallback((fromIndex: number, toIndex: number) => {
    setWidgets(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      persistWidgets(next);
      return next;
    });
  }, [persistWidgets]);

  const moveWidgetById = useCallback((fromId: string, toId: string) => {
    setWidgets(prev => {
      const fromIdx = prev.findIndex(w => w.id === fromId);
      const toIdx = prev.findIndex(w => w.id === toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      persistWidgets(next);
      return next;
    });
  }, [persistWidgets]);

  const visibleWidgets = useMemo(() => widgets.filter(w => w.visible), [widgets]);

  return { widgets, visibleWidgets, toggleWidget, setWidgetVisible, moveWidget, moveWidgetById };
}
