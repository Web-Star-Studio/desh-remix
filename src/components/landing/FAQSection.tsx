import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { RevealOnScroll } from "./ui/RevealOnScroll";
import { FAQ_DATA } from "@/lib/landing-config";
import { trackLandingEvent } from "@/lib/landing-analytics";

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) trackLandingEvent("faq_open", { location: "faq", label: q });
  };
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <button
        onClick={handleToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 sm:px-6 py-4 text-left gap-3"
      >
        <span className="text-[#F5F5F7] text-sm font-medium" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          {q}
        </span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-5 h-5 text-[#8E8E93] flex-shrink-0" />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="px-4 sm:px-6 pb-4">
              <p className="text-[#8E8E93] text-sm leading-relaxed" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                {a}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQSection() {
  return (
    <section id="faq" className="py-16 sm:py-20 md:py-28 px-4 sm:px-6 relative" style={{ background: "#0A0A0F" }}>
      {/* Section separator */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "rgba(255,255,255,0.04)" }} />
      <div className="max-w-3xl mx-auto">
        <RevealOnScroll>
          <div className="text-center mb-8 sm:mb-12">
            <p className="text-[#C8956C] text-xs sm:text-sm font-medium tracking-widest uppercase mb-3 sm:mb-4" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              FAQ
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#F5F5F7]" style={{ fontFamily: "'Playfair Display', serif", lineHeight: 1.1 }}>
              Perguntas{" "}
              <span className="bg-gradient-to-r from-[#C8956C] to-[#E8B98A] bg-clip-text text-transparent">frequentes</span>
            </h2>
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <div className="space-y-3">
            {FAQ_DATA.map((item, i) => (
              <FAQItem key={i} q={item.q} a={item.a} />
            ))}
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
