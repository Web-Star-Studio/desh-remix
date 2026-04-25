import { useState, useEffect, useRef } from "react";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import GlassCard from "@/components/dashboard/GlassCard";

interface Props {
  userId?: string;
  ToggleSwitch: React.FC<{ enabled: boolean; onToggle: () => void }>;
}

const EmailNotifPreferences = ({ userId, ToggleSwitch }: Props) => {
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("email_task_reminders, email_daily_summary, email_event_reminders, email_broadcasts, email_weekly_report, email_credit_alerts, email_welcome, email_security_alerts, email_inactivity")
        .eq("user_id", userId)
        .single();
      if (!mountedRef.current) return;
      if (data) {
        setPrefs(data as any);
      } else {
        await supabase.from("notification_preferences").insert({ user_id: userId } as any);
        if (!mountedRef.current) return;
        setPrefs({ email_task_reminders: true, email_daily_summary: true, email_event_reminders: true, email_broadcasts: true, email_weekly_report: true, email_credit_alerts: true, email_welcome: true, email_security_alerts: true, email_inactivity: true });
      }
      setLoading(false);
    };
    load();
  }, [userId]);

  const toggle = async (key: string) => {
    if (!prefs || !userId) return;
    const newVal = !prefs[key];
    setPrefs({ ...prefs, [key]: newVal });
    await supabase.from("notification_preferences").update({ [key]: newVal } as any).eq("user_id", userId);
  };

  if (!userId || loading) return null;
  if (!prefs) return null;

  const items = [
    { key: "email_task_reminders", label: "Lembretes de tarefas", desc: "E-mail quando uma tarefa está prestes a vencer" },
    { key: "email_event_reminders", label: "Lembretes de eventos", desc: "E-mail antes de eventos do calendário" },
    { key: "email_daily_summary", label: "Resumo diário", desc: "Resumo matinal com tarefas e eventos do dia" },
    { key: "email_weekly_report", label: "Relatório semanal", desc: "Relatório de produtividade toda segunda-feira" },
    { key: "email_broadcasts", label: "Avisos da plataforma", desc: "E-mails com comunicados e novidades do Desh" },
    { key: "email_credit_alerts", label: "Alertas de créditos", desc: "Avisos de créditos baixos e confirmação de compras" },
    { key: "email_welcome", label: "Boas-vindas", desc: "E-mail de boas-vindas ao criar conta" },
    { key: "email_security_alerts", label: "Alertas de segurança", desc: "Avisos de login em novo dispositivo" },
    { key: "email_inactivity", label: "Lembrete de inatividade", desc: "Lembrete quando você não acessa por 7+ dias" },
  ];

  return (
    <GlassCard size="auto" id="settings-email_notifs">
      <div className="flex items-center gap-2 mb-4">
        <Mail className="w-4 h-4 text-primary" />
        <p className="widget-title">Notificações por E-mail</p>
      </div>
      <p className="text-xs text-muted-foreground mb-3">Escolha quais notificações você quer receber por e-mail</p>
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.key} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <ToggleSwitch enabled={!!prefs[item.key]} onToggle={() => toggle(item.key)} />
          </div>
        ))}
      </div>
    </GlassCard>
  );
};

export default EmailNotifPreferences;
