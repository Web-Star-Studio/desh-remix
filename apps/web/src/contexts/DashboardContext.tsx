import React, {
  createContext,
  useContext,
  useMemo,
  useReducer,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useDemo } from "@/contexts/DemoContext";
import { apiFetch, ApiError } from "@/lib/api-client";

// Types — canonical definitions live in /src/types/
import type { Task } from "@/types/tasks";
import type { Note } from "@/types/notes";
import type { CalendarEvent, EventCategory, RecurrenceType } from "@/types/calendar";
import { EVENT_CATEGORY_COLORS, EVENT_CATEGORY_LABELS } from "@/types/calendar";
export type { Task, Note, CalendarEvent, EventCategory, RecurrenceType };
export { EVENT_CATEGORY_COLORS, EVENT_CATEGORY_LABELS };

interface DashboardState {
  tasks: Task[];
  notes: Note[];
  events: CalendarEvent[];
  loaded: boolean;
}

type Action =
  | { type: "SET_ALL"; tasks: Task[]; notes: Note[]; events: CalendarEvent[] }
  | { type: "ADD_TASK"; task: Task }
  | { type: "UPDATE_TASK"; id: string; changes: Partial<Task> }
  | { type: "DELETE_TASK"; id: string }
  | { type: "ADD_NOTE"; note: Note }
  | { type: "UPDATE_NOTE"; id: string; changes: Partial<Note> }
  | { type: "DELETE_NOTE"; id: string }
  | { type: "ADD_EVENT"; event: CalendarEvent }
  | { type: "UPDATE_EVENT"; id: string; changes: Partial<CalendarEvent> }
  | { type: "DELETE_EVENT"; id: string };

const initialState: DashboardState = {
  tasks: [],
  notes: [],
  events: [],
  loaded: false,
};

function reducer(state: DashboardState, action: Action): DashboardState {
  switch (action.type) {
    case "SET_ALL":
      return { tasks: action.tasks, notes: action.notes, events: action.events, loaded: true };
    case "ADD_TASK":
      return { ...state, tasks: [...state.tasks, action.task] };
    case "UPDATE_TASK":
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, ...action.changes } : t)),
      };
    case "DELETE_TASK":
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };
    case "ADD_NOTE":
      return { ...state, notes: [...state.notes, action.note] };
    case "UPDATE_NOTE":
      return {
        ...state,
        notes: state.notes.map((n) => (n.id === action.id ? { ...n, ...action.changes } : n)),
      };
    case "DELETE_NOTE":
      return { ...state, notes: state.notes.filter((n) => n.id !== action.id) };
    case "ADD_EVENT":
      return { ...state, events: [...state.events, action.event] };
    case "UPDATE_EVENT":
      return {
        ...state,
        events: state.events.map((e) => (e.id === action.id ? { ...e, ...action.changes } : e)),
      };
    case "DELETE_EVENT":
      return { ...state, events: state.events.filter((e) => e.id !== action.id) };
    default:
      return state;
  }
}

