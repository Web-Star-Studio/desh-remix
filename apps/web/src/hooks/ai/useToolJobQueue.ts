// TODO: Migrar para edge function — acesso direto ao Supabase
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Tools that are too heavy for synchronous frontend execution */
const HEAVY_TOOLS = new Set([
  "search_emails",
  "trash_emails",
  "archive_emails",
  "star_emails",
  "mark_emails_read",
  "send_email",
  "reply_email",
  "search_web",
  "generate_image",
  "create_event",
  "serp_search",
]);

export function isHeavyTool(toolName: string): boolean {
  return HEAVY_TOOLS.has(toolName);
}

export interface ToolJob {
  id: string;
  batch_id: string;
  tool_name: string;
  tool_args: Record<string, any>;
  status: "pending" | "running" | "done" | "failed";
  result: string | null;
  error: string | null;
}

interface BatchStatus {
  batchId: string;
  total: number;
  done: number;
  failed: number;
  running: number;
  pending: number;
  results: Array<{ tool_name: string; status: string; result: string | null; error: string | null }>;
  isComplete: boolean;
}

export function useToolJobQueue() {
  const { user } = useAuth();
  const [activeBatches, setActiveBatches] = useState<Map<string, BatchStatus>>(new Map());
  const jobsMapRef = useRef<Map<string, ToolJob>>(new Map());

  // Subscribe to realtime changes on tool_jobs
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("tool-jobs-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tool_jobs",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          const updated = payload.new as ToolJob;
          jobsMapRef.current.set(updated.id, updated);

          // Recalculate batch status
          setActiveBatches((prev) => {
            const next = new Map(prev);
            const batchId = updated.batch_id;
            const batchJobs = Array.from(jobsMapRef.current.values()).filter(
              (j) => j.batch_id === batchId
            );

            const done = batchJobs.filter((j) => j.status === "done").length;
            const failed = batchJobs.filter((j) => j.status === "failed").length;
            const running = batchJobs.filter((j) => j.status === "running").length;
            const pending = batchJobs.filter((j) => j.status === "pending").length;

            next.set(batchId, {
              batchId,
              total: batchJobs.length,
              done,
              failed,
              running,
              pending,
              results: batchJobs.map((j) => ({
                tool_name: j.tool_name,
                status: j.status,
                result: j.result,
                error: j.error,
              })),
              isComplete: done + failed === batchJobs.length,
            });

            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const enqueueTools = useCallback(
    async (
      batchId: string,
      toolCalls: Array<{ id: string; name: string; arguments: Record<string, any> }>,
      conversationId?: string
    ): Promise<BatchStatus> => {
      if (!user) throw new Error("Not authenticated");

      const jobs = toolCalls.map((tc) => ({
        user_id: user.id,
        batch_id: batchId,
        conversation_id: conversationId || null,
        tool_name: tc.name,
        tool_args: tc.arguments,
        status: "pending" as const,
      }));

      const { data: inserted, error } = await supabase
        .from("tool_jobs")
        .insert(jobs)
        .select();

      if (error) throw new Error(`Failed to enqueue: ${error.message}`);

      // Track locally
      const insertedJobs = (inserted || []) as unknown as ToolJob[];
      for (const job of insertedJobs) {
        jobsMapRef.current.set(job.id, job);
      }

      const initial: BatchStatus = {
        batchId,
        total: toolCalls.length,
        done: 0,
        failed: 0,
        running: 0,
        pending: toolCalls.length,
        results: [],
        isComplete: false,
      };

      setActiveBatches((prev) => {
        const next = new Map(prev);
        next.set(batchId, initial);
        return next;
      });

      return initial;
    },
    [user]
  );

  const getBatchStatus = useCallback(
    (batchId: string): BatchStatus | undefined => {
      return activeBatches.get(batchId);
    },
    [activeBatches]
  );

  /** Wait for a batch to complete, returning final results */
  const waitForBatch = useCallback(
    (batchId: string, timeoutMs = 120_000): Promise<BatchStatus> => {
      return new Promise((resolve, reject) => {
        const start = Date.now();

        const check = () => {
          const status = activeBatches.get(batchId);
          if (status?.isComplete) {
            resolve(status);
            return;
          }
          if (Date.now() - start > timeoutMs) {
            reject(new Error("Batch timeout"));
            return;
          }
        };

        // Check immediately
        check();

        // Poll every 500ms (realtime updates will trigger re-renders)
        const interval = setInterval(() => {
          const status = activeBatches.get(batchId);
          if (status?.isComplete) {
            clearInterval(interval);
            resolve(status);
          } else if (Date.now() - start > timeoutMs) {
            clearInterval(interval);
            reject(new Error("Batch timeout"));
          }
        }, 500);
      });
    },
    [activeBatches]
  );

  const clearBatch = useCallback((batchId: string) => {
    setActiveBatches((prev) => {
      const next = new Map(prev);
      next.delete(batchId);
      return next;
    });
    // Clean up local tracking
    for (const [id, job] of jobsMapRef.current.entries()) {
      if (job.batch_id === batchId) jobsMapRef.current.delete(id);
    }
  }, []);

  return {
    enqueueTools,
    getBatchStatus,
    waitForBatch,
    clearBatch,
    activeBatches,
    isHeavyTool,
  };
}
