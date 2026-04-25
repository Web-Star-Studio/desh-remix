import { Link } from "react-router-dom";
import { Check, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { TiltCard } from "@/components/landing/ui/TiltCard";
import { RevealOnScroll } from "@/components/landing/ui/RevealOnScroll";
import { GradientText } from "@/components/landing/ui/GradientText";
import { MagneticButton } from "@/components/landing/ui/MagneticButton";
import { FREE_TIER_FEATURES, PACKAGE_FEATURES, WELCOME_CREDITS } from "@/constants/plans";
import { useWelcomeTheme } from "@/components/welcome/WelcomeThemeContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price_brl: number;
  unit_price: number | null;
}

function buildPlans(pkgs: CreditPackage[]) {
  const freePlan = {
    name: "Grátis",
    price: `${WELCOME_CREDITS}`,
    priceLabel: "créditos",
    period: "válidos por 30 dias",
    features: [...FREE_TIER_FEATURES] as string[],
    cta: "Começar grátis",
    href: "/auth?tab=signup",
    highlight: false,
    badge: null as string | null,
  };

  if (pkgs.length === 0) return [freePlan];

  const cheapestUnit = Math.max(...pkgs.map(p => p.unit_price || p.price_brl / p.credits));
  const midIndex = Math.floor(pkgs.length / 2);

  const dynamicPlans = pkgs.map((pkg, i) => {
    const unitPrice = pkg.unit_price || pkg.price_brl / pkg.credits;
    const savingsPercent = Math.round((1 - unitPrice / cheapestUnit) * 100);
    const isPopular = pkgs.length >= 2 && i === midIndex;

    const features = isPopular || i === pkgs.length - 1
      ? [...PACKAGE_FEATURES as unknown as string[], ...(savingsPercent > 0 ? [`Economia de ${savingsPercent}% por crédito`] : [])]
      : ([...PACKAGE_FEATURES].slice(0, 4) as string[]);

    return {
      name: pkg.name,
      price: `R$ ${pkg.price_brl.toLocaleString("pt-BR")}`,
      priceLabel: "",
      period: `R$ ${unitPrice.toFixed(2).replace(".", ",")}/crédito`,
      features,
      cta: isPopular ? "Escolher plano" : "Comprar créditos",
      href: "/auth?tab=signup",
      highlight: isPopular,
      badge: isPopular ? "Mais popular" : null as string | null,
    };
  });

  return [freePlan, ...dynamicPlans];
}

export default function WelcomePricing() {
  const { theme } = useWelcomeTheme();

  const { data: packages, isLoading } = useQuery({
    queryKey: ["credit-packages-public"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_packages")
        .select("id, name, credits, price_brl, unit_price")
        .eq("active", true)
        .order("credits", { ascending: true });
      return (data as CreditPackage[]) || [];
    },
  });

  const plans = buildPlans(packages || []);

  return (
    <section id="pricing" className="relative py-20 md:py-36 px-4 sm:px-6">
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse 80% 60% at 50% 20%, ${theme.accent}08, transparent 70%)` }}
      />

      <div className="relative max-w-6xl mx-auto">
        <RevealOnScroll>
          <div className="text-center mb-12 md:mb-16">
            <p className="text-[11px] font-semibold tracking-[0.3em] uppercase mb-4" style={{ color: theme.accent }}>
              Preços
            </p>
            <h2 className="text-[1.75rem] sm:text-3xl md:text-4xl font-bold mb-4 tracking-tight [text-wrap:balance]" style={{ color: theme.text }}>
              Simples e <GradientText from={theme.accent} to={theme.accentSecondary}>transparente.</GradientText>
            </h2>
            <p className="text-white/50 text-sm sm:text-lg max-w-xl mx-auto">
              Teste grátis com {WELCOME_CREDITS} créditos por 30 dias. Depois, compre pacotes sob demanda.
            </p>
          </div>
        </RevealOnScroll>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-white/40" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans.map((plan, i) => (
              <RevealOnScroll key={plan.name} delay={i * 0.08}>
                <TiltCard
                  className={`relative rounded-2xl p-6 h-full backdrop-blur-2xl border transition-all duration-500 flex flex-col items-center text-center ${
                    plan.highlight
                      ? "bg-white/[0.06]"
                      : "bg-white/[0.04] border-white/[0.08]"
                  }`}
                  style={plan.highlight ? {
                    borderColor: `${theme.accent}40`,
                    boxShadow: `0 0 60px ${theme.accent}10`,
                  } : undefined}
                  glowColor={plan.highlight ? `${theme.accent}1F` : "rgba(255,255,255,0.04)"}
                >
                  {plan.badge && (
                    <div
                      className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[#0A0A0F] text-xs font-semibold whitespace-nowrap transition-colors duration-500"
                      style={{ background: `linear-gradient(to right, ${theme.accent}, ${theme.accentSecondary})` }}
                    >
                      {plan.badge}
                    </div>
                  )}

                  <h3 className="text-lg font-bold mb-1 text-center" style={{ color: theme.text }}>{plan.name}</h3>
                  <div className="mb-1 flex items-baseline justify-center gap-2">
                    <span className="text-2xl font-bold" style={{ color: theme.text }}>{plan.price}</span>
                    {plan.priceLabel && (
                      <span className="text-sm" style={{ color: `${theme.text}60` }}>{plan.priceLabel}</span>
                    )}
                  </div>
                  <p className="text-xs text-white/40 mb-5 text-center">{plan.period}</p>

                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[13px] leading-snug" style={{ color: `${theme.text}CC` }}>
                        <Check size={14} style={{ color: theme.accent }} className="flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <MagneticButton>
                    <Link
                      to={plan.href}
                      className="group inline-flex items-center justify-center gap-2 w-full py-3 px-5 rounded-xl font-semibold text-sm transition-all duration-300"
                      style={plan.highlight ? {
                        background: `linear-gradient(to right, ${theme.accent}, ${theme.accentSecondary})`,
                        color: "#0A0A0F",
                        boxShadow: `0 0 30px ${theme.accent}33`,
                      } : {
                        backgroundColor: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        color: theme.text,
                      }}
                    >
                      {plan.cta}
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </MagneticButton>
                </TiltCard>
              </RevealOnScroll>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
