import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-data-client";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Mail, Phone, Building2, MapPin, Briefcase, CalendarClock,
  FileText, CheckCircle2, Clock, User, Paperclip, IndianRupee,
  TrendingUp, Plus, Activity, Pencil, Trophy, XCircle, X, Copy,
  Sparkles, PhoneCall, BadgeCheck, ArrowUp, ArrowDown, Minus, Flame,
  MessageSquare, Users, Zap, LayoutGrid, StickyNote, History, Flag, CircleDot,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  leadId: number | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEdit?: (profile: any) => void;
  onSchedule?: (profile: any) => void;
}

type IconType = React.ComponentType<{ className?: string }>;
type TabId = "overview" | "schedules" | "timeline" | "activity";

const TABS: {
  id: TabId; label: string; icon: IconType;
  text: string; bar: string; soft: string; chip: string; border: string; dot: string;
}[] = [
    {
      id: "overview", label: "Overview", icon: LayoutGrid,
      text: "text-blue-600 dark:text-blue-300", bar: "bg-blue-600",
      soft: "bg-blue-50 dark:bg-blue-500/10",
      chip: "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300",
      border: "border-blue-100 dark:border-blue-500/25", dot: "bg-blue-500",
    },
    {
      id: "schedules", label: "Schedules", icon: CalendarClock,
      text: "text-violet-600 dark:text-violet-300", bar: "bg-violet-600",
      soft: "bg-violet-50 dark:bg-violet-500/10",
      chip: "bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300",
      border: "border-violet-100 dark:border-violet-500/25", dot: "bg-violet-500",
    },
    {
      id: "timeline", label: "Timeline", icon: History,
      text: "text-emerald-600 dark:text-emerald-300", bar: "bg-emerald-600",
      soft: "bg-emerald-50 dark:bg-emerald-500/10",
      chip: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300",
      border: "border-emerald-100 dark:border-emerald-500/25", dot: "bg-emerald-500",
    },
    {
      id: "activity", label: "Activity", icon: Zap,
      text: "text-amber-600 dark:text-amber-300", bar: "bg-amber-500",
      soft: "bg-amber-50 dark:bg-amber-500/10",
      chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
      border: "border-amber-100 dark:border-amber-500/25", dot: "bg-amber-500",
    },
  ];
type Tone = (typeof TABS)[number];

const statusColors: Record<string, string> = {
  new: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  contacted: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  qualified: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300",
  proposal_sent: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
  won: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  lost: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

const priorityColors: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  medium: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  high: "bg-orange-500 text-white dark:bg-orange-500/90",
  urgent: "bg-red-600 text-white dark:bg-red-600",
};

