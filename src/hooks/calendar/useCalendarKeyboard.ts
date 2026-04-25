import { useEffect, useCallback, useRef } from "react";

interface UseCalendarKeyboardOptions {
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
  calView: "month" | "week";
  setCalView: (v: "month" | "week") => void;
  onNewEvent?: () => void;
  onToday?: () => void;
  weekOffset?: number;
  setWeekOffset?: (fn: (prev: number) => number) => void;
}

export function useCalendarKeyboard({
  selectedDate,
  setSelectedDate,
  calView,
  setCalView,
  onNewEvent,
  onToday,
  weekOffset,
  setWeekOffset,
}: UseCalendarKeyboardOptions) {
  const optionsRef = useRef({
    selectedDate, setSelectedDate, calView, setCalView,
    onNewEvent, onToday, weekOffset, setWeekOffset,
  });

  useEffect(() => {
    optionsRef.current = {
      selectedDate, setSelectedDate, calView, setCalView,
      onNewEvent, onToday, weekOffset, setWeekOffset,
    };
  });

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const { selectedDate, setSelectedDate, calView, setCalView, onNewEvent, onToday, setWeekOffset } = optionsRef.current;
    
    // Don't handle if typing in an input
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable) return;

    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        if (calView === "month") {
          const prev = new Date(selectedDate);
          prev.setDate(prev.getDate() - 1);
          setSelectedDate(prev);
        } else {
          setWeekOffset?.(w => w - 1);
        }
        break;

      case "ArrowRight":
        e.preventDefault();
        if (calView === "month") {
          const next = new Date(selectedDate);
          next.setDate(next.getDate() + 1);
          setSelectedDate(next);
        } else {
          setWeekOffset?.(w => w + 1);
        }
        break;

      case "ArrowUp":
        e.preventDefault();
        if (calView === "month") {
          const prev = new Date(selectedDate);
          prev.setDate(prev.getDate() - 7);
          setSelectedDate(prev);
        }
        break;

      case "ArrowDown":
        e.preventDefault();
        if (calView === "month") {
          const next = new Date(selectedDate);
          next.setDate(next.getDate() + 7);
          setSelectedDate(next);
        }
        break;

      case "t":
      case "T":
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          onToday?.();
        }
        break;

      case "n":
      case "N":
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          onNewEvent?.();
        }
        break;

      case "m":
      case "M":
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          setCalView("month");
        }
        break;

      case "w":
      case "W":
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          setCalView("week");
        }
        break;
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
