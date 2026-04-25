import React, { useState, useRef, useCallback, lazy, Suspense, useMemo } from "react";
import { GripVertical } from "lucide-react";
import AnimatedItem from "./AnimatedItem";
import WidgetErrorBoundary from "./WidgetErrorBoundary";
import type { WidgetConfig } from "@/hooks/ui/useWidgetLayout";
import { usePlatformIntegrationsContext } from "@/contexts/PlatformIntegrationsContext";
import { useDemo } from "@/contexts/DemoContext";

// Lazy-loaded widgets (8 essenciais)
const CalendarWidget = lazy(() => import("@/components/dashboard/CalendarWidget"));
const EmailWidget = lazy(() => import("@/components/dashboard/EmailWidget"));
const MessagesWidget = lazy(() => import("@/components/dashboard/MessagesWidget"));
const TasksWidget = lazy(() => import("@/components/dashboard/TasksWidget"));
const NotesWidget = lazy(() => import("@/components/dashboard/NotesWidget"));
const ContactsWidget = lazy(() => import("@/components/dashboard/ContactsWidget"));
const WalletWidget = lazy(() => import("@/components/dashboard/WalletWidget"));
const FilesWidget = lazy(() => import("@/components/dashboard/FilesWidget"));
const SystemErrorsWidget = lazy(() => import("@/components/dashboard/SystemErrorsWidget"));

export const WIDGET_MAP: Record<string, React.LazyExoticComponent<React.FC>> = {
  calendar: CalendarWidget,
  email: EmailWidget,
  messages: MessagesWidget,
  tasks: TasksWidget,
  notes: NotesWidget,
  contacts: ContactsWidget,
  wallet: WalletWidget,
  files: FilesWidget,
  "system-errors": SystemErrorsWidget,
};

/** Widget -> integration IDs (OR logic). Omitted = always visible */
const WIDGET_INTEGRATIONS: Record<string, string[]> = {
  email: ["google"],
  messages: ["whatsapp"],
  calendar: ["google"],
  contacts: ["google"],
  files: ["google"],
};

const ALL_WIDGET_IDS = new Set(Object.keys(WIDGET_MAP));

export function useValidWidgetIds() {
  const { isIntegrationEnabled } = usePlatformIntegrationsContext();
  const { isDemoMode } = useDemo();
  return useMemo(() => {
    if (isDemoMode) return ALL_WIDGET_IDS;
    const ids = new Set<string>();
    for (const id of ALL_WIDGET_IDS) {
      const deps = WIDGET_INTEGRATIONS[id];
      if (!deps || deps.some(d => isIntegrationEnabled(d))) {
        ids.add(id);
      }
    }
    return ids;
  }, [isIntegrationEnabled, isDemoMode]);
}

/** @deprecated Use useValidWidgetIds() hook instead for integration-aware filtering */
export const VALID_WIDGET_IDS = ALL_WIDGET_IDS;

const WidgetSkeleton = () => (
  <div className="glass-card rounded-2xl p-4 space-y-3 overflow-hidden relative">
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-foreground/[0.04] to-transparent" />
    <div className="flex items-center gap-2">
      <div className="h-3 w-3 bg-foreground/8 rounded-full" />
      <div className="h-3 w-24 bg-foreground/8 rounded-md" />
    </div>
    <div className="space-y-2">
      <div className="h-3 w-full bg-foreground/5 rounded-md" />
      <div className="h-3 w-3/4 bg-foreground/5 rounded-md" />
    </div>
    <div className="h-14 bg-foreground/[0.03] rounded-xl" />
  </div>
);

interface WidgetGridProps {
  visibleWidgets: WidgetConfig[];
  moveWidgetById: (fromId: string, toId: string) => void;
}

const WidgetGrid = ({ visibleWidgets, moveWidgetById }: WidgetGridProps) => {
  const [dragId, setDragId] = useState<string | null>(null);
  const dragOverId = useRef<string | null>(null);

  const handleDragStart = useCallback((id: string) => setDragId(id), []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    dragOverId.current = id;
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (dragId && dragOverId.current && dragId !== dragOverId.current) {
      moveWidgetById(dragId, dragOverId.current);
    }
    setDragId(null);
    dragOverId.current = null;
  }, [dragId, moveWidgetById]);

  const handleDragEnd = useCallback(() => {
    setDragId(null);
    dragOverId.current = null;
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 sm:auto-rows-[280px] lg:auto-rows-[320px] grid-flow-row-dense gap-3 sm:gap-4 mt-3 sm:mt-4">
      {visibleWidgets.map((config, i) => {
        const Widget = WIDGET_MAP[config.id];
        if (!Widget) return null;
        return (
          <div
            key={config.id}
            draggable
            onDragStart={() => handleDragStart(config.id)}
            onDragOver={(e) => handleDragOver(e, config.id)}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            className={`relative group/drag transition-opacity duration-200 ${
              dragId === config.id ? "opacity-40 scale-95" : ""
            } ${dragId && dragId !== config.id ? "hover:ring-2 hover:ring-primary/30 hover:rounded-2xl" : ""}`}
          >
            <div className="absolute bottom-2 right-2 z-[5] opacity-0 group-hover/drag:opacity-60 transition-opacity cursor-grab active:cursor-grabbing pointer-events-auto">
              <GripVertical className="w-3.5 h-3.5 text-foreground/50" />
            </div>
            <AnimatedItem index={i}>
              <WidgetErrorBoundary widgetName={config.label}>
                <Suspense fallback={<WidgetSkeleton />}>
                  <Widget />
                </Suspense>
              </WidgetErrorBoundary>
            </AnimatedItem>
          </div>
        );
      })}
    </div>
  );
};

export default React.memo(WidgetGrid);
