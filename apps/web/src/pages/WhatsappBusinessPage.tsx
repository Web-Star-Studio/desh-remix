import { useState } from "react";
import { Link } from "react-router-dom";
import { Building2, History } from "lucide-react";
import PageLayout from "@/components/dashboard/PageLayout";
import PageHeader from "@/components/dashboard/PageHeader";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import WhatsAppBusinessOverview from "@/components/whatsapp-business/WhatsAppBusinessOverview";
import BroadcastManager from "@/components/whatsapp-business/BroadcastManager";
import TemplateManager from "@/components/whatsapp-business/TemplateManager";
import WABAContactManager from "@/components/whatsapp-business/WABAContactManager";
import BusinessProfileEditor from "@/components/whatsapp-business/BusinessProfileEditor";
import PhoneNumberManager from "@/components/whatsapp-business/PhoneNumberManager";
import WhatsAppTestSender from "@/components/whatsapp-business/WhatsAppTestSender";

export default function WhatsappBusinessPage() {
  const [accountId, setAccountId] = useState<string | null>(null);

  return (
    <PageLayout maxWidth="7xl">
      <PageHeader
        title="WhatsApp Business"
        icon={<Building2 className="w-5 h-5 text-[hsl(142,70%,45%)] drop-shadow" />}
        subtitle="API oficial Meta — broadcasts, templates e CRM"
        actions={
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/messages/whatsapp/history">
              <History className="w-4 h-4" />
              Histórico
            </Link>
          </Button>
        }
      />

      <AnimatedItem index={0}>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full max-w-full overflow-x-auto justify-start gap-1 bg-transparent p-0 h-auto mb-6">
            {[
              { value: "overview", label: "Visão Geral" },
              { value: "test", label: "Testar Envio" },
              { value: "broadcasts", label: "Broadcasts" },
              { value: "templates", label: "Templates" },
              { value: "contacts", label: "Contatos" },
              { value: "profile", label: "Perfil" },
              { value: "numbers", label: "Números" },
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none rounded-lg px-4 py-2 text-sm"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview">
            <WhatsAppBusinessOverview onAccountReady={setAccountId} />
          </TabsContent>

          <TabsContent value="test" className="space-y-6">
            <WhatsAppTestSender accountId={accountId} />
          </TabsContent>

          <TabsContent value="broadcasts">
            {accountId ? (
              <BroadcastManager accountId={accountId} />
            ) : (
              <EmptyState msg="Conecte uma conta WABA na aba Visão Geral primeiro." />
            )}
          </TabsContent>

          <TabsContent value="templates">
            {accountId ? (
              <TemplateManager accountId={accountId} />
            ) : (
              <EmptyState msg="Conecte uma conta WABA na aba Visão Geral primeiro." />
            )}
          </TabsContent>

          <TabsContent value="contacts">
            {accountId ? (
              <WABAContactManager accountId={accountId} />
            ) : (
              <EmptyState msg="Conecte uma conta WABA na aba Visão Geral primeiro." />
            )}
          </TabsContent>

          <TabsContent value="profile">
            {accountId ? (
              <BusinessProfileEditor accountId={accountId} />
            ) : (
              <EmptyState msg="Conecte uma conta WABA na aba Visão Geral primeiro." />
            )}
          </TabsContent>

          <TabsContent value="numbers">
            <PhoneNumberManager />
          </TabsContent>
        </Tabs>
      </AnimatedItem>
    </PageLayout>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <p className="text-sm text-muted-foreground">{msg}</p>
    </div>
  );
}
