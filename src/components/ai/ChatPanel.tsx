import pandoraAvatar from "@/assets/pandora-avatar.png";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Send, Loader2, Mic, MicOff, Sparkles, StopCircle, Copy, Check, Download, ImagePlus, X, Search, ChevronUp, ChevronDown, RefreshCw, Pencil, RotateCcw, Volume2, VolumeX, Settings2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSpeechRecognition } from "@/hooks/audio/useSpeechRecognition";
import { useAuth } from "@/contexts/AuthContext";
import { useSmartCommands } from "@/hooks/ui/useSmartCommands";
import SmartCommandPopup from "@/components/ui/SmartCommandPopup";
import { motion, AnimatePresence } from "framer-motion";
import { useAIToolExecution, type ToolCall } from "@/hooks/ai/useAIToolExecution";
import { useToolJobQueue, isHeavyTool } from "@/hooks/ai/useToolJobQueue";
import { useElevenLabsTTS, ELEVENLABS_VOICES } from "@/hooks/audio/useElevenLabsTTS";
import { usePandoraMCP } from "@/hooks/ai/usePandoraMCP";
import type { AIMessage, AIConversation } from "@/hooks/ai/useAIConversations";
import type { AIAgent } from "@/hooks/ai/useAIAgents";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
}

interface ChatPanelProps {
  conversation: AIConversation | null;
  agent: AIAgent | null;
  onUpdateMessages: (messages: AIMessage[]) => void;
  onUpdateTitle: (title: string) => void;
}

const SUGGESTED_PROMPTS = [
  { label: "📊 Resumo do dia", message: "Me dê um resumo completo do meu dashboard: tarefas, eventos, finanças e e-mails pendentes.", desc: "Visão geral de tudo" },
  { label: "✅ Organizar tarefas", message: "Analise minhas tarefas e sugira uma priorização inteligente para hoje.", desc: "Priorização inteligente" },
  { label: "💰 Análise financeira", message: "Faça uma análise das minhas finanças recentes e sugira melhorias.", desc: "Insights e dicas" },
  { label: "🧠 O que você sabe?", message: "Liste todas as memórias e informações que você tem sobre mim.", desc: "Memórias e contexto" },
  { label: "📝 Criar nota resumo", message: "Crie uma nota com um resumo de tudo que fizemos hoje nas nossas conversas.", desc: "Documentar o dia" },
  { label: "🔍 Buscar na web", message: "Busque na web as notícias mais relevantes de hoje.", desc: "Notícias atuais" },
];

const PANDORA_CAPABILITIES = [
  { icon: "📧", title: "E-mails", desc: "Enviar, ler e organizar" },
  { icon: "💬", title: "WhatsApp", desc: "Mensagens e contatos" },
  { icon: "📅", title: "Agenda", desc: "Eventos e lembretes" },
  { icon: "✅", title: "Tarefas", desc: "Criar e priorizar" },
  { icon: "💰", title: "Finanças", desc: "Análises e registros" },
  { icon: "📝", title: "Notas", desc: "Criar e buscar" },
  { icon: "🖼️", title: "Imagens", desc: "Gerar com IA" },
  { icon: "📊", title: "Relatórios", desc: "PDFs personalizados" },
  { icon: "🎨", title: "Temas", desc: "Personalizar visual" },
  { icon: "🔍", title: "Web", desc: "Pesquisas online" },
];

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="opacity-0 group-hover/msg:opacity-100 p-1 rounded-xl hover:bg-muted/70 transition-all"
      title="Copiar"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
    </button>
  );
};

const TypingIndicator = () => (
  <div className="flex justify-start">
    <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-muted flex items-center gap-1">
      <motion.span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
      <motion.span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }} />
      <motion.span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }} />
    </div>
  </div>
);

function parseSSEStream(body: ReadableStream, onDelta: (text: string) => void, onDone: () => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";

  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { onDone(); return; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) onDelta(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) onDelta(content);
          } catch { /* ignore */ }
        }
      }
      onDone();
    } catch (e: any) {
      if (e.name !== "AbortError") console.error(e);
      onDone();
    }
  })();
}

const getTextContent = (content: any): string => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.filter((p: any) => p.type === "text").map((p: any) => p.text).join("");
  return "";
};

