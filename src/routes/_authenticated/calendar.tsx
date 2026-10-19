import { defineRoute } from "@/lib/router-compat";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-data-client";
import { apiFetch } from "@/lib/api";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronLeft, ChevronRight, Video, CheckSquare, Plus, Loader2, CalendarDays,
  Trash2, X, Clock, CalendarCheck,
} from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { notifyPermissionDenied } from "@/components/permission-denied";
import { DETAIL_DIALOG, BTN_PILL, BTN_PRIMARY, DETAIL_INPUT } from "@/components/detail-ui";

// Tasks & Meetings calendar.
// (Lead schedules live on their own page: schedule-calendar.tsx)
export const Route = defineRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Tasks & Meetings Calendar — DigiCRM AI" }] }),
  component: TaskMeetingCalendarPage,
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

// Unified shape the calendar grid renders, regardless of source endpoint.
interface Ev {
  id: number;
  title: string;
  date: string;
  type: "meeting" | "task";
  origin: "calendar" | "meeting" | "task";
}

type IconType = React.ComponentType<{ className?: string }>;

const TYPE_META: Record<Ev["type"], { label: string; icon: IconType; chip: string; soft: string; solid: string }> = {
  meeting: {
    label: "Meeting", icon: Video,
    chip: "bg-blue-100 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:ring-blue-500/30",
    soft: "bg-blue-100 text-blue-600 dark:bg-blue-500/25 dark:text-blue-300",
    solid: "bg-blue-500 text-white",
  },
  task: {
    label: "Task", icon: CheckSquare,
    chip: "bg-amber-100 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:ring-amber-500/30",
    soft: "bg-amber-100 text-amber-600 dark:bg-amber-500/25 dark:text-amber-300",
    solid: "bg-amber-500 text-white",
  },
};

/* ---------- design tokens (shared look with Leads / Pipeline) ---------- */

const PANEL = "rounded-2xl border border-slate-200/70 bg-card shadow-sm dark:border-slate-800";

const statTones = {
  blue: {
    card: "from-blue-50 to-white border-blue-100 dark:from-blue-950 dark:to-slate-950 dark:border-blue-500/40",
    icon: "bg-blue-100 text-blue-600 dark:bg-blue-500/25 dark:text-blue-300",
  },
  amber: {
    card: "from-amber-50 to-white border-amber-100 dark:from-amber-950 dark:to-slate-950 dark:border-amber-500/40",
    icon: "bg-amber-100 text-amber-600 dark:bg-amber-500/30 dark:text-amber-300",
  },
  green: {
    card: "from-green-50 to-white border-green-100 dark:from-emerald-950 dark:to-slate-950 dark:border-emerald-500/40",
    icon: "bg-emerald-500 text-white",
  },
  violet: {
    card: "from-violet-50 to-white border-violet-100 dark:from-violet-950 dark:to-slate-950 dark:border-violet-500/40",
    icon: "bg-violet-500 text-white",
  },
} as const;

