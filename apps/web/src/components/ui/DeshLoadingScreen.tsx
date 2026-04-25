import { forwardRef } from "react";
import deshLogoCoin from "@/assets/desh-logo-coin.png";

const DeshLoadingScreen = forwardRef<HTMLDivElement>((_props, ref) => (
  <div
    ref={ref}
    className="min-h-screen flex flex-col items-center justify-center z-[9998]"
    style={{ background: "radial-gradient(ellipse at center, #0a0a0a, #000)" }}
  >
    <div className="relative flex items-center justify-center">
      {/* Rotating dashed ring */}
      <svg className="absolute w-24 h-24 animate-spin" style={{ animationDuration: "3s" }} viewBox="0 0 96 96">
        <circle cx="48" cy="48" r="44" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" strokeDasharray="8 6" />
      </svg>
      {/* Logo */}
      <img src={deshLogoCoin} alt="DESH" className="w-14 h-14 animate-pulse" style={{ animationDuration: "2s" }} />
    </div>
  </div>
));

DeshLoadingScreen.displayName = "DeshLoadingScreen";

export default DeshLoadingScreen;
