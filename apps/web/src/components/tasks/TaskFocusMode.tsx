import { useState, useEffect, useRef, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Pause, RotateCcw, CheckCircle2, Circle, ChevronRight, Zap, Timer, Coffee } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { DbTask } from "@/types/tasks";

interface TaskFocusModeProps {
  task: DbTask;
  onClose: () => void;
  onToggleStatus: () => void;
  onToggleSubtask: (subtaskId: string) => void;
}

const POMODORO_DURATION = 25 * 60; // 25 min in seconds
const BREAK_DURATION = 5 * 60;

type Phase = "focus" | "break";

const TaskFocusMode = memo(({ task, onClose, onToggleStatus, onToggleSubtask }: TaskFocusModeProps) => {
  const [seconds, setSeconds] = useState(POMODORO_DURATION);
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState<Phase>("focus");
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalDuration = phase === "focus" ? POMODORO_DURATION : BREAK_DURATION;
  const progress = ((totalDuration - seconds) / totalDuration) * 100;

  useEffect(() => {
    if (isRunning && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setIsRunning(false);
            if (phase === "focus") {
              setCompletedPomodoros(p => p + 1);
              setPhase("break");
              return BREAK_DURATION;
            } else {
              setPhase("focus");
              return POMODORO_DURATION;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, phase, seconds]);

  // Prevent scroll on body
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === " " && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setIsRunning(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const reset = useCallback(() => {
    setIsRunning(false);
    setSeconds(phase === "focus" ? POMODORO_DURATION : BREAK_DURATION);
  }, [phase]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const subtasksDone = task.subtasks?.filter(s => s.completed).length || 0;
  const subtasksTotal = task.subtasks?.length || 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center"
      >
        {/* Close button */}
        <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors">
          <X className="w-5 h-5" />
        </button>

        {/* Phase indicator */}
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 mb-6 px-4 py-2 rounded-full text-sm font-medium ${
            phase === "focus" ? "bg-primary/10 text-primary" : "bg-green-500/10 text-green-400"
          }`}
        >
          {phase === "focus" ? <Zap className="w-4 h-4" /> : <Coffee className="w-4 h-4" />}
          {phase === "focus" ? "Foco" : "Pausa"}
          {completedPomodoros > 0 && (
            <span className="text-xs opacity-60">• {completedPomodoros} 🍅</span>
          )}
        </motion.div>

        {/* Task title */}
        <h2 className="text-xl md:text-2xl font-bold text-foreground text-center max-w-lg px-4 mb-8">{task.title}</h2>

        {/* Timer */}
        <div className="relative w-48 h-48 mb-8">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--foreground) / 0.05)" strokeWidth="4" />
            <circle
              cx="50" cy="50" r="45" fill="none"
              stroke={phase === "focus" ? "hsl(var(--primary))" : "hsl(142 76% 36%)"}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 45}`}
              strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-mono font-bold text-foreground tabular-nums">{formatTime(seconds)}</span>
            <span className="text-xs text-muted-foreground mt-1">{phase === "focus" ? "restante" : "de pausa"}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 mb-10">
          <button onClick={reset} className="p-3 rounded-xl text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors">
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`p-4 rounded-2xl text-white transition-all ${
              phase === "focus" ? "bg-primary hover:bg-primary/90" : "bg-green-500 hover:bg-green-500/90"
            } shadow-lg`}
          >
            {isRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          </button>
          <button
            onClick={onToggleStatus}
            className="p-3 rounded-xl text-muted-foreground hover:text-green-400 hover:bg-green-400/10 transition-colors"
          >
            <CheckCircle2 className="w-5 h-5" />
          </button>
        </div>

        {/* Subtasks checklist */}
        {subtasksTotal > 0 && (
          <div className="w-full max-w-sm px-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Subtarefas</span>
              <span className="text-xs text-muted-foreground font-mono">{subtasksDone}/{subtasksTotal}</span>
            </div>
            <Progress value={subtasksTotal ? (subtasksDone / subtasksTotal) * 100 : 0} className="h-1.5 mb-3" />
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {task.subtasks?.map(sub => (
                <button
                  key={sub.id}
                  onClick={() => onToggleSubtask(sub.id)}
                  className="w-full flex items-center gap-2 text-left py-1.5 px-2 rounded-lg hover:bg-foreground/5 transition-colors"
                >
                  {sub.completed
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    : <Circle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                  <span className={`text-sm ${sub.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>{sub.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Keyboard hint */}
        <p className="absolute bottom-6 text-[10px] text-muted-foreground/40">
          Espaço para play/pause • Esc para sair
        </p>
      </motion.div>
    </AnimatePresence>
  );
});

TaskFocusMode.displayName = "TaskFocusMode";
export default TaskFocusMode;
