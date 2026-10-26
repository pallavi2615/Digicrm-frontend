import { defineRoute } from "@/lib/router-compat";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-data-client";
import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FileText, Sparkles, Loader2, Download, Plus, Pencil, Eye, Trash2, Search,
  Clock, ShieldCheck, LayoutTemplate, Send, CheckCircle2, XCircle, ArrowRightLeft,
  IndianRupee, TrendingUp, Trophy,
} from "lucide-react";
import { notifyPermissionDenied } from "@/components/permission-denied";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";
import {
  ApprovalBadge,
  ProposalTimeline,
  ApprovalHistory,
} from "@/components/proposal-timeline";
import { convertProposalToDeal, proposalStageToDealStage, canConvert } from "@/lib/proposal-deal";
import type { ApprovalStatus, LeadStatus } from "@/lib/proposal-deal";
import { useActiveIndustry } from "@/lib/active-industry";
import { toast } from "sonner";
import { DatePicker } from "@/components/ui/datetime-picker";

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

export const Route = defineRoute("/_authenticated/proposals")({
  head: () => ({
    meta: [
      { title: "Proposals — DigiCRM AI" },
      { name: "description", content: "Create, track and edit sales proposals with amount, probability, status and terms." },
    ],
  }),
  component: ProposalsPage,
});

const STATUSES = ["draft", "sent", "negotiation", "accepted", "declined"] as const;
type Status = (typeof STATUSES)[number];

const CURRENCIES = ["INR", "USD", "EUR", "GBP"] as const;

const DEAL_STAGES: LeadStatus[] = ["new", "contacted", "qualified", "proposal_sent", "negotiation", "won", "lost"];

