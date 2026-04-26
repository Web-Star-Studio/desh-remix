import { useState, useCallback, useMemo, useRef } from "react";
import {
  Reply, ReplyAll, Forward, Trash2, Archive, Star, Eye, EyeOff, X,
  Loader2, Sparkles, Wand2, MessageSquare, Send, FolderInput, AlarmClock,
  Tag, Save, MoreVertical, BookOpen, Clock, Paperclip, MessageCircle, MailMinus
} from "lucide-react";
import DOMPurify from "dompurify";
import { EmailItem, EmailLabel, LabelColor, LABEL_COLORS, LABEL_DOT, AI_CATEGORY_STYLES, getAvatarInfo } from "./types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { Streamdown } from "streamdown";
import type { EmailCategoryMap } from "@/hooks/email/useEmailAI";
import { useSmartCommands } from "@/hooks/ui/useSmartCommands";
import SmartCommandPopup from "@/components/ui/SmartCommandPopup";

interface EmailReaderProps {
  email: EmailItem;
  fullBody: string | null;
  loadingBody: boolean;
  gmailConnected: boolean;
  isConnected: boolean;
  isSending: boolean;
  gmailSending: boolean;
  emailCategories: EmailCategoryMap;
  // AI
  aiSummary: string | null;
  setAiSummary: (v: string | null) => void;
  aiLoading: string | null;
  aiReplyOptions: Array<{ tone: string; label: string; body: string }> | null;
  showAiReplyOptions: boolean;
  setShowAiReplyOptions: (v: boolean) => void;
  setAiReplyOptions: (v: any) => void;
  handleAiAction: (action: any, email: EmailItem) => Promise<any>;
  // Actions
  onReply: (email: EmailItem, replyAll?: boolean) => void;
  onForward: (email: EmailItem) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onToggleStar: (id: string) => void;
  onToggleRead: (id: string) => void;
  onUnsubscribe?: (email: EmailItem) => void;
  onSendReply: () => void;
  onSendForward: () => void;
  onQuickReply: () => void;
  onSaveAsTemplate: (body: string) => void;
  onSetShowTemplateMenu: (v: "reply" | "compose" | null) => void;
  onSetShowTemplateManager: (v: boolean) => void;
  // Snooze
  onSnooze?: (id: string, until: Date, email?: { subject?: string; from?: string }) => void;
  // Labels
  labels: EmailLabel[];
  gmailLabels: Array<{ id: string; gmailId: string; name: string; color: LabelColor }>;
  onMoveToLabel?: (emailId: string, labelId: string, labelName: string) => void;
  onToggleLabel?: (emailId: string, labelId: string) => void;
  resolveLabel: (lid: string) => { name: string; color: LabelColor } | null;
  // State
  showReply: boolean;
  setShowReply: (v: boolean) => void;
  replyBody: string;
  setReplyBody: (v: string) => void;
  isReplyAll: boolean;
  showForward: boolean;
  setShowForward: (v: boolean) => void;
  forwardTo: string;
  setForwardTo: (v: string) => void;
  forwardNote: string;
  setForwardNote: (v: string) => void;
  hasForwardErrors: boolean;
  quickReplyText: string;
  setQuickReplyText: (v: string) => void;
}

const SNOOZE_OPTIONS = [
  { label: "Amanhã 8h", getHours: () => { const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(8, 0, 0, 0); return (t.getTime() - Date.now()) / 3600000; } },
  { label: "Em 3 horas", getHours: () => 3 },
  { label: "Amanhã 18h", getHours: () => { const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(18, 0, 0, 0); return (t.getTime() - Date.now()) / 3600000; } },
  { label: "Segunda-feira", getHours: () => { const t = new Date(); const d = t.getDay(); const diff = d === 0 ? 1 : 8 - d; t.setDate(t.getDate() + diff); t.setHours(8, 0, 0, 0); return (t.getTime() - Date.now()) / 3600000; } },
];

