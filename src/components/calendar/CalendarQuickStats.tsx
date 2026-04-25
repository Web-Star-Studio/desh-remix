import { memo, useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Clock, AlertTriangle, TrendingUp, Users, Timer, Zap } from "lucide-react";
import { EVENT_CATEGORY_COLORS, EVENT_CATEGORY_LABELS, type EventCategory } from "@/types/calendar";

interface CalendarQuickStatsProps {
  events: any[];
  selectedDate: Date;
}

const CalendarQuickStats = memo(({ events, selectedDate }: CalendarQuickStatsProps) => {
  const [now, setNow] = useState(() => new Date());

  // Update "now" every 30s for countdown freshness
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    const month = selectedDate.getMonth();
    const year = selectedDate.getFullYear();
    const monthEvents = events.filter(e => e.month === month && e.year === year);

    // Events today
    const todayEvents = events.filter(
      e => e.day === now.getDate() && e.month === now.getMonth() && e.year === now.getFullYear()
    );

    // Next upcoming event today
    let nextEvent: { title: string; startTime: string; minutesAway: number } | null = null;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    for (const e of todayEvents) {
      if (!e.startTime) continue;
      const [h, m] = e.startTime.split(":").map(Number);
      const evMin = h * 60 + m;
      const diff = evMin - nowMin;
      if (diff > 0 && (!nextEvent || diff < nextEvent.minutesAway)) {
        nextEvent = { title: e.title || e.label, startTime: e.startTime, minutesAway: diff };
      }
    }

    // Free slots today (gaps ≥ 30min between 8h-20h)
    const freeSlots: { start: string; end: string }[] = [];
    const timedToday = todayEvents
      .filter((e: any) => e.startTime && e.endTime)
      .map((e: any) => {
        const [sh, sm] = e.startTime.split(":").map(Number);
        const [eh, em] = e.endTime.split(":").map(Number);
        return { start: sh * 60 + sm, end: eh * 60 + em };
      })
      .sort((a, b) => a.start - b.start);

    let cursor = Math.max(8 * 60, nowMin); // start from now or 8am
    const dayEnd = 20 * 60;
    for (const slot of timedToday) {
      if (slot.start > cursor && slot.start - cursor >= 30) {
        const s = Math.max(cursor, 8 * 60);
        if (s < slot.start) {
          freeSlots.push({
            start: `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`,
            end: `${String(Math.floor(slot.start / 60)).padStart(2, "0")}:${String(slot.start % 60).padStart(2, "0")}`,
          });
        }
      }
      cursor = Math.max(cursor, slot.end);
    }
    if (cursor < dayEnd && dayEnd - cursor >= 30) {
      freeSlots.push({
        start: `${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`,
        end: `${String(Math.floor(dayEnd / 60)).padStart(2, "0")}:${String(dayEnd % 60).padStart(2, "0")}`,
      });
    }

    // Conflict detection
    const conflicts: { day: number; events: string[] }[] = [];
    const dayBuckets: Record<number, any[]> = {};
    monthEvents.forEach(e => {
      if (!dayBuckets[e.day]) dayBuckets[e.day] = [];
      dayBuckets[e.day].push(e);
    });

    Object.entries(dayBuckets).forEach(([day, evs]) => {
      const timedEvs = evs.filter((e: any) => e.startTime && e.endTime);
      for (let i = 0; i < timedEvs.length; i++) {
        for (let j = i + 1; j < timedEvs.length; j++) {
          const a = timedEvs[i];
          const b = timedEvs[j];
          const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
          const aStart = toMin(a.startTime);
          const aEnd = toMin(a.endTime);
          const bStart = toMin(b.startTime);
          const bEnd = toMin(b.endTime);
          if (aStart < bEnd && aEnd > bStart) {
            conflicts.push({ day: Number(day), events: [a.title || a.label, b.title || b.label] });
          }
        }
      }
    });

    // Category distribution
    const catCounts: Record<string, number> = {};
    monthEvents.forEach(e => {
      const cat = e.category || "outro";
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });

    // Busiest day
    let busiestDay = 0;
    let busiestCount = 0;
    Object.entries(dayBuckets).forEach(([day, evs]) => {
      if (evs.length > busiestCount) { busiestCount = evs.length; busiestDay = Number(day); }
    });

    // Total meeting hours
    let totalMinutes = 0;
    monthEvents.forEach((e: any) => {
      if (e.startTime && e.endTime) {
        const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
        const diff = toMin(e.endTime) - toMin(e.startTime);
        if (diff > 0) totalMinutes += diff;
      }
    });

    return {
      monthTotal: monthEvents.length,
      todayTotal: todayEvents.length,
      conflicts,
      catCounts,
      busiestDay,
      busiestCount,
      totalHours: Math.round(totalMinutes / 60 * 10) / 10,
      meetCount: monthEvents.filter((e: any) => e.meetLink).length,
      nextEvent,
      freeSlots: freeSlots.slice(0, 3),
    };
  }, [events, selectedDate, now]);

  if (stats.monthTotal === 0 && !stats.nextEvent) return null;

  const formatCountdown = (mins: number) => {
    if (mins < 1) return "agora";
    if (mins < 60) return `${mins}min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h${m}min` : `${h}h`;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 mb-4">
      {/* Next event countdown */}
      <AnimatePresence>
        {stats.nextEvent && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl bg-primary/10 border border-primary/20 px-3 py-2 flex items-center gap-2.5"
          >
            <Timer className="w-4 h-4 text-primary shrink-0 animate-pulse" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{stats.nextEvent.title}</p>
              <p className="text-[10px] text-muted-foreground">
                às {stats.nextEvent.startTime} · em {formatCountdown(stats.nextEvent.minutesAway)}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-xl bg-muted/50 border border-border/20 p-2.5 text-center">
          <CalendarDays className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="text-lg font-bold text-foreground">{stats.monthTotal}</p>
          <p className="text-[9px] text-muted-foreground">eventos no mês</p>
        </div>

        <div className="rounded-xl bg-muted/50 border border-border/20 p-2.5 text-center">
          <Clock className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="text-lg font-bold text-foreground">{stats.totalHours}h</p>
          <p className="text-[9px] text-muted-foreground">total agendado</p>
        </div>

        <div className={`rounded-xl border p-2.5 text-center ${
          stats.conflicts.length > 0 ? "bg-amber-500/10 border-amber-500/20" : "bg-muted/50 border-border/20"
        }`}>
          <AlertTriangle className={`w-4 h-4 mx-auto mb-1 ${stats.conflicts.length > 0 ? "text-amber-400" : "text-muted-foreground"}`} />
          <p className={`text-lg font-bold ${stats.conflicts.length > 0 ? "text-amber-400" : "text-foreground"}`}>
            {stats.conflicts.length}
          </p>
          <p className="text-[9px] text-muted-foreground">conflitos</p>
        </div>

        <div className="rounded-xl bg-muted/50 border border-border/20 p-2.5 text-center">
          <TrendingUp className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="text-lg font-bold text-foreground">{stats.busiestDay || "—"}</p>
          <p className="text-[9px] text-muted-foreground">dia mais cheio ({stats.busiestCount})</p>
        </div>
      </div>

      {/* Free slots today */}
      {stats.freeSlots.length > 0 && (
        <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/15 p-2.5">
          <p className="text-[10px] font-semibold text-emerald-400 mb-1 flex items-center gap-1">
            <Zap className="w-3 h-3" /> Horários livres hoje
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {stats.freeSlots.map((slot, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-medium">
                {slot.start}–{slot.end}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Category breakdown bar */}
      {Object.keys(stats.catCounts).length > 1 && (
        <div className="rounded-xl bg-muted/50 border border-border/20 p-2.5">
          <div className="flex items-center gap-1 h-2 rounded-full overflow-hidden bg-foreground/5">
            {Object.entries(stats.catCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, count]) => (
                <div
                  key={cat}
                  className={`h-full ${EVENT_CATEGORY_COLORS[cat as EventCategory] || "bg-muted-foreground"} transition-all`}
                  style={{ width: `${(count / stats.monthTotal) * 100}%` }}
                  title={`${EVENT_CATEGORY_LABELS[cat as EventCategory] || cat}: ${count}`}
                />
              ))}
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {Object.entries(stats.catCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, count]) => (
                <span key={cat} className="flex items-center gap-1 text-[9px] text-muted-foreground">
                  <span className={`w-1.5 h-1.5 rounded-full ${EVENT_CATEGORY_COLORS[cat as EventCategory] || "bg-muted-foreground"}`} />
                  {EVENT_CATEGORY_LABELS[cat as EventCategory] || cat} ({count})
                </span>
              ))}
            {stats.meetCount > 0 && (
              <span className="flex items-center gap-1 text-[9px] text-primary">
                <Users className="w-2.5 h-2.5" /> {stats.meetCount} com Meet
              </span>
            )}
          </div>
        </div>
      )}

      {/* Conflict warnings */}
      {stats.conflicts.length > 0 && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5">
          <p className="text-[10px] font-semibold text-amber-400 mb-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Conflitos detectados
          </p>
          <div className="space-y-0.5">
            {stats.conflicts.slice(0, 3).map((c, i) => (
              <p key={i} className="text-[10px] text-foreground/70">
                Dia {c.day}: <span className="font-medium">{c.events[0]}</span> ↔ <span className="font-medium">{c.events[1]}</span>
              </p>
            ))}
            {stats.conflicts.length > 3 && (
              <p className="text-[9px] text-muted-foreground">+{stats.conflicts.length - 3} mais</p>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
});

CalendarQuickStats.displayName = "CalendarQuickStats";

export default CalendarQuickStats;
