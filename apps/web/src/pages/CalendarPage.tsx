import type { ComposioCalendarEvent, GoogleCalendar, MappedCalendarEvent } from "@/types/composio";
import { EVENT_CATEGORY_COLORS, EVENT_CATEGORY_LABELS, type EventCategory } from "@/contexts/DashboardContext";
import PageLayout from "@/components/dashboard/PageLayout";
import PageHeader from "@/components/dashboard/PageHeader";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import GlassCard from "@/components/dashboard/GlassCard";
import ConnectionBadge from "@/components/dashboard/ConnectionBadge";
import ScopeRequestBanner from "@/components/dashboard/ScopeRequestBanner";
import ExpandedMonthGrid from "@/components/calendar/ExpandedMonthGrid";
import CalendarAISummary from "@/components/calendar/CalendarAISummary";
import CalendarFiltersBar from "@/components/calendar/CalendarFiltersBar";
import CalendarDayDetailPanel from "@/components/calendar/CalendarDayDetailPanel";
import CalendarDayTooltip from "@/components/calendar/CalendarDayTooltip";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Plus, Trash2, Loader2, GripVertical, Video, CalendarDays, Clock, MapPin, AlignLeft, UserPlus, ChevronDown, ChevronUp, RefreshCw, Download, FileText, FileDown, Bell } from "lucide-react";
import CalendarQuickStats from "@/components/calendar/CalendarQuickStats";
import WorkspaceBadge from "@/components/dashboard/WorkspaceBadge";
import { useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useGoogleServiceData } from "@/hooks/integrations/useGoogleServiceData";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCalendarPageState } from "@/hooks/calendar/useCalendarPageState";

// Lazy-load heavy sub-views that are not always visible
const DayView = lazy(() => import("@/components/dashboard/calendar/DayView"));
const EventEditSheet = lazy(() => import("@/components/calendar/EventEditSheet"));
const EventDetailSheet = lazy(() => import("@/components/calendar/EventDetailSheet"));
const MonthEventsList = lazy(() => import("@/components/calendar/MonthEventsList"));
const WeekTimeGrid = lazy(() => import("@/components/dashboard/calendar/WeekTimeGrid"));
const WeekPlannerPanel = lazy(() => import("@/components/calendar/WeekPlannerPanel"));

// ── Secondary calendar fetcher ──────────────────────────────────────────────
interface SecondaryCalFetcherProps {
  calendarId: string;
  params: Record<string, string>;
  onData: (calendarId: string, events: ComposioCalendarEvent[]) => void;
}
function SecondaryCalFetcher({ calendarId, params, onData }: SecondaryCalFetcherProps) {
  const { data } = useGoogleServiceData<ComposioCalendarEvent[]>({
    service: "calendar",
    path: `/calendars/${encodeURIComponent(calendarId)}/events`,
    params,
    pollingInterval: 30 * 60 * 1000,
  });
  const prevDataRef = useRef<ComposioCalendarEvent[] | null>(null);
  useEffect(() => {
    if (data && data !== prevDataRef.current) {
      prevDataRef.current = data;
      onData(calendarId, data);
    }
  }, [calendarId, data, onData]);
  return null;
}

