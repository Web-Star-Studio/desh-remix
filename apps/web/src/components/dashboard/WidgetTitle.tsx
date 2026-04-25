import { ReactNode, useState } from "react";
import { Maximize2 } from "lucide-react";
import WidgetPopup from "./WidgetPopup";
import DeshTooltip from "@/components/ui/DeshTooltip";

export interface WidgetTitleProps {
  label: string;
  icon?: ReactNode;
  popupContent?: ReactNode;
  popupIcon?: ReactNode;
  onPopupOpenChange?: (open: boolean) => void;
}

const WidgetTitle = ({ label, icon, popupContent, popupIcon, onPopupOpenChange }: WidgetTitleProps) => {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    onPopupOpenChange?.(v);
  };

  const iconEl = icon ?? popupIcon
    ? <span className="shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5">{icon ?? popupIcon}</span>
    : null;

  if (!popupContent) {
    return (
      <p className="widget-title flex items-center gap-1.5">
        {iconEl}
        {label}
      </p>
    );
  }

  return (
    <>
      <button
        onClick={() => handleOpenChange(true)}
        className="widget-title flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer group"
      >
        {iconEl}
        {label}
        <DeshTooltip label="Expandir widget" side="top">
          <Maximize2 className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity text-primary" />
        </DeshTooltip>
      </button>
      <WidgetPopup
        open={open}
        onOpenChange={handleOpenChange}
        title={label}
        icon={popupIcon}
      >
        {popupContent}
      </WidgetPopup>
    </>
  );
};

export default WidgetTitle;
