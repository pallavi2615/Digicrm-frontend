import { useMutation, useQuery, useQueryClient } from "@/lib/react-data-client";
import { apiFetch } from "@/lib/api";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, Mail, Phone, Building2, MapPin, Briefcase, CalendarClock,
  FileText, CheckCircle2, Clock, User, Paperclip, IndianRupee,
  TrendingUp, Plus, Activity, Pencil, Trophy, XCircle,
  Sparkles, PhoneCall, BadgeCheck, ArrowUp, ArrowDown, Minus, Flame,
  MessageSquare, Users, Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  DETAIL_DIALOG, PILL_TABS_LIST, PILL_TAB, BTN_PILL, BTN_PRIMARY,
  DetailAvatar, StatTile, InfoTile,
} from "@/components/detail-ui";

interface Props {
  leadId: number | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEdit?: (profile: any) => void;
  onSchedule?: (profile: any) => void;   // hook into parent's existing schedule dialog
}

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  contacted: "bg-yellow-100 text-yellow-700 dark:bg-orange-500/15 dark:text-orange-300",
  qualified: "bg-purple-100 text-purple-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  proposal_sent: "bg-indigo-100 text-indigo-700 dark:bg-violet-500/20 dark:text-violet-300",
  won: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  lost: "bg-red-100 text-red-700 dark:bg-slate-500/20 dark:text-slate-300",
};

const priorityColors: Record<string, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-sky-500/15 dark:text-sky-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  high: "bg-orange-100 text-orange-700 dark:bg-red-500/15 dark:text-red-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-600/25 dark:text-red-200",
};