interface DashboardActions {
  addTask: (text: string, priority?: Task["priority"]) => void;
  toggleTask: (id: string) => void;
  updateTask: (id: string, changes: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  addNote: (title: string, content: string) => Note;
  updateNote: (id: string, changes: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  restoreNote: (id: string) => void;
  permanentlyDeleteNote: (id: string) => void;
  emptyTrash: () => void;
  addEvent: (
    day: number,
    month: number,
    year: number,
    label: string,
    category?: EventCategory,
    recurrence?: RecurrenceType,
  ) => void;
  updateEvent: (id: string, changes: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
}

interface DashboardContextValue extends DashboardActions {
  state: DashboardState;
}

const DashboardStateContext = createContext<DashboardState | null>(null);
const DashboardActionsContext = createContext<DashboardActions | null>(null);
// Legacy combined context for backward compat
const DashboardContext = createContext<DashboardContextValue | null>(null);

const COLORS = [
  "border-l-primary",
  "border-l-accent",
  "border-l-muted-foreground",
  "border-l-destructive",
];
const EVENT_COLORS = ["bg-primary", "bg-accent", "bg-destructive", "bg-muted-foreground"];

// DB helpers for events (still on user_data — events migrate with the
// calendar feature wave; deferred from the Notes wave intentionally so the
// schema cut stays clean). Notes have moved to apps/api `/workspaces/:id/notes`
// — see the apiNotes* helpers below.
async function upsertRow(
  id: string,
  dataType: string,
  data: Record<string, unknown>,
  userId: string,
  workspaceId?: string | null,
) {
  const { error } = await supabase
    .from("user_data")
    .upsert(
      {
        id,
        data_type: dataType,
        data: data as any,
        user_id: userId,
        ...(workspaceId ? { workspace_id: workspaceId } : {}),
      } as any,
      { onConflict: "id" },
    );
  if (error) console.error("upsert error:", error);
}

async function deleteRow(id: string) {
  const { error } = await supabase.from("user_data").delete().eq("id", id);
  if (error) console.error("delete error:", error);
}

// ─── Notes (apps/api) ──────────────────────────────────────────────

interface ApiTask {
  id: string;
  workspaceId: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
}

function fromApiTask(t: ApiTask): Task {
  return {
    id: t.id,
    text: t.title,
    done: t.status === "done",
    priority: t.priority as Task["priority"],
    created_at: t.createdAt,
    workspace_id: t.workspaceId,
  };
}

async function apiListTasks(workspaceId: string): Promise<Task[]> {
  try {
    const rows = await apiFetch<ApiTask[]>(`/workspaces/${workspaceId}/tasks`);
    return rows
      .map(fromApiTask)
      .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return [];
    console.error("apiListTasks error:", err);
    return [];
  }
}

interface ApiNote {
  id: string;
  workspaceId: string;
  createdBy: string | null;
  title: string;
  content: string;
  tags: string[];
  notebook: string;
  color: string;
  pinned: boolean;
  favorited: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function fromApiNote(n: ApiNote): Note {
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    color: n.color,
    pinned: n.pinned,
    tags: n.tags,
    notebook: n.notebook,
    favorited: n.favorited,
    created_at: n.createdAt,
    updated_at: n.updatedAt,
    workspace_id: n.workspaceId,
    deleted_at: n.deletedAt,
  };
}

function toApiNotePatch(changes: Partial<Note>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (changes.title !== undefined) out.title = changes.title;
  if (changes.content !== undefined) out.content = changes.content;
  if (changes.color !== undefined) out.color = changes.color;
  if (changes.pinned !== undefined) out.pinned = changes.pinned;
  if (changes.tags !== undefined) out.tags = changes.tags;
  if (changes.notebook !== undefined) out.notebook = changes.notebook;
  if (changes.favorited !== undefined) out.favorited = changes.favorited;
  return out;
}

async function apiListNotes(workspaceId: string): Promise<Note[]> {
  // Fetch active + trashed in parallel; the SPA carries both in state and
  // filters client-side based on view mode.
  try {
    const [active, trashed] = await Promise.all([
      apiFetch<ApiNote[]>(`/workspaces/${workspaceId}/notes`),
      apiFetch<ApiNote[]>(`/workspaces/${workspaceId}/notes?trashed=true`),
    ]);
    return [...active, ...trashed].map(fromApiNote);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return [];
    console.error("apiListNotes error:", err);
    return [];
  }
}

// Fire-and-forget activity log
function logActivity(
  userId: string,
  action: string,
  category: string,
  details: Record<string, unknown> = {},
) {
  supabase
    .from("user_activity_logs" as any)
    .insert({
      user_id: userId,
      action,
      category,
      details,
    } as any)
    .then(({ error }) => {
      if (error) console.error("logActivity error:", error);
    });
}

function mapStatusToDb(done: boolean) {
  return done ? "done" : "todo";
}

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { activeWorkspaceId, workspaces } = useWorkspace();
  const { isDemoMode, demoWorkspaceId } = useDemo();
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const counterRef = useRef(0);
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;

  // Effective workspace: active workspace, or default workspace when in "view all"
  const defaultWs = workspaces.find((w) => w.is_default) ?? workspaces[0];
  const effectiveWsId = activeWorkspaceId ?? defaultWs?.id ?? null;
  const wsIdRef = useRef(effectiveWsId);
  wsIdRef.current = effectiveWsId;

  // Ref to track demo mode so callbacks always see the latest value
  const isDemoRef = useRef(isDemoMode);
  isDemoRef.current = isDemoMode;
  const demoWsIdRef = useRef(demoWorkspaceId);
  demoWsIdRef.current = demoWorkspaceId;

  /** Returns true when we should skip all DB writes */
  const shouldSkipDb = useCallback(() => {
    return (
      isDemoRef.current || (demoWsIdRef.current != null && wsIdRef.current === demoWsIdRef.current)
    );
  }, []);

  // Load all data on mount — tasks/notes from apps/api, events from legacy `user_data`
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    (async () => {
      // Events still live on user_data (legacy `data_type='event'`) — the
      // calendar feature wave will carve them into a dedicated table.
      let udQuery = supabase
        .from("user_data")
        .select("id, data_type, data, created_at, updated_at, workspace_id")
        .eq("user_id", user.id)
        .eq("data_type", "event")
        .order("created_at", { ascending: true })
        .abortSignal(controller.signal);

      if (activeWorkspaceId) {
        udQuery = udQuery.eq("workspace_id", activeWorkspaceId);
      }

      // Tasks and notes are workspace-scoped in apps/api. In "view all",
      // tasks use the effective/default workspace until an aggregate endpoint
      // exists; notes keep the existing active-workspace behavior.
      const tasksPromise = effectiveWsId
        ? apiListTasks(effectiveWsId)
        : Promise.resolve<Task[]>([]);
      const notesPromise = activeWorkspaceId
        ? apiListNotes(activeWorkspaceId)
        : Promise.resolve<Note[]>([]);

      const [tasks, udRes, notes] = await Promise.all([tasksPromise, udQuery, notesPromise]);

      if (controller.signal.aborted) return;

      if (udRes.error) console.error("Failed to load events:", udRes.error);

      const events: CalendarEvent[] = [];
      for (const row of (udRes.data || []) as any[]) {
        const d = row.data as any;
        if (row.data_type === "event") {
          events.push({
            id: row.id,
            day: d.day,
            month: d.month,
            year: d.year,
            label: d.label,
            color: d.color || EVENT_COLORS[0],
            category: d.category || "outro",
            recurrence: d.recurrence || "none",
            workspace_id: row.workspace_id,
          });
        }
      }

      dispatch({ type: "SET_ALL", tasks, notes, events });
    })();
    return () => {
      controller.abort();
    };
  }, [user, activeWorkspaceId, effectiveWsId]);

