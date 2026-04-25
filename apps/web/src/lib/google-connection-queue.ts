const QUEUE_KEY = 'desh_google_connection_queue';

export interface ConnectionQueue {
  toolkits: string[];
  currentIndex: number;
  completedToolkits: string[];
  failedToolkits: string[];
  startedAt: string;
  workspaceId: string;
}

const TOOLKIT_NAMES: Record<string, string> = {
  gmail: 'Gmail',
  googlecalendar: 'Google Calendar',
  googledrive: 'Google Drive',
  googletasks: 'Google Tasks',
  googlecontacts: 'Google Contacts',
};

export function startConnectionQueue(toolkits: string[], workspaceId: string): void {
  const queue: ConnectionQueue = {
    toolkits,
    currentIndex: 0,
    completedToolkits: [],
    failedToolkits: [],
    startedAt: new Date().toISOString(),
    workspaceId,
  };
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function getConnectionQueue(): ConnectionQueue | null {
  const raw = localStorage.getItem(QUEUE_KEY);
  if (!raw) return null;
  try {
    const queue = JSON.parse(raw) as ConnectionQueue;
    const startedAt = new Date(queue.startedAt).getTime();
    if (Date.now() - startedAt > 10 * 60 * 1000) {
      clearConnectionQueue();
      return null;
    }
    return queue;
  } catch {
    clearConnectionQueue();
    return null;
  }
}

export function advanceQueue(success: boolean): ConnectionQueue | null {
  const queue = getConnectionQueue();
  if (!queue) return null;

  const currentToolkit = queue.toolkits[queue.currentIndex];
  if (success) {
    queue.completedToolkits.push(currentToolkit);
  } else {
    queue.failedToolkits.push(currentToolkit);
  }

  queue.currentIndex += 1;
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return queue;
}

export function hasNextInQueue(): boolean {
  const queue = getConnectionQueue();
  if (!queue) return false;
  return queue.currentIndex < queue.toolkits.length;
}

export function getNextToolkit(): string | null {
  const queue = getConnectionQueue();
  if (!queue) return null;
  if (queue.currentIndex >= queue.toolkits.length) return null;
  return queue.toolkits[queue.currentIndex];
}

export function clearConnectionQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

export function getToolkitDisplayName(toolkit: string): string {
  return TOOLKIT_NAMES[toolkit] || toolkit;
}

export function getQueueProgress() {
  const queue = getConnectionQueue();
  if (!queue) return null;

  const currentToolkit = queue.currentIndex < queue.toolkits.length
    ? queue.toolkits[queue.currentIndex]
    : null;

  return {
    current: queue.currentIndex + 1,
    total: queue.toolkits.length,
    currentName: currentToolkit ? getToolkitDisplayName(currentToolkit) : '',
    completed: queue.completedToolkits,
    failed: queue.failedToolkits,
    isFinished: queue.currentIndex >= queue.toolkits.length,
  };
}
