// TODO: Migrar para edge function — acesso direto ao Supabase
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

interface Subscription {
  plan: string;
  status: "active" | "past_due" | "canceled" | "expired";
  trial_ends_at: string | null;
  current_period_end: string | null;
}

interface Credits {
  balance: number;
  total_earned: number;
  total_spent: number;
}

export function useSubscription() {
  const { user } = useAuth();

  const { data: subscription, refetch: refetchSub } = useQuery({
    queryKey: ["subscription", user?.id],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_subscriptions")
        .select("plan, status, trial_ends_at, current_period_end")
        .eq("user_id", user.id)
        .single();
      return data as Subscription | null;
    },
    enabled: !!user,
  });

  const { data: credits, refetch: refetchCredits } = useQuery({
    queryKey: ["credits", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_credits")
        .select("balance, total_earned, total_spent")
        .eq("user_id", user.id)
        .single();
      return data as Credits | null;
    },
    enabled: !!user,
  });

  // Realtime listener for credits
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("credits-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_credits", filter: `user_id=eq.${user.id}` },
        () => refetchCredits()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, refetchCredits]);

  const isActive = subscription?.status === "active";
  const hasActiveCredits = (credits?.balance ?? 0) > 0;

  const createCheckout = async (mode: string, packageId?: string, customCredits?: number, referencePackageId?: string, couponCode?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const body: any = { mode };
    if (packageId) body.package_id = packageId;
    if (customCredits) body.credits = customCredits;
    if (referencePackageId) body.reference_package_id = referencePackageId;
    if (couponCode) body.coupon_code = couponCode;

    const res = await supabase.functions.invoke("billing", { body: { type: "checkout", ...body } });
    if (res.error) throw res.error;
    if (res.data?.url) window.location.href = res.data.url;
  };

  const openBillingPortal = async () => {
    const res = await supabase.functions.invoke("billing", {
      body: { type: "details", action: "portal" },
    });
    if (res.data?.url) window.location.href = res.data.url;
  };

  return {
    subscription,
    credits,
    isActive,
    hasActiveCredits,
    createCheckout,
    openBillingPortal,
    refetchSub,
    refetchCredits,
  };
}
