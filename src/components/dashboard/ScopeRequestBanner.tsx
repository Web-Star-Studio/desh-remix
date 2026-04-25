import { ShieldPlus } from "lucide-react";

const SERVICE_LABELS: Record<string, string> = {
  gmail: "Gmail",
  calendar: "Google Calendar",
  tasks: "Google Tasks",
  people: "Google Contacts",
  drive: "Google Drive",
};

interface ScopeRequestBannerProps {
  service: string;
  onRequest: () => void;
}

const ScopeRequestBanner = ({ service, onRequest }: ScopeRequestBannerProps) => {
  const label = SERVICE_LABELS[service] || service;
  return (
    <button
      onClick={onRequest}
      className="w-full flex items-center gap-2 p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors mb-2"
    >
      <ShieldPlus className="w-3.5 h-3.5 flex-shrink-0" />
      <span>Autorizar acesso ao {label}</span>
    </button>
  );
};

export default ScopeRequestBanner;
