import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import Stripe from "npm:stripe@18.5.0";
import { corsHeaders, jsonResponse, errorResponse } from "./utils.ts";

export async function handleManageCoupons(params: Record<string, any>, userId: string) {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: hasRole } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!hasRole) return jsonResponse({ error: "Unauthorized" }, 403);

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");
  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

  const { action, ...rest } = params;
  const couponType = rest.coupon_type || rest.type;

  if (action === "create") {
    const { code, value, max_uses, expires_at } = rest;
    const type = couponType;
    let stripeCouponId: string | null = null, stripePromoId: string | null = null;
    if (type === "percent") {
      const coupon = await stripe.coupons.create({ percent_off: value, duration: "once", name: `DESH ${code} (${value}% off)` });
      stripeCouponId = coupon.id;
      const promo = await stripe.promotionCodes.create({ coupon: coupon.id, code: code.toUpperCase(), max_redemptions: max_uses || undefined, expires_at: expires_at ? Math.floor(new Date(expires_at).getTime() / 1000) : undefined });
      stripePromoId = promo.id;
    }
    const { data: couponRow, error } = await supabase.from("coupons").insert({ code: code.toUpperCase(), type, value: parseFloat(value), max_uses: max_uses ? parseInt(max_uses) : null, expires_at: expires_at || null, created_by: userId, stripe_coupon_id: stripeCouponId, stripe_promotion_code_id: stripePromoId }).select().single();
    if (error) throw error;
    return jsonResponse({ success: true, coupon: couponRow });
  }

  if (action === "toggle") {
    const { id, active } = rest;
    const { data: coupon } = await supabase.from("coupons").select("*").eq("id", id).single();
    if (!coupon) throw new Error("Coupon not found");
    if (coupon.stripe_promotion_code_id) await stripe.promotionCodes.update(coupon.stripe_promotion_code_id, { active });
    await supabase.from("coupons").update({ active }).eq("id", id);
    return jsonResponse({ success: true });
  }

  if (action === "delete") {
    const { id } = rest;
    const { data: coupon } = await supabase.from("coupons").select("*").eq("id", id).single();
    if (!coupon) throw new Error("Coupon not found");
    if (coupon.stripe_promotion_code_id) await stripe.promotionCodes.update(coupon.stripe_promotion_code_id, { active: false });
    await supabase.from("coupons").delete().eq("id", id);
    return jsonResponse({ success: true });
  }

  throw new Error("Invalid action. Use: create, toggle, delete");
}
