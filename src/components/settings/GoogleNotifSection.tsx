import { useState } from "react";
import { GoogleNotifSettings, getGoogleNotifPrefs } from "@/lib/googleNotifPrefs";
import { STORAGE_KEYS } from "@/constants/storage-keys";

interface Props {
  ToggleSwitch: React.FC<{ enabled: boolean; onToggle: () => void }>;
}

const GoogleNotifSection = ({ ToggleSwitch }: Props) => {
  const [prefs, setPrefs] = useState<GoogleNotifSettings>(getGoogleNotifPrefs);

  const toggle = (key: keyof GoogleNotifSettings) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(STORAGE_KEYS.GOOGLE_NOTIF_PREFS, JSON.stringify(next));
      return next;
    });
  };

  const items: { key: keyof GoogleNotifSettings; label: string; desc: string; icon: string }[] = [
    { key: "gmail", label: "Gmail", desc: "Novos e-mails do Google", icon: "📧" },
    { key: "calendar", label: "Google Calendar", desc: "Novos eventos do calendário", icon: "📅" },
    { key: "tasks", label: "Google Tasks", desc: "Novas tarefas do Google", icon: "✅" },
    { key: "people", label: "Google Contatos", desc: "Novos contatos do Google", icon: "👤" },
    { key: "drive", label: "Google Drive", desc: "Novos arquivos do Drive", icon: "📁" },
  ];

  return (
    <div className="mt-4 pt-4 border-t border-foreground/10">
      <p className="text-xs font-semibold text-foreground mb-3">Notificações Push — Google</p>
      <p className="text-xs text-muted-foreground mb-3">Controle quais serviços Google enviam alertas no navegador quando novos dados são detectados.</p>
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.key} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">{item.icon}</span>
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
            <ToggleSwitch enabled={prefs[item.key]} onToggle={() => toggle(item.key)} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default GoogleNotifSection;
