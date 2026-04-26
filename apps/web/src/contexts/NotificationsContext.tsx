// Wave 6b — broadcasts/AI-insights/dismissals tables move to apps/api as part of
// the admin/notifications wave. Until then this provider returns inert defaults
// so components that depend on `useNotifications()` (NotificationsBell, etc)
// render without spamming the legacy Supabase project. The realtime channel
// subscription is also gone — its websocket was failing with "closed before
// connection is established" because Supabase auth.uid() != Cognito sub.

import { createContext, useContext, useMemo, type ReactNode } from "react";

export interface Broadcast {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success";
  action_url: string | null;
  created_at: string;
  active?: boolean;
}

interface NotificationsContextValue {
  broadcasts: Broadcast[];
  dismissedIds: Set<string>;
  visible: Broadcast[];
  dismissed: Broadcast[];
  unreadCount: number;
  loading: boolean;
  dismiss: (id: string) => Promise<void>;
  undismiss: (id: string) => Promise<void>;
  dismissAll: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
};

const EMPTY_LIST: Broadcast[] = [];
const EMPTY_SET: Set<string> = new Set();
const noopAsync = async () => {};

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const value = useMemo<NotificationsContextValue>(
    () => ({
      broadcasts: EMPTY_LIST,
      dismissedIds: EMPTY_SET,
      visible: EMPTY_LIST,
      dismissed: EMPTY_LIST,
      unreadCount: 0,
      loading: false,
      dismiss: noopAsync,
      undismiss: noopAsync,
      dismissAll: noopAsync,
    }),
    [],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};
