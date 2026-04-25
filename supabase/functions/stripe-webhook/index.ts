/**
 * @function stripe-webhook
 * @description Webhook Stripe — processa pagamentos e assinaturas
 * @status active
 * @calledBy Stripe platform
 */
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import Stripe from "npm:stripe@18.5.0";
import { corsHeaders } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey) return new Response("Missing STRIPE_SECRET_KEY", { status: 500 });

  // SECURITY: Require webhook secret in production
  if (!webhookSecret) {
    console.error("[stripe-webhook] CRITICAL: STRIPE_WEBHOOK_SECRET not configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const body = await req.text();
  let event: Stripe.Event;

  // Always verify signature when secret is present
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    console.error("[stripe-webhook] Missing stripe-signature header");
    return new Response("Missing stripe-signature header", { status: 400 });
  }
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }


  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const userId = session.metadata?.user_id;
        if (!userId) break;

        // ── Social Addon checkout ──
        if (session.metadata?.type === "social_addon") {
          const workspaceId = session.metadata?.workspace_id;
          if (workspaceId) {
            await supabase.from("social_subscriptions").upsert(
              {
                user_id: userId,
                workspace_id: workspaceId,
                status: "active",
                stripe_subscription_id: session.subscription,
                stripe_customer_id: session.customer,
                stripe_price_id: session.metadata?.price_id || null,
                activated_at: new Date().toISOString(),
                grace_started_at: null,
                grace_ends_at: null,
                deleted_zernio_at: null,
              },
              { onConflict: "user_id,workspace_id" }
            );

            await supabase.from("admin_logs").insert({
              user_id: userId,
              action: "social_addon_activated",
              details: { workspace_id: workspaceId, subscription_id: session.subscription, session_id: session.id },
            });
          }
          break;
        }

        const mode = session.metadata?.mode;

        if (mode === "trial_package") {
          const credits = parseInt(session.metadata?.credits || "0");
          if (credits > 0) {
            await supabase.rpc("add_credits", {
              _user_id: userId,
              _amount: credits,
              _action: "trial_package",
              _description: `Teste grátis - ${credits} créditos`,
            });
          }

          await supabase
            .from("user_subscriptions")
            .update({
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);

          await supabase.from("admin_logs").insert({
            user_id: userId,
            action: "stripe_trial_started",
            details: { credits, package_id: session.metadata?.package_id, session_id: session.id },
          });

        } else if (session.metadata?.credits) {
          const credits = parseInt(session.metadata.credits);
          const description = mode === "custom_credits"
            ? `Compra avulsa de ${credits} créditos (faixa ${session.metadata?.reference_package_name || ""})`
            : `Compra de ${credits} créditos${session.metadata?.package_name ? ` (${session.metadata.package_name})` : ""}`;

          await supabase.rpc("add_credits", {
            _user_id: userId,
            _amount: credits,
            _action: "credit_purchase",
            _description: description,
          });

          await supabase.from("admin_logs").insert({
            user_id: userId,
            action: "stripe_credit_purchase",
            details: {
              credits,
              mode,
              package_id: session.metadata?.package_id,
              package_name: session.metadata?.package_name,
              reference_package_id: session.metadata?.reference_package_id,
              amount_total: session.amount_total,
              currency: session.currency,
              session_id: session.id,
            },
          });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as any;
        const subId = invoice.subscription;
        if (!subId) break;

        const { data: sub } = await supabase
          .from("user_subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", subId)
          .single();

        if (sub) {
          const isTrial = invoice.billing_reason === "subscription_create";
          if (!isTrial) {
            const subData = await stripe.subscriptions.retrieve(subId);
            const credits = parseInt((subData as any).metadata?.credits || "500");
            
            await supabase.rpc("add_credits", {
              _user_id: sub.user_id,
              _amount: credits,
              _action: "subscription_renewal",
              _description: `Renovação - ${credits} créditos`,
            });
          }

          await supabase
            .from("user_subscriptions")
            .update({
              status: "active",
              current_period_start: new Date(invoice.period_start * 1000).toISOString(),
              current_period_end: new Date(invoice.period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", subId);

          await supabase.from("admin_logs").insert({
            user_id: sub.user_id,
            action: "stripe_invoice_paid",
            details: { invoice_id: invoice.id, amount: invoice.amount_paid, currency: invoice.currency, is_trial: isTrial },
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        const subId = invoice.subscription;
        if (!subId) break;

        // Check if this is a social addon subscription
        const { data: socialSub } = await supabase
          .from("social_subscriptions")
          .select("id, user_id, workspace_id")
          .eq("stripe_subscription_id", subId)
          .single();

        if (socialSub) {
          // Social addon: start grace period
          const graceEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          await supabase
            .from("social_subscriptions")
            .update({
              status: "grace",
              grace_started_at: new Date().toISOString(),
              grace_ends_at: graceEndsAt,
            })
            .eq("id", socialSub.id);

          await supabase.from("admin_logs").insert({
            user_id: socialSub.user_id,
            action: "social_addon_payment_failed",
            details: { invoice_id: invoice.id, workspace_id: socialSub.workspace_id, grace_ends_at: graceEndsAt },
          });
          break;
        }

        // Regular credit subscription
        const { data: sub } = await supabase
          .from("user_subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", subId)
          .single();

        if (sub) {
          await supabase
            .from("user_subscriptions")
            .update({ status: "past_due", updated_at: new Date().toISOString() })
            .eq("stripe_subscription_id", subId);

          await supabase.from("admin_logs").insert({
            user_id: sub.user_id,
            action: "stripe_payment_failed",
            details: { invoice_id: invoice.id, attempt_count: invoice.attempt_count },
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        const { data: sub } = await supabase
          .from("user_subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", subscription.id)
          .single();

        if (sub) {
          const statusMap: Record<string, string> = {
            active: "active",
            past_due: "past_due",
            canceled: "canceled",
            unpaid: "past_due",
            trialing: "active",
          };
          await supabase
            .from("user_subscriptions")
            .update({
              status: statusMap[subscription.status] || "active",
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", subscription.id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;

        // Check social addon first
        const { data: socialSubDel } = await supabase
          .from("social_subscriptions")
          .select("id, user_id, workspace_id, status")
          .eq("stripe_subscription_id", subscription.id)
          .single();

        if (socialSubDel) {
          // If not already in grace, start grace period
          if (socialSubDel.status === "active") {
            const graceEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            await supabase
              .from("social_subscriptions")
              .update({
                status: "grace",
                cancelled_at: new Date().toISOString(),
                grace_started_at: new Date().toISOString(),
                grace_ends_at: graceEndsAt,
              })
              .eq("id", socialSubDel.id);
          }

          await supabase.from("admin_logs").insert({
            user_id: socialSubDel.user_id,
            action: "social_addon_subscription_deleted",
            details: { subscription_id: subscription.id, workspace_id: socialSubDel.workspace_id },
          });
          break;
        }

        // Regular subscription
        const { data: sub } = await supabase
          .from("user_subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", subscription.id)
          .single();

        await supabase
          .from("user_subscriptions")
          .update({ status: "canceled", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", subscription.id);

        if (sub) {
          await supabase.from("admin_logs").insert({
            user_id: sub.user_id,
            action: "stripe_subscription_canceled",
            details: { subscription_id: subscription.id },
          });
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as any;
        const customerId = charge.customer;
        if (!customerId) break;

        const { data: sub } = await supabase
          .from("user_subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (sub) {
          // Calculate proportional credits to deduct
          let creditsToDeduct = 0;
          const amountRefunded = charge.amount_refunded; // in centavos
          const amountTotal = charge.amount; // total original charge in centavos

          if (amountTotal > 0 && amountRefunded > 0) {
            // Find original credit transaction for this charge via payment_intent
            const paymentIntentId = charge.payment_intent;
            
            // Look up the checkout session to find credits granted
            if (paymentIntentId) {
              try {
                const sessions = await stripe.checkout.sessions.list({
                  payment_intent: paymentIntentId as string,
                  limit: 1,
                });

                if (sessions.data.length > 0) {
                  const originalSession = sessions.data[0];
                  const originalCredits = parseInt(originalSession.metadata?.credits || "0");

                  if (originalCredits > 0) {
                    // Proportional deduction: if partial refund, deduct proportional credits
                    const refundRatio = amountRefunded / amountTotal;
                    creditsToDeduct = Math.round(originalCredits * refundRatio);
                  }
                }
              } catch (e) {
                console.error("[stripe-webhook] Error looking up session for refund:", e);
              }
            }

            // Deduct credits if we calculated any
            if (creditsToDeduct > 0) {
              const consumeResult = await supabase.rpc("consume_credits", {
                _user_id: sub.user_id,
                _amount: creditsToDeduct,
                _action: "refund_deduction",
                _description: `Estorno - ${creditsToDeduct} créditos deduzidos (charge ${charge.id})`,
              });

            }
          }

          await supabase.from("admin_logs").insert({
            user_id: sub.user_id,
            action: "stripe_charge_refunded",
            details: {
              charge_id: charge.id,
              amount_refunded: amountRefunded,
              amount_total: amountTotal,
              currency: charge.currency,
              credits_deducted: creditsToDeduct,
              payment_intent: charge.payment_intent,
            },
          });
        }
        break;
      }
    }
  } catch (e) {
    console.error("[stripe-webhook] processing error:", e);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
