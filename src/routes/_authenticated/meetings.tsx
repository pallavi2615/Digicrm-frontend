import { usePermissions } from "@/hooks/use-permissions";
import { notifyPermissionDenied } from "@/components/permission-denied";
import { defineRoute } from "@/lib/router-compat";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-data-client";
import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Plus, Video, Loader2, MapPin, Link as LinkIcon, Trash2, Eye, CalendarClock,
  CalendarCheck, History, Layers, CheckCircle2, XCircle, UserX, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { DateTimePicker } from "@/components/ui/datetime-picker";

const validateDate = (d: string) => {
  if (!d || d.trim() === "") {
    throw new Error("Date is required");
  }

  const date = new Date(d);
  if (isNaN(date.getTime())) {
    throw new Error("Invalid date format");
  }

  const year = date.getFullYear();
  if (year < 1900 || year > 2100) {
    throw new Error(`Year must be between 1900 and 2100 (got: ${year})`);
  }

  return date.toISOString();
};

export const Route = defineRoute("/_authenticated/meetings")({
  head: () => ({ meta: [{ title: "Meetings — DigiCRM AI" }] }),
  component: MeetingsPage,
});

interface Meeting {
  id: number;
  tenant_id: number;
  title: string;
  description: string | null;
  agenda: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  meeting_type: string | null;
  location: string | null;
  meeting_link: string | null;
  attendees: string[];
  notes: string | null;
  outcome: string | null;
  lead_id: number | null;
  contact_id: number | null;
  company_id: number | null;
  created_at: string;
}

const empty = {
  title: "",
  description: "",
  agenda: "",
  scheduled_at: "",
  duration_minutes: 30,
  meeting_type: "video",
  location: "",
  meeting_link: "",
};

type IconType = React.ComponentType<{ className?: string }>;

// ════════════════════════════════════════════════════════════
// STATUS COLORS — same pill language as the Leads page
// scheduled → sky · completed → emerald · cancelled → rose · no_show → amber
// ════════════════════════════════════════════════════════════
const STATUS_PILL: Record<string, string> = {
  scheduled:
    "bg-sky-100 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30",
  completed:
    "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  cancelled:
    "bg-rose-100 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
  no_show:
    "bg-amber-100 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
};

// Solid look for the *selected* status button inside the detail dialog
const STATUS_ACTIVE: Record<string, string> = {
  scheduled: "bg-sky-600 text-white border-sky-600 hover:bg-sky-700 hover:text-white",
  completed: "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 hover:text-white",
  cancelled: "bg-rose-600 text-white border-rose-600 hover:bg-rose-700 hover:text-white",
  no_show: "bg-amber-500 text-white border-amber-500 hover:bg-amber-600 hover:text-white",
};
const STATUS_IDLE: Record<string, string> = {
  scheduled: "border-sky-200 text-sky-700 hover:bg-sky-50 dark:border-sky-500/40 dark:text-sky-300 dark:hover:bg-sky-500/10",
  completed: "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-300 dark:hover:bg-emerald-500/10",
  cancelled: "border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10",
  no_show: "border-amber-200 text-amber-800 hover:bg-amber-50 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-500/10",
};

const STATUS_ICONS: Record<string, IconType> = {
  scheduled: CalendarClock,
  completed: CheckCircle2,
  cancelled: XCircle,
  no_show: UserX,
};

const DATE_BLOCK = [
  "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300",
];

const FIELD =
  "h-9 rounded-lg border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100";
const AREA = "rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-900/70";
const FIELD_LABEL = "text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";

function StatusPill({ status }: { status: string }) {
  const Icon = STATUS_ICONS[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
        STATUS_PILL[status] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {status.replace("_", " ")}
    </span>
  );
}

