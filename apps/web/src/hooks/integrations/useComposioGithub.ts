import { useCallback } from "react";
import { useComposioProxy } from "./useComposioProxy";
import { useComposioConnection } from "./useComposioConnection";

export interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  description?: string;
  html_url?: string;
  stargazers_count?: number;
  language?: string;
  private?: boolean;
  updated_at?: string;
}

export interface GithubIssue {
  id: number;
  number: number;
  title: string;
  state: string;
  body?: string;
  html_url?: string;
  created_at?: string;
  labels?: { name: string; color?: string }[];
}

export interface GithubNotification {
  id: string;
  reason: string;
  subject: { title: string; type: string; url?: string };
  repository?: { full_name: string };
  updated_at?: string;
  unread?: boolean;
}

/** Safe array extraction from Composio response shapes */
function extractArray<T>(data: any, ...keys: string[]): T[] {
  if (Array.isArray(data)) return data;
  for (const key of keys) {
    const val = data?.[key] ?? data?.data?.[key];
    if (Array.isArray(val)) return val;
  }
  // Last resort: if data itself looks like a single item, wrap it
  if (data && typeof data === 'object' && !data.error) {
    return Array.isArray(data.data) ? data.data : [];
  }
  return [];
}

export function useComposioGithub() {
  const { callComposioProxy } = useComposioProxy();
  const { isConnected } = useComposioConnection();

  const connected = isConnected("github");

  const listRepos = useCallback(async (): Promise<GithubRepo[]> => {
    const data = await callComposioProxy({
      service: "github",
      path: "/repos",
      method: "GET",
    });
    return extractArray<GithubRepo>(data, 'repositories', 'items');
  }, [callComposioProxy]);

  const getRepo = useCallback(async (owner: string, repo: string) => {
    return callComposioProxy({
      service: "github",
      path: `/repos/${owner}/${repo}`,
      method: "GET",
    });
  }, [callComposioProxy]);

  const listIssues = useCallback(async (owner: string, repo: string): Promise<GithubIssue[]> => {
    const data = await callComposioProxy({
      service: "github",
      path: `/repos/${owner}/${repo}/issues`,
      method: "GET",
    });
    return extractArray<GithubIssue>(data, 'issues', 'items');
  }, [callComposioProxy]);

  const createIssue = useCallback(async (owner: string, repo: string, title: string, body?: string) => {
    return callComposioProxy({
      service: "github",
      path: `/repos/${owner}/${repo}/issues`,
      method: "POST",
      data: { title, body },
    });
  }, [callComposioProxy]);

  const listNotifications = useCallback(async (): Promise<GithubNotification[]> => {
    const data = await callComposioProxy({
      service: "github",
      path: "/notifications",
      method: "GET",
    });
    return extractArray<GithubNotification>(data, 'notifications', 'items');
  }, [callComposioProxy]);

  return { connected, listRepos, getRepo, listIssues, createIssue, listNotifications };
}
