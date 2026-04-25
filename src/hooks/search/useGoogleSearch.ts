import { useState, useCallback } from "react";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { useComposioWorkspaceId } from "@/hooks/integrations/useComposioWorkspaceId";
import type { GoogleSearchItem } from "@/components/search/GoogleSearchResults";

export function useGoogleSearch() {
  const { invoke } = useEdgeFn();
  const composioWsId = useComposioWorkspaceId();
  const wsInvoke = useCallback(<T,>(opts: { fn: string; body: Record<string, any> }) => {
    const body = { ...opts.body, workspace_id: composioWsId, default_workspace_id: composioWsId };
    return invoke<T>({ ...opts, body });
  }, [invoke, composioWsId]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GoogleSearchItem[]>([]);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setLoading(true);
    setResults([]);
    const q = query.trim().toLowerCase();

    try {
      const [gmailRes, calendarRes, driveRes, contactsRes] = await Promise.allSettled([
        wsInvoke<any>({
          fn: "composio-proxy",
          body: { service: "gmail", path: "/gmail/v1/users/me/messages", method: "GET", params: { q, maxResults: "8" } },
        }),
        wsInvoke<any>({
          fn: "composio-proxy",
          body: {
            service: "calendar",
            path: "/calendars/primary/events",
            method: "GET",
            params: { q, maxResults: "8", orderBy: "startTime", singleEvents: "true", timeMin: new Date(Date.now() - 365 * 86400000).toISOString() },
          },
        }),
        wsInvoke<any>({
          fn: "composio-proxy",
          body: {
            service: "drive",
            path: "/files",
            method: "GET",
            params: { q: `name contains '${query.trim().replace(/'/g, "\\'")}'`, pageSize: "8", fields: "files(id,name,mimeType,modifiedTime,webViewLink)" },
          },
        }),
        wsInvoke<any>({
          fn: "composio-proxy",
          body: {
            service: "people",
            path: "/people:searchContacts",
            method: "GET",
            params: { query: query.trim(), readMask: "names,emailAddresses,phoneNumbers", pageSize: "8" },
          },
        }),
      ]);

      const items: GoogleSearchItem[] = [];

      // Parse Gmail
      if (gmailRes.status === "fulfilled" && gmailRes.value.data?.messages) {
        const msgs = gmailRes.value.data.messages as any[];
        msgs.forEach((msg: any) => {
          const headers = msg.payload?.headers || [];
          const subjectH = headers.find((h: any) => h.name === "Subject");
          const fromH = headers.find((h: any) => h.name === "From");
          const dateH = headers.find((h: any) => h.name === "Date");
          items.push({
            type: "email",
            id: msg.id,
            title: subjectH?.value || msg.snippet || "(Sem assunto)",
            subtitle: fromH?.value || "",
            date: dateH?.value ? new Date(dateH.value).toLocaleDateString("pt-BR") : undefined,
            url: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`,
          });
        });
      }

      // Parse Calendar
      if (calendarRes.status === "fulfilled" && calendarRes.value.data?.items) {
        (calendarRes.value.data.items as any[]).forEach((ev: any) => {
          items.push({
            type: "event",
            id: ev.id,
            title: ev.summary || "(Sem título)",
            subtitle: ev.location || ev.description?.slice(0, 80) || "",
            date: ev.start?.dateTime ? new Date(ev.start.dateTime).toLocaleDateString("pt-BR") : ev.start?.date,
            url: ev.htmlLink,
          });
        });
      }

      // Parse Drive
      if (driveRes.status === "fulfilled" && driveRes.value.data?.files) {
        (driveRes.value.data.files as any[]).forEach((f: any) => {
          items.push({
            type: "file",
            id: f.id,
            title: f.name,
            subtitle: f.mimeType?.split(".").pop() || "arquivo",
            date: f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString("pt-BR") : undefined,
            url: f.webViewLink,
          });
        });
      }

      // Parse Contacts
      if (contactsRes.status === "fulfilled" && contactsRes.value.data?.results) {
        (contactsRes.value.data.results as any[]).forEach((r: any) => {
          const person = r.person;
          if (!person) return;
          const name = person.names?.[0]?.displayName || "";
          const email = person.emailAddresses?.[0]?.value || "";
          const phone = person.phoneNumbers?.[0]?.value || "";
          items.push({
            type: "contact",
            id: person.resourceName || name,
            title: name,
            subtitle: [email, phone].filter(Boolean).join(" · "),
          });
        });
      }

      setResults(items);
    } catch (err) {
      console.error("Google search error:", err);
    } finally {
      setLoading(false);
    }
  }, [wsInvoke]);

  return { search, results, loading };
}
