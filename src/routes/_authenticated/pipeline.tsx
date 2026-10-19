import { defineRoute, Link } from "@/lib/router-compat";
import { useQuery, useQueryClient, useMutation } from "@/lib/react-data-client";
import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  KanbanSquare, Loader2, FileText, ArrowRightLeft, SlidersHorizontal, X,
  ChevronLeft, ChevronRight, Sparkles, PhoneCall, BadgeCheck, MessageSquare,
  Trophy, XCircle, IndianRupee, CalendarDays, Mail, Phone, Users, Clock,
  ArrowUp, ArrowDown, Minus, Flame,
} from "lucide-react";

import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";
import { notifyPermissionDenied } from "@/components/permission-denied";
import { toast } from "sonner";
import {
  convertProposalToDeal, proposalStageToDealStage, canConvert,
  type ProposalStage, type ConvertibleProposal, type ConvertibleLead,
} from "@/lib/proposal-deal";
import { ApprovalBadge, ApprovalHistory, ProposalTimeline } from "@/components/proposal-timeline";
import {
  DETAIL_DIALOG, BTN_PILL, BTN_PRIMARY, DETAIL_INPUT, DetailAvatar, InfoTile,
} from "@/components/detail-ui";


export const Route = defineRoute("/_authenticated/pipeline")({
  head: () => ({ meta: [{ title: "Pipeline — DigiCRM AI" }] }),
  component: PipelinePage,
});

type Status = "new" | "contacted" | "qualified" | "proposal_sent" | "negotiation" | "won" | "lost";
interface Deal {
  id: string; company_name: string; contact_person: string | null; status: Status;
  estimated_value: number | null; priority: string; email?: string | null; phone?: string | null;
  source?: string | null; expected_close_date?: string | null; notes?: string | null;
  industry?: string | null; updated_at?: string;
}

// Shape returned by GET /api/v1/pipeline
interface PipelineStageDTO {
  stage: {
    key: string; label: string; color: string; probability: number;
    order_index: number; is_won: boolean; is_lost: boolean;
  };
  deals: Array<{
    id: number; company_name: string; contact_person: string | null;
    email: string | null; phone: string | null; status: string; priority: string;
    estimated_value: number | null; expected_close_date: string | null;
    source: string | null; industry: string | null; updated_at: string;
  }>;
  count: number;
  total_value: number;
}
interface PipelineResponse {
  stages: PipelineStageDTO[];
  total_deals: number;
  total_value: number;
}

type IconType = React.ComponentType<{ className?: string }>;

/** How many deal cards a single column shows at once. */
const CARDS_PER_PAGE = 6;

/* ---------- stage styling (same hues as the Leads status colours) ---------- */

