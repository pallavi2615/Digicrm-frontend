import { defineRoute, Link, useNavigate } from "@/lib/router-compat";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-data-client";
import { apiFetch } from "@/lib/api";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Ticket as TicketIcon, Plus, Search, AlertTriangle, Loader2, Clock,
  CircleDot, CheckCircle2, Layers, ArrowUp, ArrowDown, Minus, Flame, Mail,
} from "lucide-react";
import { toast } from "sonner";

export const Route = defineRoute("/_authenticated/tickets")({
  head: () => ({ meta: [{ title: "Tickets — DigiCRM AI" }, { name: "robots", content: "noindex" }] }),
  component: TicketsPage,
});

type Ticket = {
  id: number;
  tenant_id: number;
  subject: string;
  description: string | null;
  ticket_number: string;
  requester_name: string | null;
  requester_email: string;
  requester_phone: string | null;
  requester_id: number | null;
  status: string;
  priority: string;
  urgency: string;
  category: string | null;
  assigned_to: number | null;
  created_by: number | null;
  sla_due_at: string | null;
  sla_breached: boolean;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  tags: string[];
  custom_fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type TicketStats = {
  all: number;
  open: number;
  pending: number;
  resolved: number;
  closed: number;
  sla_breached: number;
};

type IconType = React.ComponentType<{ className?: string }>;

// ════════════════════════════════════════════════════════════
// Same pill language as the Leads page
// status   → open sky · pending amber · resolved emerald · closed slate
// priority → low slate · medium teal · high orange · urgent red
// urgency  → soft tones, so it never looks like priority
// ════════════════════════════════════════════════════════════
const STATUS_COLORS: Record<string, string> = {
  open:
    "bg-sky-100 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30",
  pending:
    "bg-amber-100 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  resolved:
    "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  closed:
    "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/30",
};
const PRIORITY_COLORS: Record<string, string> = {
  low:
    "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/30",
  medium:
    "bg-teal-100 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:ring-teal-500/30",
  high:
    "bg-orange-500 text-white ring-1 ring-orange-600 dark:bg-orange-500/90 dark:text-white dark:ring-orange-400/40",
  urgent:
    "bg-red-600 text-white ring-1 ring-red-700 dark:bg-red-600 dark:text-white dark:ring-red-400/40",
};
const URGENCY_COLORS: Record<string, string> = {
  low: "bg-slate-50 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300",
  medium: "bg-sky-50 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300",
  high: "bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  critical: "bg-rose-100 text-rose-700 font-semibold dark:bg-rose-500/25 dark:text-rose-200",
};

const STATUS_ICONS: Record<string, IconType> = {
  open: CircleDot,
  pending: Clock,
  resolved: CheckCircle2,
  closed: Layers,
};
const PRIORITY_ICONS: Record<string, IconType> = {
  low: ArrowDown,
  medium: Minus,
  high: ArrowUp,
  urgent: Flame,
};

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-600 dark:text-white",
  "bg-pink-100 text-pink-700 dark:bg-pink-600 dark:text-white",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-600 dark:text-white",
  "bg-orange-100 text-orange-700 dark:bg-orange-600 dark:text-white",
  "bg-violet-100 text-violet-700 dark:bg-violet-600 dark:text-white",
  "bg-teal-100 text-teal-700 dark:bg-teal-600 dark:text-white",
  "bg-rose-100 text-rose-700 dark:bg-rose-600 dark:text-white",
  "bg-amber-100 text-amber-700 dark:bg-amber-600 dark:text-white",
];

