import { useState, useCallback, useRef, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Square, Clock, RotateCcw } from "lucide-react";
import DeshTooltip from "@/components/ui/DeshTooltip";

interface TaskTimeTrackerProps {
  taskId: string;
  taskTitle: string;
  compact?: boolean;
}

const STORAGE_KEY = "desh-task-timers";

interface TimerState {
  elapsed: number; // ms accumulated
  startedAt: number | null; // Date.now() when started, null if paused
}

function readTimers(): Record<string, TimerState> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}

function writeTimers(timers: Record<string, TimerState>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

const TaskTimeTracker = memo(({ taskId, taskTitle, compact }: TaskTimeTrackerProps) => {
  const [timer, setTimer] = useState<TimerState>(() => readTimers()[taskId] || { elapsed: 0, startedAt: null });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunning = timer.startedAt !== null;

  // Live tick
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimer(prev => ({ ...prev })); // force re-render
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning]);

  const currentElapsed = isRunning
    ? timer.elapsed + (Date.now() - timer.startedAt!)
    : timer.elapsed;

  const persist = useCallback((state: TimerState) => {
    const timers = readTimers();
    timers[taskId] = state;
    writeTimers(timers);
  }, [taskId]);

  const start = useCallback(() => {
    const next = { ...timer, startedAt: Date.now() };
    setTimer(next);
    persist(next);
  }, [timer, persist]);

  const pause = useCallback(() => {
    const next = { elapsed: currentElapsed, startedAt: null };
    setTimer(next);
    persist(next);
  }, [currentElapsed, persist]);

  const reset = useCallback(() => {
    const next = { elapsed: 0, startedAt: null };
    setTimer(next);
    const timers = readTimers();
    delete timers[taskId];
    writeTimers(timers);
  }, [taskId]);

  if (compact && currentElapsed === 0 && !isRunning) {
    return (
      <DeshTooltip label="Iniciar timer">
        <button onClick={(e) => { e.stopPropagation(); start(); }} className="p-1 rounded-lg text-muted-foreground/40 hover:text-primary transition-colors">
          <Play className="w-3 h-3" />
        </button>
      </DeshTooltip>
    );
  }

  return (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <span className={`text-[10px] font-mono tabular-nums ${isRunning ? "text-primary" : "text-muted-foreground"}`}>
        <Clock className="w-2.5 h-2.5 inline mr-0.5" />
        {formatElapsed(currentElapsed)}
      </span>
      {isRunning ? (
        <DeshTooltip label="Pausar">
          <button onClick={pause} className="p-0.5 rounded text-primary hover:bg-primary/10 transition-colors">
            <Pause className="w-3 h-3" />
          </button>
        </DeshTooltip>
      ) : (
        <DeshTooltip label="Iniciar">
          <button onClick={start} className="p-0.5 rounded text-muted-foreground hover:text-primary transition-colors">
            <Play className="w-3 h-3" />
          </button>
        </DeshTooltip>
      )}
      {currentElapsed > 0 && !isRunning && (
        <DeshTooltip label="Resetar">
          <button onClick={reset} className="p-0.5 rounded text-muted-foreground/50 hover:text-destructive transition-colors">
            <RotateCcw className="w-2.5 h-2.5" />
          </button>
        </DeshTooltip>
      )}
    </div>
  );
});

TaskTimeTracker.displayName = "TaskTimeTracker";
export default TaskTimeTracker;
