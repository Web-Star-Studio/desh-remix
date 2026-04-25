/**
 * @function composio-proxy
 * @description Proxy para Composio Actions — Gmail, Calendar, Drive, Contacts, Meet
 * @status active
 * @calledBy useEdgeFn, useComposioProxy (frontend hooks)
 */
import { corsHeaders } from "../_shared/utils.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { emitEvent } from "../_shared/event-emitter.ts";

const COMPOSIO_API_KEY = Deno.env.get('COMPOSIO_API_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

/** Pre-initialized service client — avoids re-importing on every request */
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  SUPABASE_SERVICE_ROLE_KEY,
)

/** Request timeout for Composio API calls (ms) */
const ACTION_TIMEOUT_MS = 25_000;

const SERVICE_TO_APP: Record<string, string> = {
  gmail: 'gmail',
  calendar: 'googlecalendar',
  tasks: 'googletasks',
  people: 'gmail',
  drive: 'googledrive',
  meet: 'googlemeet',
  docs: 'googledocs',
  sheets: 'googlesheets',
  youtube: 'youtube',
  spotify: 'spotify',
  slack: 'slack',
  notion: 'notion',
  github: 'github',
  twitter: 'twitter',
  linkedin: 'linkedin',
  telegram: 'telegram',
  trello: 'trello',
  todoist: 'todoist',
  dropbox: 'dropbox',
  outlook: 'outlook',
  onedrive: 'onedrive',
  teams: 'microsoftteams',
  // Social Media & Ads (via Composio)
  instagram: 'instagram',
  facebook: 'facebook',
  tiktok: 'tiktok',
  pinterest: 'pinterest',
  googlemybusiness: 'googlemybusiness',
  googleads: 'googleads',
  googleanalytics: 'googleanalytics',
  facebookads: 'facebookads',
  linkedinads: 'linkedinads',
  tiktokads: 'tiktokads',
}

