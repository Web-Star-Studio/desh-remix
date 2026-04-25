import { motion } from "framer-motion";
import { Landmark } from "lucide-react";
import ItemInsightsCard from "@/components/finance/ItemInsightsCard";
import BehaviorAnalysisCard from "@/components/finance/BehaviorAnalysisCard";
import CategoryRulesCard from "@/components/finance/CategoryRulesCard";
import ConsentManager from "@/components/finance/ConsentManager";
import RecurringPaymentsCard from "@/components/finance/RecurringPaymentsCard";
import MoveConnectionToWorkspace from "@/components/finance/MoveConnectionToWorkspace";
import { useFinancialConnections } from "@/hooks/finance/useFinance";

interface OpenBankingTabProps {
  obConnections: any[];
  kpis: any;
  behaviorAnalysis: any;
  categories: any;
  insightsFetching: boolean;
  recurringPayments: any[];
  fetchKpis: (connId: string, itemId: string) => void;
  fetchBehaviorAnalysis: (connId: string, itemId: string) => void;
  fetchRecurring: (connId: string, itemId: string) => void;
  fetchConsents: (itemId: string) => any;
  revokeConsent: (itemId: string) => any;
  fetchItemStatus: (itemId: string) => any;
  fetchCategories: () => any;
  fetchCategoryRules: () => any;
  createCategoryRule: (data: any) => any;
  onImportRecurring: (payment: any) => void;
  hasObConnections: boolean;
  isWidgetEnabled: (id: string) => boolean;
}

const OpenBankingTab = ({
  obConnections, kpis, behaviorAnalysis, categories, insightsFetching,
  recurringPayments, fetchKpis, fetchBehaviorAnalysis, fetchRecurring,
  fetchConsents, revokeConsent, fetchItemStatus, fetchCategories,
  fetchCategoryRules, createCategoryRule, onImportRecurring, hasObConnections,
  isWidgetEnabled,
}: OpenBankingTabProps) => {
  const { refresh } = useFinancialConnections();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-3"
    >
      {/* Connected banks with move button */}
      {obConnections.length > 0 && (
        <div className="glass-card rounded-2xl border border-border/40 bg-background/60 backdrop-blur-xl p-3 space-y-2 shadow-lg shadow-black/10">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Landmark className="w-3.5 h-3.5 text-primary/70" /> Bancos conectados
          </p>
          {obConnections.map((conn: any) => (
            <div key={conn.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-border/20 bg-background/40 group">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Landmark className="w-3 h-3 text-primary/60" />
              </div>
              <span className="text-sm text-foreground font-medium truncate flex-1">
                {conn.institution_name || "Banco"}
              </span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                conn.status === "active" ? "bg-green-500/10 text-green-400" :
                conn.status === "syncing" ? "bg-blue-500/10 text-blue-400" :
                "bg-amber-500/10 text-amber-400"
              }`}>
                {conn.status === "active" ? "Ativo" : conn.status === "syncing" ? "Sincronizando" : conn.status}
              </span>
              <MoveConnectionToWorkspace
                connectionId={conn.id}
                currentWorkspaceId={conn.workspace_id}
                onMoved={() => refresh()}
              />
            </div>
          ))}
        </div>
      )}
      {/* Pluggy Item Insights (KPIs) */}
      {isWidgetEnabled("ob_kpis") && (
        <ItemInsightsCard
          kpis={kpis}
          fetching={insightsFetching}
          onFetch={() => {
            const conn = obConnections[0];
            if (conn) fetchKpis(conn.id, conn.provider_connection_id);
          }}
          hasConnections={hasObConnections}
        />
      )}

      {/* Behavior Analysis */}
      {isWidgetEnabled("ob_behavior") && (
        <BehaviorAnalysisCard
          analysis={behaviorAnalysis}
          fetching={insightsFetching}
          onFetch={() => {
            const conn = obConnections[0];
            if (conn) fetchBehaviorAnalysis(conn.id, conn.provider_connection_id);
          }}
          hasConnections={hasObConnections}
        />
      )}

      {/* Detected Recurring Payments */}
      {isWidgetEnabled("ob_recurring") && (
        <RecurringPaymentsCard
          payments={recurringPayments}
          fetching={insightsFetching}
          onFetch={() => {
            const conn = obConnections[0];
            if (conn) fetchRecurring(conn.id, conn.provider_connection_id);
          }}
          hasConnections={hasObConnections}
          onImportRecurring={async (payment) => { onImportRecurring(payment); }}
        />
      )}

      {/* Category Rules */}
      {isWidgetEnabled("ob_categories") && (
        <CategoryRulesCard
          categories={categories}
          onFetchCategories={fetchCategories}
          onFetchRules={fetchCategoryRules}
          onCreateRule={createCategoryRule}
          hasConnections={hasObConnections}
        />
      )}

      {/* Consent & Status Manager */}
      {(isWidgetEnabled("ob_consents") || isWidgetEnabled("ob_item_status")) && (
        <ConsentManager
          connections={obConnections.map(c => ({
            id: c.id,
            provider_connection_id: c.provider_connection_id,
            institution_name: c.institution_name,
            status: c.status,
          }))}
          onFetchConsents={fetchConsents}
          onRevokeConsent={revokeConsent}
          onFetchItemStatus={fetchItemStatus}
          fetching={insightsFetching}
        />
      )}
    </motion.div>
  );
};

export default OpenBankingTab;
