import { defineRoute } from "@/lib/router-compat";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-data-client";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, apiUpload, apiDownload } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Users, RefreshCw, Plus, Trash2, Upload, Download,
  Pencil, UserPlus, ChevronDown, ListChecks, Star,
  CalendarClock, Filter, X, Search, Building2, Mail, Phone, User,
  ArrowUp, ArrowDown, Minus, Flame, Sparkles, PhoneCall, BadgeCheck,
  FileText, Trophy, XCircle, MessageSquare, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, SlidersHorizontal, CalendarDays, Flag, CircleDot,
  Eye, Check,
} from "lucide-react";
import { toast } from "sonner";
import { Lead360Dialog } from "@/components/leads/Lead360Dialog";

const VALID_STATUSES = ["new", "contacted", "qualified", "proposal_sent", "won", "lost"];

const PRIORITY_TAG = "priority";
const MANAGER_ROLES = ["manager", "sales_manager"];
const EXECUTIVE_ROLES = ["executive", "sales_executive"];
const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal_sent", label: "Proposal Sent" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

const ACTIVITY_TYPES = [
  { value: "call", label: "Call" },
  { value: "meeting", label: "Meeting" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "demo", label: "Demo" },
  { value: "site_visit", label: "Site Visit" },
  { value: "follow_up", label: "Follow-up" },
  { value: "other", label: "Other" },
];

export const Route = defineRoute("/_authenticated/leads")({
  head: () => ({ meta: [{ title: "Leads — DigiCRM AI" }] }),
  validateSearch: (search: Record<string, unknown>): { status?: string } => ({
    status:
      typeof search.status === "string" && VALID_STATUSES.includes(search.status)
        ? search.status
        : undefined,
  }),
  component: LeadsPage,
});

interface Lead {
  id: number;
  tenant_id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  company_name?: string | null;
  designation: string | null;
  message: string | null;
  source: string;
  status: string;
  priority: string;
  value: string | number;
  estimated_value: string | number;
  assigned_to: number | null;
  contact_id?: number | null;
  industry?: string | null;
  city?: string | null;
  country?: string | null;
  score: number;
  custom_fields: Record<string, any>;
  created_at: string;
  updated_at: string;
}

type LeadsResponse = Lead[];

interface Tenant {
  id: number;
  name?: string;
  company_name?: string;
}

interface ContactLite {
  id: number;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  designation: string | null;
  company_id?: number | null;
}

interface ContactFull extends ContactLite {
  tags?: string[];
}

interface CompanyLite {
  id: number;
  name: string;
}

interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  proposal_sent?: number;
  won: number;
  lost: number;
}

interface CreateLeadPayload {
  name: string;
  email: string;
  phone: string;
  company: string;
  industry: string;
  city: string;
  country: string;
  designation: string;
  message: string;
  source: string;
  priority: string;
  value: string;
  assigned_to?: string;
}

interface UpdateLeadPayload {
  name: string;
  email: string;
  phone: string;
  company: string;
  industry: string;
  city: string;
  country: string;
  designation: string;
  message: string;
  status: string;
  priority: string;
  value: string;
}

interface ImportLeadsResult {
  total_rows: number;
  imported: number;
  failed: number;
  errors: string[];
}

interface ScheduleForm {
  activity_type: string;
  title: string;
  notes: string;
  scheduled_at: string;
  duration_minutes: string;
  reminder_minutes_before: string;
  priority: string;
}

const PAGE_SIZE = 20;
const FETCH_BATCH = 100;
const FETCH_MAX_BATCHES = 50;

// ════════════════════════════════════════════════════════════
// STATUS COLORS — 6 visibly distinct hues
// new       → sky blue
// contacted → amber/orange
// qualified → fuchsia/magenta
// proposal  → indigo/violet
// won       → emerald/green
// lost      → rose/red
// ════════════════════════════════════════════════════════════
const statusColors: Record<string, string> = {
  new:
    "bg-sky-100 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30",
  contacted:
    "bg-amber-100 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  qualified:
    "bg-fuchsia-100 text-fuchsia-700 ring-1 ring-fuchsia-200 dark:bg-fuchsia-500/15 dark:text-fuchsia-300 dark:ring-fuchsia-500/30",
  proposal_sent:
    "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30",
  won:
    "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  lost:
    "bg-rose-100 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
};

// ════════════════════════════════════════════════════════════
// PRIORITY COLORS — 4 distinctly different from status palette
// low    → slate/gray
// medium → teal
// high   → orange (different from status "contacted" amber by
//          using solid orange tones + flame icon)
// urgent → red (distinct from "lost" rose by using solid red)
// ════════════════════════════════════════════════════════════
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

type IconType = React.ComponentType<{ className?: string }>;

const statusIcons: Record<string, IconType> = {
  new: Sparkles,
  contacted: PhoneCall,
  qualified: BadgeCheck,
  proposal_sent: FileText,
  won: Trophy,
  lost: XCircle,
};

const priorityIcons: Record<string, IconType> = {
  low: ArrowDown,
  medium: Minus,
  high: ArrowUp,
  urgent: Flame,
};

const sourceColors: Record<string, string> = {
  referral: "bg-sky-50 text-sky-600 dark:bg-violet-500/20 dark:text-violet-300",
  webhook: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300",
  manual: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300",
  website: "bg-violet-50 text-violet-600 dark:bg-blue-500/20 dark:text-blue-300",
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

function getInitials(name: string | null | undefined, fallback?: string | null): string {
  const src = (name || fallback || "?").trim();
  const parts = src.split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const emptyForm: CreateLeadPayload = {
  name: "", email: "", phone: "", company: "",
  industry: "", city: "", country: "", designation: "",
  message: "", source: "manual", priority: "medium", value: "",
  assigned_to: "",
};

const emptyScheduleForm: ScheduleForm = {
  activity_type: "call",
  title: "",
  notes: "",
  scheduled_at: "",
  duration_minutes: "30",
  reminder_minutes_before: "15",
  priority: "medium",
};

function getLeadAmount(lead: Lead): number {
  const est = Number(lead.estimated_value);
  if (Number.isFinite(est) && est > 0) return est;
  const val = Number(lead.value);
  if (Number.isFinite(val) && val > 0) return val;
  return 0;
}

function resolveLead(lead: Lead): Lead {
  const cf = lead.custom_fields ?? {};
  return {
    ...lead,
    company: lead.company || lead.company_name || cf.company || null,
    designation: lead.designation || cf.designation || null,
    custom_fields: cf,
  };
}

function getExtra(lead: Lead, key: "industry" | "city" | "country"): string {
  const v = lead[key] ?? lead.custom_fields?.[key];
  return typeof v === "string" ? v : "";
}

async function fetchLeadDetail(lead: Lead): Promise<Lead> {
  let full: Lead = lead;
  try {
    const detail = await apiFetch<Lead>(`/api/v1/leads/${lead.id}`);
    full = { ...lead, ...detail };
  } catch {}
  full = resolveLead(full);
  if (!full.designation && full.contact_id) {
    try {
      const c = await apiFetch<ContactLite>(`/api/v1/contacts/${full.contact_id}`);
      if (c?.designation) full = { ...full, designation: c.designation };
    } catch {}
  }
  return full;
}

function toUpdatePayload(input: Lead): UpdateLeadPayload {
  const lead = resolveLead(input);
  const amount = getLeadAmount(lead);
  return {
    name: lead.name ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    company: lead.company ?? "",
    industry: getExtra(lead, "industry"),
    city: getExtra(lead, "city"),
    country: getExtra(lead, "country"),
    designation: lead.designation ?? "",
    message: lead.message ?? "",
    status: lead.status ?? "new",
    priority: lead.priority ?? "medium",
    value: amount > 0 ? String(amount) : "",
  };
}

const sanitizeNumericInput = (raw: string) => {
  let cleaned = raw.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
  }
  return cleaned;
};

const sanitizeIntInput = (raw: string) => raw.replace(/[^0-9]/g, "");

const toNumber = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const tenantLabel = (t: Tenant) =>
  t.name ?? t.company_name ?? `Tenant #${t.id}`;

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
});

