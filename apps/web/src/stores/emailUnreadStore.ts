/**
 * Lightweight global store for email unread count.
 * Used by SideNav to show badge without needing full email context.
 */
let _unreadCount = 0;
const _listeners = new Set<() => void>();

export function setEmailUnreadCount(count: number) {
  if (_unreadCount === count) return;
  _unreadCount = count;
  _listeners.forEach((fn) => fn());
}

export function getEmailUnreadCount() {
  return _unreadCount;
}

export function subscribeEmailUnread(fn: () => void) {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}
