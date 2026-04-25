/**
 * useEmail — Domain facade for the Email module.
 */
import { useEmailAI } from "./useEmailAI";
import { useEmailTemplates } from "./useEmailTemplates";

export function useEmail() {
  const ai = useEmailAI();
  const templates = useEmailTemplates();

  return {
    aiSummary: ai.aiSummary,
    aiLoading: ai.aiLoading,
    templates: templates.templates,
    saveAsTemplate: templates.saveAsTemplate,
    deleteTemplate: templates.deleteTemplate,
    templatesLoaded: templates.templatesLoaded,
  } as const;
}
