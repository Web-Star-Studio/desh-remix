/**
 * Smart error message system — maps technical error codes to
 * user-friendly (Portuguese) messages and admin debug toasts.
 */

import type { EdgeFnErrorCode } from "@/hooks/ai/useEdgeFn";

export interface ErrorDetail {
  code?: EdgeFnErrorCode | string;
  message?: string;
  module?: string;
  stack?: string;
  fn?: string;
  severity?: "warning" | "error" | "critical";
  /** If true, persist to DB but do NOT show a toast (caller handles UI) */
  silent?: boolean;
  /** Extra context (e.g. HTTP status, balance) */
  meta?: Record<string, unknown>;
}

interface SmartMessages {
  adminTitle: string;
  adminDescription?: string;
  userTitle: string;
  userDescription: string;
}

const USER_FRIENDLY: string[] = [
  "Ops, algo não saiu como esperado. Já estamos cuidando!",
  "Pequeno tropeço, mas nada grave. Tente de novo.",
  "Estamos ajustando algo. Tente novamente em instantes.",
  "Algo não funcionou. Já estamos de olho!",
  "Um deslize rápido — tente novamente.",
];

let friendlyIndex = 0;
function nextFriendlyMessage(): string {
  const msg = USER_FRIENDLY[friendlyIndex % USER_FRIENDLY.length];
  friendlyIndex++;
  return msg;
}

export function getSmartMessages(detail: ErrorDetail): SmartMessages {
  const code = detail.code || "unknown";
  const mod = detail.module ? `[${detail.module}]` : "";
  const fn = detail.fn || "";

  switch (code) {
    case "timeout":
      return {
        adminTitle: `⏱️ Timeout ${mod} ${fn}`.trim(),
        adminDescription: detail.message || "A requisição excedeu o tempo limite",
        userTitle: "Demorou mais que o esperado",
        userDescription: "Tente novamente em alguns instantes.",
      };

    case "bad_gateway":
      return {
        adminTitle: `🔌 502 ${mod} ${fn}`.trim(),
        adminDescription: detail.message || "Resposta inválida do servidor",
        userTitle: "Serviço temporariamente indisponível",
        userDescription: "Estamos trabalhando para restabelecer. Tente em breve.",
      };

    case "session_expired":
      return {
        adminTitle: `🔐 Sessão expirada ${mod}`.trim(),
        adminDescription: detail.message,
        userTitle: "Sessão expirada",
        userDescription: "Faça login novamente para continuar.",
      };

    case "insufficient_credits":
      return {
        adminTitle: `💳 Créditos insuficientes ${mod}`.trim(),
        adminDescription: detail.message,
        userTitle: "Créditos insuficientes",
        userDescription: "Adquira mais créditos para continuar usando.",
      };

    case "not_connected":
      return {
        adminTitle: `🔗 Não conectado ${mod} ${fn}`.trim(),
        adminDescription: detail.message,
        userTitle: "Serviço não conectado",
        userDescription: "Conecte o serviço para usar este recurso.",
      };

    case "widget_crash":
      return {
        adminTitle: `💥 Widget crash ${mod}`.trim(),
        adminDescription: detail.message || "Componente falhou ao renderizar",
        userTitle: "Widget encontrou um problema",
        userDescription: "Tente recarregar esta seção.",
      };

    default:
      return {
        adminTitle: `🐛 Erro ${mod} ${fn}`.trim(),
        adminDescription: detail.stack
          ? `${detail.message}\n${detail.stack.slice(0, 300)}`
          : detail.message || "Erro desconhecido",
        userTitle: "Algo deu errado",
        userDescription: nextFriendlyMessage(),
      };
  }
}

/** Infer module from error message or stack */
export function inferModule(error: string | Error): string | undefined {
  const text = typeof error === "string" ? error : `${error.message} ${error.stack || ""}`;
  const lower = text.toLowerCase();

  if (lower.includes("whatsapp") || lower.includes("evolution")) return "whatsapp";
  if (lower.includes("finance") || lower.includes("pluggy") || lower.includes("financial")) return "finance";
  if (lower.includes("email") || lower.includes("gmail") || lower.includes("composio")) return "email";
  if (lower.includes("calendar")) return "calendar";
  if (lower.includes("contact")) return "contacts";
  if (lower.includes("task")) return "tasks";
  if (lower.includes("file") || lower.includes("storage")) return "files";
  if (lower.includes("ai") || lower.includes("pandora") || lower.includes("gemini") || lower.includes("gpt")) return "ai";
  if (lower.includes("auth") || lower.includes("session") || lower.includes("jwt")) return "auth";
  if (lower.includes("credit") || lower.includes("billing") || lower.includes("stripe")) return "billing";
  return undefined;
}