const ChatPanel = ({ conversation, agent, onUpdateMessages, onUpdateTitle }: ChatPanelProps) => {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [dynamicReplies, setDynamicReplies] = useState<{ label: string; message: string }[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatchIdx, setSearchMatchIdx] = useState(0);
  const [editingMsgIdx, setEditingMsgIdx] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [lastError, setLastError] = useState(false);
  const [mcpMode, setMcpMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const voiceSettingsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const pendingVoiceSendRef = useRef(false);
  const sentViaVoiceRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs to track latest state for use in callbacks without stale closures
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;
  const pendingImagesRef = useRef(pendingImages);
  pendingImagesRef.current = pendingImages;

  const chatSmartCommands = useSmartCommands({
    inputRef,
    value: input,
    onChange: setInput,
    enabledTriggers: ["@", "/", "#"],
    context: "chat",
  });

  const { executeToolCall, buildContext } = useAIToolExecution({
    setDynamicReplies,
  });

  const { enqueueTools, waitForBatch, clearBatch, activeBatches } = useToolJobQueue();

  const tts = useElevenLabsTTS();
  const mcp = usePandoraMCP();

  useEffect(() => {
    if (conversation) {
      setMessages(conversation.messages.length > 0 ? conversation.messages : [
        { role: "assistant", content: agent ? `Olá! Sou **${agent.name}** ${agent.icon}. ${agent.description || "Como posso ajudar?"}` : "Olá! 👋 Sou a **Pandora**, assistente do DESH. Como posso ajudar?" },
      ]);
    } else {
      setMessages([{ role: "assistant", content: "Olá! 👋 Sou a **Pandora**. Comece uma nova conversa!" }]);
    }
    setSearchOpen(false);
    setSearchQuery("");
    setLastError(false);
    setEditingMsgIdx(null);
  }, [conversation?.id]);

  const saveMessages = useCallback((msgs: AIMessage[]) => {
    if (!conversation) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onUpdateMessages(msgs);
      // Generate intelligent title after first assistant response
      if (conversation.title === "Nova Conversa" && msgs.length >= 2) {
        const firstUserMsg = msgs.find(m => m.role === "user");
        const firstAssistantMsg = msgs.find(m => m.role === "assistant" && msgs.indexOf(m) > 0);
        if (firstUserMsg && firstAssistantMsg) {
          const userText = getTextContent(firstUserMsg.content).substring(0, 200);
          const assistantText = getTextContent(firstAssistantMsg.content).substring(0, 200);
          // Generate title via AI (fire-and-forget, no credits)
          (async () => {
            try {
              const resp = await fetch(CHAT_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getAccessToken()}` },
                body: JSON.stringify({
                  messages: [
                    { role: "system", content: "Gere um título curto (3-6 palavras) em português para esta conversa. Retorne APENAS o título, sem aspas, sem pontuação final, sem explicação." },
                    { role: "user", content: `Usuário: ${userText}\nAssistente: ${assistantText}` },
                  ],
                  model: "google/gemini-2.5-flash-lite",
                  
                }),
              });
              if (resp.ok) {
                const ct = resp.headers.get("content-type") || "";
                let title = "";
                if (ct.includes("application/json")) {
                  const data = await resp.json();
                  title = data.content || data.choices?.[0]?.message?.content || "";
                } else if (resp.body) {
                  // SSE - collect all
                  const reader = resp.body.getReader();
                  const decoder = new TextDecoder();
                  let buf = "";
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buf += decoder.decode(value, { stream: true });
                  }
                  // Extract content from SSE
                  for (const line of buf.split("\n")) {
                    if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
                    try { title += JSON.parse(line.slice(6)).choices?.[0]?.delta?.content || ""; } catch {}
                  }
                }
                title = title.trim().replace(/^["']|["']$/g, "").replace(/\.$/, "");
                if (title && title.length > 2 && title.length < 60) {
                  onUpdateTitle(title);
                }
              }
            } catch { /* silent fail for title generation */ }
          })();
        }
      }
    }, 1000);
  }, [conversation, onUpdateMessages, onUpdateTitle]);

  // Smart auto-scroll: only scroll if user is near bottom
  const isNearBottomRef = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversation?.id]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  // Close voice settings on outside click
  useEffect(() => {
    if (!showVoiceSettings) return;
    const handler = (e: MouseEvent) => {
      if (voiceSettingsRef.current && !voiceSettingsRef.current.contains(e.target as Node)) {
        setShowVoiceSettings(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showVoiceSettings]);

  // Cleanup timers and abort on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  // Search matches
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return messages.map((m, i) => ({ idx: i, text: getTextContent(m.content) }))
      .filter(m => m.text.toLowerCase().includes(q));
  }, [messages, searchQuery]);

  useEffect(() => {
    if (searchMatches.length > 0 && scrollRef.current) {
      const msgEl = scrollRef.current.children[searchMatches[searchMatchIdx]?.idx];
      msgEl?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [searchMatchIdx, searchMatches]);

  // Keyboard shortcut: Ctrl+F for search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [searchOpen]);

  const handleAbort = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  /** Simulate typing effect for text responses — optimized with cancellation support */
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simulateTyping = useCallback((allMessages: AIMessage[], fullText: string): Promise<AIMessage[]> => {
    // Clear any previous typing animation
    if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }

    return new Promise((resolve) => {
      const CHUNK_SIZE = 40;
      const INTERVAL_MS = 16;
      const ts = new Date().toISOString();
      const finalMsg: AIMessage = { role: "assistant" as const, content: fullText, timestamp: ts };
      const finalResult = [...allMessages, finalMsg];

      if (fullText.length <= CHUNK_SIZE * 3) {
        setMessages(finalResult);
        resolve(finalResult);
        return;
      }

      // Pre-create partial message ref to avoid new arrays on each tick
      const baseMessages = [...allMessages];
      let idx = 0;
      const tick = () => {
        idx = Math.min(idx + CHUNK_SIZE, fullText.length);
        if (idx >= fullText.length) {
          typingTimerRef.current = null;
          setMessages(finalResult);
          resolve(finalResult);
        } else {
          // Use functional update to minimize allocations
          const partial = fullText.substring(0, idx);
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && last.timestamp === ts) {
              const updated = prev.slice();
              updated[updated.length - 1] = { ...last, content: partial };
              return updated;
            }
            return [...baseMessages, { role: "assistant" as const, content: partial, timestamp: ts }];
          });
          typingTimerRef.current = setTimeout(tick, INTERVAL_MS);
        }
      };
      tick();
    });
  }, []);

  /** Core AI request logic — reused by send, regenerate, and edit. Includes retry for transient failures. */
  const requestAI = useCallback(async (allMessages: AIMessage[], signal?: AbortSignal): Promise<AIMessage[] | null> => {
    const MAX_RETRIES = 2;
    const RETRY_DELAYS = [1500, 3000];

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const context = await buildContext();
        // Maestro: inject workspace_id, agent_id, is_all_mode
        const wsCtx = (window as any).__deshWorkspaceContext;
        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getAccessToken()}` },
          body: JSON.stringify({
            messages: allMessages, context,
            agent_id: agent?.id || null, model: agent?.model || undefined,
            temperature: agent?.temperature ?? undefined, system_prompt: agent?.system_prompt || undefined,
            workspace_id: wsCtx?.activeWorkspaceId || null,
            is_all_mode: wsCtx?.activeWorkspaceId === null,
          }),
          signal,
        });

        if (resp.status === 429) { toast.error("Muitas requisições. Aguarde alguns segundos."); return null; }
        if (resp.status === 402) { toast.error("Créditos de IA insuficientes. Recarregue em Configurações."); return null; }
        // Retry on 500/502/503/504
        if (resp.status >= 500 && attempt < MAX_RETRIES) {
          console.debug(`[Pandora] Transient error ${resp.status}, retry ${attempt + 1}/${MAX_RETRIES}`);
          await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
          continue;
        }
        if (!resp.ok) { const errData = await resp.json().catch(() => ({})); throw new Error(errData.error || `HTTP ${resp.status}`); }

      const contentType = resp.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const data = await resp.json();
        if (data.type === "tool_calls") {
          // Split into heavy (async queue) and light (sync) tools
          const heavyTools = data.tool_calls.filter((tc: any) => isHeavyTool(tc.name));
          const lightTools = data.tool_calls.filter((tc: any) => !isHeavyTool(tc.name));

          // Execute light tools synchronously with timeout protection
          const TOOL_TIMEOUT = 30_000;
          const lightResults = await Promise.all(
            lightTools.map(async (tc: any) => {
              try {
                const resultPromise = executeToolCall({ id: tc.id, name: tc.name, arguments: tc.arguments });
                const timeoutPromise = new Promise<string>((_, reject) => setTimeout(() => reject(new Error("timeout")), TOOL_TIMEOUT));
                const result = await Promise.race([resultPromise, timeoutPromise]);
                const isError = /erro|falha|não encontrad|expirad|❌|invalid|failed|error/i.test(result);
                return `[${isError ? "ERRO" : "OK"}] ${tc.name}: ${result}`;
              } catch (e: any) {
                return `[ERRO] ${tc.name}: ${e.message === "timeout" ? "Tempo limite excedido" : e.message || "Falha na execução"}`;
              }
            })
          );

          // Execute heavy tools via async queue
          let heavyResults: string[] = [];
          if (heavyTools.length > 0) {
            const batchId = crypto.randomUUID();
            // Show progress message
            setMessages(prev => [...prev, {
              role: "assistant" as const,
              content: `⏳ Executando ${heavyTools.length} ação(ões) em segundo plano...`,
              timestamp: new Date().toISOString(),
            }]);

            await enqueueTools(
              batchId,
              heavyTools.map((tc: any) => ({ id: tc.id, name: tc.name, arguments: tc.arguments })),
              conversation?.id
            );

            try {
              const batchResult = await waitForBatch(batchId, 120_000);
              heavyResults = batchResult.results.map(r => {
                if (r.status === "done") {
                  const isError = /\[ERRO\]/i.test(r.result || "");
                  return `[${isError ? "ERRO" : "OK"}] ${r.tool_name}: ${r.result}`;
                }
                return `[ERRO] ${r.tool_name}: ${r.error || "Falha na execução"}`;
              });
              clearBatch(batchId);
            } catch {
              heavyResults = heavyTools.map((tc: any) => `[ERRO] ${tc.name}: Timeout na execução`);
            }

            // Remove progress message
            setMessages(prev => prev.filter(m => !m.content.includes("⏳ Executando")));
          }

          const toolResults = [...lightResults, ...heavyResults].filter(r => r.trim() !== "");

          // Recursive follow-up: keep requesting until we get text (max 3 rounds)
          let accumulatedResults = toolResults.filter(r => r.trim() !== "");
          let followUpMessages: AIMessage[] = [
            ...allMessages,
            { role: "assistant", content: `[Resultados das ações executadas]\n${accumulatedResults.join("\n")}` },
            { role: "user", content: "Analise os resultados acima. Se algum resultado contiver [ERRO], informe o usuário sobre o PROBLEMA e sugira como resolver. Nunca diga que uma ação foi realizada se o resultado indicar erro. Resuma apenas as ações que tiveram SUCESSO de forma natural e concisa." },
          ];

          for (let depth = 0; depth < 3; depth++) {
            const followUpContext = await buildContext();
            const followUpResp = await fetch(CHAT_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getAccessToken()}` },
              body: JSON.stringify({
                messages: followUpMessages, context: followUpContext,
                agent_id: agent?.id || null, model: agent?.model || undefined,
                temperature: agent?.temperature ?? undefined, system_prompt: agent?.system_prompt || undefined,
              }),
              signal,
            });

            if (!followUpResp.ok) break;

            const fData = await followUpResp.json();
            if (fData.type === "tool_calls") {
              // Same heavy/light split for follow-up tool calls
              const fHeavy = fData.tool_calls.filter((tc: any) => isHeavyTool(tc.name));
              const fLight = fData.tool_calls.filter((tc: any) => !isHeavyTool(tc.name));

              const FOLLOW_UP_TIMEOUT = 30_000;
              for (const tc of fLight) {
                try {
                  const resultPromise = executeToolCall({ id: tc.id, name: tc.name, arguments: tc.arguments });
                  const timeoutPromise = new Promise<string>((_, reject) => setTimeout(() => reject(new Error("timeout")), FOLLOW_UP_TIMEOUT));
                  const result = await Promise.race([resultPromise, timeoutPromise]);
                  const isError = /erro|falha|não encontrad|expirad|❌|invalid|failed|error/i.test(result);
                  accumulatedResults.push(`[${isError ? "ERRO" : "OK"}] ${tc.name}: ${result}`);
                } catch (e: any) {
                  accumulatedResults.push(`[ERRO] ${tc.name}: ${e.message === "timeout" ? "Tempo limite excedido" : e.message || "Falha"}`);
                }
              }

              if (fHeavy.length > 0) {
                const fBatchId = crypto.randomUUID();
                await enqueueTools(fBatchId, fHeavy.map((tc: any) => ({ id: tc.id, name: tc.name, arguments: tc.arguments })), conversation?.id);
                try {
                  const batchResult = await waitForBatch(fBatchId, 120_000);
                  for (const r of batchResult.results) {
                    if (r.status === "done") {
                      const isError = /\[ERRO\]/i.test(r.result || "");
                      accumulatedResults.push(`[${isError ? "ERRO" : "OK"}] ${r.tool_name}: ${r.result}`);
                    } else {
                      accumulatedResults.push(`[ERRO] ${r.tool_name}: ${r.error || "Falha"}`);
                    }
                  }
                  clearBatch(fBatchId);
                } catch {
                  for (const tc of fHeavy) {
                    accumulatedResults.push(`[ERRO] ${tc.name}: Timeout`);
                  }
                }
              }
              if (fData.content) {
                return await simulateTyping(allMessages, fData.content);
              }
              followUpMessages = [
                ...allMessages,
                { role: "assistant", content: `[Resultados das ações executadas]\n${accumulatedResults.join("\n")}` },
                { role: "user", content: "Analise os resultados acima. Se algum resultado contiver [ERRO], informe o usuário sobre o PROBLEMA e sugira como resolver. Nunca diga que uma ação foi realizada se o resultado indicar erro. Resuma apenas as ações que tiveram SUCESSO de forma natural e concisa." },
              ];
              continue;
            }
            const content = fData.content || data.content || accumulatedResults.join("\n");
            return await simulateTyping(allMessages, content);
          }

          const content = data.content || accumulatedResults.join("\n");
          return await simulateTyping(allMessages, content);
        }
        if (data.type === "text") {
          return await simulateTyping(allMessages, data.content || "");
        }
      }

      // Fallback: SSE streaming (backward compat) — use functional setState to avoid allocating new base arrays
      if (!resp.body) throw new Error("No body");
      let assistantSoFar = "";
      const streamTs = new Date().toISOString();
      return await new Promise<AIMessage[]>((resolve) => {
        parseSSEStream(resp.body!,
          (chunk) => {
            assistantSoFar += chunk;
            const partial = assistantSoFar;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant" && last.timestamp === streamTs) {
                // Update in-place reference for performance
                const updated = [...prev];
                updated[updated.length - 1] = { ...last, content: partial };
                return updated;
              }
              return [...prev, { role: "assistant" as const, content: partial, timestamp: streamTs }];
            });
          },
          () => resolve([...allMessages, { role: "assistant" as const, content: assistantSoFar || "...", timestamp: streamTs }])
        );
      });
      } catch (e: any) {
        if (e.name === "AbortError") return null;
        // Retry on network errors
        if (attempt < MAX_RETRIES && (e.message?.includes("fetch") || e.message?.includes("network"))) {
          console.debug(`[Pandora] Network error, retry ${attempt + 1}/${MAX_RETRIES}`);
          await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
          continue;
        }
        console.error("[Pandora requestAI]", e);
        toast.error(e.message?.includes("fetch") ? "Falha na conexão. Verifique sua internet." : "Erro ao processar. Tente novamente.");
        return null;
      }
    } // end retry loop
    return null;
  }, [agent, buildContext, executeToolCall, simulateTyping, enqueueTools, waitForBatch, clearBatch, conversation?.id]);

  // Client-side rate limiter: max 1 send per 2s
  const lastSendRef = useRef(0);

  const sendMessage = useCallback(async (text: string) => {
    if ((!text.trim() && pendingImagesRef.current.length === 0) || isLoadingRef.current) return;
    const now = Date.now();
    if (now - lastSendRef.current < 2000) { toast.info("Aguarde um momento antes de enviar outra mensagem."); return; }
    lastSendRef.current = now;
    setDynamicReplies([]);
    setLastError(false);

    let msgContent: any = text.trim();
    const images = [...pendingImagesRef.current];
    if (images.length > 0) {
      const parts: any[] = [];
      if (text.trim()) parts.push({ type: "text", text: text.trim() });
      images.forEach(img => parts.push({ type: "image_url", image_url: { url: img } }));
      msgContent = parts;
    }

    const userMsg: AIMessage = { role: "user", content: msgContent, timestamp: new Date().toISOString() };
    const displayMsg: AIMessage & { images?: string[] } = { ...userMsg, images: images.length > 0 ? images : undefined };
    const newMessages = [...messagesRef.current, displayMsg];
    setMessages(newMessages);
    setInput("");
    setPendingImages([]);
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    // Capture voice state BEFORE the async call to avoid stale ref
    const wasVoiceInput = sentViaVoiceRef.current;
    sentViaVoiceRef.current = false;

    try {
      if (mcpMode) {
        // MCP mode: use Claude + Composio MCP
        const mcpResponse = await mcp.sendMessage(text.trim());
        if (mcpResponse) {
          const assistantMsg: AIMessage = { role: "assistant", content: mcpResponse, timestamp: new Date().toISOString() };
          const result = [...newMessages, assistantMsg];
          setMessages(result);
          saveMessages(result);
          const shouldSpeak = (wasVoiceInput && tts.autoReplyVoice) || tts.autoSpeak;
          if (shouldSpeak) setTimeout(() => tts.speak(mcpResponse, result.length - 1), 200);
        }
      } else {
        // Classic mode: Lovable AI Gateway + custom tools
        const result = await requestAI(newMessages, controller.signal);
        if (result) {
          setMessages(result);
          saveMessages(result);
          const shouldSpeak = (wasVoiceInput && tts.autoReplyVoice) || tts.autoSpeak;
          if (shouldSpeak) {
            const lastMsg = result[result.length - 1];
            if (lastMsg?.role === "assistant") {
              const spkText = getTextContent(lastMsg.content);
              if (spkText) setTimeout(() => tts.speak(spkText, result.length - 1), 200);
            }
          }
        }
      }
    } catch (err) {
      console.error("[Pandora send]", err);
      setLastError(true);
    } finally {
      setIsLoading(false);
    }
  }, [saveMessages, requestAI, tts, mcpMode, mcp]);

  /** Regenerate the last AI response */
  const handleRegenerate = useCallback(async () => {
    if (isLoadingRef.current || messagesRef.current.length < 2) return;
    setDynamicReplies([]);
    setLastError(false);

    const currentMsgs = messagesRef.current;
    let lastUserIdx = -1;
    for (let i = currentMsgs.length - 1; i >= 0; i--) {
      if (currentMsgs[i].role === "user") { lastUserIdx = i; break; }
    }
    if (lastUserIdx === -1) return;

    const msgsUpToUser = currentMsgs.slice(0, lastUserIdx + 1);
    setMessages(msgsUpToUser);
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await requestAI(msgsUpToUser, controller.signal);
      if (result) {
        setMessages(result);
        saveMessages(result);
      }
    } catch {
      setMessages([...msgsUpToUser, { role: "assistant" as const, content: "Erro ao regenerar. Tente novamente." }]);
      setLastError(true);
    } finally {
      setIsLoading(false);
    }
  }, [saveMessages, requestAI]);

  /** Edit a previous user message and resend from that point */
  const handleEditSubmit = useCallback(async () => {
    if (editingMsgIdx === null || !editingText.trim() || isLoadingRef.current) return;
    setDynamicReplies([]);
    setLastError(false);

    const edited: AIMessage = { role: "user", content: editingText.trim() };
    const msgsUpToEdit = [...messagesRef.current.slice(0, editingMsgIdx), edited];
    setEditingMsgIdx(null);
    setEditingText("");
    setMessages(msgsUpToEdit);
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await requestAI(msgsUpToEdit, controller.signal);
      if (result) {
        setMessages(result);
        saveMessages(result);
      }
    } catch {
      setMessages([...msgsUpToEdit, { role: "assistant" as const, content: "Erro ao reenviar. Tente novamente." }]);
      setLastError(true);
    } finally {
      setIsLoading(false);
    }
  }, [editingMsgIdx, editingText, saveMessages, requestAI]);

  /** Retry last failed message */
  const handleRetry = useCallback(() => {
    const currentMsgs = messagesRef.current;
    if (currentMsgs.length < 2) return;
    // Remove last assistant error message and resend
    const withoutError = currentMsgs.slice(0, -1);
    const lastUserMsg = withoutError[withoutError.length - 1];
    if (lastUserMsg?.role === "user") {
      setMessages(withoutError.slice(0, -1));
      setLastError(false);
      setTimeout(() => sendMessage(getTextContent(lastUserMsg.content)), 100);
    }
  }, [sendMessage]);

  const onVoiceResult = useCallback((t: string) => { setInput(t); pendingVoiceSendRef.current = true; sentViaVoiceRef.current = true; }, []);
  const stt = useSpeechRecognition(onVoiceResult);

  useEffect(() => {
    if (pendingVoiceSendRef.current && input.trim()) {
      pendingVoiceSendRef.current = false;
      sendMessage(input);
    }
  }, [input, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isMod = e.ctrlKey || e.metaKey;
    // Ctrl+Enter or Enter → Send
    if (e.key === "Enter" && (!e.shiftKey || isMod)) {
      e.preventDefault();
      sendMessage(input);
      return;
    }
    // Escape → abort generation or close search
    if (e.key === "Escape") {
      e.preventDefault();
      if (isLoading) { handleAbort(); return; }
      if (searchOpen) { setSearchOpen(false); setSearchQuery(""); return; }
      return;
    }
    // Ctrl+L → clear/new chat
    if (isMod && e.key === "l") {
      e.preventDefault();
      if (messages.length > 1) {
        setMessages([messages[0]]);
        onUpdateMessages([messages[0]]);
        toast.success("Conversa limpa!");
      }
      return;
    }
  };

  const handleExportChat = useCallback(() => {
    if (!conversation || messages.length === 0) return;
    const lines = messages.map(m => `[${m.role === "user" ? "Você" : "IA"}] ${getTextContent(m.content)}`);
    const text = `# ${conversation.title}\n# Exportado em ${new Date().toLocaleString("pt-BR")}\n\n${lines.join("\n\n")}`;
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${conversation.title.replace(/[^a-zA-Z0-9]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Chat exportado!");
  }, [conversation, messages]);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < Math.min(files.length, 4 - pendingImages.length); i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) { toast.error("Apenas imagens são suportadas."); continue; }
      if (file.size > 5 * 1024 * 1024) { toast.error("Imagem muito grande (máx 5MB)."); continue; }
      const reader = new FileReader();
      reader.onload = () => setPendingImages(prev => [...prev, reader.result as string].slice(0, 4));
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [pendingImages]);

  // Word count
  const wordCount = useMemo(() => {
    return messages.reduce((total, m) => total + getTextContent(m.content).split(/\s+/).filter(Boolean).length, 0);
  }, [messages]);

  const isEmptyConversation = conversation && messages.length <= 1;
  const canRegenerate = !isLoading && messages.length >= 2 && messages[messages.length - 1]?.role === "assistant";

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="border-b border-border/20 px-3 py-2 flex items-center gap-2 shrink-0">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input ref={searchInputRef} value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setSearchMatchIdx(0); }}
              placeholder="Buscar nas mensagens..." className="flex-1 text-xs bg-transparent text-foreground outline-none placeholder:text-muted-foreground" />
            {searchMatches.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>{searchMatchIdx + 1}/{searchMatches.length}</span>
                <button onClick={() => setSearchMatchIdx(Math.max(0, searchMatchIdx - 1))} className="p-0.5 hover:text-foreground"><ChevronUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => setSearchMatchIdx(Math.min(searchMatches.length - 1, searchMatchIdx + 1))} className="p-0.5 hover:text-foreground"><ChevronDown className="w-3.5 h-3.5" /></button>
              </div>
            )}
            <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat header bar with actions */}
      {conversation && (
        <div className="px-3 sm:px-6 py-1.5 border-b border-border/10 flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground flex-1">{messages.length} msgs • {wordCount} palavras{mcpMode ? " • MCP" : ""}</span>
          {/* MCP toggle */}
          <button
            onClick={() => { setMcpMode(!mcpMode); if (!mcpMode) mcp.clearHistory(); }}
            className={`px-1.5 py-0.5 rounded-lg text-[10px] font-semibold transition-colors ${mcpMode ? "bg-primary/20 text-primary ring-1 ring-primary/30" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
            title={mcpMode ? "Modo MCP ativo (Claude + Composio)" : "Ativar modo MCP (Claude + Composio)"}
          >
            MCP
          </button>
          {/* Auto-speak toggle */}
          <button
            onClick={() => tts.setAutoSpeak(!tts.autoSpeak)}
            className={`p-1 rounded-xl transition-colors ${tts.autoSpeak ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
            title={tts.autoSpeak ? "Auto-leitura ativada" : "Auto-leitura desativada"}
          >
            {tts.autoSpeak ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
          {/* Voice settings */}
          <div className="relative" ref={voiceSettingsRef}>
            <button
              onClick={() => setShowVoiceSettings(!showVoiceSettings)}
              className={`p-1 rounded-xl transition-colors ${showVoiceSettings ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
              title="Configurações de voz"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
            {showVoiceSettings && (
              <div
                className="absolute top-full right-0 mt-2 w-64 rounded-xl p-3 z-[60] space-y-2"
                style={{
                  background: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
                }}
              >
                <p className="text-xs font-semibold text-foreground mb-2">Voz da Pandora</p>
                <div className="space-y-1">
                  {ELEVENLABS_VOICES.map((voice) => (
                    <div key={voice.id} className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                      tts.selectedVoiceId === voice.id ? "bg-primary/20 text-primary font-medium" : "text-foreground/70 hover:bg-accent"
                    }`}>
                      <button onClick={() => tts.setSelectedVoiceId(voice.id)} className="flex-1 text-left min-w-0">
                        <span className="block truncate">{voice.label}</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); tts.preview(voice.id); }}
                        className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
                        title="Ouvir amostra"
                        disabled={tts.isLoading}
                      >
                        {tts.isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Volume2 className="w-3 h-3" />}
                      </button>
                    </div>
                  ))}
                </div>
                {/* Speed control */}
                <div className="pt-2 border-t border-border/30">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground">Velocidade</span>
                    <span className="text-[10px] font-mono text-foreground">{tts.speed.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.7"
                    max="1.2"
                    step="0.1"
                    value={tts.speed}
                    onChange={(e) => tts.setSpeed(parseFloat(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none bg-muted accent-primary cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                    <span>Lento</span>
                    <span>Rápido</span>
                  </div>
                </div>
                {/* Auto reply voice toggle */}
                <div className="pt-2 border-t border-border/30">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="auto-reply-voice" className="text-[10px] text-muted-foreground leading-tight cursor-pointer">
                      Responder por voz ao comando de voz
                    </label>
                    <Switch
                      id="auto-reply-voice"
                      checked={tts.autoReplyVoice}
                      onCheckedChange={tts.setAutoReplyVoice}
                      className="scale-75"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          {canRegenerate && (
            <button onClick={handleRegenerate}
              className="p-1 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Regenerar última resposta">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
            className="p-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" title="Buscar (Ctrl+F)">
            <Search className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleExportChat} className="p-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" title="Exportar chat">
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-6">
        {/* Suggested prompts for empty conversation */}
        {isEmptyConversation && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="py-4 sm:py-8 max-w-lg mx-auto"
          >
            {/* Avatar + Greeting */}
            <div className="text-center mb-6">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.4, type: "spring", stiffness: 200 }}
                className="relative inline-block pandora-glow mb-3"
              >
                <img src={pandoraAvatar} alt="Pandora" className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-4 ring-primary/20 shadow-xl relative z-10" />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-400 border-2 border-background z-20" />
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.3 }}
                className="text-lg sm:text-xl font-bold text-foreground mb-1"
              >
                {(() => {
                  const h = new Date().getHours();
                  const greeting = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
                  return <>{greeting}! Eu sou a <span className="text-primary">Pandora</span> ✨</>;
                })()}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45, duration: 0.3 }}
                className="text-xs sm:text-sm text-muted-foreground max-w-xs mx-auto"
              >
                Sua assistente pessoal do DESH. Posso ajudar com tudo isso:
              </motion.p>
            </div>

            {/* Capabilities grid */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.4 }}
              className="grid grid-cols-4 gap-2 mb-6"
            >
              {PANDORA_CAPABILITIES.map((cap, i) => (
                <motion.div
                  key={cap.title}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + i * 0.05, duration: 0.25 }}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl bg-muted/30 border border-border/20 hover:bg-muted/50 transition-colors"
                >
                  <span className="text-lg">{cap.icon}</span>
                  <span className="text-[10px] font-medium text-foreground/80 leading-tight text-center">{cap.title}</span>
                </motion.div>
              ))}
            </motion.div>

            {/* Suggested prompts */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.3 }}
            >
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Experimente perguntar</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTED_PROMPTS.map((prompt, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.85 + i * 0.06, duration: 0.25 }}
                    onClick={() => sendMessage(prompt.message)}
                    className="text-left p-3 rounded-xl border border-border/30 bg-muted/30 hover:bg-primary/10 hover:border-primary/30 transition-all text-xs group/prompt"
                  >
                    <span className="font-medium text-foreground/90 group-hover/prompt:text-foreground">{prompt.label}</span>
                    <span className="block text-[10px] text-muted-foreground mt-0.5">{prompt.desc}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => {
            const text = getTextContent(msg.content);
            const isSearchMatch = searchQuery && searchMatches.some(m => m.idx === i);
            const isActiveMatch = searchMatches[searchMatchIdx]?.idx === i;
            const isEditing = editingMsgIdx === i;
            // Stable key: use timestamp if available, fallback to role+index
            const msgKey = msg.timestamp ? `${msg.role}-${msg.timestamp}-${i}` : `${msg.role}-${i}`;

            return (
              <motion.div
                key={msgKey}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} group/msg`}
              >
                <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm relative ${
                  msg.role === "user"
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md bg-muted"
                } ${isActiveMatch ? "ring-2 ring-amber-400" : isSearchMatch ? "ring-1 ring-amber-400/40" : ""}`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none [&_p]:m-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_strong]:text-foreground [&_a]:text-primary [&_pre]:my-2 [&_code]:text-xs">
                      <ReactMarkdown
                        components={{
                          code({ node, className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || "");
                            const codeStr = String(children).replace(/\n$/, "");
                            if (match) {
                              return (
                                <div className="relative group/code my-2">
                                  <div className="flex items-center justify-between px-3 py-1 bg-background/80 rounded-t-xl border border-border/20 border-b-0">
                                    <span className="text-[10px] text-muted-foreground font-mono uppercase">{match[1]}</span>
                                    <button
                                      onClick={() => { navigator.clipboard.writeText(codeStr); toast.success("Código copiado!"); }}
                                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                                    >
                                      <Copy className="w-3 h-3" /> Copiar
                                    </button>
                                  </div>
                                  <SyntaxHighlighter
                                    style={oneDark}
                                    language={match[1]}
                                    PreTag="div"
                                    customStyle={{ margin: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderRadius: "0 0 0.75rem 0.75rem", fontSize: "0.75rem" }}
                                    {...(props as any)}
                                  >
                                    {codeStr}
                                  </SyntaxHighlighter>
                                </div>
                              );
                            }
                            return <code className={`${className || ""} bg-background/50 px-1.5 py-0.5 rounded-md text-xs font-mono`} {...props}>{children}</code>;
                          },
                        }}
                      >{text}</ReactMarkdown>
                    </div>
                  ) : isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingText}
                        onChange={e => setEditingText(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSubmit(); } if (e.key === "Escape") setEditingMsgIdx(null); }}
                        className="w-full bg-primary-foreground/20 text-primary-foreground rounded-xl px-2 py-1.5 text-sm outline-none resize-none min-h-[40px]"
                        autoFocus
                        rows={2}
                      />
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={() => setEditingMsgIdx(null)} className="text-xs px-2 py-1 rounded-lg bg-primary-foreground/20 text-primary-foreground/70 hover:bg-primary-foreground/30">Cancelar</button>
                        <button onClick={handleEditSubmit} className="text-xs px-2 py-1 rounded-lg bg-primary-foreground/30 text-primary-foreground font-medium hover:bg-primary-foreground/40">Enviar</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {(msg as any).images && (msg as any).images.length > 0 && (
                        <div className="flex gap-1.5 mb-2 flex-wrap">
                          {(msg as any).images.map((img: string, idx: number) => (
                            <img key={idx} src={img} alt="Upload" className="w-20 h-20 object-cover rounded-xl" />
                          ))}
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{text}</p>
                    </div>
                  )}
                  {/* Timestamp */}
                  {msg.timestamp && (
                    <p className={`text-[10px] mt-1 ${msg.role === "user" ? "text-primary-foreground/40 text-right" : "text-muted-foreground/50"}`}>
                      {new Date(msg.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                  {/* Action buttons */}
                  {msg.role === "assistant" && i > 0 && !isLoading && (
                    <div className="flex gap-0.5 mt-1.5 justify-end">
                      <CopyButton text={text} />
                      <button
                        onClick={() => tts.speak(text, i)}
                        disabled={tts.isLoading}
                        className="opacity-0 group-hover/msg:opacity-100 p-1 rounded-xl hover:bg-muted/70 transition-all disabled:opacity-50"
                        title={tts.speakingId === i ? "Parar áudio" : "Ouvir resposta"}
                      >
                        {tts.isLoading && tts.speakingId === null ? (
                          <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" />
                        ) : tts.speakingId === i ? (
                          <VolumeX className="w-3 h-3 text-primary" />
                        ) : (
                          <Volume2 className="w-3 h-3 text-muted-foreground" />
                        )}
                      </button>
                      {i === messages.length - 1 && canRegenerate && (
                        <button onClick={handleRegenerate}
                          className="opacity-0 group-hover/msg:opacity-100 p-1 rounded-xl hover:bg-muted/70 transition-all"
                          title="Regenerar">
                          <RefreshCw className="w-3 h-3 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  )}
                  {msg.role === "user" && !isLoading && !isEditing && i > 0 && (
                    <div className="flex justify-start mt-1.5">
                      <button onClick={() => { setEditingMsgIdx(i); setEditingText(text); }}
                        className="opacity-0 group-hover/msg:opacity-100 p-1 rounded-xl hover:bg-primary/20 transition-all"
                        title="Editar e reenviar">
                        <Pencil className="w-3 h-3 text-primary-foreground/60" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {isLoading && messages[messages.length - 1]?.role === "user" && <TypingIndicator />}

        {/* Retry on error */}
        {lastError && !isLoading && (
          <div className="flex justify-center">
            <button onClick={handleRetry}
              className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 px-3 py-1.5 rounded-xl bg-destructive/10 hover:bg-destructive/15 transition-colors">
              <RotateCcw className="w-3 h-3" /> Tentar novamente
            </button>
          </div>
        )}
      </div>

      {/* Pending Images Preview */}
      {pendingImages.length > 0 && (
        <div className="px-3 sm:px-6 pb-1 flex gap-2 flex-wrap">
          {pendingImages.map((img, idx) => (
            <div key={idx} className="relative group">
              <img src={img} alt="Preview" className="w-14 h-14 object-cover rounded-xl border border-border/30" />
              <button onClick={() => setPendingImages(prev => prev.filter((_, i) => i !== idx))}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Dynamic Replies */}
      {dynamicReplies.length > 0 && !isLoading && (
        <div className="px-3 sm:px-6 pb-1 flex gap-1.5 flex-wrap">
          {dynamicReplies.map((reply, idx) => (
            <button key={idx} onClick={() => { setDynamicReplies([]); sendMessage(reply.message); }}
              className="text-xs px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors">
              {reply.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-3 sm:px-6 pb-3 sm:pb-4 pt-2">
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
        <div className="flex items-end gap-2 rounded-xl border border-border/30 bg-foreground/5 px-3 py-2 focus-within:ring-1 focus-within:ring-primary/30 transition-shadow">
          <button onClick={() => fileInputRef.current?.click()} disabled={isLoading || pendingImages.length >= 4 || !conversation}
            className="p-1.5 rounded-xl transition-all disabled:opacity-30 hover:bg-muted/70 text-muted-foreground shrink-0 mb-0.5" aria-label="Enviar imagem para análise">
            <ImagePlus className="w-4 h-4" />
          </button>
          {stt.supported && (
            <button onClick={stt.isListening ? stt.stopListening : stt.startListening} disabled={isLoading}
              className={`p-1.5 rounded-xl transition-all disabled:opacity-30 shrink-0 mb-0.5 ${stt.isListening ? "bg-destructive/20 text-destructive animate-pulse" : "hover:bg-muted/70 text-muted-foreground"}`}>
              {stt.isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
          <textarea ref={inputRef} value={input} onChange={e => { chatSmartCommands.handleChange(e.target.value, e.target.selectionStart); }} onKeyDown={(e) => { chatSmartCommands.handleKeyDown(e); if (!chatSmartCommands.popup.open) handleKeyDown(e); }}
            placeholder={pendingImages.length > 0 ? "Descreva ou pergunte sobre a imagem..." : stt.isListening ? "Ouvindo..." : conversation ? "Digite sua mensagem... (@ menções, / comandos)" : "Crie uma conversa para começar"}
            disabled={isLoading || !conversation} rows={1}
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50 resize-none min-h-[20px] max-h-[120px]" />
          <SmartCommandPopup
            open={chatSmartCommands.popup.open}
            items={chatSmartCommands.popup.items}
            selectedIndex={chatSmartCommands.popup.selectedIndex}
            trigger={chatSmartCommands.popup.trigger}
            position={chatSmartCommands.popup.position}
            onSelect={chatSmartCommands.selectItem}
            onClose={chatSmartCommands.closePopup}
          />
          {isLoading ? (
            <button onClick={handleAbort} className="p-1.5 rounded-xl hover:bg-destructive/10 text-destructive shrink-0 mb-0.5" aria-label="Parar geração">
              <StopCircle className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={() => sendMessage(input)} disabled={(!input.trim() && pendingImages.length === 0) || !conversation}
              className="p-1.5 rounded-xl transition-colors disabled:opacity-30 hover:bg-primary/10 hover:text-primary shrink-0 mb-0.5">
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1">
          <p className="text-[10px] text-muted-foreground/60">
            <kbd className="font-mono text-muted-foreground/80">Shift+Enter</kbd> nova linha • <kbd className="font-mono text-muted-foreground/80">{/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl"}+Enter</kbd> enviar • <kbd className="font-mono text-muted-foreground/80">{/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl"}+L</kbd> limpar • <kbd className="font-mono text-muted-foreground/80">{/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl"}+F</kbd> buscar • <kbd className="font-mono text-muted-foreground/80">Esc</kbd> parar
          </p>
          {input.length > 0 && (
            <span className={`text-[10px] font-mono ${input.length > 4000 ? "text-destructive" : "text-muted-foreground/50"}`}>
              {input.length.toLocaleString()}/4000
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
