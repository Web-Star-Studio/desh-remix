import { memo } from "react";
import type { WorkspaceShare, WorkspaceShareModule } from "@/types/common";
import { MODULE_OPTIONS } from "@/hooks/workspace/useWorkspaceShares";
import { Globe } from "lucide-react";
import { MODULE_ICONS } from "./moduleIcons";

const ModuleBadges = memo(({ share }: { share: WorkspaceShare }) => {
  const mods = share.share_all ? MODULE_OPTIONS.map(m => m.value) : share.modules;
  return (
    <div className="flex flex-wrap gap-1">
      {share.share_all && (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-1">
          <Globe className="w-3 h-3" /> Completo
        </span>
      )}
      {!share.share_all && mods.map(m => {
        const Icon = MODULE_ICONS[m];
        return (
          <span key={m} className="text-[10px] px-1.5 py-0.5 rounded-full bg-foreground/5 text-muted-foreground flex items-center gap-1">
            <Icon className="w-3 h-3" />
            {MODULE_OPTIONS.find(o => o.value === m)?.label}
          </span>
        );
      })}
    </div>
  );
});

ModuleBadges.displayName = "ModuleBadges";
export default ModuleBadges;
