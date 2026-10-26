import { defineRoute } from "@/lib/router-compat";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-data-client";
import { apiFetch } from "@/lib/api";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft, ChevronRight, CalendarClock, Loader2, PhoneCall, Mail, User,
  FileText, Activity, MessageSquare, MapPin, CalendarDays, Trash2, X,
  CheckCircle2, Clock, ListChecks, Building2,
} from "lucide-react";
import { toast } from "sonner";
import { notifyPermissionDenied } from "@/components/permission-denied";
import { DETAIL_DIALOG, BTN_PILL } from "@/components/detail-ui";


export const Route = defineRoute("/_authenticated/schedule-calendar")({
  head: () => ({ meta: [{ title: "Schedule Calendar — DigiCRM AI" }] }),
  component: ScheduleCalendarPage,
});

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

interface Sch {
  id: number;
  title: string;
  date: string;
  label: string | null;
  lead: string | null;
  company: string | null;
  done: boolean;
  status: string;
  duration: number | null;
  notes: string | null;
  activityType: string | null;
}

// The API can return datetimes without a timezone (naive UTC). Treat those as UTC
// so a schedule entered as 3:30 PM IST doesn't shift by 5h30m on the calendar.
function normalizeIso(s: string): string {
  if (!s || !s.includes("T")) return s;
  return /([zZ]|[+-]\d{2}:?\d{2})$/.test(s) ? s : `${s}Z`;
}

type IconType = React.ComponentType<{ className?: string }>;

// ════════════════════════════════════════════════════════════
// Activity-type metadata — icons + colours
// ════════════════════════════════════════════════════════════
const ACTIVITY_META: Record<string, { label: string; icon: IconType; chip: string; soft: string }> = {
  call: {
    label: "Call", icon: PhoneCall,
    chip: "bg-blue-100 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:ring-blue-500/30",
    soft: "bg-blue-100 text-blue-600 dark:bg-blue-500/25 dark:text-blue-300",
  },
  email: {
    label: "Mail", icon: Mail,
    chip: "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:ring-indigo-500/30",
    soft: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/25 dark:text-indigo-300",
  },
  meeting: {
    label: "Meeting", icon: User,
    chip: "bg-purple-100 text-purple-700 ring-1 ring-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:ring-purple-500/30",
    soft: "bg-purple-100 text-purple-600 dark:bg-purple-500/25 dark:text-purple-300",
  },
  proposal: {
    label: "Proposal", icon: FileText,
    chip: "bg-amber-100 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:ring-amber-500/30",
    soft: "bg-amber-100 text-amber-600 dark:bg-amber-500/25 dark:text-amber-300",
  },
  demo: {
    label: "Demo", icon: Activity,
    chip: "bg-cyan-100 text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:ring-cyan-500/30",
    soft: "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/25 dark:text-cyan-300",
  },
  follow_up: {
    label: "Follow-up", icon: CalendarClock,
    chip: "bg-teal-100 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-500/20 dark:text-teal-300 dark:ring-teal-500/30",
    soft: "bg-teal-100 text-teal-600 dark:bg-teal-500/25 dark:text-teal-300",
  },
  followup: {
    label: "Follow-up", icon: CalendarClock,
    chip: "bg-teal-100 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-500/20 dark:text-teal-300 dark:ring-teal-500/30",
    soft: "bg-teal-100 text-teal-600 dark:bg-teal-500/25 dark:text-teal-300",
  },
  whatsapp: {
    label: "WhatsApp", icon: MessageSquare,
    chip: "bg-green-100 text-green-700 ring-1 ring-green-200 dark:bg-green-500/20 dark:text-green-300 dark:ring-green-500/30",
    soft: "bg-green-100 text-green-600 dark:bg-green-500/25 dark:text-green-300",
  },
  site_visit: {
    label: "Site Visit", icon: MapPin,
    chip: "bg-orange-100 text-orange-700 ring-1 ring-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:ring-orange-500/30",
    soft: "bg-orange-100 text-orange-600 dark:bg-orange-500/25 dark:text-orange-300",
  },
  contract: {
    label: "Contract", icon: FileText,
    chip: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-500/30",
    soft: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-300",
  },
  reminder: {
    label: "Reminder", icon: CalendarClock,
    chip: "bg-pink-100 text-pink-700 ring-1 ring-pink-200 dark:bg-pink-500/20 dark:text-pink-300 dark:ring-pink-500/30",
    soft: "bg-pink-100 text-pink-600 dark:bg-pink-500/25 dark:text-pink-300",
  },
  other: {
    label: "Other", icon: CalendarClock,
    chip: "bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:ring-slate-500/30",
    soft: "bg-slate-100 text-slate-600 dark:bg-slate-500/25 dark:text-slate-300",
  },
};