  // Task operations use apps/api `/workspaces/:id/tasks`.
  const addTask = useCallback(
    (text: string, priority?: Task["priority"]) => {
      const id = crypto.randomUUID();
      const workspaceId = wsIdRef.current;
      const task: Task = {
        id,
        text,
        done: false,
        priority: priority || "medium",
        workspace_id: workspaceId ?? undefined,
      };
      dispatch({ type: "ADD_TASK", task });

      if (shouldSkipDb()) return; // Demo guard — keep local state, skip DB

      const uid = userIdRef.current;
      if (uid && workspaceId) {
        apiFetch<ApiTask>(`/workspaces/${workspaceId}/tasks`, {
          method: "POST",
          body: JSON.stringify({
            title: text,
            status: "todo",
            priority: priority || "medium",
          }),
        })
          .then((created) => dispatch({ type: "UPDATE_TASK", id, changes: fromApiTask(created) }))
          .catch((err) => console.error("addTask error:", err));
        logActivity(uid, "Tarefa criada", "tarefas", {
          titulo: text,
          prioridade: priority || "medium",
        });
      }
    },
    [shouldSkipDb],
  );

  const toggleTask = useCallback(
    (id: string) => {
      const task = stateRef.current.tasks.find((t) => t.id === id);
      if (!task) return;
      const newDone = !task.done;
      dispatch({ type: "UPDATE_TASK", id, changes: { done: newDone } });

      if (shouldSkipDb()) return;

      const workspaceId = task.workspace_id ?? wsIdRef.current;
      if (workspaceId) {
        apiFetch<ApiTask>(`/workspaces/${workspaceId}/tasks/${id}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: mapStatusToDb(newDone),
            completedAt: newDone ? new Date().toISOString() : null,
          }),
        }).catch((err) => console.error("toggleTask error:", err));
      }
      if (userIdRef.current)
        logActivity(
          userIdRef.current,
          newDone ? "Tarefa concluída" : "Tarefa reaberta",
          "tarefas",
          { titulo: task.text },
        );
    },
    [shouldSkipDb],
  );

  const updateTask = useCallback(
    (id: string, changes: Partial<Task>) => {
      dispatch({ type: "UPDATE_TASK", id, changes });

      if (shouldSkipDb()) return;

      const task = stateRef.current.tasks.find((t) => t.id === id);
      const workspaceId = task?.workspace_id ?? wsIdRef.current;
      if (!workspaceId) return;

      const apiUpdates: Record<string, unknown> = {};
      if (changes.text !== undefined) apiUpdates.title = changes.text;
      if (changes.done !== undefined) {
        apiUpdates.status = mapStatusToDb(changes.done);
        apiUpdates.completedAt = changes.done ? new Date().toISOString() : null;
      }
      if (changes.priority !== undefined) apiUpdates.priority = changes.priority;
      if (Object.keys(apiUpdates).length > 0) {
        apiFetch<ApiTask>(`/workspaces/${workspaceId}/tasks/${id}`, {
          method: "PATCH",
          body: JSON.stringify(apiUpdates),
        }).catch((err) => console.error("updateTask error:", err));
      }
    },
    [shouldSkipDb],
  );

  const deleteTask = useCallback(
    (id: string) => {
      const task = stateRef.current.tasks.find((t) => t.id === id);
      dispatch({ type: "DELETE_TASK", id });

      if (shouldSkipDb()) return;

      const workspaceId = task?.workspace_id ?? wsIdRef.current;
      if (workspaceId) {
        apiFetch<void>(`/workspaces/${workspaceId}/tasks/${id}`, { method: "DELETE" }).catch(
          (err) => console.error("deleteTask error:", err),
        );
      }
      if (userIdRef.current)
        logActivity(userIdRef.current, "Tarefa excluída", "tarefas", { titulo: task?.text });
    },
    [shouldSkipDb],
  );

  // ─── Notes (apps/api) ────────────────────────────────────────────
  // The SPA renders optimistically: state changes immediately, the apps/api
  // call runs in the background. On apps/api failure we just log — the
  // legacy upsertRow path also swallowed errors. The next page reload
  // re-syncs from /workspaces/:id/notes if anything got out of sync.

  const addNote = useCallback(
    (title: string, content: string): Note => {
      const id = crypto.randomUUID();
      counterRef.current++;
      const color = COLORS[counterRef.current % COLORS.length];
      const note: Note = { id, title, content, color };
      dispatch({ type: "ADD_NOTE", note });

      if (!shouldSkipDb() && wsIdRef.current) {
        apiFetch<ApiNote>(`/workspaces/${wsIdRef.current}/notes`, {
          method: "POST",
          body: JSON.stringify({ title, content, color }),
        })
          .then((created) => {
            // Reconcile the optimistic id with the server id.
            dispatch({
              type: "UPDATE_NOTE",
              id,
              changes: { ...fromApiNote(created), id: created.id },
            });
          })
          .catch((err) => console.error("addNote error:", err));
        if (userIdRef.current)
          logActivity(userIdRef.current, "Nota criada", "notas", { titulo: title });
      }

      return note;
    },
    [shouldSkipDb],
  );

  const updateNote = useCallback(
    (id: string, changes: Partial<Note>) => {
      dispatch({ type: "UPDATE_NOTE", id, changes });

      if (shouldSkipDb() || !wsIdRef.current) return;

      apiFetch<ApiNote>(`/workspaces/${wsIdRef.current}/notes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(toApiNotePatch(changes)),
      }).catch((err) => console.error("updateNote error:", err));
    },
    [shouldSkipDb],
  );

