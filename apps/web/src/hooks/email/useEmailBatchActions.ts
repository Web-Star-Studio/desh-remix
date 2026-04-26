import { useState, useCallback } from "react";
import { useGmailActions } from "@/hooks/integrations/useGmailActions";
import { toast } from "@/hooks/use-toast";

interface BatchActionsDeps {
  gmailConnected: boolean;
  isConnected: boolean;
  gmailRefetch: () => void;
  setLocalEmails: React.Dispatch<React.SetStateAction<any[]>>;
  confirm: (opts: any) => Promise<boolean>;
}

// Parallelize API calls in chunks
async function parallelChunked<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  chunkSize = 5,
): Promise<void> {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await Promise.allSettled(chunk.map(fn));
  }
}

export function useEmailBatchActions(deps: BatchActionsDeps) {
  const gmail = useGmailActions();
  const [gmailSending, setGmailSending] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  const resetSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, []);

  const batchMarkRead = useCallback(async () => {
    if (deps.gmailConnected) {
      setGmailSending(true);
      try {
        await parallelChunked([...selectedIds], async (id) => {
          await gmail.modifyLabels({ message_id: id, removeLabelIds: ["UNREAD"] });
        });
        toast({ title: `${selectedIds.size} e-mail(s) marcados como lido` });
        deps.gmailRefetch();
      } catch (err: any) {
        toast({ title: "Erro ao marcar como lido", description: err.message, variant: "destructive" });
      } finally {
        setGmailSending(false);
      }
    } else if (!deps.isConnected) {
      deps.setLocalEmails((prev: any[]) => prev.map(e => selectedIds.has(e.id) ? { ...e, unread: false } : e));
      toast({ title: `${selectedIds.size} e-mail(s) marcados como lido` });
    }
    resetSelection();
  }, [deps.gmailConnected, deps.isConnected, selectedIds, gmail, deps.gmailRefetch, deps.setLocalEmails, resetSelection]);

  const batchDelete = useCallback(async (setSelectedId?: (id: string | null) => void) => {
    const ok = await deps.confirm({ title: "Excluir e-mails?", description: `${selectedIds.size} e-mail(s) serão movidos para a lixeira.`, confirmLabel: "Excluir" });
    if (!ok) return;
    if (deps.gmailConnected) {
      setGmailSending(true);
      try {
        await parallelChunked([...selectedIds], async (id) => {
          await gmail.moveToTrash(id);
        });
        toast({ title: `${selectedIds.size} e-mail(s) movidos para a lixeira` });
        deps.gmailRefetch();
      } catch (err: any) {
        toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
      } finally {
        setGmailSending(false);
      }
    } else if (!deps.isConnected) {
      deps.setLocalEmails((prev: any[]) => prev.map(e => selectedIds.has(e.id) ? { ...e, folder: "trash" as const } : e));
      toast({ title: `${selectedIds.size} e-mail(s) movidos para a lixeira` });
    }
    resetSelection();
    setSelectedId?.(null);
  }, [deps.gmailConnected, deps.isConnected, selectedIds, gmail, deps.gmailRefetch, deps.setLocalEmails, deps.confirm, resetSelection]);

  const batchArchive = useCallback(async (setSelectedId?: (id: string | null) => void) => {
    if (deps.gmailConnected) {
      setGmailSending(true);
      try {
        await parallelChunked([...selectedIds], async (id) => {
          await gmail.modifyLabels({ message_id: id, removeLabelIds: ["INBOX"] });
        });
        toast({ title: `${selectedIds.size} e-mail(s) arquivados` });
        deps.gmailRefetch();
      } catch (err: any) {
        toast({ title: "Erro ao arquivar", description: err.message, variant: "destructive" });
      } finally {
        setGmailSending(false);
      }
    } else if (!deps.isConnected) {
      deps.setLocalEmails((prev: any[]) => prev.filter(e => !selectedIds.has(e.id)));
      toast({ title: `${selectedIds.size} e-mail(s) arquivados` });
    }
    resetSelection();
    setSelectedId?.(null);
  }, [deps.gmailConnected, deps.isConnected, selectedIds, gmail, deps.gmailRefetch, deps.setLocalEmails, resetSelection]);

  const batchMarkUnread = useCallback(async () => {
    if (deps.gmailConnected) {
      setGmailSending(true);
      try {
        await parallelChunked([...selectedIds], async (id) => {
          await gmail.modifyLabels({ message_id: id, addLabelIds: ["UNREAD"] });
        });
        toast({ title: `${selectedIds.size} e-mail(s) marcados como não lido` });
        deps.gmailRefetch();
      } catch (err: any) {
        toast({ title: "Erro", description: err.message, variant: "destructive" });
      } finally {
        setGmailSending(false);
      }
    } else if (!deps.isConnected) {
      deps.setLocalEmails((prev: any[]) => prev.map(e => selectedIds.has(e.id) ? { ...e, unread: true } : e));
      toast({ title: `${selectedIds.size} e-mail(s) marcados como não lido` });
    }
    resetSelection();
  }, [deps.gmailConnected, deps.isConnected, selectedIds, gmail, deps.gmailRefetch, deps.setLocalEmails, resetSelection]);

  const batchStar = useCallback(async () => {
    if (deps.gmailConnected) {
      setGmailSending(true);
      try {
        await parallelChunked([...selectedIds], async (id) => {
          await gmail.modifyLabels({ message_id: id, addLabelIds: ["STARRED"] });
        });
        toast({ title: `${selectedIds.size} e-mail(s) favoritados` });
        deps.gmailRefetch();
      } catch (err: any) {
        toast({ title: "Erro", description: err.message, variant: "destructive" });
      } finally {
        setGmailSending(false);
      }
    }
    resetSelection();
  }, [deps.gmailConnected, selectedIds, gmail, deps.gmailRefetch, resetSelection]);

  const batchMoveToLabel = useCallback(async (labelId: string, labelName: string) => {
    if (!deps.gmailConnected || selectedIds.size === 0) return;
    setGmailSending(true);
    try {
      await parallelChunked([...selectedIds], async (id) => {
        await gmail.modifyLabels({ message_id: id, addLabelIds: [labelId], removeLabelIds: ["INBOX"] });
      });
      toast({ title: `${selectedIds.size} e-mail(s) movidos para ${labelName}` });
      deps.gmailRefetch();
    } catch (err: any) {
      toast({ title: "Erro ao mover", description: err.message, variant: "destructive" });
    } finally {
      setGmailSending(false);
      resetSelection();
    }
  }, [deps.gmailConnected, selectedIds, gmail, deps.gmailRefetch, resetSelection]);

  return {
    gmailSending,
    setGmailSending,
    selectedIds,
    setSelectedIds,
    selectionMode,
    setSelectionMode,
    resetSelection,
    batchMarkRead,
    batchDelete,
    batchArchive,
    batchMarkUnread,
    batchStar,
    batchMoveToLabel,
  };
}
