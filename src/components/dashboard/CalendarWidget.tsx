import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import GlassCard from "./GlassCard";
import WidgetTitle from "./WidgetTitle";
import ConnectionBadge from "./ConnectionBadge";
import GoogleSyncTimestamp from "./GoogleSyncTimestamp";
import ScopeRequestBanner from "./ScopeRequestBanner";
import MonthGrid from "./calendar/MonthGrid";
import WeekGrid from "./calendar/WeekGrid";
import EventList from "./calendar/EventList";
import {
  CalendarDays, Sparkles, Loader2, ExternalLink, Search, Clock,
  TrendingUp, BarChart3, Filter, ChevronRight, Sun, Moon, BookOpen,
  AlertCircle, CalendarCheck, CalendarClock, ListTodo, Zap, Plus
} from "lucide-react";
import { useCalendarEvents } from "@/hooks/calendar/useCalendarEvents";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { EVENT_CATEGORY_COLORS, EVENT_CATEGORY_LABELS, type EventCategory } from "@/types/calendar";
import { setCalendarTodayCount } from "@/stores/calendarTodayStore";

const CalendarWidget = () => {
  const navigate = useNavigate();
  const now = new Date();
  const todayDay = now.getDate();
  const todayMonth = now.getMonth();
  const todayYear = now.getFullYear();

  const [monthOffset, setMonthOffset] = useState(0);
  const [view, setView] = useState<"month" | "week">("month");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<EventCategory | null>(null);
  const [quickAdd, setQuickAdd] = useState(false);
  const viewDate = new Date(todayYear, todayMonth + monthOffset, 1);
  const viewMonth = viewDate.getMonth();
  const viewYear = viewDate.getFullYear();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const monthName = viewDate.toLocaleDateString("pt-BR", { month: "long" });
  const isCurrentMonth = viewMonth === todayMonth && viewYear === todayYear;

  const {
    displayEvents, isLoading, isConnected, connectionCount, connectionNames,
    creatingEvent, editingEventId, editValue, setEditValue, actionLoading,
    handleAdd, handleDeleteRemote, handleEditRemote,
    startEditing, cancelEditing, deleteEvent,
    calendarNeedsScope, calendarRequestScope,
    calendarLastSync, refetch, googleConnected,
  } = useCalendarEvents(viewMonth, viewYear);

  const events = displayEvents;

  // Publish today event count to sidebar store
  useEffect(() => {
    const todayEvents = events.filter(e => e.day === todayDay && e.month === todayMonth && e.year === todayYear);
    setCalendarTodayCount(todayEvents.length);
    return () => setCalendarTodayCount(0);
  }, [events, todayDay, todayMonth, todayYear]);

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  // Week grid days
  const weekStart = new Date(todayYear, todayMonth, todayDay - now.getDay() + weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  // AI agenda summary
  const { invoke } = useEdgeFn();
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const aiCacheRef = useRef<{ key: string; text: string; ts: number } | null>(null);

  const generateAgendaSummary = useCallback(async () => {
    const cacheKey = `${viewYear}-${viewMonth}-${todayDay}-${view}`;
    if (aiCacheRef.current?.key === cacheKey && Date.now() - aiCacheRef.current.ts < 5 * 60 * 1000) {
      setAiSummary(aiCacheRef.current.text);
      return;
    }
    if (events.length === 0) {
      setAiSummary("Nenhum evento para resumir.");
      return;
    }
    setAiLoading(true);
    try {
      const relevantEvents = view === "week"
        ? events.filter(e => weekDays.some(wd => wd.getDate() === e.day && wd.getMonth() === e.month))
        : events;
      const eventTitles = relevantEvents.slice(0, 15).map(e => `- ${e.label} (dia ${e.day})`).join("\n");
      const modeLabel = view === "week" ? "desta semana" : "deste mês";
      const { data, error } = await invoke<any>({
        fn: "chat",
        body: {
          messages: [
            { role: "system", content: `Você é um assistente pessoal. Resuma a agenda de eventos do usuário ${modeLabel} de forma concisa e útil em português brasileiro, destacando prioridades e conflitos de horário. Máximo 3 frases.` },
            { role: "user", content: `Meus eventos ${modeLabel}:\n${eventTitles}` }
          ]
        }
      });
      if (error) throw new Error(error);
      const text = typeof data === "string" ? data : (data?.content || data?.choices?.[0]?.message?.content || "Resumo indisponível.");
      setAiSummary(text);
      aiCacheRef.current = { key: cacheKey, text, ts: Date.now() };
    } catch (e) {
      console.error("AI summary error:", e);
      setAiSummary("Não foi possível gerar o resumo.");
    } finally {
      setAiLoading(false);
    }
  }, [events, viewYear, viewMonth, todayDay, invoke, view, weekDays]);

  const eventDays = new Set(events.map(e => e.day));
  const eventCountByDay = events.reduce((acc, e) => {
    acc[e.day] = (acc[e.day] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  const maxEventCount = Math.max(...Object.values(eventCountByDay), 1);

  // ===== SMART DATA =====
  // Today's events
  const todayEvents = useMemo(() =>
    events.filter(e => e.day === todayDay && e.month === todayMonth && e.year === todayYear),
    [events, todayDay, todayMonth, todayYear]
  );

  // Upcoming events (next 7 days)
  const upcomingEvents = useMemo(() => {
    const upcoming: typeof events = [];
    for (let offset = 0; offset <= 7; offset++) {
      const d = new Date(todayYear, todayMonth, todayDay + offset);
      const day = d.getDate();
      const month = d.getMonth();
      const year = d.getFullYear();
      events.forEach(e => {
        if (e.day === day && e.month === month && e.year === year) {
          upcoming.push(e);
        }
      });
    }
    return upcoming;
  }, [events, todayDay, todayMonth, todayYear]);

  // Stats
  const stats = useMemo(() => {
    const busiestDay = Object.entries(eventCountByDay).sort(([, a], [, b]) => b - a)[0];
    const weekendCount = events.filter(e => {
      const d = new Date(e.year, e.month, e.day);
      return d.getDay() === 0 || d.getDay() === 6;
    }).length;
    return {
      total: events.length,
      todayCount: todayEvents.length,
      busiestDay: busiestDay ? { day: Number(busiestDay[0]), count: busiestDay[1] } : null,
      weekendCount,
      avgPerDay: events.length > 0 ? (events.length / daysInMonth).toFixed(1) : "0",
    };
  }, [events, todayEvents, eventCountByDay, daysInMonth]);

  // Filter events for popup search + category
  const filteredEvents = useMemo(() => {
    let list = [...events];
    if (categoryFilter) list = list.filter(e => e.category === categoryFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e => e.label.toLowerCase().includes(q));
    }
    return list;
  }, [events, categoryFilter, searchQuery]);

  // Extract time helper
  const extractTime = (label: string): string | null => {
    const match = label.match(/^(\d{2}:\d{2})/);
    return match ? match[1] : null;
  };
  const cleanLabel = (label: string) => label.replace(/^\d{2}:\d{2}\s*-\s*/, "").replace(/\s*\(\d{2}:\d{2}\)/, "");

  // Time of day greeting
  const hour = now.getHours();
  const timeIcon = hour < 12 ? <Sun className="w-3 h-3 text-yellow-400" /> : hour < 18 ? <Sun className="w-3 h-3 text-orange-400" /> : <Moon className="w-3 h-3 text-indigo-400" />;

  // ===== COMPACT CARD: Upcoming events mini-list =====
  const UpcomingMiniList = () => {
    const show = todayEvents.length > 0 ? todayEvents.slice(0, 3) : upcomingEvents.slice(0, 3);
    if (show.length === 0) return null;
    return (
      <div className="space-y-1 mt-2 pt-2 border-t border-foreground/5">
        <p className="text-[10px] text-muted-foreground/70 font-medium flex items-center gap-1">
          {timeIcon}
          {todayEvents.length > 0 ? `Hoje · ${todayEvents.length} evento${todayEvents.length > 1 ? "s" : ""}` : "Próximos"}
        </p>
        {show.map(e => {
          const time = extractTime(e.label);
          const title = cleanLabel(e.label);
          return (
            <div key={e.id} className="flex items-center gap-1.5 py-0.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${e.color}`} />
              {time && <span className="text-[9px] text-muted-foreground/60 tabular-nums">{time}</span>}
              <span className="text-[11px] text-foreground/80 truncate">{title}</span>
              {todayEvents.length === 0 && (
                <span className="text-[9px] text-muted-foreground/50 ml-auto shrink-0">dia {e.day}</span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ===== POPUP CONTENT =====
  const popupContent = (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        <div className="p-2.5 rounded-xl bg-foreground/5 text-center">
          <p className="text-lg font-bold text-foreground">{stats.total}</p>
          <p className="text-[10px] text-muted-foreground">Eventos</p>
        </div>
        <div className="p-2.5 rounded-xl bg-foreground/5 text-center">
          <p className="text-lg font-bold text-primary">{stats.todayCount}</p>
          <p className="text-[10px] text-muted-foreground">Hoje</p>
        </div>
        <div className="p-2.5 rounded-xl bg-foreground/5 text-center">
          <p className="text-lg font-bold text-foreground">{stats.avgPerDay}</p>
          <p className="text-[10px] text-muted-foreground">Média/dia</p>
        </div>
        <div className="p-2.5 rounded-xl bg-foreground/5 text-center">
          <p className="text-lg font-bold text-foreground">{stats.busiestDay?.day || "-"}</p>
          <p className="text-[10px] text-muted-foreground">Dia cheio</p>
        </div>
      </div>

      {/* AI Summary */}
      <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Resumo {view === "week" ? "da Semana" : "do Mês"}
          </span>
          <button
            onClick={generateAgendaSummary}
            disabled={aiLoading}
            className="text-[10px] px-2.5 py-1 rounded-lg bg-primary/15 text-primary font-medium hover:bg-primary/25 transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            {aiLoading ? "Gerando..." : aiSummary ? "Atualizar" : "Gerar"}
          </button>
        </div>
        {aiSummary ? (
          <p className="text-xs text-foreground/80 leading-relaxed">{aiSummary}</p>
        ) : (
          <p className="text-xs text-muted-foreground/60 italic">Clique para um resumo inteligente da sua agenda.</p>
        )}
      </div>

      {/* Tabs: Calendário / Agenda / Insights */}
      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-8">
          <TabsTrigger value="calendar" className="text-[11px] gap-1 flex items-center justify-center"><CalendarDays className="w-3 h-3 shrink-0" />Calendário</TabsTrigger>
          <TabsTrigger value="agenda" className="text-[11px] gap-1 flex items-center justify-center"><ListTodo className="w-3 h-3 shrink-0" />Agenda</TabsTrigger>
          <TabsTrigger value="insights" className="text-[11px] gap-1 flex items-center justify-center"><BarChart3 className="w-3 h-3 shrink-0" />Insights</TabsTrigger>
        </TabsList>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="space-y-3 mt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-foreground/5 rounded-lg p-0.5">
                <button
                  onClick={() => { setView("month"); setWeekOffset(0); setAiSummary(null); }}
                  className={`text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors ${view === "month" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >Mês</button>
                <button
                  onClick={() => { setView("week"); setAiSummary(null); }}
                  className={`text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors ${view === "week" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >Semana</button>
              </div>
              <button
                onClick={() => {
                  if (selectedDay === null) setSelectedDay(todayDay);
                  setQuickAdd(true);
                }}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                title="Adicionar evento"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <button onClick={() => navigate("/calendar")} className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
              Abrir calendário <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          {view === "month" ? (
            <MonthGrid
              monthName={monthName} viewYear={viewYear} isCurrentMonth={isCurrentMonth}
              todayDay={todayDay} days={days} selectedDay={selectedDay} eventDays={eventDays}
              eventCountByDay={eventCountByDay} maxEventCount={maxEventCount}
              onSelectDay={setSelectedDay}
              onPrevMonth={() => { setMonthOffset(m => m - 1); setSelectedDay(null); }}
              onNextMonth={() => { setMonthOffset(m => m + 1); setSelectedDay(null); }}
              onGoToday={() => { setMonthOffset(0); setSelectedDay(null); }}
            />
          ) : (
            <WeekGrid
              weekDays={weekDays} todayDay={todayDay} todayMonth={todayMonth}
              selectedDay={selectedDay} displayEvents={events}
              onSelectDay={setSelectedDay}
              onPrevWeek={() => setWeekOffset(w => w - 1)}
              onNextWeek={() => setWeekOffset(w => w + 1)}
            />
          )}
          <EventList
            selectedDay={selectedDay} displayEvents={events}
            editingEventId={editingEventId} editValue={editValue}
            actionLoading={actionLoading} creatingEvent={creatingEvent}
            initialAdding={quickAdd}
            viewMonth={viewMonth} viewYear={viewYear}
            onSetEditValue={setEditValue} onAdd={handleAdd}
            onEditRemote={handleEditRemote} onDeleteRemote={handleDeleteRemote}
            onDeleteLocal={deleteEvent} onStartEditing={startEditing}
            onCancelEditing={cancelEditing}
            onAddingChange={(val) => { if (!val) setQuickAdd(false); }}
          />
        </TabsContent>

        {/* Agenda Tab - searchable list of all events */}
        <TabsContent value="agenda" className="space-y-3 mt-3">
          {/* Search + filters */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar eventos..."
                className="w-full bg-foreground/5 rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>

          {/* Category filter chips */}
          <div className="flex flex-wrap gap-1">
            <button onClick={() => setCategoryFilter(null)}
              className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${!categoryFilter ? "bg-primary/20 text-primary" : "bg-foreground/5 text-muted-foreground hover:text-foreground"}`}>
              Todos
            </button>
            {(Object.keys(EVENT_CATEGORY_LABELS) as EventCategory[]).map(cat => (
              <button key={cat} onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                className={`text-[10px] px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 ${categoryFilter === cat ? "bg-primary/20 text-primary" : "bg-foreground/5 text-muted-foreground hover:text-foreground"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${EVENT_CATEGORY_COLORS[cat]}`} />
                {EVENT_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* Events grouped by day */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin">
            {filteredEvents.length > 0 ? (
              (() => {
                const grouped = new Map<number, typeof filteredEvents>();
                filteredEvents.forEach(e => {
                  if (!grouped.has(e.day)) grouped.set(e.day, []);
                  grouped.get(e.day)!.push(e);
                });
                return Array.from(grouped.entries())
                  .sort(([a], [b]) => a - b)
                  .map(([day, dayEvts]) => (
                    <div key={day} className="space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                        <CalendarDays className="w-2.5 h-2.5" />
                        Dia {day}
                        {day === todayDay && isCurrentMonth && (
                          <Badge variant="secondary" className="text-[8px] px-1 py-0">HOJE</Badge>
                        )}
                        <span className="text-muted-foreground/50">· {dayEvts.length}</span>
                      </p>
                      {dayEvts.map(e => {
                        const time = extractTime(e.label);
                        const title = cleanLabel(e.label);
                        return (
                          <div key={e.id} className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-foreground/5 transition-colors">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${e.color}`} />
                            {time && <span className="text-[10px] text-muted-foreground/70 tabular-nums w-10">{time}</span>}
                            <span className="text-xs text-foreground/85 truncate flex-1">{title}</span>
                          </div>
                        );
                      })}
                    </div>
                  ));
              })()
            ) : (
              <p className="text-xs text-muted-foreground/60 italic text-center py-6">
                {searchQuery || categoryFilter ? "Nenhum evento com esses filtros" : "Nenhum evento este mês"}
              </p>
            )}
          </div>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-3 mt-3">
          {/* Distribution by day of week */}
          <div className="p-3 rounded-xl bg-foreground/5">
            <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-primary" /> Distribuição por dia da semana
            </p>
            <div className="flex items-end gap-1 h-16">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((dayName, idx) => {
                const count = events.filter(e => {
                  const d = new Date(e.year, e.month, e.day);
                  return d.getDay() === idx;
                }).length;
                const max = Math.max(...["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((_, i) =>
                  events.filter(e => new Date(e.year, e.month, e.day).getDay() === i).length
                ), 1);
                const height = count > 0 ? Math.max((count / max) * 100, 10) : 4;
                return (
                  <div key={dayName} className="flex-1 flex flex-col items-center gap-0.5">
                    <span className="text-[9px] text-muted-foreground/70 tabular-nums">{count || ""}</span>
                    <div
                      className={`w-full rounded-t-sm transition-all ${count > 0 ? "bg-primary/40" : "bg-foreground/10"}`}
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-[8px] text-muted-foreground/60">{dayName}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick insights */}
          <div className="space-y-2">
            {stats.busiestDay && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-foreground/5">
                <AlertCircle className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">Dia mais movimentado</p>
                  <p className="text-[10px] text-muted-foreground">Dia {stats.busiestDay.day} com {stats.busiestDay.count} eventos</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-foreground/5">
              <CalendarCheck className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="text-xs font-medium text-foreground">Eventos no fim de semana</p>
                <p className="text-[10px] text-muted-foreground">{stats.weekendCount} eventos em sábados e domingos</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-foreground/5">
              <TrendingUp className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="text-xs font-medium text-foreground">Média diária</p>
                <p className="text-[10px] text-muted-foreground">{stats.avgPerDay} eventos por dia em {monthName}</p>
              </div>
            </div>
            {todayEvents.length === 0 && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/10">
                <CalendarClock className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">Dia livre hoje!</p>
                  <p className="text-[10px] text-muted-foreground">Nenhum evento agendado para hoje</p>
                </div>
              </div>
            )}
          </div>

          <button onClick={() => navigate("/calendar")}
            className="w-full py-2 rounded-lg bg-foreground/5 text-xs text-muted-foreground hover:text-primary hover:bg-foreground/10 transition-colors flex items-center justify-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" /> Abrir calendário completo <ChevronRight className="w-3 h-3" />
          </button>
        </TabsContent>
      </Tabs>
    </div>
  );

  return (
    <GlassCard size="wide" className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <WidgetTitle
            label="Calendário"
            icon={<CalendarDays className="w-3.5 h-3.5 text-sky-400" />}
            popupIcon={<CalendarDays className="w-5 h-5 text-primary" />}
            popupContent={popupContent}
          />
          <ConnectionBadge isConnected={isConnected} isLoading={isLoading} sourceCount={connectionCount} sourceNames={connectionNames} />
        </div>
        <div className="flex items-center gap-1">
          {googleConnected && <GoogleSyncTimestamp lastSyncedAt={calendarLastSync} onRefresh={refetch} isLoading={isLoading} />}
          <button
            onClick={() => {
              if (selectedDay === null) setSelectedDay(todayDay);
              setQuickAdd(true);
            }}
            className="w-6 h-6 flex items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            title="Adicionar evento"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setView(view === "month" ? "week" : "month"); setWeekOffset(0); }}
            className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors"
          >
            {view === "month" ? "Semana" : "Mês"}
          </button>
          <CalendarDays className="w-4 h-4 text-primary" />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        {calendarNeedsScope && !isLoading && <ScopeRequestBanner service="calendar" onRequest={calendarRequestScope} />}

        {view === "month" ? (
          <MonthGrid
            monthName={monthName} viewYear={viewYear} isCurrentMonth={isCurrentMonth}
            todayDay={todayDay} days={days} selectedDay={selectedDay} eventDays={eventDays}
            eventCountByDay={eventCountByDay} maxEventCount={maxEventCount}
            onSelectDay={setSelectedDay}
            onPrevMonth={() => { setMonthOffset(m => m - 1); setSelectedDay(null); }}
            onNextMonth={() => { setMonthOffset(m => m + 1); setSelectedDay(null); }}
            onGoToday={() => { setMonthOffset(0); setSelectedDay(null); }}
          />
        ) : (
          <WeekGrid
            weekDays={weekDays} todayDay={todayDay} todayMonth={todayMonth}
            selectedDay={selectedDay} displayEvents={events}
            onSelectDay={setSelectedDay}
            onPrevWeek={() => setWeekOffset(w => w - 1)}
            onNextWeek={() => setWeekOffset(w => w + 1)}
          />
        )}

        {/* Compact upcoming events mini-list */}
        <UpcomingMiniList />

        <EventList
          selectedDay={selectedDay} displayEvents={events}
          editingEventId={editingEventId} editValue={editValue}
          actionLoading={actionLoading} creatingEvent={creatingEvent}
          initialAdding={quickAdd}
          viewMonth={viewMonth} viewYear={viewYear}
          onSetEditValue={setEditValue} onAdd={handleAdd}
          onEditRemote={handleEditRemote} onDeleteRemote={handleDeleteRemote}
          onDeleteLocal={deleteEvent} onStartEditing={startEditing}
          onCancelEditing={cancelEditing}
          onAddingChange={(val) => { if (!val) setQuickAdd(false); }}
        />
      </div>
    </GlassCard>
  );
};

export default React.memo(CalendarWidget);
