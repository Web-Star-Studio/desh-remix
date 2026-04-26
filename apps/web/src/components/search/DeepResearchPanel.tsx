import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { markdownComponents } from "./SearchMarkdownComponents";
import GlassCard from "@/components/dashboard/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import SearchExportButton from "@/components/search/SearchExportButton";
import {
  Microscope, Loader2, CheckCircle2, Globe, FileText,
  Copy, Check, ChevronDown, ChevronUp, X, AlertCircle,
  BookOpen, Clock, Search, Sparkles, ExternalLink, Maximize2, Minimize2,
} from "lucide-react";

interface ResearchStep {
  query: string;
  purpose: string;
  citationsCount: number;
  answerPreview?: string;
}

interface DeepResearchResult {
  report: string;
  citations: string[];
  steps: ResearchStep[];
  totalSearches: number;
  totalCitations: number;
}

interface DeepResearchPanelProps {
  topic: string;
  autoStart?: boolean;
  onComplete?: () => void;
  onCancel?: () => void;
}

const getReadingTime = (text: string) => {
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / 200);
  return { words, minutes };
};

export default function DeepResearchPanel({ topic, autoStart, onComplete, onCancel }: DeepResearchPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<DeepResearchResult | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(7);
  const [statusMessage, setStatusMessage] = useState("");
  const [completedSteps, setCompletedSteps] = useState<ResearchStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasStartedRef = useRef("");

  const handleStart = async () => {
    if (!topic.trim() || isRunning) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Você precisa estar logado.");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsRunning(true);
    setResult(null);
    setError(null);
    setCurrentStep(0);
    setTotalSteps(7);
    setStatusMessage("Iniciando pesquisa profunda...");
    setCompletedSteps([]);
    setElapsed(0);

    const startTime = Date.now();
    timerRef.current = setInterval(() => setElapsed(Date.now() - startTime), 100);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: supabaseKey,
        },
        body: JSON.stringify({ action: "deep-research", topic: topic.trim(), lang: "pt" }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Erro ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;

          try {
            const event = JSON.parse(payload);

            if (event.type === "status") {
              setCurrentStep(event.step);
              setTotalSteps(event.total);
              setStatusMessage(event.message);
            } else if (event.type === "plan") {
              setStatusMessage(`${event.queries.length} sub-pesquisas planejadas`);
            } else if (event.type === "step_done") {
              setCompletedSteps(prev => [...prev, {
                query: event.query || "",
                purpose: event.purpose,
                citationsCount: event.citationsCount,
                answerPreview: event.answerPreview,
              }]);
            } else if (event.type === "done") {
              setResult({
                report: event.report,
                citations: event.citations,
                steps: event.steps,
                totalSearches: event.totalSearches,
                totalCitations: event.totalCitations,
              });
              setIsRunning(false);
              if (timerRef.current) clearInterval(timerRef.current);
              toast.success("Relatório Deep Research concluído!");
              onComplete?.();
            } else if (event.type === "error") {
              throw new Error(event.error);
            }
          } catch (e: any) {
            if (e.message && !e.message.includes("JSON")) throw e;
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      console.error("Deep research error:", err);
      setError(err.message || "Erro ao executar pesquisa profunda.");
      setIsRunning(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // Auto-start when topic changes and autoStart is true
  useEffect(() => {
    if (autoStart && topic.trim() && topic !== hasStartedRef.current) {
      hasStartedRef.current = topic;
      handleStart();
    }
  }, [topic, autoStart]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancel = () => {
    abortRef.current?.abort();
    setIsRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    onCancel?.();
  };

  const handleCopyReport = () => {
    if (!result?.report) return;
    navigator.clipboard.writeText(result.report);
    setCopied(true);
    toast.success("Relatório copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const progress = totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0;
  const readingInfo = result?.report ? getReadingTime(result.report) : null;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <AnimatePresence>
        {isRunning && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <GlassCard size="auto">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate">{statusMessage}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-6 sm:ml-0">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {(elapsed / 1000).toFixed(0)}s
                  </span>
                  <span className="text-xs text-muted-foreground">{currentStep}/{totalSteps}</span>
                  <button
                    onClick={handleCancel}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-destructive hover:bg-destructive/10 transition-all"
                  >
                    <X className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Cancelar</span>
                  </button>
                </div>
              </div>
              <Progress value={progress} className="h-2 mb-3" />

              {completedSteps.length > 0 && (
                <div className="space-y-1.5 mt-3">
                  {completedSteps.map((step, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2 text-xs text-foreground/70"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate">{step.purpose}</span>
                      <span className="text-muted-foreground shrink-0">
                        ({step.citationsCount} fontes)
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <GlassCard size="auto">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
          <button
            onClick={handleStart}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Tentar novamente
          </button>
        </GlassCard>
      )}

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Stats bar */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-3">
              <Badge variant="secondary" className="gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2.5">
                <Search className="w-3 h-3" /> {result.totalSearches} buscas
              </Badge>
              <Badge variant="secondary" className="gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2.5">
                <Globe className="w-3 h-3" /> {result.totalCitations} fontes
              </Badge>
              {readingInfo && (
                <Badge variant="secondary" className="gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2.5">
                  <BookOpen className="w-3 h-3" /> {readingInfo.minutes} min · {readingInfo.words} <span className="hidden sm:inline">palavras</span><span className="sm:hidden">pal.</span>
                </Badge>
              )}
              <Badge variant="secondary" className="gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2.5">
                <Clock className="w-3 h-3" /> {(elapsed / 1000).toFixed(0)}s
              </Badge>
            </div>

            {/* Research steps toggle */}
            <GlassCard size="auto">
              <button
                onClick={() => setShowSteps(!showSteps)}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">
                    Etapas da Pesquisa ({result.steps.length})
                  </span>
                </div>
                {showSteps ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              <AnimatePresence>
                {showSteps && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mt-3 space-y-2"
                  >
                    {result.steps.map((step, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-foreground/[0.03] border border-foreground/5">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground">{step.purpose}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{step.query}</p>
                          <span className="text-[10px] text-muted-foreground">{step.citationsCount} fontes</span>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassCard>

            {/* Report */}
            <GlassCard size="auto">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Microscope className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-semibold text-foreground text-xs sm:text-sm truncate">Relatório Deep Research</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <SearchExportButton
                    data={{
                      query: topic,
                      answer: result.report,
                      tldr: "",
                      key_facts: [],
                      citations: result.citations,
                    }}
                  />
                  <button
                    onClick={handleCopyReport}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all"
                    title={copied ? "Copiado" : "Copiar"}
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => setExpanded(!expanded)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all"
                    title={expanded ? "Recolher" : "Expandir"}
                  >
                    {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className={`${expanded ? "" : "min-h-[40vh] sm:min-h-[60vh] max-h-[80vh] overflow-y-auto"} scrollbar-thin pr-1`}>
                <Streamdown components={markdownComponents}>{result.report}</Streamdown>
              </div>
            </GlassCard>

            {/* Citations */}
            {result.citations.length > 0 && (
              <GlassCard size="auto">
                <p className="widget-title mb-3">Todas as Fontes ({result.citations.length})</p>
                <div className="max-h-[250px] sm:max-h-[300px] overflow-y-auto pr-1 space-y-1">
                  {result.citations.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[10px] sm:text-xs text-foreground/70 hover:text-primary py-1 px-1.5 sm:px-2 rounded-lg hover:bg-foreground/5 transition-all"
                    >
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-foreground/10 text-[9px] font-bold shrink-0">{i + 1}</span>
                      <span className="truncate min-w-0">{url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ))}
                </div>
              </GlassCard>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
