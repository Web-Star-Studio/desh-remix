import React, { useState, useRef, useEffect, useCallback } from "react";
import pandoraAvatar from "@/assets/pandora-avatar.png";
import DeshTooltip from "@/components/ui/DeshTooltip";
import { X, Send, Sparkles, Loader2, Mic, MicOff, Volume2, VolumeX, Settings2, ListTodo, Brain, Plus, BarChart3, Calendar, Sun, Maximize2, ImagePlus, X as XIcon, MessageSquarePlus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSpeechRecognition } from "@/hooks/audio/useSpeechRecognition";
import { useElevenLabsTTS } from "@/hooks/audio/useElevenLabsTTS";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useAIToolExecution, type ToolCall } from "@/hooks/ai/useAIToolExecution";
import { useToolJobQueue, isHeavyTool } from "@/hooks/ai/useToolJobQueue";
import { useAIConversations, type AIMessage } from "@/hooks/ai/useAIConversations";
import { useSmartCommands } from "@/hooks/ui/useSmartCommands";
import SmartCommandPopup from "@/components/ui/SmartCommandPopup";
import { useAIAgents } from "@/hooks/ai/useAIAgents";
import { useWorkspaceSafe } from "@/contexts/WorkspaceContext";

type MsgContent = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
type Msg = { role: "user" | "assistant"; content: MsgContent; images?: string[]; timestamp?: string };
type QuickReply = { label: string; message: string };

const WELCOME_MSG: Msg = { role: "assistant", content: "Olá! 👋 Sou a **Pandora**, sua assistente pessoal do DESH. Posso criar tarefas, notas, eventos, mudar o tema e muito mais. Como posso ajudar?" };
const WIDGET_CONV_KEY = "desh-widget-conv-id";

function getTextContent(content: MsgContent): string {
  if (typeof content === "string") return content;
  return content.filter(p => p.type === "text").map(p => (p as any).text).join("");
}

function generateTitle(text: string): string {
  const words = text.split(/\s+/).slice(0, 6).join(" ");
  return words.length > 40 ? words.slice(0, 40) + "..." : words;
}

function msgToAIMessage(msg: Msg): AIMessage {
  return { role: msg.role, content: getTextContent(msg.content), timestamp: msg.timestamp };
}

function aiMessageToMsg(m: AIMessage): Msg {
  return { role: m.role, content: m.content, timestamp: m.timestamp };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
}

