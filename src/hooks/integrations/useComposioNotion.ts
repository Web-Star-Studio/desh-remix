import { useCallback } from "react";
import { useComposioProxy } from "./useComposioProxy";
import { useComposioConnection } from "./useComposioConnection";

export interface NotionPage {
  id: string;
  title?: string;
  url?: string;
  created_time?: string;
  last_edited_time?: string;
  icon?: { type?: string; emoji?: string };
}

export interface NotionDatabase {
  id: string;
  title?: string;
  description?: string;
  url?: string;
}

/** Safe array extraction from Composio response shapes */
function extractArray<T>(data: any, ...keys: string[]): T[] {
  if (Array.isArray(data)) return data;
  for (const key of keys) {
    const val = data?.[key] ?? data?.data?.[key];
    if (Array.isArray(val)) return val;
  }
  if (data && typeof data === 'object' && !data.error) {
    return Array.isArray(data.data) ? data.data : [];
  }
  return [];
}

export function useComposioNotion() {
  const { callComposioProxy } = useComposioProxy();
  const { isConnected } = useComposioConnection();

  const connected = isConnected("notion");

  const searchPages = useCallback(async (query: string): Promise<NotionPage[]> => {
    const data = await callComposioProxy({
      service: "notion",
      path: "/pages/search",
      method: "GET",
      params: { query },
    });
    return extractArray<NotionPage>(data, 'results', 'pages', 'items');
  }, [callComposioProxy]);

  const getPage = useCallback(async (pageId: string) => {
    return callComposioProxy({
      service: "notion",
      path: `/pages/${pageId}`,
      method: "GET",
    });
  }, [callComposioProxy]);

  const createPage = useCallback(async (properties: Record<string, unknown>) => {
    return callComposioProxy({
      service: "notion",
      path: "/pages",
      method: "POST",
      data: properties,
    });
  }, [callComposioProxy]);

  const listDatabases = useCallback(async (): Promise<NotionDatabase[]> => {
    const data = await callComposioProxy({
      service: "notion",
      path: "/databases/list",
      method: "GET",
    });
    return extractArray<NotionDatabase>(data, 'results', 'databases', 'items');
  }, [callComposioProxy]);

  const queryDatabase = useCallback(async (databaseId: string, filter?: Record<string, unknown>) => {
    const data = await callComposioProxy({
      service: "notion",
      path: `/databases/${databaseId}/query`,
      method: "POST",
      data: filter || {},
    });
    return extractArray(data, 'results', 'items');
  }, [callComposioProxy]);

  return { connected, searchPages, getPage, createPage, listDatabases, queryDatabase };
}
