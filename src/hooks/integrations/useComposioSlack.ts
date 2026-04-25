import { useCallback } from "react";
import { useComposioProxy } from "./useComposioProxy";
import { useComposioConnection } from "./useComposioConnection";

export interface SlackChannel {
  id: string;
  name: string;
  is_private?: boolean;
  num_members?: number;
}

export interface SlackMessage {
  ts: string;
  text: string;
  user?: string;
  type?: string;
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

export function useComposioSlack() {
  const { callComposioProxy } = useComposioProxy();
  const { isConnected } = useComposioConnection();

  const connected = isConnected("slack");

  const listChannels = useCallback(async (): Promise<SlackChannel[]> => {
    const data = await callComposioProxy({
      service: "slack",
      path: "/conversations",
      method: "GET",
    });
    return extractArray<SlackChannel>(data, 'channels', 'items');
  }, [callComposioProxy]);

  const getChannelHistory = useCallback(async (channelId: string): Promise<SlackMessage[]> => {
    const data = await callComposioProxy({
      service: "slack",
      path: "/history",
      method: "GET",
      params: { channel: channelId },
    });
    return extractArray<SlackMessage>(data, 'messages', 'items');
  }, [callComposioProxy]);

  const sendMessage = useCallback(async (channel: string, text: string) => {
    return callComposioProxy({
      service: "slack",
      path: "/send",
      method: "POST",
      data: { channel, text },
    });
  }, [callComposioProxy]);

  const listMembers = useCallback(async () => {
    const data = await callComposioProxy({
      service: "slack",
      path: "/members",
      method: "GET",
    });
    return extractArray(data, 'members', 'items');
  }, [callComposioProxy]);

  return { connected, listChannels, getChannelHistory, sendMessage, listMembers };
}