const stages: {
  key: Status; label: string; prob: number; icon: IconType;
  bar: string; card: string; iconCls: string; count: string;
}[] = [
  {
    key: "new", label: "New", prob: 10, icon: Sparkles,
    bar: "bg-sky-500",
    card: "border-sky-500/20 from-sky-500/10 via-sky-500/[0.03]",
    iconCls: "bg-sky-500/15 text-sky-500",
    count: "bg-sky-500 text-white",
  },
  {
    key: "contacted", label: "Contacted", prob: 25, icon: PhoneCall,
    bar: "bg-amber-500",
    card: "border-amber-500/20 from-amber-500/10 via-amber-500/[0.03]",
    iconCls: "bg-amber-500/15 text-amber-500",
    count: "bg-amber-500 text-white",
  },
  {
    key: "qualified", label: "Qualified", prob: 40, icon: BadgeCheck,
    bar: "bg-fuchsia-500",
    card: "border-fuchsia-500/20 from-fuchsia-500/10 via-fuchsia-500/[0.03]",
    iconCls: "bg-fuchsia-500/15 text-fuchsia-500",
    count: "bg-fuchsia-500 text-white",
  },
  {
    key: "proposal_sent", label: "Proposal", prob: 60, icon: FileText,
    bar: "bg-indigo-500",
    card: "border-indigo-500/20 from-indigo-500/10 via-indigo-500/[0.03]",
    iconCls: "bg-indigo-500/15 text-indigo-500",
    count: "bg-indigo-500 text-white",
  },
  {
    key: "negotiation", label: "Negotiation", prob: 80, icon: MessageSquare,
    bar: "bg-violet-500",
    card: "border-violet-500/20 from-violet-500/10 via-violet-500/[0.03]",
    iconCls: "bg-violet-500/15 text-violet-500",
    count: "bg-violet-500 text-white",
  },
  {
    key: "won", label: "Won", prob: 100, icon: Trophy,
    bar: "bg-emerald-500",
    card: "border-emerald-500/20 from-emerald-500/10 via-emerald-500/[0.03]",
    iconCls: "bg-emerald-500/15 text-emerald-500",
    count: "bg-emerald-500 text-white",
  },
  {
    key: "lost", label: "Lost", prob: 0, icon: XCircle,
    bar: "bg-rose-500",
    card: "border-rose-500/20 from-rose-500/10 via-rose-500/[0.03]",
    iconCls: "bg-rose-500/15 text-rose-500",
    count: "bg-rose-500 text-white",
  },
];

/** Urgent deals surface at the top of every stage column. */
const PRIORITY_RANK: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

// Same priority palette as the Leads page
const priorityColors: Record<string, string> = {
  low:
    "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/30",
  medium:
    "bg-teal-100 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:ring-teal-500/30",
  high:
    "bg-orange-500 text-white ring-1 ring-orange-600 dark:bg-orange-500/90 dark:text-white dark:ring-orange-400/40",
  urgent:
    "bg-red-600 text-white ring-1 ring-red-700 dark:bg-red-600 dark:text-white dark:ring-red-400/40",
};

const priorityIcons: Record<string, IconType> = {
  low: ArrowDown, medium: Minus, high: ArrowUp, urgent: Flame,
};

const AVATAR_TONES = [
  "bg-blue-100 text-blue-700 dark:bg-blue-600 dark:text-white",
  "bg-pink-100 text-pink-700 dark:bg-pink-600 dark:text-white",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-600 dark:text-white",
  "bg-orange-100 text-orange-700 dark:bg-orange-600 dark:text-white",
  "bg-violet-100 text-violet-700 dark:bg-violet-600 dark:text-white",
  "bg-teal-100 text-teal-700 dark:bg-teal-600 dark:text-white",
  "bg-rose-100 text-rose-700 dark:bg-rose-600 dark:text-white",
  "bg-amber-100 text-amber-700 dark:bg-amber-600 dark:text-white",
];

const PANEL = "rounded-2xl border border-slate-200/70 bg-card shadow-sm dark:border-slate-800";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
});

