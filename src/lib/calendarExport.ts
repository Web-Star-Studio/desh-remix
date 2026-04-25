/**
 * Build and download an .ics file from an array of calendar events.
 */
export function buildIcs(events: Array<{
  googleId?: string;
  id?: string;
  year: number;
  month: number;
  day: number;
  startTime?: string | null;
  endTime?: string | null;
  title?: string;
  label?: string;
  description?: string;
  location?: string;
  meetLink?: string;
}>, filename: string): void {
  const escape = (s: string) =>
    (s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

  const formatDt = (year: number, month: number, day: number, timeStr?: string | null): string => {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    if (timeStr) {
      const [h, m] = timeStr.split(":").map(Number);
      return `${year}${mm}${dd}T${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
    }
    return `${year}${mm}${dd}`;
  };

  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Desh//CalendarExport//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  events.forEach((ev) => {
    const uid = `${ev.googleId || ev.id}@desh-calendar`;
    const dtstart = formatDt(ev.year, ev.month, ev.day, ev.startTime);
    const dtend = ev.endTime
      ? formatDt(ev.year, ev.month, ev.day, ev.endTime)
      : formatDt(ev.year, ev.month, ev.day + 1, null);
    const isAllDay = !ev.startTime;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(isAllDay ? `DTSTART;VALUE=DATE:${dtstart}` : `DTSTART:${dtstart}`);
    lines.push(isAllDay ? `DTEND;VALUE=DATE:${dtend}` : `DTEND:${dtend}`);
    lines.push(`SUMMARY:${escape(ev.title || ev.label || "")}`);
    if (ev.description) lines.push(`DESCRIPTION:${escape(ev.description)}`);
    if (ev.location) lines.push(`LOCATION:${escape(ev.location)}`);
    if (ev.meetLink) lines.push(`URL:${ev.meetLink}`);
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