const scheduleStatusColors: Record<string, string> = {
  pending: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  cancelled: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
  missed: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

type IconType = React.ComponentType<{ className?: string }>;

const statusIcons: Record<string, IconType> = {
  new: Sparkles, contacted: PhoneCall, qualified: BadgeCheck,
  proposal_sent: FileText, won: Trophy, lost: XCircle,
};

const priorityIcons: Record<string, IconType> = {
  low: ArrowDown, medium: Minus, high: ArrowUp, urgent: Flame,
};

const ACTIVITY_META: Record<string, { label: string; icon: IconType; color: string }> = {
  call:       { label: "Call",       icon: PhoneCall,    color: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  email:      { label: "Mail",       icon: Mail,         color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" },
  meeting:    { label: "Meeting",    icon: User,         color: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300" },
  proposal:   { label: "Proposal",   icon: FileText,     color: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  demo:       { label: "Demo",       icon: Activity,     color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300" },
  follow_up:  { label: "Follow-up",  icon: CalendarClock,color: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300" },
  followup:   { label: "Follow-up",  icon: CalendarClock,color: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300" },
  whatsapp:   { label: "WhatsApp",   icon: MessageSquare,color: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300" },
  site_visit: { label: "Site Visit", icon: MapPin,       color: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" },
  contract:   { label: "Contract",   icon: FileText,     color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  reminder:   { label: "Reminder",   icon: CalendarClock,color: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300" },
  other:      { label: "Other",      icon: CalendarClock,color: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300" },
};

const getActivityMeta = (value: string) =>
  ACTIVITY_META[value] ?? {
    label: value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    icon: CalendarClock,
    color: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
  };

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
});

export function Lead360Dialog({ leadId, open, onOpenChange, onEdit, onSchedule }: Props) {
  const qc = useQueryClient();

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
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed"),
  });

  const p = data?.profile;
  const s = data?.stats;

  const StatusIcon = p ? statusIcons[p.status] : undefined;
  const PriorityIcon = p ? priorityIcons[p.priority] : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DETAIL_DIALOG}>
        {/* ================= HEADER ================= */}
        <DialogHeader className="px-6 pt-5 pb-3 space-y-0">
          {isLoading || !p ? (
            <div className="flex items-center gap-3 py-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <DialogTitle className="text-sm font-normal text-muted-foreground">
                Loading 360° view...
              </DialogTitle>
              <DialogDescription className="sr-only">Loading lead details</DialogDescription>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 pr-8">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <DetailAvatar />
                  <div className="min-w-0">
                    <DialogTitle className="text-2xl font-bold truncate">
                      {p.name || p.email || `Lead #${p.id}`}
                    </DialogTitle>
                    <DialogDescription className="truncate flex items-center gap-2 mt-0.5 text-sm">
                      {p.designation && <span>{p.designation}</span>}
                      {p.designation && p.company_name && <span>•</span>}
                      {p.company_name && <span>{p.company_name}</span>}
                      {!p.designation && !p.company_name && "Lead details"}
                    </DialogDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <Badge className={`${statusColors[p.status] || "bg-gray-100 text-gray-700"} gap-1.5 rounded-full border-0 px-3 py-1 capitalize`}>
                    {StatusIcon && <StatusIcon className="h-3.5 w-3.5" />}
                    {p.status?.replace("_", " ")}
                  </Badge>
                  <Badge className={`${priorityColors[p.priority] || "bg-gray-100 text-gray-700"} gap-1.5 rounded-full border-0 px-3 py-1 capitalize`}>
                    {PriorityIcon && <PriorityIcon className="h-3.5 w-3.5" />}
                    {p.priority}
                  </Badge>
                </div>
              </div>

              {s && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                  <StatTile
                    icon={IndianRupee}
                    label="Value"
                    value={p.estimated_value > 0 ? currency.format(p.estimated_value) : "—"}
                    tone="blue"
                  />
                  <StatTile
                    icon={CalendarClock}
                    label="Schedules"
                    value={`${s.completed_schedules}/${s.total_schedules} done`}
                    tone="green"
                  />
                  <StatTile
                    icon={FileText}
                    label="Proposals"
                    value={String(s.total_proposals)}
                    tone="purple"
                  />
                  <StatTile
                    icon={TrendingUp}
                    label="Score"
                    value={String(p.score ?? 0)}
                    tone="orange"
                  />
                </div>
              )}

              {s?.next_schedule && (
                <div className="flex items-center gap-2 mt-3 text-xs rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 w-fit max-w-full">
                  <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span className="text-muted-foreground">Next:</span>
                  <span className="font-medium truncate">{s.next_schedule.title}</span>
                  <span className="text-muted-foreground shrink-0">
                    · {new Date(s.next_schedule.scheduled_at).toLocaleString("en-IN", {
                      day: "2-digit", month: "short",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
            </>
          )}
        </DialogHeader>

        {/* ================= BODY ================= */}
        {error && (
          <div className="px-6 py-6 text-red-500 text-sm">
            Failed to load: {String(error)}
          </div>
        )}

        {p && (
          <div className="flex-1 overflow-y-auto px-6 pb-4 pt-1">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className={PILL_TABS_LIST}>
                <TabsTrigger value="overview" className={PILL_TAB}>
                  <User className="h-4 w-4" /> Overview
                </TabsTrigger>
                <TabsTrigger value="schedules" className={PILL_TAB}>
                  <CalendarClock className="h-4 w-4" /> Schedules
                  {data.schedules.upcoming.length > 0 && (
                    <Badge className="h-5 px-1.5 text-[10px] rounded-full bg-blue-500/15 text-blue-500 border-0">
                      {data.schedules.upcoming.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="timeline" className={PILL_TAB}>
                  <Clock className="h-4 w-4" /> Timeline
                </TabsTrigger>
                <TabsTrigger value="activity" className={PILL_TAB}>
                  <Zap className="h-4 w-4" /> Activity
                </TabsTrigger>
              </TabsList>

              {/* ---------- Overview ---------- */}
              <TabsContent value="overview" className="mt-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <InfoTile icon={Mail} label="Email" value={p.email} tone="blue" copyable />
                  <InfoTile icon={Phone} label="Phone" value={p.phone} tone="purple" copyable />
                  <InfoTile icon={Building2} label="Company" value={p.company_name} tone="purple" />
                  <InfoTile icon={Briefcase} label="Designation" value={p.designation} tone="blue" />
                  <InfoTile icon={Activity} label="Industry" value={p.industry} tone="green" />
                  <InfoTile
                    icon={MapPin}
                    label="Location"
                    value={[p.city, p.country].filter(Boolean).join(", ")}
                    tone="red"
                  />
                  <InfoTile icon={Users} label="Source" value={p.source} tone="pink" />
                  <InfoTile
                    icon={User}
                    label="Assigned To"
                    value={p.assigned_to_name || (p.assigned_to ? `User #${p.assigned_to}` : "—")}
                    tone="purple"
                  />
                  <InfoTile
                    icon={CalendarClock}
                    label="Created"
                    value={new Date(p.created_at).toLocaleDateString("en-IN", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                    tone="green"
                  />
                </div>

                {p.message && (
                  <div>
                    <div className="text-[11px] text-muted-foreground uppercase tracking-[0.12em] font-medium mb-2">
                      Message
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-card/80 p-3 text-sm whitespace-pre-wrap shadow-sm">
                      {p.message}
                    </div>
                  </div>
                )}

                {data.company && (
                  <div>
                    <div className="text-[11px] text-muted-foreground uppercase tracking-[0.12em] font-medium mb-2">
                      Company
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-card/80 p-3 text-sm shadow-sm flex items-center gap-3">
                      <div className="h-11 w-11 rounded-full bg-violet-500/15 text-violet-500 flex items-center justify-center shrink-0">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium">{data.company.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {[data.company.industry, data.company.location].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ---------- Schedules ---------- */}
              <TabsContent value="schedules" className="mt-3 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Upcoming</h4>
                  {onSchedule && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => onSchedule(p)}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Schedule
                    </Button>
                  )}
                </div>

                {data.schedules.upcoming.length === 0 ? (
                  <EmptyNote text="No upcoming schedules." />
                ) : (
                  <ul className="space-y-2.5">
                    {data.schedules.upcoming.map((sc: any) => (
                      <ScheduleItem
                        key={sc.id}
                        schedule={sc}
                        onComplete={() => completeSchedule.mutate(sc.id)}
                        isCompleting={completeSchedule.isPending}
                      />
                    ))}
                  </ul>
                )}

                {data.schedules.past.length > 0 && (
                  <>
                    <h4 className="text-sm font-semibold pt-2">Past</h4>
                    <ul className="space-y-2.5 opacity-80">
                      {data.schedules.past.slice(0, 10).map((sc: any) => (
                        <ScheduleItem key={sc.id} schedule={sc} />
                      ))}
                    </ul>
                  </>
                )}
              </TabsContent>

              {/* ---------- Timeline ---------- */}
              <TabsContent value="timeline" className="mt-3">
                {data.timeline.length === 0 ? (
                  <EmptyNote text="No activity yet." />
                ) : (
                  <ol className="relative border-l-2 border-blue-500/20 ml-3 space-y-5">
                    {data.timeline.map((t: any, i: number) => (
                      <li key={i} className="ml-6 relative">
                        <span className="absolute -left-8.25 top-1 h-4 w-4 rounded-full bg-linear-to-br from-blue-500 to-indigo-500 ring-4 ring-background" />
                        <div className="rounded-2xl border border-border/60 bg-card/80 p-3.5 shadow-sm">
                          <div className="text-xs text-muted-foreground">
                            {new Date(t.at).toLocaleString("en-IN", {
                              day: "2-digit", month: "short", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </div>
                          <div className="text-sm font-medium mt-0.5">{t.title}</div>
                          {t.description && (
                            <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </TabsContent>

              {/* ---------- Activity ---------- */}
              <TabsContent value="activity" className="mt-3 space-y-6">
                <div>
                  <h4 className="text-sm font-semibold mb-3">
                    Proposals ({data.proposals.length})
                  </h4>
                  {data.proposals.length === 0 ? (
                    <EmptyNote text="No proposals." />
                  ) : (
                    <ul className="space-y-2.5">
                      {data.proposals.map((pr: any) => (
                        <li
                          key={pr.id}
                          className="rounded-2xl border border-border/60 bg-card/80 p-3.5 text-sm shadow-sm flex items-center gap-3"
                        >
                          <div className="h-10 w-10 rounded-full bg-violet-500/15 text-violet-500 flex items-center justify-center shrink-0">
                            <FileText className="h-4 w-4" />
                          </div>
                          <span className="font-medium truncate">{pr.title}</span>
                          <Badge variant="outline" className="text-xs capitalize rounded-full">
                            {pr.status}
                          </Badge>
                          <span className="ml-auto text-sm font-semibold">
                            {currency.format(pr.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-3">
                    Follow-up Tasks ({data.tasks.length})
                  </h4>
                  {data.tasks.length === 0 ? (
                    <EmptyNote text="No tasks." />
                  ) : (
                    <ul className="space-y-2.5">
                      {data.tasks.map((t: any) => (
                        <li
                          key={t.id}
                          className="rounded-2xl border border-border/60 bg-card/80 p-3.5 text-sm shadow-sm flex items-center gap-3"
                        >
                          <div className="h-10 w-10 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                          <span className="truncate">{t.title}</span>
                          <Badge variant="outline" className="text-xs ml-auto rounded-full capitalize">
                            {t.status}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* ================= FOOTER ================= */}
        {p && (
          <DialogFooter className="px-6 py-3 border-t border-border/60 bg-background/60 backdrop-blur flex items-center justify-end sm:justify-end">
            <div className="flex gap-2">
              {onSchedule && (
                <Button variant="outline" className={`${BTN_PILL} text-blue-600 dark:text-blue-300`} onClick={() => onSchedule(p)}>
                  <CalendarClock className="mr-2 h-4 w-4" /> Schedule
                </Button>
              )}
              {onEdit && (
                <Button className={BTN_PRIMARY} onClick={() => { onOpenChange(false); onEdit(p); }}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
              )}
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Sub-components ─── */

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-card/50 py-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function ScheduleItem({
  schedule,
  onComplete,
  isCompleting,
}: {
  schedule: any;
  onComplete?: () => void;
  isCompleting?: boolean;
}) {
  const meta = getActivityMeta(schedule.activity_type);
  const Icon = meta.icon;
  const cls = meta.color;
  const dt = new Date(schedule.scheduled_at);

  return (
    <li className="rounded-2xl border border-border/60 bg-card/80 p-4 flex gap-3 shadow-sm">
      <div className={`rounded-full h-10 w-10 flex items-center justify-center ${cls} self-start shrink-0`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{schedule.title}</span>
          <Badge className={`${cls} border-0 rounded-full`}>{meta.label}</Badge>
          <Badge className={`${scheduleStatusColors[schedule.status]} border-0 capitalize rounded-full`}>
            {schedule.status}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {dt.toLocaleString("en-IN", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}
          {" · "}{schedule.duration_minutes} min
        </div>
        {schedule.notes && (
          <p className="text-sm mt-1.5 whitespace-pre-wrap text-muted-foreground">
            {schedule.notes}
          </p>
        )}
        {schedule.attachment_url && (
          <a
            href={schedule.attachment_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary mt-1.5 hover:underline"
          >
            <Paperclip className="h-3 w-3" /> {schedule.attachment_name || "Attachment"}
          </a>
        )}
      </div>
      {onComplete && schedule.status === "pending" && (
        <Button
          size="sm"
          variant="outline"
          onClick={onComplete}
          disabled={isCompleting}
          className="self-start rounded-full border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
        >
          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Done
        </Button>
      )}
    </li>
  );
}