// ── CustomDay component ─────────────────────────────────────────────────────
interface CustomDayProps {
  date: Date;
  displayMonth: Date;
  activeModifiers: any;
  eventCountByDay: Record<string, number>;
  maxEventCount: number;
  dragEventId: string | null;
  handleDropRef: React.MutableRefObject<(date: Date) => void>;
  tooltipTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  setHoveredDayKey: (key: string | null) => void;
  setTooltipAnchor: (anchor: { x: number; y: number } | null) => void;
  [key: string]: any;
}
function CustomDayCell({
  date, displayMonth, activeModifiers,
  eventCountByDay, maxEventCount, dragEventId,
  handleDropRef, tooltipTimeoutRef, setHoveredDayKey, setTooltipAnchor,
  ...buttonProps
}: CustomDayProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const count = eventCountByDay[key] || 0;
  const isOutside = date.getMonth() !== displayMonth.getMonth();
  const isSelected = activeModifiers?.selected;
  const isToday = activeModifiers?.today;
  const intensity = count > 0 && !isOutside && !isToday && !isSelected
    ? 0.07 + (count / Math.max(maxEventCount, 1)) * 0.25
    : 0;

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!count || isOutside) return;
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipAnchor({ x: rect.left + rect.width / 2, y: rect.top });
    setHoveredDayKey(key);
  };

  const handleMouseLeave = () => {
    tooltipTimeoutRef.current = setTimeout(() => {
      setHoveredDayKey(null);
      setTooltipAnchor(null);
    }, 120);
  };

  return (
    <div
      className={`relative w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center transition-all duration-200 ${
        isDragOver && dragEventId ? "scale-110 z-30" : ""
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (dragEventId && !isOutside) setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={() => {
        setIsDragOver(false);
        if (dragEventId && !isOutside) handleDropRef.current(date);
      }}
    >
      <button
        {...buttonProps}
        className={[
          "w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-lg text-sm font-normal transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isOutside ? "text-muted-foreground/40" : "",
          isToday ? "bg-primary text-primary-foreground font-bold" : "",
          isSelected && !isToday ? "bg-primary/20 text-primary ring-1 ring-primary/40" : "",
          !isToday && !isSelected && !isOutside ? "hover:bg-accent text-foreground" : "",
          buttonProps.disabled ? "opacity-50 pointer-events-none" : "",
          isDragOver && dragEventId && !isOutside
            ? "ring-2 ring-primary bg-primary/25 shadow-[0_0_12px_hsl(var(--primary)/0.4)] scale-105"
            : "",
        ].join(" ")}
        style={intensity > 0 && !(isDragOver && dragEventId) ? { background: `hsl(var(--primary) / ${intensity})` } : undefined}
      >
        {date.getDate()}
      </button>
      {count > 0 && !isOutside && (
        <span className="absolute bottom-0.5 right-0.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold leading-none px-0.5 pointer-events-none">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </div>
  );
}

const CalendarPage = () => {
  const s = useCalendarPageState();

  const CustomDay = useCallback((props: CustomDayProps) => (
    <CustomDayCell
      {...props}
      eventCountByDay={s.eventCountByDay}
      maxEventCount={s.maxEventCount}
      dragEventId={s.dragEventId}
      handleDropRef={s.handleDropRef}
      tooltipTimeoutRef={s.tooltipTimeoutRef}
      setHoveredDayKey={s.setHoveredDayKey}
      setTooltipAnchor={s.setTooltipAnchor}
    />
  ), [s.eventCountByDay, s.maxEventCount, s.dragEventId]);

  return (
    <PageLayout maxWidth="full">
      {/* Render secondary calendar fetchers — invisible */}
      {s.googleConnected && !s.isComposioCalendar && s.secondaryCalendars.map((cal: any) => (
        <SecondaryCalFetcher
          key={cal.id}
          calendarId={cal.id}
          params={s.googleParams}
          onData={s.handleSecondaryData}
        />
      ))}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <PageHeader
        title="Calendário"
        icon={<CalendarDays className="w-6 h-6 text-primary drop-shadow" />}
        actions={
          <div className="flex items-center gap-2">
            <ConnectionBadge isConnected={s.googleConnected} isLoading={s.googleLoading} sourceNames={s.googleNames} size="lg" />
            {/* Calendar selector dropdown */}
            {s.googleConnected && (s.calendarList || []).length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-background/60 hover:bg-background/80 text-foreground transition-colors backdrop-blur-md border border-border/30">
                    <CalendarDays className="w-3.5 h-3.5" />
                    Calendários
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onClick={(e) => { e.preventDefault(); s.toggleCalendar("primary"); }}
                    onDragOver={s.dragEventId ? (e) => { e.preventDefault(); s.setDragOverCalId("primary"); } : undefined}
                    onDragLeave={s.dragEventId ? () => s.setDragOverCalId(null) : undefined}
                    onDrop={s.dragEventId ? (e) => { e.preventDefault(); s.handleDropToCalendar("primary"); } : undefined}
                    className={`flex items-center gap-2 ${s.disabledCalendars.has("primary") ? "opacity-40" : ""} ${s.dragOverCalId === "primary" && s.dragEventId ? "bg-primary/15" : ""}`}
                  >
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0 bg-primary" />
                    <span className="flex-1 min-w-0 truncate text-xs">
                      {(s.calendarList || []).find((c: any) => c.primary)?.summary || "Principal"}
                    </span>
                    {s.calendarEventCounts["primary"] !== undefined && (
                      <span className="text-xs text-muted-foreground shrink-0">{s.calendarEventCounts["primary"]}</span>
                    )}
                  </DropdownMenuItem>
                  {s.secondaryCalendars.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      {s.secondaryCalendars.map((cal: any) => {
                        const color = s.secondaryColorMap[cal.id] || "bg-accent";
                        const isOff = s.disabledCalendars.has(cal.id);
                        return (
                          <DropdownMenuItem
                            key={cal.id}
                            onClick={(e) => { e.preventDefault(); s.toggleCalendar(cal.id); }}
                            onDragOver={s.dragEventId ? (e) => { e.preventDefault(); s.setDragOverCalId(cal.id); } : undefined}
                            onDragLeave={s.dragEventId ? () => s.setDragOverCalId(null) : undefined}
                            onDrop={s.dragEventId ? (e) => { e.preventDefault(); s.handleDropToCalendar(cal.id); } : undefined}
                            className={`flex items-center gap-2 ${isOff ? "opacity-40" : ""} ${s.dragOverCalId === cal.id && s.dragEventId ? "bg-primary/15" : ""}`}
                          >
                            <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${color}`} />
                            <span className="flex-1 min-w-0 truncate text-xs">{cal.summary}</span>
                            {s.calendarEventCounts[cal.id] !== undefined && (
                              <span className="text-xs text-muted-foreground shrink-0">{s.calendarEventCounts[cal.id]}</span>
                            )}
                          </DropdownMenuItem>
                        );
                      })}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {s.googleConnected && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => Object.keys(s.syncTokens).length > 0 ? s.runIncrementalSync() : s.runFullSync()}
                      disabled={s.fullSyncStatus === "running" || s.persistedSyncLoading}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-background/60 hover:bg-background/80 text-foreground transition-colors disabled:opacity-50 backdrop-blur-md border border-border/30"
                    >
                      {s.fullSyncStatus === "running"
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : s.fullSyncEvents.length > 0
                        ? <RefreshCw className="w-3.5 h-3.5" />
                        : <Download className="w-3.5 h-3.5" />}
                      {s.fullSyncEvents.length > 0 ? "Sync" : "Importar"}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs max-w-[220px]">
                    {s.syncTooltipText}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {s.googleConnected && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-background/60 hover:bg-background/80 text-foreground transition-colors backdrop-blur-md border border-border/30">
                    <FileDown className="w-3.5 h-3.5" />
                    Exportar
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={s.exportToIcs} className="flex items-center gap-2">
                    <FileDown className="w-3.5 h-3.5 text-primary" />
                    <div>
                      <p className="text-xs font-medium">Mês atual</p>
                      <p className="text-xs text-muted-foreground">Eventos visíveis do mês</p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={s.exportAllToIcs} className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    <div>
                      <p className="text-xs font-medium">Todos os eventos {s.fullSyncEvents.length > 0 && <span className="text-xs text-primary">({s.fullSyncEvents.length})</span>}</p>
                      <p className="text-xs text-muted-foreground">Histórico completo</p>
                    </div>
                  </DropdownMenuItem>
                  {s.fullSyncEvents.length > 0 && s.fullSyncStatus !== "running" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={async () => {
                          await s.clearSyncCache();
                          s.setFullSyncStatus("idle");
                        }}
                        className="flex items-center gap-2 text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="text-xs">Limpar cache</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        }
      />

      {/* Full sync progress bar */}
      <AnimatePresence>
        {s.fullSyncStatus === "running" && s.fullSyncProgress && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="rounded-xl bg-primary/10 border border-primary/20 px-4 py-2.5 flex items-center gap-3">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
              <div className="flex-1">
                <div className="w-full h-1 rounded-full bg-foreground/10 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    animate={{ width: ["20%", "80%", "20%"] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{s.fullSyncProgress.fetched} eventos</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {s.calendarNeedsScope && s.calendarConnectionVerified && <ScopeRequestBanner service="calendar" onRequest={s.calendarRequestScope} />}

      <CalendarQuickStats events={s.allEvents} selectedDate={s.selectedDate} />

      {/* Keyboard shortcuts hint */}
      <div className="hidden lg:flex items-center gap-3 mb-3 text-[10px] text-muted-foreground/50">
        <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-muted/60 font-mono text-[9px]">←→</kbd> navegar</span>
        <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-muted/60 font-mono text-[9px]">T</kbd> hoje</span>
        <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-muted/60 font-mono text-[9px]">N</kbd> novo evento</span>
        <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-muted/60 font-mono text-[9px]">M</kbd>/<kbd className="px-1 py-0.5 rounded bg-muted/60 font-mono text-[9px]">W</kbd> mês/semana</span>
      </div>

      <CalendarFiltersBar
        calView={s.calView}
        setCalView={s.setCalView}
        filterCategory={s.filterCategory}
        setFilterCategory={s.setFilterCategory}
        filterPending={s.filterPending}
        setFilterPending={s.setFilterPending}
        pendingCount={s.pendingCount}
        aiLoading={s.aiLoading}
        onAiSummary={s.handleAiSummary}
      />

      <CalendarAISummary aiSummary={s.aiSummary} onDismiss={() => s.setAiSummary(null)} />

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 min-h-[calc(100vh-220px)]">
        <div className="min-w-0 flex flex-col min-h-0">
          {s.calView === "week" ? (
            <motion.div
              key="week-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex flex-col gap-4 flex-1 min-h-0"
            >
              <GlassCard className="flex-1 min-h-0 flex flex-col" size="auto">
                <Suspense fallback={<div className="flex-1 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}>
                <WeekTimeGrid
                  weekDays={s.weekDays}
                  events={s.weekTimeEvents}
                  movingEventId={s.movingEventId}
                  onPrevWeek={() => s.setWeekOffset(w => w - 1)}
                  onNextWeek={() => s.setWeekOffset(w => w + 1)}
                  onMoveEvent={s.handleMoveEvent}
                  onEventClick={(ev) => {
                    const full = s.allEvents.find(e => e.id === ev.id);
                    if (full) s.setDetailEvent(full);
                  }}
                  onSlotClick={(date, time) => {
                    s.setWeekNewEventDate(date);
                    s.setWeekNewEventTime(time);
                    const endMin = Math.min(23 * 60, parseInt(time.split(":")[0]) * 60 + parseInt(time.split(":")[1]) + 60);
                    const endH = Math.floor(endMin / 60);
                    const endM = endMin % 60;
                    s.setNewEndTime(`${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`);
                    s.setSelectedDate(date);
                    s.setNewTime(time);
                    s.setNewTitle("");
                    s.setWeekNewEventOpen(true);
                  }}
                />
                </Suspense>
              </GlassCard>
              <Suspense fallback={null}>
              <WeekPlannerPanel weekDays={s.weekDays} weekEvents={s.weekTimeEvents} />
              </Suspense>

              {s.isMobile && (
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center active:scale-90 transition-transform"
                  onClick={() => {
                    const now = new Date();
                    const h = now.getHours();
                    const m = now.getMinutes() < 30 ? 30 : 0;
                    const startH = m === 0 ? h + 1 : h;
                    const startTime = `${String(startH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                    const endTime = `${String(startH + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                    s.setNewTime(startTime);
                    s.setNewEndTime(endTime);
                    s.setWeekNewEventDate(new Date());
                    s.setWeekNewEventTime(startTime);
                    s.setSelectedDate(new Date());
                    s.setNewTitle("");
                    s.setWeekNewEventOpen(true);
                  }}
                >
                  <Plus className="w-6 h-6" />
                </motion.button>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="month-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex-1 min-h-0 flex flex-col"
            >
              <AnimatedItem index={1} className="flex-1 min-h-0">
                <GlassCard className="w-full relative h-full flex flex-col" size="auto">
                  <AnimatePresence>
                    {s.dragEventId && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="absolute top-2 left-1/2 -translate-x-1/2 z-40 px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-lg shadow-primary/30 flex items-center gap-2 pointer-events-none"
                      >
                        <GripVertical className="w-3 h-3" />
                        Solte no dia desejado
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <ExpandedMonthGrid
                    selectedDate={s.selectedDate}
                    onSelectDate={(d) => {
                      s.setSelectedDate(d);
                      if (s.isMobile) s.setMobileDetailOpen(true);
                    }}
                    onMonthChange={(d) => s.setSelectedDate(d)}
                    events={s.filteredAllEvents as any}
                    dragEventId={s.dragEventId}
                    onDrop={(date) => s.handleDropRef.current(date)}
                    className="flex-1 min-h-0"
                  />
                </GlassCard>
              </AnimatedItem>
            </motion.div>
          )}
        </div>

        {s.calView === "month" && !s.isMobile && (
          <CalendarDayDetailPanel
            selectedDate={s.selectedDate}
            selectedEvents={s.selectedEvents}
            filterPending={s.filterPending}
            pendingEvents={s.pendingEvents}
            editingEventId={s.editingEventId}
            dragEventId={s.dragEventId}
            calendarWorkspaceId={s.calendarWorkspaceId}
            rsvpMap={s.rsvpMap}
            rsvpLoading={s.rsvpLoading}
            onRsvp={s.handleRsvp}
            onEdit={(ev) => s.startEditEvent(ev)}
            onDelete={s.handleDeleteEvent}
            onDragStart={s.handleDragStart}
            onDragEnd={() => s.setDragEventId(null)}
            onOpenEdit={() => s.setEditSheetOpen(true)}
            onCancelEdit={() => { s.setEditingEventId(null); s.setEditingEvent(null); }}
            onSetDetailEvent={s.setDetailEvent}
            onDayViewOpen={() => s.setDayViewOpen(true)}
            newTitle={s.newTitle} setNewTitle={s.setNewTitle}
            newTime={s.newTime} setNewTime={s.setNewTime}
            newEndTime={s.newEndTime} setNewEndTime={s.setNewEndTime}
            newCategory={s.newCategory} setNewCategory={s.setNewCategory}
            newRecurrence={s.newRecurrence} setNewRecurrence={s.setNewRecurrence}
            newDescription={s.newDescription} setNewDescription={s.setNewDescription}
            newLocation={s.newLocation} setNewLocation={s.setNewLocation}
            newGuests={s.newGuests} setNewGuests={s.setNewGuests}
            newReminder={s.newReminder} setNewReminder={s.setNewReminder}
            addMeet={s.addMeet} setAddMeet={s.setAddMeet}
            showAdvanced={s.showAdvanced} setShowAdvanced={s.setShowAdvanced}
            googleConnected={s.googleConnected}
            creatingRemote={s.creatingRemote}
            onSubmit={s.handleAddEvent}
          />
        )}
      </div>

      {/* Mobile day detail drawer */}
      {s.isMobile && (
        <Drawer open={s.mobileDetailOpen} onOpenChange={s.setMobileDetailOpen}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle className="text-sm font-semibold">
                {format(s.selectedDate, "d 'de' MMMM", { locale: ptBR })}
                <span className="text-xs text-muted-foreground font-normal ml-2 capitalize">
                  {format(s.selectedDate, "EEEE", { locale: ptBR })} · {s.selectedEvents.length} evento{s.selectedEvents.length !== 1 ? "s" : ""}
                </span>
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-6 max-h-[60vh] overflow-y-auto space-y-2">
              {s.selectedEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CalendarDays className="w-8 h-8 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhum evento neste dia</p>
                </div>
              ) : (
                s.selectedEvents.map(event => {
                  const ev = event as any;
                  return (
                    <div
                      key={event.id}
                      onClick={() => { s.setMobileDetailOpen(false); s.setDetailEvent(event); }}
                      className="rounded-xl border bg-muted/50 border-border/20 p-2.5 cursor-pointer hover:border-primary/20 transition-all"
                    >
                      <div className={`h-0.5 w-full rounded-full mb-1.5 ${EVENT_CATEGORY_COLORS[event.category] || event.color}`} />
                      <p className="text-xs font-semibold text-foreground truncate">{ev.title || ev.label}</p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        {ev.startTime && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {ev.startTime}{ev.endTime ? `–${ev.endTime}` : ""}
                          </span>
                        )}
                        {ev.location && (
                          <span className="flex items-center gap-0.5 truncate max-w-[120px]">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            {ev.location}
                          </span>
                        )}
                        <WorkspaceBadge workspaceId={s.calendarWorkspaceId} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {/* Week view — event creation drawer */}
      <Drawer open={s.weekNewEventOpen} onOpenChange={s.setWeekNewEventOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle className="text-sm font-semibold flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              Novo evento
              {s.weekNewEventDate && (
                <span className="text-xs text-muted-foreground font-normal ml-1">
                  {format(s.weekNewEventDate, "EEE, d MMM", { locale: ptBR })} às {s.weekNewEventTime}
                </span>
              )}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-3">
            <input
              type="text"
              value={s.newTitle}
              onChange={e => s.setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { s.handleAddEvent(); s.setWeekNewEventOpen(false); } }}
              placeholder="Nome do evento…"
              autoFocus
              className="w-full bg-muted/50 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none border border-border/30 focus:border-primary/40 transition-colors"
            />
            <div className="flex gap-2">
              <div className="flex gap-1 flex-1 items-center bg-muted/50 rounded-xl px-2 border border-border/30">
                <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <input
                  type="time"
                  value={s.newTime}
                  onChange={e => s.setNewTime(e.target.value)}
                  className="bg-transparent py-2 text-sm text-foreground outline-none w-full [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-60"
                />
                <span className="text-muted-foreground text-sm">–</span>
                <input
                  type="time"
                  value={s.newEndTime}
                  onChange={e => s.setNewEndTime(e.target.value)}
                  className="bg-transparent py-2 text-sm text-foreground outline-none w-full [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-60"
                />
              </div>
              <select
                value={s.newCategory}
                onChange={e => s.setNewCategory(e.target.value as EventCategory)}
                className="bg-muted/50 rounded-xl px-2 pr-6 py-2 text-sm text-foreground outline-none appearance-none border border-border/30 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23999%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_0.3rem_center] bg-[length:0.8rem]"
              >
                {s.CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{EVENT_CATEGORY_LABELS[cat]}</option>
                ))}
              </select>
            </div>

            {/* Advanced fields */}
            <button
              type="button"
              onClick={() => s.setShowAdvanced(v => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {s.showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {s.showAdvanced ? "Menos" : "Mais detalhes"}
            </button>
            <AnimatePresence initial={false}>
              {s.showAdvanced && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-2"
                >
                  <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2 border border-border/30">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <input type="text" value={s.newLocation} onChange={e => s.setNewLocation(e.target.value)} placeholder="Local" className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
                  </div>
                  <div className="flex items-start gap-2 bg-muted/50 rounded-xl px-3 py-2 border border-border/30">
                    <AlignLeft className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <textarea value={s.newDescription} onChange={e => s.setNewDescription(e.target.value)} placeholder="Descrição" rows={2} className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none" />
                  </div>
                  {s.googleConnected && (
                    <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2 border border-border/30">
                      <UserPlus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <input type="text" value={s.newGuests} onChange={e => s.setNewGuests(e.target.value)} placeholder="Convidados (e-mails)" className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
                    </div>
                  )}
                  <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2 border border-border/30">
                    <Bell className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <select value={s.newReminder} onChange={e => s.setNewReminder(Number(e.target.value))} className="flex-1 bg-transparent text-sm text-foreground outline-none appearance-none">
                      <option value={0}>Sem lembrete</option>
                      <option value={5}>5 min antes</option>
                      <option value={10}>10 min antes</option>
                      <option value={15}>15 min antes</option>
                      <option value={30}>30 min antes</option>
                      <option value={60}>1 hora antes</option>
                      <option value={120}>2 horas antes</option>
                      <option value={1440}>1 dia antes</option>
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-2 pt-1">
              {s.googleConnected && (
                <button
                  type="button"
                  onClick={() => s.setAddMeet(!s.addMeet)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    s.addMeet ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground hover:text-foreground border border-border/30"
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  Meet
                </button>
              )}
              <button
                onClick={() => { s.handleAddEvent(); s.setWeekNewEventOpen(false); }}
                disabled={s.creatingRemote || !s.newTitle.trim()}
                className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {s.creatingRemote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Criar evento
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Monthly events list */}
      {s.calView === "month" && (
        <Suspense fallback={null}>
        <MonthEventsList
          selectedDate={s.selectedDate}
          filteredAllEvents={s.filteredAllEvents}
          rsvpMap={s.rsvpMap}
          rsvpLoading={s.rsvpLoading}
          onRsvp={s.handleRsvp}
          onSelectEvent={s.setDetailEvent}
          setSelectedDate={s.setSelectedDate}
          calendarWorkspaceId={s.calendarWorkspaceId}
        />
        </Suspense>
      )}

      {s.confirmDialog}

      <Suspense fallback={null}>
      <EventDetailSheet
        detailEvent={s.detailEvent}
        onClose={() => s.setDetailEvent(null)}
        rsvpMap={s.rsvpMap}
        rsvpLoading={s.rsvpLoading}
        onRsvp={s.handleRsvp}
        onEdit={(ev) => { s.setDetailEvent(null); s.startEditEvent(ev); }}
        onDelete={s.handleDeleteFromDetail}
      />
      </Suspense>

      <CalendarDayTooltip
        hoveredDayKey={s.hoveredDayKey}
        tooltipAnchor={s.tooltipAnchor}
        eventTitlesByDay={s.eventTitlesByDay}
        eventCountByDay={s.eventCountByDay}
        tooltipTimeoutRef={s.tooltipTimeoutRef}
        setHoveredDayKey={s.setHoveredDayKey}
        setTooltipAnchor={s.setTooltipAnchor}
      />

      <AnimatePresence>
        {s.dayViewOpen && (
          <Suspense fallback={null}>
          <DayView
            date={s.selectedDate}
            events={s.selectedEvents.map((ev: any) => ({
              id: ev.id,
              label: ev.label || ev.title || "",
              color: ev.color || "bg-primary",
              startHour: ev.startTime ? parseInt(ev.startTime.split(":")[0], 10) : undefined,
              startMin: ev.startTime ? parseInt(ev.startTime.split(":")[1], 10) : undefined,
              endHour: ev.endTime ? parseInt(ev.endTime.split(":")[0], 10) : undefined,
              endMin: ev.endTime ? parseInt(ev.endTime.split(":")[1], 10) : undefined,
              googleId: ev.googleId,
              location: ev.location,
              attendees: ev.attendees,
              hangoutLink: ev.hangoutLink,
              remote: !!ev.googleId,
            }))}
            onClose={() => s.setDayViewOpen(false)}
            onEventClick={(dayEv) => {
              s.setDayViewOpen(false);
              const full = s.allEvents.find(e => e.id === dayEv.id);
              if (full) s.setDetailEvent(full);
            }}
          />
          </Suspense>
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
      <EventEditSheet
        open={s.editSheetOpen}
        onOpenChange={(open) => { s.setEditSheetOpen(open); if (!open) { s.setEditingEventId(null); s.setEditingEvent(null); } }}
        editEventTitle={s.editEventTitle}
        setEditEventTitle={s.setEditEventTitle}
        editEventDate={s.editEventDate}
        setEditEventDate={s.setEditEventDate}
        editEventTime={s.editEventTime}
        setEditEventTime={s.setEditEventTime}
        editEventEndTime={s.editEventEndTime}
        setEditEventEndTime={s.setEditEventEndTime}
        editEventLocation={s.editEventLocation}
        setEditEventLocation={s.setEditEventLocation}
        editEventDescription={s.editEventDescription}
        setEditEventDescription={s.setEditEventDescription}
        editEventReminder={s.editEventReminder}
        setEditEventReminder={s.setEditEventReminder}
        editingRemote={s.editingRemote}
        editingEvent={s.editingEvent}
        detectConflict={s.detectConflict}
        onSave={s.saveEditEvent}
        onCancel={() => { s.setEditSheetOpen(false); s.setEditingEventId(null); s.setEditingEvent(null); }}
      />
      </Suspense>
    </PageLayout>
  );
};

export default CalendarPage;
