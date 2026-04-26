import { ReactNode } from "react";
import { usePageMeta } from "@/contexts/PageMetaContext";

/**
 * PageHeader — Backward-compat shim.
 *
 * Title gets pushed to the shell-level top bar via PageMetaContext. Icons,
 * subtitle, actions, Voltar are all ignored by design — pages that need
 * toolbar buttons render them inline in their content body.
 */
interface PageHeaderProps {
  title: string;
  /** @deprecated ignored — page titles never have icons. */
  icon?: ReactNode;
  /** @deprecated ignored — Voltar button removed app-wide. */
  backTo?: string;
  /** @deprecated ignored — render inline in your page body instead. */
  actions?: ReactNode;
  /** @deprecated ignored — move secondary info into the page body. */
  subtitle?: ReactNode;
  className?: string;
  hideHeaderActions?: boolean;
  hideSearch?: boolean;
}

const PageHeader = ({
  title,
  hideHeaderActions = false,
  hideSearch = false,
}: PageHeaderProps) => {
  usePageMeta({ title, hideHeaderActions, hideSearch });
  return null;
};

export default PageHeader;
