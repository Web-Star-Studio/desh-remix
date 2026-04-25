import { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface WidgetPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}

const WidgetPopup = ({ open, onOpenChange, title, icon, children }: WidgetPopupProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] bg-background/95 backdrop-blur-xl border-foreground/10">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="flex items-center gap-2 text-foreground">
              {icon}
              {title}
            </DrawerTitle>
          </DrawerHeader>
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="px-4 pb-6 overflow-y-auto flex-1"
              >
                {children}
              </motion.div>
            )}
          </AnimatePresence>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden bg-background/95 backdrop-blur-xl border-foreground/10 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.25, delay: 0.1 }}
              className="flex items-center gap-2"
            >
              {icon}
              {title}
            </motion.span>
          </DialogTitle>
        </DialogHeader>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="overflow-y-auto max-h-[calc(85vh-4rem)]"
        >
          {children}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default WidgetPopup;