function MeetingsPage() {
  const perms = usePermissions();
  const canCreate = perms.canCreate("meetings");
  const canEdit = perms.canEdit("meetings");
  const canDelete = perms.canDelete("meetings");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [detail, setDetail] = useState<Meeting | null>(null);

  const { data: meetings, isLoading } = useQuery({
    queryKey: ["meetings"],
    queryFn: () => apiFetch<Meeting[]>("/api/v1/meetings"),
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title || !form.scheduled_at) throw new Error("Title and scheduled time required");

      const scheduledAt = validateDate(form.scheduled_at);

      return apiFetch<Meeting>("/api/v1/meetings", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          agenda: form.agenda || null,
          scheduled_at: scheduledAt,
          duration_minutes: form.duration_minutes || 30,
          meeting_type: form.meeting_type || "video",
          location: form.location || null,
          meeting_link: form.meeting_link || null,
          attendees: [],
          lead_id: null,
          contact_id: null,
          company_id: null,
        }),
      });
    },
    onSuccess: () => {
      toast.success("Meeting scheduled");
      qc.invalidateQueries({ queryKey: ["meetings"] });
      setOpen(false);
      setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/api/v1/meetings/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Cancelled");
      qc.invalidateQueries({ queryKey: ["meetings"] });
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch<Meeting>(`/api/v1/meetings/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      toast.success("Meeting updated");
      qc.invalidateQueries({ queryKey: ["meetings"] });
      setDetail(null);
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const now = new Date();
  const upcoming = (meetings ?? []).filter(m => new Date(m.scheduled_at) >= now);
  const past = (meetings ?? []).filter(m => new Date(m.scheduled_at) < now);

  const endTime = (m: Meeting) => new Date(new Date(m.scheduled_at).getTime() + (m.duration_minutes || 0) * 60 * 1000);

  const renderCard = (m: Meeting) => {
    const start = new Date(m.scheduled_at);
    const end = endTime(m);
    return (
      <div
        key={m.id}
        className="flex flex-col gap-3 rounded-xl border border-slate-200/70 bg-white p-3 transition-colors hover:bg-blue-50/40 sm:flex-row sm:items-center sm:justify-between sm:p-4 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:bg-slate-800/40"
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {/* Date block */}
          <div
            className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl leading-none ${DATE_BLOCK[m.id % DATE_BLOCK.length]}`}
          >
            <span className="text-lg font-bold">{start.getDate()}</span>
            <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide">
              {start.toLocaleDateString("en-IN", { month: "short" })}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-semibold text-slate-800 dark:text-white">{m.title}</h4>
              <StatusPill status={m.status} />
            </div>
            {m.description && (
              <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{m.description}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {start.toLocaleString()} — {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              {m.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />{m.location}
                </span>
              )}
              {m.meeting_link && (
                <a
                  href={m.meeting_link}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
                >
                  <LinkIcon className="h-3 w-3" />Join
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:justify-end">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 dark:hover:bg-blue-500/30"
            title="View details"
            onClick={() => setDetail(m)}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25"
              title="Cancel meeting"
              onClick={() => del.mutate(m.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ───────── Header ───────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex h-11 w-11 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm dark:border dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
            <Video className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Meetings</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Schedule and manage your sales meetings.</p>
          </div>
        </div>
        {canCreate && (
          <Button
            className="h-9 rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700"
            onClick={() => { setForm(empty); setOpen(true); }}
          >
            <Plus className="mr-2 h-4 w-4" /> Schedule
          </Button>
        )}
      </div>

      {/* ───────── Stat cards ───────── */}
      {!isLoading && (meetings?.length ?? 0) > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Total" value={meetings?.length ?? 0} icon={Layers} tone="blue" />
          <StatCard label="Upcoming" value={upcoming.length} icon={CalendarCheck} tone="violet" />
          <StatCard label="Past" value={past.length} icon={History} tone="orange" />
        </div>
      )}

      {isLoading && <div className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>}
      {!isLoading && meetings?.length === 0 && (
        <Card className="rounded-2xl border-slate-200/70 shadow-sm dark:border-slate-800 dark:bg-[#0b1226]">
          <CardContent className="text-center py-16">
            <Video className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No meetings scheduled.</p>
          </CardContent>
        </Card>
      )}

      {upcoming.length > 0 && (
        <Card className="rounded-2xl border-slate-200/70 shadow-sm dark:border-slate-800 dark:bg-[#0b1226]">
          <CardContent className="p-3 sm:p-4">
            <SectionTitle icon={CalendarCheck} tone="violet" count={upcoming.length}>Upcoming</SectionTitle>
            <div className="space-y-2.5">{upcoming.map(renderCard)}</div>
          </CardContent>
        </Card>
      )}
      {past.length > 0 && (
        <Card className="rounded-2xl border-slate-200/70 shadow-sm dark:border-slate-800 dark:bg-[#0b1226]">
          <CardContent className="p-3 sm:p-4">
            <SectionTitle icon={History} tone="orange" count={past.length}>Past</SectionTitle>
            <div className="space-y-2.5 opacity-70">{past.slice(0, 10).map(renderCard)}</div>
          </CardContent>
        </Card>
      )}

      {/* ───────── Detail dialog ───────── */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto rounded-2xl border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle>{detail?.title}</DialogTitle>
            <DialogDescription asChild>
              <div>{detail && <StatusPill status={detail.status} />}</div>
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-slate-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-slate-200">
                <CalendarClock className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
                <span>
                  {new Date(detail.scheduled_at).toLocaleString()} — {endTime(detail).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              {detail.agenda && (
                <div>
                  <p className={`mb-1 ${FIELD_LABEL}`}>Agenda</p>
                  <p>{detail.agenda}</p>
                </div>
              )}
              {detail.description && (
                <div>
                  <p className={`mb-1 ${FIELD_LABEL}`}>Description</p>
                  <p>{detail.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="min-w-0 rounded-xl border border-violet-100 bg-violet-50 p-3 dark:border-violet-500/30 dark:bg-violet-500/10">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Location</p>
                  <p className="mt-1 truncate font-semibold text-slate-900 dark:text-white">{detail.location || "—"}</p>
                </div>
                <div className="min-w-0 rounded-xl border border-emerald-100 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Join link</p>
                  {detail.meeting_link
                    ? <a className="mt-1 block truncate font-semibold text-emerald-700 hover:underline dark:text-emerald-300" href={detail.meeting_link} target="_blank" rel="noreferrer">Open</a>
                    : <p className="mt-1 font-semibold text-slate-900 dark:text-white">—</p>}
                </div>
              </div>
              {detail.notes && (
                <div>
                  <p className={`mb-1 ${FIELD_LABEL}`}>Notes</p>
                  <p>{detail.notes}</p>
                </div>
              )}
              {detail.outcome && (
                <div>
                  <p className={`mb-1 ${FIELD_LABEL}`}>Outcome</p>
                  <p>{detail.outcome}</p>
                </div>
              )}
              {canEdit && (
                <div>
                  <p className={`mb-2 ${FIELD_LABEL}`}>Update status</p>
                  <div className="flex gap-2 flex-wrap">
                    {["scheduled", "completed", "cancelled", "no_show"].map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant="outline"
                        disabled={setStatus.isPending}
                        onClick={() => setStatus.mutate({ id: detail.id, status: s })}
                        className={`rounded-full capitalize ${
                          detail.status === s ? STATUS_ACTIVE[s] : STATUS_IDLE[s]
                        }`}
                      >
                        {s.replace("_", " ")}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="rounded-lg" onClick={() => setDetail(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───────── Schedule dialog ───────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300">
                <Video className="h-4 w-4" />
              </span>
              Schedule meeting
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label className={FIELD_LABEL}>Title *</Label><Input className={FIELD} value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} /></div>
            <div className="space-y-1.5"><Label className={FIELD_LABEL}>Description</Label><Textarea className={AREA} rows={2} value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} /></div>
            <div className="space-y-1.5"><Label className={FIELD_LABEL}>Agenda</Label><Textarea className={AREA} rows={2} value={form.agenda} onChange={(e) => setForm({...form, agenda: e.target.value})} /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className={FIELD_LABEL}>Scheduled at</Label>
                <DateTimePicker
                  value={form.scheduled_at}
                  onChange={(val) => setForm({ ...form, scheduled_at: val })}
                  placeholder="Select date & time"
                />
              </div>
              <div className="space-y-1.5">
                <Label className={FIELD_LABEL}>Duration (minutes)</Label>
                <Input
                  className={FIELD}
                  type="number"
                  min={5}
                  step={5}
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) || 30 })}
                />
              </div>
            </div>
            <div className="space-y-1.5"><Label className={FIELD_LABEL}>Location</Label><Input className={FIELD} value={form.location} onChange={(e) => setForm({...form, location: e.target.value})} /></div>
            <div className="space-y-1.5"><Label className={FIELD_LABEL}>Meeting URL</Label><Input className={FIELD} placeholder="https://meet.google.com/..." value={form.meeting_link} onChange={(e) => setForm({...form, meeting_link: e.target.value})} /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-lg" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ HELPERS (same visual language as the Leads page) ============
const statTones: Record<string, { card: string; icon: string }> = {
  blue: {
    card: "from-blue-50 to-white border-blue-100 dark:from-blue-950 dark:to-slate-950 dark:border-blue-500/40",
    icon: "bg-blue-100 text-blue-600 dark:bg-blue-500/25 dark:text-blue-300",
  },
  violet: {
    card: "from-violet-50 to-white border-violet-100 dark:from-violet-950 dark:to-slate-950 dark:border-violet-500/40",
    icon: "bg-violet-500 text-white",
  },
  orange: {
    card: "from-orange-50 to-white border-orange-100 dark:from-orange-950 dark:to-slate-950 dark:border-orange-500/40",
    icon: "bg-orange-100 text-orange-600 dark:bg-orange-500/30 dark:text-orange-300",
  },
};

function StatCard({
  label, value, icon: Icon, tone,
}: {
  label: string;
  value: number;
  icon: IconType;
  tone: keyof typeof statTones;
}) {
  const t = statTones[tone];
  return (
    <div className={`flex items-center gap-3 sm:gap-4 rounded-2xl border bg-linear-to-br p-3 sm:p-4 shadow-sm ${t.card}`}>
      <div className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full ${t.icon}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">{label}</div>
        <div className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">{value}</div>
      </div>
    </div>
  );
}

const sectionTones: Record<string, string> = {
  violet: "bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300",
  orange: "bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300",
};

function SectionTitle({
  icon: Icon, tone, count, children,
}: {
  icon: IconType;
  tone: keyof typeof sectionTones;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${sectionTones[tone]}`}>
        <Icon className="h-4 w-4" />
      </span>
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">{children}</h3>
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {count}
      </span>
    </div>
  );
}