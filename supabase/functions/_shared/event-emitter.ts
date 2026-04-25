/**
 * @module event-emitter
 * @description Fire-and-forget event bus for automation triggers.
 * Emits events to the automation_events table. NEVER blocks the main flow.
 */

/**
 * Emit an event to the automation event bus.
 * This is fire-and-forget — failures are logged but never thrown.
 */
export async function emitEvent(
  supabase: any,
  userId: string,
  workspaceId: string | null,
  eventType: string,
  eventSource: string,
  eventData: Record<string, any>,
): Promise<void> {
  try {
    const { error } = await supabase.from("automation_events").insert({
      user_id: userId,
      workspace_id: workspaceId || null,
      event_type: eventType,
      event_source: eventSource,
      event_data: eventData,
    });
    if (error) {
      console.error(`[EventBus] Failed to emit ${eventType}:`, error.message);
    }
  } catch (e) {
    // Event emission should NEVER break the main flow
    console.error(`[EventBus] Exception emitting ${eventType}:`, e);
  }
}

/** Standard event types for reference */
export const EVENT_TYPES = {
  // Email
  EMAIL_RECEIVED: "email.received",
  EMAIL_SENT: "email.sent",

  // Tasks
  TASK_CREATED: "task.created",
  TASK_COMPLETED: "task.completed",
  TASK_UPDATED: "task.updated",

  // Calendar
  CALENDAR_EVENT_CREATED: "calendar.event_created",
  CALENDAR_EVENT_UPDATED: "calendar.event_updated",

  // Finance
  FINANCE_TRANSACTION_SYNCED: "finance.transaction_synced",
  FINANCE_ACCOUNT_SYNCED: "finance.account_synced",

  // WhatsApp
  WHATSAPP_MESSAGE_RECEIVED: "whatsapp.message_received",
  WHATSAPP_MESSAGE_SENT: "whatsapp.message_sent",

  // Contacts
  CONTACT_CREATED: "contact.created",
  CONTACT_UPDATED: "contact.updated",

  // Files
  FILE_UPLOADED: "file.uploaded",
} as const;