function getInitials(name: string | null | undefined, fallback?: string | null): string {
  const src = (name || fallback || "?").trim();
  const parts = src.split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const PILL_BASE = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize";
const FIELD =
  "h-9 rounded-lg border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100";
const FIELD_LABEL = "text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";

function TicketsPage() {
  const [status, setStatus] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [urgency, setUrgency] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const navigate = useNavigate();

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["tickets"],
    queryFn: () => apiFetch<Ticket[]>("/api/v1/tickets"),
    // Keep SLA countdowns roughly fresh without a realtime subscription.
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery({
    queryKey: ["tickets", "stats"],
    queryFn: () => apiFetch<TicketStats>("/api/v1/tickets/stats"),
    refetchInterval: 30000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (status !== "all" && t.status !== status) return false;
      if (priority !== "all" && t.priority !== priority) return false;
      if (urgency !== "all" && t.urgency !== urgency) return false;
      if (!q) return true;
      return (
        t.subject.toLowerCase().includes(q) ||
        t.requester_email.toLowerCase().includes(q) ||
        t.ticket_number.toLowerCase().includes(q)
      );
    });
  }, [tickets, status, priority, urgency, search]);

  const counts = stats ?? {
    all: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    pending: tickets.filter((t) => t.status === "pending").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    closed: tickets.filter((t) => t.status === "closed").length,
    sla_breached: tickets.filter((t) => t.sla_breached).length,
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ───────── Header ───────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex h-11 w-11 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm dark:border dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
            <TicketIcon className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Tickets</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Support inbox</p>
          </div>
        </div>
        <Button
          className="h-9 rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700"
          onClick={() => setShowNew(true)}
        >
          <Plus className="h-4 w-4 mr-2" /> New Ticket
        </Button>
      </div>

      {/* ───────── Stat cards (click to filter by status) ───────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="All" value={counts.all} icon={TicketIcon} tone="blue" onClick={() => setStatus("all")} active={status === "all"} />
        <StatCard label="Open" value={counts.open} icon={CircleDot} tone="sky" onClick={() => setStatus("open")} active={status === "open"} />
        <StatCard label="Pending" value={counts.pending} icon={Clock} tone="orange" onClick={() => setStatus("pending")} active={status === "pending"} />
        <StatCard label="Resolved" value={counts.resolved} icon={CheckCircle2} tone="green" onClick={() => setStatus("resolved")} active={status === "resolved"} />
        <StatCard label="SLA Breached" value={counts.sla_breached} icon={AlertTriangle} tone="red" />
      </div>

      {/* ───────── Filters + table ───────── */}
      <Card className="rounded-2xl border-slate-200/70 shadow-sm dark:border-slate-800 dark:bg-[#0b1226]">
        <CardContent className="p-3 sm:p-4">
          <div className="flex gap-3 mb-4 flex-wrap">
            <div className="relative w-full min-w-0 sm:min-w-60 sm:flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search subject, email, #number"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 rounded-lg border-slate-200 bg-slate-50/60 pl-9 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="h-9 w-full rounded-lg border-slate-200 bg-white sm:w-40 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
            <Select value={urgency} onValueChange={setUrgency}>
              <SelectTrigger className="h-9 w-full rounded-lg border-slate-200 bg-white sm:w-40 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100">
                <SelectValue placeholder="Urgency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All urgencies</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>


          <div className="rounded-xl border border-slate-200/70 overflow-hidden dark:border-slate-800">
            <Table className="min-w-225">
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:bg-slate-900/60">
                  <TableHead className="w-24 text-left font-medium text-slate-500 dark:text-slate-300">#</TableHead>
                  <TableHead className="text-left font-medium text-slate-500 dark:text-slate-300">Subject</TableHead>
                  <TableHead className="text-left font-medium text-slate-500 dark:text-slate-300">Requester</TableHead>
                  <TableHead className="text-left font-medium text-slate-500 dark:text-slate-300">Status</TableHead>
                  <TableHead className="text-left font-medium text-slate-500 dark:text-slate-300">Priority</TableHead>
                  <TableHead className="text-left font-medium text-slate-500 dark:text-slate-300">Urgency</TableHead>
                  <TableHead className="text-left font-medium text-slate-500 dark:text-slate-300">SLA</TableHead>
                  <TableHead className="text-left font-medium text-slate-500 dark:text-slate-300">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-16 text-center">
                      <TicketIcon className="h-9 w-10 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No tickets yet — try the customer portal or create one.</p>
                    </TableCell>
                  </TableRow>
                ) : filtered.map((t) => {
                  const StatusIcon = STATUS_ICONS[t.status];
                  const PriorityIcon = PRIORITY_ICONS[t.priority];
                  const urg = t.urgency ?? "medium";
                  return (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer border-slate-100 transition-colors hover:bg-blue-50/40 dark:border-slate-800/80 dark:hover:bg-slate-800/40"
                      onClick={() => navigate({ to: "/tickets/$id", params: { id: String(t.id) } })}
                    >
                      <TableCell className="text-left">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          #{t.ticket_number}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-75 truncate text-left font-medium text-slate-800 dark:text-white">
                        {t.subject}
                      </TableCell>
                      <TableCell className="text-left">
                        <div className="flex items-center justify-start gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${AVATAR_COLORS[t.id % AVATAR_COLORS.length]}`}
                          >
                            {getInitials(t.requester_name, t.requester_email)}
                          </div>
                          <div className="min-w-0 text-left">
                            <div className="text-sm font-medium text-slate-800 dark:text-white">
                              {t.requester_name ?? t.requester_email}
                            </div>
                            {t.requester_name && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                                {t.requester_email}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-left">
                        <span className={`${PILL_BASE} ${STATUS_COLORS[t.status] ?? "bg-gray-100 text-gray-700"}`}>
                          {StatusIcon && <StatusIcon className="h-3 w-3" />}
                          {t.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-left">
                        <span className={`${PILL_BASE} ${PRIORITY_COLORS[t.priority] ?? "bg-gray-100 text-gray-700"}`}>
                          {PriorityIcon && <PriorityIcon className="h-3 w-3" />}
                          {t.priority}
                        </span>
                      </TableCell>
                      <TableCell className="text-left">
                        <span className={`inline-block rounded-md px-2.5 py-0.5 text-xs capitalize ${URGENCY_COLORS[urg] ?? "bg-slate-100 text-slate-600"}`}>
                          {urg}
                        </span>
                      </TableCell>
                      <TableCell className="text-left">
                        <SlaCell dueAt={t.sla_due_at} breached={t.sla_breached} responded={!!t.first_response_at} />
                      </TableCell>
                      <TableCell className="text-left text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(t.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {!isLoading && filtered.length > 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              Showing {filtered.length} of {tickets.length} tickets
            </p>
          )}
        </CardContent>
      </Card>

      {showNew && <NewTicketDialog onClose={() => setShowNew(false)} />}
    </div>
  );
}

const statTones: Record<string, { card: string; icon: string }> = {
  blue: {
    card: "from-blue-50 to-white border-blue-100 dark:from-blue-950 dark:to-slate-950 dark:border-blue-500/40",
    icon: "bg-blue-100 text-blue-600 dark:bg-blue-500/25 dark:text-blue-300",
  },
  sky: {
    card: "from-sky-50 to-white border-sky-100 dark:from-sky-950 dark:to-slate-950 dark:border-sky-500/40",
    icon: "bg-sky-500 text-white",
  },
  orange: {
    card: "from-orange-50 to-white border-orange-100 dark:from-orange-950 dark:to-slate-950 dark:border-orange-500/40",
    icon: "bg-orange-100 text-orange-600 dark:bg-orange-500/30 dark:text-orange-300",
  },
  green: {
    card: "from-green-50 to-white border-green-100 dark:from-emerald-950 dark:to-slate-950 dark:border-emerald-500/40",
    icon: "bg-green-100 text-green-600 dark:bg-emerald-500/25 dark:text-emerald-300",
  },
  red: {
    card: "from-red-50 to-white border-red-100 dark:from-red-950 dark:to-slate-950 dark:border-red-500/40",
    icon: "bg-red-500 text-white",
  },
};

function StatCard({ label, value, icon: Icon, tone, onClick, active }: {
  label: string;
  value: number;
  icon: IconType;
  tone: keyof typeof statTones;
  onClick?: () => void;
  active?: boolean;
}) {
  const t = statTones[tone];
  const clickable = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`flex items-center gap-3 sm:gap-4 rounded-2xl border bg-linear-to-br p-3 sm:p-4 text-left shadow-sm transition-all ${t.card} ${
        clickable ? "cursor-pointer hover:shadow-md" : "cursor-default"
      } ${active ? "ring-2 ring-blue-500/60" : ""}`}
    >
      <div className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full ${t.icon}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">{label}</div>
        <div className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">{value}</div>
      </div>
    </button>
  );
}