function initialsOf(...names: (string | null | undefined)[]): string {
  const src = (names.find((n) => n && n.trim()) || "?").trim();
  const parts = src.split(/\s+/);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function toneFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

function PriorityPill({ priority }: { priority: string }) {
  const Icon = priorityIcons[priority];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${priorityColors[priority] || "bg-gray-100 text-gray-700"}`}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {priority || "—"}
    </span>
  );
}

type PipelineProposal = ConvertibleProposal;

function PipelinePage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [dragId, setDragId] = useState<string | null>(null);
  const perms = usePermissions();
  const canEdit = perms.canEdit("pipeline");
  const [detail, setDetail] = useState<Deal | null>(null);
  const [edit, setEdit] = useState({ status: "new" as Status, estimated_value: "", priority: "medium", expected_close_date: "", notes: "" });
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  // current page (0-based) of every stage column
  const [pages, setPages] = useState<Record<string, number>>({});

  const { data: proposals } = useQuery({
    queryKey: ["pipeline-proposals"],
    queryFn: async () => {
      return apiFetch<PipelineProposal[]>("/api/v1/proposals?limit=50");
    },
  });

  const convert = useMutation({
    mutationFn: async (p: PipelineProposal) => {
      if (!user?.id) throw new Error("Not signed in");
      if (!p.lead_id) throw new Error("This proposal isn't linked to a lead yet.");
      const lead = await apiFetch<ConvertibleLead>(`/api/v1/leads/${p.lead_id}`);
      return convertProposalToDeal(p, lead, {
        dealStage: proposalStageToDealStage[p.status as ProposalStage],
        value: Number(p.amount ?? 0),
      });
    },
    onSuccess: () => {
      toast.success("Proposal added to the pipeline");
      qc.invalidateQueries({ queryKey: ["pipeline-deals"] });
      qc.invalidateQueries({ queryKey: ["pipeline-proposals"] });
      qc.invalidateQueries({ queryKey: ["kpi"] });
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const openDeal = (d: Deal) => {
    setDetail(d);
    setEdit({
      status: d.status,
      estimated_value: String(d.estimated_value ?? ""),
      priority: d.priority,
      expected_close_date: d.expected_close_date ?? "",
      notes: d.notes ?? "",
    });
  };


  const saveDeal = async () => {
    if (!detail) return;
    try {
      await apiFetch(`/api/v1/leads/${detail.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: detail.company_name,        // keep existing
          email: detail.email,
          phone: detail.phone,
          company: detail.company_name,
          message: detail.notes ?? "",
          status: edit.status,
          priority: edit.priority,
          value: edit.estimated_value === "" ? 0 : Number(edit.estimated_value),
          assigned_to: null,                // preserve if you track it
          score: 0,
          custom_fields: {},
        }),
      });
    } catch (e) {
      return notifyPermissionDenied(e as Error);
    }
    toast.success("Deal updated");
    setDetail(null);
    qc.invalidateQueries({ queryKey: ["pipeline-deals"] });
    qc.invalidateQueries({ queryKey: ["kpi"] });
  };

  const { data: pipeline, isLoading } = useQuery({
    queryKey: ["pipeline-deals"],
    queryFn: async () => {
      return apiFetch<PipelineResponse>("/api/v1/pipeline");
    },
    // No websocket/SSE endpoint provided yet, so poll instead of Supabase realtime.
    refetchInterval: 15000,
  });

  const deals: Deal[] = (pipeline?.stages ?? []).flatMap((s) =>
    s.deals.map((d) => ({
      id: String(d.id),
      company_name: d.company_name,
      contact_person: d.contact_person,
      status: d.status as Status,
      estimated_value: d.estimated_value,
      priority: d.priority,
      email: d.email,
      phone: d.phone,
      source: d.source,
      expected_close_date: d.expected_close_date ?? undefined,
      notes: null,
      industry: d.industry,
      updated_at: d.updated_at,
    })),
  );

  const handleDrop = async (status: Status) => {
    if (!dragId) return;
    const id = dragId; setDragId(null);
    try {
      await apiFetch(`/api/v1/pipeline/deals/${id}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    } catch (e) {
      return toast.error((e as Error).message);
    }
    toast.success(`Moved to ${status.replace("_", " ")}`);
    qc.invalidateQueries({ queryKey: ["pipeline-deals"] });
    qc.invalidateQueries({ queryKey: ["kpi"] });
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const companies = [...new Set(deals.map((d) => d.company_name).filter(Boolean))].sort();
  const activeFilters =
    (priorityFilter === "all" ? 0 : 1) + (stageFilter === "all" ? 0 : 1) + (companyFilter === "all" ? 0 : 1);

  // any filter change sends every column back to its first page
  const resetPages = () => setPages({});
  const clearFilters = () => {
    setPriorityFilter("all"); setStageFilter("all"); setCompanyFilter("all"); resetPages();
  };

  const visibleDeals = deals.filter((d) =>
    (priorityFilter === "all" || d.priority === priorityFilter) &&
    (stageFilter === "all" || d.status === stageFilter) &&
    (companyFilter === "all" || d.company_name === companyFilter),
  );

  const setStagePage = (key: string, next: number) =>
    setPages((p) => ({ ...p, [key]: next }));

  const filterTrigger =
    "h-10 rounded-xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/60";

  return (
    <div className="space-y-6">
      {/* ================= HEADER ================= */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm dark:border dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
            <KanbanSquare className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Pipeline</h1>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {visibleDeals.length} deals
              </span>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              Urgent deals first in every stage. Drag to update stages.
            </p>
          </div>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button className="relative h-10 rounded-xl bg-blue-600 px-4 text-white shadow-sm hover:bg-blue-700 dark:border dark:border-violet-500 dark:bg-slate-900/80 dark:shadow-[0_0_0_3px_rgba(139,92,246,0.22)] dark:hover:bg-slate-800">
              <SlidersHorizontal className="mr-2 h-4 w-4" /> Filter
              {activeFilters > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                  {activeFilters}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 space-y-3 rounded-2xl p-4 shadow-xl">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-slate-500">Priority</Label>
              <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); resetPages(); }}>
                <SelectTrigger className={filterTrigger}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  {["urgent", "high", "medium", "low"].map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-slate-500">Stage</Label>
              <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v); resetPages(); }}>
                <SelectTrigger className={filterTrigger}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stages</SelectItem>
                  {stages.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-slate-500">Company</Label>
              <Select value={companyFilter} onValueChange={(v) => { setCompanyFilter(v); resetPages(); }}>
                <SelectTrigger className={filterTrigger}><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="all">All companies</SelectItem>
                  {companies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" className="w-full rounded-xl" onClick={clearFilters}>Clear all</Button>
          </PopoverContent>
        </Popover>
      </div>

      {activeFilters > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {priorityFilter !== "all" && (
            <Badge variant="secondary" className="capitalize gap-1 rounded-full px-3">
              Priority: {priorityFilter}
              <button onClick={() => { setPriorityFilter("all"); resetPages(); }} aria-label="Clear priority filter"><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {stageFilter !== "all" && (
            <Badge variant="secondary" className="gap-1 rounded-full px-3">
              Stage: {stages.find((s) => s.key === stageFilter)?.label}
              <button onClick={() => { setStageFilter("all"); resetPages(); }} aria-label="Clear stage filter"><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {companyFilter !== "all" && (
            <Badge variant="secondary" className="gap-1 rounded-full px-3">
              Company: {companyFilter}
              <button onClick={() => { setCompanyFilter("all"); resetPages(); }} aria-label="Clear company filter"><X className="h-3 w-3" /></button>
            </Badge>
          )}
          <Button variant="ghost" size="sm" className="rounded-full" onClick={clearFilters}>Clear all</Button>
        </div>
      )}

      {/* ================= KANBAN BOARD ================= */}
      <div className="overflow-x-auto -mx-4 px-4 pb-4">
        <div className="flex gap-4 min-w-max items-start">
          {stages.map((stage) => {
            const StageIcon = stage.icon;
            const items = visibleDeals
              .filter((d) => d.status === stage.key)
              .sort((a, b) =>
                (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0) ||
                new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime(),
              );
            const total = items.reduce((s, d) => s + Number(d.estimated_value ?? 0), 0);

            // pagination: 6 cards per column, arrows move through the rest
            const pageCount = Math.max(1, Math.ceil(items.length / CARDS_PER_PAGE));
            const page = Math.min(pages[stage.key] ?? 0, pageCount - 1);
            const pageItems = items.slice(page * CARDS_PER_PAGE, page * CARDS_PER_PAGE + CARDS_PER_PAGE);
            const from = items.length === 0 ? 0 : page * CARDS_PER_PAGE + 1;
            const to = Math.min(items.length, (page + 1) * CARDS_PER_PAGE);

            return (
              <div
                key={stage.key}
                className={`relative w-72 shrink-0 overflow-hidden rounded-2xl border bg-linear-to-b to-transparent p-3 pt-4 ${stage.card}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(stage.key)}
              >
                <div className={`absolute inset-x-0 top-0 h-1 ${stage.bar}`} />

                {/* column header */}
                <div className="flex items-center justify-between mb-3 gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${stage.iconCls}`}>
                      <StageIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm text-slate-900 dark:text-white">{stage.label}</h3>
                      <p className="text-xs text-muted-foreground truncate">{inr.format(total)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900/60 dark:text-slate-300 dark:ring-slate-700">
                      {stage.prob}%
                    </span>
                    <span className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${stage.count}`}>
                      {items.length}
                    </span>
                  </div>
                </div>

                {/* cards (max 6) */}
                <div className="space-y-2 min-h-24">
                  {pageItems.map((d) => (
                    <Card
                      key={d.id}
                      draggable
                      onDragStart={() => setDragId(d.id)}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => openDeal(d)}
                      className={`cursor-grab rounded-xl border-slate-200/70 bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-500/50 hover:shadow-md active:cursor-grabbing dark:border-slate-800 ${dragId === d.id ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${toneFor(d.id)}`}>
                          {initialsOf(d.contact_person, d.company_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate text-slate-800 dark:text-white">{d.company_name}</p>
                          {d.contact_person && <p className="text-xs text-muted-foreground truncate">{d.contact_person}</p>}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-sm font-semibold text-slate-800 dark:text-white">
                          {inr.format(Number(d.estimated_value ?? 0))}
                        </span>
                        <PriorityPill priority={d.priority} />
                      </div>
                      {d.expected_close_date && (
                        <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <CalendarDays className="h-3 w-3" />
                          Close {new Date(d.expected_close_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        </p>
                      )}
                    </Card>
                  ))}
                  {items.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-300/70 py-8 text-center text-xs text-muted-foreground dark:border-slate-700">
                      Drop here
                    </div>
                  )}
                </div>

                {/* prev / next arrows */}
                <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200/70 bg-white/60 px-1.5 py-1 dark:border-slate-800 dark:bg-slate-900/40">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg"
                    title="Previous"
                    aria-label={`Previous ${stage.label} deals`}
                    disabled={page === 0}
                    onClick={() => setStagePage(stage.key, page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {items.length === 0 ? "0 deals" : (
                      <>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{from}–{to}</span> of {items.length}
                      </>
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg"
                    title="Next"
                    aria-label={`Next ${stage.label} deals`}
                    disabled={page >= pageCount - 1}
                    onClick={() => setStagePage(stage.key, page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= PROPOSALS ================= */}
      <Card className={PANEL}>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-500">
              <FileText className="h-4 w-4" />
            </span>
            Proposals
          </CardTitle>
          <Button asChild size="sm" variant="outline" className="rounded-xl border-violet-500/40 text-violet-600 hover:bg-violet-500/10 dark:text-violet-400">
            <Link to="/proposals">Open proposals</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {(proposals ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No proposals yet — draft one in the Proposals module or with the AI Assistant.
            </p>
          )}
          {(proposals ?? []).map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-200/70 bg-slate-50/50 p-3 flex items-center justify-between gap-3 flex-wrap transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:bg-slate-900/70">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm truncate">{p.title}</p>
                  <Badge variant="secondary" className="text-[10px] capitalize rounded-full">{p.status}</Badge>
                  {p.pipeline_stage === "in_pipeline" && <Badge variant="outline" className="text-[10px] rounded-full">In pipeline</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {p.currency} {Number(p.amount ?? 0).toLocaleString()} · close {p.close_date ? new Date(p.close_date).toLocaleDateString() : "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ApprovalBadge status={p.approval_status} />
                {canEdit && p.pipeline_stage !== "in_pipeline" && canConvert(p) && (
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => convert.mutate(p)} disabled={convert.isPending}>
                    {convert.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />}
                    Convert to deal
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>


      {/* ================= DEAL DETAIL ================= */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className={`${DETAIL_DIALOG} sm:max-w-2xl`}>
          <DialogHeader className="px-8 pt-7 pb-4 space-y-0">
            <div className="flex items-center gap-4 pr-8">
              <DetailAvatar initials={detail ? initialsOf(detail.contact_person, detail.company_name) : undefined} />
              <div className="min-w-0">
                <DialogTitle className="text-2xl font-bold truncate">{detail?.company_name}</DialogTitle>
                <DialogDescription className="mt-1 truncate">
                  {detail?.contact_person || "No contact person"}
                  {detail?.industry ? ` · ${detail.industry}` : ""}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {detail && (
            <div className="flex-1 overflow-y-auto px-8 pb-6 pt-2 space-y-5 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoTile icon={Mail} label="Email" value={detail.email} tone="blue" copyable />
                <InfoTile icon={Phone} label="Phone" value={detail.phone} tone="purple" copyable />
                <InfoTile icon={Users} label="Source" value={detail.source} tone="pink" />
                <InfoTile
                  icon={Clock}
                  label="Last update"
                  value={detail.updated_at ? new Date(detail.updated_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null}
                  tone="green"
                />
              </div>

              {canEdit ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Stage</Label>
                      <Select value={edit.status} onValueChange={(v) => setEdit({ ...edit, status: v as Status })}>
                        <SelectTrigger className={DETAIL_INPUT}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {stages.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5"><Label>Priority</Label>
                      <Select value={edit.priority} onValueChange={(v) => setEdit({ ...edit, priority: v })}>
                        <SelectTrigger className={DETAIL_INPUT}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["low", "medium", "high", "urgent"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5"><Label>Deal value (₹)</Label>
                      <Input className={DETAIL_INPUT} type="number" min={0} value={edit.estimated_value} onChange={(e) => setEdit({ ...edit, estimated_value: e.target.value })} />
                    </div>
                    <div className="space-y-1.5"><Label>Expected close</Label>
                      <Input className={DETAIL_INPUT} type="date" value={edit.expected_close_date} onChange={(e) => setEdit({ ...edit, expected_close_date: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1.5"><Label>Notes</Label>
                    <Textarea className="rounded-xl" rows={3} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InfoTile icon={KanbanSquare} label="Stage" value={detail.status.replace("_", " ")} tone="blue" />
                  <InfoTile icon={IndianRupee} label="Value" value={inr.format(Number(detail.estimated_value ?? 0))} tone="green" />
                  <InfoTile icon={Flame} label="Priority" value={detail.priority} tone="orange" />
                  <InfoTile icon={CalendarDays} label="Expected close" value={detail.expected_close_date ?? null} tone="purple" />
                </div>
              )}

              <div className="border-t border-border/60 pt-4">
                <p className="text-[11px] uppercase tracking-[0.12em] font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Proposal timeline
                </p>
                <ProposalTimeline
                  proposalIds={(proposals ?? []).filter((p) => String(p.lead_id) === detail.id).map((p) => String(p.id))}
                />
                {(proposals ?? []).filter((p) => String(p.lead_id) === detail.id).map((p) => (
                  <div key={p.id} className="mt-3">
                    <p className="text-xs text-muted-foreground mb-1">Approval history — {p.title}</p>
                    <ApprovalHistory proposalId={String(p.id)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="px-8 py-4 border-t border-border/60 bg-background/60 backdrop-blur flex items-center justify-between sm:justify-between">
            <Button variant="outline" className={BTN_PILL} onClick={() => setDetail(null)}>
              <X className="mr-2 h-4 w-4" /> Close
            </Button>
            {canEdit && <Button className={BTN_PRIMARY} onClick={() => void saveDeal()}>Save changes</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}