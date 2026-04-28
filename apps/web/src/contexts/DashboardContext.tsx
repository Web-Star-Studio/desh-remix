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
// ─── Events (apps/api `/workspaces/:id/events`) ───────────────────────
//
// Calendar wave: events moved off legacy `user_data` JSONB to a first-party
// table. The SPA still works in the (day, month, year) integer triple, so
// the API returns those columns directly. createEvent fires the
// `event_created` automation trigger server-side — no client-side emit.

interface ApiEvent {
  id: string;
  workspace_id: string;
  label: string;
  day: number;
  month: number;
  year: number;
  category: EventCategory;
  recurrence: RecurrenceType;
  color: string;
}

function fromApiEvent(e: ApiEvent): CalendarEvent {
  return {
    id: e.id,
    day: e.day,
    month: e.month,
    year: e.year,
    label: e.label,
    color: e.color,
    category: e.category,
    recurrence: e.recurrence,
    workspace_id: e.workspace_id,
  };
}

async function apiListEvents(workspaceId: string): Promise<CalendarEvent[]> {
  try {
    const res = await apiFetch<{ events: ApiEvent[] }>(
      `/workspaces/${workspaceId}/events`,
    );
    return res.events.map(fromApiEvent);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return [];
    console.error("apiListEvents error:", err);
    return [];
  }
}

async function apiCreateEvent(
  workspaceId: string,
  body: {
    label: string;
    day: number;
    month: number;
    year: number;
    category: EventCategory;
    recurrence: RecurrenceType;
    color: string;
  },
): Promise<CalendarEvent | null> {
  try {
    const res = await apiFetch<{ event: ApiEvent }>(
      `/workspaces/${workspaceId}/events`,
      { method: "POST", body: JSON.stringify(body) },
    );
    return fromApiEvent(res.event);
  } catch (err) {
    console.error("apiCreateEvent error:", err);
    return null;
  }
}

async function apiUpdateEvent(
  workspaceId: string,
  eventId: string,
  patch: Partial<{
    label: string;
    day: number;
    month: number;
    year: number;
    category: EventCategory;
    recurrence: RecurrenceType;
    color: string;
  }>,
): Promise<void> {
  try {
    await apiFetch(`/workspaces/${workspaceId}/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  } catch (err) {
    console.error("apiUpdateEvent error:", err);
  }
}

async function apiDeleteEvent(workspaceId: string, eventId: string): Promise<void> {
  try {
    await apiFetch(`/workspaces/${workspaceId}/events/${eventId}`, {
      method: "DELETE",
    });
  } catch (err) {
    console.error("apiDeleteEvent error:", err);
  }
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

  // Load all data on mount — tasks/notes/events all live on apps/api now.
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    (async () => {
      // Tasks and notes are workspace-scoped in apps/api. In "view all",
      // tasks use the effective/default workspace until an aggregate endpoint
      // exists; notes/events keep the existing active-workspace behavior.
      const tasksPromise = effectiveWsId
        ? apiListTasks(effectiveWsId)
        : Promise.resolve<Task[]>([]);
      const notesPromise = activeWorkspaceId
        ? apiListNotes(activeWorkspaceId)
        : Promise.resolve<Note[]>([]);
      const eventsPromise = activeWorkspaceId
        ? apiListEvents(activeWorkspaceId)
        : Promise.resolve<CalendarEvent[]>([]);

      const [tasks, notes, events] = await Promise.all([
        tasksPromise,
        notesPromise,
        eventsPromise,
      ]);

      if (controller.signal.aborted) return;

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

  // Calendar wave: events ride apps/api `/workspaces/:id/events`. Optimistic
  // dispatch first, then persist; on success, swap the optimistic id for the
  // server-assigned one so subsequent edits/deletes target the real row.
  const addEvent = useCallback(
    (
      day: number,
      month: number,
      year: number,
      label: string,
      category: EventCategory = "outro",
      recurrence: RecurrenceType = "none",
    ) => {
      const optimisticId = crypto.randomUUID();
      const color = EVENT_CATEGORY_COLORS[category];
      const event: CalendarEvent = {
        id: optimisticId,
        day,
        month,
        year,
        label,
        color,
        category,
        recurrence,
      };
      dispatch({ type: "ADD_EVENT", event });

      if (shouldSkipDb()) return;

      const workspaceId = wsIdRef.current;
      if (!workspaceId) return;

      apiCreateEvent(workspaceId, { label, day, month, year, category, recurrence, color })
        .then((created) => {
          if (created && created.id !== optimisticId) {
            dispatch({ type: "DELETE_EVENT", id: optimisticId });
            dispatch({ type: "ADD_EVENT", event: created });
          }
        });

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

      const workspaceId = wsIdRef.current;
      if (!workspaceId) return;

      const patch: Partial<{
        label: string;
        day: number;
        month: number;
        year: number;
        category: EventCategory;
        recurrence: RecurrenceType;
        color: string;
      }> = {};
      if (changes.label !== undefined) patch.label = changes.label;
      if (changes.day !== undefined) patch.day = changes.day;
      if (changes.month !== undefined) patch.month = changes.month;
      if (changes.year !== undefined) patch.year = changes.year;
      if (changes.recurrence !== undefined) patch.recurrence = changes.recurrence;
      if (changes.category !== undefined) {
        patch.category = changes.category;
        if (changes.color === undefined) patch.color = EVENT_CATEGORY_COLORS[changes.category];
      }
      if (changes.color !== undefined) patch.color = changes.color;

      apiUpdateEvent(workspaceId, id, patch);
    },
    [shouldSkipDb],
  );

  const deleteEvent = useCallback(
    (id: string) => {
      const event = stateRef.current.events.find((e) => e.id === id);
      dispatch({ type: "DELETE_EVENT", id });

      if (shouldSkipDb()) return;

      const workspaceId = wsIdRef.current;
      if (workspaceId) apiDeleteEvent(workspaceId, id);

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
