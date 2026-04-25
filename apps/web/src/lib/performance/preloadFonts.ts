/**
 * Defer-loads heavier font weights/italics & monospace so they don't compete
 * with the LCP. Called from main.tsx after initial render via requestIdleCallback.
 */
export function preloadHeavyFonts() {
  if (typeof document === "undefined") return;
  const ric: (cb: () => void) => number =
    (window as any).requestIdleCallback ||
    ((cb: () => void) => window.setTimeout(cb, 1500));

  ric(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;1,300;1,400;1,500;1,600;1,700&family=DM+Serif+Display:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap";
    document.head.appendChild(link);
  });
}
