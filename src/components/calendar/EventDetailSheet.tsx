import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Clock, MapPin, Video, ExternalLink, AlignLeft, Link2, Mail, Users, CheckCircle2, XCircle, HelpCircle, AlertCircle, Loader2, Edit3, Trash2, CalendarDays, Timer, Copy } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EVENT_CATEGORY_COLORS, EVENT_CATEGORY_LABELS, type EventCategory } from "@/types/calendar";
import { useMemo } from "react";
import { toast } from "@/hooks/use-toast";

interface EventDetailSheetProps {
  detailEvent: any | null;
  onClose: () => void;
  rsvpMap: Record<string, string>;
  rsvpLoading: Record<string, boolean>;
  onRsvp: (event: any, response: "accepted" | "declined" | "tentative") => void;
  onEdit?: (event: any) => void;
  onDelete?: (event: any) => void;
}

const EventDetailSheet = ({ detailEvent, onClose, rsvpMap, rsvpLoading, onRsvp, onEdit, onDelete }: EventDetailSheetProps) => {
  // Duration & countdown (stable hooks before conditional render)
  const durationStr = useMemo(() => {
    if (!detailEvent?.startTime || !detailEvent?.endTime) return null;
    const [sh, sm] = detailEvent.startTime.split(":").map(Number);
    const [eh, em] = detailEvent.endTime.split(":").map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff <= 0) return null;
    if (diff < 60) return `${diff} minutos`;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return m > 0 ? `${h}h ${m}min` : `${h} hora${h > 1 ? "s" : ""}`;
  }, [detailEvent?.startTime, detailEvent?.endTime]);

  const countdownStr = useMemo(() => {
    if (!detailEvent) return null;
    const now = new Date();
    if (detailEvent.day !== now.getDate() || detailEvent.month !== now.getMonth() || detailEvent.year !== now.getFullYear()) return null;
    if (!detailEvent.startTime) return null;
    const [h, m] = detailEvent.startTime.split(":").map(Number);
    const eventMs = new Date(detailEvent.year, detailEvent.month, detailEvent.day, h, m).getTime();
    const diff = eventMs - now.getTime();
    if (diff < 0) return "em andamento";
    const mins = Math.round(diff / 60000);
    if (mins < 1) return "começando agora";
    if (mins < 60) return `em ${mins} minuto${mins > 1 ? "s" : ""}`;
    const hrs = Math.floor(mins / 60);
    return `em ${hrs}h${mins % 60 > 0 ? ` ${mins % 60}min` : ""}`;
  }, [detailEvent]);

  const handleCopyDetails = () => {
    if (!detailEvent) return;
    const ev = detailEvent;
    const parts = [ev.title || ev.label];
    if (ev.startTime) parts.push(`Horário: ${ev.startTime}${ev.endTime ? ` – ${ev.endTime}` : ""}`);
    if (ev.location) parts.push(`Local: ${ev.location}`);
    if (ev.meetLink) parts.push(`Meet: ${ev.meetLink}`);
    navigator.clipboard.writeText(parts.join("\n")).then(() => {
      toast({ title: "Detalhes copiados!" });
    });
  };

  return (
    <Sheet open={!!detailEvent} onOpenChange={open => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 bg-background/95 backdrop-blur-xl border-border/50 flex flex-col">
        {detailEvent && (() => {
          const ev = detailEvent as any;
          const dateLabel = format(new Date(ev.year, ev.month, ev.day), "EEEE, d 'de' MMMM yyyy", { locale: ptBR });
          const selfAttendee = ev.attendees?.find((a: any) => a.self);
          const currentRsvp = rsvpMap[ev.googleId] ?? selfAttendee?.responseStatus ?? "needsAction";
          const categoryLabel = EVENT_CATEGORY_LABELS[ev.category as EventCategory] || "";
          const RSVP_OPTIONS = [
            { key: "accepted",  label: "Aceitar",  icon: CheckCircle2, cls: "text-emerald-500", activeCls: "bg-emerald-500/15 border-emerald-500/40 text-emerald-400" },
            { key: "declined",  label: "Recusar",  icon: XCircle,      cls: "text-destructive",  activeCls: "bg-destructive/15 border-destructive/40 text-destructive" },
            { key: "tentative", label: "Talvez",   icon: HelpCircle,   cls: "text-amber-500",    activeCls: "bg-amber-500/15 border-amber-500/40 text-amber-400" },
          ] as const;
          const rsvpStatusLabel: Record<string, string> = { accepted: "Confirmado", declined: "Recusado", tentative: "Talvez", needsAction: "Sem resposta" };
          const rsvpStatusIcon: Record<string, any> = { accepted: CheckCircle2, declined: XCircle, tentative: HelpCircle, needsAction: AlertCircle };
          const RsvpIcon = rsvpStatusIcon[currentRsvp] || AlertCircle;
          const isRecurring = ev.id?.includes("_rec_");
          return (
            <>
              <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/40 space-y-0">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 w-3 h-3 rounded-full shrink-0 ${EVENT_CATEGORY_COLORS[ev.category] || "bg-primary"}`} />
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-base font-semibold text-foreground leading-snug">{ev.title || ev.label}</SheetTitle>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">{dateLabel}</p>
                    {categoryLabel && (
                      <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground mt-1">
                        {categoryLabel}
                      </span>
                    )}
                  </div>
                </div>
              </SheetHeader>

              <ScrollArea className="flex-1">
                <div className="px-5 py-4 space-y-5">
                  {/* Countdown badge */}
                  {countdownStr && (
                    <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3 py-2">
                      <Timer className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-sm font-medium text-primary">{countdownStr}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    {(ev.startTime || ev.endTime) && (
                      <div className="flex items-center gap-2.5 text-sm text-foreground/80">
                        <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span>
                          {ev.startTime}{ev.endTime ? ` – ${ev.endTime}` : ""}
                          {durationStr && <span className="text-muted-foreground ml-1.5">({durationStr})</span>}
                        </span>
                      </div>
                    )}
                    {ev.location && (
                      <div className="flex items-start gap-2.5 text-sm text-foreground/80">
                        <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                        <span className="break-words">{ev.location}</span>
                      </div>
                    )}
                    {ev.meetLink && (
                      <div className="flex items-center gap-2.5">
                        <Video className="w-4 h-4 text-primary shrink-0" />
                        <a href={ev.meetLink} target="_blank" rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline flex items-center gap-1">
                          Abrir Google Meet <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                    {ev.htmlLink && (
                      <div className="flex items-center gap-2.5">
                        <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
                        <a href={ev.htmlLink} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                          Ver no Google Calendar <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>

                  {ev.description && (
                    <>
                      <Separator className="bg-border/40" />
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <AlignLeft className="w-3.5 h-3.5" /> Descrição
                        </p>
                        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap break-words">{ev.description}</p>
                      </div>
                    </>
                  )}

                  {ev.googleId && selfAttendee && (
                    <>
                      <Separator className="bg-border/40" />
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <RsvpIcon className="w-3.5 h-3.5" /> Sua resposta · <span className="normal-case">{rsvpStatusLabel[currentRsvp] || "—"}</span>
                        </p>
                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                          {RSVP_OPTIONS.map(opt => {
                            const isActive = currentRsvp === opt.key;
                            const Icon = opt.icon;
                            return (
                              <button key={opt.key}
                                disabled={rsvpLoading[ev.googleId]}
                                onClick={() => onRsvp(ev, opt.key)}
                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all disabled:opacity-50 ${
                                  isActive ? opt.activeCls : "border-border/40 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                                }`}>
                                {rsvpLoading[ev.googleId] && isActive
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <Icon className="w-3.5 h-3.5" />}
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  {ev.organizer && (
                    <>
                      <Separator className="bg-border/40" />
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Organizador</p>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="w-7 h-7">
                            <AvatarFallback className="text-[11px] bg-primary/20 text-primary">
                              {(ev.organizer.displayName || ev.organizer.email || "?")[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            {ev.organizer.displayName && <p className="text-sm font-medium text-foreground leading-tight">{ev.organizer.displayName}</p>}
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="w-3 h-3" />{ev.organizer.email}
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {ev.attendees?.length > 0 && (
                    <>
                      <Separator className="bg-border/40" />
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" /> Participantes ({ev.attendees.length})
                        </p>
                        <div className="space-y-2">
                          {ev.attendees.map((a: any, i: number) => {
                            const statusIcon: Record<string, any> = { accepted: CheckCircle2, declined: XCircle, tentative: HelpCircle, needsAction: AlertCircle };
                            const statusColor: Record<string, string> = { accepted: "text-emerald-400", declined: "text-destructive", tentative: "text-amber-400", needsAction: "text-muted-foreground" };
                            const StatusIcon = statusIcon[a.responseStatus] || AlertCircle;
                            const initials = (a.displayName || a.email || "?").slice(0, 2).toUpperCase();
                            return (
                              <div key={i} className="flex items-center gap-2.5">
                                <div className="relative">
                                  <Avatar className="w-7 h-7">
                                    <AvatarImage src={`https://www.gravatar.com/avatar/${a.email}?d=404&s=56`} />
                                    <AvatarFallback className="text-[11px] bg-foreground/10">{initials}</AvatarFallback>
                                  </Avatar>
                                  <StatusIcon className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${statusColor[a.responseStatus] || "text-muted-foreground"} bg-background rounded-full`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  {a.displayName && <p className="text-sm text-foreground leading-tight truncate">{a.displayName}{a.self ? " (você)" : ""}</p>}
                                  <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  {ev.status && ev.status !== "confirmed" && (
                    <>
                      <Separator className="bg-border/40" />
                      <p className="text-xs text-muted-foreground capitalize">Status: {ev.status}</p>
                    </>
                  )}

                  {/* Action buttons */}
                  <Separator className="bg-border/40" />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopyDetails}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border/40 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copiar
                    </button>
                    {!isRecurring && onEdit && (
                      <button
                        onClick={() => { onEdit(ev); onClose(); }}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-all"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Editar
                      </button>
                    )}
                    {!isRecurring && onDelete && (
                      <button
                        onClick={() => { onDelete(ev); onClose(); }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-destructive hover:bg-destructive/10 border border-destructive/20 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </>
          );
        })()}
      </SheetContent>
    </Sheet>
  );
};

export default EventDetailSheet;
