/**
 * Dynamic Tool Registry
 * Resolves which tools to inject based on active page, recent modules, and user intent.
 * Reduces token usage by only sending relevant tools to the AI model.
 */
import { ALL_TOOL_DEFINITIONS, TOOLS_BY_CATEGORY } from "./pandora-tools/index.ts";

/** Page path → relevant tool categories */
const PAGE_TO_CATEGORIES: Record<string, string[]> = {
  "/dashboard": ["system", "tasks", "calendar", "email", "finance"],
  "/email": ["email", "contacts", "tasks", "system"],
  "/calendar": ["calendar", "tasks", "contacts", "system"],
  "/messages": ["whatsapp", "contacts", "system"],
  "/tasks": ["tasks", "calendar", "system"],
  "/notes": ["notes", "search", "system"],
  "/contacts": ["contacts", "email", "whatsapp", "tasks", "system"],
  "/files": ["files", "system"],
  "/finances": ["finance", "system"],
  "/ai": ["*"],
  "/search": ["search", "system"],
  "/map": ["search", "system"],
  "/social": ["social", "media", "system"],
  "/automations": ["automation", "system"],
  "/habits": ["tasks", "system"],
  "/week-planner": ["tasks", "calendar", "system"],
};

/** Categories always included regardless of page */
const ALWAYS_AVAILABLE = ["system"];

/**
 * Resolve which tool definitions to send to the AI model.
 * - If activePage is null or "/ai", returns ALL tools (full capability).
 * - Otherwise, returns tools matching the page + recent modules + always-available.
 */
export function resolveTools(
  activePage: string | null,
  recentModules: string[] = [],
  _userIntent?: string,
): typeof ALL_TOOL_DEFINITIONS {
  // Full capability mode: no page context or direct AI chat
  if (!activePage || activePage === "/ai" || activePage.startsWith("/ai/")) {
    return ALL_TOOL_DEFINITIONS;
  }

  // Find matching page (try exact match first, then prefix match)
  let pageCategories = PAGE_TO_CATEGORIES[activePage];
  if (!pageCategories) {
    // Try prefix match: /finances/123 → /finances
    const basePath = "/" + activePage.split("/").filter(Boolean)[0];
    pageCategories = PAGE_TO_CATEGORIES[basePath];
  }

  // If page has wildcard or unknown page, return all
  if (!pageCategories || pageCategories.includes("*")) {
    return ALL_TOOL_DEFINITIONS;
  }

  // Merge: page categories + recent modules (last 3) + always available
  const allCategories = new Set([
    ...ALWAYS_AVAILABLE,
    ...pageCategories,
    ...recentModules.slice(0, 3),
  ]);

  // Resolve tool names from categories
  const allowedToolNames = new Set<string>();
  for (const cat of allCategories) {
    const toolNames = TOOLS_BY_CATEGORY[cat];
    if (toolNames) {
      for (const name of toolNames) {
        allowedToolNames.add(name);
      }
    }
  }

  // Filter definitions — tools use { type: "function", function: { name } } format
  const filtered = ALL_TOOL_DEFINITIONS.filter((t: any) => {
    const name = t.function?.name || t.name;
    return allowedToolNames.has(name);
  });

  // Safety: if filtering results in < 5 tools, return all (something went wrong)
  if (filtered.length < 5) {
    return ALL_TOOL_DEFINITIONS;
  }

  return filtered;
}

/** Get the count of tools that would be resolved for a given page */
export function getResolvedToolCount(
  activePage: string | null,
  recentModules: string[] = [],
): number {
  return resolveTools(activePage, recentModules).length;
}
