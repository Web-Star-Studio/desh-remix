import { useState, useCallback, useRef, useEffect } from "react";
import type { RefObject } from "react";
import {
  type TriggerType,
  type CommandContext,
  type SmartCommandItem,
  fetchMentionItems,
  fetchTagItems,
  getSlashCommands,
  getDateTimeString,
} from "@/lib/smartCommandsData";

export type PopupPlacement = "below" | "above" | "above-left";

interface UseSmartCommandsOptions {
  inputRef: RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  value: string;
  onChange: (newValue: string) => void;
  enabledTriggers?: TriggerType[];
  context?: CommandContext;
  onSlashAction?: (command: string, currentText: string) => void;
  placement?: PopupPlacement;
}

interface PopupState {
  open: boolean;
  trigger: TriggerType | null;
  query: string;
  items: SmartCommandItem[];
  selectedIndex: number;
  position: { top: number; left: number };
}

export function useSmartCommands({
  inputRef,
  value,
  onChange,
  enabledTriggers = ["@", "/", "#"],
  context = "general",
  onSlashAction,
  placement = "below",
}: UseSmartCommandsOptions) {
  const [popup, setPopup] = useState<PopupState>({
    open: false, trigger: null, query: "", items: [], selectedIndex: 0,
    position: { top: 0, left: 0 },
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerPosRef = useRef<number>(-1);

  // Detect trigger character and query
  const detectTrigger = useCallback((text: string, cursorPos: number): { trigger: TriggerType; query: string; startPos: number } | null => {
    if (cursorPos === 0) return null;
    const beforeCursor = text.slice(0, cursorPos);

    for (const t of enabledTriggers) {
      // Find the last occurrence of the trigger char
      const lastIdx = beforeCursor.lastIndexOf(t);
      if (lastIdx === -1) continue;
      // Must be at start of text or preceded by whitespace/newline
      if (lastIdx > 0 && !/\s/.test(beforeCursor[lastIdx - 1])) continue;
      const query = beforeCursor.slice(lastIdx + 1);
      // No spaces allowed in query (means user moved past the mention)
      if (/\s/.test(query) && t !== "/") continue;
      if (t === "/" && query.includes(" ")) continue;
      return { trigger: t, query, startPos: lastIdx };
    }
    return null;
  }, [enabledTriggers]);

  // Get popup position from cursor
  const getPopupPosition = useCallback(() => {
    const el = inputRef.current;
    if (!el) return { top: 0, left: 0 };
    const rect = el.getBoundingClientRect();
    
    if (placement === "above" || placement === "above-left") {
      // Position above the input; the popup component will use bottom-anchoring
      return { top: rect.top, left: rect.left };
    }
    // Default: position below the input element
    return { top: rect.bottom + 4, left: rect.left };
  }, [inputRef, placement]);

  // Fetch items based on trigger
  const fetchItems = useCallback(async (trigger: TriggerType, query: string) => {
    let items: SmartCommandItem[] = [];
    if (trigger === "@") {
      items = await fetchMentionItems(query);
    } else if (trigger === "/") {
      items = getSlashCommands(context, query);
    } else if (trigger === "#") {
      items = await fetchTagItems(query);
    }
    return items.slice(0, 8);
  }, [context]);

  // Handle text change — detect triggers
  const handleChange = useCallback((newValue: string, cursorPos?: number) => {
    onChange(newValue);

    const pos = cursorPos ?? (inputRef.current?.selectionStart ?? newValue.length);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const detected = detectTrigger(newValue, pos);
      if (!detected) {
        setPopup(p => p.open ? { ...p, open: false } : p);
        return;
      }

      triggerPosRef.current = detected.startPos;
      const items = await fetchItems(detected.trigger, detected.query);

      setPopup({
        open: items.length > 0,
        trigger: detected.trigger,
        query: detected.query,
        items,
        selectedIndex: 0,
        position: getPopupPosition(),
      });
    }, 150);
  }, [onChange, detectTrigger, fetchItems, getPopupPosition, inputRef]);

  // Select an item from popup
  const selectItem = useCallback((item: SmartCommandItem) => {
    const startPos = triggerPosRef.current;
    if (startPos === -1) return;

    // Handle /data — insert date inline
    if (item.id === "slash_data") {
      const before = value.slice(0, startPos);
      const cursorPos = inputRef.current?.selectionStart ?? value.length;
      const after = value.slice(cursorPos);
      const dateStr = getDateTimeString();
      const newValue = before + dateStr + " " + after;
      onChange(newValue);
      setPopup(p => ({ ...p, open: false }));
      setTimeout(() => {
        const el = inputRef.current;
        if (el && "setSelectionRange" in el) {
          const newPos = before.length + dateStr.length + 1;
          el.setSelectionRange(newPos, newPos);
          el.focus();
        }
      }, 10);
      return;
    }

    // Handle slash actions
    if (item.isAction && item.trigger === "/") {
      const before = value.slice(0, startPos);
      const cursorPos = inputRef.current?.selectionStart ?? value.length;
      const after = value.slice(cursorPos);
      // Remove the slash command from text
      onChange(before + after);
      setPopup(p => ({ ...p, open: false }));
      onSlashAction?.(item.label, before + after);
      setTimeout(() => {
        const el = inputRef.current;
        if (el && "setSelectionRange" in el) {
          el.setSelectionRange(before.length, before.length);
          el.focus();
        }
      }, 10);
      return;
    }

    // Insert mention/tag text
    const before = value.slice(0, startPos);
    const cursorPos = inputRef.current?.selectionStart ?? value.length;
    const after = value.slice(cursorPos);
    const insertText = item.insertText + " ";
    const newValue = before + insertText + after;
    onChange(newValue);
    setPopup(p => ({ ...p, open: false }));

    setTimeout(() => {
      const el = inputRef.current;
      if (el && "setSelectionRange" in el) {
        const newPos = before.length + insertText.length;
        el.setSelectionRange(newPos, newPos);
        el.focus();
      }
    }, 10);
  }, [value, onChange, onSlashAction, inputRef]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!popup.open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPopup(p => ({ ...p, selectedIndex: (p.selectedIndex + 1) % p.items.length }));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPopup(p => ({ ...p, selectedIndex: (p.selectedIndex - 1 + p.items.length) % p.items.length }));
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (popup.items[popup.selectedIndex]) {
        e.preventDefault();
        e.stopPropagation();
        selectItem(popup.items[popup.selectedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setPopup(p => ({ ...p, open: false }));
    }
  }, [popup.open, popup.items, popup.selectedIndex, selectItem]);

  // Close popup when clicking outside
  useEffect(() => {
    if (!popup.open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-smart-command-popup]")) {
        setPopup(p => ({ ...p, open: false }));
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [popup.open]);

  const closePopup = useCallback(() => setPopup(p => ({ ...p, open: false })), []);

  return {
    popup,
    handleChange,
    handleKeyDown,
    selectItem,
    closePopup,
  };
}
