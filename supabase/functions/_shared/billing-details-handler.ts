import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import Stripe from "npm:stripe@18.5.0";
import { jsonResponse } from "./utils.ts";

export async function handleBillingDetails(params: Record<string, any>, userId: string) {
  const { action } = params;
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: sub } = await supabase.from("user_subscriptions").select("*").eq("user_id", userId).single();
  const { data: credits } = await supabase.from("user_credits").select("balance, total_earned, total_spent").eq("user_id", userId).single();
  const customerId = sub?.stripe_customer_id;

  if (action === "overview") {
    let customer = null, paymentMethods: any[] = [], subscriptionData = null, upcomingInvoice = null;
    if (customerId) {
      customer = await stripe.customers.retrieve(customerId);
      const pmList = await stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 5 });
      paymentMethods = pmList.data.map((pm: any) => ({
        id: pm.id, brand: pm.card?.brand, last4: pm.card?.last4, exp_month: pm.card?.exp_month, exp_year: pm.card?.exp_year,
        is_default: pm.id === (customer as any)?.invoice_settings?.default_payment_method,
      }));
      if (sub?.stripe_subscription_id) { try { subscriptionData = await stripe.subscriptions.retrieve(sub.stripe_subscription_id); } catch {} }
      try { upcomingInvoice = await stripe.invoices.retrieveUpcoming({ customer: customerId }); } catch {}
    }
    return jsonResponse({
      subscription: sub, credits,
      customer: customer ? { name: (customer as any).name, email: (customer as any).email, phone: (customer as any).phone, address: (customer as any).address } : null,
      payment_methods: paymentMethods,
      stripe_subscription: subscriptionData ? { status: (subscriptionData as any).status, cancel_at_period_end: (subscriptionData as any).cancel_at_period_end, current_period_end: (subscriptionData as any).current_period_end, current_period_start: (subscriptionData as any).current_period_start } : null,
      upcoming_invoice: upcomingInvoice ? { amount_due: (upcomingInvoice as any).amount_due, currency: (upcomingInvoice as any).currency, next_payment_attempt: (upcomingInvoice as any).next_payment_attempt } : null,
    });
  }

  if (action === "invoices") {
    if (!customerId) return jsonResponse({ invoices: [] });
    const invoiceList = await stripe.invoices.list({ customer: customerId, limit: 50 });
    const invoices = invoiceList.data.map((inv: any) => ({
      id: inv.id, number: inv.number, status: inv.status, amount_due: inv.amount_due, amount_paid: inv.amount_paid,
      currency: inv.currency, created: inv.created, period_start: inv.period_start, period_end: inv.period_end,
      invoice_pdf: inv.invoice_pdf, hosted_invoice_url: inv.hosted_invoice_url,
      description: inv.description || inv.lines?.data?.[0]?.description || "Assinatura DESH",
    }));
    return jsonResponse({ invoices });
  }

  if (action === "portal") {
    if (!customerId) return jsonResponse({ error: "Nenhum cliente Stripe encontrado." }, 400);
    const baseUrl = Deno.env.get("DESH_BASE_URL") || "https://desh.life";
    const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${baseUrl}/billing` });
    return jsonResponse({ url: session.url });
  }

  if (action === "update_package") {
    const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", userId).single();
    if (role?.role !== "admin") return jsonResponse({ error: "Unauthorized" }, 403);

    const { package_id, name, credits, price_brl, unit_price } = params;
    if (!package_id) return jsonResponse({ error: "package_id required" }, 400);

    // Update the DB
    const { error: dbErr } = await supabase.from("credit_packages").update({
      name, credits, price_brl, unit_price,
    } as any).eq("id", package_id);
    if (dbErr) return jsonResponse({ error: dbErr.message }, 500);

    // Sync with Stripe: prices are immutable so we create a new one
    let stripe_synced = false;
    try {
      const { data: pkg } = await supabase.from("credit_packages").select("*").eq("id", package_id).single();
      if (pkg) {
        // Archive old price if exists
        if (pkg.stripe_price_id) {
          try { await stripe.prices.update(pkg.stripe_price_id, { active: false }); } catch {}
        }
        // Create new product + price
        const product = await stripe.products.create({
          name: `DESH - ${name}`,
          description: `${credits.toLocaleString()} créditos para o DESH`,
          metadata: { desh_package_id: package_id, credits: String(credits) },
        });
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: Math.round(price_brl * 100),
          currency: "brl",
          metadata: { desh_package_id: package_id },
        });
        await supabase.from("credit_packages").update({ stripe_price_id: price.id } as any).eq("id", package_id);
        stripe_synced = true;
      }
    } catch (e) {
      console.error("Stripe sync failed:", (e as Error).message);
    }

    await supabase.from("admin_logs").insert({
      user_id: userId,
      action: "package_updated",
      details: { package_id, name, credits, price_brl, unit_price, stripe_synced },
    });

    return jsonResponse({ success: true, stripe_synced });
  }

  if (action === "sync_packages") {
    const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", userId).single();
    if (role?.role !== "admin") return jsonResponse({ error: "Unauthorized" }, 403);
    const { data: packages } = await supabase.from("credit_packages").select("*").order("credits", { ascending: true });
    if (!packages) return jsonResponse({ error: "No packages found" }, 404);
    const results: any[] = [];
    for (const pkg of packages) {
      try {
        if (pkg.stripe_price_id) { try { await stripe.prices.retrieve(pkg.stripe_price_id); results.push({ id: pkg.id, name: pkg.name, status: "exists", stripe_price_id: pkg.stripe_price_id }); continue; } catch {} }
        const product = await stripe.products.create({ name: `DESH - ${pkg.name}`, description: `${pkg.credits.toLocaleString()} créditos para o DESH`, metadata: { desh_package_id: pkg.id, credits: String(pkg.credits) } });
        const price = await stripe.prices.create({ product: product.id, unit_amount: Math.round(pkg.price_brl * 100), currency: "brl", metadata: { desh_package_id: pkg.id } });
        await supabase.from("credit_packages").update({ stripe_price_id: price.id } as any).eq("id", pkg.id);
        results.push({ id: pkg.id, name: pkg.name, status: "created", stripe_product_id: product.id, stripe_price_id: price.id });
      } catch (e) { results.push({ id: pkg.id, name: pkg.name, status: "error", error: (e as Error).message }); }
    }
    await supabase.from("admin_logs").insert({ user_id: userId, action: "stripe_packages_synced", details: { results } });
    return jsonResponse({ results });
  }

  throw new Error("Ação inválida");
}