  // Soft-delete: moves note to trash via /notes/trash.
  const deleteNote = useCallback(
    (id: string) => {
      const note = stateRef.current.notes.find((n) => n.id === id);
      const deletedAt = new Date().toISOString();
      dispatch({ type: "UPDATE_NOTE", id, changes: { deleted_at: deletedAt } });

      if (shouldSkipDb() || !wsIdRef.current) return;

      apiFetch<{ trashed: number }>(`/workspaces/${wsIdRef.current}/notes/trash`, {
        method: "POST",
        body: JSON.stringify({ noteIds: [id] }),
      }).catch((err) => console.error("deleteNote error:", err));
      if (userIdRef.current && note)
        logActivity(userIdRef.current, "Nota movida para lixeira", "notas", { titulo: note.title });
    },
    [shouldSkipDb],
  );

  // Restore from trash.
  const restoreNote = useCallback(
    (id: string) => {
      const note = stateRef.current.notes.find((n) => n.id === id);
      dispatch({ type: "UPDATE_NOTE", id, changes: { deleted_at: null } });

      if (shouldSkipDb() || !wsIdRef.current) return;

      apiFetch<{ restored: number }>(`/workspaces/${wsIdRef.current}/notes/restore`, {
        method: "POST",
        body: JSON.stringify({ noteIds: [id] }),
      }).catch((err) => console.error("restoreNote error:", err));
      if (userIdRef.current && note)
        logActivity(userIdRef.current, "Nota restaurada da lixeira", "notas", {
          titulo: note.title,
        });
    },
    [shouldSkipDb],
  );

  // Permanently delete a single note.
  const permanentlyDeleteNote = useCallback(
    (id: string) => {
      const note = stateRef.current.notes.find((n) => n.id === id);
      dispatch({ type: "DELETE_NOTE", id });

      if (shouldSkipDb() || !wsIdRef.current) return;

      apiFetch<void>(`/workspaces/${wsIdRef.current}/notes/${id}`, { method: "DELETE" }).catch(
        (err) => console.error("permanentlyDeleteNote error:", err),
      );
      if (userIdRef.current && note)
        logActivity(userIdRef.current, "Nota excluída permanentemente", "notas", {
          titulo: note.title,
        });
    },
    [shouldSkipDb],
  );