function StatCard({
  label, value, icon: Icon, tone,
}: { label: string; value: number; icon: IconType; tone: keyof typeof statTones }) {
  const t = statTones[tone];
  return (
    <div className={`flex items-center gap-4 rounded-2xl border bg-linear-to-br p-4 shadow-sm ${t.card}`}>
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${t.icon}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">{label}</div>
        <div className="text-2xl font-bold text-slate-800 dark:text-white">{value}</div>
      </div>
    </div>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function TaskMeetingCalendarPage() {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const qc = useQueryClient();
  const perms = usePermissions();
  const [selected, setSelected] = useState<Date | null>(null);
  const [mode, setMode] = useState<"meeting" | "task">("meeting");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [time, setTime] = useState("10:00");

  const canMeeting = perms.canCreate("meetings");
  const canTask = perms.canCreate("tasks");

  const openDay = (day: number) => {
    setSelected(new Date(cursor.getFullYear(), cursor.getMonth(), day));
    setMode(canMeeting ? "meeting" : "task");
    setTitle(""); setDetails(""); setTime("10:00");
  };

  // -------- Fetch calendar events + meetings + tasks, merge into one list --------
  const { data: events, isLoading } = useQuery({
    queryKey: ["calendar", "meetings", "tasks"],
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Ev[]> => {
      const [calendarEvents, meetings, tasks] = await Promise.all([
        apiFetch<CalendarEvent[]>("/api/v1/calendar"),
        apiFetch<Meeting[]>("/api/v1/meetings"),
        apiFetch<Task[]>("/api/v1/tasks"),
      ]);

      const fromCalendar: Ev[] = calendarEvents.map((e) => ({
        id: e.id, title: e.title, date: e.start_time, type: "meeting", origin: "calendar",
      }));

      const fromMeetings: Ev[] = meetings.map((m) => ({
        id: m.id, title: m.title, date: m.scheduled_at, type: "meeting", origin: "meeting",
      }));

      const fromTasks: Ev[] = tasks
        .filter((t) => !!t.due_date)
        .map((t) => ({
          id: t.id, title: t.title, date: t.due_date as string, type: "task", origin: "task",
        }));

      return [...fromCalendar, ...fromMeetings, ...fromTasks];
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
      }
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
  const cells = Array.from({ length: startOffset + daysInMonth }, (_, i) =>
    i < startOffset ? null : i - startOffset + 1,
  );
  const today = new Date();

  const evsFor = (day: number) =>
    (events ?? [])
      .filter((e) => {
        const d = new Date(e.date);
        return d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth() && d.getDate() === day;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const stats = useMemo(() => {
    const inMonth = (events ?? []).filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth();
    });
    return {
      meetings: inMonth.filter((e) => e.type === "meeting").length,
      tasks: inMonth.filter((e) => e.type === "task").length,
      today: (events ?? []).filter((e) => sameDay(new Date(e.date), new Date())).length,
      total: inMonth.length,
    };
  }, [events, cursor]);

  const monthLabel = cursor.toLocaleString("en", { month: "long", year: "numeric" });
  const selectedEvs = selected ? evsFor(selected.getDate()) : [];
  const canAdd = canMeeting || canTask;

  return (
    <div className="space-y-6">
      {/* ================= HEADER ================= */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm dark:border dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
            <CalendarDays className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Calendar</h1>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Tasks &amp; Meetings
              </span>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">Meetings and task deadlines at a glance.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="icon"
            className="h-10 w-10 rounded-xl border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/60"
            aria-label="Previous month"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-44 rounded-xl border border-slate-200 bg-white px-4 py-2 text-center text-sm font-semibold shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
            {monthLabel}
          </span>
          <Button
            variant="outline" size="icon"
            className="h-10 w-10 rounded-xl border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/60"
            aria-label="Next month"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            className="h-10 rounded-xl bg-blue-600 px-4 text-white shadow-sm hover:bg-blue-700"
            onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); }}
          >
            Today
          </Button>
        </div>
      </div>

      {/* ================= STATS ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Meetings" value={stats.meetings} icon={Video} tone="blue" />
        <StatCard label="Tasks due" value={stats.tasks} icon={CheckSquare} tone="amber" />
        <StatCard label="Today" value={stats.today} icon={Clock} tone="green" />
        <StatCard label="This month" value={stats.total} icon={CalendarCheck} tone="violet" />
      </div>

      {/* ================= MONTH GRID ================= */}
      <Card className={PANEL}>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="flex justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading calendar…
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1.5 mb-2">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="text-xs font-semibold uppercase tracking-wide text-center text-slate-500 dark:text-slate-400 py-2">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {cells.map((day, i) => {
                  if (day === null) return <div key={i} className="min-h-28" />;
                  const date = new Date(cursor.getFullYear(), cursor.getMonth(), day);
                  const isToday = sameDay(date, today);
                  const evs = evsFor(day);
                  return (
                    <button
                      type="button"
                      key={i}
                      onClick={() => openDay(day)}
                      aria-label={`Open ${cursor.toLocaleString("en", { month: "long" })} ${day}`}
                      className={`min-h-28 w-full rounded-xl border p-2 text-left transition-all hover:-translate-y-0.5 hover:border-blue-500/60 hover:shadow-md ${
                        isToday
                          ? "border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/20 dark:bg-blue-500/10"
                          : "border-slate-200/70 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-900/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold ${
                            isToday ? "bg-blue-600 text-white" : "text-slate-700 dark:text-slate-200"
                          }`}
                        >
                          {day}
                        </span>
                        {evs.length > 0 && (
                          <span className="text-[10px] font-medium text-muted-foreground">{evs.length}</span>
                        )}
                      </div>
                      <div className="mt-1.5 space-y-1">
                        {evs.slice(0, 3).map((e) => {
                          const meta = TYPE_META[e.type];
                          const Icon = meta.icon;
                          return (
                            <div
                              key={`${e.origin}-${e.id}`}
                              className={`flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium ${meta.chip}`}
                              title={`${e.title} · ${meta.label}`}
                            >
                              <Icon className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">{e.title}</span>
                            </div>
                          );
                        })}
                        {evs.length > 3 && <div className="text-[10px] text-muted-foreground pl-1">+{evs.length - 3} more</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="flex gap-2 mt-4 flex-wrap">
            {(Object.keys(TYPE_META) as Ev["type"][]).map((k) => {
              const m = TYPE_META[k]; const Icon = m.icon;
              return (
                <span key={k} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${m.chip}`}>
                  <Icon className="h-3 w-3" />{m.label}s
                </span>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ================= DAY DIALOG ================= */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className={`${DETAIL_DIALOG} sm:max-w-lg`}>
          <DialogHeader className="px-8 pt-7 pb-4 space-y-0">
            <div className="flex items-center gap-4 pr-8">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-2xl font-bold truncate">
                  {selected?.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {selectedEvs.length} {selectedEvs.length === 1 ? "item" : "items"} scheduled
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-8 pb-4 pt-2 space-y-4">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {selected && selectedEvs.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border/70 bg-card/50 py-8 text-center text-sm text-muted-foreground">
                  Nothing scheduled yet.
                </div>
              )}
              {selectedEvs.map((e) => {
                const meta = TYPE_META[e.type];
                const Icon = meta.icon;
                return (
                  <div key={`${e.origin}-${e.id}`} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/80 p-3 text-sm shadow-sm">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${meta.soft}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{e.title}</div>
                      <div className="text-xs text-muted-foreground">{meta.label}</div>
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {new Date(e.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-500"
                      title="Remove"
                      aria-label="Remove"
                      onClick={() => removeEntry.mutate(e)}
                      disabled={removeEntry.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>

            {canAdd && (
              <div className="space-y-3 border-t border-border/60 pt-4">
                <div className="flex gap-2">
                  {canMeeting && (
                    <Button
                      size="sm"
                      variant="outline"
                      className={`rounded-full px-4 ${mode === "meeting" ? "border-0 bg-blue-600 text-white hover:bg-blue-700 hover:text-white" : ""}`}
                      onClick={() => setMode("meeting")}
                    >
                      <Video className="mr-2 h-4 w-4" /> Meeting
                    </Button>
                  )}
                  {canTask && (
                    <Button
                      size="sm"
                      variant="outline"
                      className={`rounded-full px-4 ${mode === "task" ? "border-0 bg-amber-500 text-white hover:bg-amber-600 hover:text-white" : ""}`}
                      onClick={() => setMode("task")}
                    >
                      <CheckSquare className="mr-2 h-4 w-4" /> Task
                    </Button>
                  )}
                </div>
                <div className="space-y-1.5"><Label>Title</Label>
                  <Input className={DETAIL_INPUT} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={mode === "meeting" ? "Demo call with Acme" : "Send pricing sheet"} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Time</Label>
                    <Input className={DETAIL_INPUT} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5"><Label>Details</Label>
                  <Textarea className="rounded-xl" rows={2} value={details} onChange={(e) => setDetails(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="px-8 py-4 border-t border-border/60 bg-background/60 backdrop-blur flex items-center justify-between sm:justify-between">
            <Button variant="outline" className={BTN_PILL} onClick={() => setSelected(null)}>
              <X className="mr-2 h-4 w-4" /> Close
            </Button>
            {canAdd && (
              <Button className={BTN_PRIMARY} onClick={() => addEntry.mutate()} disabled={addEntry.isPending}>
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