/* ---------- HTML email body renderer ---------- */
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'i', 'em', 'u', 'a', 'img',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
  'table', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot', 'caption', 'colgroup', 'col',
  'div', 'span', 'hr', 'blockquote', 'pre', 'code', 'center', 'font', 'small',
  'big', 'sub', 'sup', 'section', 'article', 'header', 'footer', 'nav', 'figure', 'figcaption',
  'abbr', 'address', 'cite', 'del', 'ins', 'mark', 'q', 's', 'strike',
  'dl', 'dt', 'dd', 'details', 'summary', 'picture', 'source',
  'style', // Allow inline <style> blocks for email layout
];
const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'style', 'class', 'target',
  'width', 'height', 'align', 'valign', 'color', 'bgcolor',
  'border', 'cellpadding', 'cellspacing', 'colspan', 'rowspan',
  'role', 'dir', 'lang', 'title', 'id', 'name',
  'background', 'face', 'size', 'type', 'media',
];

function linkifyText(text: string): string {
  return text.replace(
    /(https?:\/\/[^\s<>"']+)/gi,
    (url) => {
      let display: string;
      try {
        const u = new URL(url);
        const path = u.pathname.length > 20 ? u.pathname.slice(0, 20) + '…' : u.pathname;
        display = u.hostname + (path !== '/' ? path : '');
      } catch {
        display = url.length > 45 ? url.slice(0, 42) + '…' : url;
      }
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${display}</a>`;
    }
  );
}

/**
 * Pre-process raw email HTML before sanitization:
 * - Fix broken image references
 * - Remove tracking pixels
 * - Scope <style> blocks
 * - Normalize encoding issues
 */
function preprocessEmailHtml(html: string): string {
  let result = html;

  // Remove <head>...</head> content (but keep <style> from it, re-injected below)
  const styleBlocks: string[] = [];
  result.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match) => {
    styleBlocks.push(match);
    return '';
  });
  result = result.replace(/<head[\s\S]*?<\/head>/gi, '');
  // Re-inject style blocks at beginning
  if (styleBlocks.length) {
    result = styleBlocks.join('\n') + result;
  }

  // Strip <html>, <body>, <meta>, <title>, <link>, <script> wrapper tags
  result = result.replace(/<\/?(html|body|meta|title|link|script|!doctype)[^>]*>/gi, '');

  // Remove tracking pixels (1x1 images, hidden images)
  result = result.replace(/<img[^>]*(?:width\s*=\s*["']?1["']?\s+height\s*=\s*["']?1["']?|height\s*=\s*["']?1["']?\s+width\s*=\s*["']?1["']?)[^>]*>/gi, '');
  result = result.replace(/<img[^>]*style\s*=\s*["'][^"']*display\s*:\s*none[^"']*["'][^>]*>/gi, '');

  // Remove cid: references (embedded images we can't display) — replace with placeholder
  result = result.replace(/<img([^>]*?)src\s*=\s*["']cid:[^"']*["']([^>]*?)>/gi,
    '<img$1src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'150\' fill=\'%23888\'%3E%3Crect width=\'200\' height=\'150\' fill=\'%23f0f0f0\' rx=\'8\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' font-size=\'12\' fill=\'%23999\'%3EImagem incorporada%3C/text%3E%3C/svg%3E" alt="Imagem incorporada"$2>');

  // Decode common HTML entities that appear as raw text
  result = result.replace(/&#(\d+);/g, (_, code) => {
    const num = parseInt(code, 10);
    return num > 0 && num < 65536 ? String.fromCharCode(num) : '';
  });
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    const num = parseInt(hex, 16);
    return num > 0 && num < 65536 ? String.fromCharCode(num) : '';
  });

  return result;
}

/**
 * Scope email CSS styles to prevent leaking into the app.
 * Prefixes all selectors in <style> blocks with .email-html-content
 */
function scopeEmailStyles(html: string): string {
  return html.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, css: string) => {
    // Remove @import, @charset, @font-face to avoid loading external resources
    let scoped = css
      .replace(/@import\b[^;]+;/gi, '')
      .replace(/@charset\b[^;]+;/gi, '')
      .replace(/@font-face\s*\{[^}]*\}/gi, '');

    // Scope each CSS rule
    scoped = scoped.replace(
      /([^{}@]+)\{/g,
      (match, selectors: string) => {
        // Don't scope @media queries
        if (selectors.trim().startsWith('@')) return match;
        const scopedSelectors = selectors
          .split(',')
          .map((s: string) => {
            const trimmed = s.trim();
            if (!trimmed || trimmed.startsWith('@')) return trimmed;
            // Replace body/html selectors with our container
            if (/^(body|html)$/i.test(trimmed)) return '.email-html-content';
            return `.email-html-content ${trimmed}`;
          })
          .join(', ');
        return `${scopedSelectors} {`;
      }
    );
    return `<style>${scoped}</style>`;
  });
}

function renderEmailContent(raw: string): string {
  const content = raw || '';
  const isHtml = /<[a-z][\s\S]*>/i.test(content);

  let html: string;
  if (isHtml) {
    // Pre-process before sanitization
    const preprocessed = preprocessEmailHtml(content);

    html = DOMPurify.sanitize(preprocessed, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ['target'],
      WHOLE_DOCUMENT: false,
      RETURN_DOM: false,
      // Allow style tag content
      FORCE_BODY: true,
    });

    // Scope CSS styles to our container
    html = scopeEmailStyles(html);

    // Force all images to have loading=lazy and referrerpolicy
    html = html.replace(/<img /gi, '<img loading="lazy" referrerpolicy="no-referrer" ');

    // Force all links to open in new tab
    html = html.replace(/<a(?![^>]*target=)/gi, '<a target="_blank" rel="noopener noreferrer" ');

    // Linkify any raw URLs that aren't already inside an <a> tag
    html = html.replace(
      /(?<!href=["'])(?<!src=["'])(?<!<a[^>]*>)(https?:\/\/[^\s<>"']+)(?![^<]*<\/a>)/gi,
      (url) => {
        let display: string;
        try {
          const u = new URL(url);
          const path = u.pathname.length > 20 ? u.pathname.slice(0, 20) + '…' : u.pathname;
          display = u.hostname + (path !== '/' ? path : '');
        } catch {
          display = url.length > 45 ? url.slice(0, 42) + '…' : url;
        }
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${display}</a>`;
      }
    );
  } else {
    const linkified = linkifyText(content);
    html = DOMPurify.sanitize(linkified.replace(/\n/g, '<br>'), {
      ALLOWED_TAGS: ['br', 'a'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
  }

  return html;
}

const EmailBodyContent = ({ content }: { content: string }) => {
  const sanitized = useMemo(() => renderEmailContent(content), [content]);
  return (
    <div
      className="email-html-content text-sm leading-relaxed overflow-x-auto bg-card text-card-foreground rounded-lg p-4"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
};

/** Estimate reading time from email body text */
function estimateReadingTime(body: string | null): { minutes: number; wordCount: number } {
  if (!body) return { minutes: 0, wordCount: 0 };
  const text = body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return { minutes: Math.max(1, Math.ceil(wordCount / 220)), wordCount };
}

/** Format relative time like "há 2h" or "há 3 dias" */
function formatRelativeDate(dateStr: string): string {
  if (!dateStr) return "";
  const now = Date.now();
  // Try parsing common formats
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const diff = now - d.getTime();
  if (diff < 60_000) return "agora";
  if (diff < 3600_000) return `há ${Math.floor(diff / 60_000)}min`;
  if (diff < 86400_000) return `há ${Math.floor(diff / 3600_000)}h`;
  if (diff < 604800_000) return `há ${Math.floor(diff / 86400_000)}d`;
  return dateStr;
}

const EmailReader = ({
  email, fullBody, loadingBody, gmailConnected, isConnected, isSending, gmailSending,
  emailCategories, aiSummary, setAiSummary, aiLoading, aiReplyOptions, showAiReplyOptions,
  setShowAiReplyOptions, setAiReplyOptions, handleAiAction,
  onReply, onForward, onDelete, onArchive, onToggleStar, onToggleRead, onUnsubscribe,
  onSendReply, onSendForward, onQuickReply, onSaveAsTemplate,
  onSetShowTemplateMenu, onSetShowTemplateManager,
  onSnooze, labels, gmailLabels, onMoveToLabel, onToggleLabel, resolveLabel,
  showReply, setShowReply, replyBody, setReplyBody, isReplyAll,
  showForward, setShowForward, forwardTo, setForwardTo, forwardNote, setForwardNote, hasForwardErrors,
  quickReplyText, setQuickReplyText,
}: EmailReaderProps) => {
  const [quickReplyFocused, setQuickReplyFocused] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [showMoveToLabel, setShowMoveToLabel] = useState<string | null>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const quickReplyRef = useRef<HTMLTextAreaElement>(null);

  const readingInfo = useMemo(() => estimateReadingTime(fullBody || email.body), [fullBody, email.body]);

  const replySmartCommands = useSmartCommands({
    inputRef: replyTextareaRef,
    value: replyBody,
    onChange: setReplyBody,
    enabledTriggers: ["@", "/"],
    context: "email",
  });

  const quickReplySmartCommands = useSmartCommands({
    inputRef: quickReplyRef,
    value: quickReplyText,
    onChange: setQuickReplyText,
    enabledTriggers: ["@"],
    context: "email",
  });

  const { initials, color } = getAvatarInfo(email.from, email.email);
  const cat = emailCategories[email.id];
  const catStyle = cat ? AI_CATEGORY_STYLES[cat.category] || AI_CATEGORY_STYLES.outro : null;

  return (
    <motion.div key={email.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground mb-3 leading-snug">{email.subject}</h2>
        <div className="flex items-start gap-3 mb-3">
          <div className={`flex-shrink-0 w-10 h-10 rounded-full ${color} flex items-center justify-center text-white text-sm font-bold shadow-md`}>{initials}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">{email.from}</span>
              {cat && catStyle && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${catStyle.badge}`}>
                  {cat.priority === "alta" && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-90" />}
                  {catStyle.label}{cat.requires_action && <span className="ml-0.5">⚡</span>}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{email.email}</p>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <p className="text-xs text-muted-foreground/70">{email.date}</p>
              {readingInfo.minutes > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/50 bg-foreground/5 px-1.5 py-0.5 rounded-full">
                  <Clock className="w-2.5 h-2.5" /> {readingInfo.minutes} min de leitura
                </span>
              )}
              {readingInfo.wordCount > 0 && (
                <span className="text-[10px] text-muted-foreground/40">{readingInfo.wordCount.toLocaleString("pt-BR")} palavras</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0 overflow-x-auto">
            <TooltipProvider delayDuration={300}>
              <Tooltip><TooltipTrigger asChild>
                <button onClick={() => onReply(email)} className="shrink-0 p-2 sm:p-1.5 rounded-lg hover:bg-foreground/8 text-muted-foreground hover:text-primary transition-colors"><Reply className="w-4 h-4" /></button>
              </TooltipTrigger><TooltipContent side="bottom"><p className="text-xs">Responder</p></TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <button onClick={() => onReply(email, true)} className="shrink-0 p-2 sm:p-1.5 rounded-lg hover:bg-foreground/8 text-muted-foreground hover:text-primary transition-colors hidden sm:flex"><ReplyAll className="w-4 h-4" /></button>
              </TooltipTrigger><TooltipContent side="bottom"><p className="text-xs">Responder a todos</p></TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <button onClick={() => onForward(email)} className="shrink-0 p-2 sm:p-1.5 rounded-lg hover:bg-foreground/8 text-muted-foreground hover:text-primary transition-colors"><Forward className="w-4 h-4" /></button>
              </TooltipTrigger><TooltipContent side="bottom"><p className="text-xs">Encaminhar</p></TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <button onClick={() => onToggleStar(email.id)} className={`shrink-0 p-2 sm:p-1.5 rounded-lg hover:bg-foreground/8 transition-colors ${email.starred ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-500"}`}>
                  <Star className={`w-4 h-4 ${email.starred ? "fill-yellow-500" : ""}`} />
                </button>
              </TooltipTrigger><TooltipContent side="bottom"><p className="text-xs">Favoritar</p></TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <button onClick={() => onToggleRead(email.id)} className="shrink-0 p-2 sm:p-1.5 rounded-lg hover:bg-foreground/8 text-muted-foreground hover:text-primary transition-colors hidden sm:flex">
                  {email.unread ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </TooltipTrigger><TooltipContent side="bottom"><p className="text-xs">{email.unread ? "Marcar como lido" : "Marcar como não lido"}</p></TooltipContent></Tooltip>
            </TooltipProvider>

            {/* More actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 rounded-lg hover:bg-foreground/8 text-muted-foreground hover:text-foreground transition-colors"><MoreVertical className="w-4 h-4" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => handleAiAction("summarize", email)} disabled={aiLoading !== null}>
                  <Sparkles className="w-4 h-4 mr-2" /> Resumir com IA
                  {aiLoading === "summarize" && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSetShowTemplateMenu("reply")}><BookOpen className="w-4 h-4 mr-2" /> Templates</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSetShowTemplateManager(true)}><Tag className="w-4 h-4 mr-2" /> Gerenciar Templates</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onArchive(email.id)}><Archive className="w-4 h-4 mr-2" /> Arquivar</DropdownMenuItem>
                {onSnooze && gmailConnected && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <AlarmClock className="w-4 h-4 mr-2" /> Adiar
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {SNOOZE_OPTIONS.map(opt => (
                        <DropdownMenuItem key={opt.label} onClick={() => {
                          const until = new Date(Date.now() + opt.getHours() * 3600000);
                          onSnooze(email.id, until, { subject: email.subject, from: email.from });
                        }}>
                          <Clock className="w-3.5 h-3.5 mr-2" /> {opt.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
                {gmailConnected && gmailLabels.length > 0 && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <FolderInput className="w-4 h-4 mr-2" /> Mover para
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {gmailLabels.map(gl => (
                        <DropdownMenuItem key={gl.id} onClick={() => onMoveToLabel?.(email.id, gl.gmailId, gl.name)}>
                          <div className={`w-2 h-2 rounded-full ${LABEL_DOT[gl.color]} mr-2`} /> {gl.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
                {onUnsubscribe && gmailConnected && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onUnsubscribe(email)} className="text-destructive">
                      <MailMinus className="w-4 h-4 mr-2" /> Descadastrar
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete(email.id)} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="border-b border-foreground/8" />
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/10">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs uppercase tracking-wider text-primary font-medium">Resumo IA</span>
            <button onClick={() => setAiSummary(null)} className="ml-auto text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
          </div>
          <div className="text-sm"><Streamdown>{aiSummary}</Streamdown></div>
        </div>
      )}

      {/* Attachments indicator */}
      {email.hasAttachment && (
        <div className="mb-4 p-3 rounded-lg bg-foreground/5 border border-foreground/10">
          <div className="flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground/70">Este e-mail contém anexo(s)</span>
          </div>
        </div>
      )}

      {/* Thread indicator */}
      {(email as any).threadId && (
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <MessageCircle className="w-3.5 h-3.5" />
          <span>Parte de uma conversa</span>
        </div>
      )}

      {/* Body */}
      <div className="border-t border-foreground/5 pt-4">
        {loadingBody && gmailConnected && !fullBody ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4"><Loader2 className="w-4 h-4 animate-spin" /> Carregando conteúdo completo...</div>
        ) : (
          <EmailBodyContent content={fullBody || email.body} />
        )}
      </div>

      {/* Reply */}
      {showReply && (
        <div className="mt-4 pt-4 border-t border-foreground/5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">
              {isReplyAll ? <span className="flex items-center gap-1"><ReplyAll className="w-3 h-3 inline" /> Responder a todos — {email.from}</span> : <>Responder para {email.from}</>}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => handleAiAction("suggest_reply", email)} disabled={aiLoading !== null}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50">
                {aiLoading === "suggest" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />} Sugerir
              </button>
              <button onClick={async () => { await handleAiAction("suggest_replies_multiple", email); }} disabled={aiLoading !== null}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50">
                {aiLoading === "suggest" ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageSquare className="w-3 h-3" />} 3 opções
              </button>
            </div>
          </div>
          {showAiReplyOptions && aiReplyOptions && aiReplyOptions.length > 0 && (
            <div className="mb-3 p-2.5 bg-primary/5 border border-primary/10 rounded-lg">
              <div className="flex items-center gap-1.5 mb-2">
                <MessageSquare className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs uppercase tracking-wider text-primary font-medium">Escolha o tom</span>
                <button onClick={() => { setShowAiReplyOptions(false); setAiReplyOptions(null); }} className="ml-auto text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {aiReplyOptions.map((opt, i) => (
                  <button key={i} onClick={() => { setReplyBody(opt.body); setShowAiReplyOptions(false); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-background/50 border border-foreground/10 hover:border-primary/40 hover:bg-primary/5 transition-all text-xs">
                    <span className="font-medium text-foreground">{opt.label || opt.tone}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="relative">
            <textarea ref={replyTextareaRef} value={replyBody} onChange={e => replySmartCommands.handleChange(e.target.value, e.target.selectionStart)} onKeyDown={replySmartCommands.handleKeyDown} placeholder="Escreva sua resposta... (@ menções, / comandos)"
              rows={4} className="w-full bg-foreground/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none mb-2" autoFocus />
            <SmartCommandPopup open={replySmartCommands.popup.open} items={replySmartCommands.popup.items} selectedIndex={replySmartCommands.popup.selectedIndex} trigger={replySmartCommands.popup.trigger} position={replySmartCommands.popup.position} onSelect={replySmartCommands.selectItem} onClose={replySmartCommands.closePopup} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => onSaveAsTemplate(replyBody)} disabled={!replyBody.trim()}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors disabled:opacity-40">
              <Save className="w-3 h-3" /> Salvar como template
            </button>
            <div className="flex gap-2">
              <button onClick={() => setShowReply(false)} className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
              <button onClick={onSendReply} disabled={isSending || gmailSending}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                {isSending || gmailSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forward */}
      {showForward && (
        <div className="mt-4 pt-4 border-t border-foreground/5">
          <p className="text-xs text-muted-foreground mb-2">Encaminhar e-mail</p>
          <input value={forwardTo} onChange={e => setForwardTo(e.target.value)} placeholder="Para: email@ex.com"
            className={`w-full bg-foreground/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none mb-2 ${hasForwardErrors ? "ring-1 ring-destructive/60" : ""}`} autoFocus />
          <textarea value={forwardNote} onChange={e => { if (e.target.value.length <= 500) setForwardNote(e.target.value); }}
            placeholder="Nota pessoal (opcional)..." rows={2} maxLength={500}
            className="w-full bg-foreground/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none mb-2" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForward(false)} className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
            <button onClick={onSendForward} disabled={isSending || !forwardTo.trim() || hasForwardErrors}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Forward className="w-3.5 h-3.5" />} Encaminhar
            </button>
          </div>
        </div>
      )}

      {/* Quick Reply */}
      {!showReply && !showForward && (
        <div className="mt-4 pt-3 border-t border-foreground/5">
          <div className="flex items-end gap-2">
            <textarea ref={quickReplyRef} value={quickReplyText} onChange={e => quickReplySmartCommands.handleChange(e.target.value, e.target.selectionStart)}
              onFocus={() => setQuickReplyFocused(true)}
              onKeyDown={e => { quickReplySmartCommands.handleKeyDown(e); if (!quickReplySmartCommands.popup.open && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onQuickReply(); } }}
              placeholder="Resposta rápida... (@ menções)" rows={quickReplyFocused ? 3 : 1}
              className="flex-1 bg-foreground/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none transition-all" />
            <SmartCommandPopup open={quickReplySmartCommands.popup.open} items={quickReplySmartCommands.popup.items} selectedIndex={quickReplySmartCommands.popup.selectedIndex} trigger={quickReplySmartCommands.popup.trigger} position={quickReplySmartCommands.popup.position} onSelect={quickReplySmartCommands.selectItem} onClose={quickReplySmartCommands.closePopup} />
            <button onClick={onQuickReply} disabled={!quickReplyText.trim() || gmailSending}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {gmailSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Enviar
            </button>
          </div>
        </div>
      )}

      {/* Bottom actions */}
      {!showReply && !showForward && (
        <div className="mt-3 flex items-center gap-2 sm:gap-3 overflow-x-auto">
          <button onClick={() => onReply(email)} className="shrink-0 flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 min-h-[44px] md:min-h-0"><Reply className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Responder</span></button>
          <button onClick={() => onReply(email, true)} className="shrink-0 flex items-center gap-1.5 text-sm text-primary/70 hover:text-primary min-h-[44px] md:min-h-0"><ReplyAll className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Todos</span></button>
          <button onClick={() => onForward(email)} className="shrink-0 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground min-h-[44px] md:min-h-0"><Forward className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Encaminhar</span></button>
        </div>
      )}

      {/* Keyboard shortcuts — hidden on mobile/touch */}
      {!showReply && !showForward && (
        <div className="mt-4 pt-3 border-t border-foreground/5 hidden md:flex flex-wrap items-center gap-x-4 gap-y-1">
          {[
            { key: "R", label: "Responder" }, { key: "F", label: "Encaminhar" },
            { key: "S", label: "Favoritar" }, { key: "U", label: "Marcar lido" },
            { key: "Q", label: "Descadastrar" }, { key: "Del", label: "Excluir" }, { key: "Esc", label: "Fechar" },
          ].map(s => (
            <span key={s.key} className="text-xs text-muted-foreground/50">
              <kbd className="bg-foreground/5 rounded px-1 py-0.5 text-xs font-mono">{s.key}</kbd> {s.label}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default EmailReader;