function getUserDisplayName(
  userId: number | null | undefined,
  users: any[]
): string | null {
  if (!userId) return null;
  const u = users.find((x: any) => String(x.id) === String(userId));
  if (!u) return null;
  return u.full_name || u.name || u.email || null;
}

async function mirrorLeadToCompany(
  lead: Lead,
  extras?: { industry?: string; city?: string; country?: string }
): Promise<number | null> {
  const name = (lead.company || lead.company_name || "").trim();
  if (!name) return null;
  let existing: CompanyLite[] = [];
  try {
    const res = await apiFetch<CompanyLite[] | { items: CompanyLite[] }>("/api/v1/companies");
    existing = Array.isArray(res) ? res : res.items ?? [];
  } catch { existing = []; }
  const match = existing.find((c) => c.name?.trim().toLowerCase() === name.toLowerCase());
  if (match) return match.id;
  const payload: Record<string, unknown> = { name, tags: [], status: "active" };
  if (lead.message?.trim()) payload.notes = lead.message.trim();
  if (extras?.industry?.trim()) payload.industry = extras.industry.trim();
  const location = [extras?.city?.trim(), extras?.country?.trim()].filter(Boolean).join(", ");
  if (location) payload.location = location;
  const created = await apiFetch<CompanyLite>("/api/v1/companies", {
    method: "POST", body: JSON.stringify(payload),
  });
  return created?.id ?? null;
}

async function mirrorLeadToContact(lead: Lead, companyId?: number | null): Promise<void> {
  const email = lead.email?.trim() || null;
  const phone = lead.phone?.trim() || null;
  if (!email) return;
  if (lead.contact_id) return;
  let existing: ContactLite[] = [];
  try {
    const res = await apiFetch<ContactLite[] | { items: ContactLite[] }>(
      `/api/v1/contacts?search=${encodeURIComponent(email)}&limit=50`
    );
    existing = Array.isArray(res) ? res : res.items ?? [];
  } catch { existing = []; }
  const match = existing.find((c) => c.email?.toLowerCase() === email.toLowerCase());
  if (match) {
    if (companyId && !match.company_id) {
      await apiFetch(`/api/v1/contacts/${match.id}`, {
        method: "PUT", body: JSON.stringify({ company_id: companyId }),
      });
    }
    return;
  }
  const fullName = (lead.name || "").trim();
  const [firstName, ...rest] = fullName.split(/\s+/);
  const lastName = rest.join(" ") || null;
  const payload: Record<string, unknown> = {
    first_name: firstName || fullName || email.split("@")[0] || "Unknown",
    email, tags: [], status: "active",
  };
  if (lastName) payload.last_name = lastName;
  if (phone) payload.phone = phone;
  if (lead.designation?.trim()) payload.designation = lead.designation.trim();
  if (lead.message?.trim()) payload.notes = lead.message.trim();
  if (companyId) payload.company_id = companyId;
  await apiFetch("/api/v1/contacts", { method: "POST", body: JSON.stringify(payload) });
}

async function findContactForLead(lead: Lead): Promise<ContactFull | null> {
  if (lead.contact_id) {
    try {
      return await apiFetch<ContactFull>(`/api/v1/contacts/${lead.contact_id}`);
    } catch {}
  }
  const email = lead.email?.trim();
  if (!email) return null;
  try {
    const res = await apiFetch<ContactFull[] | { items: ContactFull[] }>(
      `/api/v1/contacts?search=${encodeURIComponent(email)}&limit=50`
    );
    const list = Array.isArray(res) ? res : res.items ?? [];
    return list.find((c) => c.email?.toLowerCase() === email.toLowerCase()) ?? null;
  } catch {
    return null;
  }
}

async function setLeadPriority(lead: Lead, on: boolean): Promise<void> {
  const full = await fetchLeadDetail(lead);
  let contact = await findContactForLead(full);
  if (!contact && on) {
    let companyId: number | null = null;
    try { companyId = await mirrorLeadToCompany(full); } catch {}
    await mirrorLeadToContact(full, companyId);
    contact = await findContactForLead({ ...full, contact_id: null });
  }
  if (!contact) {
    throw new Error(`No contact found for lead #${lead.id} (an email is required)`);
  }
  const tags = (contact.tags ?? []).filter((t) => t !== PRIORITY_TAG);
  if (on) tags.push(PRIORITY_TAG);
  await apiFetch(`/api/v1/contacts/${contact.id}`, {
    method: "PUT",
    body: JSON.stringify({ tags }),
  });
  await apiFetch(`/api/v1/leads/${lead.id}`, {
    method: "PUT",
    body: JSON.stringify({
      custom_fields: { ...(full.custom_fields ?? {}), on_priority: on },
    }),
  });
}

