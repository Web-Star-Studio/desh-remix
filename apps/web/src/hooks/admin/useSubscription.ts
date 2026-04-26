// Wave 6a — Stripe + credit ledger migration is pending. Until then this hook
// returns inert defaults so CreditsBadge / SubscriptionBanner / billing surfaces
// render without spamming the legacy Supabase project (RLS now rejects every
// query because user.id is a Cognito sub, not a Supabase auth.uid).
//
// The backend `/billing/*` routes will land in Wave 6a — at that point this
// file gets a real React Query implementation against apps/api.

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
  const subscription: Subscription | null = null;
  const credits: Credits | null = null;
  const isActive = false;
  const hasActiveCredits = false;

  const refetchSub = async () => {};
  const refetchCredits = async () => {};

  const createCheckout = async (
    _mode: string,
    _packageId?: string,
    _customCredits?: number,
    _referencePackageId?: string,
    _couponCode?: string,
  ) => {
    throw new Error("billing_not_migrated_yet");
  };

  const openBillingPortal = async () => {
    throw new Error("billing_not_migrated_yet");
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
