import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const SHORTCUTS: Record<string, string> = {
  "/": "/search",      // Ctrl+/ → Search
  "k": "/search",      // Ctrl+K → Search
  "e": "/email",       // Ctrl+E → Email
  "t": "/tasks",       // Ctrl+Shift+T → Tasks (we use Shift to avoid browser tab)
  "n": "/notes",       // Ctrl+Shift+N → Notes
  "c": "/calendar",    // Ctrl+Shift+C → Calendar
};

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;

      const key = e.key.toLowerCase();

      // Ctrl+K is handled by CommandPalette directly
      // Ctrl+/ → Search page
      if (key === "/") {
        e.preventDefault();
        navigate("/search");
        return;
      }

      // Ctrl+Shift combinations
      if (e.shiftKey) {
        switch (key) {
          case "t":
            e.preventDefault();
            navigate("/tasks");
            return;
          case "n":
            e.preventDefault();
            navigate("/notes");
            return;
          case "c":
            e.preventDefault();
            navigate("/calendar");
            return;
          case "e":
            e.preventDefault();
            navigate("/email");
            return;
          case "f":
            e.preventDefault();
            navigate("/files");
            return;
          case "p":
            e.preventDefault();
            navigate("/contacts");
            return;
        }
      }

      // Escape → go home
    };

    // Also handle Escape globally
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") {
          (e.target as HTMLElement).blur();
        }
      }
    };

    window.addEventListener("keydown", handler);
    window.addEventListener("keydown", escHandler);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("keydown", escHandler);
    };
  }, [navigate]);
}