  // Empty trash.
  const emptyTrash = useCallback(() => {
    const trashed = stateRef.current.notes.filter((n) => n.deleted_at);
    for (const note of trashed) {
      dispatch({ type: "DELETE_NOTE", id: note.id });
    }

    if (shouldSkipDb() || !wsIdRef.current) return;

    apiFetch<{ deleted: number }>(`/workspaces/${wsIdRef.current}/notes/trash/empty`, {
      method: "POST",
    }).catch((err) => console.error("emptyTrash error:", err));
    if (userIdRef.current && trashed.length > 0)
      logActivity(userIdRef.current, "Lixeira esvaziada", "notas", { quantidade: trashed.length });
  }, [shouldSkipDb]);

  const addEvent = useCallback(
    (
      day: number,
      month: number,
      year: number,
      label: string,
      category: EventCategory = "outro",
      recurrence: RecurrenceType = "none",
    ) => {
      const id = crypto.randomUUID();
      const color = EVENT_CATEGORY_COLORS[category];
      const event: CalendarEvent = { id, day, month, year, label, color, category, recurrence };
      dispatch({ type: "ADD_EVENT", event });

      if (shouldSkipDb()) return;

      upsertRow(
        id,
        "event",
        { day, month, year, label, color, category, recurrence },
        userIdRef.current!,
        wsIdRef.current,
      );
      if (userIdRef.current)
        logActivity(userIdRef.current, "Evento criado", "calendario", {
          titulo: label,
          data: `${day}/${month}/${year}`,
          categoria: category,
        });
    },
    [shouldSkipDb],
  );

  const updateEvent = useCallback(
    (id: string, changes: Partial<CalendarEvent>) => {
      dispatch({ type: "UPDATE_EVENT", id, changes });

      if (shouldSkipDb()) return;

      const event = stateRef.current.events.find((e) => e.id === id);
      if (event) {
        const merged = { ...event, ...changes };
        if (changes.category) merged.color = EVENT_CATEGORY_COLORS[changes.category];
        upsertRow(
          id,
          "event",
          {
            day: merged.day,
            month: merged.month,
            year: merged.year,
            label: merged.label,
            color: merged.color,
            category: merged.category,
            recurrence: merged.recurrence,
          },
          userIdRef.current!,
          wsIdRef.current,
        );
      }
    },
    [shouldSkipDb],
  );

  const deleteEvent = useCallback(
    (id: string) => {
      const event = stateRef.current.events.find((e) => e.id === id);
      dispatch({ type: "DELETE_EVENT", id });

      if (shouldSkipDb()) return;

      deleteRow(id);
      if (userIdRef.current && event)
        logActivity(userIdRef.current, "Evento excluído", "calendario", { titulo: event.label });
    },
    [shouldSkipDb],
  );

  const actions = useMemo<DashboardActions>(
    () => ({
      addTask,
      toggleTask,
      updateTask,
      deleteTask,
      addNote,
      updateNote,
      deleteNote,
      restoreNote,
      permanentlyDeleteNote,
      emptyTrash,
      addEvent,
      updateEvent,
      deleteEvent,
    }),
    [
      addTask,
      toggleTask,
      updateTask,
      deleteTask,
      addNote,
      updateNote,
      deleteNote,
      restoreNote,
      permanentlyDeleteNote,
      emptyTrash,
      addEvent,
      updateEvent,
      deleteEvent,
    ],
  );

  const contextValue = useMemo(() => ({ state, ...actions }), [state, actions]);

  return (
    <DashboardStateContext.Provider value={state}>
      <DashboardActionsContext.Provider value={actions}>
        <DashboardContext.Provider value={contextValue}>{children}</DashboardContext.Provider>
      </DashboardActionsContext.Provider>
    </DashboardStateContext.Provider>
  );
};

/** Full context — use when you need both state AND actions */
export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}

/** State-only — components using this do NOT re-render when actions change */
export function useDashboardState() {
  const ctx = useContext(DashboardStateContext);
  if (!ctx) throw new Error("useDashboardState must be used within DashboardProvider");
  return ctx;
}

/** Actions-only — components using this do NOT re-render when state changes */
export function useDashboardActions() {
  const ctx = useContext(DashboardActionsContext);
  if (!ctx) throw new Error("useDashboardActions must be used within DashboardProvider");
  return ctx;
}
