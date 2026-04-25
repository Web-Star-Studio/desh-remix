import { Shield, ShieldCheck, ShieldAlert } from "lucide-react";
import DeshTooltip from "@/components/ui/DeshTooltip";

type ReliabilityLevel = "trusted" | "notable" | "generic";

const trustedDomains = [
  ".gov", ".gov.br", ".edu", ".edu.br", ".ac.uk",
  ".org", ".mil", ".int",
];

const notableDomains = [
  "wikipedia.org", "stackoverflow.com", "github.com",
  "arxiv.org", "nature.com", "sciencedirect.com",
  "pubmed.ncbi.nlm.nih.gov", "scholar.google.com",
  "reuters.com", "bbc.com", "nytimes.com",
  "developer.mozilla.org", "docs.microsoft.com",
  "medium.com", "dev.to",
  // Tech & Docs
  "developer.apple.com", "cloud.google.com", "aws.amazon.com",
  "docs.github.com", "vercel.com/docs", "nextjs.org",
  "reactjs.org", "vuejs.org", "angular.io",
  "typescriptlang.org", "nodejs.org", "python.org",
  "rust-lang.org", "go.dev", "kotlinlang.org",
  // News & Media
  "theguardian.com", "washingtonpost.com", "economist.com",
  "ft.com", "bloomberg.com", "cnbc.com", "cnn.com",
  "apnews.com", "france24.com", "aljazeera.com",
  "folha.uol.com.br", "g1.globo.com", "estadao.com.br",
  // Academic
  "jstor.org", "springer.com", "ieee.org", "acm.org",
  "researchgate.net", "semanticscholar.org", "plos.org",
  "bmj.com", "thelancet.com", "cell.com",
  // Reference
  "britannica.com", "merriam-webster.com", "who.int",
  "worldbank.org", "imf.org", "un.org",
];

function getReliability(url: string): ReliabilityLevel {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (trustedDomains.some(d => hostname.endsWith(d))) return "trusted";
    if (notableDomains.some(d => hostname.includes(d))) return "notable";
    return "generic";
  } catch {
    return "generic";
  }
}

const config: Record<ReliabilityLevel, {
  icon: typeof Shield;
  label: string;
  tooltip: string;
  className: string;
}> = {
  trusted: {
    icon: ShieldCheck,
    label: "Confiável",
    tooltip: "Fonte institucional oficial (gov, edu, org)",
    className: "text-emerald-500 bg-emerald-500/10",
  },
  notable: {
    icon: Shield,
    label: "Notável",
    tooltip: "Fonte reconhecida e amplamente referenciada",
    className: "text-blue-500 bg-blue-500/10",
  },
  generic: {
    icon: ShieldAlert,
    label: "",
    tooltip: "",
    className: "",
  },
};

const SourceReliabilityBadge = ({ url }: { url: string }) => {
  const level = getReliability(url);
  if (level === "generic") return null;

  const { icon: Icon, label, tooltip, className } = config[level];

  return (
    <DeshTooltip label={tooltip}>
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${className}`}>
        <Icon className="w-3 h-3" />
        {label}
      </span>
    </DeshTooltip>
  );
};

export default SourceReliabilityBadge;
