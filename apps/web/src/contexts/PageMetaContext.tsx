import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

/**
 * Page metadata pushed by routes to the shell-level header.
 *
 * Stores ONLY primitive values (string + booleans) — never JSX. This avoids
 * the infinite re-render loop that would otherwise happen if pages passed
 * `actions: <button>...</button>` literal JSX (new ref every render → useEffect
 * fires → setMeta → provider re-renders subtree → page re-renders → loop).
 *
 * Pages that need toolbar buttons render them inline in their own content
 * area instead of pushing them to the shell.
 */
export interface PageMeta {
  title: string;
  /** Optional subtitle rendered as a smaller line below the title. STRING ONLY (no JSX). */
  subtitle?: string;
  /** Hides the global search bar — useful for pages that have their own. */
  hideSearch?: boolean;
  /** Hides the global HeaderActions cluster. Rare. */
  hideHeaderActions?: boolean;
}

interface PageMetaContextValue {
  meta: PageMeta;
  setMeta: Dispatch<SetStateAction<PageMeta>>;
}

const PageMetaContext = createContext<PageMetaContextValue | null>(null);

export const PageMetaProvider = ({ children }: { children: ReactNode }) => {
  const [meta, setMeta] = useState<PageMeta>({ title: "" });
  const value = useMemo(() => ({ meta, setMeta }), [meta]);
  return <PageMetaContext.Provider value={value}>{children}</PageMetaContext.Provider>;
};

/** Read-only access to the current page meta — used by the shell header. */
export function useCurrentPageMeta(): PageMeta {
  return useContext(PageMetaContext)?.meta ?? { title: "" };
}

/**
 * Pages call this with their meta. Only primitives in deps — refs stay stable
 * across re-renders so this never triggers a setState/render loop.
 */
export function usePageMeta(meta: PageMeta) {
  const ctx = useContext(PageMetaContext);
  const setMeta = ctx?.setMeta;
  const { title, subtitle, hideSearch, hideHeaderActions } = meta;

  useEffect(() => {
    if (!setMeta) return;

    const next = { title, subtitle, hideSearch, hideHeaderActions };

    setMeta((prev) =>
      prev.title === title &&
      prev.subtitle === subtitle &&
      prev.hideSearch === hideSearch &&
      prev.hideHeaderActions === hideHeaderActions
        ? prev
        : next,
    );

    return () => {
      setMeta((prev) =>
        prev.title === title &&
        prev.subtitle === subtitle &&
        prev.hideSearch === hideSearch &&
        prev.hideHeaderActions === hideHeaderActions
          ? { title: "" }
          : prev,
      );
    };
  }, [setMeta, title, subtitle, hideSearch, hideHeaderActions]);
}
