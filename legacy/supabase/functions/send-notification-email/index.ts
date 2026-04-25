/**
 * @function send-notification-email
 * @description Envia e-mails de notificação via Resend — design sofisticado com dark mode
 * @status active
 * @calledBy DB triggers, automation rules
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { Resend } from "npm:resend@4.0.0";
import { corsHeaders } from "../_shared/utils.ts";

const RATE_LIMIT_HOURS = 4;

// ─── Design tokens ──────────────────────────────────────────────────────────
const PRIMARY = "#C8956C";
const PRIMARY_LIGHT = "rgba(200, 149, 108, 0.12)";
const DARK = "#1A1A1A";
const BODY_TEXT = "#333333";
const MUTED = "#555555";
const LIGHT_MUTED = "#777777";
const CARD_BG = "#FAFAFA";
const CARD_BORDER = "#EBEBEB";
const DIVIDER = "#EBEBEB";
const FONT = "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const MONO_FONT = "'JetBrains Mono', 'Fira Code', Courier, monospace";
const LOGO_URL = "https://fzidukdcyqsqajoebdfe.supabase.co/storage/v1/object/public/email-assets/desh-logo-email.png";
const APP_URL = "https://desh-ws.lovable.app";

// Dark mode tokens
const DK_BG = "#111111";
const DK_CARD = "#1C1C1E";
const DK_CARD_BORDER = "#2C2C2E";
const DK_TEXT = "#F5F5F7";
const DK_MUTED = "#A1A1A6";
const DK_DIVIDER = "#2C2C2E";

type EmailType =
  | "task_reminder" | "event_reminder" | "daily_summary" | "broadcast"
  | "weekly_report" | "credit_low" | "credit_purchase" | "new_connection"
  | "inactivity_reminder" | "welcome" | "security_alert" | "security_otp"
  | "account_archived" | "account_deletion_warning";

interface EmailPayload {
  type: EmailType;
  user_id?: string;
  data: Record<string, any>;
}

const prefKeyMap: Record<EmailType, string> = {
  task_reminder: "email_task_reminders",
  event_reminder: "email_event_reminders",
  daily_summary: "email_daily_summary",
  broadcast: "email_broadcasts",
  weekly_report: "email_weekly_report",
  credit_low: "email_credit_alerts",
  credit_purchase: "email_credit_alerts",
  new_connection: "email_credit_alerts",
  inactivity_reminder: "email_inactivity",
  welcome: "email_welcome",
  security_alert: "email_security_alerts",
  security_otp: "email_security_alerts",
  account_archived: "email_security_alerts",
  account_deletion_warning: "email_security_alerts",
};

function getPreferenceKey(type: EmailType): string {
  return prefKeyMap[type] || "email_broadcasts";
}

function isOtpSecurityEmail(type: EmailType): boolean {
  return type === "security_otp";
}

function replaceVars(template: string, vars: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

// ─── SVG Icons (inline data URIs, 20x20, monochrome stroke) ─────────────────
function svgIcon(name: string, color = PRIMARY, size = 20): string {
  const icons: Record<string, string> = {
    check: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    clock: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    alert: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    chart: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    star: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    trending: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
    zap: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    list: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
    target: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
    arrowUp: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`,
    arrowDown: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`,
    mapPin: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
    video: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
    inbox: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
    link: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  };
  const svg = icons[name] || icons.star;
  const encoded = btoa(svg);
  return `<img src="data:image/svg+xml;base64,${encoded}" width="${size}" height="${size}" alt="" style="display:inline-block;vertical-align:middle;" />`;
}

// ─── CTA Button ─────────────────────────────────────────────────────────────
function ctaButton(text: string, href: string, bgColor = PRIMARY): string {
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0 8px;">
    <tr><td align="center">
      <a href="${href}" target="_blank" class="cta-btn" style="display:inline-block;padding:14px 36px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;background-color:${bgColor};border-radius:14px;box-shadow:0 2px 8px ${bgColor}4D;">${text}</a>
    </td></tr>
  </table>`;
}

// ─── Stat card (with SVG icon) ──────────────────────────────────────────────
function statCard(value: string | number, label: string, iconName: string, accentColor = PRIMARY): string {
  return `<td class="stat-card" style="background-color:#ffffff;padding:20px 16px;border-radius:14px;text-align:center;border:1px solid ${CARD_BORDER};">
    <div style="margin:0 0 8px;text-align:center;">${svgIcon(iconName, accentColor, 22)}</div>
    <p style="margin:0 0 4px;font-size:28px;font-weight:700;color:${accentColor};font-family:${FONT};letter-spacing:-0.5px;">${value}</p>
    <p style="margin:0;font-size:11px;color:${MUTED};font-family:${FONT};text-transform:uppercase;letter-spacing:0.8px;font-weight:500;">${label}</p>
  </td>`;
}

// ─── Info card ──────────────────────────────────────────────────────────────
function infoCard(content: string, borderColor = PRIMARY): string {
  return `<div class="info-card" style="background-color:#ffffff;padding:20px 24px;border-radius:14px;border:1px solid ${CARD_BORDER};border-left:4px solid ${borderColor};">${content}</div>`;
}

// ─── Alert box ──────────────────────────────────────────────────────────────
function alertBox(content: string, bg: string, border: string, textColor: string): string {
  return `<div style="background-color:${bg};padding:14px 18px;border-radius:12px;border:1px solid ${border};margin-top:16px;">
    <p style="margin:0;font-size:13px;color:${textColor};font-family:${FONT};line-height:1.5;">${content}</p>
  </div>`;
}

// ─── Section header ─────────────────────────────────────────────────────────
function sectionHeader(iconName: string, title: string, color = DARK): string {
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0 12px;">
    <tr>
      <td width="28" style="vertical-align:middle;">${svgIcon(iconName, color, 18)}</td>
      <td style="vertical-align:middle;padding-left:8px;">
        <p class="section-title" style="margin:0;font-size:13px;font-weight:600;color:${color};font-family:${FONT};text-transform:uppercase;letter-spacing:1px;">${title}</p>
      </td>
      <td style="vertical-align:middle;">
        <div style="height:1px;background-color:${DIVIDER};margin-left:12px;"></div>
      </td>
    </tr>
  </table>`;
}

// ─── Progress bar ───────────────────────────────────────────────────────────
function progressBar(pct: number, color = PRIMARY, bgColor = CARD_BORDER, label?: string): string {
  const safePct = Math.min(100, Math.max(0, pct));
  return `<div style="margin:8px 0 4px;">
    ${label ? `<p style="margin:0 0 6px;font-size:11px;color:${MUTED};font-family:${FONT};text-transform:uppercase;letter-spacing:1px;">${label}</p>` : ""}
    <div class="progress-bg" style="background-color:${bgColor};border-radius:8px;height:8px;overflow:hidden;">
      <div style="background-color:${color};height:8px;border-radius:8px;width:${safePct}%;transition:width 0.3s;"></div>
    </div>
  </div>`;
}

// ─── Urgency badge ──────────────────────────────────────────────────────────
function urgencyBadge(minutes: number): string {
  let bg: string, border: string, textColor: string, label: string;
  if (minutes <= 15) {
    bg = "#FEF2F2"; border = "#FECACA"; textColor = "#DC2626"; label = "Urgente";
  } else if (minutes <= 30) {
    bg = "#FFF7ED"; border = "#FED7AA"; textColor = "#EA580C"; label = "Em breve";
  } else {
    bg = "#FEF9C3"; border = "#FDE68A"; textColor = "#CA8A04"; label = "Próximo";
  }
  return `<span style="display:inline-block;padding:4px 14px;background-color:${bg};color:${textColor};font-size:11px;font-weight:600;border-radius:20px;font-family:${FONT};border:1px solid ${border};">${svgIcon("clock", textColor, 12)} ${label}</span>`;
}

// ─── Email layout (with dark mode + responsive) ─────────────────────────────
function emailLayout(title: string, body: string, settingsUrl: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR" dir="ltr" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root { color-scheme: light dark; supported-color-schemes: light dark; }

    @media (prefers-color-scheme: dark) {
      .email-body { background-color: ${DK_BG} !important; }
      .email-outer-table { background-color: ${DK_BG} !important; }
      .email-card { background-color: ${DK_CARD} !important; border-color: ${DK_CARD_BORDER} !important; }
      .email-title, .email-heading { color: ${DK_TEXT} !important; }
      .email-text { color: #D1D1D6 !important; }
      .email-muted { color: ${DK_MUTED} !important; }
      .email-divider { background-color: ${DK_DIVIDER} !important; }
      .stat-card { background-color: ${DK_CARD} !important; border-color: ${DK_CARD_BORDER} !important; }
      .info-card { background-color: ${DK_CARD} !important; border-color: ${DK_CARD_BORDER} !important; }
      .task-item { background-color: #252528 !important; border-color: ${DK_CARD_BORDER} !important; }
      .event-item { background-color: #252528 !important; border-color: ${DK_CARD_BORDER} !important; }
      .timeline-dot { border-color: ${DK_CARD} !important; }
      .section-title { color: ${DK_MUTED} !important; }
      .progress-bg { background-color: #2C2C2E !important; }
      .footer-text { color: ${DK_MUTED} !important; }
      .cta-btn { box-shadow: 0 2px 12px rgba(0,0,0,0.4) !important; }
    }

    @media (max-width: 480px) {
      .email-card { border-radius: 12px !important; }
      .email-card-body { padding: 16px 20px 8px !important; }
      .email-card-footer { padding: 0 20px 20px !important; }
      .email-logo-cell { padding: 20px 20px 0 !important; }
      .stat-card { padding: 14px 10px !important; }
      .stat-card p:nth-child(2) { font-size: 22px !important; }
      .email-heading { font-size: 20px !important; }
    }
  </style>
</head>
<body class="email-body" style="margin:0;padding:0;background-color:#ffffff;font-family:${FONT};-webkit-font-smoothing:antialiased;">
  <table class="email-outer-table" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
        <tr><td class="email-card" style="background-color:${CARD_BG};border-radius:20px;border:1px solid ${CARD_BORDER};overflow:hidden;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td class="email-logo-cell" align="center" style="padding:28px 32px 0;">
              <img src="${LOGO_URL}" alt="DESH" width="100" height="100" style="display:block;border:0;outline:none;" />
            </td></tr>
            <tr><td class="email-card-body" style="padding:20px 32px 8px;">
              ${body}
            </td></tr>
            <tr><td style="padding:0 32px;">
              <div class="email-divider" style="height:1px;background-color:${DIVIDER};margin:24px 0;"></div>
            </td></tr>
            <tr><td class="email-card-footer" style="padding:0 32px 28px;">
              <p class="footer-text" style="margin:0 0 8px;font-size:12px;color:${MUTED};font-family:${FONT};line-height:1.5;">
                Você recebeu porque suas notificações estão ativas.
                <a href="${settingsUrl}" style="color:${PRIMARY};text-decoration:none;font-weight:600;">Gerenciar preferências</a>
              </p>
              <p class="footer-text" style="margin:0;font-size:12px;color:${LIGHT_MUTED};font-family:${FONT};">
                <a href="https://desh.life" style="color:${PRIMARY};text-decoration:none;font-weight:600;">DESH</a> — Seu sistema operacional pessoal
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ─── Helper: format date in pt-BR ───────────────────────────────────────────
function fmtDate(d: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  try {
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toLocaleDateString("pt-BR", opts || { day: "2-digit", month: "short" });
  } catch { return "—"; }
}
function fmtTime(d: string | Date): string {
  try {
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" });
  } catch { return "--:--"; }
}

// ─── Renderers ──────────────────────────────────────────────────────────────
const renderers: Record<string, (data: Record<string, any>, settingsUrl: string) => { subject: string; html: string }> = {

  // ════════════════════════════════════════════════════════════════════════════
  // DAILY SUMMARY — Complete redesign
  // ════════════════════════════════════════════════════════════════════════════
  daily_summary: (data, settingsUrl) => {
    const hour = new Date().getUTCHours() - 3;
    const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
    const name = data.display_name || "usuário";
    const tasks = data.tasks_due || 0;
    const events = data.events_today || 0;
    const completedYesterday = data.tasks_completed_yesterday || 0;

    // Motivational message based on workload
    let motivational = "";
    if (tasks === 0 && events === 0) {
      motivational = "Dia tranquilo! Aproveite para planejar a semana ou explorar novas ideias.";
    } else if (tasks + events <= 3) {
      motivational = "Dia leve — foco total nas prioridades para terminar cedo.";
    } else if (tasks + events <= 6) {
      motivational = "Dia produtivo pela frente. Ataque as tarefas mais importantes primeiro.";
    } else {
      motivational = "Dia intenso! Divida em blocos e faça pausas entre cada um.";
    }

    // Build urgent tasks list
    const urgentTasks: Array<{title: string; due_date: string}> = data.urgent_tasks || [];
    let urgentTasksHtml = "";
    if (urgentTasks.length > 0) {
      urgentTasksHtml = sectionHeader("alert", "Tarefas urgentes", "#EA580C");
      for (const task of urgentTasks.slice(0, 5)) {
        const dueStr = task.due_date ? fmtDate(task.due_date, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
        urgentTasksHtml += `<div class="task-item" style="background-color:#ffffff;padding:14px 18px;border-radius:12px;border:1px solid ${CARD_BORDER};margin-bottom:8px;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td width="28" style="vertical-align:top;padding-top:2px;">${svgIcon("clock", "#EA580C", 16)}</td>
            <td style="vertical-align:top;padding-left:10px;">
              <p class="email-heading" style="margin:0 0 2px;font-size:14px;font-weight:600;color:${DARK};font-family:${FONT};">${task.title}</p>
              <p class="email-muted" style="margin:0;font-size:12px;color:${MUTED};font-family:${FONT};">Vence: ${dueStr}</p>
            </td>
          </tr></table>
        </div>`;
      }
    }

    // Build events timeline
    const todayEvents: Array<{title: string; start_at: string; end_at?: string}> = data.today_events || [];
    let eventsHtml = "";
    if (todayEvents.length > 0) {
      eventsHtml = sectionHeader("calendar", "Agenda de hoje", "#7C3AED");
      for (const evt of todayEvents.slice(0, 5)) {
        const startStr = evt.start_at ? fmtTime(evt.start_at) : "--:--";
        const endStr = evt.end_at ? fmtTime(evt.end_at) : "";
        eventsHtml += `<div class="event-item" style="background-color:#ffffff;padding:14px 18px;border-radius:12px;border:1px solid ${CARD_BORDER};margin-bottom:8px;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td width="60" style="vertical-align:top;text-align:center;">
              <div style="background-color:#EDE9FE;border-radius:10px;padding:8px 4px;">
                <p style="margin:0;font-size:16px;font-weight:700;color:#7C3AED;font-family:${MONO_FONT};line-height:1;">${startStr}</p>
                ${endStr ? `<p style="margin:2px 0 0;font-size:10px;color:#8B5CF6;font-family:${MONO_FONT};">— ${endStr}</p>` : ""}
              </div>
            </td>
            <td style="vertical-align:middle;padding-left:14px;">
              <p class="email-heading" style="margin:0;font-size:14px;font-weight:600;color:${DARK};font-family:${FONT};">${evt.title}</p>
            </td>
          </tr></table>
        </div>`;
      }
    }

    return {
      subject: `${greeting}, ${name}! Seu resumo do dia`,
      html: emailLayout("Resumo do dia", `
        <h1 class="email-heading" style="margin:0 0 4px;font-size:24px;font-weight:700;color:${DARK};font-family:${FONT};text-align:center;">${greeting}, ${name}!</h1>
        <p class="email-muted" style="margin:0 0 24px;font-size:13px;color:${MUTED};font-family:${FONT};text-align:center;">${fmtDate(new Date(), { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</p>

        <table width="100%" cellpadding="0" cellspacing="8" border="0" style="margin-bottom:8px;">
          <tr>
            ${statCard(tasks, "Pendentes", "list", PRIMARY)}
            ${statCard(events, "Eventos", "calendar", "#7C3AED")}
            ${statCard(completedYesterday, "Ontem", "check", "#22C55E")}
          </tr>
        </table>

        ${urgentTasksHtml}
        ${eventsHtml}

        <div style="background-color:${PRIMARY_LIGHT};padding:14px 18px;border-radius:12px;margin-top:20px;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td width="28" style="vertical-align:top;padding-top:1px;">${svgIcon("zap", PRIMARY, 16)}</td>
            <td style="padding-left:8px;">
              <p class="email-text" style="margin:0;font-size:13px;color:${BODY_TEXT};font-family:${FONT};line-height:1.5;">${motivational}</p>
            </td>
          </tr></table>
        </div>

        ${ctaButton("Abrir meu painel →", APP_URL)}
      `, settingsUrl),
    };
  },

  // ════════════════════════════════════════════════════════════════════════════
  // WEEKLY REPORT — Complete redesign
  // ════════════════════════════════════════════════════════════════════════════
  weekly_report: (data, settingsUrl) => {
    const name = data.display_name || "usuário";
    const completed = data.tasks_completed || 0;
    const created = data.tasks_created || 0;
    const events = data.events_attended || 0;
    const credits = data.credits_used || 0;
    const pending = data.tasks_pending || 0;
    const prevCompleted = data.prev_tasks_completed ?? null;
    const nextWeekEvents = data.next_week_events || 0;
    const nextWeekTasks = data.next_week_tasks || 0;
    const total = completed + pending;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Week period
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const periodStr = `${fmtDate(weekAgo, { day: "2-digit", month: "short" })} — ${fmtDate(now, { day: "2-digit", month: "short" })}`;

    // Comparison arrow
    let comparisonHtml = "";
    if (prevCompleted !== null && prevCompleted !== undefined) {
      const diff = completed - prevCompleted;
      if (diff > 0) {
        comparisonHtml = `<p class="email-text" style="margin:8px 0 0;font-size:12px;color:#22C55E;font-family:${FONT};text-align:center;">${svgIcon("arrowUp", "#22C55E", 14)} +${diff} vs semana anterior</p>`;
      } else if (diff < 0) {
        comparisonHtml = `<p class="email-text" style="margin:8px 0 0;font-size:12px;color:#EF4444;font-family:${FONT};text-align:center;">${svgIcon("arrowDown", "#EF4444", 14)} ${diff} vs semana anterior</p>`;
      } else {
        comparisonHtml = `<p class="email-muted" style="margin:8px 0 0;font-size:12px;color:${MUTED};font-family:${FONT};text-align:center;">Mesmo ritmo da semana anterior</p>`;
      }
    }

    // Best day (if provided)
    let highlightsHtml = "";
    if (data.best_day || data.top_category) {
      highlightsHtml = sectionHeader("star", "Destaques", PRIMARY);
      highlightsHtml += `<div class="info-card" style="background-color:#ffffff;padding:16px 20px;border-radius:14px;border:1px solid ${CARD_BORDER};border-left:4px solid ${PRIMARY};">`;
      if (data.best_day) {
        highlightsHtml += `<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          <td width="28">${svgIcon("trending", "#22C55E", 16)}</td>
          <td style="padding-left:8px;">
            <p class="email-text" style="margin:0;font-size:13px;color:${BODY_TEXT};font-family:${FONT};">Dia mais produtivo: <strong style="color:${DARK};">${data.best_day}</strong></p>
          </td>
        </tr></table>`;
      }
      if (data.top_category) {
        highlightsHtml += `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:8px;"><tr>
          <td width="28">${svgIcon("target", PRIMARY, 16)}</td>
          <td style="padding-left:8px;">
            <p class="email-text" style="margin:0;font-size:13px;color:${BODY_TEXT};font-family:${FONT};">Categoria mais ativa: <strong style="color:${DARK};">${data.top_category}</strong></p>
          </td>
        </tr></table>`;
      }
      highlightsHtml += `</div>`;
    }

    // Next week preview
    let nextWeekHtml = "";
    if (nextWeekTasks > 0 || nextWeekEvents > 0) {
      nextWeekHtml = sectionHeader("calendar", "Próxima semana", "#7C3AED");
      nextWeekHtml += `<table width="100%" cellpadding="0" cellspacing="8" border="0">
        <tr>
          <td width="50%" class="stat-card" style="background-color:#ffffff;padding:16px 12px;border-radius:12px;text-align:center;border:1px solid ${CARD_BORDER};">
            <div style="margin-bottom:6px;">${svgIcon("list", "#EA580C", 18)}</div>
            <p style="margin:0;font-size:22px;font-weight:700;color:#EA580C;font-family:${FONT};">${nextWeekTasks}</p>
            <p class="email-muted" style="margin:2px 0 0;font-size:11px;color:${MUTED};font-family:${FONT};text-transform:uppercase;letter-spacing:0.5px;">Tarefas</p>
          </td>
          <td width="50%" class="stat-card" style="background-color:#ffffff;padding:16px 12px;border-radius:12px;text-align:center;border:1px solid ${CARD_BORDER};">
            <div style="margin-bottom:6px;">${svgIcon("calendar", "#7C3AED", 18)}</div>
            <p style="margin:0;font-size:22px;font-weight:700;color:#7C3AED;font-family:${FONT};">${nextWeekEvents}</p>
            <p class="email-muted" style="margin:2px 0 0;font-size:11px;color:${MUTED};font-family:${FONT};text-transform:uppercase;letter-spacing:0.5px;">Eventos</p>
          </td>
        </tr>
      </table>`;
    }

    return {
      subject: `Seu relatório semanal, ${name}`,
      html: emailLayout("Relatório Semanal", `
        <h1 class="email-heading" style="margin:0 0 4px;font-size:24px;font-weight:700;color:${DARK};font-family:${FONT};text-align:center;">Sua semana no DESH</h1>
        <p class="email-muted" style="margin:0 0 24px;font-size:13px;color:${MUTED};font-family:${FONT};text-align:center;">${periodStr}</p>

        <table width="100%" cellpadding="0" cellspacing="8" border="0" style="margin-bottom:4px;">
          <tr>
            ${statCard(completed, "Concluídas", "check", "#22C55E")}
            ${statCard(created, "Criadas", "list", PRIMARY)}
          </tr>
          <tr>
            ${statCard(events, "Eventos", "calendar", "#7C3AED")}
            ${statCard(credits, "Créditos", "zap", "#F59E0B")}
          </tr>
        </table>

        ${comparisonHtml}

        ${progressBar(pct, "#22C55E", CARD_BORDER, `Progresso semanal — ${pct}%`)}

        ${highlightsHtml}
        ${nextWeekHtml}

        ${ctaButton("Ver detalhes →", APP_URL)}
      `, settingsUrl),
    };
  },

  // ════════════════════════════════════════════════════════════════════════════
  // TASK REMINDER — Redesign with urgency badges
  // ════════════════════════════════════════════════════════════════════════════
  task_reminder: (data, settingsUrl) => {
    const title = data.title || "Tarefa sem título";
    const timeLabel = data.time_label || "em breve";
    const description = data.description ? (data.description.length > 120 ? data.description.substring(0, 120) + "…" : data.description) : "";
    const category = data.category || "";
    const project = data.project_name || "";
    const priority = data.priority || "";

    // Parse minutes from time_label
    let minutes = 60;
    const minMatch = timeLabel.match(/(\d+)\s*min/);
    if (minMatch) minutes = parseInt(minMatch[1]);
    else if (timeLabel.includes("30")) minutes = 30;
    else if (timeLabel.includes("15")) minutes = 15;

    // Priority color
    let priorityBadge = "";
    if (priority) {
      const pColors: Record<string, {bg: string; text: string}> = {
        high: { bg: "#FEF2F2", text: "#DC2626" },
        medium: { bg: "#FFF7ED", text: "#EA580C" },
        low: { bg: "#F0FDF4", text: "#22C55E" },
      };
      const pc = pColors[priority] || pColors.medium;
      priorityBadge = `<span style="display:inline-block;padding:3px 10px;background-color:${pc.bg};color:${pc.text};font-size:10px;font-weight:600;border-radius:12px;font-family:${FONT};text-transform:uppercase;margin-left:8px;">${priority}</span>`;
    }

    return {
      subject: `Prazo próximo: ${title}`,
      html: emailLayout("Prazo próximo", `
        <div style="text-align:center;margin-bottom:20px;">
          <div style="display:inline-block;background-color:${PRIMARY_LIGHT};border-radius:50%;padding:16px;">
            ${svgIcon("clock", PRIMARY, 28)}
          </div>
        </div>
        <h1 class="email-heading" style="margin:0 0 6px;font-size:22px;font-weight:700;color:${DARK};font-family:${FONT};text-align:center;">Tarefa vencendo</h1>
        <p class="email-muted" style="margin:0 0 20px;font-size:14px;color:${MUTED};font-family:${FONT};text-align:center;">Uma tarefa precisa da sua atenção</p>

        <div class="task-item" style="background-color:#ffffff;padding:20px 24px;border-radius:14px;border:1px solid ${CARD_BORDER};border-left:4px solid ${minutes <= 15 ? "#DC2626" : minutes <= 30 ? "#EA580C" : "#F59E0B"};">
          <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td style="vertical-align:top;">
              <p class="email-heading" style="margin:0 0 8px;font-size:17px;font-weight:700;color:${DARK};font-family:${FONT};">${title}${priorityBadge}</p>
              <table cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="padding-right:16px;">
                  <p class="email-muted" style="margin:0;font-size:12px;color:${MUTED};font-family:${FONT};">${svgIcon("clock", MUTED, 13)} Vence ${timeLabel}</p>
                </td>
                ${category ? `<td><p class="email-muted" style="margin:0;font-size:12px;color:${MUTED};font-family:${FONT};">${svgIcon("target", MUTED, 13)} ${category}</p></td>` : ""}
              </tr></table>
              ${description ? `<p class="email-text" style="margin:10px 0 0;font-size:13px;color:${BODY_TEXT};font-family:${FONT};line-height:1.5;">${description}</p>` : ""}
              ${project ? `<p class="email-muted" style="margin:8px 0 0;font-size:12px;color:${LIGHT_MUTED};font-family:${FONT};">Projeto: ${project}</p>` : ""}
            </td>
            <td width="90" style="vertical-align:top;text-align:right;padding-top:2px;">
              ${urgencyBadge(minutes)}
            </td>
          </tr></table>
        </div>

        ${ctaButton("Ver tarefa →", APP_URL + "/tasks")}
      `, settingsUrl),
    };
  },

  // ════════════════════════════════════════════════════════════════════════════
  // EVENT REMINDER — Redesign with timeline + meeting link
  // ════════════════════════════════════════════════════════════════════════════
  event_reminder: (data, settingsUrl) => {
    const title = data.title || "Evento sem título";
    const minutes = data.minutes || 15;
    const timeStr = data.time_str || "--:--";
    const endStr = data.end_time || "";
    const location = data.location || "";
    const meetingUrl = data.meeting_url || "";

    // Countdown badge
    let countdownLabel: string;
    if (minutes <= 5) countdownLabel = `${minutes} min`;
    else if (minutes <= 15) countdownLabel = `${minutes} min`;
    else if (minutes <= 30) countdownLabel = "~30 min";
    else countdownLabel = "~1 hora";

    const countdownBg = minutes <= 10 ? "#FEF2F2" : minutes <= 30 ? "#FFF7ED" : "#EDE9FE";
    const countdownColor = minutes <= 10 ? "#DC2626" : minutes <= 30 ? "#EA580C" : "#7C3AED";
    const countdownBorder = minutes <= 10 ? "#FECACA" : minutes <= 30 ? "#FED7AA" : "#DDD6FE";

    return {
      subject: `Evento em ${countdownLabel}: ${title}`,
      html: emailLayout("Evento próximo", `
        <div style="text-align:center;margin-bottom:20px;">
          <div style="display:inline-block;background-color:#EDE9FE;border-radius:50%;padding:16px;">
            ${svgIcon("calendar", "#7C3AED", 28)}
          </div>
        </div>
        <h1 class="email-heading" style="margin:0 0 6px;font-size:22px;font-weight:700;color:${DARK};font-family:${FONT};text-align:center;">Evento começando</h1>
        <p class="email-muted" style="margin:0 0 20px;font-size:14px;color:${MUTED};font-family:${FONT};text-align:center;">Você tem um compromisso em breve</p>

        <div class="event-item" style="background-color:#ffffff;padding:20px 24px;border-radius:14px;border:1px solid ${CARD_BORDER};">
          <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <!-- Timeline visual -->
            <td width="64" style="vertical-align:top;text-align:center;">
              <div style="background-color:#EDE9FE;border-radius:12px;padding:12px 6px;position:relative;">
                <p style="margin:0;font-size:18px;font-weight:700;color:#7C3AED;font-family:${MONO_FONT};line-height:1;">${timeStr}</p>
                ${endStr ? `<p style="margin:4px 0 0;font-size:11px;color:#8B5CF6;font-family:${MONO_FONT};">— ${endStr}</p>` : ""}
              </div>
              <!-- Countdown badge -->
              <div style="margin-top:8px;">
                <span style="display:inline-block;padding:4px 12px;background-color:${countdownBg};color:${countdownColor};font-size:11px;font-weight:600;border-radius:16px;font-family:${FONT};border:1px solid ${countdownBorder};">${svgIcon("clock", countdownColor, 12)} ${countdownLabel}</span>
              </div>
            </td>
            <!-- Event details -->
            <td style="vertical-align:top;padding-left:18px;">
              <p class="email-heading" style="margin:0 0 8px;font-size:17px;font-weight:700;color:${DARK};font-family:${FONT};">${title}</p>
              ${location ? `<table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:6px;"><tr>
                <td width="20">${svgIcon("mapPin", MUTED, 14)}</td>
                <td style="padding-left:6px;"><p class="email-muted" style="margin:0;font-size:12px;color:${MUTED};font-family:${FONT};">${location}</p></td>
              </tr></table>` : ""}
              ${meetingUrl ? `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;"><tr><td>
                <a href="${meetingUrl}" target="_blank" style="display:inline-block;padding:10px 20px;font-family:${FONT};font-size:13px;font-weight:600;color:#ffffff;text-decoration:none;background-color:#7C3AED;border-radius:10px;">${svgIcon("video", "#ffffff", 14)} Entrar na reunião</a>
              </td></tr></table>` : ""}
            </td>
          </tr></table>
        </div>

        ${ctaButton("Ver calendário →", APP_URL + "/calendar")}
      `, settingsUrl),
    };
  },

  // ════════════════════════════════════════════════════════════════════════════
  // Remaining renderers (kept with SVG icon updates)
  // ════════════════════════════════════════════════════════════════════════════

  credit_low: (data, settingsUrl) => {
    const balance = data.credits_balance || 0;
    const pct = Math.min(100, Math.max(5, (balance / 100) * 100));
    return {
      subject: `Seus créditos estão acabando`,
      html: emailLayout("Créditos Baixos", `
        <div style="text-align:center;margin-bottom:16px;">
          <div style="display:inline-block;background-color:#FFF8E7;border-radius:50%;padding:16px;">
            ${svgIcon("alert", "#F59E0B", 28)}
          </div>
        </div>
        <h1 class="email-heading" style="margin:0 0 6px;font-size:24px;font-weight:700;color:${DARK};font-family:${FONT};text-align:center;">Créditos baixos</h1>
        <p class="email-muted" style="margin:0 0 24px;font-size:14px;color:${MUTED};font-family:${FONT};text-align:center;">Olá, ${data.display_name || "usuário"}! Seus créditos estão quase no fim.</p>
        <div style="background-color:#FFF8E7;padding:24px;border-radius:14px;border:1px solid #F5E6C8;text-align:center;">
          <p class="email-muted" style="margin:0 0 4px;font-size:11px;color:#A16207;font-family:${FONT};text-transform:uppercase;letter-spacing:1px;font-weight:600;">Saldo atual</p>
          <p style="margin:0 0 16px;font-size:36px;font-weight:700;color:#92400E;font-family:${FONT};letter-spacing:-1px;">${balance}</p>
          ${progressBar(pct, "#F59E0B", "#FDE68A")}
        </div>
        ${ctaButton("Recarregar créditos →", APP_URL + "/settings", "#F59E0B")}
      `, settingsUrl),
    };
  },

  credit_purchase: (data, settingsUrl) => ({
    subject: `Compra confirmada: ${data.credits_amount} créditos`,
    html: emailLayout("Compra Confirmada", `
      <div style="text-align:center;margin-bottom:16px;">
        <div style="display:inline-block;background-color:#F0FDF4;border-radius:50%;padding:16px;">
          ${svgIcon("check", "#22C55E", 28)}
        </div>
      </div>
      <h1 class="email-heading" style="margin:0 0 6px;font-size:24px;font-weight:700;color:${DARK};font-family:${FONT};text-align:center;">Compra confirmada</h1>
      <p class="email-muted" style="margin:0 0 24px;font-size:14px;color:${MUTED};font-family:${FONT};text-align:center;">Seus créditos foram adicionados com sucesso</p>
      <div style="background-color:#F0FDF4;padding:24px;border-radius:14px;border:1px solid #BBF7D0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #DCFCE7;">
              <p class="email-text" style="margin:0;font-size:13px;color:${BODY_TEXT};font-family:${FONT};">${svgIcon("zap", "#166534", 14)} Créditos adicionados</p>
            </td>
            <td style="padding:10px 0;text-align:right;border-bottom:1px solid #DCFCE7;">
              <p style="margin:0;font-size:18px;font-weight:700;color:#166534;font-family:${FONT};">+${data.credits_amount}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;">
              <p class="email-text" style="margin:0;font-size:13px;color:${BODY_TEXT};font-family:${FONT};">${svgIcon("chart", "#166534", 14)} Saldo atual</p>
            </td>
            <td style="padding:10px 0;text-align:right;">
              <p style="margin:0;font-size:18px;font-weight:700;color:#166534;font-family:${FONT};">${data.credits_balance}</p>
            </td>
          </tr>
        </table>
      </div>
      <p class="email-muted" style="margin:20px 0 0;font-size:13px;color:${MUTED};font-family:${FONT};text-align:center;">Obrigado por apoiar o DESH!</p>
    `, settingsUrl),
  }),

  welcome: (data, settingsUrl) => ({
    subject: `Bem-vindo ao DESH, ${data.display_name || "usuário"}!`,
    html: emailLayout("Bem-vindo ao DESH!", `
      <h1 class="email-heading" style="margin:0 0 6px;font-size:24px;font-weight:700;color:${DARK};font-family:${FONT};text-align:center;">Bem-vindo ao DESH!</h1>
      <p class="email-muted" style="margin:0 0 24px;font-size:14px;color:${MUTED};font-family:${FONT};text-align:center;">Olá, ${data.display_name || "usuário"}! Seu hub pessoal está pronto.</p>
      <table width="100%" cellpadding="0" cellspacing="8" border="0" style="margin-bottom:24px;">
        <tr>
          <td width="50%" class="stat-card" style="background-color:#ffffff;padding:20px;border-radius:14px;border:1px solid ${CARD_BORDER};vertical-align:top;">
            <div style="margin-bottom:8px;">${svgIcon("list", PRIMARY, 22)}</div>
            <p class="email-heading" style="margin:0 0 4px;font-size:14px;font-weight:600;color:${DARK};font-family:${FONT};">Tarefas & Calendário</p>
            <p class="email-text" style="margin:0;font-size:12px;color:${BODY_TEXT};font-family:${FONT};">Organize seu dia com GTD</p>
          </td>
          <td width="50%" class="stat-card" style="background-color:#ffffff;padding:20px;border-radius:14px;border:1px solid ${CARD_BORDER};vertical-align:top;">
            <div style="margin-bottom:8px;">${svgIcon("inbox", "#7C3AED", 22)}</div>
            <p class="email-heading" style="margin:0 0 4px;font-size:14px;font-weight:600;color:${DARK};font-family:${FONT};">E-mail integrado</p>
            <p class="email-text" style="margin:0;font-size:12px;color:${BODY_TEXT};font-family:${FONT};">Gmail conectado com IA</p>
          </td>
        </tr>
        <tr>
          <td width="50%" class="stat-card" style="background-color:#ffffff;padding:20px;border-radius:14px;border:1px solid ${CARD_BORDER};vertical-align:top;">
            <div style="margin-bottom:8px;">${svgIcon("chart", "#22C55E", 22)}</div>
            <p class="email-heading" style="margin:0 0 4px;font-size:14px;font-weight:600;color:${DARK};font-family:${FONT};">Finanças pessoais</p>
            <p class="email-text" style="margin:0;font-size:12px;color:${BODY_TEXT};font-family:${FONT};">Controle total do seu dinheiro</p>
          </td>
          <td width="50%" class="stat-card" style="background-color:#ffffff;padding:20px;border-radius:14px;border:1px solid ${CARD_BORDER};vertical-align:top;">
            <div style="margin-bottom:8px;">${svgIcon("zap", "#F59E0B", 22)}</div>
            <p class="email-heading" style="margin:0 0 4px;font-size:14px;font-weight:600;color:${DARK};font-family:${FONT};">IA Pandora</p>
            <p class="email-text" style="margin:0;font-size:12px;color:${BODY_TEXT};font-family:${FONT};">Sua assistente pessoal</p>
          </td>
        </tr>
      </table>
      ${ctaButton("Começar agora →", APP_URL)}
    `, settingsUrl),
  }),

  security_alert: (data, settingsUrl) => ({
    subject: `Novo login detectado na sua conta`,
    html: emailLayout("Alerta de Segurança", `
      <div style="text-align:center;margin-bottom:16px;">
        <div style="display:inline-block;background-color:#FEF2F2;border-radius:50%;padding:16px;">
          ${svgIcon("alert", "#DC2626", 28)}
        </div>
      </div>
      <h1 class="email-heading" style="margin:0 0 6px;font-size:24px;font-weight:700;color:${DARK};font-family:${FONT};text-align:center;">Alerta de segurança</h1>
      <p class="email-muted" style="margin:0 0 24px;font-size:14px;color:${MUTED};font-family:${FONT};text-align:center;">Detectamos um novo login na sua conta</p>
      <div style="background-color:${DARK};padding:24px;border-radius:14px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding:8px 0;border-bottom:1px solid #2D2D3A;">
            <p style="margin:0;font-size:11px;color:#9CA3AF;font-family:${FONT};text-transform:uppercase;letter-spacing:0.5px;">Endereço IP</p>
            <p style="margin:4px 0 0;font-size:14px;color:#F3F4F6;font-family:${MONO_FONT};">${data.ip || "desconhecido"}</p>
          </td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #2D2D3A;">
            <p style="margin:0;font-size:11px;color:#9CA3AF;font-family:${FONT};text-transform:uppercase;letter-spacing:0.5px;">Dispositivo</p>
            <p style="margin:4px 0 0;font-size:14px;color:#F3F4F6;font-family:${FONT};">${data.user_agent || "não identificado"}</p>
          </td></tr>
          <tr><td style="padding:8px 0;">
            <p style="margin:0;font-size:11px;color:#9CA3AF;font-family:${FONT};text-transform:uppercase;letter-spacing:0.5px;">Data e hora</p>
            <p style="margin:4px 0 0;font-size:14px;color:#F3F4F6;font-family:${FONT};">${data.timestamp || new Date().toLocaleString("pt-BR")}</p>
          </td></tr>
        </table>
      </div>
      ${alertBox(`${svgIcon("alert", "#991B1B", 14)} Se não foi você, altere sua senha imediatamente.`, "#FFF0F0", "#FFE0E0", "#991B1B")}
      ${ctaButton("Revisar segurança →", APP_URL + "/settings", "#EF4444")}
    `, settingsUrl),
  }),

  broadcast: (data, settingsUrl) => {
    const typeColors: Record<string, string> = { info: PRIMARY, warning: "#F59E0B", success: "#22C55E" };
    const color = typeColors[data.broadcast_type] || PRIMARY;
    return {
      subject: `${data.title}`,
      html: emailLayout(data.title, `
        <h1 class="email-heading" style="margin:0 0 6px;font-size:24px;font-weight:700;color:${DARK};font-family:${FONT};text-align:center;">${data.title}</h1>
        <p class="email-muted" style="margin:0 0 24px;font-size:14px;color:${MUTED};font-family:${FONT};text-align:center;">Comunicado da equipe DESH</p>
        ${infoCard(`<p class="email-text" style="margin:0;font-size:14px;color:${BODY_TEXT};line-height:1.7;font-family:${FONT};">${data.message}</p>`, color)}
        ${data.action_url ? ctaButton("Saiba mais →", data.action_url) : ""}
      `, settingsUrl),
    };
  },

  inactivity_reminder: (data, settingsUrl) => ({
    subject: `Sentimos sua falta, ${data.display_name || "usuário"}!`,
    html: emailLayout("Sentimos sua falta!", `
      <h1 class="email-heading" style="margin:0 0 6px;font-size:24px;font-weight:700;color:${DARK};font-family:${FONT};text-align:center;">Sentimos sua falta!</h1>
      <p class="email-muted" style="margin:0 0 24px;font-size:14px;color:${MUTED};font-family:${FONT};text-align:center;">Olá, ${data.display_name || "usuário"}!</p>
      <p class="email-text" style="margin:0 0 20px;font-size:14px;color:${BODY_TEXT};line-height:1.7;font-family:${FONT};">Já faz <strong style="color:${DARK};">${data.days_inactive || 7} dias</strong> desde sua última visita. Suas tarefas, e-mails e eventos continuam organizados esperando por você.</p>
      ${infoCard(`<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td width="28" style="vertical-align:top;padding-top:1px;">${svgIcon("zap", PRIMARY, 16)}</td>
        <td style="padding-left:8px;"><p class="email-text" style="margin:0;font-size:14px;color:${DARK};font-family:${FONT};line-height:1.6;"><strong>Dica:</strong> Reserve 5 minutos para revisar o que aconteceu. A Pandora preparou um resumo para você.</p></td>
      </tr></table>`, PRIMARY)}
      ${ctaButton("Voltar ao DESH →", data.app_url || APP_URL)}
    `, settingsUrl),
  }),

  new_connection: (data, settingsUrl) => ({
    subject: `Integração conectada: ${data.connection_name}`,
    html: emailLayout("Nova Integração", `
      <div style="text-align:center;margin-bottom:16px;">
        <div style="display:inline-block;background-color:#F0FDF4;border-radius:50%;padding:16px;">
          ${svgIcon("link", "#22C55E", 28)}
        </div>
      </div>
      <h1 class="email-heading" style="margin:0 0 6px;font-size:24px;font-weight:700;color:${DARK};font-family:${FONT};text-align:center;">Nova integração ativa</h1>
      <p class="email-muted" style="margin:0 0 24px;font-size:14px;color:${MUTED};font-family:${FONT};text-align:center;">Uma nova integração foi conectada à sua conta</p>
      <div class="stat-card" style="background-color:#ffffff;padding:24px;border-radius:14px;border:1px solid ${CARD_BORDER};text-align:center;">
        <div style="margin-bottom:10px;">${svgIcon("link", "#22C55E", 28)}</div>
        <p class="email-heading" style="margin:0 0 4px;font-size:18px;font-weight:700;color:${DARK};font-family:${FONT};">${data.connection_name}</p>
        <p class="email-text" style="margin:0 0 12px;font-size:13px;color:${BODY_TEXT};font-family:${FONT};">Plataforma: ${data.platform || "—"}</p>
        <span style="display:inline-block;padding:5px 16px;background-color:#DCFCE7;color:#166534;font-size:12px;font-weight:600;border-radius:20px;font-family:${FONT};">${svgIcon("check", "#166534", 13)} Conectado</span>
      </div>
      ${ctaButton("Gerenciar integrações →", APP_URL + "/settings")}
    `, settingsUrl),
  }),

  account_archived: (data, settingsUrl) => ({
    subject: `Sua conta DESH foi arquivada`,
    html: emailLayout("Conta Arquivada", `
      <div style="text-align:center;margin-bottom:16px;">
        <div style="display:inline-block;background-color:#FEF2F2;border-radius:50%;padding:16px;">
          ${svgIcon("alert", "#DC2626", 28)}
        </div>
      </div>
      <h1 class="email-heading" style="margin:0 0 6px;font-size:24px;font-weight:700;color:${DARK};font-family:${FONT};text-align:center;">Conta arquivada</h1>
      <p class="email-muted" style="margin:0 0 24px;font-size:14px;color:${MUTED};font-family:${FONT};text-align:center;">Sua conta foi marcada para exclusão</p>
      <div style="background-color:#FEF2F2;padding:24px;border-radius:14px;border:1px solid #FECACA;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding:8px 0;border-bottom:1px solid #FEE2E2;">
            <p style="margin:0;font-size:11px;color:#991B1B;font-family:${FONT};text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Status</p>
            <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#DC2626;font-family:${FONT};">Arquivada — exclusão em 30 dias</p>
          </td></tr>
          ${data.archived_reason ? `<tr><td style="padding:8px 0;border-bottom:1px solid #FEE2E2;">
            <p style="margin:0;font-size:11px;color:#991B1B;font-family:${FONT};text-transform:uppercase;letter-spacing:0.5px;">Motivo</p>
            <p style="margin:4px 0 0;font-size:14px;color:#7F1D1D;font-family:${FONT};">${data.archived_reason}</p>
          </td></tr>` : ""}
          <tr><td style="padding:8px 0;">
            <p style="margin:0;font-size:13px;color:#991B1B;font-family:${FONT};line-height:1.6;">
              Todos os seus dados serão permanentemente excluídos após 30 dias. Se acredita que isso foi um erro, entre em contato com o administrador.
            </p>
          </td></tr>
        </table>
      </div>
      ${alertBox(`${svgIcon("clock", "#92400E", 14)} Esta ação pode ser revertida pelo administrador antes do prazo expirar.`, "#FFF8E7", "#F5E6C8", "#92400E")}
    `, settingsUrl),
  }),

  account_deletion_warning: (data, settingsUrl) => {
    const days = data.days_remaining || 7;
    const isAdminCopy = data.is_admin_copy;
    const targetInfo = isAdminCopy ? ` (${data.target_name || data.target_email})` : "";
    const urgentBg = days <= 3 ? "#FEF2F2" : "#FFF8E7";
    const urgentBorder = days <= 3 ? "#FECACA" : "#F5E6C8";
    const urgentColor = days <= 3 ? "#DC2626" : "#F59E0B";
    const urgentTextColor = days <= 3 ? "#991B1B" : "#92400E";

    return {
      subject: `${isAdminCopy ? "[Admin] " : ""}Conta DESH será excluída em ${days} dias${targetInfo}`,
      html: emailLayout("Aviso de Exclusão", `
        <div style="text-align:center;margin-bottom:16px;">
          <div style="display:inline-block;background-color:${urgentBg};border-radius:50%;padding:16px;">
            ${svgIcon("alert", urgentColor, 28)}
          </div>
        </div>
        <h1 class="email-heading" style="margin:0 0 6px;font-size:24px;font-weight:700;color:${DARK};font-family:${FONT};text-align:center;">Exclusão em ${days} dias</h1>
        <p class="email-muted" style="margin:0 0 24px;font-size:14px;color:${MUTED};font-family:${FONT};text-align:center;">${isAdminCopy ? `A conta de ${data.target_email} será excluída` : "Sua conta será permanentemente excluída"}</p>
        <div style="background-color:${urgentBg};padding:24px;border-radius:14px;border:1px solid ${urgentBorder};text-align:center;">
          <p style="margin:0 0 8px;font-size:48px;font-weight:800;color:${urgentColor};font-family:${FONT};letter-spacing:-2px;">${days}</p>
          <p style="margin:0;font-size:14px;font-weight:600;color:${urgentTextColor};font-family:${FONT};text-transform:uppercase;letter-spacing:1px;">dias restantes</p>
        </div>
        ${data.archived_reason ? alertBox(`Motivo: ${data.archived_reason}`, "#F5F5F5", "#E5E5E5", "#525252") : ""}
        ${isAdminCopy
          ? ctaButton("Abrir painel admin →", APP_URL + "/admin")
          : alertBox(`${svgIcon("alert", urgentTextColor, 14)} Se deseja manter sua conta, entre em contato com o administrador imediatamente.`, urgentBg, urgentBorder, urgentTextColor)
        }
      `, settingsUrl),
    };
  },

  // ════════════════════════════════════════════════════════════════════════════
  // SECURITY OTP — Código de verificação para autorização de número WhatsApp
  // ════════════════════════════════════════════════════════════════════════════
  security_otp: (data, settingsUrl) => {
    const otpCode = data.otpCode || data.otp_code || "------";
    const phoneNumber = data.phoneNumber || data.phone_number || "—";
    const expiresIn = data.expiresInMinutes || data.expires_in_minutes || 10;

    const digits = otpCode.split("");
    const digitBoxes = digits.map((d: string) =>
      `<td style="width:48px;height:56px;text-align:center;vertical-align:middle;background-color:#ffffff;border:2px solid ${CARD_BORDER};border-radius:12px;font-family:${MONO_FONT};font-size:28px;font-weight:700;color:${DARK};letter-spacing:0;">${d}</td>`
    ).join(`<td style="width:6px;"></td>`);

    return {
      subject: `Seu código de verificação: ${otpCode}`,
      html: emailLayout("Verificação de segurança", `
        <div style="text-align:center;margin-bottom:8px;">
          ${svgIcon("alert", PRIMARY, 32)}
        </div>
        <h1 class="email-heading" style="margin:0 0 8px;font-size:22px;font-weight:700;color:${DARK};font-family:${FONT};text-align:center;">Código de verificação</h1>
        <p class="email-text" style="margin:0 0 24px;font-size:14px;color:${BODY_TEXT};font-family:${FONT};text-align:center;line-height:1.6;">
          Use o código abaixo para autorizar o número <strong>${phoneNumber}</strong> a interagir com a Pandora no WhatsApp.
        </p>

        <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 24px;">
          <tr>${digitBoxes}</tr>
        </table>

        <div style="text-align:center;margin-bottom:24px;">
          <span style="display:inline-block;padding:6px 16px;background-color:${PRIMARY_LIGHT};color:${PRIMARY};font-size:12px;font-weight:600;border-radius:20px;font-family:${FONT};">
            ${svgIcon("clock", PRIMARY, 14)} Válido por ${expiresIn} minutos
          </span>
        </div>

        ${alertBox(
          `${svgIcon("alert", "#DC2626", 14)} Se você <strong>não solicitou</strong> este código, ignore este e-mail. Sua conta está segura.`,
          "#FEF2F2", "#FECACA", "#991B1B"
        )}
      `, settingsUrl),
    };
  },
};

// ─── Log email send ─────────────────────────────────────────────────────────
async function logSend(
  supabase: any,
  userId: string | null,
  emailType: string,
  templateSlug: string | null,
  recipientEmail: string,
  subject: string,
  status: "sent" | "failed" | "skipped",
  errorMessage?: string,
) {
  try {
    await supabase.from("email_send_log").insert({
      user_id: userId,
      email_type: emailType,
      template_slug: templateSlug,
      recipient_email: recipientEmail,
      subject,
      status,
      error_message: errorMessage || null,
    });
  } catch (e) {
    console.error("Failed to log email send:", e);
  }
}

// ─── Render email (check DB template first, fallback to hardcoded) ──────────
async function renderEmail(
  supabase: any,
  type: EmailType,
  data: Record<string, any>,
  settingsUrl: string,
): Promise<{ subject: string; html: string; templateSlug: string | null }> {
  const { data: tpl } = await supabase
    .from("email_templates")
    .select("slug, subject_template, body_html")
    .eq("slug", type)
    .eq("active", true)
    .single();

  if (tpl?.subject_template && tpl?.body_html) {
    return {
      subject: replaceVars(tpl.subject_template, data),
      html: emailLayout(
        replaceVars(tpl.subject_template, data).replace(/^[^\s]+ /, ""),
        replaceVars(tpl.body_html, data),
        settingsUrl,
      ),
      templateSlug: tpl.slug,
    };
  }

  const renderer = renderers[type];
  if (!renderer) throw new Error(`Unknown email type: ${type}`);
  const result = renderer(data, settingsUrl);
  return { ...result, templateSlug: null };
}

// ─── Main handler ───────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const resend = new Resend(resendKey);

    const { type, user_id, data } = (await req.json()) as EmailPayload;
    const baseUrl = Deno.env.get("DESH_BASE_URL") || "https://desh-ws.lovable.app";
    const settingsUrl = `${baseUrl}/settings`;
    const prefKey = getPreferenceKey(type);

    // ── Broadcast: send to all opted-in users ──
    if (type === "broadcast") {
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("user_id")
        .eq(prefKey, true);

      if (!prefs || prefs.length === 0) {
        return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const userIds = prefs.map((p: any) => p.user_id);
      const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const emailMap = new Map<string, string>();
      users?.users?.forEach((u: any) => { if (u.email && userIds.includes(u.id)) emailMap.set(u.id, u.email); });

      const emails = Array.from(emailMap.values());
      if (emails.length === 0) {
        return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const rendered = await renderEmail(supabase, type, data, settingsUrl);

      let sent = 0;
      for (let i = 0; i < emails.length; i += 50) {
        const batch = emails.slice(i, i + 50);
        try {
          await resend.emails.send({ from: "Desh <noreply@desh.life>", to: batch, subject: rendered.subject, html: rendered.html });
          sent += batch.length;
          for (const email of batch) {
            await logSend(supabase, null, type, rendered.templateSlug, email, rendered.subject, "sent");
          }
        } catch (e: any) {
          console.error("Batch send error:", e);
          for (const email of batch) {
            await logSend(supabase, null, type, rendered.templateSlug, email, rendered.subject, "failed", e.message);
          }
        }
      }

      return new Response(JSON.stringify({ sent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Daily summary / weekly report cron ──
    if ((type === "daily_summary" || type === "weekly_report") && !user_id) {
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("user_id")
        .eq(prefKey, true);

      if (!prefs || prefs.length === 0) {
        return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: allUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      let sent = 0;

      for (const pref of prefs) {
        const authUser = allUsers?.users?.find((u: any) => u.id === pref.user_id);
        if (!authUser?.email) continue;

        const { data: rateData } = await supabase
          .from("email_rate_limits")
          .select("sent_at")
          .eq("user_id", pref.user_id)
          .eq("email_type", type)
          .single();

        if (rateData?.sent_at) {
          const hoursSince = (Date.now() - new Date(rateData.sent_at).getTime()) / 3600000;
          if (hoursSince < RATE_LIMIT_HOURS) continue;
        }

        const { data: profile } = await supabase.from("profiles").select("display_name").eq("user_id", pref.user_id).single();
        const now = new Date();
        const today = now.toISOString().split("T")[0];

        // ── Enriched data for daily_summary ──
        let summaryData: Record<string, any> = {
          display_name: profile?.display_name || "usuário",
          tasks_due: 0,
          tasks_completed: data.tasks_completed || 0,
          tasks_completed_yesterday: 0,
          events_today: 0,
          events_attended: data.events_attended || 0,
          credits_used: data.credits_used || 0,
          urgent_tasks: [],
          today_events: [],
        };

        // Tasks due today
        const { count: tasksDue } = await supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", pref.user_id)
          .neq("status", "done")
          .lte("due_date", today + "T23:59:59Z");
        summaryData.tasks_due = tasksDue || 0;

        if (type === "daily_summary") {
          // Top 5 urgent tasks (with title + due_date)
          const { data: urgentTasks } = await supabase
            .from("tasks")
            .select("title, due_date")
            .eq("user_id", pref.user_id)
            .neq("status", "done")
            .not("due_date", "is", null)
            .lte("due_date", today + "T23:59:59Z")
            .order("due_date", { ascending: true })
            .limit(5);
          summaryData.urgent_tasks = urgentTasks || [];

          // Tasks completed yesterday
          const yesterday = new Date(now.getTime() - 86400000).toISOString().split("T")[0];
          const { count: completedYesterday } = await supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("user_id", pref.user_id)
            .eq("status", "done")
            .gte("updated_at", yesterday + "T00:00:00Z")
            .lt("updated_at", today + "T00:00:00Z");
          summaryData.tasks_completed_yesterday = completedYesterday || 0;

          // Today's events from calendar cache
          const { data: todayEvents } = await supabase
            .from("calendar_events_cache")
            .select("title, start_at, end_at")
            .eq("user_id", pref.user_id)
            .gte("start_at", today + "T00:00:00Z")
            .lte("start_at", today + "T23:59:59Z")
            .order("start_at", { ascending: true })
            .limit(5);
          summaryData.today_events = todayEvents || [];
          summaryData.events_today = todayEvents?.length || 0;
        }

        if (type === "weekly_report") {
          const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
          const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000).toISOString();

          // Tasks completed this week
          const { count: completedThisWeek } = await supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("user_id", pref.user_id)
            .eq("status", "done")
            .gte("updated_at", weekAgo);
          summaryData.tasks_completed = completedThisWeek || 0;

          // Tasks created this week
          const { count: createdThisWeek } = await supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("user_id", pref.user_id)
            .gte("created_at", weekAgo);
          summaryData.tasks_created = createdThisWeek || 0;

          // Pending tasks
          const { count: pendingTasks } = await supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("user_id", pref.user_id)
            .neq("status", "done");
          summaryData.tasks_pending = pendingTasks || 0;

          // Tasks completed previous week (for comparison)
          const { count: prevWeekCompleted } = await supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("user_id", pref.user_id)
            .eq("status", "done")
            .gte("updated_at", twoWeeksAgo)
            .lt("updated_at", weekAgo);
          summaryData.prev_tasks_completed = prevWeekCompleted || 0;

          // Events attended this week
          const { count: eventsThisWeek } = await supabase
            .from("calendar_events_cache")
            .select("id", { count: "exact", head: true })
            .eq("user_id", pref.user_id)
            .gte("start_at", weekAgo);
          summaryData.events_attended = eventsThisWeek || 0;

          // Next week tasks & events
          const nextWeekEnd = new Date(now.getTime() + 7 * 86400000).toISOString();
          const { count: nextTasks } = await supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("user_id", pref.user_id)
            .neq("status", "done")
            .not("due_date", "is", null)
            .gte("due_date", now.toISOString())
            .lte("due_date", nextWeekEnd);
          summaryData.next_week_tasks = nextTasks || 0;

          const { count: nextEvents } = await supabase
            .from("calendar_events_cache")
            .select("id", { count: "exact", head: true })
            .eq("user_id", pref.user_id)
            .gte("start_at", now.toISOString())
            .lte("start_at", nextWeekEnd);
          summaryData.next_week_events = nextEvents || 0;

          // Credits used this week
          const { data: creditTxns } = await supabase
            .from("credit_transactions")
            .select("amount")
            .eq("user_id", pref.user_id)
            .eq("action", "use")
            .gte("created_at", weekAgo);
          summaryData.credits_used = creditTxns?.reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0) || 0;
        }

        const rendered = await renderEmail(supabase, type, summaryData, settingsUrl);

        try {
          await resend.emails.send({ from: "Desh <noreply@desh.life>", to: [authUser.email], subject: rendered.subject, html: rendered.html });
          sent++;
          await logSend(supabase, pref.user_id, type, rendered.templateSlug, authUser.email, rendered.subject, "sent");
          await supabase.from("email_rate_limits").upsert(
            { user_id: pref.user_id, email_type: type, sent_at: new Date().toISOString() },
            { onConflict: "user_id,email_type" }
          );
        } catch (e: any) {
          console.error(`${type} error for ${pref.user_id}:`, e);
          await logSend(supabase, pref.user_id, type, rendered.templateSlug, authUser.email, rendered.subject, "failed", e.message);
        }
      }

      return new Response(JSON.stringify({ sent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Single-user notification ──
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const bypassOtpGuards = isOtpSecurityEmail(type);

    if (!bypassOtpGuards) {
      const { data: pref } = await supabase
        .from("notification_preferences")
        .select(prefKey)
        .eq("user_id", user_id)
        .single();

      if (!pref) {
        await supabase.from("notification_preferences").insert({ user_id }).single();
      } else if (!(pref as any)[prefKey]) {
        return new Response(JSON.stringify({ skipped: true, reason: "preference_disabled" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (!bypassOtpGuards) {
      const { data: rateData } = await supabase
        .from("email_rate_limits")
        .select("sent_at")
        .eq("user_id", user_id)
        .eq("email_type", type)
        .single();

      if (rateData?.sent_at) {
        const hoursSince = (Date.now() - new Date(rateData.sent_at).getTime()) / 3600000;
        if (hoursSince < RATE_LIMIT_HOURS) {
          return new Response(JSON.stringify({ skipped: true, reason: "rate_limited" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    const { data: authData } = await supabase.auth.admin.getUserById(user_id);
    if (!authData?.user?.email) {
      return new Response(JSON.stringify({ error: "user_email_not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: profile } = await supabase.from("profiles").select("display_name").eq("user_id", user_id).single();
    const enrichedData = { ...data, display_name: data.display_name || profile?.display_name || "usuário" };

    const rendered = await renderEmail(supabase, type, enrichedData, settingsUrl);

    // Try verified domain first, fallback to Resend test domain for OTP
    const fromAddress = "Desh <noreply@desh.life>";
    const emailPayload: any = {
      from: fromAddress,
      to: [authData.user.email],
      subject: rendered.subject,
      html: rendered.html,
      reply_to: "suporte@desh.life",
      headers: {
        "X-Entity-Ref-ID": `${type}-${user_id}-${Date.now()}`,
      },
    };
    // For OTP emails, add priority headers to improve inbox placement
    if (bypassOtpGuards) {
      emailPayload.headers["X-Priority"] = "1";
      emailPayload.headers["X-Mailer"] = "Desh Security";
    }
    const { data: sendResult, error: sendError } = await resend.emails.send(emailPayload);

    if (sendError) {
      console.error(`[send-notification-email] Resend error for ${type}:`, JSON.stringify(sendError));
      // If domain not verified, retry with Resend test domain for OTP emails
      if (bypassOtpGuards && ((sendError as any).message?.includes("domain") || (sendError as any).statusCode === 403)) {
        console.log("[send-notification-email] Retrying OTP with Resend test domain...");
        const { data: retryResult, error: retryError } = await resend.emails.send({
          from: "Desh <onboarding@resend.dev>",
          to: [authData.user.email],
          subject: rendered.subject,
          html: rendered.html,
        });
        if (retryError) {
          await logSend(supabase, user_id, type, rendered.templateSlug, authData.user.email, rendered.subject, "failed", (retryError as any).message);
          throw retryError;
        }
        console.log("[send-notification-email] OTP sent via test domain, id:", retryResult?.id);
        await logSend(supabase, user_id, type, rendered.templateSlug, authData.user.email, rendered.subject, "sent");
      } else {
        await logSend(supabase, user_id, type, rendered.templateSlug, authData.user.email, rendered.subject, "failed", (sendError as any).message);
        throw sendError;
      }
    } else {
      console.log(`[send-notification-email] ${type} sent, resend id:`, sendResult?.id);
      await logSend(supabase, user_id, type, rendered.templateSlug, authData.user.email, rendered.subject, "sent");
    }

    if (!bypassOtpGuards) {
      await supabase.from("email_rate_limits").upsert(
        { user_id, email_type: type, sent_at: new Date().toISOString() },
        { onConflict: "user_id,email_type" }
      );
    }

    return new Response(JSON.stringify({ sent: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("send-notification-email error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
