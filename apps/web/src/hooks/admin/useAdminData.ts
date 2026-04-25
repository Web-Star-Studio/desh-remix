// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UserStats {
  total_users: number;
  total_data_rows: number;
  total_connections: number;
  users_today: number;
  users_this_week: number;
  users_this_month: number;
}

export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  data_count: number;
  suspended_at: string | null;
  suspended_reason: string | null;
  banned_at: string | null;
  banned_reason: string | null;
  archived_at: string | null;
  archived_reason: string | null;
  archive_expires_at: string | null;
  credits_balance: number;
  credits_spent: number;
  subscription_status: string | null;
  subscription_plan: string | null;
  workspaces_count: number;
  tasks_count: number;
  notes_count: number;
  connections_count: number;
}

interface AdminLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  details: Record<string, any>;
  created_at: string;
}

export const useAdminData = () => {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_get_user_stats");
    if (!error && data) setStats(data as unknown as UserStats);
  }, []);

  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_list_users");
    if (!error && data) setUsers((data as unknown as AdminUser[]) || []);
  }, []);

  const fetchLogs = useCallback(async () => {
    const { data, error } = await supabase
      .from("admin_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error) setLogs((data as AdminLog[]) || []);
  }, []);

  const obfuscateEmail = (email?: string) => {
    if (!email) return null;
    const [local, domain] = email.split("@");
    if (!domain) return email;
    return `${local[0]}${"*".repeat(Math.max(1, local.length - 2))}${local.length > 1 ? local[local.length - 1] : ""}@${domain}`;
  };

  const logAction = useCallback(async (action: string, details: Record<string, any> = {}) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("admin_logs").insert({
      user_id: user?.id,
      user_email: obfuscateEmail(user?.email),
      action,
      details: details as any,
    } as any);
  }, []);

  const setUserRole = useCallback(async (targetUserId: string, newRole: "admin" | "user", targetEmail: string) => {
    const { error } = await supabase.rpc("admin_set_user_role", {
      _target_user_id: targetUserId,
      _new_role: newRole,
    } as any);
    if (error) throw error;
    await logAction("role_change", { target_user_id: targetUserId, target_email: targetEmail, new_role: newRole });
    await refresh();
  }, [logAction]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchUsers(), fetchLogs()]);
    setLoading(false);
  }, [fetchStats, fetchUsers, fetchLogs]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stats, users, logs, loading, refresh, logAction, setUserRole };
};