function SlaCell({ dueAt, breached, responded }: { dueAt: string | null; breached: boolean; responded: boolean }) {
  if (!dueAt) return <span className="text-xs text-muted-foreground">—</span>;
  if (responded) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3" /> Responded
      </span>
    );
  }
  const due = new Date(dueAt).getTime();
  const now = Date.now();
  const mins = Math.round((due - now) / 60000);
  const isBreach = breached || mins < 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        isBreach
          ? "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      }`}
    >
      {isBreach ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {isBreach ? `Breached ${Math.abs(mins)}m` : mins > 60 ? `${Math.round(mins / 60)}h` : `${mins}m`}
    </span>
  );
}

function NewTicketDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    subject: "", description: "", priority: "medium", urgency: "medium",
    requester_email: "", requester_name: "",
  });
  const create = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/tickets", {
        method: "POST",
        body: JSON.stringify({
          subject: form.subject,
          description: form.description || null,
          priority: form.priority,
          urgency: form.urgency,
          requester_email: form.requester_email,
          requester_name: form.requester_name || null,
        }),
      }),
    onSuccess: () => {
      toast.success("Ticket created");
      qc.invalidateQueries({ queryKey: ["tickets"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl border-slate-200 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300">
              <TicketIcon className="h-4 w-4" />
            </span>
            New Ticket
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className={FIELD_LABEL}>Subject</Label>
            <Input className={FIELD} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={200} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className={FIELD_LABEL}>Requester email</Label>
              <Input className={FIELD} type="email" value={form.requester_email} onChange={(e) => setForm({ ...form, requester_email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className={FIELD_LABEL}>Requester name</Label>
              <Input className={FIELD} value={form.requester_name} onChange={(e) => setForm({ ...form, requester_name: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className={FIELD_LABEL}>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger className={FIELD}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className={FIELD_LABEL}>Urgency</Label>
              <Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}>
                <SelectTrigger className={FIELD}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className={FIELD_LABEL}>Description</Label>
            <Textarea
              className="rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-900/70"
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={5000}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="rounded-lg" onClick={onClose}>Cancel</Button>
          <Button
            className="rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => create.mutate()}
            disabled={create.isPending || !form.subject || !form.requester_email}
          >
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Also link to /tickets/$id — declared here for TS-safe navigation
export const _needed = Link;