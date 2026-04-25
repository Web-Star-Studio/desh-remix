/**
 * Composio integration types — canonical interfaces for data returned
 * by Composio Actions (GMAIL_FETCH_EMAILS, GOOGLECALENDAR_FIND_EVENT, etc.)
 */

/** Attachment metadata returned by GMAIL_FETCH_EMAILS */
export interface ComposioAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
}

/** Single email returned by GMAIL_FETCH_EMAILS action */
export interface ComposioEmail {
  /** Gmail message ID (may appear as `messageId` or `id`) */
  messageId?: string;
  id?: string;
  /** Plain-text body of the email */
  messageText?: string;
  snippet?: string;
  /** Raw "From" header, e.g. `"Name <email@x.com>"` */
  from?: string;
  sender?: string;
  subject?: string;
  /** Gmail label IDs (INBOX, UNREAD, STARRED, etc.) */
  labelIds?: string[];
  /** ISO date string or internal Gmail date */
  date?: string;
  receivedAt?: string;
  internalDate?: string;
  /** List of attachments, if any */
  attachmentList?: ComposioAttachment[];
}

/** Response wrapper from GMAIL_FETCH_EMAILS */
export interface ComposioEmailListResponse {
  messages?: ComposioEmail[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

/** Attendee in a Google Calendar event */
export interface ComposioCalendarAttendee {
  email: string;
  displayName?: string;
  responseStatus?: string;
  self?: boolean;
}

/** Single event returned by GOOGLECALENDAR_FIND_EVENT */
export interface ComposioCalendarEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  location?: string;
  description?: string;
  attendees?: ComposioCalendarAttendee[];
  hangoutLink?: string;
  status?: string;
  created?: string;
  recurrence?: string[];
  recurringEventId?: string;
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
  htmlLink?: string;
  organizer?: { email?: string; displayName?: string; self?: boolean };
  /** Internal: tracks which calendar this came from */
  _calId?: string;
}

/** Response wrapper from GOOGLECALENDAR_FIND_EVENT */
export interface ComposioCalendarListResponse {
  items?: ComposioCalendarEvent[];
  event_data?: ComposioCalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

// ---------------------------------------------------------------------------
// Mapped/enriched calendar event (after mapGoogleEvent transform in CalendarPage)
// ---------------------------------------------------------------------------

export interface MappedCalendarEvent {
  id: string;
  day: number;
  month: number;
  year: number;
  label: string;
  title: string;
  color: string;
  category: string;
  recurrence: string;
  rruleInfo: { key: string; label: string; icon: string } | null;
  remote: boolean;
  googleId?: string;
  calendarId?: string;
  meetLink?: string | null;
  description?: string | null;
  location?: string | null;
  attendees?: { email: string; displayName: string; responseStatus?: string; self?: boolean }[];
  startTime?: string | null;
  endTime?: string | null;
  status?: string;
  htmlLink?: string | null;
  organizer?: { email?: string; displayName?: string; self?: boolean } | null;
  reminderMinutes?: number;
}

/** Body for Google Calendar event create/update via Composio proxy */
export interface GoogleCalendarEventBody {
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  description?: string;
  location?: string;
  attendees?: { email: string }[];
  reminders?: { useDefault: boolean; overrides?: { method: string; minutes: number }[] };
  conferenceData?: Record<string, unknown>;
  conferenceDataVersion?: number;
  [key: string]: unknown;
}

/** Single task returned by GOOGLETASKS_LIST_TASKS */
export interface ComposioTask {
  id: string;
  title: string;
  status: "needsAction" | "completed";
  due?: string;
  notes?: string;
  updated?: string;
  completed?: string;
  position?: string;
}

/** Response wrapper from GOOGLETASKS_LIST_TASKS */
export interface ComposioTaskListResponse {
  items?: ComposioTask[];
  nextPageToken?: string;
}

/** Connection status returned by integrations-connect */
export interface ComposioConnection {
  toolkit: string;
  connectionId: string;
  status: "ACTIVE" | "INITIATED" | "FAILED" | string;
  connectedAt: string;
  email?: string | null;
}

// ---------------------------------------------------------------------------
// Gmail raw API types (used when parsing raw Gmail responses in EmailPage)
// ---------------------------------------------------------------------------

/** Single header from a Gmail message payload */
export interface GmailHeader {
  name: string;
  value: string;
}

/** MIME part inside a Gmail message payload */
export interface GmailMessagePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailMessagePart[];
}

/** Gmail message payload (from messages.get with full format) */
export interface GmailPayload {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { size?: number; data?: string };
  parts?: GmailMessagePart[];
}

/** Full Gmail message as returned by messages.get */
export interface GmailRawMessage {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPayload;
  sizeEstimate?: number;
  historyId?: string;
}

/** Gmail label object from labels.list */
export interface GmailLabel {
  id: string;
  name: string;
  type?: string;
  messageListVisibility?: string;
  labelListVisibility?: string;
  messagesTotal?: number;
  messagesUnread?: number;
  threadsTotal?: number;
  threadsUnread?: number;
  color?: { textColor?: string; backgroundColor?: string };
}

/** Google Calendar secondary calendar entry */
export interface GoogleCalendar {
  id: string;
  summary?: string;
  description?: string;
  primary?: boolean;
  selected?: boolean;
  hidden?: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  accessRole?: string;
}

// ---------------------------------------------------------------------------
// Composio infrastructure types
// ---------------------------------------------------------------------------

/** Connection status returned by integrations-connect */
export interface ComposioConnection {
  toolkit: string;
  connectionId: string;
  status: "ACTIVE" | "INITIATED" | "FAILED" | string;
  connectedAt: string;
  email?: string | null;
}

/** Request body for the composio-proxy edge function */
export interface ComposioProxyRequest {
  service: string;
  path: string;
  method?: string;
  data?: Record<string, unknown>;
  params?: Record<string, unknown>;
  workspace_id?: string;
}
