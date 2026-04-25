import { useState, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { useComposioWorkspaceId } from "@/hooks/integrations/useComposioWorkspaceId";
import type { EmailItem } from "@/components/email/types";
import type { GmailMessagePart, ComposioProxyRequest } from "@/types/composio";

const MAX_BODY_CACHE_SIZE = 50;

interface UseEmailActionsProps {
  gmailConnected: boolean;
  isConnected: boolean;
  emails: EmailItem[];
  gmailRefetch: () => void;
  setLocalEmails: React.Dispatch<React.SetStateAction<EmailItem[]>>;
  sendEmail: (data: Record<string, unknown>) => Promise<unknown>;
  updateEmail: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  removeEmail: (id: string) => Promise<unknown>;
  refetch: () => void;
  confirm: (opts: { title: string; description: string; confirmLabel: string }) => Promise<boolean>;
  /** Optimistic cache update for Gmail sync cache */
  updateEmailInCache?: (gmailId: string, updates: Partial<{ is_unread: boolean; is_starred: boolean; label_ids: string[]; folder: string }>) => Promise<void>;
  /** Optimistic cache remove for Gmail sync cache */
  removeEmailsFromCache?: (gmailIds: string[]) => Promise<void>;
  /** Active connectionId for multi-account send */
  activeConnectionId?: string;
}

interface SendOptions {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  inReplyTo?: string;
  threadId?: string;
  isHtml?: boolean;
  connectionId?: string;
}

export function useEmailActions({
  gmailConnected, isConnected, emails, gmailRefetch, setLocalEmails,
  sendEmail, updateEmail, removeEmail, refetch, confirm,
  updateEmailInCache, removeEmailsFromCache, activeConnectionId,
}: UseEmailActionsProps) {
  const { invoke } = useEdgeFn();
  const composioWsId = useComposioWorkspaceId();
  const [gmailSending, setGmailSending] = useState(false);
  const [fullBodyCache, setFullBodyCache] = useState<Record<string, string>>({});
  const [loadingBody, setLoadingBody] = useState(false);

  /** Helper: resolve connectionId for a given email */
  const getConnectionId = useCallback((emailId: string): string | undefined => {
    const email = emails.find(e => e.id === emailId);
    return (email as any)?.connectionId || activeConnectionId;
  }, [emails, activeConnectionId]);

  /** Helper: build proxy body with optional connectionId + workspace_id */
  const buildProxyBody = useCallback((base: Record<string, unknown>, connId?: string): Record<string, unknown> => {
    const result: Record<string, unknown> = { ...base, workspace_id: composioWsId };
    if (connId) result.connectionId = connId;
    return result;
  }, [composioWsId]);

  const toggleRead = useCallback(async (id: string) => {
    if (gmailConnected) {
      const email = emails.find(e => e.id === id); if (!email) return;
      const newUnread = !email.unread;
      const body = newUnread ? { addLabelIds: ["UNREAD"] } : { removeLabelIds: ["UNREAD"] };
      const connId = getConnectionId(id);
      
      // Optimistic update
      updateEmailInCache?.(id, { is_unread: newUnread });
      
      const { error } = await invoke<any>({ fn: "composio-proxy", body: buildProxyBody({ service: "gmail", path: `/gmail/v1/users/me/messages/${id}/modify`, method: "POST", body }, connId) });
      if (error) {
        // Revert on failure
        updateEmailInCache?.(id, { is_unread: !newUnread });
        toast({ title: "Erro ao atualizar", variant: "destructive" });
      }
      return;
    }
    if (!isConnected) setLocalEmails(prev => prev.map(e => e.id === id ? { ...e, unread: !e.unread } : e));
  }, [gmailConnected, isConnected, emails, invoke, setLocalEmails, updateEmailInCache, getConnectionId, buildProxyBody]);

  const toggleStar = useCallback(async (id: string) => {
    if (gmailConnected) {
      const email = emails.find(e => e.id === id); if (!email) return;
      const newStarred = !email.starred;
      const body = newStarred ? { addLabelIds: ["STARRED"] } : { removeLabelIds: ["STARRED"] };
      const connId = getConnectionId(id);
      
      // Optimistic update
      updateEmailInCache?.(id, { is_starred: newStarred });
      
      const { error } = await invoke<any>({ fn: "composio-proxy", body: buildProxyBody({ service: "gmail", path: `/gmail/v1/users/me/messages/${id}/modify`, method: "POST", body }, connId) });
      if (error) {
        updateEmailInCache?.(id, { is_starred: !newStarred });
        toast({ title: "Erro ao atualizar", variant: "destructive" });
      }
      return;
    }
    if (!isConnected) setLocalEmails(prev => prev.map(e => e.id === id ? { ...e, starred: !e.starred } : e));
  }, [gmailConnected, isConnected, emails, invoke, setLocalEmails, updateEmailInCache, getConnectionId, buildProxyBody]);

  const fetchFullBody = useCallback(async (msgId: string) => {
    if (fullBodyCache[msgId] || !gmailConnected) return;
    setLoadingBody(true);
    const connId = getConnectionId(msgId);
    try {
      const { data, error } = await invoke<any>({ fn: "composio-proxy", body: buildProxyBody({ service: "gmail", path: `/gmail/v1/users/me/messages/${msgId}`, method: "GET", params: { format: "full" } }, connId) });
      const is404 = data?.error?.code === 404 || (typeof error === "string" && error.includes("404"));
      if (is404) {
        toast({ title: "Mensagem não encontrada", description: "Este e-mail pode ter sido excluído ou movido.", variant: "destructive" });
        // Remove from cache since it no longer exists
        removeEmailsFromCache?.([msgId]);
        return;
      }
      if (error || !data || data?.error) return;
      const decodeBase64Url = (str: string) => { try { return decodeURIComponent(escape(atob(str.replace(/-/g, "+").replace(/_/g, "/")))); } catch { try { return atob(str.replace(/-/g, "+").replace(/_/g, "/")); } catch { return str; } } };
      let body = "";
      
      // Recursively extract content from MIME parts, handling nested multipart
      const extractByMime = (part: GmailMessagePart, mime: string): string => {
        if (part.mimeType === mime && part.body?.data) return decodeBase64Url(part.body.data);
        if (part.parts) {
          // Prefer multipart/alternative for finding html vs text
          for (const p of part.parts) {
            const result = extractByMime(p, mime);
            if (result) return result;
          }
        }
        return "";
      };
      
      // Prefer HTML body for richer rendering
      let htmlBody = "";
      if (data.payload?.mimeType === "text/html" && data.payload?.body?.data) {
        htmlBody = decodeBase64Url(data.payload.body.data);
      } else {
        htmlBody = extractByMime(data.payload, "text/html");
      }
      
      if (htmlBody) {
        body = htmlBody;
      } else if (data.payload?.mimeType === "text/plain" && data.payload?.body?.data) {
        body = decodeBase64Url(data.payload.body.data);
      } else {
        body = extractByMime(data.payload, "text/plain");
      }
      
      if (body) {
        setFullBodyCache(prev => {
          const keys = Object.keys(prev);
          if (keys.length >= MAX_BODY_CACHE_SIZE) { const nc = { ...prev }; keys.slice(0, keys.length - MAX_BODY_CACHE_SIZE + 1).forEach(k => delete nc[k]); return { ...nc, [msgId]: body }; }
          return { ...prev, [msgId]: body };
        });
      }

      // Mark as read optimistically when opening
      const email = emails.find(e => e.id === msgId);
      if (email?.unread) {
        updateEmailInCache?.(msgId, { is_unread: false });
        invoke<any>({ fn: "composio-proxy", body: buildProxyBody({ service: "gmail", path: `/gmail/v1/users/me/messages/${msgId}/modify`, method: "POST", body: { removeLabelIds: ["UNREAD"] } }, connId) });
      }
    } finally { setLoadingBody(false); }
  }, [gmailConnected, fullBodyCache, invoke, emails, updateEmailInCache, removeEmailsFromCache, getConnectionId, buildProxyBody]);

  const handleDelete = useCallback(async (emailId: string) => {
    const email = emails.find(e => e.id === emailId);
    const ok = await confirm({ title: "Excluir e-mail?", description: `"${email?.subject || 'E-mail'}" será movido para a lixeira.`, confirmLabel: "Excluir" });
    if (!ok) return;
    const connId = getConnectionId(emailId);
    if (gmailConnected) {
      // Optimistic: move to trash folder (removes from current view, appears in trash)
      updateEmailInCache?.(emailId, { folder: "trash" });
      try {
        await invoke<any>({ fn: "composio-proxy", body: buildProxyBody({ service: "gmail", path: `/gmail/v1/users/me/messages/${emailId}/trash`, method: "POST" }, connId) });
        toast({ title: "E-mail movido para a lixeira" });
      } catch (err: any) {
        // Revert on failure
        updateEmailInCache?.(emailId, { folder: email?.folder || "inbox" });
        toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
      }
    } else if (isConnected) { const result = await removeEmail(emailId); if (result) { toast({ title: "E-mail excluído" }); refetch(); } }
    else { setLocalEmails(prev => prev.map(e => e.id === emailId ? { ...e, folder: "trash" as const } : e)); toast({ title: "Movido para a lixeira" }); }
  }, [emails, gmailConnected, isConnected, invoke, removeEmail, refetch, setLocalEmails, confirm, updateEmailInCache, getConnectionId, buildProxyBody]);

  const handleArchive = useCallback(async (emailId: string) => {
    const connId = getConnectionId(emailId);
    if (gmailConnected) {
      // Optimistic: update folder to archive (removes from inbox view)
      updateEmailInCache?.(emailId, { folder: "archive" });
      try {
        await invoke<any>({ fn: "composio-proxy", body: buildProxyBody({ service: "gmail", path: `/gmail/v1/users/me/messages/${emailId}/modify`, method: "POST", body: { removeLabelIds: ["INBOX"] } }, connId) });
        toast({ title: "E-mail arquivado" });
      } catch (err: any) {
        // Revert on failure
        updateEmailInCache?.(emailId, { folder: "inbox" });
        toast({ title: "Erro ao arquivar", description: err.message, variant: "destructive" });
      }
    } else if (isConnected) { const result = await updateEmail(emailId, { archived: true }); if (result) { toast({ title: "E-mail arquivado" }); refetch(); } }
    else { setLocalEmails(prev => prev.filter(e => e.id !== emailId)); toast({ title: "E-mail arquivado (demo)" }); }
  }, [gmailConnected, isConnected, invoke, updateEmail, refetch, setLocalEmails, updateEmailInCache, getConnectionId, buildProxyBody]);

  const moveToLabel = useCallback(async (emailId: string, labelId: string, labelName: string) => {
    if (!gmailConnected) return;
    const connId = getConnectionId(emailId);
    const email = emails.find(e => e.id === emailId);
    // Optimistic: update labels and remove from inbox view
    updateEmailInCache?.(emailId, { folder: "archive" });
    try {
      await invoke<any>({ fn: "composio-proxy", body: buildProxyBody({ service: "gmail", path: `/gmail/v1/users/me/messages/${emailId}/modify`, method: "POST", body: { addLabelIds: [labelId], removeLabelIds: ["INBOX"] } }, connId) });
      toast({ title: `Movido para ${labelName}` });
    } catch (err: any) {
      // Revert on failure
      updateEmailInCache?.(emailId, { folder: email?.folder || "inbox" });
      toast({ title: "Erro ao mover", description: err.message, variant: "destructive" });
    }
  }, [gmailConnected, emails, invoke, updateEmailInCache, getConnectionId, buildProxyBody]);

  /** Unified Gmail send supporting Cc/Bcc, HTML, threadId, and connectionId */
  const sendViaGmail = useCallback(async (opts: SendOptions) => {
    const { to, subject, body, cc, bcc, inReplyTo, threadId, isHtml, connectionId } = opts;
    const contentType = isHtml ? 'text/html; charset="UTF-8"' : 'text/plain; charset="UTF-8"';
    const headerLines = [
      `To: ${to}`,
      ...(cc ? [`Cc: ${cc}`] : []),
      ...(bcc ? [`Bcc: ${bcc}`] : []),
      `Subject: ${subject}`,
      `Content-Type: ${contentType}`,
      ...(inReplyTo ? [`In-Reply-To: <${inReplyTo}>`, `References: <${inReplyTo}>`] : []),
    ];
    const raw = `${headerLines.join("\r\n")}\r\n\r\n${body}`;
    const encoded = btoa(unescape(encodeURIComponent(raw))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const sendBody: Record<string, unknown> = { raw: encoded };
    if (threadId) sendBody.threadId = threadId;
    const proxyBody: Record<string, unknown> = { service: "gmail", path: "/gmail/v1/users/me/messages/send", method: "POST", body: sendBody, workspace_id: composioWsId };
    if (connectionId) proxyBody.connectionId = connectionId;
    const { data, error } = await invoke<any>({ fn: "composio-proxy", body: proxyBody });
    if (error) throw new Error(typeof error === "string" ? error : JSON.stringify(error));
    return data;
  }, [invoke, composioWsId]);

  const handleSaveDraft = useCallback(async (composeTo: string, composeSubject: string, composeBody: string, composeCc?: string, composeBcc?: string) => {
    if (!gmailConnected || !composeBody.trim()) return;
    setGmailSending(true);
    try {
      const isHtml = /<[a-z][\s\S]*>/i.test(composeBody);
      const contentType = isHtml ? 'text/html; charset="UTF-8"' : 'text/plain; charset="UTF-8"';
      const hdrs = [
        ...(composeTo.trim() ? [`To: ${composeTo.trim()}`] : []),
        ...(composeCc?.trim() ? [`Cc: ${composeCc.trim()}`] : []),
        ...(composeBcc?.trim() ? [`Bcc: ${composeBcc.trim()}`] : []),
        `Subject: ${composeSubject.trim() || "(Sem assunto)"}`,
        `Content-Type: ${contentType}`,
      ].join("\r\n");
      const encoded = btoa(unescape(encodeURIComponent(`${hdrs}\r\n\r\n${composeBody}`))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const proxyBody: Record<string, unknown> = { service: "gmail", path: "/gmail/v1/users/me/drafts", method: "POST", body: { message: { raw: encoded } }, workspace_id: composioWsId };
      if (activeConnectionId) proxyBody.connectionId = activeConnectionId;
      await invoke<any>({ fn: "composio-proxy", body: proxyBody });
      toast({ title: "Rascunho salvo!" });
      return true;
    } catch (err: any) { toast({ title: "Erro ao salvar rascunho", description: err.message, variant: "destructive" }); return false; }
    finally { setGmailSending(false); }
  }, [gmailConnected, invoke, activeConnectionId]);

  const handleSendCompose = useCallback(async (composeTo: string, composeSubject: string, composeBody: string, composeCc?: string, composeBcc?: string) => {
    if (!composeTo.trim() || !composeBody.trim()) { toast({ title: "Preencha os campos", variant: "destructive" }); return false; }
    if (gmailConnected) {
      setGmailSending(true);
      const isHtml = /<[a-z][\s\S]*>/i.test(composeBody);
      try {
        await sendViaGmail({
          to: composeTo.trim(), subject: composeSubject.trim() || "(Sem assunto)", body: composeBody,
          cc: composeCc?.trim(), bcc: composeBcc?.trim(), isHtml, connectionId: activeConnectionId,
        });
        toast({ title: "E-mail enviado!" }); gmailRefetch(); return true;
      } catch (err: any) { toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" }); return false; }
      finally { setGmailSending(false); }
    } else if (isConnected) {
      const result = await sendEmail({ to: [{ email: composeTo.trim() }], subject: composeSubject.trim() || "(Sem assunto)", body: composeBody, message: composeBody });
      if (result) { toast({ title: "E-mail enviado!" }); refetch(); return true; }
    } else { toast({ title: "E-mail enviado! (demo)" }); return true; }
    return false;
  }, [gmailConnected, isConnected, sendViaGmail, gmailRefetch, sendEmail, refetch, activeConnectionId]);

  const handleSendReply = useCallback(async (selectedEmail: EmailItem, replyBody: string) => {
    if (!replyBody.trim() || !selectedEmail) return false;
    if (gmailConnected) {
      setGmailSending(true);
      try {
        await sendViaGmail({
          to: selectedEmail.email,
          subject: `Re: ${selectedEmail.subject}`,
          body: replyBody,
          inReplyTo: selectedEmail.id,
          threadId: (selectedEmail as any).threadId || undefined,
          connectionId: (selectedEmail as any).connectionId || activeConnectionId,
        });
        toast({ title: "Resposta enviada!" }); gmailRefetch(); return true;
      } catch (err: any) { toast({ title: "Erro ao responder", description: err.message, variant: "destructive" }); return false; }
      finally { setGmailSending(false); }
    } else if (isConnected) {
      const result = await sendEmail({ to: [{ email: selectedEmail.email }], subject: `Re: ${selectedEmail.subject}`, body: replyBody, message: replyBody });
      if (result) { toast({ title: "Resposta enviada!" }); refetch(); return true; }
    } else { toast({ title: "Resposta enviada! (demo)" }); return true; }
    return false;
  }, [gmailConnected, isConnected, sendViaGmail, gmailRefetch, sendEmail, refetch, activeConnectionId]);

  const handleSendForward = useCallback(async (selectedEmail: EmailItem, forwardTo: string, forwardNote: string) => {
    const parseEmails = (input: string) => input.split(/[,;]\s*/).map(e => e.trim()).filter(e => e.length > 0);
    const toList = parseEmails(forwardTo);
    if (toList.length === 0 || !selectedEmail) return false;
    const noteSection = forwardNote.trim() ? `${forwardNote.trim()}\n\n` : "";
    const fwdBody = `${noteSection}---------- Mensagem encaminhada ----------\nDe: ${selectedEmail.from} <${selectedEmail.email}>\nAssunto: ${selectedEmail.subject}\nData: ${selectedEmail.date}\n\n${selectedEmail.body}`;
    if (gmailConnected) {
      setGmailSending(true);
      try {
        await sendViaGmail({
          to: toList.join(", "), subject: `Fwd: ${selectedEmail.subject}`, body: fwdBody,
          connectionId: (selectedEmail as any).connectionId || activeConnectionId,
        });
        toast({ title: "E-mail encaminhado!" }); gmailRefetch(); return true;
      } catch (err: any) { toast({ title: "Erro ao encaminhar", description: err.message, variant: "destructive" }); return false; }
      finally { setGmailSending(false); }
    } else { toast({ title: "E-mail encaminhado! (demo)" }); return true; }
  }, [gmailConnected, sendViaGmail, gmailRefetch, activeConnectionId]);

  const handleQuickReply = useCallback(async (selectedEmail: EmailItem, quickReplyText: string) => {
    if (!quickReplyText.trim() || !selectedEmail) return false;
    if (gmailConnected) {
      setGmailSending(true);
      try {
        await sendViaGmail({
          to: selectedEmail.email, subject: `Re: ${selectedEmail.subject}`, body: quickReplyText,
          inReplyTo: selectedEmail.id, threadId: (selectedEmail as any).threadId || undefined,
          connectionId: (selectedEmail as any).connectionId || activeConnectionId,
        });
        toast({ title: "Resposta enviada!" }); gmailRefetch(); return true;
      } catch (err: any) { toast({ title: "Erro ao responder", description: err.message, variant: "destructive" }); return false; }
      finally { setGmailSending(false); }
    } else { toast({ title: "Resposta enviada! (demo)" }); return true; }
  }, [gmailConnected, sendViaGmail, gmailRefetch, activeConnectionId]);

  return {
    gmailSending, setGmailSending,
    fullBodyCache, loadingBody, fetchFullBody,
    toggleRead, toggleStar,
    handleDelete, handleArchive, moveToLabel,
    handleSaveDraft, handleSendCompose, handleSendReply, handleSendForward, handleQuickReply,
  };
}
