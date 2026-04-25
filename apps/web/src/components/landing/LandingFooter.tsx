import { Link } from "react-router-dom";
import deshLogoIcon from "@/assets/desh-logo-icon.png";

export function LandingFooter() {
  return (
    <footer className="py-8 sm:py-12 border-t border-white/[0.06]" style={{ background: "#0A0A0F" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
          <div className="flex items-center gap-2 text-center md:text-left">
            <img src={deshLogoIcon} alt="DESH" className="w-5 h-5 opacity-50 flex-shrink-0" />
            <span className="text-xs sm:text-sm text-[#636366]">
              © {new Date().getFullYear()} DESH · por Web Star Studio
            </span>
          </div>

          <div className="flex items-center gap-4 sm:gap-6 flex-wrap justify-center">
            <Link to="/privacy" className="text-xs sm:text-sm text-[#636366] hover:text-[#8E8E93] transition-colors">
              Política de Privacidade
            </Link>
            <Link to="/terms" className="text-xs sm:text-sm text-[#636366] hover:text-[#8E8E93] transition-colors">
              Termos de Uso
            </Link>
          </div>
        </div>

        <div className="mt-4 sm:mt-6 flex justify-center px-2">
          <p className="text-[10px] sm:text-xs text-[#636366]/60 flex items-center gap-1.5 text-center">
            🔒 Seus dados protegidos conforme LGPD (Art. 18) e GDPR (Art. 20)
          </p>
        </div>
      </div>
    </footer>
  );
}