function LeadsPage() {
  const qc = useQueryClient();
  const { hasRole, loading: authLoading, user } = useAuth();
  const { role } = usePermissions();
  const isSuperadmin = hasRole("super_admin");
  const canWrite = true;
  const isExecutive = role === "sales_executive" || role === "executive";
  const isAdminOrManager = role === "admin" || role === "manager" || role === "sales_manager" || isSuperadmin;
  const currentUserId = user?.id ? Number(user.id) : null;

  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const { status: urlStatus } = Route.useSearch();
  const [statusFilter, setStatusFilter] = useState(urlStatus ?? "all");
  useEffect(() => {
    setStatusFilter(urlStatus ?? "all");
    setPage(0);
  }, [urlStatus]);
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [tenantFilter, setTenantFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateLeadPayload>(emptyForm);
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editForm, setEditForm] = useState<UpdateLeadPayload | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [view360Id, setView360Id] = useState<number | null>(null);

  const [scheduleFor, setScheduleFor] = useState<Lead | null>(null);
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>(emptyScheduleForm);
  const [scheduleFile, setScheduleFile] = useState<File | null>(null);
  const scheduleFileRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importResultOpen, setImportResultOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportLeadsResult | null>(null);

  const { data: leads, isLoading, isFetching, error } = useQuery({
    queryKey: ["leads", isSuperadmin, search, statusFilter, tenantFilter],
    enabled: !authLoading,
    queryFn: async () => {
      const base = isSuperadmin ? "/api/v1/superadmin/leads" : "/api/v1/leads";
      const all: Lead[] = [];
      for (let i = 0; i < FETCH_MAX_BATCHES; i++) {
        const params = new URLSearchParams();
        if (search) params.append("search", search);
        if (statusFilter !== "all") params.append("status", statusFilter);
        if (isSuperadmin && tenantFilter !== "all") params.append("tenant_id", tenantFilter);
        params.append("limit", String(FETCH_BATCH));
        params.append("offset", String(i * FETCH_BATCH));
        const batch = await apiFetch<LeadsResponse>(`${base}?${params.toString()}`);
        const rows = Array.isArray(batch) ? batch : [];
        all.push(...rows);
        if (rows.length < FETCH_BATCH) break;
      }
      return all;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["leads", "stats"],
    queryFn: () => apiFetch<LeadStats>("/api/v1/leads/stats"),
    enabled: !authLoading && !isSuperadmin,
  });

  const { data: tenants } = useQuery({
    queryKey: ["superadmin", "clients"],
    queryFn: async () => {
      const res = await apiFetch<Tenant[] | { items: Tenant[] }>("/api/v1/superadmin/clients");
      return Array.isArray(res) ? res : res.items ?? [];
    },
    enabled: isSuperadmin,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users-list"],
    queryFn: async () => {
      const res = await apiFetch<any>("/api/v1/users/assignees");
      return Array.isArray(res) ? res : res?.data ?? res?.items ?? [];
    },
  });

  const isAdminRole = role === "admin";
  const isManagerRole = role === "manager" || role === "sales_manager";
  const canBulk = !isSuperadmin && (isAdminOrManager || isExecutive);
  const canAssign = !isSuperadmin && (isAdminRole || isManagerRole);
  const canQuickAct = !isSuperadmin;

  const assignableUsers = useMemo(() => {
    const allowed = isAdminRole
      ? [...MANAGER_ROLES, ...EXECUTIVE_ROLES]
      : isManagerRole
      ? EXECUTIVE_ROLES
      : [];
    return (users as any[]).filter((u) => allowed.includes(String(u.role)));
  }, [users, isAdminRole, isManagerRole]);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const invalidateLeadRelated = () => {
    qc.invalidateQueries({ queryKey: ["leads"] });
    qc.invalidateQueries({ queryKey: ["contacts"] });
    qc.invalidateQueries({ queryKey: ["companies"] });
    qc.invalidateQueries({ queryKey: ["pipeline-deals"] });
    qc.invalidateQueries({ queryKey: ["kpi"] });
  };

  const bulkAction = useMutation({
    mutationFn: async (args: {
      kind: "status" | "assign" | "priority";
      leads: Lead[];
      value: any;
    }) => {
      const results = await Promise.allSettled(
        args.leads.map((l) => {
          if (args.kind === "status")
            return apiFetch(`/api/v1/leads/${l.id}`, {
              method: "PUT", body: JSON.stringify({ status: args.value }),
            });
          if (args.kind === "assign")
            return apiFetch(`/api/v1/leads/${l.id}`, {
              method: "PUT", body: JSON.stringify({ assigned_to: args.value }),
            });
          return setLeadPriority(l, Boolean(args.value));
        })
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      return { ok, failed: results.length - ok };
    },
    onSuccess: ({ ok, failed }) => {
      if (failed > 0) toast.warning(`${ok} lead(s) updated, ${failed} failed`);
      else toast.success(`${ok} lead(s) updated`);
      setSelectedIds(new Set());
      invalidateLeadRelated();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Bulk action failed"),
  });

  const togglePriority = useMutation({
    mutationFn: ({ lead, on }: { lead: Lead; on: boolean }) => setLeadPriority(lead, on),
    onSuccess: (_d, { on }) => {
      toast.success(on ? "Marked as priority" : "Priority removed");
      invalidateLeadRelated();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to update priority"),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch(`/api/v1/leads/${id}`, {
        method: "PUT", body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      toast.success("Status updated");
      invalidateLeadRelated();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to update status"),
  });

  const createSchedule = useMutation({
    mutationFn: async ({ lead, form, file }: { lead: Lead; form: ScheduleForm; file: File | null }) => {
      let attachment_url: string | undefined;
      let attachment_name: string | undefined;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const up = await apiUpload<{ url: string; name: string }>(
          "/api/v1/lead-schedules/upload", fd
        );
        attachment_url = up.url;
        attachment_name = up.name;
      }
      const typeLabel =
        ACTIVITY_TYPES.find((t) => t.value === form.activity_type)?.label ?? form.activity_type;
      return apiFetch("/api/v1/lead-schedules", {
        method: "POST",
        body: JSON.stringify({
          lead_id: lead.id,
          activity_type: form.activity_type,
          activity_label: typeLabel,
          title: form.title.trim(),
          notes: form.notes.trim() || null,
          attachment_url,
          attachment_name,
          scheduled_at: new Date(form.scheduled_at).toISOString(),
          duration_minutes: toNumber(form.duration_minutes) || 30,
          reminder_minutes_before: toNumber(form.reminder_minutes_before),
          priority: form.priority,
        }),
      });
    },
    onSuccess: () => {
      toast.success("Activity scheduled");
      closeScheduleDialog();
      qc.invalidateQueries({ queryKey: ["lead-schedules"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to schedule activity"),
  });

  const openScheduleDialog = (lead: Lead) => {
    setScheduleFor(lead);
    setScheduleForm({ ...emptyScheduleForm, title: "" });
    setScheduleFile(null);
  };

  const closeScheduleDialog = () => {
    setScheduleFor(null);
    setScheduleForm(emptyScheduleForm);
    setScheduleFile(null);
    if (scheduleFileRef.current) scheduleFileRef.current.value = "";
  };

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleFor) return;
    if (!scheduleForm.title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    if (!scheduleForm.scheduled_at) {
      toast.error("Please choose a date and time");
      return;
    }
    createSchedule.mutate({ lead: scheduleFor, form: scheduleForm, file: scheduleFile });
  };

  const createLead = useMutation({
    mutationFn: async (payload: CreateLeadPayload) => {
      const numericValue = toNumber(payload.value);
      const created = await apiFetch<Lead>("/api/v1/leads", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          estimated_value: numericValue,
          assigned_to: payload.assigned_to ? Number(payload.assigned_to) : null,
          custom_fields: {
            company: payload.company.trim(),
            designation: payload.designation.trim(),
            industry: payload.industry.trim(),
            city: payload.city.trim(),
            country: payload.country.trim(),
          },
        }),
      });
      const newLead: Lead = {
        ...created,
        name: created.name || payload.name || null,
        email: created.email || payload.email || null,
        phone: created.phone || payload.phone || null,
        company: created.company || payload.company || null,
        designation: created.designation || payload.designation || null,
        message: created.message || payload.message || null,
      };
      let companyId: number | null = null;
      try {
        companyId = await mirrorLeadToCompany(newLead, {
          industry: payload.industry, city: payload.city, country: payload.country,
        });
      } catch (err) { console.error("[leads] mirror to companies failed:", err); }
      try { await mirrorLeadToContact(newLead, companyId); }
      catch (err) { console.error("[leads] mirror to contacts failed:", err); }
      return newLead;
    },
    onSuccess: () => {
      toast.success("Lead created");
      setForm(emptyForm);
      setCreateOpen(false);
      invalidateLeadRelated();
      qc.invalidateQueries({ queryKey: ["companies-lite"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create lead");
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() && !form.email.trim() && !form.phone.trim()) {
      toast.error("Add at least a name, email, or phone");
      return;
    }
    if (!form.email.trim()) {
      toast.warning("No email provided — a matching contact will not be created automatically.");
    }
    createLead.mutate(form);
  };

  const updateLead = useMutation({
    mutationFn: async ({ id, payload, customFields }: {
      id: number;
      payload: UpdateLeadPayload;
      customFields?: Record<string, any>;
    }) => {
      const numericValue = toNumber(payload.value);
      const saved = await apiFetch<Lead>(`/api/v1/leads/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...payload,
          estimated_value: numericValue,
          custom_fields: {
            ...(customFields ?? {}),
            company: payload.company.trim(),
            designation: payload.designation.trim(),
            industry: payload.industry.trim(),
            city: payload.city.trim(),
            country: payload.country.trim(),
          },
        }),
      });
      const updated: Lead = {
        ...saved,
        name: saved.name || payload.name || null,
        email: saved.email || payload.email || null,
        phone: saved.phone || payload.phone || null,
        company: saved.company || payload.company || null,
        designation: saved.designation || payload.designation || null,
        message: saved.message || payload.message || null,
      };
      let companyId: number | null = null;
      try {
        companyId = await mirrorLeadToCompany(updated, {
          industry: payload.industry, city: payload.city, country: payload.country,
        });
      } catch (err) { console.error("[leads] sync company failed:", err); }
      try {
        if (updated.contact_id) {
          const contactPayload: Record<string, unknown> = {};
          if (updated.name) {
            const [first, ...rest] = updated.name.trim().split(/\s+/);
            contactPayload.first_name = first || updated.name;
            contactPayload.last_name = rest.join(" ") || null;
          }
          if (updated.email?.trim()) contactPayload.email = updated.email.trim();
          if (updated.phone?.trim()) contactPayload.phone = updated.phone.trim();
          if (updated.designation?.trim()) contactPayload.designation = updated.designation.trim();
          if (updated.message?.trim()) contactPayload.notes = updated.message.trim();
          if (companyId) contactPayload.company_id = companyId;
          await apiFetch(`/api/v1/contacts/${updated.contact_id}`, {
            method: "PUT", body: JSON.stringify(contactPayload),
          });
        } else {
          await mirrorLeadToContact(updated, companyId);
        }
      } catch (err) { console.error("[leads] sync contact failed:", err); }
      return updated;
    },
    onSuccess: () => {
      toast.success("Lead updated");
      setEditingLead(null);
      setEditForm(null);
      invalidateLeadRelated();
      qc.invalidateQueries({ queryKey: ["companies-lite"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update lead");
    },
  });

  const deleteLead = useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ message: string }>(`/api/v1/leads/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Lead deleted");
      setDeleteConfirmOpen(false);
      setEditingLead(null);
      setEditForm(null);
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["pipeline-deals"] });
      qc.invalidateQueries({ queryKey: ["kpi"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete lead");
    },
  });

  const assignLead = useMutation({
    mutationFn: ({ id, assigned_to }: { id: number; assigned_to: number | null }) =>
      apiFetch(`/api/v1/leads/${id}`, {
        method: "PUT",
        body: JSON.stringify({ assigned_to }),
      }),
    onSuccess: () => {
      toast.success("Lead assigned");
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to assign lead"),
  });

  const importLeads = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiUpload<ImportLeadsResult>("/api/v1/leads/import", formData);
    },
    onSuccess: (result) => {
      setImportResult(result);
      setImportResultOpen(true);
      invalidateLeadRelated();
      qc.invalidateQueries({ queryKey: ["companies-lite"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to import leads");
    },
  });

  const exportLeads = useMutation({
    mutationFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      const query = params.toString();
      const filename = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
      return apiDownload(`/api/v1/leads/export${query ? `?${query}` : ""}`, filename);
    },
    onSuccess: () => toast.success("Export downloaded"),
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to export leads"),
  });

  const openEditDialog = (lead: Lead) => {
    if (!canWrite) return;
    setEditingLead(lead);
    setEditForm(toUpdatePayload(lead));
  };

  const openViewDialog = async (lead: Lead) => {
    setViewingLead(resolveLead(lead));
    setViewLoading(true);
    const full = await fetchLeadDetail(lead);
    setViewingLead((cur) => (cur && cur.id === lead.id ? full : cur));
    setViewLoading(false);
  };

  const openEditFromRow = async (lead: Lead) => {
    if (!canWrite) return;
    const full = await fetchLeadDetail(lead);
    openEditDialog(full);
  };

  const closeEditDialog = () => {
    setEditingLead(null);
    setEditForm(null);
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || !editingLead || !editForm) return;
    updateLead.mutate({
      id: editingLead.id,
      payload: editForm,
      customFields: editingLead.custom_fields,
    });
  };

  const handleDeleteConfirmed = () => {
    if (!canWrite || !editingLead) return;
    deleteLead.mutate(editingLead.id);
  };

  const handleImportClick = () => { fileInputRef.current?.click(); };
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importLeads.mutate(file);
    e.target.value = "";
  };

  const items = leads ?? [];

  const scopedItems = useMemo(() => {
    if (isExecutive && currentUserId) {
      return items.filter((l) => l.assigned_to === currentUserId);
    }
    return items;
  }, [items, isExecutive, currentUserId]);

  const filteredItems = useMemo(() => {
    const start = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const end = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;
    return scopedItems.filter((lead) => {
      if (priorityFilter !== "all" && lead.priority !== priorityFilter) return false;
      if (start || end) {
        const created = new Date(lead.created_at);
        if (start && created < start) return false;
        if (end && created > end) return false;
      }
      return true;
    });
  }, [scopedItems, priorityFilter, dateFrom, dateTo]);

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (priorityFilter !== "all" ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  const clearFilters = () => {
    setStatusFilter("all");
    setPriorityFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  };

  const totalFiltered = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedItems = useMemo(
    () => filteredItems.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [filteredItems, safePage]
  );
  const rangeStart = totalFiltered === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const rangeEnd = Math.min(totalFiltered, (safePage + 1) * PAGE_SIZE);

  const pageNumbers = useMemo(() => {
    const maxButtons = 5;
    let startP = Math.max(0, safePage - Math.floor(maxButtons / 2));
    const endP = Math.min(totalPages, startP + maxButtons);
    startP = Math.max(0, endP - maxButtons);
    const nums: number[] = [];
    for (let i = startP; i < endP; i++) nums.push(i);
    return nums;
  }, [safePage, totalPages]);

  useEffect(() => {
    setPage(0);
  }, [search, statusFilter, priorityFilter, tenantFilter, dateFrom, dateTo]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, statusFilter, priorityFilter, tenantFilter, dateFrom, dateTo, page]);

  const selectedLeads = pagedItems.filter((l) => selectedIds.has(l.id));
  const allSelected =
    pagedItems.length > 0 && selectedLeads.length === pagedItems.length;
  const someSelected = selectedLeads.length > 0 && !allSelected;
  const allPrioritized =
    selectedLeads.length > 0 &&
    selectedLeads.every((l) => l.custom_fields?.on_priority);

  const toggleOne = (id: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(pagedItems.map((l) => l.id)));

  const total = isSuperadmin ? items.length : stats?.total ?? items.length;
  const colCount = (isSuperadmin ? 9 : isExecutive ? 7 : 8) + (canBulk ? 1 : 0);
  const showLoading = isLoading || authLoading;

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ["leads"] });
    if (isSuperadmin) qc.invalidateQueries({ queryKey: ["superadmin"] });
    toast.success("Refreshed");
  };

  const pendingPriorityId =
    togglePriority.isPending ? togglePriority.variables?.lead.id : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm dark:border dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
            <Users className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Leads</h1>
              {isExecutive ? (
                <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium dark:bg-blue-500/15 dark:text-blue-300">
                  My Leads
                </span>
              ) : (
                <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-medium dark:bg-slate-800 dark:text-slate-300">
                  All Leads
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              Track and convert your pipeline.
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="h-9 rounded-lg border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800" onClick={handleRefresh}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          {canWrite && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileSelected}
              />
              <Button variant="outline" className="h-9 rounded-lg border-0 bg-violet-600 text-white shadow-sm hover:bg-violet-700 hover:text-white dark:border dark:border-violet-400/50 dark:bg-violet-600/30 dark:hover:bg-violet-600/50" onClick={handleImportClick} disabled={importLeads.isPending}>
                {importLeads.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Import
              </Button>
            </>
          )}

          <Button variant="outline" className="h-9 rounded-lg border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25 dark:hover:text-emerald-200" onClick={() => exportLeads.mutate()} disabled={exportLeads.isPending}>
            {exportLeads.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export
          </Button>

          {canWrite && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="h-9 rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Lead
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleCreateSubmit}>
                  <DialogHeader>
                    <DialogTitle>Create Lead</DialogTitle>
                    <DialogDescription>
                      Add a new lead manually. A company is created automatically if a company name is provided, and a contact is created if an email is provided.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Name</Label>
                      <Input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jane Doe" />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@example.com" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input id="phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="9876543210" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="company">Company</Label>
                        <Input id="company" value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} placeholder="Acme Inc." />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="industry">Industry</Label>
                        <Input id="industry" value={form.industry} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))} placeholder="e.g. IT" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="city">City</Label>
                        <Input id="city" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="e.g. Noida" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="country">Country</Label>
                        <Input id="country" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} placeholder="e.g. India" />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="designation">Designation</Label>
                      <Input id="designation" value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} placeholder="e.g. Marketing Manager" />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="message">Message</Label>
                      <Textarea id="message" value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="Interested in..." rows={3} />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="source">Source</Label>
                        <Input id="source" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} placeholder="manual" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="priority">Priority</Label>
                        <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                          <SelectTrigger id="priority"><SelectValue placeholder="Priority" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="value">Value (₹)</Label>
                        <Input id="value" type="text" inputMode="decimal" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: sanitizeNumericInput(e.target.value) }))} placeholder="0" />
                      </div>
                    </div>

                    {isAdminOrManager && (
                      <div className="grid gap-2">
                        <Label htmlFor="assigned_to">Assign To</Label>
                        <Select value={form.assigned_to || "__self__"} onValueChange={(v) => setForm((f) => ({ ...f, assigned_to: v === "__self__" ? "" : v }))}>
                          <SelectTrigger id="assigned_to"><SelectValue placeholder="Assign to me (default)" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__self__">— Assign to me —</SelectItem>
                            {users.map((u: any) => (
                              <SelectItem key={u.id} value={String(u.id)}>
                                {u.full_name || u.email} · {u.role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createLead.isPending}>
                      {createLead.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Lead
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && !isSuperadmin && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total" value={stats.total} icon={Users} tone="blue" />
          <StatCard label="New" value={stats.new} icon={Plus} tone="teal" />
          <StatCard label="Contacted" value={stats.contacted} icon={MessageSquare} tone="orange" />
          <StatCard label="Qualified" value={stats.qualified} icon={Star} tone="violet" />
          <StatCard label="Won" value={stats.won} icon={Trophy} tone="green" />
          <StatCard label="Lost" value={stats.lost} icon={X} tone="red" />
        </div>
      )}

      {/* Filters + Table */}
      <Card className="rounded-2xl border-slate-200/70 shadow-sm dark:border-slate-800 dark:bg-[#0b1226]">
        <CardContent className="p-4">
          <div className="flex gap-3 flex-wrap mb-4">
            <div className="relative flex-1 min-w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search name, email, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 rounded-lg border-slate-200 bg-slate-50/60 pl-9 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>

            {canBulk && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-9 rounded-lg border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800" disabled={selectedLeads.length === 0 || bulkAction.isPending}>
                    {bulkAction.isPending
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <ListChecks className="mr-2 h-4 w-4" />}
                    Actions{selectedLeads.length > 0 ? ` (${selectedLeads.length})` : ""}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <RefreshCw className="mr-2 h-4 w-4" /> Status Change
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {STATUS_OPTIONS.map((s) => (
                        <DropdownMenuItem
                          key={s.value}
                          onClick={() =>
                            bulkAction.mutate({ kind: "status", leads: selectedLeads, value: s.value })
                          }
                        >
                          {s.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  {canAssign && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <UserPlus className="mr-2 h-4 w-4" /> Assign To
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                        {assignableUsers.length === 0 && (
                          <DropdownMenuItem disabled>No team members</DropdownMenuItem>
                        )}
                        {assignableUsers.map((u: any) => (
                          <DropdownMenuItem
                            key={u.id}
                            onClick={() =>
                              bulkAction.mutate({ kind: "assign", leads: selectedLeads, value: Number(u.id) })
                            }
                          >
                            {u.full_name || u.email}
                            {u.role && <span className="text-xs text-muted-foreground ml-2">{u.role}</span>}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            bulkAction.mutate({ kind: "assign", leads: selectedLeads, value: null })
                          }
                        >
                          Unassign
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}

                  <DropdownMenuItem
                    onClick={() =>
                      bulkAction.mutate({ kind: "priority", leads: selectedLeads, value: !allPrioritized })
                    }
                  >
                    <Star className="mr-2 h-4 w-4" />
                    {allPrioritized ? "Remove Priority" : "OnPriority"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {isSuperadmin && (
              <Select value={tenantFilter} onValueChange={(v) => setTenantFilter(v)}>
                <SelectTrigger className="h-9 w-48 rounded-lg border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100">
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-slate-500 dark:text-slate-300" />
                    <SelectValue placeholder="Tenant" />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tenants</SelectItem>
                  {tenants?.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{tenantLabel(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              className="relative h-9 rounded-lg bg-blue-600 px-4 text-white shadow-sm hover:bg-blue-700 dark:border dark:border-violet-500 dark:bg-slate-900/80 dark:shadow-[0_0_0_3px_rgba(139,92,246,0.22)] dark:hover:bg-slate-800"
              onClick={() => setFiltersOpen((o) => !o)}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filter
              <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
              {activeFilterCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>

          {filtersOpen && (
            <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-linear-to-br from-slate-50 to-white shadow-sm dark:border-slate-800 dark:from-slate-900/80 dark:to-slate-950/80">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-3.5 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                    <SlidersHorizontal className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">Filters</div>
                    <div className="text-xs text-muted-foreground">
                      Narrow down leads by status, priority and created date
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  aria-label="Close filters"
                  onClick={() => setFiltersOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
                <FilterField icon={CircleDot} label="Status">
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
                    <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>

                <FilterField icon={Flag} label="Priority">
                  <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v)}>
                    <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"><SelectValue placeholder="Priority" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All priorities</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </FilterField>

                <FilterField icon={CalendarDays} label="Created from" htmlFor="date-from">
                  <Input
                    id="date-from"
                    type="date"
                    className="h-9 rounded-lg border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:scheme-dark"
                    value={dateFrom}
                    max={dateTo || undefined}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </FilterField>

                <FilterField icon={CalendarDays} label="Created to" htmlFor="date-to">
                  <Input
                    id="date-to"
                    type="date"
                    className="h-9 rounded-lg border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:scheme-dark"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </FilterField>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-slate-200/70 bg-slate-50/60 px-5 py-3 dark:border-slate-800 dark:bg-slate-900/40">
                <span className="text-xs text-muted-foreground">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{totalFiltered}</span> leads match
                </span>
                {activeFilterCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-lg border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    onClick={clearFilters}
                  >
                    <X className="mr-1 h-3.5 w-3.5" /> Clear filters
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200/70 overflow-hidden dark:border-slate-800">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:bg-slate-900/60">
                  {canBulk && (
                    <TableHead className="w-10 text-left">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary cursor-pointer"
                        checked={allSelected}
                        ref={(el) => { if (el) el.indeterminate = someSelected; }}
                        onChange={toggleAll}
                        aria-label="Select all leads"
                      />
                    </TableHead>
                  )}
                  <TableHead className="text-left font-medium text-slate-500 dark:text-slate-300">Name</TableHead>
                  <TableHead className="text-left font-medium text-slate-500 dark:text-slate-300">Contact</TableHead>
                  <TableHead className="text-left font-medium text-slate-500 dark:text-slate-300">Status</TableHead>
                  <TableHead className="text-left font-medium text-slate-500 dark:text-slate-300">Priority</TableHead>
                  <TableHead className="text-left font-medium text-slate-500 dark:text-slate-300">Value</TableHead>
                  <TableHead className="text-left font-medium text-slate-500 dark:text-slate-300">Source</TableHead>
                  {!isExecutive && <TableHead className="text-left font-medium text-slate-500 dark:text-slate-300">Assigned To</TableHead>}
                  {isSuperadmin && <TableHead className="text-left font-medium text-slate-500 dark:text-slate-300">Tenant</TableHead>}
                  {canWrite && <TableHead className="w-32 text-left font-medium text-slate-500 dark:text-slate-300">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {showLoading && (
                  <TableRow>
                    <TableCell colSpan={colCount} className="text-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                )}

                {error && (
                  <TableRow>
                    <TableCell colSpan={colCount} className="text-center py-10">
                      <div className="text-red-600">
                        <p className="font-semibold">Error loading leads</p>
                        <p className="text-sm mt-1">{String(error)}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {!showLoading && !error && pagedItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={colCount} className="text-center py-16">
                      <Users className="h-9 w-10 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No leads found.</p>
                    </TableCell>
                  </TableRow>
                )}

                {!showLoading && !error && pagedItems.map((lead) => {
                  const amount = getLeadAmount(lead);
                  const assigneeName = getUserDisplayName(lead.assigned_to, users);
                  const isPrioritized = Boolean(lead.custom_fields?.on_priority);
                  return (
                    <TableRow
                      key={lead.id}
                      className={`cursor-pointer border-slate-100 transition-colors hover:bg-blue-50/40 dark:border-slate-800/80 dark:hover:bg-slate-800/40 ${selectedIds.has(lead.id) ? "bg-blue-50/60 dark:bg-blue-500/10" : ""}`}
                      onClick={() => setView360Id(lead.id)}
                    >
                      {canBulk && (
                        <TableCell className="text-left" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-primary cursor-pointer"
                            checked={selectedIds.has(lead.id)}
                            onChange={() => toggleOne(lead.id)}
                            aria-label={`Select ${lead.name ?? "lead"}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="text-left">
                        <div className="flex items-center justify-start gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarColors[lead.id % avatarColors.length]}`}
                          >
                            {getInitials(lead.name, lead.email)}
                          </div>
                          <div className="min-w-0 text-left">
                            <div className="font-medium text-slate-800 dark:text-white">{lead.name || "—"}</div>
                            {(lead.company || lead.company_name) && (
                              <div className="text-xs text-muted-foreground">{lead.company || lead.company_name}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-left">
                        <div className="flex items-center justify-start gap-1.5 text-sm text-slate-700 dark:text-slate-200">
                          <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          {lead.email || "—"}
                        </div>
                        {lead.phone && (
                          <div className="mt-0.5 flex items-center justify-start gap-1.5 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3 shrink-0 text-slate-400" />
                            {lead.phone}
                          </div>
                        )}
                      </TableCell>

                      {/* ⭐ STATUS — clickable dropdown */}
                      <TableCell className="text-left" onClick={(e) => e.stopPropagation()}>
                        {canQuickAct ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                title="Change status"
                              >
                                <StatusBadge status={lead.status} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-52">
                              {STATUS_OPTIONS.map((s) => {
                                const Icon = statusIcons[s.value];
                                const active = lead.status === s.value;
                                return (
                                  <DropdownMenuItem
                                    key={s.value}
                                    disabled={active}
                                    onClick={() =>
                                      changeStatus.mutate({ id: lead.id, status: s.value })
                                    }
                                    className="flex items-center justify-between"
                                  >
                                    <span className="flex items-center gap-2">
                                      {Icon && <Icon className="h-3.5 w-3.5" />}
                                      {s.label}
                                    </span>
                                    {active && <Check className="h-3.5 w-3.5 text-primary" />}
                                  </DropdownMenuItem>
                                );
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <StatusBadge status={lead.status} />
                        )}
                      </TableCell>

                      <TableCell className="text-left">
                        <PriorityBadge priority={lead.priority} />
                      </TableCell>
                      <TableCell className="text-left text-sm font-semibold text-slate-800 dark:text-white">
                        {amount > 0 ? currencyFormatter.format(amount) : "—"}
                      </TableCell>
                      <TableCell className="text-left">
                        <span
                          className={`inline-block rounded-md px-2.5 py-0.5 text-xs font-medium capitalize ${
                            sourceColors[(lead.source || "").toLowerCase()] || "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {lead.source}
                        </span>
                      </TableCell>

                      {/* ⭐ ASSIGNED TO — clickable dropdown */}
                      {!isExecutive && (
                        <TableCell className="text-left text-sm" onClick={(e) => e.stopPropagation()}>
                          {canAssign ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="cursor-pointer rounded-md px-2 py-1 text-left outline-none transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-slate-800"
                                  title="Change assignee"
                                >
                                  {assigneeName || lead.assigned_to ? (
                                    <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                                      <User className="h-3.5 w-3.5 text-slate-500" />
                                      {assigneeName ?? `User #${lead.assigned_to}`}
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1.5 text-muted-foreground">
                                      <UserPlus className="h-3.5 w-3.5" />
                                      Assign
                                    </span>
                                  )}
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="max-h-64 w-60 overflow-y-auto">
                                {assignableUsers.length === 0 && (
                                  <DropdownMenuItem disabled>No users</DropdownMenuItem>
                                )}
                                {assignableUsers.map((u: any) => {
                                  const active = String(lead.assigned_to) === String(u.id);
                                  return (
                                    <DropdownMenuItem
                                      key={u.id}
                                      onClick={() =>
                                        assignLead.mutate({ id: lead.id, assigned_to: u.id })
                                      }
                                      className="flex items-center justify-between"
                                    >
                                      <span className="flex items-center gap-2">
                                        <User className="h-3.5 w-3.5 text-slate-500" />
                                        <span>
                                          {u.full_name || u.email}
                                          {u.role && (
                                            <span className="ml-2 text-xs text-muted-foreground">
                                              {u.role}
                                            </span>
                                          )}
                                        </span>
                                      </span>
                                      {active && <Check className="h-3.5 w-3.5 text-primary" />}
                                    </DropdownMenuItem>
                                  );
                                })}
                                {lead.assigned_to && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() =>
                                        assignLead.mutate({ id: lead.id, assigned_to: null })
                                      }
                                      className="text-destructive"
                                    >
                                      Unassign
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : assigneeName || lead.assigned_to ? (
                            <div className="flex items-center justify-start gap-1.5 text-slate-700 dark:text-slate-200">
                              <User className="h-3.5 w-3.5 text-slate-500" />
                              {assigneeName ?? `User #${lead.assigned_to}`}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}

                      {isSuperadmin && (
                        <TableCell className="text-left">
                          <span className="inline-block rounded-md bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-600 dark:bg-teal-500/20 dark:text-teal-300">
                            {(() => {
                              const t = tenants?.find((t) => t.id === lead.tenant_id);
                              return t ? tenantLabel(t) : lead.tenant_id;
                            })()}
                          </span>
                        </TableCell>
                      )}

                      {/* ⭐ ACTIONS — only direct buttons, no dropdown */}
                      {canWrite && (
                        <TableCell className="text-left" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-start gap-1.5">
                            {/* View 360° — now a direct button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 dark:hover:bg-blue-500/30 dark:hover:text-blue-200"
                              title="View 360°"
                              aria-label="View 360°"
                              onClick={() => setView360Id(lead.id)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>

                            {/* Edit — now a direct button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                              title="Edit lead"
                              aria-label="Edit lead"
                              onClick={() => openEditFromRow(lead)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>

                            {canQuickAct && (
                              <>
                                {/* Schedule */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 dark:hover:bg-indigo-500/30 dark:hover:text-indigo-200"
                                  title="Schedule activity"
                                  aria-label="Schedule activity"
                                  onClick={() => openScheduleDialog(lead)}
                                >
                                  <CalendarClock className="h-3.5 w-3.5" />
                                </Button>

                                {/* Priority toggle */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`h-7 w-7 rounded-lg ${
                                    isPrioritized
                                      ? "bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/20 dark:hover:bg-amber-500/30"
                                      : "bg-slate-50 hover:bg-amber-50 dark:bg-slate-800 dark:hover:bg-slate-700"
                                  }`}
                                  title={isPrioritized ? "Remove priority" : "Mark as priority"}
                                  aria-label={isPrioritized ? "Remove priority" : "Mark as priority"}
                                  disabled={pendingPriorityId === lead.id}
                                  onClick={() => togglePriority.mutate({ lead, on: !isPrioritized })}
                                >
                                  {pendingPriorityId === lead.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Star
                                      className={`h-3.5 w-3.5 ${
                                        isPrioritized
                                          ? "fill-amber-400 text-amber-500"
                                          : "text-slate-400"
                                      }`}
                                    />
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {totalFiltered > 0 && (
            <div className="flex items-center justify-between flex-wrap gap-3 mt-4 text-sm">
              <span className="text-muted-foreground">
                Showing {rangeStart}–{rangeEnd} of {totalFiltered} leads
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  title="First page"
                  disabled={safePage === 0}
                  onClick={() => setPage(0)}
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  title="Previous page"
                  disabled={safePage === 0}
                  onClick={() => setPage(safePage - 1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                {pageNumbers.map((p) => (
                  <Button
                    key={p}
                    size="icon"
                    variant="outline"
                    className={`h-7 w-7 rounded-lg ${
                      p === safePage
                        ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
                        : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    }`}
                    onClick={() => setPage(p)}
                  >
                    {p + 1}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  title="Next page"
                  disabled={safePage + 1 >= totalPages}
                  onClick={() => setPage(safePage + 1)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  title="Last page"
                  disabled={safePage + 1 >= totalPages}
                  onClick={() => setPage(totalPages - 1)}
                >
                  <ChevronsRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Lead Dialog */}
      <Dialog open={!!viewingLead} onOpenChange={(open) => { if (!open) setViewingLead(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {viewingLead && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {viewingLead.name || "Lead"}
                  {viewLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </DialogTitle>
                <DialogDescription>
                  {[viewingLead.designation, viewingLead.company].filter(Boolean).join(" · ") || "Lead details"}
                </DialogDescription>
              </DialogHeader>

              <div className="flex gap-2">
                <Badge className={`${statusColors[viewingLead.status] || "bg-gray-100 text-gray-700"} border-0 capitalize`}>
                  {viewingLead.status.replace("_", " ")}
                </Badge>
                <Badge className={`${priorityColors[viewingLead.priority] || "bg-gray-100 text-gray-700"} border-0 capitalize`}>
                  {viewingLead.priority || "—"}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-4 py-2">
                <DetailRow label="Email" value={viewingLead.email} />
                <DetailRow label="Phone" value={viewingLead.phone} />
                <DetailRow label="Company" value={viewingLead.company} />
                <DetailRow label="Designation" value={viewingLead.designation} />
                <DetailRow label="Industry" value={getExtra(viewingLead, "industry")} />
                <DetailRow
                  label="Location"
                  value={[getExtra(viewingLead, "city"), getExtra(viewingLead, "country")].filter(Boolean).join(", ")}
                />
                <DetailRow label="Source" value={viewingLead.source} />
                <DetailRow
                  label="Value"
                  value={getLeadAmount(viewingLead) > 0 ? currencyFormatter.format(getLeadAmount(viewingLead)) : null}
                />
                {viewingLead.assigned_to && (
                  <DetailRow
                    label="Assigned To"
                    value={
                      getUserDisplayName(viewingLead.assigned_to, users) ||
                      `User #${viewingLead.assigned_to}`
                    }
                  />
                )}
                <DetailRow
                  label="Created"
                  value={new Date(viewingLead.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                />
                <div className="col-span-2">
                  <DetailRow label="Message" value={viewingLead.message} />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setViewingLead(null)}>Close</Button>
                {canWrite && (
                  <Button
                    disabled={viewLoading}
                    onClick={() => {
                      const lead = viewingLead;
                      setViewingLead(null);
                      openEditDialog(lead);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Lead Dialog */}
      <Dialog open={!!editingLead} onOpenChange={(open) => { if (!open) closeEditDialog(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {editingLead && editForm && (
            <form onSubmit={handleUpdateSubmit}>
              <DialogHeader><DialogTitle>Edit Lead</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Name</Label>
                  <Input id="edit-name" value={editForm.name} onChange={(e) => setEditForm((f) => f && { ...f, name: e.target.value })} placeholder="Jane Doe" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input id="edit-email" type="email" value={editForm.email} onChange={(e) => setEditForm((f) => f && { ...f, email: e.target.value })} placeholder="jane@example.com" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-phone">Phone</Label>
                    <Input id="edit-phone" value={editForm.phone} onChange={(e) => setEditForm((f) => f && { ...f, phone: e.target.value })} placeholder="9876543210" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-company">Company</Label>
                    <Input id="edit-company" value={editForm.company} onChange={(e) => setEditForm((f) => f && { ...f, company: e.target.value })} placeholder="Acme Inc." />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-industry">Industry</Label>
                    <Input id="edit-industry" value={editForm.industry} onChange={(e) => setEditForm((f) => f && { ...f, industry: e.target.value })} placeholder="e.g. IT" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-city">City</Label>
                    <Input id="edit-city" value={editForm.city} onChange={(e) => setEditForm((f) => f && { ...f, city: e.target.value })} placeholder="e.g. Noida" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-country">Country</Label>
                    <Input id="edit-country" value={editForm.country} onChange={(e) => setEditForm((f) => f && { ...f, country: e.target.value })} placeholder="e.g. India" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-designation">Designation</Label>
                  <Input id="edit-designation" value={editForm.designation} onChange={(e) => setEditForm((f) => f && { ...f, designation: e.target.value })} placeholder="e.g. Marketing Manager" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-message">Message</Label>
                  <Textarea id="edit-message" value={editForm.message} onChange={(e) => setEditForm((f) => f && { ...f, message: e.target.value })} rows={3} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-status">Status</Label>
                    <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => f && { ...f, status: v })}>
                      <SelectTrigger id="edit-status"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-priority">Priority</Label>
                    <Select value={editForm.priority} onValueChange={(v) => setEditForm((f) => f && { ...f, priority: v })}>
                      <SelectTrigger id="edit-priority"><SelectValue placeholder="Priority" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-value">Value (₹)</Label>
                    <Input id="edit-value" type="text" inputMode="decimal" value={editForm.value} onChange={(e) => setEditForm((f) => f && { ...f, value: sanitizeNumericInput(e.target.value) })} placeholder="0" />
                  </div>
                </div>
              </div>

              <DialogFooter className="flex items-center justify-between sm:justify-between">
                <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" size="sm">
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete {editingLead.name || "this lead"}. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteConfirmed} disabled={deleteLead.isPending} className="bg-red-600 hover:bg-red-700">
                        {deleteLead.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={closeEditDialog}>Cancel</Button>
                  <Button type="submit" disabled={updateLead.isPending}>
                    {updateLead.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Schedule Activity Dialog */}
      <Dialog open={!!scheduleFor} onOpenChange={(open) => { if (!open) closeScheduleDialog(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleScheduleSubmit}>
            <DialogHeader>
              <DialogTitle>Schedule Activity</DialogTitle>
              <DialogDescription>
                Schedule an activity for <strong>{scheduleFor?.name || scheduleFor?.email || "this lead"}</strong>. You'll get a reminder before it starts.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="sch-type">Activity Type</Label>
                  <Select
                    value={scheduleForm.activity_type}
                    onValueChange={(v) => setScheduleForm((f) => ({ ...f, activity_type: v }))}
                  >
                    <SelectTrigger id="sch-type"><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sch-priority">Priority</Label>
                  <Select
                    value={scheduleForm.priority}
                    onValueChange={(v) => setScheduleForm((f) => ({ ...f, priority: v }))}
                  >
                    <SelectTrigger id="sch-priority"><SelectValue placeholder="Priority" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="sch-title">Title</Label>
                <Input
                  id="sch-title"
                  value={scheduleForm.title}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Product demo call"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="sch-when">Date & Time</Label>
                <Input
                  id="sch-when"
                  type="datetime-local"
                  value={scheduleForm.scheduled_at}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, scheduled_at: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="sch-duration">Duration (minutes)</Label>
                  <Input
                    id="sch-duration"
                    inputMode="numeric"
                    value={scheduleForm.duration_minutes}
                    onChange={(e) =>
                      setScheduleForm((f) => ({ ...f, duration_minutes: sanitizeIntInput(e.target.value) }))
                    }
                    placeholder="30"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sch-reminder">Remind before (minutes)</Label>
                  <Input
                    id="sch-reminder"
                    inputMode="numeric"
                    value={scheduleForm.reminder_minutes_before}
                    onChange={(e) =>
                      setScheduleForm((f) => ({ ...f, reminder_minutes_before: sanitizeIntInput(e.target.value) }))
                    }
                    placeholder="15"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="sch-notes">Notes</Label>
                <Textarea
                  id="sch-notes"
                  rows={3}
                  value={scheduleForm.notes}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Agenda, talking points..."
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="sch-file">Attachment (optional, max 10 MB)</Label>
                <input
                  id="sch-file"
                  ref={scheduleFileRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.csv,.zip"
                  className="text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (f && f.size > 10 * 1024 * 1024) {
                      toast.error("File too large (max 10 MB)");
                      e.target.value = "";
                      setScheduleFile(null);
                      return;
                    }
                    setScheduleFile(f);
                  }}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeScheduleDialog}>Cancel</Button>
              <Button type="submit" disabled={createSchedule.isPending}>
                {createSchedule.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Schedule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import Result Dialog */}
      <Dialog open={importResultOpen} onOpenChange={setImportResultOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import Complete</DialogTitle>
            <DialogDescription>Here's a summary of your CSV import.</DialogDescription>
          </DialogHeader>
          {importResult && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Total Rows</div>
                  <div className="text-xl font-bold mt-1">{importResult.total_rows}</div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Imported</div>
                  <div className="text-xl font-bold mt-1 text-green-600">{importResult.imported}</div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Failed</div>
                  <div className="text-xl font-bold mt-1 text-red-600">{importResult.failed}</div>
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <div className="rounded-lg border p-3 max-h-48 overflow-y-auto">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Errors</div>
                  <ul className="space-y-1 text-sm text-red-600 list-disc list-inside">
                    {importResult.errors.map((err, i) => (<li key={i}>{String(err)}</li>))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setImportResultOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ⭐ 360° Lead View */}
      <Lead360Dialog
        leadId={view360Id}
        open={!!view360Id}
        onOpenChange={(v) => { if (!v) setView360Id(null); }}
        onEdit={async (profile) => {
          const found = items.find((l) => l.id === profile.id);
          if (found) {
            await openEditFromRow(found);
          }
        }}
        onSchedule={(profile) => {
          const found = items.find((l) => l.id === profile.id);
          if (found) {
            openScheduleDialog(found);
          }
        }}
      />
    </div>
  );
}

// ============ HELPER ============
const statTones: Record<string, { card: string; icon: string }> = {
  blue: {
    card: "from-blue-50 to-white border-blue-100 dark:from-blue-950 dark:to-slate-950 dark:border-blue-500/40",
    icon: "bg-blue-100 text-blue-600 dark:bg-blue-500/25 dark:text-blue-300",
  },
  teal: {
    card: "from-teal-50 to-white border-teal-100 dark:from-emerald-950 dark:to-slate-950 dark:border-emerald-500/40",
    icon: "bg-teal-500 text-white dark:bg-emerald-500",
  },
  orange: {
    card: "from-orange-50 to-white border-orange-100 dark:from-orange-950 dark:to-slate-950 dark:border-orange-500/40",
    icon: "bg-orange-100 text-orange-600 dark:bg-orange-500/30 dark:text-orange-300",
  },
  violet: {
    card: "from-violet-50 to-white border-violet-100 dark:from-violet-950 dark:to-slate-950 dark:border-violet-500/40",
    icon: "bg-violet-500 text-white",
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

function StatusBadge({ status }: { status: string }) {
  const Icon = statusIcons[status];
  return (
    <Badge className={`${statusColors[status] || "bg-gray-100 text-gray-700"} gap-1 rounded-full border-0 px-2.5 capitalize`}>
      {Icon && <Icon className="h-3 w-3" />}
      {status.replace("_", " ")}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const Icon = priorityIcons[priority];
  return (
    <Badge className={`${priorityColors[priority] || "bg-gray-100 text-gray-700"} gap-1 rounded-full border-0 px-2.5 capitalize`}>
      {Icon && <Icon className="h-3 w-3" />}
      {priority || "—"}
    </Badge>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-sm mt-1 wrap-break-word whitespace-pre-wrap">{value || "—"}</div>
    </div>
  );
}

function FilterField({
  icon: Icon, label, htmlFor, children,
}: {
  icon: IconType;
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label
        htmlFor={htmlFor}
        className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
      >
        <Icon className="h-3.5 w-3.5" /> {label}
      </Label>
      {children}
    </div>
  );
}