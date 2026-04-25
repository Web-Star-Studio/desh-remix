export type EmailFolder = "inbox" | "sent" | "drafts" | "trash" | "archive" | "spam";
export type LabelColor = "red" | "blue" | "green" | "yellow" | "purple" | "orange";

export interface EmailLabel {
  id: string;
  name: string;
  color: LabelColor;
}

export interface EmailItem {
  id: string;
  from: string;
  email: string;
  subject: string;
  body: string;
  date: string;
  unread: boolean;
  starred: boolean;
  hasAttachment: boolean;
  folder: EmailFolder;
  labels: string[];
  /** Email address of the account this email belongs to (multi-account) */
  accountEmail?: string;
  /** Display color for the account badge */
  accountColor?: string;
  /** Connection ID for the source account */
  connectionId?: string;
  /** Workspace this email belongs to */
  workspaceId?: string | null;
}

export interface CachedEmail {
  id: string;
  gmail_id: string;
  from: string;
  email: string;
  subject: string;
  body: string;
  date: string;
  unread: boolean;
  starred: boolean;
  hasAttachment: boolean;
  folder: string;
  labels: string[];
  /** Which account this email belongs to */
  accountEmail?: string;
  accountColor?: string;
  connectionId?: string;
  workspaceId?: string | null;
  /** Gmail thread ID for proper reply threading */
  threadId?: string;
}

export interface GmailSyncProgress {
  synced: number;
  totalSynced: number;
  done: boolean;
}

export interface GmailSyncState {
  folder: string;
  nextPageToken: string | null;
  totalSynced: number;
  syncCompleted: boolean;
  lastSyncedAt: string | null;
  historyId: number | null;
  watchExpiration: string | null;
  connectionId?: string;
}
