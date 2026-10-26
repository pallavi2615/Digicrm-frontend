import { usePermissions } from "@/hooks/use-permissions";
import { notifyPermissionDenied } from "@/components/permission-denied";
import { defineRoute } from "@/lib/router-compat";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@/lib/react-data-client";
import { apiFetch, apiUpload, apiDownload } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Search, Trash2, Pencil, Loader2, Building2, Globe, Upload, Download, Eye,
  Users, CheckCircle2, IndianRupee, Mail, Phone, MapPin,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

export const Route = defineRoute("/_authenticated/companies")({
  head: () => ({ meta: [{ title: "Companies — DigiCRM AI" }] }),
  component: CompaniesPage,
});

const BASE = "/api/v1/companies";

interface Company {
  id: number;
  tenant_id?: number;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  employee_count: number | null;
  annual_revenue: number | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string;
}

interface ImportResult {
  total_rows: number;
  imported: number;
  failed: number;
  errors: unknown[];
}

// Server-side pagination contract (GET /companies?page=&size=&search=)
interface PageMeta {
  total_items: number;
  total_pages: number;
  current_page: number;
  page_size: number;
  has_next: boolean;
  has_previous: boolean;
}
interface CompaniesPageData {
  items: Company[];
  meta: PageMeta;
}
type CompaniesResponse =
  | { items: Record<string, unknown>[]; meta?: PageMeta }
  | Record<string, unknown>[];

interface CompanyStats {
  total: number;
  active: number;
  total_revenue: number;
  total_employees: number;
}

type IconType = React.ComponentType<{ className?: string }>;

const empty = {
  name: "", industry: "", website: "", phone: "", email: "",
  employee_count: 0, annual_revenue: 0, city: "", country: "", notes: "",
};

// FastAPI/Pydantic rejects "" for typed fields like EmailStr, so send null instead.
const nullIfEmpty = (v: string) => (v.trim() === "" ? null : v.trim());

// The API may name these fields differently from the UI. On read, we take the
// first alias present in the response; on write, we send back using the key the
// API actually returned. The defaults below match the current backend
// (location / employees / revenue), so even the very first company is saved correctly.
const ALIASES = {
  city: ["city", "location", "city_name"],
  country: ["country", "country_name"],
  employee_count: ["employee_count", "employees", "num_employees", "no_of_employees", "company_size", "size"],
  annual_revenue: ["annual_revenue", "revenue", "annual_turnover", "turnover"],
} as const;

type AliasField = keyof typeof ALIASES;

const writeKeys: Record<AliasField, string> = {
  city: "location",
  country: "country",
  employee_count: "employees",
  annual_revenue: "revenue",
};

// True when the API only has a single `location` string (no separate country).
// Then we show it as City + Country in the UI ("Noida, India" → Noida / India)
// and join them back into one string when saving.
let combinedLocation = true;

function normalize(row: Record<string, unknown>): Company {
  const out: Record<string, unknown> = { ...row };
  for (const field of Object.keys(ALIASES) as AliasField[]) {
    const found = ALIASES[field].find((k) => row[k] !== undefined);
    if (found) writeKeys[field] = found;
    out[field] = found ? row[found] : null;
  }

  const hasCountryKey = ALIASES.country.some((k) => row[k] !== undefined);
  if (hasCountryKey) combinedLocation = false;
  if (row.location !== undefined && !hasCountryKey) {
    combinedLocation = true;
    writeKeys.city = "location";
    const raw = row.location ? String(row.location) : "";
    const idx = raw.lastIndexOf(",");
    if (idx >= 0) {
      out.city = raw.slice(0, idx).trim() || null;
      out.country = raw.slice(idx + 1).trim() || null;
    } else {
      out.city = raw.trim() || null;
      out.country = null;
    }
  }
  return out as unknown as Company;
}

function toPayload(form: typeof empty) {
  const location = combinedLocation
    ? {
        [writeKeys.city]: nullIfEmpty(
          [form.city.trim(), form.country.trim()].filter(Boolean).join(", "),
        ),
      }
    : {
        [writeKeys.city]: nullIfEmpty(form.city),
        [writeKeys.country]: nullIfEmpty(form.country),
      };

  return {
    name: form.name.trim(),
    industry: nullIfEmpty(form.industry),
    website: nullIfEmpty(form.website),
    phone: nullIfEmpty(form.phone),
    email: nullIfEmpty(form.email),
    notes: nullIfEmpty(form.notes),
    [writeKeys.employee_count]: Number(form.employee_count) || null,
    [writeKeys.annual_revenue]: Number(form.annual_revenue) || null,
    ...location,
  };
}

