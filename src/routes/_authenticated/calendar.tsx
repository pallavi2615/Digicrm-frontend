import { defineRoute } from "@/lib/router-compat";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-data-client";
import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronLeft, ChevronRight, Video, CheckSquare, CalendarClock, Plus, Loader2,
  PhoneCall, Mail, User, FileText, Activity, MessageSquare, MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { notifyPermissionDenied } from "@/components/permission-denied";

export const Route = defineRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendar — DigiCRM AI" }] }),
  component: CalendarPage,
});

interface CalendarEvent {
  id: number;
  tenant_id: number;
  title: string;
  description: string | null;
  event_type: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  location: string | null;
  meeting_link: string | null;
  attendees: string[];
  lead_id: number | null;
  contact_id: number | null;
  created_at: string;
}

interface Meeting {
  id: number;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  meeting_link: string | null;
  location: string | null;
  created_at: string;
}

interface Task {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
}

// Lead schedules created from the Leads page (GET /api/v1/lead-schedules)
interface LeadSchedule {
  id: number;
  lead_id: number;
  title: string;
  notes?: string | null;
  activity_type?: string | null;
  activity_label?: string | null;
  display_type?: string | null;
  scheduled_at: string;
  duration_minutes?: number | null;
  status?: string | null;
  lead_name?: string | null;
  lead_company?: string | null;
}

// Unified shape the calendar grid renders, regardless of source endpoint.
interface Ev {
  id: number;
  title: string;
  date: string;
  type: "meeting" | "task" | "schedule";
  origin: "calendar" | "meeting" | "task" | "schedule";
  label?: string | null;      // e.g. "Call", "Demo"
  sub?: string | null;        // e.g. lead name
  done?: boolean;
  activityType?: string | null; // raw activity_type for icon/colour lookup
}

// The API can return datetimes without a timezone (naive UTC). Treat those as UTC
// so a schedule entered as 3:30 PM IST doesn't shift by 5h30m on the calendar.
function normalizeIso(s: string): string {
  if (!s || !s.includes("T")) return s;
  return /([zZ]|[+-]\d{2}:?\d{2})$/.test(s) ? s : `${s}Z`;
}

// ════════════════════════════════════════════════════════════
// Activity-type metadata — icons + colors for lead schedules
// ════════════════════════════════════════════════════════════
type IconType = React.ComponentType<{ className?: string }>;

const ACTIVITY_META: Record<string, { label: string; icon: IconType; chip: string; dot: string }> = {
  call: {
    label: "Call", icon: PhoneCall,
    chip: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
    dot: "text-blue-500",
  },
  email: {
    label: "Mail", icon: Mail,
    chip: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
    dot: "text-indigo-500",
  },
  meeting: {
    label: "Meeting", icon: User,
    chip: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
    dot: "text-purple-500",
  },
  proposal: {
    label: "Proposal", icon: FileText,
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
    dot: "text-amber-500",
  },
  demo: {
    label: "Demo", icon: Activity,
    chip: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300",
    dot: "text-cyan-500",
  },
  follow_up: {
    label: "Follow-up", icon: CalendarClock,
    chip: "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300",
    dot: "text-teal-500",
  },
  followup: {
    label: "Follow-up", icon: CalendarClock,
    chip: "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300",
    dot: "text-teal-500",
  },
  whatsapp: {
    label: "WhatsApp", icon: MessageSquare,
    chip: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300",
    dot: "text-green-500",
  },
  site_visit: {
    label: "Site Visit", icon: MapPin,
    chip: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
    dot: "text-orange-500",
  },
  contract: {
    label: "Contract", icon: FileText,
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    dot: "text-emerald-500",
  },
  reminder: {
    label: "Reminder", icon: CalendarClock,
    chip: "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300",
    dot: "text-pink-500",
  },
  other: {
    label: "Other", icon: CalendarClock,
    chip: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
    dot: "text-slate-500",
  },
};

const getActivityMeta = (value?: string | null) => {
  if (!value) return ACTIVITY_META.other;
  return (
    ACTIVITY_META[value] ?? {
      label: value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      icon: CalendarClock,
      chip: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
      dot: "text-slate-500",
    }
  );
};

// Colors for the non-schedule event types (meeting / task)
const chipClass = (t: Ev["type"]) =>
  t === "meeting"
    ? "bg-info/15 text-info"
    : t === "task"
    ? "bg-warning/15 text-warning"
    : "bg-primary/15 text-primary";

function EvIcon({ type, className }: { type: Ev["type"]; className?: string }) {
  if (type === "meeting") return <Video className={className} />;
  if (type === "task") return <CheckSquare className={className} />;
  return <CalendarClock className={className} />;
}

