/**
 * @module pandora-tools/index
 * @description Barrel file — single import point for all Pandora tool definitions
 */

import { tasksToolDefinitions, tasksToolDefinitionsCompact } from "./tasks-tools.ts";
import { notesToolDefinitions, notesToolDefinitionsCompact } from "./notes-tools.ts";
import { calendarToolDefinitions, calendarToolDefinitionsCompact } from "./calendar-tools.ts";
import { contactsToolDefinitions, contactsToolDefinitionsCompact } from "./contacts-tools.ts";
import { emailToolDefinitions, emailToolDefinitionsCompact } from "./email-tools.ts";
import { financeToolDefinitions, financeToolDefinitionsCompact } from "./finance-tools.ts";
import { filesToolDefinitions } from "./files-tools.ts";
import { whatsappToolDefinitions, whatsappToolDefinitionsCompact } from "./whatsapp-tools.ts";
import { socialToolDefinitions } from "./social-tools.ts";
import { automationToolDefinitions } from "./automation-tools.ts";
import { searchToolDefinitions, searchToolDefinitionsCompact } from "./search-tools.ts";
import { mediaToolDefinitions } from "./media-tools.ts";
import { systemToolDefinitions, systemToolDefinitionsCompact } from "./system-tools.ts";

// Re-export individual modules for selective imports
export { tasksToolDefinitions, tasksToolDefinitionsCompact } from "./tasks-tools.ts";
export { notesToolDefinitions, notesToolDefinitionsCompact } from "./notes-tools.ts";
export { calendarToolDefinitions, calendarToolDefinitionsCompact } from "./calendar-tools.ts";
export { contactsToolDefinitions, contactsToolDefinitionsCompact } from "./contacts-tools.ts";
export { emailToolDefinitions, emailToolDefinitionsCompact } from "./email-tools.ts";
export { financeToolDefinitions, financeToolDefinitionsCompact } from "./finance-tools.ts";
export { filesToolDefinitions } from "./files-tools.ts";
export { whatsappToolDefinitions, whatsappToolDefinitionsCompact } from "./whatsapp-tools.ts";
export { socialToolDefinitions } from "./social-tools.ts";
export { automationToolDefinitions } from "./automation-tools.ts";
export { searchToolDefinitions, searchToolDefinitionsCompact } from "./search-tools.ts";
export { mediaToolDefinitions } from "./media-tools.ts";
export { systemToolDefinitions, systemToolDefinitionsCompact } from "./system-tools.ts";

/** Full tool registry — Chat (all tools) */
export const ALL_TOOL_DEFINITIONS = [
  ...tasksToolDefinitions,
  ...notesToolDefinitions,
  ...calendarToolDefinitions,
  ...contactsToolDefinitions,
  ...emailToolDefinitions,
  ...financeToolDefinitions,
  ...filesToolDefinitions,
  ...whatsappToolDefinitions,
  ...socialToolDefinitions,
  ...automationToolDefinitions,
  ...searchToolDefinitions,
  ...mediaToolDefinitions,
  ...systemToolDefinitions,
];

/** Compact tool registry — WhatsApp (lighter descriptions, fewer tools) */
export const ALL_TOOL_DEFINITIONS_COMPACT = [
  ...tasksToolDefinitionsCompact,
  ...notesToolDefinitionsCompact,
  ...calendarToolDefinitionsCompact,
  ...contactsToolDefinitionsCompact,
  ...emailToolDefinitionsCompact,
  ...financeToolDefinitionsCompact,
  ...whatsappToolDefinitionsCompact,
  ...searchToolDefinitionsCompact,
  ...systemToolDefinitionsCompact,
];

/** Category → tool names mapping (for future dynamic registry) */
export const TOOLS_BY_CATEGORY: Record<string, string[]> = {
  tasks: tasksToolDefinitions.map(t => (t as any).function.name),
  notes: notesToolDefinitions.map(t => (t as any).function.name),
  calendar: calendarToolDefinitions.map(t => (t as any).function.name),
  contacts: contactsToolDefinitions.map(t => (t as any).function.name),
  email: emailToolDefinitions.map(t => (t as any).function.name),
  finance: financeToolDefinitions.map(t => (t as any).function.name),
  files: filesToolDefinitions.map(t => (t as any).function.name),
  whatsapp: whatsappToolDefinitions.map(t => (t as any).function.name),
  social: socialToolDefinitions.map(t => (t as any).function.name),
  automation: automationToolDefinitions.map(t => (t as any).function.name),
  search: searchToolDefinitions.map(t => (t as any).function.name),
  media: mediaToolDefinitions.map(t => (t as any).function.name),
  system: systemToolDefinitions.map(t => (t as any).function.name),
};