interface Proposal {
  id: number;
  tenant_id: number;
  lead_id: number | null;
  title: string;
  description: string | null;
  amount: string;
  currency: string;
  status: string;
  valid_until: string | null;
  terms: string | null;
  public_token: string | null;
  probability: number;
  close_date: string | null;
  owner: string | null;
  version: string | null;
  approval_status: ApprovalStatus | null;
  pipeline_stage: string | null;
  lead_name: string | null;
  template_id: number | null;
  industry: string | null; 
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

interface Lead {
  id: number;
  tenant_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  message: string | null;
  source: string | null;
  status: string | null;
  priority: string | null;
  value: string | null;
  assigned_to: number | null;
  score: number | null;
  created_at: string;
  updated_at: string;
}

interface Template {
  id: number;
  tenant_id: number;
  title: string;
  description: string | null;
  category: string | null;
  owner_label: string | null;
  amount: string | null;
  currency: string | null;
  terms: string | null;
  content: Record<string, unknown> | null;
  shared_with_team: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

interface RenderedTemplate {
  template_id: number;
  title: string;
  description: string | null;
  amount: number;
  currency: string | null;
  terms: string | null;
  document_content: string | null;
}

interface UseTemplateResponse {
  success: boolean;
  proposal_id: number;
  message: string;
}

const emptyForm = {
  title: "",
  description: "",
  lead_id: "none",
  status: "draft" as Status,
  amount: "",
  currency: "INR",
  probability: "50",
  close_date: "",
  valid_until: "",
  terms: "",
  template_id: "none",
};
type Form = typeof emptyForm;

type IconType = React.ComponentType<{ className?: string }>;

// ════════════════════════════════════════════════════════════
// STATUS COLORS — same pill language as the Leads page
// draft → slate · sent → sky · negotiation → amber
// accepted → emerald · declined → rose
// ════════════════════════════════════════════════════════════
const statusTone: Record<string, string> = {
  draft:
    "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/30",
  sent:
    "bg-sky-100 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30",
  negotiation:
    "bg-amber-100 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  accepted:
    "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  declined:
    "bg-rose-100 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
};

const statusIcons: Record<string, IconType> = {
  draft: FileText,
  sent: Send,
  negotiation: ArrowRightLeft,
  accepted: CheckCircle2,
  declined: XCircle,
};

const avatarColors = [
  "bg-blue-100 text-blue-700 dark:bg-blue-600 dark:text-white",
  "bg-pink-100 text-pink-700 dark:bg-pink-600 dark:text-white",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-600 dark:text-white",
  "bg-orange-100 text-orange-700 dark:bg-orange-600 dark:text-white",
  "bg-violet-100 text-violet-700 dark:bg-violet-600 dark:text-white",
  "bg-teal-100 text-teal-700 dark:bg-teal-600 dark:text-white",
  "bg-rose-100 text-rose-700 dark:bg-rose-600 dark:text-white",
  "bg-amber-100 text-amber-700 dark:bg-amber-600 dark:text-white",
];

function getInitials(name: string | null | undefined): string {
  const parts = (name || "?").trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// Shared form-control look (matches Leads page inputs)
const FIELD =
  "h-9 rounded-lg border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100";
const FIELD_LABEL = "text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";
const DIALOG = "max-h-[90vh] overflow-y-auto rounded-2xl border-slate-200 dark:border-slate-800";

function leadLabel(l: Lead) {
  return l.company || l.name || `Lead #${l.id}`;
}

function ProposalsPage() {
  const { user, isAdmin } = useAuth();
  const perms = usePermissions();
  const qc = useQueryClient();

  const { activeGroup } = useActiveIndustry();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Proposal | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState<Proposal | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [converting, setConverting] = useState<Proposal | null>(null);
  const [convertForm, setConvertForm] = useState({ stage: "proposal_sent" as LeadStatus, value: "" });

  const [previewing, setPreviewing] = useState<Template | null>(null);
  const [clientName, setClientName] = useState("");
  const [rendered, setRendered] = useState<RenderedTemplate | null>(null);

  const { data: templates } = useQuery({
    queryKey: ["proposal-templates"],
    queryFn: () => apiFetch<Template[]>("/api/v1/proposal-templates"),
  });

  const fillFormFromRendered = (r: RenderedTemplate) => {
    setEditing(null);
    setForm({
      ...emptyForm,
      title: r.title,
      description: r.description ?? "",
      amount: r.amount ? String(Number(r.amount)) : "",
      currency: r.currency || "INR",
      terms: r.document_content || r.terms || "",
      template_id: String(r.template_id),
    });
    setFormOpen(true);
    toast.success(`Template "${r.title}" loaded`);
  };

  const applyTemplateLocal = (t: Template) => {
    setEditing(null);
    setForm({
      ...emptyForm,
      title: t.title,
      description: t.description ?? "",
      amount: t.amount ? String(Number(t.amount)) : "",
      currency: t.currency || "INR",
      terms: t.terms ?? "",
      template_id: String(t.id),
    });
    setFormOpen(true);
    toast.success(`Template "${t.title}" loaded`);
  };

  const renderRequest = (id: number, client?: string) =>
    apiFetch<RenderedTemplate>(`/api/v1/proposal-templates/${id}/render`, {
      method: "POST",
      body: JSON.stringify({ client_name: client?.trim() || undefined }),
    });

  const loadTemplate = useMutation({
    mutationFn: (t: Template) => renderRequest(t.id),
    onSuccess: (r) => fillFormFromRendered(r),
    onError: (_e, t) => {
      toast.message("Couldn't render the template, loading the basic version instead.");
      applyTemplateLocal(t);
    },
  });

  const previewTemplate = useMutation({
    mutationFn: ({ id, client }: { id: number; client?: string }) => renderRequest(id, client),
    onSuccess: (r) => setRendered(r),
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const createFromTemplate = useMutation({
    mutationFn: (id: number) =>
      apiFetch<UseTemplateResponse>(`/api/v1/proposal-templates/${id}/use`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Draft proposal created from template");
      closePreview();
      qc.invalidateQueries({ queryKey: ["proposals"] });
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const openPreview = (t: Template) => {
    setPreviewing(t);
    setClientName("");
    setRendered(null);
    previewTemplate.mutate({ id: t.id });
  };

  const closePreview = () => {
    setPreviewing(null);
    setClientName("");
    setRendered(null);
  };

  const deleteTemplate = useMutation({
    mutationFn: async (id: number) => {
      try {
        await apiFetch(`/api/v1/proposal-templates/${id}`, { method: "DELETE" });
      } catch (e) {
        if (!(e instanceof SyntaxError)) throw e;
      }
    },
    onSuccess: () => {
      toast.success("Template removed");
      qc.invalidateQueries({ queryKey: ["proposal-templates"] });
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const { data: leads } = useQuery({
  queryKey: ["proposal-leads"],
  queryFn: async (): Promise<Lead[]> => {
    const res = await apiFetch<
      Lead[] | { items?: Lead[]; data?: Lead[]; results?: Lead[] }
    >("/api/v1/leads?page=1&size=100");

    if (Array.isArray(res)) return res;          // old plain-array shape
    return res.items ?? res.data ?? res.results ?? [];  // paginated shape
  },
});

  const relatedLeadOptions = useMemo(
    () =>
      (leads ?? []).filter(
        (l) =>
          (l.status ?? "").toLowerCase() === "qualified" ||
          String(l.id) === form.lead_id,
      ),
    [leads, form.lead_id],
  );

  // const { data: proposals, isLoading, isError, refetch } = useQuery({
  //   queryKey: ["proposals"],
  //   queryFn: () => apiFetch<Proposal[]>("/api/v1/proposals"),
  // });

  const { data: proposals, isLoading, isError, refetch } = useQuery({
    queryKey: ["proposals", activeGroup],   // ⭐ cache per industry
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeGroup) params.set("industry", activeGroup);
      const qs = params.toString();
      return apiFetch<Proposal[]>(`/api/v1/proposals${qs ? `?${qs}` : ""}`);
    },
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (proposals ?? []).filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!term) return true;
      return [p.title, p.description, p.terms].some((v) => (v ?? "").toLowerCase().includes(term));
    });
  }, [proposals, search, statusFilter]);

  const totals = useMemo(() => {
    const value = rows.reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const weighted = rows.reduce((s, p) => s + (Number(p.amount ?? 0) * Number(p.probability ?? 0)) / 100, 0);
    const won = rows.filter((p) => p.status === "accepted").length;
    return { value, weighted, won };
  }, [rows]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (p: Proposal) => {
    setEditing(p);
    setForm({
      title: p.title,
      description: p.description ?? "",
      lead_id: p.lead_id != null ? String(p.lead_id) : "none",
      status: (p.status as Status) ?? "draft",
      amount: String(p.amount ?? ""),
      currency: p.currency || "INR",
      probability: String(p.probability ?? 50),
      close_date: p.close_date ?? "",
      valid_until: p.valid_until ?? "",
      terms: p.terms ?? "",
      template_id: p.template_id != null ? String(p.template_id) : "none",
    });
    setFormOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Title is required");
      if (form.close_date) validateDate(form.close_date);
      if (form.valid_until) validateDate(form.valid_until);

      const leadId = form.lead_id === "none" ? null : Number(form.lead_id);
      const selectedLead = (leads ?? []).find((l) => l.id === leadId) ?? null;

      const basePayload = {
        lead_id: leadId,
        title: form.title.trim(),
        description: form.description || null,
        amount: Number(form.amount || 0),
        currency: form.currency || "INR",
        valid_until: form.valid_until || null,
        terms: form.terms || null,
        probability: Math.min(100, Math.max(0, Number(form.probability || 0))),
        close_date: form.close_date || null,
        owner: selectedLead?.company || selectedLead?.name || "",
        version: editing?.version || "v1",
        pipeline_stage: editing?.pipeline_stage || "in_pipeline",
        lead_name: selectedLead ? leadLabel(selectedLead) : null,
        template_id: form.template_id === "none" ? null : Number(form.template_id),
        industry: activeGroup || null,
      };

      if (editing) {
        await apiFetch(`/api/v1/proposals/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify({
            ...basePayload,
            status: form.status,
            approval_status: editing.approval_status ?? "pending",
          }),
        });
      } else {
        await apiFetch("/api/v1/proposals", {
          method: "POST",
          body: JSON.stringify({
            ...basePayload,
            approval_status: "pending",
          }),
        });
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Proposal updated" : "Proposal created");
      qc.invalidateQueries({ queryKey: ["proposals"] });
      setFormOpen(false);
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const openConvert = (p: Proposal) => {
    setConverting(p);
    setConvertForm({
      stage: proposalStageToDealStage[(p.status as keyof typeof proposalStageToDealStage)] ?? "proposal_sent",
      value: String(p.amount ?? 0),
    });
  };

  const convert = useMutation({
    mutationFn: async () => {
      if (!converting) throw new Error("Nothing to convert");
      const lead = (leads ?? []).find((l) => l.id === converting.lead_id);
      if (!lead) throw new Error("Linked lead not found");
      return convertProposalToDeal(converting, lead, {
        dealStage: convertForm.stage,
        value: Number(convertForm.value || 0),
      });
    },
    onSuccess: () => {
      toast.success("Deal updated in Pipeline");
      setConverting(null);
      qc.invalidateQueries({ queryKey: ["proposals"] });
      qc.invalidateQueries({ queryKey: ["proposal-leads"] });
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const handleGenerateWithAI = () => {
    toast.info("Currently not available");
  };

  const requestApproval = useMutation({
    mutationFn: async (p: Proposal) => {
      await apiFetch(`/api/v1/proposals/${p.id}`, {
        method: "PUT",
        body: JSON.stringify({
          lead_id: p.lead_id,
          title: p.title,
          description: p.description,
          amount: Number(p.amount),
          currency: p.currency,
          valid_until: p.valid_until,
          terms: p.terms,
          status: p.status,
          probability: p.probability,
          close_date: p.close_date,
          owner: p.owner,
          version: p.version,
          approval_status: "pending",
          pipeline_stage: p.pipeline_stage,
          lead_name: p.lead_name,
          template_id: p.template_id,
          industry: p.industry,
        }),
      });
    },
    onSuccess: () => {
      toast.success("Approval requested");
      qc.invalidateQueries({ queryKey: ["proposals"] });
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const approveProposal = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/v1/proposals/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Proposal approved");
      qc.invalidateQueries({ queryKey: ["proposals"] });
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const rejectProposal = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/v1/proposals/${id}/reject`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Proposal rejected");
      qc.invalidateQueries({ queryKey: ["proposals"] });
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const sendProposal = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/v1/proposals/${id}/send`, { method: "POST" }),
    onSuccess: () => { toast.success("Proposal marked as sent"); qc.invalidateQueries({ queryKey: ["proposals"] }); },
    onError: (e: Error) => notifyPermissionDenied(e),
  });
  const acceptProposal = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/v1/proposals/${id}/accept`, { method: "POST" }),
    onSuccess: () => { toast.success("Proposal marked as accepted"); qc.invalidateQueries({ queryKey: ["proposals"] }); },
    onError: (e: Error) => notifyPermissionDenied(e),
  });
  const declineProposal = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/v1/proposals/${id}/decline`, { method: "POST" }),
    onSuccess: () => { toast.success("Proposal marked as declined"); qc.invalidateQueries({ queryKey: ["proposals"] }); },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      try {
        await apiFetch(`/api/v1/proposals/${id}`, { method: "DELETE" });
      } catch (e) {
        if (!(e instanceof SyntaxError)) throw e;
      }
    },
    onSuccess: () => { toast.success("Proposal deleted"); qc.invalidateQueries({ queryKey: ["proposals"] }); },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const download = (p: Proposal) => {
    const body = p.terms || `# ${p.title}\n\n${p.description ?? ""}\n\nAmount: ${p.currency} ${Number(p.amount).toLocaleString()}\nStatus: ${p.status}`;
    const url = URL.createObjectURL(new Blob([body], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `proposal-${p.title.replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ───────── Header ───────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex h-11 w-11 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm dark:border dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
            <FileText className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Proposals</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Track every proposal with amount, probability, status and close date.
            </p>
          </div>
        </div>
        {perms.canCreate("proposals") && (
          <Button className="h-9 rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> New proposal
          </Button>
        )}
      </div>

      {/* ───────── Stat cards ───────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Open value" value={totals.value.toLocaleString()} icon={IndianRupee} tone="blue" />
        <StatCard label="Weighted forecast" value={Math.round(totals.weighted).toLocaleString()} icon={TrendingUp} tone="violet" />
        <StatCard label="Accepted" value={String(totals.won)} icon={Trophy} tone="green" />
      </div>

      {/* ───────── Templates ───────── */}
      <Card className="rounded-2xl border-slate-200/70 shadow-sm dark:border-slate-800 dark:bg-[#0b1226]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2.5 text-base">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">
              <LayoutTemplate className="h-4 w-4" />
            </span>
            Templates
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {(templates ?? []).length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-3 pt-0 sm:p-4 sm:pt-0">
          {(templates ?? []).length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-muted-foreground dark:border-slate-700">
              No templates yet.
            </div>
          )}
          <div className="grid gap-2.5 sm:grid-cols-2">
            {(templates ?? []).map((t) => (
              <div
                key={t.id}
                className="flex items-start justify-between gap-2 rounded-xl border border-slate-200/70 bg-white p-3 transition-all hover:border-violet-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-violet-500/50"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-white">{t.title}</p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">
                      {t.category ? `${t.category} · ` : ""}{t.description || "No description"}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {t.shared_with_team ? "Shared with the team" : "Private"}
                      {t.amount ? ` · ${t.currency ?? ""} ${Number(t.amount).toLocaleString()}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 dark:hover:bg-blue-500/30"
                    title="Preview template"
                    onClick={() => openPreview(t)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {perms.canCreate("proposals") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-800 dark:border-violet-500/40 dark:text-violet-300 dark:hover:bg-violet-500/10"
                      onClick={() => loadTemplate.mutate(t)}
                      disabled={loadTemplate.isPending && loadTemplate.variables?.id === t.id}
                    >
                      {loadTemplate.isPending && loadTemplate.variables?.id === t.id && (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      )}
                      Use
                    </Button>
                  )}
                  {(t.created_by != null && String(t.created_by) === user?.id || isAdmin) && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25"
                      title="Delete template"
                      onClick={() => deleteTemplate.mutate(t.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ───────── All proposals ───────── */}
      <Card className="rounded-2xl border-slate-200/70 shadow-sm dark:border-slate-800 dark:bg-[#0b1226]">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
          <CardTitle className="flex items-center gap-2.5 text-base">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300">
              <FileText className="h-4 w-4" />
            </span>
            All proposals
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {rows.length}
            </span>
          </CardTitle>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="h-9 rounded-lg border-slate-200 bg-slate-50/60 pl-9 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-500"
                placeholder="Search proposals…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-full rounded-lg border-slate-200 bg-white sm:w-40 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5 p-3 pt-0 sm:p-4 sm:pt-0">
          {isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}

          {isError && (
            <div className="text-center py-10 space-y-2">
              <p className="text-sm text-muted-foreground">We couldn't load your proposals.</p>
              <Button size="sm" variant="outline" className="rounded-lg" onClick={() => void refetch()}>Retry</Button>
            </div>
          )}

          {!isLoading && !isError && rows.length === 0 && (
            <div className="text-center py-14">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {(proposals ?? []).length === 0 ? "No proposals yet — create your first one." : "No proposals match these filters."}
              </p>
            </div>
          )}

          {rows.map((p) => {
            const StatusIcon = statusIcons[p.status];
            const prob = Math.min(100, Math.max(0, Number(p.probability ?? 0)));
            return (
              <div
                key={p.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200/70 bg-white p-3 transition-colors hover:bg-blue-50/40 sm:p-4 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800 dark:bg-slate-900/40 dark:hover:bg-slate-800/40"
              >
                {/* Left: identity + meta */}
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarColors[p.id % avatarColors.length]}`}
                  >
                    {getInitials(p.title)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800 dark:text-white">{p.title}</p>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusTone[p.status] ?? "bg-gray-100 text-gray-700"}`}>
                        {StatusIcon && <StatusIcon className="h-3 w-3" />}
                        {p.status}
                      </span>
                      <ApprovalBadge status={p.approval_status} />
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {p.version ?? "v1"}
                      </span>
                      {p.lead_id && (
                        <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">
                          Linked to lead
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{p.description || "No description"}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                      <span className="text-sm font-semibold text-slate-800 dark:text-white">
                        {p.currency} {Number(p.amount).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                          <span className="block h-full rounded-full bg-teal-500" style={{ width: `${prob}%` }} />
                        </span>
                        {p.probability}% likely
                      </span>
                      <span>Close {p.close_date ? new Date(p.close_date).toLocaleDateString() : "—"}</span>
                      <span>Owner {p.owner || "Unassigned"}</span>
                    </div>
                  </div>
                </div>

                {/* Right: actions */}
                <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
                  {p.status === "draft" && perms.canEdit("proposals") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/20"
                      onClick={() => sendProposal.mutate(p.id)}
                      disabled={sendProposal.isPending}
                    >
                      <Send className="mr-1.5 h-3.5 w-3.5" /> Send
                    </Button>
                  )}
                  {p.status === "sent" && perms.canEdit("proposals") && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                        onClick={() => acceptProposal.mutate(p.id)}
                        disabled={acceptProposal.isPending}
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Accepted
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
                        onClick={() => declineProposal.mutate(p.id)}
                        disabled={declineProposal.isPending}
                      >
                        <XCircle className="mr-1.5 h-3.5 w-3.5" /> Declined
                      </Button>
                    </>
                  )}
                  {perms.canEdit("proposals") && (p.approval_status ?? "pending") !== "pending" && !canConvert(p) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20"
                      onClick={() => requestApproval.mutate(p)}
                      disabled={requestApproval.isPending}
                    >
                      <Clock className="mr-1.5 h-3.5 w-3.5" /> Request approval
                    </Button>
                  )}
                  {isAdmin && p.approval_status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        className="h-8 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                        onClick={() => approveProposal.mutate(p.id)}
                        disabled={approveProposal.isPending}
                      >
                        <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
                        onClick={() => rejectProposal.mutate(p.id)}
                        disabled={rejectProposal.isPending}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {perms.canEdit("proposals") && canConvert(p) && p.lead_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
                      onClick={() => openConvert(p)}
                    >
                      <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
                      {p.pipeline_stage === "converted" ? "Update deal" : "Convert to deal"}
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 dark:hover:bg-blue-500/30"
                    onClick={() => setViewing(p)}
                    title="View"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {perms.canEdit("proposals") && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      onClick={() => openEdit(p)}
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {perms.canDelete("proposals") && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25"
                      onClick={() => del.mutate(p.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ───────── Create / edit ───────── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className={`max-w-2xl ${DIALOG}`}>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit proposal" : "New proposal"}</DialogTitle>
            <DialogDescription>Link the proposal to a qualified lead and track its forecast.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5"><Label className={FIELD_LABEL}>Title *</Label>
              <Input className={FIELD} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="CRM implementation for Acme" />
            </div>
            <div className="space-y-1.5"><Label className={FIELD_LABEL}>Description</Label>
              <Textarea className="rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-900/70" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <div className="space-y-1.5"><Label className={FIELD_LABEL}>Template</Label>
              <Select value={form.template_id} onValueChange={(v) => setForm({ ...form, template_id: v })}>
                <SelectTrigger className={FIELD}><SelectValue placeholder="No template" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="none">No template</SelectItem>
                  {(templates ?? []).map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label className={FIELD_LABEL}>Related lead</Label>
                <Select value={form.lead_id} onValueChange={(v) => setForm({ ...form, lead_id: v })}>
                  <SelectTrigger className={FIELD}><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="none">None</SelectItem>
                    {relatedLeadOptions.length === 0 && (
                      <SelectItem value="__no_qualified__" disabled>
                        No qualified leads yet
                      </SelectItem>
                    )}
                    {relatedLeadOptions.map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>{leadLabel(l)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Only leads with status "Qualified" are listed.</p>
              </div>
              <div className="space-y-1.5"><Label className={FIELD_LABEL}>Owner</Label>
                <Input
                  className={FIELD}
                  disabled
                  value={
                    form.lead_id === "none"
                      ? "Unassigned"
                      : (() => {
                          const l = (leads ?? []).find((x) => String(x.id) === form.lead_id);
                          return l ? leadLabel(l) : "Unassigned";
                        })()
                  }
                />
                <p className="text-[11px] text-muted-foreground">Set automatically from the linked lead's company.</p>
              </div>
            </div>

            <div className={`grid grid-cols-2 gap-3 ${editing ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
              {editing && (
                <div className="col-span-2 space-y-1.5 sm:col-span-1"><Label className={FIELD_LABEL}>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                    <SelectTrigger className={FIELD}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5"><Label className={FIELD_LABEL}>Amount</Label>
                <Input className={FIELD} type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-1.5"><Label className={FIELD_LABEL}>Currency</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger className={FIELD}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className={FIELD_LABEL}>Probability (%)</Label>
                <Input className={FIELD} type="number" min={0} max={100} value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className={FIELD_LABEL}>Close date</Label>
                <DatePicker
                  value={form.close_date}
                  onChange={(val) => setForm({ ...form, close_date: val })}
                  placeholder="Select close date"
                />
              </div>
              <div className="space-y-1.5">
                <Label className={FIELD_LABEL}>Valid until</Label>
                <DatePicker
                  value={form.valid_until}
                  onChange={(val) => setForm({ ...form, valid_until: val })}
                  placeholder="Select expiry date"
                />
              </div>
            </div>

            <Separator />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-white">Proposal document</p>
                <p className="text-xs text-muted-foreground">Write the full document below.</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-800 dark:border-violet-500/40 dark:text-violet-300 dark:hover:bg-violet-500/10"
                onClick={handleGenerateWithAI}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Generate with AI
              </Button>
            </div>
            <Textarea
              className="rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-900/70"
              rows={8}
              value={form.terms}
              onChange={(e) => setForm({ ...form, terms: e.target.value })}
              placeholder="Proposal content — write your own."
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-lg" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button className="rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create proposal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───────── Template preview ───────── */}
      <Dialog open={!!previewing} onOpenChange={(o) => !o && closePreview()}>
        <DialogContent className={`max-w-2xl ${DIALOG}`}>
          <DialogHeader>
            <DialogTitle>{previewing?.title}</DialogTitle>
            <DialogDescription>
              Preview the rendered document. Add a client name to personalise it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label className={FIELD_LABEL}>Client name (optional)</Label>
                <Input
                  className={FIELD}
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Acme Corp"
                />
              </div>
              <Button
                variant="outline"
                className="h-9 rounded-lg border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-800 dark:border-violet-500/40 dark:text-violet-300 dark:hover:bg-violet-500/10"
                disabled={!previewing || previewTemplate.isPending}
                onClick={() =>
                  previewing && previewTemplate.mutate({ id: previewing.id, client: clientName })
                }
              >
                {previewTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Render
              </Button>
            </div>

            {previewTemplate.isPending && !rendered && <Skeleton className="h-48 w-full rounded-xl" />}

            {rendered && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <DetailTile label="Amount" tone="blue">
                    {rendered.currency ?? ""} {Number(rendered.amount ?? 0).toLocaleString()}
                  </DetailTile>
                  <DetailTile label="Category" tone="violet">{previewing?.category || "—"}</DetailTile>
                </div>
                {rendered.description && (
                  <div>
                    <p className={`mb-1 ${FIELD_LABEL}`}>Description</p>
                    <p>{rendered.description}</p>
                  </div>
                )}
                <div>
                  <p className={`mb-1 ${FIELD_LABEL}`}>Document</p>
                  <div className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs dark:border-slate-700 dark:bg-slate-900/60">
                    {rendered.document_content || rendered.terms || "This template has no document content."}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-lg" onClick={closePreview}>Close</Button>
            {perms.canCreate("proposals") && previewing && (
              <>
                <Button
                  variant="outline"
                  className="rounded-lg"
                  disabled={createFromTemplate.isPending}
                  onClick={() => createFromTemplate.mutate(previewing.id)}
                >
                  {createFromTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create draft now
                </Button>
                <Button
                  className="rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  disabled={!rendered}
                  onClick={() => {
                    if (!rendered) return;
                    fillFormFromRendered(rendered);
                    closePreview();
                  }}
                >
                  Use in form
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───────── View ───────── */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className={`max-w-2xl ${DIALOG}`}>
          <DialogHeader>
            <DialogTitle>{viewing?.title}</DialogTitle>
            <DialogDescription className="capitalize">{viewing?.status} · owner {viewing?.owner || "Unassigned"}</DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusTone[viewing.status] ?? "bg-gray-100 text-gray-700"}`}>
                  {(() => {
                    const I = statusIcons[viewing.status];
                    return I ? <I className="h-3 w-3" /> : null;
                  })()}
                  {viewing.status}
                </span>
                <ApprovalBadge status={viewing.approval_status} />
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {viewing.version ?? "v1"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <DetailTile label="Amount" tone="blue">{viewing.currency} {Number(viewing.amount).toLocaleString()}</DetailTile>
                <DetailTile label="Probability" tone="teal">{viewing.probability}%</DetailTile>
                <DetailTile label="Close date" tone="violet">{viewing.close_date ? new Date(viewing.close_date).toLocaleDateString() : "—"}</DetailTile>
                <DetailTile label="Valid until" tone="amber">{viewing.valid_until ? new Date(viewing.valid_until).toLocaleDateString() : "—"}</DetailTile>
                <DetailTile label="Created" tone="slate">{new Date(viewing.created_at).toLocaleDateString()}</DetailTile>
                <DetailTile label="Sent" tone="sky">{viewing.sent_at ? new Date(viewing.sent_at).toLocaleDateString() : "—"}</DetailTile>
                <DetailTile label="Accepted" tone="green">{viewing.accepted_at ? new Date(viewing.accepted_at).toLocaleDateString() : "—"}</DetailTile>
                <DetailTile label="Declined" tone="rose">{viewing.declined_at ? new Date(viewing.declined_at).toLocaleDateString() : "—"}</DetailTile>
              </div>

              {viewing.description && (
                <div>
                  <p className={`mb-1 ${FIELD_LABEL}`}>Description</p>
                  <p>{viewing.description}</p>
                </div>
              )}
              {viewing.terms && (
                <div>
                  <p className={`mb-1 ${FIELD_LABEL}`}>Document</p>
                  <div className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs dark:border-slate-700 dark:bg-slate-900/60">
                    {viewing.terms}
                  </div>
                </div>
              )}

              <SectionBox title="Approval" icon={ShieldCheck} tone="emerald">
                <p className="text-xs">
                  {viewing.approval_status === "pending" && "Waiting on admin review."}
                  {viewing.approval_status === "approved" && "Approved."}
                  {viewing.approval_status === "rejected" && "Rejected."}
                  {!viewing.approval_status && "No approval requested yet."}
                </p>
                {!isAdmin && (
                  <p className="mt-2 text-[11px] text-muted-foreground">Only Admins can approve or reject a proposal.</p>
                )}
              </SectionBox>

              {/* ⭐ Activity timeline */}
              <SectionBox title="Activity timeline" icon={Clock} tone="violet">
                <ProposalTimeline proposalIds={[String(viewing.id)]} />
              </SectionBox>

              {/* ⭐ Approval history (only if approved/rejected) */}
              {viewing.approval_status && viewing.approval_status !== "pending" && (
                <SectionBox title="Approval history" icon={ShieldCheck} tone="amber">
                  <ApprovalHistory proposalId={String(viewing.id)} />
                </SectionBox>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            {viewing && (
              <Button variant="outline" className="rounded-lg" onClick={() => download(viewing)}>
                <Download className="mr-2 h-4 w-4" /> Download
              </Button>
            )}
            {viewing && perms.canEdit("proposals") && (
              <Button
                className="rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => { const p = viewing; setViewing(null); openEdit(p); }}
              >
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───────── Convert to deal ───────── */}
      <Dialog open={!!converting} onOpenChange={(o) => !o && setConverting(null)}>
        <DialogContent className={`max-w-md ${DIALOG}`}>
          <DialogHeader>
            <DialogTitle>{converting?.pipeline_stage === "converted" ? "Update pipeline deal" : "Convert to pipeline deal"}</DialogTitle>
            <DialogDescription>
              Pushes this proposal's outcome onto its linked lead — updates the lead's pipeline stage and value.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label className={FIELD_LABEL}>Pipeline stage</Label>
              <Select value={convertForm.stage} onValueChange={(v) => setConvertForm({ ...convertForm, stage: v as LeadStatus })}>
                <SelectTrigger className={FIELD}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEAL_STAGES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className={FIELD_LABEL}>Deal value</Label>
              <Input className={FIELD} type="number" min={0} value={convertForm.value} onChange={(e) => setConvertForm({ ...convertForm, value: e.target.value })} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-lg" onClick={() => setConverting(null)}>Cancel</Button>
            <Button className="rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={() => convert.mutate()} disabled={convert.isPending}>
              {convert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {converting?.pipeline_stage === "converted" ? "Update deal" : "Update lead"}
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
  green: {
    card: "from-green-50 to-white border-green-100 dark:from-emerald-950 dark:to-slate-950 dark:border-emerald-500/40",
    icon: "bg-green-100 text-green-600 dark:bg-emerald-500/25 dark:text-emerald-300",
  },
};

function StatCard({
  label, value, icon: Icon, tone,
}: {
  label: string;
  value: string;
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
        <div className="truncate text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">{value}</div>
      </div>
    </div>
  );
}

const tileTones: Record<string, string> = {
  blue: "border-blue-100 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10",
  violet: "border-violet-100 bg-violet-50 dark:border-violet-500/30 dark:bg-violet-500/10",
  teal: "border-teal-100 bg-teal-50 dark:border-teal-500/30 dark:bg-teal-500/10",
  amber: "border-amber-100 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10",
  green: "border-emerald-100 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10",
  rose: "border-rose-100 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10",
  sky: "border-sky-100 bg-sky-50 dark:border-sky-500/30 dark:bg-sky-500/10",
  slate: "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60",
};

function DetailTile({
  label, tone, children,
}: {
  label: string;
  tone: keyof typeof tileTones;
  children: React.ReactNode;
}) {
  return (
    <div className={`min-w-0 rounded-xl border p-3 ${tileTones[tone]}`}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">{children}</p>
    </div>
  );
}

const sectionTones: Record<string, { box: string; chip: string }> = {
  emerald: {
    box: "border-emerald-100 dark:border-emerald-500/25",
    chip: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300",
  },
  violet: {
    box: "border-violet-100 dark:border-violet-500/25",
    chip: "bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300",
  },
  amber: {
    box: "border-amber-100 dark:border-amber-500/25",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  },
};

function SectionBox({
  title, icon: Icon, tone, children,
}: {
  title: string;
  icon: IconType;
  tone: keyof typeof sectionTones;
  children: React.ReactNode;
}) {
  const t = sectionTones[tone];
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900/60 ${t.box}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${t.chip}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}