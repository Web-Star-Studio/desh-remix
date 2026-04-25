import { Check, Star } from "lucide-react";
import { RevealOnScroll } from "./ui/RevealOnScroll";
import { TiltCard } from "./ui/TiltCard";
import { FREE_TIER_FEATURES, WELCOME_CREDITS } from "@/constants/plans";
import { CREDIT_COSTS, PRICE_PER_CREDIT_BRL } from "@/constants/credits";
import { ROUTES } from "@/constants/routes";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { trackCtaClick } from "@/lib/landing-analytics";

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price_brl: number;
  unit_price: number | null;
}

export function PricingSection() {
  const { data: packages } = useQuery({
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

  const pkgs = packages || [];

  return (
    <section id="pricing" className="py-20 md:py-28 px-4 sm:px-6 relative" style={{ background: "#12121A" }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "rgba(255,255,255,0.04)" }} />
      <div className="max-w-6xl mx-auto">
        <RevealOnScroll>
          <div className="text-center mb-4">
            <p className="text-[#C8956C] text-sm font-medium tracking-widest uppercase mb-4" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              Preços
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-[#F5F5F7] mb-4" style={{ fontFamily: "'Playfair Display', serif", lineHeight: 1.1 }}>
              Simples e{" "}
              <span className="bg-gradient-to-r from-[#C8956C] to-[#E8B98A] bg-clip-text text-transparent">transparente.</span>
            </h2>
            <p className="text-[#8E8E93] text-sm max-w-md mx-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Teste grátis com {WELCOME_CREDITS} créditos por 30 dias. Depois, compre pacotes sob demanda.
            </p>
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <div
            className="grid gap-5 max-w-5xl mx-auto mt-12 grid-cols-1 sm:grid-cols-2 lg:[grid-template-columns:var(--cols-lg)]"
            style={
              pkgs.length > 0
                ? ({
                    ["--cols-lg" as never]: `repeat(${Math.min(pkgs.length + 1, 4)}, minmax(0, 1fr))`,
                  } as React.CSSProperties)
                : undefined
            }
          >
            {/* Free tier */}
            <RevealOnScroll delay={0}>
              <TiltCard
                className="rounded-2xl p-7 flex flex-col h-full"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <h3 className="text-lg font-semibold text-[#F5F5F7] mb-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>Grátis</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold text-[#F5F5F7]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{WELCOME_CREDITS}</span>
                  <span className="text-[#8E8E93] text-sm">créditos</span>
                </div>
                <p className="text-[#8E8E93] text-xs mb-5" style={{ fontFamily: "'DM Sans', sans-serif" }}>válidos por 30 dias</p>
                <ul className="space-y-2.5 mb-7 flex-1">
                  {FREE_TIER_FEATURES.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-[#F5F5F7]">
                      <Check className="w-3.5 h-3.5 text-[#C8956C] flex-shrink-0" />
                      <span style={{ fontFamily: "'DM Sans', sans-serif" }}>{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={ROUTES.AUTH}
                  onClick={() => trackCtaClick("pricing_free", "Começar grátis")}
                  className="block text-center py-2.5 rounded-xl border border-[#C8956C]/40 text-[#E8B98A] text-sm font-medium hover:bg-[#C8956C]/10 transition-colors"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Começar grátis →
                </a>
              </TiltCard>
            </RevealOnScroll>

            {/* Dynamic packages from DB */}
            {pkgs.map((pkg, i) => {
              const isMostPopular = pkgs.length >= 2 && i === Math.floor(pkgs.length / 2);
              const unitPrice = pkg.unit_price ?? (pkg.credits > 0 ? pkg.price_brl / pkg.credits : 0);
              const cheapestUnit = pkgs.length > 0 ? Math.min(...pkgs.map(p => p.unit_price ?? (p.credits > 0 ? p.price_brl / p.credits : Infinity))) : 0;
              const starterUnit = pkgs[0]?.unit_price ?? (pkgs[0]?.credits > 0 ? pkgs[0].price_brl / pkgs[0].credits : 0);
              const savings = starterUnit > 0 ? Math.round((1 - unitPrice / starterUnit) * 100) : 0;

              const features = [
                "Acesso completo à plataforma",
                "Créditos avulsos sob demanda",
                "Compra automática disponível",
                "Assistente IA Pandora",
                ...(i >= pkgs.length - 1 ? ["Open Finance", "Suporte prioritário"] : []),
                ...(savings > 0 ? [`Economia de ${savings}% por crédito`] : []),
              ];

              return (
                <RevealOnScroll key={pkg.id} delay={0.1 * (i + 1)}>
                  <TiltCard
                    className="rounded-2xl p-7 flex flex-col relative h-full"
                    style={{
                      background: isMostPopular ? "rgba(200,149,108,0.05)" : "rgba(255,255,255,0.03)",
                      backdropFilter: "blur(20px)",
                      border: isMostPopular ? "1px solid rgba(200,149,108,0.3)" : "1px solid rgba(255,255,255,0.08)",
                      boxShadow: isMostPopular ? "0 0 40px rgba(200,149,108,0.08)" : undefined,
                    }}
                    glowColor={isMostPopular ? "rgba(200,149,108,0.12)" : undefined}
                  >
                    {isMostPopular && (
                      <div className="absolute -top-3 right-6 flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-[#C8956C] to-[#E8B98A] text-xs font-medium text-white">
                        <Star className="w-3 h-3" /> Mais popular
                      </div>
                    )}
                    <h3 className="text-lg font-semibold text-[#F5F5F7] mb-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                      {pkg.name}
                    </h3>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-3xl font-bold text-[#F5F5F7]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        R$ {pkg.price_brl.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                      </span>
                    </div>
                    <p className="text-[#8E8E93] text-xs mb-5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                      R$ {unitPrice.toFixed(2).replace(".", ",")}/crédito
                    </p>
                    <ul className="space-y-2.5 mb-7 flex-1">
                      {features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-xs text-[#F5F5F7]">
                          <Check className="w-3.5 h-3.5 text-[#C8956C] flex-shrink-0" />
                          <span style={{ fontFamily: "'DM Sans', sans-serif" }}>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <a
                      href={ROUTES.AUTH}
                      onClick={() => trackCtaClick(`pricing_pkg_${i}`, pkg.name)}
                      className={`block text-center py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isMostPopular
                          ? "text-white hover:opacity-90 hover:shadow-[0_0_30px_rgba(200,149,108,0.3)]"
                          : "border border-[#C8956C]/40 text-[#E8B98A] hover:bg-[#C8956C]/10"
                      }`}
                      style={isMostPopular ? { background: "linear-gradient(135deg, #C8956C, #E8B98A)", fontFamily: "'DM Sans', sans-serif" } : { fontFamily: "'DM Sans', sans-serif" }}
                    >
                      {isMostPopular ? "Escolher plano →" : i === 0 ? "Comprar créditos →" : "Escolher plano →"}
                    </a>
                  </TiltCard>
                </RevealOnScroll>
              );
            })}
          </div>

          <p className="text-center text-[#636366] text-xs mt-8 max-w-lg mx-auto" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            Créditos são usados para IA, buscas web e sincronizações. 1 crédito ≈ R${PRICE_PER_CREDIT_BRL.toFixed(2)} • Chat IA: {CREDIT_COSTS.AI_CHAT} créditos • Busca Web: {CREDIT_COSTS.WEB_SEARCH} créditos
          </p>
        </RevealOnScroll>
      </div>
    </section>
  );
}