const getActivityMeta = (value?: string | null) => {
  if (!value) return ACTIVITY_META.other;
  return (
    ACTIVITY_META[value] ?? {
      label: value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      icon: CalendarClock,
      chip: ACTIVITY_META.other.chip,
      soft: ACTIVITY_META.other.soft,
    }
  );
};

/* ---------- design tokens (shared look with Leads / Pipeline) ---------- */

const PANEL = "rounded-2xl border border-slate-200/70 bg-card shadow-sm dark:border-slate-800";

const statTones = {
  blue: {
    card: "from-blue-50 to-white border-blue-100 dark:from-blue-950 dark:to-slate-950 dark:border-blue-500/40",
    icon: "bg-blue-100 text-blue-600 dark:bg-blue-500/25 dark:text-blue-300",
  },
  orange: {
    card: "from-orange-50 to-white border-orange-100 dark:from-orange-950 dark:to-slate-950 dark:border-orange-500/40",
    icon: "bg-orange-100 text-orange-600 dark:bg-orange-500/30 dark:text-orange-300",
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

function ScheduleCalendarPage() {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Date | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");

  // -------- Fetch lead schedules --------
  const { data: schedules, isLoading } = useQuery({
    queryKey: ["calendar", "lead-schedules"],
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Sch[]> => {
      const rows = await apiFetch<LeadSchedule[]>("/api/v1/lead-schedules");
      return (Array.isArray(rows) ? rows : [])
        .filter((s) => !!s.scheduled_at)
        .map((s) => {
          const status = String(s.status ?? "pending").toLowerCase();
          return {
            id: s.id,
            title: s.title,
            date: normalizeIso(s.scheduled_at),
            label: s.display_type || s.activity_label || s.activity_type || null,
            lead: s.lead_name || null,
            company: s.lead_company || null,
            done: status === "completed",
            status,
            duration: s.duration_minutes ?? null,
            notes: s.notes ?? null,
            activityType: s.activity_type || null,
          };
        });
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["calendar"] });
    qc.invalidateQueries({ queryKey: ["lead-schedules"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
  };

  const completeEntry = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/v1/lead-schedules/${id}/complete`, { method: "POST" }),
    onSuccess: () => { toast.success("Marked complete"); refresh(); },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const removeEntry = useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/api/v1/lead-schedules/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Removed"); refresh(); },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const filtered = useMemo(
    () => (schedules ?? []).filter((s) => typeFilter === "all" || (s.activityType ?? "other") === typeFilter),
    [schedules, typeFilter],
  );

  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const startOffset = firstDay.getDay();
  const cells = Array.from({ length: startOffset + daysInMonth }, (_, i) =>
    i < startOffset ? null : i - startOffset + 1,
  );
  const today = new Date();

  const evsFor = (day: number) =>
    filtered
      .filter((e) => {
        const d = new Date(e.date);
        return d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth() && d.getDate() === day;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const stats = useMemo(() => {
    const inMonth = filtered.filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth();
    });
    return {
      total: inMonth.length,
      pending: inMonth.filter((e) => !e.done).length,
      done: inMonth.filter((e) => e.done).length,
      today: filtered.filter((e) => sameDay(new Date(e.date), new Date())).length,
    };
  }, [filtered, cursor]);

  // activity types that actually appear in the data → filter options
  const typeOptions = useMemo(() => {
    const seen = new Set<string>();
    (schedules ?? []).forEach((s) => seen.add(s.activityType ?? "other"));
    return [...seen].sort();
  }, [schedules]);

  const openDay = (day: number) => setSelected(new Date(cursor.getFullYear(), cursor.getMonth(), day));
  const monthLabel = cursor.toLocaleString("en", { month: "long", year: "numeric" });
  const selectedEvs = selected ? evsFor(selected.getDate()) : [];

  return (
    <div className="space-y-6">
      {/* ================= HEADER ================= */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm dark:border dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
            <CalendarClock className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Schedule Calendar</h1>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Lead schedules
              </span>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              Calls, demos, follow-ups and every activity scheduled with your leads.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-10 w-44 rounded-xl border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
              <SelectValue placeholder="All activities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All activities</SelectItem>
              {typeOptions.map((t) => (
                <SelectItem key={t} value={t}>{getActivityMeta(t).label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

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
        <StatCard label="This month" value={stats.total} icon={ListChecks} tone="blue" />
        <StatCard label="Pending" value={stats.pending} icon={Clock} tone="orange" />
        <StatCard label="Completed" value={stats.done} icon={CheckCircle2} tone="green" />
        <StatCard label="Today" value={stats.today} icon={CalendarDays} tone="violet" />
      </div>

      {/* ================= MONTH GRID ================= */}
      <Card className={PANEL}>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="flex justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading schedules…
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
                          const meta = getActivityMeta(e.activityType);
                          const Icon = meta.icon;
                          return (
                            <div
                              key={e.id}
                              className={`flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium ${meta.chip} ${e.done ? "line-through opacity-60" : ""}`}
                              title={`${e.title}${e.label ? ` · ${e.label}` : ""}${e.lead ? ` · ${e.lead}` : ""}`}
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

          {/* legend: only the activity types that exist */}
          <div className="flex gap-2 mt-4 flex-wrap">
            {typeOptions.length === 0 && !isLoading && (
              <span className="text-xs text-muted-foreground">No lead schedules yet — schedule one from the Leads page.</span>
            )}
            {typeOptions.map((t) => {
              const m = getActivityMeta(t); const Icon = m.icon;
              return (
                <span key={t} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${m.chip}`}>
                  <Icon className="h-3 w-3" />{m.label}
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
                <CalendarClock className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-2xl font-bold truncate">
                  {selected?.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {selectedEvs.length} {selectedEvs.length === 1 ? "schedule" : "schedules"} on this day
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-8 pb-6 pt-2 space-y-2.5">
            {selected && selectedEvs.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border/70 bg-card/50 py-10 text-center text-sm text-muted-foreground">
                Nothing scheduled for this day.
              </div>
            )}
            {selectedEvs.map((e) => {
              const meta = getActivityMeta(e.activityType);
              const Icon = meta.icon;
              return (
                <div key={e.id} className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/80 p-3.5 text-sm shadow-sm">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${meta.soft}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium ${e.done ? "line-through opacity-60" : ""}`}>{e.title}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.chip}`}>
                        {e.label ? getActivityMeta(e.activityType).label : meta.label}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                          e.done
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                        }`}
                      >
                        {e.status}
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-x-3 gap-y-0.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(e.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {e.duration ? ` · ${e.duration} min` : ""}
                      </span>
                      {e.lead && <span className="flex items-center gap-1"><User className="h-3 w-3" />{e.lead}</span>}
                      {e.company && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{e.company}</span>}
                    </div>

                    {e.notes && <p className="mt-1.5 text-xs text-muted-foreground whitespace-pre-wrap">{e.notes}</p>}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {!e.done && (
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 hover:text-emerald-600"
                        title="Mark complete"
                        aria-label="Mark complete"
                        onClick={() => completeEntry.mutate(e.id)}
                        disabled={completeEntry.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-500"
                      title="Remove"
                      aria-label="Remove"
                      onClick={() => removeEntry.mutate(e.id)}
                      disabled={removeEntry.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="px-8 py-4 border-t border-border/60 bg-background/60 backdrop-blur flex items-center justify-between sm:justify-between">
            <Button variant="outline" className={BTN_PILL} onClick={() => setSelected(null)}>
              <X className="mr-2 h-4 w-4" /> Close
            </Button>
            <span className="text-xs text-muted-foreground">New schedules are created from the Leads page.</span>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}