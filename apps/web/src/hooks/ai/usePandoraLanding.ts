import { useState, useCallback, useRef, useEffect } from "react";
import { PANDORA_SCROLL_REACTIONS, findDemoResponse } from "@/lib/pandora-landing-prompts";

export interface PandoraMsg {
  id: string;
  role: "pandora" | "user";
  text: string;
  quickReplies?: string[];
  read?: boolean;
  timestamp?: string;
}

export function usePandoraLanding() {
  const [messages, setMessages] = useState<PandoraMsg[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [guidedMode, setGuidedMode] = useState(true);
  const triggeredSections = useRef(new Set<string>());

  const addPandoraMessage = useCallback((text: string, quickReplies: string[] = []) => {
    const msg: PandoraMsg = {
      id: crypto.randomUUID(),
      role: "pandora",
      text,
      quickReplies,
      read: false,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => {
      // Prevent duplicate messages (same text within 2s)
      const last = prev[prev.length - 1];
      if (last?.role === "pandora" && last.text === text && 
          last.timestamp && Date.now() - new Date(last.timestamp).getTime() < 2000) {
        return prev;
      }
      return [...prev, msg];
    });
    setUnreadCount((c) => c + 1);
  }, []);

  const triggerSectionReaction = useCallback(
    (sectionId: string) => {
      if (triggeredSections.current.has(sectionId)) return;
      const reaction = PANDORA_SCROLL_REACTIONS[sectionId];
      if (!reaction) return;

      // If not guided mode, only trigger on key sections
      if (!guidedMode && !["hero", "pricing", "final"].includes(sectionId)) return;

      triggeredSections.current.add(sectionId);
      setTimeout(() => {
        addPandoraMessage(reaction.message, reaction.quickReplies);
      }, reaction.delay);
    },
    [guidedMode, addPandoraMessage]
  );

  const sendUserMessage = useCallback(
    (text: string) => {
      const userMsg: PandoraMsg = {
        id: crypto.randomUUID(),
        role: "user",
        text,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Handle quick-reply actions
      if (text === "Vou explorar sozinho") {
        setGuidedMode(false);
        setTimeout(() => addPandoraMessage("Sem problemas! Estarei aqui se precisar. 😊"), 500);
        return;
      }
      if (text === "Sim, me guie") {
        setGuidedMode(true);
        setTimeout(() => addPandoraMessage("Ótimo! Continue rolando a página e eu vou te explicando cada parte. ⬇️"), 500);
        return;
      }
      if (text === "Começar grátis" || text === "Criar conta") {
        setTimeout(() => addPandoraMessage("Vou te redirecionar para o cadastro! 🚀"), 300);
        setTimeout(() => { window.location.href = "/auth"; }, 1200);
        return;
      }

      // Demo response
      setTimeout(() => {
        addPandoraMessage(findDemoResponse(text));
      }, 800);
    },
    [addPandoraMessage]
  );

  const markAllRead = useCallback(() => {
    setUnreadCount(0);
    setMessages((prev) => prev.map((m) => ({ ...m, read: true })));
  }, []);

  useEffect(() => {
    if (isOpen) markAllRead();
  }, [isOpen, messages.length, markAllRead]);

  return {
    messages,
    isOpen,
    setIsOpen,
    unreadCount,
    triggerSectionReaction,
    sendUserMessage,
    guidedMode,
  };
}