const scheduleStatusColors: Record<string, string> = {
  pending: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  cancelled: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
  missed: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

const statusIcons: Record<string, IconType> = {
  new: Sparkles, contacted: PhoneCall, qualified: BadgeCheck,
  proposal_sent: FileText, won: Trophy, lost: XCircle,
};

const priorityIcons: Record<string, IconType> = {
  low: ArrowDown, medium: Minus, high: ArrowUp, urgent: Flame,
};

const ACTIVITY_META: Record<string, { label: string; icon: IconType; color: string }> = {
  call: { label: "Call", icon: PhoneCall, color: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  email: { label: "Mail", icon: Mail, color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" },
  meeting: { label: "Meeting", icon: User, color: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300" },
  proposal: { label: "Proposal", icon: FileText, color: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  demo: { label: "Demo", icon: Activity, color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300" },
  follow_up: { label: "Follow-up", icon: CalendarClock, color: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300" },
  followup: { label: "Follow-up", icon: CalendarClock, color: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300" },
  whatsapp: { label: "WhatsApp", icon: MessageSquare, color: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300" },
  site_visit: { label: "Site Visit", icon: MapPin, color: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" },
  contract: { label: "Contract", icon: FileText, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  reminder: { label: "Reminder", icon: CalendarClock, color: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300" },
  other: { label: "Other", icon: CalendarClock, color: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300" },
};

const getActivityMeta = (value: string) =>
  ACTIVITY_META[value] ?? {
    label: (value || "other").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    icon: CalendarClock,
    color: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
  };

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
});

const fmtDateTime = (d?: string | null) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

const initials = (name?: string | null) => {
  const parts = (name || "?").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
};

/* ═════════════════════════ MAIN ═════════════════════════ */
export function Lead360Dialog({ leadId, open, onOpenChange, onEdit, onSchedule }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>("overview");

  useEffect(() => { if (open) setTab("overview"); }, [open, leadId]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onOpenChange(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onOpenChange]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["lead-360", leadId],
    queryFn: () => apiFetch<any>(`/api/v1/leads/${leadId}/360`),
    enabled: !!leadId && open,
  });

  const completeSchedule = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/v1/lead-schedules/${id}/complete`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Marked complete");
      qc.invalidateQueries({ queryKey: ["lead-360", leadId] });
      qc.invalidateQueries({ queryKey: ["lead-schedules"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
  });

  const p = data?.profile;
  const s = data?.stats;
  const upcoming: any[] = data?.schedules?.upcoming ?? [];
  const past: any[] = data?.schedules?.past ?? [];
  const timeline: any[] = data?.timeline ?? [];
  const proposals: any[] = data?.proposals ?? [];
  const tasks: any[] = data?.tasks ?? [];

  const StatusIcon = p ? statusIcons[p.status] : undefined;
  const PriorityIcon = p ? priorityIcons[p.priority] : undefined;

  const overviewTone = TABS[0];
  const schedulesTone = TABS[1];
  const timelineTone = TABS[2];
  const activityTone = TABS[3];

  const copy = (v?: string | null) => {
    if (!v) return;
    navigator.clipboard?.writeText(v).then(() => toast.success("Copied"));
  };

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={() => onOpenChange(false)}
        className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity duration-300 lg:bg-slate-900/10 ${open ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
      />

      {/* Right-side panel — wider on larger screens, only body scrolls */}
      <aside
        role="dialog"
        aria-label="Lead 360 view"
        aria-hidden={!open}
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-slate-200 bg-slate-50 shadow-2xl transition-[transform,visibility] duration-300 sm:w-120 md:w-135 lg:w-150 2xl:w-160 dark:border-slate-800 dark:bg-[#0b1226] ${open ? "visible translate-x-0" : "invisible translate-x-full"
          }`}
      >
        {/* ================= HEADER ================= */}
        <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900/70">
          {isLoading || !p ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading 360° view...
              </div>
              <CloseBtn onClick={() => onOpenChange(false)} />
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-indigo-500 text-sm font-semibold text-white">
                {initials(p.name || p.email)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-bold text-slate-900 dark:text-white">
                    {p.name || p.email || `Lead #${p.id}`}
                  </h2>
                  <Badge className={`${statusColors[p.status] || "bg-gray-100 text-gray-700"} gap-1 rounded-full border-0 px-2.5 py-0.5 text-xs capitalize`}>
                    {StatusIcon && <StatusIcon className="h-3 w-3" />}
                    {p.status?.replace("_", " ")}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {[p.designation, p.company_name].filter(Boolean).join(" • ") || "Lead details"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Lead ID: LD-{p.id} <span className="mx-1">|</span> Created: {fmtDateTime(p.created_at)}
                </p>
              </div>
              <CloseBtn onClick={() => onOpenChange(false)} />
            </div>
          )}
        </div>

        {/* ================= BODY ================= */}
        <div className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10">
              Failed to load: {String(error)}
            </div>
          )}

          {p && (
            <>
              {/* Summary tiles */}
              {s && (
                <div className="grid grid-cols-3 gap-2">
                  <Tile
                    icon={IndianRupee} label="Value"
                    value={p.estimated_value > 0 ? currency.format(p.estimated_value) : "—"}
                    cls="border-blue-100 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10"
                  />
                  <Tile
                    icon={FileText} label="Proposals" value={String(s.total_proposals ?? 0)}
                    cls="border-violet-100 bg-violet-50 dark:border-violet-500/30 dark:bg-violet-500/10"
                  />
                  <Tile
                    icon={TrendingUp} label="Score" value={String(p.score ?? 0)}
                    cls="border-orange-100 bg-orange-50 dark:border-orange-500/30 dark:bg-orange-500/10"
                  />
                </div>
              )}

              {s?.next_schedule && (
                <div className="flex w-full max-w-full items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span className="text-muted-foreground">Next:</span>
                  <span className="truncate font-medium">{s.next_schedule.title}</span>
                  <span className="shrink-0 text-muted-foreground">
                    · {new Date(s.next_schedule.scheduled_at).toLocaleString("en-IN", {
                      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
              )}


              {/* Tabs — fit within min width, no horizontal scroll */}
              <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900/60">
                {TABS.map((t) => {
                  const active = t.id === tab;
                  const TabIcon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={`relative flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-[10px] font-semibold transition-colors sm:text-[11px] ${active
                        ? `${t.soft} ${t.text}`
                        : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                        }`}
                    >
                      <TabIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{t.label}</span>
                      {t.id === "schedules" && upcoming.length > 0 && (
                        <span className={`shrink-0 rounded-full px-1 text-[9px] ${t.chip}`}>{upcoming.length}</span>
                      )}
                      {active && <span className={`absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full ${t.bar}`} />}
                    </button>
                  );
                })}
              </div>

              {/* ---------- Overview ---------- */}
              {tab === "overview" && (
                <>
                  <Section
                    title="Lead Information" icon={User} tone={overviewTone}
                    action={onEdit && (
                      <Button
                        variant="outline" size="sm"
                        className="h-7 rounded-lg border-blue-200 px-2 text-xs text-blue-600 dark:border-blue-500/40 dark:text-blue-300"
                        onClick={() => { onOpenChange(false); onEdit(p); }}
                      >
                        <Pencil className="mr-1 h-3 w-3" /> Edit
                      </Button>
                    )}
                  >
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      <Row icon={User} label="Name">{p.name || "—"}</Row>
                      <Row icon={Mail} label="Email"><CopyValue value={p.email} onCopy={copy} /></Row>
                      <Row icon={Phone} label="Phone"><CopyValue value={p.phone} onCopy={copy} /></Row>
                      <Row icon={Building2} label="Company">{p.company_name || "—"}</Row>
                      <Row icon={Briefcase} label="Designation">{p.designation || "—"}</Row>
                      <Row icon={Activity} label="Industry">{p.industry || "—"}</Row>
                      <Row icon={MapPin} label="Location">
                        {[p.city, p.country].filter(Boolean).join(", ") || "—"}
                      </Row>
                      <Row icon={Users} label="Source"><span className="capitalize">{p.source || "—"}</span></Row>
                      <Row icon={User} label="Assigned To">
                        {p.assigned_to ? (
                          <span className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500 text-[10px] font-semibold text-white">
                              {initials(p.assigned_to_name)}
                            </span>
                            {p.assigned_to_name || `User #${p.assigned_to}`}
                          </span>
                        ) : "—"}
                      </Row>
                      <Row icon={Flag} label="Priority">
                        <Badge className={`${priorityColors[p.priority] || "bg-gray-100 text-gray-700"} gap-1 rounded-full border-0 px-2.5 py-0.5 text-xs capitalize`}>
                          {PriorityIcon && <PriorityIcon className="h-3 w-3" />}
                          {p.priority}
                        </Badge>
                      </Row>
                      <Row icon={CircleDot} label="Status">
                        <Badge className={`${statusColors[p.status] || "bg-gray-100 text-gray-700"} gap-1 rounded-full border-0 px-2.5 py-0.5 text-xs capitalize`}>
                          {StatusIcon && <StatusIcon className="h-3 w-3" />}
                          {p.status?.replace("_", " ")}
                        </Badge>
                      </Row>
                      <Row icon={CalendarClock} label="Created">{fmtDateTime(p.created_at)}</Row>
                    </div>
                  </Section>

                  <Section title="Notes" icon={StickyNote} tone={overviewTone}>
                    {p.message ? (
                      <p className="whitespace-pre-wrap wrap-break-word text-sm text-slate-700 dark:text-slate-200">{p.message}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">No notes yet.</p>
                    )}
                  </Section>

                  {data.company && (
                    <Section title="Company" icon={Building2} tone={overviewTone}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-500">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{data.company.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {[data.company.industry, data.company.location].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                      </div>
                    </Section>
                  )}

                  <Section
                    title="Recent Activities" icon={Activity} tone={overviewTone}
                    action={
                      <button
                        type="button"
                        className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-300"
                        onClick={() => setTab("timeline")}
                      >
                        View All
                      </button>
                    }
                  >
                    {timeline.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No activity yet.</p>
                    ) : (
                      <TimelineList items={timeline.slice(0, 3)} tone={overviewTone} />
                    )}
                  </Section>
                </>
              )}

              {/* ---------- Schedules ---------- */}
              {tab === "schedules" && (
                <>
                  <Section
                    title={`Upcoming (${upcoming.length})`} icon={CalendarClock} tone={schedulesTone}
                    action={onSchedule && (
                      <Button
                        size="sm"
                        className="h-7 rounded-lg bg-violet-600 px-2 text-xs text-white hover:bg-violet-700"
                        onClick={() => onSchedule(p)}
                      >
                        <Plus className="mr-1 h-3 w-3" /> Schedule
                      </Button>
                    )}
                  >
                    {upcoming.length === 0 ? (
                      <EmptyNote text="No upcoming schedules." tone={schedulesTone} />
                    ) : (
                      <ul className="space-y-2.5">
                        {upcoming.map((sc: any) => (
                          <ScheduleItem
                            key={sc.id}
                            schedule={sc}
                            tone={schedulesTone}
                            onComplete={() => completeSchedule.mutate(sc.id)}
                            isCompleting={completeSchedule.isPending}
                          />
                        ))}
                      </ul>
                    )}
                  </Section>

                  {past.length > 0 && (
                    <Section title={`Past (${past.length})`} icon={Clock} tone={schedulesTone}>
                      <ul className="space-y-2.5 opacity-80">
                        {past.slice(0, 10).map((sc: any) => (
                          <ScheduleItem key={sc.id} schedule={sc} tone={schedulesTone} />
                        ))}
                      </ul>
                    </Section>
                  )}
                </>
              )}

              {/* ---------- Timeline ---------- */}
              {tab === "timeline" && (
                <Section title="Lead Timeline" icon={History} tone={timelineTone}>
                  {timeline.length === 0 ? (
                    <EmptyNote text="No activity yet." tone={timelineTone} />
                  ) : (
                    <TimelineList items={timeline} tone={timelineTone} />
                  )}
                </Section>
              )}

              {/* ---------- Activity ---------- */}
              {tab === "activity" && (
                <>
                  <Section title={`Proposals (${proposals.length})`} icon={FileText} tone={activityTone}>
                    {proposals.length === 0 ? (
                      <EmptyNote text="No proposals." tone={activityTone} />
                    ) : (
                      <ul className="space-y-2.5">
                        {proposals.map((pr: any) => (
                          <li
                            key={pr.id}
                            className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm ${activityTone.border} ${activityTone.soft}`}
                          >
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${activityTone.chip}`}>
                              <FileText className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1 truncate font-medium">{pr.title}</span>
                            <Badge variant="outline" className="rounded-full text-xs capitalize">{pr.status}</Badge>
                            <span className="text-sm font-semibold">{currency.format(pr.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>

                  <Section title={`Follow-up Tasks (${tasks.length})`} icon={CheckCircle2} tone={activityTone}>
                    {tasks.length === 0 ? (
                      <EmptyNote text="No tasks." tone={activityTone} />
                    ) : (
                      <ul className="space-y-2.5">
                        {tasks.map((t: any) => (
                          <li
                            key={t.id}
                            className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${activityTone.border} ${activityTone.soft}`}
                          >
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${activityTone.chip}`}>
                              <CheckCircle2 className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1 truncate">{t.title}</span>
                            <Badge variant="outline" className="rounded-full text-xs capitalize">{t.status}</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>
                </>
              )}
            </>
          )}
        </div>

        {/* ================= FIXED FOOTER ================= */}
        {p && (
          <div className="flex shrink-0 gap-2 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
            {onSchedule && (
              <Button
                variant="outline"
                className="h-10 min-w-0 flex-1 rounded-lg border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-800 dark:border-violet-500/40 dark:text-violet-300 dark:hover:bg-violet-500/10"
                onClick={() => onSchedule(p)}
              >
                <CalendarClock className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">Schedule</span>
              </Button>
            )}
            {onEdit && (
              <Button
                className="h-10 min-w-0 flex-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => { onOpenChange(false); onEdit(p); }}
              >
                <Pencil className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">Edit</span>
              </Button>
            )}
          </div>
        )}
      </aside>
    </>
  );
}

/* ═════════════════════════ Sub-components ═════════════════════════ */

function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost" size="icon" aria-label="Close 360 view"
      className="h-8 w-8 shrink-0 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      onClick={onClick}
    >
      <X className="h-4 w-4" />
    </Button>
  );
}

function Tile({ icon: Icon, label, value, cls }: { icon: IconType; label: string; value: string; cls: string }) {
  return (
    <div className={`rounded-xl border p-3 ${cls}`}>
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Icon className="h-3 w-3 shrink-0" /> <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 wrap-break-word text-sm font-bold text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}

function Section({
  title, icon: Icon, tone, action, children,
}: {
  title: string; icon: IconType; tone: Tone; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900/60 ${tone.border}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tone.chip}`}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}

function Row({ icon: Icon, label, children }: { icon: IconType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5 text-sm">
      <span className="flex w-24 shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:w-28">
        <Icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{label}</span>
      </span>
      <span className="min-w-0 flex-1 wrap-break-word font-medium text-slate-800 dark:text-slate-100">
        {children}
      </span>
    </div>
  );
}

function CopyValue({ value, onCopy }: { value?: string | null; onCopy: (v?: string | null) => void }) {
  if (!value) return <>—</>;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="min-w-0 truncate">{value}</span>
      <button
        type="button" title="Copy" aria-label="Copy"
        className="shrink-0 text-slate-400 hover:text-blue-600"
        onClick={() => onCopy(value)}
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

function EmptyNote({ text, tone }: { text: string; tone: Tone }) {
  return (
    <div className={`rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground ${tone.border} ${tone.soft}`}>
      {text}
    </div>
  );
}

function TimelineList({ items, tone }: { items: any[]; tone: Tone }) {
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5 dark:border-slate-700">
      {items.map((t: any, i: number) => (
        <li key={i} className="relative">
          <span
            className={`absolute -left-6.5 top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white dark:ring-slate-900 ${tone.dot}`}
          />
          <div className="text-xs text-muted-foreground">{fmtDateTime(t.at)}</div>
          <div className="wrap-break-word text-sm font-medium text-slate-800 dark:text-slate-100">{t.title}</div>
          {t.description && (
            <div className="mt-0.5 wrap-break-word text-xs text-muted-foreground">{t.description}</div>
          )}
        </li>
      ))}
    </ol>
  );
}

function ScheduleItem({
  schedule,
  tone,
  onComplete,
  isCompleting,
}: {
  schedule: any;
  tone: Tone;
  onComplete?: () => void;
  isCompleting?: boolean;
}) {
  const meta = getActivityMeta(schedule.activity_type);
  const Icon = meta.icon;
  const cls = meta.color;

  return (
    <li className={`flex flex-wrap gap-3 rounded-xl border p-3 ${tone.border} ${tone.soft}`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-full ${cls}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="wrap-break-word text-sm font-medium">{schedule.title}</span>
          <Badge className={`${cls} rounded-full border-0 text-[11px]`}>{meta.label}</Badge>
          <Badge
            className={`${scheduleStatusColors[schedule.status] || "bg-gray-100 text-gray-700"} rounded-full border-0 text-[11px] capitalize`}
          >
            {schedule.status}
          </Badge>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {fmtDateTime(schedule.scheduled_at)}
          {schedule.duration_minutes ? ` · ${schedule.duration_minutes} min` : ""}
        </div>
        {schedule.notes && (
          <p className="mt-1.5 whitespace-pre-wrap wrap-break-word text-sm text-muted-foreground">{schedule.notes}</p>
        )}
        {schedule.attachment_url && (
          <a
            href={schedule.attachment_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-flex max-w-full items-center gap-1 text-xs text-primary hover:underline"
          >
            <Paperclip className="h-3 w-3 shrink-0" />
            <span className="truncate">{schedule.attachment_name || "Attachment"}</span>
          </a>
        )}
      </div>
      {onComplete && schedule.status === "pending" && (
        <Button
          size="sm"
          variant="outline"
          onClick={onComplete}
          disabled={isCompleting}
          className="h-8 shrink-0 self-start rounded-full border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
        >
          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Done
        </Button>
      )}
    </li>
  );
}