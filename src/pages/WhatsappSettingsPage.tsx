import { MessageCircle } from "lucide-react";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import PageLayout from "@/components/dashboard/PageLayout";
import PageHeader from "@/components/dashboard/PageHeader";
import WhatsAppWebConnector from "@/components/dashboard/WhatsAppWebConnector";
import WhatsAppWebMonitor from "@/components/dashboard/WhatsAppWebMonitor";
import SessionAuditTimeline from "@/components/dashboard/SessionAuditTimeline";
import PandoraWhatsAppSettings from "@/components/dashboard/PandoraWhatsAppSettings";
import PandoraContactCard from "@/components/dashboard/PandoraContactCard";
import WhatsAppFullSync from "@/components/dashboard/WhatsAppFullSync";
import WhatsAppComparisonCard from "@/components/whatsapp-business/WhatsAppComparisonCard";
import PandoraAuditLog from "@/components/dashboard/PandoraAuditLog";
import { useAdminRole } from "@/hooks/admin/useAdminRole";

export default function WhatsappSettingsPage() {
  const { isAdmin } = useAdminRole();

  return (
    <PageLayout maxWidth="7xl">
      <PageHeader
        title="Conexão WhatsApp"
        icon={<MessageCircle className="w-5 h-5 text-primary drop-shadow" />}
        subtitle="Gerencie sua conexão WhatsApp"
      />

      <div className="space-y-4">
        <AnimatedItem index={0}>
          <WhatsAppComparisonCard />
        </AnimatedItem>
        <AnimatedItem index={1}>
          <WhatsAppWebConnector />
        </AnimatedItem>
        <AnimatedItem index={2}>
          <WhatsAppFullSync />
        </AnimatedItem>
        <AnimatedItem index={3}>
          <PandoraWhatsAppSettings />
        </AnimatedItem>
        <AnimatedItem index={4}>
          <PandoraAuditLog />
        </AnimatedItem>
        <AnimatedItem index={5}>
          <PandoraContactCard />
        </AnimatedItem>
        {isAdmin && (
          <AnimatedItem index={6}>
            <WhatsAppWebMonitor />
          </AnimatedItem>
        )}
        {isAdmin && (
          <AnimatedItem index={7}>
            <SessionAuditTimeline />
          </AnimatedItem>
        )}
      </div>
    </PageLayout>
  );
}
