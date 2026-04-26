import React from "react";
// GenAIWidget - widget de IA generativa
import GlassCard from "./GlassCard";
import WidgetTitle from "./WidgetTitle";
import ConnectionBadge from "./ConnectionBadge";
import { Sparkles, Send, Bot, User, Loader2 } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { useConnections } from "@/contexts/ConnectionsContext";

import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { supabase } from "@/integrations/supabase/client";
import { Streamdown } from "streamdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const GenAIWidget = () => {
  const { invoke } = useEdgeFn();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Olá! Como posso ajudar?" },
  ]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { getConnectionByCategory } = useConnections();
  const genaiConn = getConnectionByCategory("genai");
  const isConnected = false;
  const models: any[] = [];

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
  }, []);

  const handleStreamResponse = useCallback(async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            setStreamingText(fullText);
            scrollToBottom();
          }
        } catch {
          // skip malformed chunks
        }
      }
    }

    return fullText;
  }, [scrollToBottom]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isGenerating) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsGenerating(true);
    setStreamingText("");

    const MAX_RETRIES = 2;
    const RETRY_DELAYS = [1500, 3000];

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              messages: [
                ...messages.map(m => ({ role: m.role, content: m.content })),
                { role: "user", content: text },
              ],
            }),
          }
        );

        if (response.status === 429) {
          setMessages(prev => [...prev, { role: "assistant", content: "⏳ Muitas requisições. Aguarde alguns segundos." }]);
          break;
        }
        if (response.status === 402) {
          setMessages(prev => [...prev, { role: "assistant", content: "💳 Créditos insuficientes. Recarregue em Configurações." }]);
          break;
        }

        // Retry on 5xx
        if (response.status >= 500 && attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
          continue;
        }

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(errText || "Erro no serviço de IA");
        }

        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("text/event-stream") && response.body) {
          const reader = response.body.getReader();
          const fullText = await handleStreamResponse(reader);
          setStreamingText("");
          setMessages(prev => [...prev, { role: "assistant", content: fullText || "Sem resposta." }]);
        } else {
          const data = await response.json();
          if (data.type === "tool_calls") {
            const toolNames = data.tool_calls?.map((tc: any) => tc.name).join(", ") || "";
            const reply = data.content || `Executando: ${toolNames}`;
            setMessages(prev => [...prev, { role: "assistant", content: reply }]);
          } else {
            const reply = data.choices?.[0]?.message?.content || data.content || "Sem resposta.";
            setMessages(prev => [...prev, { role: "assistant", content: reply }]);
          }
        }
        break; // Success
      } catch (err) {
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
          continue;
        }
        console.error("GenAI error:", err);
        setMessages(prev => [...prev, { role: "assistant", content: "Erro ao gerar resposta. Tente novamente." }]);
      }
    }

    setIsGenerating(false);
    setStreamingText("");
    scrollToBottom();
  };

  const displayMessages = streamingText
    ? [...messages, { role: "assistant" as const, content: streamingText }]
    : messages;

  return (
    <GlassCard className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <WidgetTitle
            label="IA Generativa"
            icon={<Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />}
            popupIcon={<Sparkles className="w-5 h-5 text-primary" />}
            popupContent={
              <div className="space-y-4">
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {displayMessages.map((msg, idx) => (
                    <div key={`popup-${msg.role}-${idx}`} className={`flex items-start gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === "user" ? "bg-primary/20" : "bg-foreground/10"}`}>
                        {msg.role === "user" ? <User className="w-3.5 h-3.5 text-primary" /> : <Bot className="w-3.5 h-3.5 text-foreground/60" />}
                      </div>
                      <div className={`text-sm leading-relaxed px-3 py-2 rounded-2xl max-w-[85%] ${msg.role === "user" ? "bg-primary/15 text-foreground" : "bg-foreground/5 text-foreground/80"}`}>
                        {msg.role === "assistant" ? (
                          <Streamdown>{msg.content}</Streamdown>
                        ) : msg.content}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSend()}
                    placeholder="Pergunte algo..."
                    className="flex-1 bg-foreground/5 rounded-xl px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50"
                    disabled={isGenerating}
                  />
                  <button onClick={handleSend} disabled={!input.trim() || isGenerating} className="p-2 rounded-xl bg-primary/20 text-primary hover:bg-primary/30 transition-colors disabled:opacity-40">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            }
          />
          <ConnectionBadge isConnected={isConnected} isLoading={false} />
        </div>
        <Sparkles className="w-4 h-4 text-primary" />
      </div>

      {/* Model indicator */}
      {isConnected && models.length > 0 && (
        <p className="text-[10px] text-muted-foreground mb-2 truncate">
          Modelo: {models[0]?.name || models[0]?.id || "Conectado"}
        </p>
      )}

      {/* Chat messages */}
      <div ref={scrollRef} className="space-y-2 flex-1 overflow-y-auto min-h-0 mb-3 pr-1 scrollbar-thin">
        {displayMessages.map((msg, idx) => (
          <div
            key={`msg-${msg.role}-${idx}`}
            className={`flex items-start gap-1.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.role === "user" ? "bg-primary/20" : "bg-foreground/10"
            }`}>
              {msg.role === "user" ? (
                <User className="w-2.5 h-2.5 text-primary" />
              ) : (
                <Bot className="w-2.5 h-2.5 text-foreground/60" />
              )}
            </div>
            <div
              className={`text-[11px] leading-relaxed px-2.5 py-1.5 rounded-xl max-w-[85%] ${
                msg.role === "user"
                  ? "bg-primary/15 text-foreground"
                  : "bg-foreground/5 text-foreground/80"
              }`}
            >
              {msg.role === "assistant" ? (
                <Streamdown>{msg.content}</Streamdown>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {isGenerating && !streamingText && (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-foreground/10 flex items-center justify-center">
              <Bot className="w-2.5 h-2.5 text-foreground/60" />
            </div>
            <div className="bg-foreground/5 rounded-xl px-3 py-1.5">
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-1.5">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSend()}
          placeholder="Pergunte algo..."
          className="flex-1 bg-foreground/5 rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50"
          disabled={isGenerating}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isGenerating}
          className="p-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors disabled:opacity-40"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </GlassCard>
  );
};

export default React.memo(GenAIWidget);