// All money in the app is in rupees
const inr = new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
});

const formatRevenue = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? inr.format(n) : null;
};

// ───────── Look & feel (same language as the Leads page) ─────────
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

const industryPills = [
  "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30",
  "bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30",
  "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  "bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200 dark:bg-fuchsia-500/15 dark:text-fuchsia-300 dark:ring-fuchsia-500/30",
  "bg-teal-50 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:ring-teal-500/30",
];

const industryPill = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return industryPills[h % industryPills.length];
};

function getInitials(name: string | null | undefined): string {
  const parts = (name || "?").trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const FIELD =
  "h-9 rounded-lg border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100";
const FIELD_LABEL = "text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";

const PAGE_SIZES = [5, 10, 25, 50];

function CompaniesPage() {
  const perms = usePermissions();
  const { hasRole, loading: authLoading } = useAuth();
  // super admins get read-only access here; also stay read-only until auth has loaded
  const isSuperAdmin = authLoading || hasRole("super_admin");
  const canCreate = true;
  const canEdit = true;
  const canDelete = true;
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [viewing, setViewing] = useState<Company | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [form, setForm] = useState(empty);
  const [page, setPage] = useState(1); // 1-based, same as the API
  const [pageSize, setPageSize] = useState(10);

  // Debounce the search box so we hit the API once typing pauses
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // ⭐ Pagination + search are done by the backend. We only ask for one page at a time.
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["companies", debouncedSearch, page, pageSize],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<CompaniesPageData> => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("size", String(pageSize));
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await apiFetch<CompaniesResponse>(`${BASE}?${params.toString()}`);

      // Safety net: an endpoint that still returns a plain array
      if (Array.isArray(res)) {
        const items = res.map(normalize);
        return {
          items,
          meta: {
            total_items: items.length, total_pages: 1, current_page: 1,
            page_size: items.length, has_next: false, has_previous: false,
          },
        };
      }
      const items = (res.items ?? []).map(normalize);
      return {
        items,
        meta: res.meta ?? {
          total_items: items.length, total_pages: 1, current_page: 1,
          page_size: pageSize, has_next: false, has_previous: false,
        },
      };
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["companies-stats"],
    queryFn: () => apiFetch<CompanyStats>(`${BASE}/stats`),
  });

  const companies = data?.items ?? [];
  const meta = data?.meta;
  const totalItems = meta?.total_items ?? companies.length;
  const totalPages = Math.max(1, meta?.total_pages ?? 1);
  const currentPage = Math.min(page, totalPages);

  // If the current page no longer exists (e.g. last row deleted), step back
  useEffect(() => {
    if (meta && page > totalPages) setPage(totalPages);
  }, [meta, page, totalPages]);

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["companies"] });
    qc.invalidateQueries({ queryKey: ["companies-stats"] });
    qc.invalidateQueries({ queryKey: ["companies-lite"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name is required");
      const payload = toPayload(form);
      if (editing) {
        return apiFetch<Company>(`${BASE}/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }
      return apiFetch<Company>(BASE, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Company updated" : "Company created");
      refreshAll();
      setOpen(false); setEditing(null); setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: number) => apiFetch<unknown>(`${BASE}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Deleted");
      refreshAll();
    },
    onError: (e: Error) => notifyPermissionDenied(e),
    onSettled: () => setDeleteTarget(null),
  });

  const importCsv = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return apiUpload<ImportResult>(`${BASE}/import`, fd);
    },
    onSuccess: (r) => {
      if (r.failed > 0) {
        toast.warning(`Imported ${r.imported} of ${r.total_rows} rows (${r.failed} failed)`);
      } else {
        toast.success(`Imported ${r.imported} companies`);
      }
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCsv = useMutation({
    mutationFn: () => apiDownload(`${BASE}/export`, "companies.csv"),
    onSuccess: () => toast.success("Companies exported"),
    onError: (e: Error) => toast.error(e.message),
  });

  // Edit form (only reachable with edit rights)
  const openEdit = (c: Company) => {
    if (!canEdit) return;
    setEditing(c);
    setForm({
      name: c.name, industry: c.industry ?? "", website: c.website ?? "",
      phone: c.phone ?? "", email: c.email ?? "",
      employee_count: c.employee_count ?? 0, annual_revenue: Number(c.annual_revenue ?? 0),
      city: c.city ?? "", country: c.country ?? "", notes: c.notes ?? "",
    });
    setOpen(true);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ───────── Header ───────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex h-11 w-11 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm dark:border dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
            <Building2 className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Companies</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {stats?.total ?? totalItems} accounts in your CRM.
            </p>
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importCsv.mutate(file);
              e.target.value = "";
            }}
          />
          {canCreate && (
            <Button
              variant="outline"
              className="h-9 rounded-lg border-0 bg-violet-600 text-white shadow-sm hover:bg-violet-700 hover:text-white dark:border dark:border-violet-400/50 dark:bg-violet-600/30 dark:hover:bg-violet-600/50"
              onClick={() => fileRef.current?.click()}
              disabled={importCsv.isPending}
            >
              {importCsv.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} Import
            </Button>
          )}
          <Button
            variant="outline"
            className="h-9 rounded-lg border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25 dark:hover:text-emerald-200"
            onClick={() => exportCsv.mutate()}
            disabled={exportCsv.isPending}
          >
            {exportCsv.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Export
          </Button>
          {canCreate && (
            <Button
              className="h-9 rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700"
              onClick={() => { setEditing(null); setForm(empty); setOpen(true); }}
            >
              <Plus className="mr-2 h-4 w-4" /> New Company
            </Button>
          )}
        </div>
      </div>

      {/* ───────── Stat cards ───────── */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total" value={stats.total.toLocaleString("en-IN")} icon={Building2} tone="blue" />
          <StatCard label="Active" value={stats.active.toLocaleString("en-IN")} icon={CheckCircle2} tone="green" />
          <StatCard label="Employees" value={stats.total_employees.toLocaleString("en-IN")} icon={Users} tone="violet" />
          <StatCard label="Revenue" value={inr.format(stats.total_revenue ?? 0)} icon={IndianRupee} tone="orange" />
        </div>
      )}

      {/* ───────── Search + table ───────── */}
      <Card className="rounded-2xl border-slate-200/70 shadow-sm dark:border-slate-800 dark:bg-[#0b1226]">
        <CardContent className="p-3 sm:p-4">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            {isFetching && !isLoading && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
            )}
            <Input
              placeholder="Search name, industry, location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 rounded-lg border-slate-200 bg-slate-50/60 pl-9 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="rounded-xl border border-slate-200/70 overflow-hidden dark:border-slate-800">
            <Table className="min-w-215">
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:bg-slate-900/60">
                  <TableHead className="text-left font-medium text-slate-500 dark:text-slate-300">Company</TableHead>
                  <TableHead className="text-left font-medium text-slate-500 dark:text-slate-300">Industry</TableHead>
                  <TableHead className="text-left font-medium text-slate-500 dark:text-slate-300">Location</TableHead>
                  <TableHead className="text-left font-medium text-slate-500 dark:text-slate-300">Employees</TableHead>
                  <TableHead className="text-left font-medium text-slate-500 dark:text-slate-300">Revenue</TableHead>
                  <TableHead className="w-32 text-left font-medium text-slate-500 dark:text-slate-300">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && companies.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-16">
                      <Building2 className="h-9 w-10 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {debouncedSearch ? "No companies match your search." : "No companies yet."}
                      </p>
                    </TableCell>
                  </TableRow>
                )}
                {companies.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer border-slate-100 transition-colors hover:bg-blue-50/40 dark:border-slate-800/80 dark:hover:bg-slate-800/40"
                    onClick={() => setViewing(c)}
                  >
                    <TableCell className="text-left">
                      <div className="flex items-center justify-start gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarColors[c.id % avatarColors.length]}`}
                        >
                          {getInitials(c.name)}
                        </div>
                        <div className="min-w-0 text-left">
                          <div className="font-medium text-slate-800 dark:text-white">{c.name}</div>
                          {c.website && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Globe className="h-3 w-3 shrink-0" />
                              <span className="truncate">{c.website}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-left">
                      {c.industry ? (
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${industryPill(c.industry)}`}>
                          {c.industry}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-left text-sm text-slate-700 dark:text-slate-200">
                      {[c.city, c.country].filter(Boolean).length > 0 ? (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          {[c.city, c.country].filter(Boolean).join(", ")}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-left text-sm text-slate-700 dark:text-slate-200">
                      {c.employee_count ? Number(c.employee_count).toLocaleString("en-IN") : "—"}
                    </TableCell>
                    <TableCell className="text-left text-sm font-semibold text-slate-800 dark:text-white">
                      {formatRevenue(c.annual_revenue) ?? "—"}
                    </TableCell>
                    <TableCell className="text-left" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-start gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 dark:hover:bg-blue-500/30 dark:hover:text-blue-200"
                          title="View"
                          aria-label="View"
                          onClick={() => setViewing(c)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                            title="Edit"
                            aria-label="Edit"
                            onClick={() => openEdit(c)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25"
                            title="Delete"
                            aria-label="Delete"
                            onClick={() => setDeleteTarget(c)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* ───────── Pagination (driven by the API's meta) ───────── */}
          {totalItems > 0 && (
            <PaginationBar
              label="companies"
              testIdPrefix="companies"
              page={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              shown={companies.length}
              pageSizes={PAGE_SIZES}
              onPage={setPage}
              onPageSize={(n) => { setPageSize(n); setPage(1); }}
            />
          )}
        </CardContent>
      </Card>

      {/* ───────── View Company Dialog (read-only) ───────── */}
      <Dialog open={!!viewing} onOpenChange={(o) => { if (!o) setViewing(null); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl border-slate-200 dark:border-slate-800">
          {viewing && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarColors[viewing.id % avatarColors.length]}`}
                  >
                    {getInitials(viewing.name)}
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="truncate">{viewing.name}</DialogTitle>
                    <DialogDescription>
                      {[viewing.industry, [viewing.city, viewing.country].filter(Boolean).join(", ")]
                        .filter(Boolean)
                        .join(" · ") || "Company details"}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <DetailTile label="Employees" tone="violet">
                  {viewing.employee_count ? Number(viewing.employee_count).toLocaleString("en-IN") : "—"}
                </DetailTile>
                <DetailTile label="Annual Revenue" tone="orange">{formatRevenue(viewing.annual_revenue) ?? "—"}</DetailTile>
                <DetailTile label="Industry" tone="blue">{viewing.industry || "—"}</DetailTile>
                <DetailTile label="Created" tone="green">
                  {viewing.created_at
                    ? new Date(viewing.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                    : "—"}
                </DetailTile>
              </div>

              <div className="grid grid-cols-1 gap-x-6 gap-y-4 py-2 sm:grid-cols-2">
                <DetailRow icon={Globe} label="Website" value={viewing.website} />
                <DetailRow icon={Mail} label="Email" value={viewing.email} />
                <DetailRow icon={Phone} label="Phone" value={viewing.phone} />
                <DetailRow icon={MapPin} label="Location" value={[viewing.city, viewing.country].filter(Boolean).join(", ")} />
                <div className="sm:col-span-2">
                  <DetailRow label="Notes" value={viewing.notes} />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" className="rounded-lg" onClick={() => setViewing(null)}>Close</Button>
                {canEdit && (
                  <Button
                    className="rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    onClick={() => { const c = viewing; setViewing(null); openEdit(c); }}
                  >
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ───────── Create / Edit Company Dialog ───────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300">
                <Building2 className="h-4 w-4" />
              </span>
              {editing ? "Edit company" : "New company"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid min-w-0 grid-cols-1 gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label className={FIELD_LABEL}>Name *</Label><Input className={FIELD} value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} /></div>
            <div className="space-y-1.5"><Label className={FIELD_LABEL}>Industry</Label><Input className={FIELD} value={form.industry} onChange={(e) => setForm({...form, industry: e.target.value})} /></div>
            <div className="space-y-1.5"><Label className={FIELD_LABEL}>Website</Label><Input className={FIELD} value={form.website} onChange={(e) => setForm({...form, website: e.target.value})} /></div>
            <div className="space-y-1.5"><Label className={FIELD_LABEL}>Email</Label><Input className={FIELD} value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} /></div>
            <div className="space-y-1.5"><Label className={FIELD_LABEL}>Phone</Label><Input className={FIELD} value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} /></div>
            <div className="space-y-1.5"><Label className={FIELD_LABEL}>City</Label><Input className={FIELD} value={form.city} onChange={(e) => setForm({...form, city: e.target.value})} /></div>
            <div className="space-y-1.5"><Label className={FIELD_LABEL}>Country</Label><Input className={FIELD} value={form.country} onChange={(e) => setForm({...form, country: e.target.value})} /></div>
            <div className="space-y-1.5"><Label className={FIELD_LABEL}>Employees</Label><Input className={FIELD} type="number" value={form.employee_count} onChange={(e) => setForm({...form, employee_count: Number(e.target.value)})} /></div>
            <div className="space-y-1.5"><Label className={FIELD_LABEL}>Annual Revenue (₹)</Label><Input className={FIELD} type="number" value={form.annual_revenue} onChange={(e) => setForm({...form, annual_revenue: Number(e.target.value)})} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label className={FIELD_LABEL}>Notes</Label><Textarea className="rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-900/70" rows={3} value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-lg" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───────── Delete confirmation ───────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this company?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleteTarget?.name || "this company"}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={del.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) del.mutate(deleteTarget.id);
              }}
            >
              {del.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============ HELPERS ============
const statTones: Record<string, { card: string; icon: string }> = {
  blue: {
    card: "from-blue-50 to-white border-blue-100 dark:from-blue-950 dark:to-slate-950 dark:border-blue-500/40",
    icon: "bg-blue-100 text-blue-600 dark:bg-blue-500/25 dark:text-blue-300",
  },
  green: {
    card: "from-green-50 to-white border-green-100 dark:from-emerald-950 dark:to-slate-950 dark:border-emerald-500/40",
    icon: "bg-green-100 text-green-600 dark:bg-emerald-500/25 dark:text-emerald-300",
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
  orange: "border-orange-100 bg-orange-50 dark:border-orange-500/30 dark:bg-orange-500/10",
  green: "border-emerald-100 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10",
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

function DetailRow({ label, value, icon: Icon }: { label: string; value?: string | null; icon?: IconType }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />} {label}
      </div>
      <div className="mt-1 wrap-break-word whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">{value || "—"}</div>
    </div>
  );
}

// ============ PAGINATION BAR ============
// "Showing 1–10 of 15 contacts | Rows per page [10]      ‹ Prev  1  2  Next ›"
function pageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(total - 1, current + 1);
  if (from > 2) out.push("…");
  for (let i = from; i <= to; i++) out.push(i);
  if (to < total - 1) out.push("…");
  out.push(total);
  return out;
}

function PaginationBar({
  label, testIdPrefix, page, totalPages, totalItems, pageSize, shown, pageSizes, onPage, onPageSize,
}: {
  label: string;
  testIdPrefix: string;
  page: number;        // 1-based
  totalPages: number;
  totalItems: number;
  pageSize: number;
  shown: number;       // rows on the current page
  pageSizes: number[];
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
}) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(totalItems, (page - 1) * pageSize + shown);

  const navBtn =
    "inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 " +
    "disabled:pointer-events-none disabled:text-slate-400 disabled:opacity-60 " +
    "dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800 dark:disabled:text-slate-500";

  return (
    <div
      className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-sm"
      data-testid={`${testIdPrefix}-pagination`}
    >
      {/* Left: range + rows per page */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-slate-500 dark:text-slate-400">
        <span data-testid={`${testIdPrefix}-page-info`}>
          Showing{" "}
          <span className="font-semibold text-slate-900 dark:text-white">{start}–{end}</span>{" "}
          of{" "}
          <span className="font-semibold text-slate-900 dark:text-white">{totalItems}</span>{" "}
          {label}
        </span>
        <span className="hidden h-5 w-px bg-slate-200 sm:block dark:bg-slate-700" />
        <div className="flex items-center gap-2">
          <span>Rows per page</span>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))}>
            <SelectTrigger
              className="h-9 w-21 rounded-xl border-slate-200 bg-white text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
              data-testid={`${testIdPrefix}-page-size`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizes.map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Right: Prev · 1 2 3 · Next */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className={navBtn}
          data-testid={`${testIdPrefix}-prev`}
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>

        {pageList(page, totalPages).map((p, i) =>
          p === "…" ? (
            <span key={`dots-${i}`} className="px-1 text-slate-400">…</span>
          ) : (
            <button
              key={p}
              type="button"
              aria-current={p === page ? "page" : undefined}
              onClick={() => onPage(p)}
              className={`h-9 min-w-9 rounded-xl px-2 text-sm font-medium transition-colors ${
                p === page
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 hover:bg-blue-700"
                  : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {p}
            </button>
          ),
        )}

        <button
          type="button"
          className={navBtn}
          data-testid={`${testIdPrefix}-next`}
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}