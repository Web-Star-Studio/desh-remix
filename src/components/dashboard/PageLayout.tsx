import { useThemeContext } from "@/contexts/ThemeContext";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * PageLayout — Standard page wrapper for all DESH pages.
 * Provides: wallpaper background, SideNav, responsive padding,
 * bottom padding for mobile nav, and max-width container.
 *
 * @param maxWidth - "sm" (672px), "md" (768px), "lg" (1024px), "xl" (1280px), "7xl" (1280px), "full" (none)
 * @param noPadding - Skip main padding (for full-bleed pages like AI, Email)
 */
interface PageLayoutProps {
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "3xl" | "5xl" | "7xl" | "full";
  className?: string;
  noPadding?: boolean;
  /** When true with noPadding, removes h-screen constraint so page scrolls naturally */
  scrollable?: boolean;
}

const maxWidthClasses: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "3xl": "max-w-3xl",
  "5xl": "max-w-5xl",
  "7xl": "max-w-7xl",
  full: "",
};

const PageLayout = ({ children, maxWidth = "7xl", className, noPadding = false, scrollable = false }: PageLayoutProps) => {
  const { wallpaperStyle } = useThemeContext();

  const isFixedHeight = noPadding && !scrollable;

  return (
    <div
      className={cn(
        "min-h-screen bg-cover bg-center bg-fixed [overflow-x:clip] safe-area-left safe-area-right",
        isFixedHeight && "h-screen flex flex-col"
      )}
      style={wallpaperStyle}
    >
      <main
        className={cn(
          "flex-1 overflow-x-hidden flex flex-col",
          isFixedHeight && "overflow-y-auto mobile-scroll",
          !noPadding && "p-3 sm:p-4 lg:p-6 pb-24 md:pb-6 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] sm:pt-[calc(env(safe-area-inset-top,0px)+1rem)] lg:pt-[calc(env(safe-area-inset-top,0px)+1.5rem)]",
          noPadding && "pt-[env(safe-area-inset-top,0px)]",
          className
        )}
      >
        <div className={cn(maxWidthClasses[maxWidth], maxWidth !== "full" && "mx-auto w-full", isFixedHeight && "flex-1 min-h-0 flex flex-col")}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default PageLayout;
