import { useMemo } from "react";
import { useComposioConnection } from "@/hooks/integrations/useComposioConnection";

/** Deterministic colors for account differentiation */
const ACCOUNT_COLORS = [
  "hsl(210, 80%, 55%)",
  "hsl(150, 70%, 45%)",
  "hsl(280, 65%, 55%)",
  "hsl(25, 90%, 55%)",
  "hsl(340, 75%, 55%)",
  "hsl(180, 60%, 45%)",
];

export function useGmailConnections() {
  const { isConnected } = useComposioConnection();

  const hasGmail = isConnected("gmail");

  // Synthetic connection list for Composio-based Gmail
  const gmailConnections = useMemo(
    () => hasGmail
      ? [{ id: "composio-gmail", email: "Gmail (Composio)", display_name: "Gmail", scopes: ["gmail"] }]
      : [],
    [hasGmail]
  );

  const accountInfoMap = useMemo(
    () => new Map(gmailConnections.map((c, i) => [
      c.id,
      { email: c.email || c.display_name || "Gmail", color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length] },
    ])),
    [gmailConnections]
  );

  return { gmailConnections, accountInfoMap };
}
