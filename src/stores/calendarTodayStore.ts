/**
 * Lightweight global store for calendar today event count.
 * Used by SideNav to show badge without needing full calendar context.
 */
let _todayCount = 0;
const _listeners = new Set<() => void>();

export function setCalendarTodayCount(count: number) {
  if (_todayCount === count) return;
  _todayCount = count;
  _listeners.forEach((fn) => fn());
}

export function getCalendarTodayCount() {
  return _todayCount;
}

export function subscribeCalendarToday(fn: () => void) {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}
