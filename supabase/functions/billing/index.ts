/**
 * @function billing
 * @description Checkout e gerenciamento de billing (Stripe)
 * @status active
 * @calledBy BillingPage
 */
import { corsHeaders, handleCors, errorResponse } from "../_shared/utils.ts";
import { verifyAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  try {
    // auto-purchase is a cron job — no user auth needed
    const body = await req.json();
    const { type, ...params } = body;

    if (type === "auto-purchase") {
      const { handleAutoPurchase } = await import("../_shared/billing-auto-purchase.ts");
      return await handleAutoPurchase();
    }

    // All other actions require auth
    const authResult = await verifyAuth(req);
    if (authResult instanceof Response) {
      return new Response(authResult.body, {
        status: authResult.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authResult.userId;

    switch (type) {
      case "checkout": {
        const { handleCreateCheckout } = await import("../_shared/billing-checkout.ts");
        return await handleCreateCheckout(params, userId);
      }
      case "subscription": {
        const { handleManageSubscription } = await import("../_shared/billing-subscription.ts");
        return await handleManageSubscription(params, userId);
      }
      case "details": {
        const { handleBillingDetails } = await import("../_shared/billing-details-handler.ts");
        return await handleBillingDetails(params, userId);
      }
      case "coupons": {
        const { handleManageCoupons } = await import("../_shared/billing-coupons.ts");
        return await handleManageCoupons(params, userId);
      }
      default:
        return errorResponse(400, `Unknown type: ${type}`);
    }
  } catch (e: any) {
    console.error("billing error:", e);
    return errorResponse(500, e.message || "Internal error");
  }
});