function pathToComposioAction(service: string, path: string, method: string): { action: string; params: Record<string, unknown> } | null {
  const m = method.toUpperCase()

  // ═══════════════════════════════════════════════════════════
  // GMAIL
  // ═══════════════════════════════════════════════════════════
  if (service === 'gmail') {
    // Send email: POST /messages/send
    if (path.includes('/messages/send') && m === 'POST') {
      return { action: 'GMAIL_SEND_EMAIL', params: {} }
    }
    // Reply to thread: POST /messages/reply
    if (path.includes('/messages/reply') && m === 'POST') {
      return { action: 'GMAIL_REPLY_TO_THREAD', params: { user_id: 'me' } }
    }
    // Batch delete: POST /messages/batchDelete
    if (path.includes('/batchDelete') && m === 'POST') {
      return { action: 'GMAIL_BATCH_DELETE_MESSAGES', params: { user_id: 'me' } }
    }
    // Batch modify: POST /messages/batchModify → handled as special batch loop
    if (path.includes('/batchModify') && m === 'POST') {
      return { action: '__BATCH_MODIFY__', params: { user_id: 'me' } }
    }
    // Forward: POST /messages/{id}/forward
    if (path.match(/\/messages\/[^/]+\/forward$/) && m === 'POST') {
      const id = path.split('/messages/')[1]?.split('/')[0]
      return { action: 'GMAIL_FORWARD_MESSAGE', params: { message_id: id, user_id: 'me' } }
    }
    // Untrash: POST /messages/{id}/untrash
    if (path.match(/\/messages\/[^/]+\/untrash$/) && m === 'POST') {
      const id = path.split('/messages/')[1]?.split('/')[0]
      return { action: 'GMAIL_UNTRASH_MESSAGE', params: { message_id: id, user_id: 'me' } }
    }
    // Trash: POST /messages/{id}/trash
    if (path.includes('/trash') && m === 'POST') {
      const id = path.split('/messages/')[1]?.split('/')[0]
      return { action: 'GMAIL_MOVE_TO_TRASH', params: { message_id: id, user_id: 'me' } }
    }
    // Modify labels: POST /messages/{id}/modify
    if (path.match(/\/messages\/[^/]+\/modify$/) && m === 'POST') {
      const id = path.split('/messages/')[1]?.split('/')[0]
      return { action: 'GMAIL_ADD_LABEL_TO_EMAIL', params: { message_id: id, user_id: 'me' } }
    }
    // Delete message permanently: DELETE /messages/{id}
    if (path.match(/\/messages\/[^/]+$/) && m === 'DELETE') {
      const id = path.split('/').pop()
      return { action: 'GMAIL_DELETE_MESSAGE', params: { message_id: id, user_id: 'me' } }
    }
    // Get attachment: GET /messages/{id}/attachments/{aid}
    if (path.match(/\/messages\/[^/]+\/attachments\/[^/]+$/) && m === 'GET') {
      const parts = path.split('/')
      const attachmentId = parts.pop()!
      parts.pop() // 'attachments'
      const messageId = parts.pop()!
      return { action: 'GMAIL_GET_ATTACHMENT', params: { message_id: messageId, attachment_id: attachmentId, user_id: 'me' } }
    }
    // Get single message: GET /messages/{id}
    if (path.match(/\/messages\/[^/]+$/) && m === 'GET') {
      const id = path.split('/').pop()
      return { action: 'GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID', params: { message_id: id, user_id: 'me' } }
    }
    // List messages: GET /messages
    if (path.includes('/messages') && m === 'GET') {
      return { action: 'GMAIL_FETCH_EMAILS', params: { user_id: 'me', max_results: 20, label_ids: ['INBOX'] } }
    }
    // Send draft: POST /drafts/{id}/send
    if (path.match(/\/drafts\/[^/]+\/send$/) && m === 'POST') {
      const id = path.split('/drafts/')[1]?.split('/')[0]
      return { action: 'GMAIL_SEND_DRAFT', params: { draft_id: id, user_id: 'me' } }
    }
    // Create draft: POST /drafts
    if (path.includes('/drafts') && m === 'POST') {
      return { action: 'GMAIL_CREATE_EMAIL_DRAFT', params: { user_id: 'me' } }
    }
    // Get draft: GET /drafts/{id}
    if (path.match(/\/drafts\/[^/]+$/) && m === 'GET') {
      const id = path.split('/drafts/')[1]
      return { action: 'GMAIL_GET_DRAFT', params: { draft_id: id, user_id: 'me' } }
    }
    // List drafts: GET /drafts
    if (path.includes('/drafts') && m === 'GET') {
      return { action: 'GMAIL_LIST_DRAFTS', params: { user_id: 'me' } }
    }
    // Get thread: GET /threads/{id}
    if (path.match(/\/threads\/[^/]+$/) && m === 'GET') {
      const id = path.split('/threads/')[1]
      return { action: 'GMAIL_FETCH_MESSAGE_BY_THREAD_ID', params: { thread_id: id, user_id: 'me' } }
    }
    // List threads: GET /threads
    if (path.includes('/threads') && m === 'GET') {
      return { action: 'GMAIL_LIST_THREADS', params: { user_id: 'me' } }
    }
    // Create label: POST /labels
    if (path.includes('/labels') && m === 'POST') {
      return { action: 'GMAIL_CREATE_LABEL', params: { user_id: 'me' } }
    }
    // Delete label: DELETE /labels/{id}
    if (path.match(/\/labels\/[^/]+$/) && m === 'DELETE') {
      const id = path.split('/labels/')[1]
      return { action: 'GMAIL_DELETE_LABEL', params: { label_id: id, user_id: 'me' } }
    }
    // List labels: GET /labels
    if (path.includes('/labels') && m === 'GET') {
      return { action: 'GMAIL_LIST_LABELS', params: { user_id: 'me' } }
    }
    // Get profile: GET /profile
    if (path.includes('/profile') && m === 'GET') {
      return { action: 'GMAIL_GET_PROFILE', params: { user_id: 'me' } }
    }
    // List history: GET /history
    if (path.includes('/history') && m === 'GET') {
      return { action: 'GMAIL_LIST_HISTORY', params: { user_id: 'me' } }
    }
    // Watch (push notifications): POST /watch
    if (path.includes('/watch') && m === 'POST') {
      return { action: 'GMAIL_WATCH', params: { user_id: 'me' } }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // GOOGLE CALENDAR
  // ═══════════════════════════════════════════════════════════
  if (service === 'calendar') {
    // List calendars: GET /calendarList
    if (path.includes('/calendarList') && m === 'GET') {
      return { action: 'GOOGLECALENDAR_LIST_CALENDARS', params: {} }
    }
    // Get calendar: GET /calendars/{id}
    if (path.match(/\/calendars\/[^/]+$/) && m === 'GET') {
      const id = path.split('/calendars/')[1]
      return { action: 'GOOGLECALENDAR_GET_CALENDAR', params: { calendar_id: id } }
    }
    // Quick add: POST /events/quickAdd
    if (path.includes('/events/quickAdd') && m === 'POST') {
      return { action: 'GOOGLECALENDAR_QUICK_ADD', params: { calendar_id: 'primary' } }
    }
    // Helper: extract calendarId from path like /calendars/{calId}/events/...
    const extractCalId = (p: string): string => {
      const match = p.match(/\/calendars\/([^/]+)\//)
      return match ? decodeURIComponent(match[1]) : 'primary'
    }
    // Move event: POST /events/{id}/move
    if (path.match(/\/events\/[^/]+\/move$/) && m === 'POST') {
      const id = path.split('/events/')[1]?.split('/')[0]
      return { action: 'GOOGLECALENDAR_EVENTS_MOVE', params: { event_id: id, calendar_id: extractCalId(path) } }
    }
    // Remove attendee: DELETE /events/{id}/attendees/{email}
    if (path.match(/\/events\/[^/]+\/attendees\//) && m === 'DELETE') {
      const parts = path.split('/')
      const email = parts.pop()!
      parts.pop() // 'attendees'
      const eventId = parts.pop()!
      return { action: 'GOOGLECALENDAR_REMOVE_ATTENDEE', params: { event_id: eventId, attendee_email: email, calendar_id: extractCalId(path) } }
    }
    // Create event: POST /events
    if (path.includes('/events') && m === 'POST') {
      return { action: 'GOOGLECALENDAR_CREATE_EVENT', params: { calendar_id: extractCalId(path) } }
    }
    // Update event: PATCH /events/{id}
    if (path.match(/\/events\/[^/]+$/) && m === 'PATCH') {
      const id = path.split('/events/')[1]
      return { action: 'GOOGLECALENDAR_UPDATE_EVENT', params: { event_id: id, calendar_id: extractCalId(path) } }
    }
    // Delete event: DELETE /events/{id}
    if (path.match(/\/events\/[^/]+$/) && m === 'DELETE') {
      const id = path.split('/events/')[1]
      return { action: 'GOOGLECALENDAR_DELETE_EVENT', params: { event_id: id, calendar_id: extractCalId(path) } }
    }
    // Get event by ID: GET /events/{id} (specific)
    if (path.match(/\/events\/[^/]+$/) && m === 'GET') {
      const id = path.split('/events/')[1]
      return { action: 'GOOGLECALENDAR_EVENTS_GET', params: { event_id: id, calendar_id: extractCalId(path) } }
    }
    // Find/list events: GET /events
    if (path.includes('/events') && m === 'GET') {
      return { action: 'GOOGLECALENDAR_FIND_EVENT', params: { calendar_id: extractCalId(path), max_results: 50 } }
    }
    // Find free slots: GET/POST /freeBusy
    if (path.includes('/freeBusy')) {
      return { action: 'GOOGLECALENDAR_FIND_FREE_SLOTS', params: { calendar_id: 'primary' } }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // GOOGLE TASKS
  // ═══════════════════════════════════════════════════════════
  if (service === 'tasks') {
    // Clear completed: POST /lists/{id}/clear
    if (path.match(/\/lists\/[^/]+\/clear$/) && m === 'POST') {
      const listId = path.split('/lists/')[1]?.split('/')[0] || '@default'
      return { action: 'GOOGLETASKS_CLEAR_TASKS', params: { tasklist_id: listId } }
    }
    // Move task: POST /lists/{id}/tasks/{taskId}/move
    if (path.match(/\/lists\/[^/]+\/tasks\/[^/]+\/move$/) && m === 'POST') {
      const parts = path.split('/')
      parts.pop() // 'move'
      const taskId = parts.pop()!
      parts.pop() // 'tasks'
      const listId = parts.pop() || '@default'
      return { action: 'GOOGLETASKS_MOVE_TASK', params: { tasklist_id: listId, task_id: taskId } }
    }
    // Get single task: GET /lists/{id}/tasks/{taskId}
    if (path.match(/\/lists\/[^/]+\/tasks\/[^/]+$/) && m === 'GET') {
      const parts = path.split('/')
      const taskId = parts.pop()!
      parts.pop() // 'tasks'
      const listId = parts.pop() || '@default'
      return { action: 'GOOGLETASKS_GET_TASK', params: { tasklist_id: listId, task_id: taskId } }
    }
    // List tasks: GET /lists/{id}/tasks
    if (path.match(/\/lists\/[^/]+\/tasks$/) && m === 'GET') {
      const listId = path.split('/lists/')[1]?.split('/')[0] || '@default'
      return { action: 'GOOGLETASKS_LIST_TASKS', params: { tasklist_id: listId } }
    }
    // Create task: POST /lists/{id}/tasks
    if (path.match(/\/lists\/[^/]+\/tasks$/) && m === 'POST') {
      const listId = path.split('/lists/')[1]?.split('/')[0] || '@default'
      return { action: 'GOOGLETASKS_INSERT_TASK', params: { tasklist_id: listId, status: 'needsAction' } }
    }
    // Update task: PATCH /lists/{id}/tasks/{taskId} — use PATCH_TASK (not deprecated UPDATE_TASK)
    if (path.match(/\/lists\/[^/]+\/tasks\/[^/]+$/) && m === 'PATCH') {
      const parts = path.split('/')
      const taskId = parts.pop()!
      parts.pop() // 'tasks'
      const listId = parts.pop() || '@default'
      return { action: 'GOOGLETASKS_PATCH_TASK', params: { tasklist_id: listId, task_id: taskId } }
    }
    // Delete task: DELETE /lists/{id}/tasks/{taskId}
    if (path.match(/\/lists\/[^/]+\/tasks\/[^/]+$/) && m === 'DELETE') {
      const parts = path.split('/')
      const taskId = parts.pop()!
      parts.pop() // 'tasks'
      const listId = parts.pop() || '@default'
      return { action: 'GOOGLETASKS_DELETE_TASK', params: { tasklist_id: listId, task_id: taskId } }
    }
    // List task lists: GET /lists
    if (path.includes('/lists') && m === 'GET') {
      return { action: 'GOOGLETASKS_LIST_TASK_LISTS', params: {} }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // GOOGLE DRIVE
  // ═══════════════════════════════════════════════════════════
  if (service === 'drive') {
    // Copy file: POST /files/{id}/copy
    if (path.match(/\/files\/[^/]+\/copy$/) && m === 'POST') {
      const id = path.split('/files/')[1]?.split('/')[0]
      return { action: 'GOOGLEDRIVE_COPY_FILE_ADVANCED', params: { file_id: id } }
    }
    // Trash file: POST /files/{id}/trash
    if (path.match(/\/files\/[^/]+\/trash$/) && m === 'POST') {
      const id = path.split('/files/')[1]?.split('/')[0]
      return { action: 'GOOGLEDRIVE_TRASH_FILE', params: { file_id: id } }
    }
    // Move file: POST /files/{id}/move
    if (path.match(/\/files\/[^/]+\/move$/) && m === 'POST') {
      const id = path.split('/files/')[1]?.split('/')[0]
      return { action: 'GOOGLEDRIVE_MOVE_FILE', params: { file_id: id } }
    }
    // Permissions: POST /files/{id}/permissions
    if (path.match(/\/files\/[^/]+\/permissions$/) && m === 'POST') {
      const id = path.split('/files/')[1]?.split('/')[0]
      return { action: 'GOOGLEDRIVE_CREATE_PERMISSION', params: { file_id: id } }
    }
    // Revisions: GET /files/{id}/revisions
    if (path.match(/\/files\/[^/]+\/revisions$/) && m === 'GET') {
      const id = path.split('/files/')[1]?.split('/')[0]
      return { action: 'GOOGLEDRIVE_LIST_REVISIONS', params: { file_id: id } }
    }
    // Download: GET /files/{id}/download
    if (path.match(/\/files\/[^/]+\/download$/) && m === 'GET') {
      const id = path.split('/files/')[1]?.split('/')[0]
      return { action: 'GOOGLEDRIVE_DOWNLOAD_FILE', params: { file_id: id } }
    }
    // Export: GET /files/{id}/export
    if (path.match(/\/files\/[^/]+\/export$/) && m === 'GET') {
      const id = path.split('/files/')[1]?.split('/')[0]
      return { action: 'GOOGLEDRIVE_EXPORT_GOOGLE_WORKSPACE_FILE', params: { file_id: id } }
    }
    // Update/rename/move file: PATCH /files/{id}
    if (path.match(/\/files\/[^/]+$/) && m === 'PATCH') {
      const id = path.split('/files/')[1]
      return { action: 'GOOGLEDRIVE_EDIT_FILE', params: { file_id: id } }
    }
    // Get file metadata: GET /files/{id}
    if (path.match(/\/files\/[^/]+$/) && m === 'GET') {
      const id = path.split('/files/')[1]
      return { action: 'GOOGLEDRIVE_GET_FILE_METADATA', params: { file_id: id } }
    }
    // Delete file: DELETE /files/{id}
    if (path.match(/\/files\/[^/]+$/) && m === 'DELETE') {
      const id = path.split('/files/')[1]
      return { action: 'GOOGLEDRIVE_DELETE_FILE', params: { file_id: id } }
    }
    // Create from text: POST /files/fromText
    if (path.includes('/files/fromText') && m === 'POST') {
      return { action: 'GOOGLEDRIVE_CREATE_FILE_FROM_TEXT', params: {} }
    }
    // Upload file: POST /files
    if (path.includes('/files') && m === 'POST') {
      return { action: 'GOOGLEDRIVE_UPLOAD_FILE', params: {} }
    }
    // List/search files: GET /files or GET /search
    if ((path.includes('/files') || path.includes('/search')) && m === 'GET') {
      return { action: 'GOOGLEDRIVE_FIND_FILE', params: { page_size: 20 } }
    }
    // Find folder: GET /folders
    if (path.includes('/folders') && m === 'GET') {
      return { action: 'GOOGLEDRIVE_FIND_FOLDER', params: {} }
    }
    // Create folder: POST /folders
    if (path.includes('/folders') && m === 'POST') {
      return { action: 'GOOGLEDRIVE_CREATE_FOLDER', params: {} }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // GOOGLE CONTACTS (People API — via gmail toolkit)
  // ═══════════════════════════════════════════════════════════
  if (service === 'people') {
    // Search contacts: GET /people:searchContacts or /search
    if ((path.includes('searchContacts') || path.includes('/search')) && m === 'GET') {
      return { action: 'GMAIL_SEARCH_PEOPLE', params: {} }
    }
    // Get specific person: GET /people/{resourceName}
    if (path.match(/\/people\/[^/]+$/) && m === 'GET') {
      const resourceName = path.split('/people/')[1]
      return { action: 'GMAIL_GET_PEOPLE', params: { resource_name: resourceName } }
    }
    // List contacts: GET /people/me/connections or GET /connections or GET /
    if (m === 'GET') {
      return { action: 'GMAIL_GET_CONTACTS', params: {} }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // GOOGLE DOCS
  // ═══════════════════════════════════════════════════════════
  if (service === 'docs') {
    // Search docs: GET /documents/search
    if (path.includes('/documents/search') && m === 'GET') {
      return { action: 'GOOGLEDOCS_SEARCH_DOCUMENTS', params: {} }
    }
    // Get plaintext: GET /documents/{id}/text
    if (path.match(/\/documents\/[^/]+\/text$/) && m === 'GET') {
      const id = path.split('/documents/')[1]?.split('/')[0]
      return { action: 'GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT', params: { document_id: id } }
    }
    // Create doc: POST /documents
    if (path.includes('/documents') && m === 'POST') {
      return { action: 'GOOGLEDOCS_CREATE_DOCUMENT', params: {} }
    }
    // Update doc: PATCH /documents/{id}
    if (path.match(/\/documents\/[^/]+$/) && m === 'PATCH') {
      const id = path.split('/documents/')[1]
      return { action: 'GOOGLEDOCS_UPDATE_EXISTING_DOCUMENT', params: { document_id: id } }
    }
    // Get doc by ID: GET /documents/{id}
    if (path.match(/\/documents\/[^/]+$/) && m === 'GET') {
      const id = path.split('/documents/')[1]
      return { action: 'GOOGLEDOCS_GET_DOCUMENT_BY_ID', params: { document_id: id } }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // GOOGLE SHEETS
  // ═══════════════════════════════════════════════════════════
  if (service === 'sheets') {
    // Append values: POST /spreadsheets/{id}/values/{range}:append
    if (path.includes(':append') && m === 'POST') {
      const id = path.split('/spreadsheets/')[1]?.split('/')[0]
      const range = path.split('/values/')[1]?.split(':')[0]
      return { action: 'GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND', params: { spreadsheet_id: id, range } }
    }
    // Update values: PUT /spreadsheets/{id}/values/{range}
    if (path.match(/\/spreadsheets\/[^/]+\/values\//) && m === 'PUT') {
      const id = path.split('/spreadsheets/')[1]?.split('/')[0]
      const range = path.split('/values/')[1]
      return { action: 'GOOGLESHEETS_VALUES_UPDATE', params: { spreadsheet_id: id, range } }
    }
    // Get values: GET /spreadsheets/{id}/values/{range}
    if (path.match(/\/spreadsheets\/[^/]+\/values\//) && m === 'GET') {
      const id = path.split('/spreadsheets/')[1]?.split('/')[0]
      const range = path.split('/values/')[1]
      return { action: 'GOOGLESHEETS_VALUES_GET', params: { spreadsheet_id: id, range } }
    }
    // Create spreadsheet: POST /spreadsheets
    if (path.includes('/spreadsheets') && m === 'POST') {
      return { action: 'GOOGLESHEETS_CREATE_GOOGLE_SHEET1', params: {} }
    }
    // Get spreadsheet info: GET /spreadsheets/{id}
    if (path.match(/\/spreadsheets\/[^/]+$/) && m === 'GET') {
      const id = path.split('/spreadsheets/')[1]
      return { action: 'GOOGLESHEETS_GET_SPREADSHEET_INFO', params: { spreadsheet_id: id } }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // GOOGLE MEET
  // ═══════════════════════════════════════════════════════════
  if (service === 'meet') {
    // Create space: POST /spaces
    if (path.includes('/spaces') && m === 'POST') {
      return { action: 'GOOGLEMEET_CREATE_SPACE', params: {} }
    }
    // Get space: GET /spaces/{id}
    if (path.match(/\/spaces\/[^/]+$/) && m === 'GET') {
      const id = path.split('/spaces/')[1]
      return { action: 'GOOGLEMEET_GET_SPACE', params: { space_id: id } }
    }
    // List conference records: GET /conferenceRecords
    if (path.includes('/conferenceRecords') && m === 'GET') {
      return { action: 'GOOGLEMEET_LIST_CONFERENCE_RECORDS', params: {} }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // YOUTUBE
  // ═══════════════════════════════════════════════════════════
  if (service === 'youtube') {
    // Profile: GET /profile
    if (path.includes('/profile') && m === 'GET') {
      return { action: 'YOUTUBE_LIST_USER_PLAYLISTS', params: { maxResults: 5 } }
    }
    // Insights: GET /insights
    if (path.includes('/insights') && m === 'GET') {
      return { action: 'YOUTUBE_LIST_CHANNEL_VIDEOS', params: { maxResults: 5 } }
    }
    // Posts: GET /posts
    if (path.includes('/posts') && m === 'GET') {
      return { action: 'YOUTUBE_LIST_CHANNEL_VIDEOS', params: { maxResults: 20 } }
    }
    // Search videos: GET /search
    if (path.includes('/search') && m === 'GET') {
      return { action: 'YOUTUBE_SEARCH_YOU_TUBE', params: { type: 'video', maxResults: 10 } }
    }
    // List user playlists: GET /playlists
    if (path.includes('/playlists') && m === 'GET') {
      return { action: 'YOUTUBE_LIST_USER_PLAYLISTS', params: { maxResults: 25 } }
    }
    // Get playlist items: GET /playlistItems
    if (path.includes('/playlistItems') && m === 'GET') {
      return { action: 'YOUTUBE_LIST_CHANNEL_VIDEOS', params: { maxResults: 25 } }
    }
    // Get video details: GET /videos/{id}
    if (path.match(/\/videos\/[^/]+$/) && m === 'GET') {
      const id = path.split('/videos/')[1]
      return { action: 'YOUTUBE_VIDEO_DETAILS', params: { id } }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SPOTIFY
  // ═══════════════════════════════════════════════════════════
  if (service === 'spotify') {
    // Search: GET /search
    if (path.includes('/search') && m === 'GET') {
      return { action: 'SPOTIFY_SEARCH_FOR_ITEM', params: { type: 'track', limit: 10 } }
    }
    // User playlists: GET /playlists
    if (path === '/playlists' && m === 'GET') {
      return { action: 'SPOTIFY_GET_CURRENT_USERS_PLAYLISTS', params: { limit: 25 } }
    }
    // Playlist tracks: GET /playlists/{id}/tracks
    if (path.match(/\/playlists\/[^/]+\/tracks$/) && m === 'GET') {
      const id = path.split('/playlists/')[1]?.split('/')[0]
      return { action: 'SPOTIFY_GET_PLAYLISTS_TRACKS', params: { playlist_id: id, limit: 25 } }
    }
    // Recommendations: GET /recommendations
    if (path.includes('/recommendations') && m === 'GET') {
      return { action: 'SPOTIFY_GET_RECOMMENDATIONS', params: { limit: 10 } }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SLACK
  // ═══════════════════════════════════════════════════════════
  if (service === 'slack') {
    if (path.includes('/send') && m === 'POST') {
      return { action: 'SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL', params: {} }
    }
    if (path.includes('/conversations') && m === 'GET') {
      return { action: 'SLACK_LIST_CONVERSATIONS', params: {} }
    }
    if (path.includes('/members') && m === 'GET') {
      return { action: 'SLACK_LIST_MEMBERS', params: {} }
    }
    if (path.includes('/history') && m === 'GET') {
      return { action: 'SLACK_GET_CHANNEL_HISTORY', params: {} }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // NOTION
  // ═══════════════════════════════════════════════════════════
  if (service === 'notion') {
    if (path.includes('/pages/search') && m === 'GET') {
      return { action: 'NOTION_SEARCH_NOTION_PAGE', params: {} }
    }
    if (path.includes('/pages') && m === 'POST') {
      return { action: 'NOTION_CREATE_NOTION_PAGE', params: {} }
    }
    if (path.match(/\/pages\/[^/]+$/) && m === 'GET') {
      const id = path.split('/pages/')[1]
      return { action: 'NOTION_GET_PAGE', params: { page_id: id } }
    }
    if (path.includes('/databases/list') && m === 'GET') {
      return { action: 'NOTION_LIST_DATABASES', params: {} }
    }
    if (path.match(/\/databases\/[^/]+\/query$/) && m === 'POST') {
      const id = path.split('/databases/')[1]?.split('/')[0]
      return { action: 'NOTION_QUERY_A_DATABASE', params: { database_id: id } }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // GITHUB
  // ═══════════════════════════════════════════════════════════
  if (service === 'github') {
    if (path === '/repos' && m === 'GET') {
      return { action: 'GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER', params: {} }
    }
    if (path.match(/\/repos\/[^/]+\/[^/]+\/issues$/) && m === 'GET') {
      const parts = path.split('/repos/')[1]?.split('/')
      return { action: 'GITHUB_LIST_REPOSITORY_ISSUES', params: { owner: parts?.[0], repo: parts?.[1] } }
    }
    if (path.match(/\/repos\/[^/]+\/[^/]+\/issues$/) && m === 'POST') {
      const parts = path.split('/repos/')[1]?.split('/')
      return { action: 'GITHUB_CREATE_AN_ISSUE', params: { owner: parts?.[0], repo: parts?.[1] } }
    }
    if (path.match(/\/repos\/[^/]+\/[^/]+$/) && m === 'GET') {
      const parts = path.split('/repos/')[1]?.split('/')
      return { action: 'GITHUB_GET_A_REPOSITORY', params: { owner: parts?.[0], repo: parts?.[1] } }
    }
    if (path.includes('/notifications') && m === 'GET') {
      return { action: 'GITHUB_LIST_NOTIFICATIONS', params: {} }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // TWITTER / X
  // ═══════════════════════════════════════════════════════════
  if (service === 'twitter') {
    if (path.includes('/tweets') && m === 'POST') {
      return { action: 'TWITTER_CREATION_OF_A_POST', params: {} }
    }
    if (path.includes('/profile') && m === 'GET') {
      return { action: 'TWITTER_USER_LOOKUP_ME', params: {} }
    }
    if (path.includes('/me') && m === 'GET') {
      return { action: 'TWITTER_USER_LOOKUP_ME', params: {} }
    }
    if (path.includes('/insights') && m === 'GET') {
      return { action: 'TWITTER_BOOKMARKS_BY_USER', params: {} }
    }
    if (path.includes('/bookmarks') && m === 'GET') {
      return { action: 'TWITTER_BOOKMARKS_BY_USER', params: {} }
    }
    if (path.includes('/posts') && m === 'GET') {
      return { action: 'TWITTER_USER_TIMELINE', params: {} }
    }
    if (path.includes('/timeline') && m === 'GET') {
      return { action: 'TWITTER_USER_HOME_TIMELINE_BY_USER_ID', params: {} }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // LINKEDIN
  // ═══════════════════════════════════════════════════════════
  if (service === 'linkedin') {
    if (path.includes('/posts') && m === 'POST') {
      return { action: 'LINKEDIN_CREATE_LINKED_IN_POST', params: {} }
    }
    if (path.includes('/posts') && m === 'GET') {
      return { action: 'LINKEDIN_GET_POST_CONTENT', params: {} }
    }
    if (path.includes('/profile') && m === 'GET') {
      return { action: 'LINKEDIN_GET_MY_INFO', params: {} }
    }
    if (path.includes('/insights') && m === 'GET') {
      return { action: 'LINKEDIN_GET_MY_INFO', params: {} }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // TELEGRAM
  // ═══════════════════════════════════════════════════════════
  if (service === 'telegram') {
    if (path.includes('/send') && m === 'POST') {
      return { action: 'TELEGRAM_SEND_MESSAGE', params: {} }
    }
    if (path.includes('/updates') && m === 'GET') {
      return { action: 'TELEGRAM_GET_UPDATES', params: {} }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // TRELLO
  // ═══════════════════════════════════════════════════════════
  if (service === 'trello') {
    if (path === '/boards' && m === 'GET') {
      return { action: 'TRELLO_GET_MEMBERS_BOARDS_BY_ID_MEMBER', params: { id_member: 'me' } }
    }
    if (path.match(/\/boards\/[^/]+\/lists$/) && m === 'GET') {
      const id = path.split('/boards/')[1]?.split('/')[0]
      return { action: 'TRELLO_GET_BOARDS_LISTS_BY_ID_BOARD', params: { id_board: id } }
    }
    if (path.match(/\/lists\/[^/]+\/cards$/) && m === 'GET') {
      const id = path.split('/lists/')[1]?.split('/')[0]
      return { action: 'TRELLO_GET_LISTS_CARDS_BY_ID_LIST', params: { id_list: id } }
    }
    if (path.includes('/cards') && m === 'POST') {
      return { action: 'TRELLO_POST_CARDS', params: {} }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // TODOIST
  // ═══════════════════════════════════════════════════════════
  if (service === 'todoist') {
    if (path === '/projects' && m === 'GET') {
      return { action: 'TODOIST_GET_ALL_PROJECTS', params: {} }
    }
    if (path === '/tasks' && m === 'GET') {
      return { action: 'TODOIST_GET_ALL_TASKS', params: {} }
    }
    if (path === '/tasks' && m === 'POST') {
      return { action: 'TODOIST_CREATE_TASK', params: {} }
    }
    if (path.match(/\/tasks\/[^/]+\/close$/) && m === 'POST') {
      const id = path.split('/tasks/')[1]?.split('/')[0]
      return { action: 'TODOIST_CLOSE_TASK', params: { task_id: id } }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // DROPBOX
  // ═══════════════════════════════════════════════════════════
  if (service === 'dropbox') {
    if (path.includes('/files/list') && m === 'GET') {
      return { action: 'DROPBOX_LIST_FOLDER', params: {} }
    }
    if (path.includes('/files/search') && m === 'GET') {
      return { action: 'DROPBOX_SEARCH_FILES_V2', params: {} }
    }
    if (path.includes('/files/upload') && m === 'POST') {
      return { action: 'DROPBOX_UPLOAD', params: {} }
    }
    if (path.includes('/files/download') && m === 'GET') {
      return { action: 'DROPBOX_DOWNLOAD', params: {} }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // OUTLOOK (Microsoft)
  // ═══════════════════════════════════════════════════════════
  if (service === 'outlook') {
    // More specific routes first to avoid substring match issues
    if (path.includes('/messages/send') && m === 'POST') {
      return { action: 'OUTLOOK_SEND_EMAIL', params: {} }
    }
    if (path.includes('/messages') && m === 'GET') {
      return { action: 'OUTLOOK_LIST_MESSAGES', params: {} }
    }
    if (path.includes('/folders') && m === 'GET') {
      return { action: 'OUTLOOK_LIST_MAIL_FOLDERS', params: {} }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ONEDRIVE (Microsoft)
  // ═══════════════════════════════════════════════════════════
  if (service === 'onedrive') {
    if (path.includes('/files') && m === 'GET') {
      return { action: 'ONEDRIVE_LIST_FILES', params: {} }
    }
    if (path.includes('/search') && m === 'GET') {
      return { action: 'ONEDRIVE_SEARCH_FILES', params: {} }
    }
    if (path.includes('/upload') && m === 'POST') {
      return { action: 'ONEDRIVE_UPLOAD_FILE', params: {} }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // MICROSOFT TEAMS
  // ═══════════════════════════════════════════════════════════
  if (service === 'teams') {
    if (path.includes('/channels') && m === 'GET') {
      return { action: 'MICROSOFTTEAMS_LIST_CHANNELS', params: {} }
    }
    if (path.includes('/messages/send') && m === 'POST') {
      return { action: 'MICROSOFTTEAMS_SEND_CHANNEL_MESSAGE', params: {} }
    }
    if (path.includes('/teams') && m === 'GET') {
      return { action: 'MICROSOFTTEAMS_LIST_JOINED_TEAMS', params: {} }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // GENERIC SOCIAL / ADS / ANALYTICS — convention-based mapping
  // Path: /profile → SERVICE_GET_USER_PROFILE, /posts → SERVICE_GET_MEDIA, etc.
  // ═══════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════
  // GENERIC SOCIAL / ADS / ANALYTICS — platform-specific action map
  // ═══════════════════════════════════════════════════════════
  const SOCIAL_ACTION_MAP: Record<string, Record<string, string>> = {
    instagram: {
      PROFILE: 'INSTAGRAM_GET_USER_MEDIA',
      INSIGHTS: 'INSTAGRAM_GET_USER_MEDIA',
      POSTS: 'INSTAGRAM_GET_USER_MEDIA',
    },
    facebook: {
      PROFILE: 'FACEBOOK_GET_PAGE_DETAILS',
      INSIGHTS: 'FACEBOOK_GET_PAGE_INSIGHTS',
      POSTS: 'FACEBOOK_GET_PAGE_POSTS',
    },
    tiktok: {
      PROFILE: 'TIKTOK_GET_USER_INFO',
      INSIGHTS: 'TIKTOK_GET_USER_VIDEOS',
      POSTS: 'TIKTOK_GET_USER_VIDEOS',
    },
    pinterest: {
      PROFILE: 'PINTEREST_GET_USER_ACCOUNT',
      INSIGHTS: 'PINTEREST_GET_USER_ACCOUNT',
      POSTS: 'PINTEREST_LIST_PINS',
    },
    googleads: {
      CAMPAIGNS: 'GOOGLEADS_GET_CAMPAIGN_BY_NAME',
      INSIGHTS: 'GOOGLEADS_GET_CAMPAIGN_BY_ID',
      PROFILE: 'GOOGLEADS_GET_CUSTOMER_LISTS',
    },
    facebookads: {
      CAMPAIGNS: 'FACEBOOKADS_GET_CAMPAIGNS',
      INSIGHTS: 'FACEBOOKADS_GET_AD_INSIGHTS',
      PROFILE: 'FACEBOOKADS_GET_CAMPAIGNS',
    },
    linkedinads: {
      CAMPAIGNS: 'LINKEDINADS_GET_CAMPAIGNS',
      INSIGHTS: 'LINKEDINADS_GET_AD_ANALYTICS',
      PROFILE: 'LINKEDINADS_GET_CAMPAIGNS',
    },
    tiktokads: {
      CAMPAIGNS: 'TIKTOKADS_GET_CAMPAIGNS',
      INSIGHTS: 'TIKTOKADS_GET_AD_REPORT',
      PROFILE: 'TIKTOKADS_GET_CAMPAIGNS',
    },
    googleanalytics: {
      REPORT: 'GOOGLEANALYTICS_GET_REPORT',
      INSIGHTS: 'GOOGLEANALYTICS_GET_REPORT',
      PROFILE: 'GOOGLEANALYTICS_GET_REPORT',
    },
  }
  const socialMap = SOCIAL_ACTION_MAP[service]
  if (socialMap) {
    const pathSegment = path.replace(/^\//, '').replace(/\//g, '_').toUpperCase()
    const action = socialMap[pathSegment]
    if (action) {
      return { action, params: {} }
    }
    // No fallback — return null to trigger not_mapped error
    return null
  }

  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const internalUserId = req.headers.get('x-user-id')?.trim() || null
    const isInternalServiceCall = token === SUPABASE_SERVICE_ROLE_KEY

    // Support internal service-role calls from other edge functions while keeping
    // normal user JWT validation for frontend requests.
    let userId: string | null = null
    if (isInternalServiceCall) {
      if (!internalUserId) {
        return new Response(JSON.stringify({ error: 'Missing x-user-id for internal call' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      userId = internalUserId
    } else {
      const { data: claimsData, error: claimsError } = await supabaseAdmin.auth.getClaims(token)
      if (!claimsError && claimsData?.claims?.sub) {
        userId = claimsData.claims.sub as string
      } else {
        // Fallback to getUser for edge cases
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
        if (authError || !user) {
          console.error('Auth error:', claimsError?.message || authError?.message)
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        userId = user.id
      }
    }

    const body = await req.json()
    const { service, path, method = 'GET', data: requestData, body: requestBody, params, workspace_id, default_workspace_id } = body

    // ── Workspace-aware entityId ──
    // Resolve effective workspace: 'all' falls back to default, missing falls back to 'default'
    const effectiveWorkspaceId = workspace_id === 'all'
      ? (default_workspace_id || 'default')
      : (workspace_id || 'default')

    // ── SECURITY: Validate workspace belongs to user ──
    if (effectiveWorkspaceId !== 'default') {
      const { data: wsRow } = await supabaseAdmin
        .from('workspaces')
        .select('id')
        .eq('id', effectiveWorkspaceId)
        .eq('user_id', userId)
        .maybeSingle()
      if (!wsRow) {
        console.warn(`[composio-proxy] BLOCKED: User ${userId} tried workspace ${effectiveWorkspaceId} they don't own`)
        return new Response(JSON.stringify({ error: 'Forbidden: workspace does not belong to you' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const entityId = `${userId}_${effectiveWorkspaceId}`

    // Input validation: restrict service and method to known values
    const ALLOWED_SERVICES = Object.keys(SERVICE_TO_APP)
    const ALLOWED_METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
    const cleanMethod = (method || 'GET').toUpperCase()

    if (service === 'debug') {
      // Debug endpoint restricted to development or admin only
      return new Response(JSON.stringify({ error: 'Debug endpoint disabled in production' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!ALLOWED_SERVICES.includes(service)) {
      return new Response(JSON.stringify({ error: 'invalid_service', message: `Service "${service}" not supported` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!ALLOWED_METHODS.includes(cleanMethod)) {
      return new Response(JSON.stringify({ error: 'invalid_method', message: `Method "${method}" not allowed` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!path || typeof path !== 'string' || path.length > 500) {
      return new Response(JSON.stringify({ error: 'invalid_path' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const effectiveData = requestData || requestBody

    const actionMapping = pathToComposioAction(service, path, cleanMethod)

    if (!actionMapping) {
      console.warn(`[composio-proxy] No action mapping for ${cleanMethod} ${service}${path}`)
      return new Response(JSON.stringify({
        error: 'not_mapped',
        message: `Sem mapeamento para ${cleanMethod} ${service}${path}`,
        service, path, method: cleanMethod,
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const mergedParams = {
      ...actionMapping.params,
      ...params,
      ...(effectiveData || {}),
    }

    // Normalize label_ids: Composio expects arrays
    if (mergedParams.labelIds) {
      mergedParams.label_ids = Array.isArray(mergedParams.labelIds)
        ? mergedParams.labelIds
        : [mergedParams.labelIds]
      delete mergedParams.labelIds
    }
    // Also normalize addLabelIds / removeLabelIds for modify actions
    if (mergedParams.addLabelIds) {
      mergedParams.add_label_ids = Array.isArray(mergedParams.addLabelIds)
        ? mergedParams.addLabelIds
        : [mergedParams.addLabelIds]
      delete mergedParams.addLabelIds
    }
    if (mergedParams.removeLabelIds) {
      mergedParams.remove_label_ids = Array.isArray(mergedParams.removeLabelIds)
        ? mergedParams.removeLabelIds
        : [mergedParams.removeLabelIds]
      delete mergedParams.removeLabelIds
      }

    // ── Normalize Google Calendar nested format → Composio flat params ──
    if (actionMapping.action === 'GOOGLECALENDAR_CREATE_EVENT' || actionMapping.action === 'GOOGLECALENDAR_UPDATE_EVENT' || actionMapping.action === 'GOOGLECALENDAR_PATCH_EVENT') {
      // Composio expects 'summary' (NOT 'title') for the event name.
      // If caller sent 'title' but not 'summary', map title → summary
      if (mergedParams.title && !mergedParams.summary) {
        mergedParams.summary = mergedParams.title
      }
      delete mergedParams.title
      // start.dateTime → start_datetime
      if (mergedParams.start?.dateTime && !mergedParams.start_datetime) {
        mergedParams.start_datetime = mergedParams.start.dateTime
        mergedParams.timezone = mergedParams.start.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
        delete mergedParams.start
      }
      // end.dateTime → end_datetime
      if (mergedParams.end?.dateTime && !mergedParams.end_datetime) {
        mergedParams.end_datetime = mergedParams.end.dateTime
        delete mergedParams.end
      }
      // Remove milissegundos que o Composio não aceita
      // "2026-03-29T15:00:00.000Z" → "2026-03-29T15:00:00Z"
      if (mergedParams.start_datetime && typeof mergedParams.start_datetime === 'string') {
        mergedParams.start_datetime = mergedParams.start_datetime
          .replace(/\.\d{3}Z$/, 'Z')
          .replace(/\.\d{3}([+-])/, '$1')
      }
      if (mergedParams.end_datetime && typeof mergedParams.end_datetime === 'string') {
        mergedParams.end_datetime = mergedParams.end_datetime
          .replace(/\.\d{3}Z$/, 'Z')
          .replace(/\.\d{3}([+-])/, '$1')
      }
      // attendees array → attendees (emails list)
      if (Array.isArray(mergedParams.attendees)) {
        mergedParams.attendees = mergedParams.attendees.map((a: any) =>
          typeof a === 'string' ? a : a.email
        ).filter(Boolean)
      }
      // conferenceData → create_meeting_link
      if (mergedParams.conferenceData) {
        mergedParams.create_meeting_link = true
        delete mergedParams.conferenceData
      }
      // reminders → event_reminder (minutes)
      if (mergedParams.reminders?.overrides?.length) {
        mergedParams.event_reminder = mergedParams.reminders.overrides[0].minutes
        delete mergedParams.reminders
      }
      // Ensure calendar_id
      if (!mergedParams.calendar_id) {
        mergedParams.calendar_id = 'primary'
      }
      console.log(`[composio-proxy] Calendar ${actionMapping.action} normalized params:`, JSON.stringify(mergedParams))
    }

    // Remove params that Composio doesn't understand
    // Preserve 'format' for Gmail actions (needed for full/metadata responses)
    if (service !== 'gmail') {
      delete mergedParams.format
    }
    delete mergedParams.conferenceDataVersion
    // Remove connectionId — Composio resolves via entityId
    delete mergedParams.connectionId

    // ── Calendar param normalization (camelCase → snake_case) ──
    if (service === 'calendar' || service === 'googlecalendar') {
      if (mergedParams.singleEvents !== undefined) {
        mergedParams.single_events = mergedParams.singleEvents === 'true' || mergedParams.singleEvents === true
        delete mergedParams.singleEvents
      }
      if (mergedParams.orderBy !== undefined) {
        mergedParams.order_by = mergedParams.orderBy
        delete mergedParams.orderBy
      }
      if (mergedParams.maxResults !== undefined) {
        mergedParams.max_results = typeof mergedParams.maxResults === 'string'
          ? parseInt(mergedParams.maxResults, 10)
          : mergedParams.maxResults
        delete mergedParams.maxResults
      }
      if (mergedParams.timeMin !== undefined) {
        mergedParams.time_min = mergedParams.timeMin
        delete mergedParams.timeMin
      }
      if (mergedParams.timeMax !== undefined) {
        mergedParams.time_max = mergedParams.timeMax
        delete mergedParams.timeMax
      }
    }

    // ── Gmail send/draft normalization: accept raw OR separate fields ──
    if (service === 'gmail') {
      if (actionMapping.action === 'GMAIL_SEND_EMAIL') {
        // If recipient_email is already provided, skip raw decoding entirely
        if (mergedParams.recipient_email) {
          console.log('[composio-proxy] GMAIL_SEND_EMAIL: recipient_email already set, skipping raw decode')
          // Clean up raw field since we have structured fields
          delete mergedParams.raw
        } else if (mergedParams.raw) {
          // Decode raw RFC2822 to extract separate fields as fallback for Composio
          try {
            const decoded = atob(mergedParams.raw.replace(/-/g, '+').replace(/_/g, '/'))
            const [headerBlock, ...bodyParts] = decoded.split('\r\n\r\n')
            const headers = Object.fromEntries(
              headerBlock.split('\r\n').map((line: string) => {
                const idx = line.indexOf(':')
                return idx > 0 ? [line.slice(0, idx).trim().toLowerCase(), line.slice(idx + 1).trim()] : ['', '']
              }).filter(([k]: string[]) => k)
            )
            // Provide both raw and separate fields — Composio will use whichever it supports
            if (!mergedParams.recipient_email && headers.to) mergedParams.recipient_email = headers.to
            if (!mergedParams.subject && headers.subject) mergedParams.subject = headers.subject
            if (!mergedParams.body && bodyParts.length) mergedParams.body = bodyParts.join('\r\n\r\n')
          } catch (decodeErr) {
            console.warn('[composio-proxy] Could not decode raw email for field extraction:', decodeErr)
          }
        }
      }
      if (actionMapping.action === 'GMAIL_CREATE_EMAIL_DRAFT') {
        if (mergedParams.message?.raw) {
          mergedParams.raw = mergedParams.message.raw
          delete mergedParams.message
          // Also extract fields as fallback
          try {
            const decoded = atob(mergedParams.raw.replace(/-/g, '+').replace(/_/g, '/'))
            const [headerBlock, ...bodyParts] = decoded.split('\r\n\r\n')
            const headers = Object.fromEntries(
              headerBlock.split('\r\n').map((line: string) => {
                const idx = line.indexOf(':')
                return idx > 0 ? [line.slice(0, idx).trim().toLowerCase(), line.slice(idx + 1).trim()] : ['', '']
              }).filter(([k]: string[]) => k)
            )
            if (!mergedParams.recipient_email && headers.to) mergedParams.recipient_email = headers.to
            if (!mergedParams.subject && headers.subject) mergedParams.subject = headers.subject
            if (!mergedParams.body && bodyParts.length) mergedParams.body = bodyParts.join('\r\n\r\n')
          } catch (decodeErr) {
            console.warn('[composio-proxy] Could not decode raw draft for field extraction:', decodeErr)
          }
        }
      }
    }


    // Log GMAIL_SEND_EMAIL params for debugging
    if (actionMapping.action === 'GMAIL_SEND_EMAIL') {
      console.log('[composio-proxy] GMAIL_SEND_EMAIL final params:', JSON.stringify({
        recipient_email: mergedParams.recipient_email,
        subject: mergedParams.subject,
        hasBody: !!mergedParams.body,
        hasRaw: !!mergedParams.raw,
      }))
    }

    // ── Handle batch modify as sequential individual modify calls ──
    if (actionMapping.action === '__BATCH_MODIFY__') {
      const ids: string[] = mergedParams.ids || []
      const addLabels: string[] = mergedParams.add_label_ids || []
      const removeLabels: string[] = mergedParams.remove_label_ids || []

      if (!ids.length) {
        return new Response(JSON.stringify({ error: 'No message IDs provided' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const results: Array<{ id: string; ok: boolean }> = []
      for (const msgId of ids) {
        try {
          const modifyRes = await fetch(
            `https://backend.composio.dev/api/v2/actions/GMAIL_ADD_LABEL_TO_EMAIL/execute`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': COMPOSIO_API_KEY,
              },
              body: JSON.stringify({
                entityId,
                appName: 'gmail',
                input: {
                  message_id: msgId,
                  user_id: 'me',
                  ...(addLabels.length ? { add_label_ids: addLabels } : {}),
                  ...(removeLabels.length ? { remove_label_ids: removeLabels } : {}),
                },
              }),
            },
          )
          results.push({ id: msgId, ok: modifyRes.ok })
          if (!modifyRes.ok) {
            const errText = await modifyRes.text()
            console.warn(`[composio-proxy] batch-modify failed for ${msgId}:`, errText.substring(0, 200))
          } else {
            await modifyRes.text() // consume body
          }
        } catch (e) {
          console.warn(`[composio-proxy] batch-modify error for ${msgId}:`, e)
          results.push({ id: msgId, ok: false })
        }
      }

      const successCount = results.filter(r => r.ok).length
      console.log(`[composio-proxy] batch-modify: ${successCount}/${ids.length} succeeded`)

      return new Response(JSON.stringify({ success: true, modified: successCount, total: ids.length, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Server-side cache layer (GET-only, read operations) ──
    const CACHE_TTL: Record<string, number> = {
      calendar: 300,   // 5min
      tasks: 600,      // 10min
      people: 900,     // 15min
      gmail: 180,      // 3min
      drive: 600,      // 10min
    }
    const cacheTtlSeconds = cleanMethod === 'GET' ? (CACHE_TTL[service] || 0) : 0
    let cacheKey = ''

    if (cacheTtlSeconds > 0) {
      // Build cache key from userId + action + sorted params
      const sortedParams = JSON.stringify(mergedParams, Object.keys(mergedParams).sort())
      cacheKey = `${userId}:${actionMapping.action}:${sortedParams}`

      // Check cache
      const { data: cached } = await supabaseAdmin
        .from('api_cache')
        .select('data, expires_at')
        .eq('cache_key', cacheKey)
        .single()

      if (cached && new Date(cached.expires_at) > new Date()) {
        console.log(`[composio-proxy] Cache HIT for ${actionMapping.action}`)
        return new Response(JSON.stringify(cached.data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
        })
      }
    }

    // Track start time for latency logging
    const actionStartTime = Date.now()

    let actionRes!: Response;
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), ACTION_TIMEOUT_MS)
      try {
        actionRes = await fetch(
          `https://backend.composio.dev/api/v2/actions/${actionMapping.action}/execute`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': COMPOSIO_API_KEY,
            },
            body: JSON.stringify({
              entityId,
              appName: SERVICE_TO_APP[service] || service,
              input: mergedParams,
            }),
            signal: controller.signal,
          },
        )
      } catch (fetchErr: any) {
        clearTimeout(timeoutId)
        if (fetchErr.name === 'AbortError') {
          console.error(`[composio-proxy] Timeout (${ACTION_TIMEOUT_MS}ms) on ${actionMapping.action}`)
          return new Response(JSON.stringify({
            error: 'timeout',
            message: `Composio action ${actionMapping.action} timed out after ${ACTION_TIMEOUT_MS / 1000}s`,
          }), {
            status: 504,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        throw fetchErr
      }
      clearTimeout(timeoutId)

      if (actionRes.status === 429 && attempt < maxRetries - 1) {
        const backoffMs = 1000 * Math.pow(2, attempt) + Math.random() * 500;
        console.warn(`[composio-proxy] Rate limited (429) on ${actionMapping.action}, retrying in ${Math.round(backoffMs)}ms (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(r => setTimeout(r, backoffMs))
        continue
      }
      break
    }

    const actionText = await actionRes.text()
    const actionLatencyMs = Date.now() - actionStartTime

    // ── Async usage logging (fire-and-forget) ──
    const logInsert = supabaseAdmin.from('composio_action_logs').insert({
      user_id: userId,
      action: actionMapping.action,
      service,
      method: cleanMethod,
      path,
      status: actionRes.ok ? 'ok' : 'error',
      latency_ms: actionLatencyMs,
      error_message: actionRes.ok ? null : actionText.substring(0, 500),
      workspace_id: effectiveWorkspaceId,
    })
    // Fire and forget — don't block response
    logInsert.then(({ error: logErr }) => {
      if (logErr) console.warn('[composio-proxy] Failed to log action:', logErr.message)
    })

    if (!actionRes.ok) {
      // Enhanced error logging: log full input for debugging
      console.error(`[composio-proxy] ACTION FAILED: ${actionMapping.action}`, JSON.stringify({
        status: actionRes.status,
        input: mergedParams,
        response: actionText.substring(0, 500),
      }))

      if (actionRes.status === 404 || actionText.includes('not_connected') || actionText.includes('No connected account')) {
        return new Response(JSON.stringify({
          error: 'not_connected',
          message: `Usuário não conectou ${service} via Composio`,
          toolkit: service,
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({
        error: 'action_failed',
        action: actionMapping.action,
        detail: actionText.substring(0, 500),
      }), {
        status: actionRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Parse response — handle HTML fallback from Composio ──
    const contentType = actionRes.headers.get('content-type') || ''
    if (contentType.includes('text/html') || actionText.trimStart().startsWith('<!DOCTYPE') || actionText.trimStart().startsWith('<html')) {
      console.warn(`[composio-proxy] HTML response from ${actionMapping.action}, returning structured error`)
      return new Response(JSON.stringify({
        error: 'unexpected_html_response',
        message: 'Composio retornou HTML em vez de JSON. Tente novamente.',
        action: actionMapping.action,
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    try {
      const actionData = JSON.parse(actionText)
      // Composio wraps responses in various structures:
      // - { data: { response_data: {...} } } for some actions
      // - { data: {...} } for others
      // - { response_data: {...} } for direct
      // Unwrap to get the actual payload
      const result = actionData.data?.response_data || actionData.response_data || actionData.data || actionData
      
      // For calendar create/update, log the result for debugging
      if (actionMapping.action.includes('CREATE_EVENT') || actionMapping.action.includes('UPDATE_EVENT')) {
        console.log(`[composio-proxy] ${actionMapping.action} result keys:`, Object.keys(result || {}))
        if (result?.error) {
          console.error(`[composio-proxy] ${actionMapping.action} returned error in payload:`, JSON.stringify(result.error))
        }
      }

      // Emit automation events for key actions (fire-and-forget)
      const wsId = effectiveWorkspaceId === 'default' ? null : effectiveWorkspaceId
      if (actionMapping.action === 'GOOGLECALENDAR_CREATE_EVENT' && !result?.error) {
        emitEvent(supabaseAdmin, userId!, wsId, 'calendar.event_created', 'calendar', {
          event_id: result?.id, summary: result?.summary, start: result?.start,
        }).catch(() => {})
      } else if (actionMapping.action === 'GMAIL_SEND_EMAIL' && !result?.error) {
        emitEvent(supabaseAdmin, userId!, wsId, 'email.sent', 'email', {
          to: mergedParams.recipient_email, subject: mergedParams.subject,
        }).catch(() => {})
      } else if (actionMapping.action.includes('GOOGLETASKS') && actionMapping.action.includes('PATCH') && mergedParams.status === 'completed') {
        emitEvent(supabaseAdmin, userId!, wsId, 'task.completed', 'tasks', {
          task_id: mergedParams.task_id, title: result?.title,
        }).catch(() => {})
      } else if (actionMapping.action === 'GOOGLETASKS_INSERT_TASK' && !result?.error) {
        emitEvent(supabaseAdmin, userId!, wsId, 'task.created', 'tasks', {
          task_id: result?.id, title: result?.title,
        }).catch(() => {})
      }
      // ── Write to server-side cache (fire-and-forget) ──
      if (cacheKey && cacheTtlSeconds > 0 && !result?.error) {
        const expiresAt = new Date(Date.now() + cacheTtlSeconds * 1000).toISOString()
        supabaseAdmin
          .from('api_cache')
          .upsert({ cache_key: cacheKey, data: result, expires_at: expiresAt, created_at: new Date().toISOString() }, { onConflict: 'cache_key' })
          .then(({ error: cacheErr }) => {
            if (cacheErr) console.warn('[composio-proxy] Cache write error:', cacheErr.message)
          })
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
      })
    } catch {
      console.warn(`[composio-proxy] Non-JSON response from ${actionMapping.action}:`, actionText.substring(0, 200))
      return new Response(JSON.stringify({
        error: 'invalid_response',
        message: 'Resposta inválida do Composio',
        raw: actionText.substring(0, 300),
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } catch (error) {
    console.error('[composio-proxy] Error:', error)
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})