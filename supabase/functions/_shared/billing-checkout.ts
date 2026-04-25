import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import Stripe from "npm:stripe@18.5.0";
import { jsonResponse, errorResponse } from "./utils.ts";

export async function handleCreateCheckout(params: Record<string, any>, userId: string) {
  const { mode, package_id, credits, reference_package_id, coupon_code } = params;
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let { data: sub } = await supabase.from("user_subscriptions").select("stripe_customer_id").eq("user_id", userId).single();
  let customerId = sub?.stripe_customer_id;

  if (!customerId) {
    const { data: { user } } = await supabase.auth.admin.getUserById(userId);
    const customer = await stripe.customers.create({ email: user?.email, metadata: { user_id: userId } });
    customerId = customer.id;
    await supabase.from("user_subscriptions").update({ stripe_customer_id: customerId }).eq("user_id", userId);
  }

  const baseUrl = Deno.env.get("DESH_BASE_URL") || "https://desh.life";

  let discounts: { promotion_code: string }[] | undefined;
  if (coupon_code) {
    const { data: coupon } = await supabase.from("coupons").select("id, type, value, active, expires_at, max_uses, used_count, stripe_promotion_code_id").eq("code", coupon_code.toUpperCase()).eq("active", true).single();
    if (coupon?.type === "percent" && coupon.stripe_promotion_code_id) {
      const expired = coupon.expires_at && new Date(coupon.expires_at) < new Date();
      const maxed = coupon.max_uses !== null && coupon.used_count >= coupon.max_uses;
      if (!expired && !maxed) discounts = [{ promotion_code: coupon.stripe_promotion_code_id }];
    }
  }

  let sessionParams: any;

  if (mode === "credits" && package_id) {
    const { data: pkg, error: pkgError } = await supabase.from("credit_packages").select("id, name, credits, price_brl, stripe_price_id").eq("id", package_id).eq("active", true).single();
    if (pkgError || !pkg) throw new Error("Pacote não encontrado ou inativo");
    if (!pkg.stripe_price_id) throw new Error("Pacote sem preço Stripe configurado.");
    sessionParams = {
      customer: customerId, mode: "payment",
      line_items: [{ price: pkg.stripe_price_id, quantity: 1 }],
      success_url: `${baseUrl}/billing?checkout=success`, cancel_url: `${baseUrl}/billing?checkout=cancel`,
      metadata: { user_id: userId, mode: "credits", credits: String(pkg.credits), package_id: pkg.id, package_name: pkg.name, coupon_code: coupon_code || "" },
    };
  } else if (mode === "custom_credits" && credits && reference_package_id) {
    const qty = Number(credits);
    if (!Number.isInteger(qty) || qty < 100 || qty % 100 !== 0) throw new Error("Quantidade deve ser múltiplo de 100 e mínimo 100");
    const { data: refPkg, error: refError } = await supabase.from("credit_packages").select("id, name, credits, price_brl, unit_price").eq("id", reference_package_id).eq("active", true).single();
    if (refError || !refPkg) throw new Error("Pacote de referência não encontrado");
    const pricePerCreditCentavos = Math.round((refPkg.price_brl / refPkg.credits) * 100);
    sessionParams = {
      customer: customerId, mode: "payment",
      line_items: [{ price_data: { currency: "brl", unit_amount: pricePerCreditCentavos, product_data: { name: `${qty} Créditos DESH`, description: `Compra avulsa na faixa ${refPkg.name}` } }, quantity: qty }],
      success_url: `${baseUrl}/billing?checkout=success`, cancel_url: `${baseUrl}/billing?checkout=cancel`,
      metadata: { user_id: userId, mode: "custom_credits", credits: String(qty), reference_package_id: refPkg.id, reference_package_name: refPkg.name, coupon_code: coupon_code || "" },
    };
  } else {
    throw new Error("Modo inválido. Use: credits ou custom_credits");
  }

  if (discounts) sessionParams.discounts = discounts;
  const session = await stripe.checkout.sessions.create(sessionParams);
  return jsonResponse({ url: session.url });
}