function CalendarPage() {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const qc = useQueryClient();
  const perms = usePermissions();
  const [selected, setSelected] = useState<Date | null>(null);
  const [mode, setMode] = useState<"meeting" | "task">("meeting");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [time, setTime] = useState("10:00");

  const openDay = (day: number) => {
    setSelected(new Date(cursor.getFullYear(), cursor.getMonth(), day));
    setMode("meeting"); setTitle(""); setDetails(""); setTime("10:00");
  };

  // -------- Fetch calendar events + meetings + tasks + lead schedules, merge into one list --------
  const { data: events, isLoading } = useQuery({
    queryKey: ["calendar", "meetings", "tasks", "lead-schedules"],
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Ev[]> => {
      const [calendarEvents, meetings, tasks, schedules] = await Promise.all([
        apiFetch<CalendarEvent[]>("/api/v1/calendar"),
        apiFetch<Meeting[]>("/api/v1/meetings"),
        apiFetch<Task[]>("/api/v1/tasks"),
        // A failure here must not break the rest of the calendar
        apiFetch<LeadSchedule[]>("/api/v1/lead-schedules").catch(() => [] as LeadSchedule[]),
      ]);

      const fromCalendar: Ev[] = calendarEvents.map((e) => ({
        id: e.id,
        title: e.title,
        date: e.start_time,
        type: "meeting",
        origin: "calendar",
      }));

      const fromMeetings: Ev[] = meetings.map((m) => ({
        id: m.id,
        title: m.title,
        date: m.scheduled_at,
        type: "meeting",
        origin: "meeting",
      }));

      const fromTasks: Ev[] = tasks
        .filter((t) => !!t.due_date)
        .map((t) => ({
          id: t.id,
          title: t.title,
          date: t.due_date as string,
          type: "task",
          origin: "task",
        }));

      const fromSchedules: Ev[] = (Array.isArray(schedules) ? schedules : [])
        .filter((s) => !!s.scheduled_at)
        .map((s) => ({
          id: s.id,
          title: s.title,
          date: normalizeIso(s.scheduled_at),
          type: "schedule",
          origin: "schedule",
          label: s.display_type || s.activity_label || s.activity_type || null,
          sub: s.lead_name || null,
          done: String(s.status ?? "").toLowerCase() === "completed",
          activityType: s.activity_type || null,
        }));

      return [...fromCalendar, ...fromMeetings, ...fromTasks, ...fromSchedules];
    },
  });

  // -------- Create meeting (via /api/v1/meetings) or task --------
  const addEntry = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      if (!title.trim()) throw new Error("Add a title first");
      const [h, m] = time.split(":").map(Number);
      const start = new Date(selected);
      start.setHours(h || 9, m || 0, 0, 0);

      if (mode === "meeting") {
        return apiFetch<Meeting>("/api/v1/meetings", {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            description: details || null,
            agenda: null,
            scheduled_at: start.toISOString(),
            duration_minutes: 30,
            meeting_type: "video",
            location: null,
            meeting_link: null,
            attendees: [],
            lead_id: null,
            contact_id: null,
            company_id: null,
          }),
        });
      } else {
        return apiFetch<Task>("/api/v1/tasks", {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            description: details || null,
            status: "pending",
            priority: "medium",
            due_date: start.toISOString(),
          }),
        });
      }
    },
    onSuccess: () => {
      toast.success(mode === "meeting" ? "Meeting scheduled" : "Task created");
      qc.invalidateQueries({ queryKey: ["calendar"] });
      setSelected(null);
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  // -------- Remove an entry (routes to the right endpoint by origin) --------
  const removeEntry = useMutation({
    mutationFn: (ev: Ev) => {
      if (ev.origin === "calendar") return apiFetch<void>(`/api/v1/calendar/${ev.id}`, { method: "DELETE" });
      if (ev.origin === "meeting") return apiFetch<void>(`/api/v1/meetings/${ev.id}`, { method: "DELETE" });
      if (ev.origin === "schedule") return apiFetch<void>(`/api/v1/lead-schedules/${ev.id}`, { method: "DELETE" });
      return apiFetch<void>(`/api/v1/tasks/${ev.id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const startOffset = firstDay.getDay();
  const cells = Array.from({ length: startOffset + daysInMonth }, (_, i) => {
    if (i < startOffset) return null;
    return i - startOffset + 1;
  });
  const today = new Date();

  const evsFor = (day: number) =>
    (events ?? [])
      .filter((e) => {
        const d = new Date(e.date);
        return d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth() && d.getDate() === day;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Calendar</h1>
          <p className="text-muted-foreground text-sm mt-1">Meetings, task deadlines and lead schedules at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="font-semibold min-w-40 text-center">{cursor.toLocaleString("en", { month: "long", year: "numeric" })}</span>
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); }}>Today</Button>
        </div>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-4">
          {isLoading ? (
            <div className="flex justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading calendar…
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
                  <div key={d} className="text-xs font-semibold text-center text-muted-foreground py-2">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, i) => {
                  if (day === null) return <div key={i} className="aspect-square" />;
                  const isToday = today.getFullYear() === cursor.getFullYear() && today.getMonth() === cursor.getMonth() && today.getDate() === day;
                  const evs = evsFor(day);
                  return (
                    <button
                      type="button"
                      key={i}
                      onClick={() => openDay(day)}
                      aria-label={`Open ${cursor.toLocaleString("en", { month: "long" })} ${day}`}
                      className={`min-h-24 w-full text-left p-1.5 rounded border ${isToday ? "border-primary bg-primary/5" : "border-border"} hover:bg-muted/40 transition-colors`}
                    >
                      <div className={`text-xs font-medium ${isToday ? "text-primary" : ""}`}>{day}</div>
                      <div className="space-y-0.5 mt-1">
                        {evs.slice(0, 3).map(e => {
                          // Use activity-aware chip for schedules, generic chip for others
                          const isSchedule = e.type === "schedule";
                          const meta = isSchedule ? getActivityMeta(e.activityType) : null;
                          const ActivityIcon = meta?.icon;
                          const chipCls = isSchedule && meta ? meta.chip : chipClass(e.type);
                          return (
                            <div
                              key={`${e.origin}-${e.id}`}
                              className={`text-[10px] px-1 py-0.5 rounded truncate ${chipCls} ${e.done ? "line-through opacity-60" : ""}`}
                              title={`${e.title}${e.label ? ` · ${e.label}` : ""}${e.sub ? ` · ${e.sub}` : ""}`}
                            >
                              {isSchedule && ActivityIcon ? (
                                <ActivityIcon className="inline h-2.5 w-2.5 mr-0.5" />
                              ) : (
                                <EvIcon type={e.type} className="inline h-2.5 w-2.5 mr-0.5" />
                              )}
                              {e.title}
                            </div>
                          );
                        })}
                        {evs.length > 3 && <div className="text-[10px] text-muted-foreground">+{evs.length - 3} more</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <div className="flex gap-3 mt-4 text-xs text-muted-foreground flex-wrap">
            <Badge variant="secondary" className="bg-info/15 text-info border-0"><Video className="h-3 w-3 mr-1" />Meetings</Badge>
            <Badge variant="secondary" className="bg-warning/15 text-warning border-0"><CheckSquare className="h-3 w-3 mr-1" />Tasks</Badge>
            <Badge variant="secondary" className="bg-primary/15 text-primary border-0"><CalendarClock className="h-3 w-3 mr-1" />Lead schedules</Badge>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selected?.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</DialogTitle>
            <DialogDescription>Everything scheduled for this day, and quick actions.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {selected && evsFor(selected.getDate()).length === 0 && (
                <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>
              )}
              {selected && evsFor(selected.getDate()).map((e) => {
                const isSchedule = e.type === "schedule";
                const meta = isSchedule ? getActivityMeta(e.activityType) : null;
                const ActivityIcon = meta?.icon;
                return (
                  <div key={`${e.origin}-${e.id}`} className="flex items-center gap-2 rounded border p-2 text-sm">
                    {isSchedule && ActivityIcon ? (
                      <ActivityIcon className={`h-3.5 w-3.5 shrink-0 ${meta?.dot ?? "text-primary"}`} />
                    ) : (
                      <EvIcon
                        type={e.type}
                        className={`h-3.5 w-3.5 shrink-0 ${e.type === "meeting" ? "text-info" : e.type === "task" ? "text-warning" : "text-primary"}`}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={`truncate ${e.done ? "line-through opacity-60" : ""}`}>{e.title}</div>
                      {(e.label || e.sub) && (
                        <div className="text-xs text-muted-foreground truncate">
                          {[e.label, e.sub].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => removeEntry.mutate(e)}
                      disabled={removeEntry.isPending}
                    >
                      Remove
                    </Button>
                  </div>
                );
              })}
            </div>

            {(perms.canCreate("meetings") || perms.canCreate("tasks")) && (
              <div className="space-y-3 border-t pt-3">
                <div className="flex gap-2">
                  {perms.canCreate("meetings") && (
                    <Button size="sm" variant={mode === "meeting" ? "default" : "outline"} onClick={() => setMode("meeting")}>
                      <Video className="mr-2 h-4 w-4" /> Meeting
                    </Button>
                  )}
                  {perms.canCreate("tasks") && (
                    <Button size="sm" variant={mode === "task" ? "default" : "outline"} onClick={() => setMode("task")}>
                      <CheckSquare className="mr-2 h-4 w-4" /> Task
                    </Button>
                  )}
                </div>
                <div className="space-y-1.5"><Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={mode === "meeting" ? "Demo call with Acme" : "Send pricing sheet"} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Time</Label>
                    <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5"><Label>Details</Label>
                  <Textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            {(perms.canCreate("meetings") || perms.canCreate("tasks")) && (
              <Button onClick={() => addEntry.mutate()} disabled={addEntry.isPending}>
                {addEntry.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Add {mode}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}