async function callChat({
  messages,
  context,
  signal,
  agentConfig,
  workspaceId,
  isAllMode,
}: {
  messages: Msg[];
  context: Record<string, any>;
  signal?: AbortSignal;
  agentConfig?: { agent_id?: string; model?: string; temperature?: number; system_prompt?: string | null };
  workspaceId?: string | null;
  isAllMode?: boolean;
}): Promise<{ type: "tool_calls"; tool_calls: ToolCall[]; content: string | null } | { type: "text"; content: string } | { type: "stream"; body: ReadableStream }> {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await getAccessToken()}`,
    },
    body: JSON.stringify({ messages, context, ...agentConfig, workspace_id: workspaceId || null, is_all_mode: isAllMode ?? false }),
    signal,
  });

  if (resp.status === 429) {
    toast.error("Muitas requisições. Aguarde um momento.");
    throw new Error("Rate limited");
  }
  if (resp.status === 402) {
    toast.error("Créditos de IA insuficientes.");
    throw new Error("Payment required");
  }
  if (!resp.ok) throw new Error("Failed to call chat");

  const contentType = resp.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await resp.json();
    if (data.type === "tool_calls") {
      return { type: "tool_calls", tool_calls: data.tool_calls, content: data.content };
    }
    if (data.type === "text") {
      return { type: "text", content: data.content || "" };
    }
    throw new Error(data.error || "Unknown error");
  }

  if (!resp.body) throw new Error("No response body");
  return { type: "stream", body: resp.body };
}

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
      // Flush remaining
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

interface AIChatWidgetProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const DEFAULT_POS_DESKTOP = { right: 24, bottom: 24 };
const DEFAULT_POS_MOBILE = { right: 16, bottom: 88 };

function getDefaultPos() {
  return window.innerWidth < 768 ? DEFAULT_POS_MOBILE : DEFAULT_POS_DESKTOP;
}

const AIChatWidget = ({ isOpen: externalOpen, onClose: externalClose }: AIChatWidgetProps) => {
  const tts = useElevenLabsTTS();
  const { user } = useAuth();
  const navigate = useNavigate();
  const wsCtx = useWorkspaceSafe();
  const wsId = wsCtx?.activeWorkspaceId || null;
  const isAllMode = wsId === null;
  const { conversations, create: createConv, update: updateConv } = useAIConversations();
  const { agents, defaultAgent } = useAIAgents();

  // Resolve selected agent from localStorage
  const selectedAgent = (() => {
    const storedId = localStorage.getItem("desh-selected-agent-id");
    if (storedId) {
      const found = agents.find(a => a.id === storedId);
      if (found) return found;
    }
    return defaultAgent;
  })();

  const agentConfig = selectedAgent ? {
    agent_id: selectedAgent.id,
    model: selectedAgent.model,
    temperature: selectedAgent.temperature,
    system_prompt: selectedAgent.system_prompt,
  } : undefined;

  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const toggleOpen = () => {
    if (externalOpen !== undefined) { externalClose?.(); } else { setInternalOpen(prev => !prev); }
  };

  // Draggable position — session-only, resets on refresh
  const [pos, setPos] = useState(getDefaultPos);
  const dragState = useRef<{ startX: number; startY: number; startRight: number; startBottom: number; moved: boolean } | null>(null);
  const lastTapRef = useRef(0);

  const resetPos = useCallback(() => setPos(getDefaultPos()), []);

  const handleDragStart = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      startRight: pos.right,
      startBottom: pos.bottom,
      moved: false,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.current.moved = true;
    if (!dragState.current.moved) return;
    const newRight = Math.max(4, Math.min(window.innerWidth - 60, dragState.current.startRight - dx));
    const newBottom = Math.max(4, Math.min(window.innerHeight - 60, dragState.current.startBottom + dy));
    setPos({ right: newRight, bottom: newBottom });
  }, []);

  const handleDragEnd = useCallback((e: React.PointerEvent) => {
    const wasDrag = dragState.current?.moved;
    dragState.current = null;
    if (wasDrag) return; // was a drag, don't toggle
    // Double-tap to reset position
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      resetPos();
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
    toggleOpen();
  }, [toggleOpen, resetPos]);

  const [activeConvId, setActiveConvId] = useState<string | null>(() => {
    return localStorage.getItem(WIDGET_CONV_KEY) || null;
  });

  const [messages, setMessages] = useState<Msg[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(() => tts.autoSpeak);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [dynamicReplies, setDynamicReplies] = useState<QuickReply[]>([]);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const widgetSmartCommands = useSmartCommands({
    inputRef,
    value: input,
    onChange: setInput,
    enabledTriggers: ["@", "/"],
    context: "chat",
    placement: "above-left",
  });
  
  const pendingVoiceSendRef = useRef(false);
  const sentViaVoiceRef = useRef(false);
  const convIdRef = useRef(activeConvId);

  // Keep ref in sync
  useEffect(() => { convIdRef.current = activeConvId; }, [activeConvId]);

  // Persist activeConvId to localStorage
  useEffect(() => {
    if (activeConvId) {
      localStorage.setItem(WIDGET_CONV_KEY, activeConvId);
    }
  }, [activeConvId]);

  // Load existing conversation from DB when conversations are available
  useEffect(() => {
    if (!conversations.length || !activeConvId) return;
    const conv = conversations.find(c => c.id === activeConvId);
    if (conv && conv.messages.length > 0) {
      // If conversation has too many messages, start a new one
      if (conv.messages.length > 30) {
        handleNewConversation();
        return;
      }
      setMessages(conv.messages.map(aiMessageToMsg));
    } else if (!conv) {
      // Conversation not found, reset
      setActiveConvId(null);
      localStorage.removeItem(WIDGET_CONV_KEY);
      setMessages([WELCOME_MSG]);
    }
  // Only run when conversations first load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations.length > 0 && activeConvId]);

  const handleNewConversation = useCallback(() => {
    setActiveConvId(null);
    localStorage.removeItem(WIDGET_CONV_KEY);
    setMessages([WELCOME_MSG]);
    setDynamicReplies([]);
    setInput("");
    setPendingImages([]);
  }, []);

  // Persist messages to DB
  const persistMessages = useCallback(async (msgs: Msg[], userText?: string) => {
    if (!user) return;
    const aiMessages = msgs.map(msgToAIMessage);
    
    if (convIdRef.current) {
      // Update existing conversation
      updateConv.mutate({ id: convIdRef.current, messages: aiMessages });
    } else {
      // Create new conversation
      try {
        const title = userText ? generateTitle(userText) : "Nova Conversa";
        const result = await createConv.mutateAsync({
          title,
          messages: aiMessages,
        });
        setActiveConvId(result.id);
      } catch (e) {
        console.error("Failed to create conversation:", e);
      }
    }
  }, [user, createConv, updateConv]);

  const { executeToolCall, buildContext } = useAIToolExecution({
    setDynamicReplies,
  });

  const { enqueueTools, waitForBatch, clearBatch } = useToolJobQueue();

  // Send a follow-up message after tool execution to get the AI's natural response
  const sendFollowUp = useCallback(async (allMessages: Msg[], toolResults: string[]) => {
    // Rebuild context with updated data post-tool-execution
    const updatedContext = await buildContext();
    
    const followUpMessages: Msg[] = [
      ...allMessages,
      { role: "assistant", content: `[Resultados das ações executadas]\n${toolResults.join("\n")}` },
      { role: "user", content: "Analise os resultados acima. Se algum resultado contiver [ERRO], informe o usuário sobre o PROBLEMA e sugira como resolver. Nunca diga que uma ação foi realizada se o resultado indicar erro. Resuma apenas as ações que tiveram SUCESSO de forma natural e concisa." },
    ];

    try {
      const result = await callChat({
        messages: followUpMessages,
        context: updatedContext,
        signal: abortRef.current?.signal,
        agentConfig,
        workspaceId: wsId,
        isAllMode,
      });

      if (result.type === "stream") {
        let assistantSoFar = "";
        parseSSEStream(
          result.body,
          (chunk) => {
            assistantSoFar += chunk;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
              }
              return [...prev, { role: "assistant", content: assistantSoFar }];
            });
          },
          () => {
            setIsLoading(false);
            const shouldSpeak = (sentViaVoiceRef.current && tts.autoReplyVoice) || autoSpeak;
            sentViaVoiceRef.current = false;
            if (shouldSpeak && assistantSoFar) {
              setTimeout(() => tts.speak(assistantSoFar, Date.now()), 100);
            }
            // Persist after stream completes
            setMessages(prev => { persistMessages(prev); return prev; });
          }
        );
      } else if (result.type === "tool_calls") {
          // Recursive: execute tool calls with heavy/light split
          const fHeavy = result.tool_calls.filter(tc => isHeavyTool(tc.name));
          const fLight = result.tool_calls.filter(tc => !isHeavyTool(tc.name));

          const lightResults = await Promise.all(fLight.map(async (tc) => {
            const res = await executeToolCall(tc);
            const isError = /erro|falha|não encontrad|expirad|❌|invalid|failed|error/i.test(res);
            return `[${isError ? "ERRO" : "OK"}] ${tc.name}: ${res}`;
          }));

          let heavyResults: string[] = [];
          if (fHeavy.length > 0) {
            const batchId = crypto.randomUUID();
            await enqueueTools(batchId, fHeavy.map(tc => ({ id: tc.id, name: tc.name, arguments: tc.arguments })));
            try {
              const br = await waitForBatch(batchId, 120_000);
              heavyResults = br.results.map(r => r.status === "done"
                ? `[${/\[ERRO\]/i.test(r.result || "") ? "ERRO" : "OK"}] ${r.tool_name}: ${r.result}`
                : `[ERRO] ${r.tool_name}: ${r.error || "Falha"}`);
              clearBatch(batchId);
            } catch {
              heavyResults = fHeavy.map(tc => `[ERRO] ${tc.name}: Timeout`);
            }
          }

          const nestedResults = [...lightResults, ...heavyResults];
          const visibleNested = nestedResults.filter(r => r.trim() !== "" && !r.includes("suggest_replies"));
          if (visibleNested.length > 0) {
            const combinedMessages: Msg[] = [
              ...allMessages,
              { role: "assistant", content: `[Resultados das ações executadas]\n${[...toolResults, ...visibleNested].join("\n")}` },
              { role: "user", content: "Analise os resultados acima. Se algum resultado contiver [ERRO], informe o usuário sobre o PROBLEMA e sugira como resolver. Nunca diga que uma ação foi realizada se o resultado indicar erro. Resuma apenas as ações que tiveram SUCESSO de forma natural e concisa." },
            ];
            try {
              const finalResult = await callChat({
                messages: combinedMessages,
                context: await buildContext(),
                signal: abortRef.current?.signal,
                agentConfig,
                workspaceId: wsId,
                isAllMode,
              });
              if (finalResult.type === "stream" && finalResult.body) {
                let finalText = "";
                parseSSEStream(
                  finalResult.body,
                  (chunk) => {
                    finalText += chunk;
                    setMessages(prev => {
                      const last = prev[prev.length - 1];
                      if (last?.role === "assistant") {
                        return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: finalText } : m);
                      }
                      return [...prev, { role: "assistant", content: finalText }];
                    });
                  },
                  () => {
                    setIsLoading(false);
                    const shouldSpeak = (sentViaVoiceRef.current && tts.autoReplyVoice) || autoSpeak;
                    sentViaVoiceRef.current = false;
                    if (shouldSpeak && finalText) {
                      setTimeout(() => tts.speak(finalText, Date.now()), 100);
                    }
                    setMessages(prev => { persistMessages(prev); return prev; });
                  }
                );
              } else if (finalResult.type === "text") {
                const ftContent = finalResult.content;
                setMessages(prev => {
                  const updated = [...prev, { role: "assistant" as const, content: ftContent }];
                  persistMessages(updated);
                  return updated;
                });
                setIsLoading(false);
                const shouldSpeak = (sentViaVoiceRef.current && tts.autoReplyVoice) || autoSpeak;
                sentViaVoiceRef.current = false;
                if (shouldSpeak && ftContent) {
                  setTimeout(() => tts.speak(ftContent, Date.now()), 100);
                }
              } else {
                setIsLoading(false);
                sentViaVoiceRef.current = false;
              }
            } catch {
              const fallbackText = [...toolResults, ...visibleNested].join("\n");
              setMessages(prev => {
                const updated = [...prev, { role: "assistant" as const, content: fallbackText }];
                persistMessages(updated);
                return updated;
              });
              setIsLoading(false);
              const shouldSpeak = (sentViaVoiceRef.current && tts.autoReplyVoice) || autoSpeak;
              sentViaVoiceRef.current = false;
              if (shouldSpeak && fallbackText) {
                setTimeout(() => tts.speak(fallbackText, Date.now()), 100);
              }
            }
          } else {
            if (result.content) {
              setMessages(prev => {
                const updated = [...prev, { role: "assistant" as const, content: result.content! }];
                persistMessages(updated);
                return updated;
              });
            }
            setIsLoading(false);
          }
      } else if (result.type === "text") {
        const textContent = result.content || toolResults.join("\n");
        setMessages(prev => {
          const updated = [...prev, { role: "assistant" as const, content: textContent }];
          persistMessages(updated);
          return updated;
        });
        setIsLoading(false);
        const shouldSpeak = (sentViaVoiceRef.current && tts.autoReplyVoice) || autoSpeak;
        sentViaVoiceRef.current = false;
        if (shouldSpeak && textContent) {
          setTimeout(() => tts.speak(textContent, Date.now()), 100);
        }
      } else {
        setIsLoading(false);
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev, { role: "assistant" as const, content: toolResults.join("\n") }];
        persistMessages(updated);
        return updated;
      });
      setIsLoading(false);
    }
  }, [buildContext, autoSpeak, tts, executeToolCall, persistMessages, agentConfig, enqueueTools, waitForBatch, clearBatch]);

  const sendMessage = useCallback((text: string, images?: string[]) => {
    if ((!text.trim() && (!images || images.length === 0)) || isLoading) return;

    // Build multimodal content if images present
    const allImages = images || pendingImages;
    let msgContent: MsgContent;
    if (allImages.length > 0) {
      const parts: MsgContent = [];
      if (text.trim()) parts.push({ type: "text", text: text.trim() });
      allImages.forEach(img => parts.push({ type: "image_url", image_url: { url: img } }));
      msgContent = parts;
    } else {
      msgContent = text.trim();
    }

    const userMsg: Msg = { role: "user", content: msgContent, images: allImages.length > 0 ? allImages : undefined, timestamp: new Date().toISOString() };
    setDynamicReplies([]);
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    const trimmedForApi = newMessages.length > 20 ? newMessages.slice(-20) : newMessages;
    setInput("");
    setPendingImages([]);
    setIsLoading(true);

    const firstUserText = text.trim();

    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const result = await callChat({
          messages: trimmedForApi,
          context: await buildContext(),
          signal: controller.signal,
          agentConfig,
          workspaceId: wsId,
          isAllMode,
        });

        if (result.type === "tool_calls") {
          const heavy = result.tool_calls.filter(tc => isHeavyTool(tc.name));
          const light = result.tool_calls.filter(tc => !isHeavyTool(tc.name));

          const lightResults = await Promise.all(light.map(async (tc) => {
            const res = await executeToolCall(tc);
            const isError = /erro|falha|não encontrad|expirad|❌|invalid|failed|error/i.test(res);
            return `[${isError ? "ERRO" : "OK"}] ${tc.name}: ${res}`;
          }));

          let heavyResults: string[] = [];
          if (heavy.length > 0) {
            const batchId = crypto.randomUUID();
            await enqueueTools(batchId, heavy.map(tc => ({ id: tc.id, name: tc.name, arguments: tc.arguments })));
            try {
              const br = await waitForBatch(batchId, 120_000);
              heavyResults = br.results.map(r => r.status === "done"
                ? `[${/\[ERRO\]/i.test(r.result || "") ? "ERRO" : "OK"}] ${r.tool_name}: ${r.result}`
                : `[ERRO] ${r.tool_name}: ${r.error || "Falha"}`);
              clearBatch(batchId);
            } catch {
              heavyResults = heavy.map(tc => `[ERRO] ${tc.name}: Timeout`);
            }
          }

          const toolResults = [...lightResults, ...heavyResults];
          const visibleResults = toolResults.filter(r => r.trim() !== "");
          sendFollowUp(newMessages, visibleResults);
        } else if (result.type === "text") {
          const assistantText = result.content;
          setMessages(prev => {
            const updated = [...prev, { role: "assistant" as const, content: assistantText }];
            persistMessages(updated, firstUserText);
            return updated;
          });
          setIsLoading(false);
          const shouldSpeak = (sentViaVoiceRef.current && tts.autoReplyVoice) || autoSpeak;
          sentViaVoiceRef.current = false;
          if (shouldSpeak && assistantText) {
            setTimeout(() => tts.speak(assistantText, Date.now()), 100);
          }
        } else {
          let assistantSoFar = "";
          parseSSEStream(
            result.body,
            (chunk) => {
              assistantSoFar += chunk;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && prev.length > 1 && getTextContent(prev[prev.length - 2]?.content) === text.trim()) {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            },
            () => {
              setIsLoading(false);
              const shouldSpeak = (sentViaVoiceRef.current && tts.autoReplyVoice) || autoSpeak;
              sentViaVoiceRef.current = false;
              if (shouldSpeak && assistantSoFar) {
                setTimeout(() => tts.speak(assistantSoFar, Date.now()), 100);
              }
              // Persist after stream completes
              setMessages(prev => { persistMessages(prev, firstUserText); return prev; });
            }
          );
        }
      } catch (e: any) {
        if (e.name !== "AbortError") {
          console.error(e);
          setMessages(prev => [...prev, { role: "assistant", content: "Desculpe, ocorreu um erro. Tente novamente." }]);
        }
        setIsLoading(false);
      }
    })();
  }, [isLoading, messages, buildContext, executeToolCall, sendFollowUp, autoSpeak, tts, pendingImages, persistMessages, enqueueTools, waitForBatch, clearBatch]);

  // Voice recognition callback
  const onVoiceResult = useCallback((transcript: string) => {
    setInput(transcript);
    pendingVoiceSendRef.current = true;
    sentViaVoiceRef.current = true;
  }, []);

  const stt = useSpeechRecognition(onVoiceResult);

  // Auto-send after voice input
  useEffect(() => {
    if (pendingVoiceSendRef.current && input.trim()) {
      pendingVoiceSendRef.current = false;
      sendMessage(input);
    }
  }, [input, sendMessage]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
    if (!isOpen) tts.stop();
  }, [isOpen]);

  const handleSend = () => sendMessage(input);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const maxImages = 4;
    const newImages: string[] = [];
    for (let i = 0; i < Math.min(files.length, maxImages - pendingImages.length); i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) { toast.error("Apenas imagens são suportadas."); continue; }
      if (file.size > 5 * 1024 * 1024) { toast.error("Imagem muito grande (máx 5MB)."); continue; }
      const base64 = await fileToBase64(file);
      newImages.push(base64);
    }
    setPendingImages(prev => [...prev, ...newImages].slice(0, maxImages));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [pendingImages]);

  return (
    <>
      {/* Floating trigger button — draggable */}
      {!isOpen && (
        <div
          className="fixed z-[60] w-11 h-11 md:w-14 md:h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center cursor-grab active:cursor-grabbing select-none touch-none animate-in fade-in zoom-in duration-300"
          style={{ right: pos.right, bottom: pos.bottom }}
          aria-label="Pandora IA — arraste para mover"
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
        >
          <Sparkles className="w-5 h-5 md:w-6 md:h-6 pointer-events-none" />
        </div>
      )}

      {/* Chat panel */}
      {isOpen && (
      <div
        className="fixed z-[100] flex flex-col rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 bg-background border border-border shadow-2xl w-[calc(100vw-1rem)] sm:w-[400px] h-[calc(100dvh-6rem)] sm:h-[min(75vh,800px)] max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-2rem)] inset-x-2 sm:inset-x-auto bottom-16 sm:bottom-auto"
        style={{
          ...(typeof window !== 'undefined' && window.innerWidth >= 640
            ? {
                right: Math.min(pos.right, window.innerWidth - 420),
                bottom: Math.max(pos.bottom, 16),
                left: 'auto',
                top: 'auto',
              }
            : {}),
        }}
      >
      {/* Header — drag handle */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border cursor-grab active:cursor-grabbing select-none touch-none"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          dragState.current = { startX: e.clientX, startY: e.clientY, startRight: pos.right, startBottom: pos.bottom, moved: false };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={handleDragMove}
        onPointerUp={() => {
          dragState.current = null;
        }}
      >
        <div className="flex items-center gap-2">
          <div className={`relative ${isLoading ? "pandora-glow" : ""}`}>
            <img src={pandoraAvatar} alt="Pandora" className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/30 relative z-10" />
            {isLoading && <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping z-0" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground font-sans">Pandora</h3>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              Online
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 relative">
          <button
            onClick={handleNewConversation}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            title="Nova conversa"
          >
            <MessageSquarePlus className="w-3.5 h-3.5 text-foreground/70" />
          </button>
          <button
            onClick={() => { const next = !autoSpeak; setAutoSpeak(next); tts.setAutoSpeak(next); }}
            className={`p-1.5 rounded-lg transition-colors ${autoSpeak ? "bg-primary/20 text-primary" : "hover:bg-muted text-foreground/50"}`}
            title={autoSpeak ? "Auto-leitura ativada" : "Auto-leitura desativada"}
          >
            {autoSpeak ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setShowVoiceSettings(!showVoiceSettings)}
            className={`p-1.5 rounded-lg transition-colors ${showVoiceSettings ? "bg-primary/20 text-primary" : "hover:bg-muted text-foreground/50"}`}
            title="Configurações de voz"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
          <DeshTooltip label="Abrir em página inteira" side="bottom">
            <button onClick={() => navigate("/ai")} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <Maximize2 className="w-3.5 h-3.5 text-foreground/70" />
            </button>
          </DeshTooltip>
          <button onClick={toggleOpen} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-foreground/70" />
          </button>

          {/* Voice settings dropdown */}
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
                {tts.voices.map((voice) => (
                  <div key={voice.id} className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                    tts.selectedVoiceId === voice.id
                      ? "bg-primary/20 text-primary font-medium"
                      : "text-foreground/70 hover:bg-accent"
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
                  <label htmlFor="widget-auto-reply-voice" className="text-[10px] text-muted-foreground leading-tight cursor-pointer">
                    Responder por voz ao comando de voz
                  </label>
                  <Switch
                    id="widget-auto-reply-voice"
                    checked={tts.autoReplyVoice}
                    onCheckedChange={tts.setAutoReplyVoice}
                    className="scale-75"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                msg.role === "user" ? "rounded-br-md text-white" : "rounded-bl-md text-foreground"
              }`}
              style={{
                background: msg.role === "user"
                  ? "linear-gradient(135deg, hsl(35 80% 50%), hsl(35 70% 45%))"
                  : "bg-muted",
              }}
            >
              {msg.role === "assistant" ? (
                <div className="select-text">
                  <Streamdown>{getTextContent(msg.content)}</Streamdown>
                  <button
                    onClick={() => tts.speak(getTextContent(msg.content), i)}
                    disabled={tts.isLoading}
                    className="mt-1 p-1 rounded hover:bg-muted/70 transition-colors inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50"
                    title={tts.speakingId === i ? "Parar leitura" : "Ouvir resposta"}
                  >
                    {tts.isLoading && tts.speakingId === null ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : tts.speakingId === i ? (
                      <VolumeX className="w-3 h-3" />
                    ) : (
                      <Volume2 className="w-3 h-3" />
                    )}
                  </button>
                </div>
              ) : (
                <div>
                  {msg.images && msg.images.length > 0 && (
                    <div className="flex gap-1 mb-1.5 flex-wrap">
                      {msg.images.map((img, idx) => (
                        <img key={idx} src={img} alt="Upload" className="w-16 h-16 object-cover rounded-lg" />
                      ))}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap select-text">{getTextContent(msg.content)}</p>
                </div>
              )}
              {/* Timestamp */}
              {msg.timestamp && (
                <p className={`text-[10px] mt-1 ${msg.role === "user" ? "text-white/40 text-right" : "text-muted-foreground/50"}`}>
                  {new Date(msg.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-muted">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Quick Replies */}
      {!isLoading && (() => {
        const isInitial = messages.length <= 2;

        if (isInitial && dynamicReplies.length === 0) {
          const initial = [
            { icon: Sun, label: "Resumo do dia", msg: "Me dê o resumo do meu dia" },
            { icon: ListTodo, label: "Minhas tarefas", msg: "Liste minhas tarefas atuais" },
            { icon: Plus, label: "Criar tarefa", msg: "Crie uma tarefa para mim" },
            { icon: BarChart3, label: "Finanças", msg: "Como estão minhas finanças?" },
            { icon: Calendar, label: "Agenda", msg: "Quais são meus próximos eventos?" },
            { icon: Brain, label: "O que sabe de mim?", msg: "O que você lembra sobre mim?" },
          ];
          return (
            <div className="px-3 pb-1 flex flex-wrap gap-1.5">
              {initial.map(({ icon: Icon, label, msg }) => (
                <button key={label} onClick={() => sendMessage(msg)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all hover:scale-105 active:scale-95 bg-muted border border-border text-foreground">
                  <Icon className="w-3 h-3 text-primary" />{label}
                </button>
              ))}
            </div>
          );
        }

        if (dynamicReplies.length > 0) {
          return (
            <div className="px-3 pb-1 flex flex-wrap gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {dynamicReplies.map(({ label, message }) => (
                <button key={label} onClick={() => sendMessage(message)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all hover:scale-105 active:scale-95 bg-muted border border-border text-foreground"
                >
                  <Sparkles className="w-3 h-3 text-primary" />{label}
                </button>
              ))}
            </div>
          );
        }

        return null;
      })()}

      {/* Pending Images Preview */}
      {pendingImages.length > 0 && (
        <div className="px-3 pb-1 flex gap-1.5 flex-wrap">
          {pendingImages.map((img, idx) => (
            <div key={idx} className="relative group">
              <img src={img} alt="Preview" className="w-12 h-12 object-cover rounded-lg border border-white/20" />
              <button onClick={() => setPendingImages(prev => prev.filter((_, i) => i !== idx))}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 pt-1">
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 bg-muted border border-border">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || pendingImages.length >= 4}
            className="p-1.5 rounded-lg transition-all disabled:opacity-30 hover:bg-white/10 text-foreground/70"
            title="Enviar imagem para análise"
          >
            <ImagePlus className="w-4 h-4" />
          </button>
          {stt.supported && (
            <button
              onClick={stt.isListening ? stt.stopListening : stt.startListening}
              disabled={isLoading}
              className={`p-1.5 rounded-lg transition-all disabled:opacity-30 ${
                stt.isListening ? "bg-red-500/20 text-red-400 animate-pulse" : "hover:bg-white/10 text-foreground/70"
              }`}
              title={stt.isListening ? "Parar gravação" : "Falar"}
            >
              {stt.isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => widgetSmartCommands.handleChange(e.target.value)}
            onKeyDown={(e) => { widgetSmartCommands.handleKeyDown(e); if (!widgetSmartCommands.popup.open && e.key === "Enter" && !e.shiftKey) handleSend(); }}
            placeholder={pendingImages.length > 0 ? "Descreva ou pergunte sobre a imagem..." : stt.isListening ? "Ouvindo..." : "@ menções, / comandos..."}
            disabled={isLoading}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-50"
          />
          <SmartCommandPopup
            open={widgetSmartCommands.popup.open}
            items={widgetSmartCommands.popup.items}
            selectedIndex={widgetSmartCommands.popup.selectedIndex}
            trigger={widgetSmartCommands.popup.trigger}
            position={widgetSmartCommands.popup.position}
            onSelect={widgetSmartCommands.selectItem}
            onClose={widgetSmartCommands.closePopup}
            placement="above-left"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || (!input.trim() && pendingImages.length === 0)}
            className="p-1.5 rounded-lg transition-colors disabled:opacity-30 hover:bg-white/10"
          >
            <Send className="w-4 h-4 text-foreground/70" />
          </button>
        </div>
      </div>
    </div>
      )}
    </>
  );
};

export default React.memo(AIChatWidget);
