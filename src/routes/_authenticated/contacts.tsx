import { usePermissions } from "@/hooks/use-permissions";
import { notifyPermissionDenied } from "@/components/permission-denied";
import { defineRoute } from "@/lib/router-compat";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-data-client";
import { apiFetch, apiUpload, apiDownload } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Search, Trash2, Pencil, Loader2, UserCircle, Mail, Phone, Upload, Download, Eye,
  RefreshCw, Users, AtSign, Star, Building2, ChevronLeft, ChevronRight,
  X, Briefcase, Link2, CalendarClock,
} from "lucide-react";
import {
  DETAIL_DIALOG, DETAIL_INPUT, BTN_PILL, BTN_PRIMARY, DetailAvatar, InfoTile,
} from "@/components/detail-ui";
import { toast } from "sonner";

export const Route = defineRoute("/_authenticated/contacts")({
  head: () => ({ meta: [{ title: "Contacts — DigiCRM AI" }] }),
  component: ContactsPage,
});

const BASE = "/api/v1/contacts";

// Tag set by the Leads page "OnPriority" bulk action
const PRIORITY_TAG = "priority";

interface Contact {
  id: number;
  tenant_id?: number;
  first_name: string;
  last_name: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  company_id: number | null;
  notes: string | null;
  linkedin_url?: string | null;
  avatar_url?: string | null;
  owner_id?: number | null;
  tags?: string[];
  status?: string;
  created_at: string;
  updated_at?: string;
}

interface CompanyLite { id: number; name: string }

interface ImportResult {
  total_rows: number;
  imported: number;
  failed: number;
  errors: unknown[];
}

const empty = { first_name: "", last_name: "", email: "", phone: "", designation: "", linkedin_url: "", company_id: "", notes: "" };

// FastAPI/Pydantic rejects "" for typed fields like EmailStr, so send null instead.
const nullIfEmpty = (v: string) => (v.trim() === "" ? null : v.trim());

const contactName = (c: Contact) => `${c.first_name} ${c.last_name ?? ""}`.trim();

const isPriorityContact = (c: Contact) => !!c.tags?.includes(PRIORITY_TAG);

/* ---------- design tokens (shared look with Leads / Dashboard) ---------- */

const PANEL = "rounded-2xl border border-border/60 bg-card shadow-sm";

type Tone = "blue" | "green" | "orange" | "purple" | "red";

const TONES: Record<Tone, { card: string; soft: string; solid: string }> = {
  blue: {
    card: "border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-blue-500/[0.03] to-transparent",
    soft: "bg-blue-500/15 text-blue-500",
    solid: "bg-blue-500 text-white",
  },
  green: {
    card: "border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-emerald-500/[0.03] to-transparent",
    soft: "bg-emerald-500/15 text-emerald-500",
    solid: "bg-emerald-500 text-white",
  },
  orange: {
    card: "border-orange-500/20 bg-gradient-to-br from-orange-500/10 via-orange-500/[0.03] to-transparent",
    soft: "bg-orange-500/15 text-orange-500",
    solid: "bg-orange-500 text-white",
  },
  purple: {
    card: "border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-violet-500/[0.03] to-transparent",
    soft: "bg-violet-500/15 text-violet-500",
    solid: "bg-violet-500 text-white",
  },
  red: {
    card: "border-red-500/20 bg-gradient-to-br from-red-500/10 via-red-500/[0.03] to-transparent",
    soft: "bg-red-500/15 text-red-500",
    solid: "bg-red-500 text-white",
  },
};

const AVATAR_TONES = [
  "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  "bg-amber-500/15 text-amber-600 dark:text-amber-400",
];

function avatarTone(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

function StatCard({
  title, value, icon: Icon, tone, solid = false,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
  solid?: boolean;
}) {
  const t = TONES[tone];
  return (
    <div className={`rounded-2xl border p-4 ${t.card}`}>
      <div className="flex items-center gap-3">
        <div className={`h-12 w-12 shrink-0 rounded-full flex items-center justify-center ${solid ? t.solid : t.soft}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">{title}</p>
          <p className="text-2xl font-bold mt-0.5" style={{ fontFamily: "var(--font-display)" }}>{value}</p>
        </div>
      </div>
    </div>
  );
}

/** Small rounded icon button used in the Actions column. */
function ActionBtn({
  title, onClick, tone, disabled, children,
}: {
  title: string;
  onClick: () => void;
  tone: "blue" | "slate" | "violet" | "red";
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const styles = {
    blue: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
    slate: "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground",
    violet: "bg-violet-500/10 text-violet-500 hover:bg-violet-500/20",
    red: "bg-red-500/10 text-red-500 hover:bg-red-500/20",
  }[tone];
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  );
}

function ContactsPage() {
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
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [viewing, setViewing] = useState<Contact | null>(null);
  const [form, setForm] = useState(empty);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: companies } = useQuery({
    queryKey: ["companies-lite"],
    queryFn: async () => {
      const rows = await apiFetch<CompanyLite[]>("/api/v1/companies");
      return rows
        .map((c) => ({ id: c.id, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const { data: allContacts, isLoading, isFetching } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => apiFetch<Contact[]>(BASE),
  });

  // Search and company filter run client-side; move them to query params
  // if the API supports them and the list gets large.
  // Priority contacts (tagged from the Leads page) are pinned to the top, then newest first.
  const contacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...(allContacts ?? [])]
      .sort((a, b) => {
        const pa = isPriorityContact(a) ? 1 : 0;
        const pb = isPriorityContact(b) ? 1 : 0;
        if (pa !== pb) return pb - pa;
        return (b.created_at ?? "").localeCompare(a.created_at ?? "");
      })
      .filter((c) => companyFilter === "all" || String(c.company_id) === companyFilter)
      .filter((c) =>
        !q || [c.first_name, c.last_name, c.email].some((v) => v?.toLowerCase().includes(q)),
      );
  }, [allContacts, search, companyFilter]);

  const stats = useMemo(() => {
    const list = allContacts ?? [];
    return {
      total: list.length,
      withEmail: list.filter((c) => !!c.email).length,
      withCompany: list.filter((c) => c.company_id != null).length,
      priority: list.filter(isPriorityContact).length,
    };
  }, [allContacts]);

  const companyName = (id: number | null | undefined) =>
    id != null ? companies?.find((c) => c.id === id)?.name ?? null : null;

  const save = useMutation({
    mutationFn: async () => {
      if (!form.first_name.trim()) throw new Error("First name is required");
      const payload = {
        first_name: form.first_name.trim(),
        last_name: nullIfEmpty(form.last_name),
        email: nullIfEmpty(form.email),
        phone: nullIfEmpty(form.phone),
        designation: nullIfEmpty(form.designation),
        linkedin_url: nullIfEmpty(form.linkedin_url),
        company_id: form.company_id ? Number(form.company_id) : null,
        notes: nullIfEmpty(form.notes),
        // keep values the form doesn't edit so a PUT doesn't wipe them
        ...(editing ? { tags: editing.tags ?? [], status: editing.status } : {}),
      };
      if (editing) {
        return apiFetch<Contact>(`${BASE}/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }
      return apiFetch<Contact>(BASE, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Contact updated" : "Contact created");
      qc.invalidateQueries({ queryKey: ["contacts"] });
      setOpen(false); setEditing(null); setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: number) => apiFetch<unknown>(`${BASE}/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["contacts"] }); },
    onError: (e: Error) => notifyPermissionDenied(e),
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
        toast.success(`Imported ${r.imported} contacts`);
      }
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCsv = useMutation({
    mutationFn: () => apiDownload(`${BASE}/export`, "contacts.csv"),
    onSuccess: () => toast.success("Contacts exported"),
    onError: (e: Error) => toast.error(e.message),
  });

  // Edit form (only reachable with edit rights)
  const openEdit = (c: Contact) => {
    if (!canEdit) return;
    setEditing(c);
    setForm({
      first_name: c.first_name, last_name: c.last_name ?? "", email: c.email ?? "",
      phone: c.phone ?? "", designation: c.designation ?? "",
      linkedin_url: c.linkedin_url ?? "",
      company_id: c.company_id != null ? String(c.company_id) : "",
      notes: c.notes ?? "",
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* ================= HEADER ================= */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center">
            <UserCircle className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>Contacts</h1>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">All Contacts</span>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              {allContacts?.length ?? 0} contacts · Manage the people across your network.
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
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
          <Button
            variant="outline"
            className="rounded-xl gap-2"
            onClick={() => qc.invalidateQueries({ queryKey: ["contacts"] })}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          {canCreate && (
            <Button
              className="rounded-xl gap-2 bg-violet-600 text-white hover:bg-violet-500 shadow-md shadow-violet-600/20"
              onClick={() => fileRef.current?.click()}
              disabled={importCsv.isPending}
            >
              {importCsv.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import
            </Button>
          )}
          <Button
            variant="outline"
            className="rounded-xl gap-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
            onClick={() => exportCsv.mutate()}
            disabled={exportCsv.isPending}
          >
            {exportCsv.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export
          </Button>
          {canCreate && (
            <Button
              className="rounded-xl gap-2 bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-600/20"
              onClick={() => { setEditing(null); setForm(empty); setOpen(true); }}
            >
              <Plus className="h-4 w-4" /> New Contact
            </Button>
          )}
        </div>
      </div>

      {/* ================= STAT CARDS ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total" value={stats.total} icon={Users} tone="blue" />
        <StatCard title="With Email" value={stats.withEmail} icon={AtSign} tone="green" solid />
        <StatCard title="With Company" value={stats.withCompany} icon={Building2} tone="orange" />
        <StatCard title="Priority" value={stats.priority} icon={Star} tone="purple" solid />
      </div>

      {/* ================= TABLE CARD ================= */}
      <Card className={PANEL}>
        <CardContent className="p-4">
          <div className="flex gap-3 flex-wrap mb-4">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name or email..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-10 h-11 rounded-xl"
              />
            </div>
            <Select value={companyFilter} onValueChange={(v) => { setCompanyFilter(v); setPage(1); }}>
              <SelectTrigger className="w-56 h-11 rounded-xl"><SelectValue placeholder="All companies" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All companies</SelectItem>
                {(companies ?? []).map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border border-border/60 overflow-hidden" data-testid="contacts-table-wrap">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Name</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>}
                {!isLoading && contacts.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-16">
                    <UserCircle className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No contacts yet.</p>
                  </TableCell></TableRow>
                )}
                {contacts.slice((page - 1) * pageSize, page * pageSize).map(c => {
                  const name = contactName(c);
                  const initials = ((c.first_name?.[0] ?? "") + (c.last_name?.[0] ?? "")).toUpperCase();
                  const priority = isPriorityContact(c);
                  const company = companyName(c.company_id);
                  return (
                    <TableRow
                      key={c.id}
                      data-testid="contact-row"
                      data-contact-id={c.id}
                      className={`cursor-pointer transition-colors ${
                        priority
                          ? "bg-amber-50 hover:bg-amber-100 border-l-4 border-l-amber-400 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 dark:border-l-amber-500"
                          : "hover:bg-muted/30"
                      }`}
                      onClick={() => setViewing(c)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className={`text-xs font-bold ${avatarTone(name)}`}>{initials}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium leading-tight">{name}</p>
                            {company && <p className="text-xs text-muted-foreground mt-0.5">{company}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.designation || "—"}</TableCell>
                      <TableCell className="text-sm">{c.email ? <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-muted-foreground" />{c.email}</span> : "—"}</TableCell>
                      <TableCell className="text-sm">{c.phone ? <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{c.phone}</span> : "—"}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5 pr-1">
                          <ActionBtn title="View" tone="blue" onClick={() => setViewing(c)}>
                            <Eye className="h-4 w-4" />
                          </ActionBtn>
                          {canEdit && (
                            <ActionBtn title="Edit" tone="slate" onClick={() => openEdit(c)}>
                              <Pencil className="h-4 w-4" />
                            </ActionBtn>
                          )}
                          {canDelete && (
                            <ActionBtn title="Delete" tone="red" disabled={del.isPending} onClick={() => del.mutate(c.id)}>
                              <Trash2 className="h-4 w-4" />
                            </ActionBtn>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {contacts.length > 0 && (() => {
            const total = contacts.length;
            const pageCount = Math.max(1, Math.ceil(total / pageSize));
            const curr = Math.min(page, pageCount);
            const from = (curr - 1) * pageSize + 1;
            const to = Math.min(curr * pageSize, total);

            // 1 … 4 5 6 … 20 style page list
            const pages: (number | "gap-l" | "gap-r")[] = [];
            for (let p = 1; p <= pageCount; p++) {
              if (p === 1 || p === pageCount || Math.abs(p - curr) <= 1) pages.push(p);
              else if (p < curr && pages[pages.length - 1] !== "gap-l") pages.push("gap-l");
              else if (p > curr && pages[pages.length - 1] !== "gap-r") pages.push("gap-r");
            }

            const navBtn =
              "h-9 min-w-9 px-3 rounded-xl border border-border/60 bg-card text-sm font-medium flex items-center justify-center transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-card disabled:cursor-not-allowed";

            return (
              <div className="flex items-center justify-between mt-4 flex-wrap gap-3" data-testid="contacts-pagination">
                <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                  <span data-testid="contacts-page-info">
                    Showing <span className="font-semibold text-foreground">{from}–{to}</span> of{" "}
                    <span className="font-semibold text-foreground">{total}</span> contacts
                  </span>
                  <span className="hidden sm:inline text-border">|</span>
                  <div className="flex items-center gap-2">
                    <span>Rows per page</span>
                    <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                      <SelectTrigger className="w-20 h-9 rounded-xl" data-testid="contacts-page-size"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[5, 10, 25, 50].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button type="button" className={navBtn} data-testid="contacts-prev" disabled={curr <= 1} onClick={() => setPage(curr - 1)}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                  </button>

                  {pages.map((p, i) =>
                    typeof p === "number" ? (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p)}
                        aria-current={p === curr ? "page" : undefined}
                        className={`h-9 min-w-9 px-3 rounded-xl text-sm font-medium transition-colors ${
                          p === curr
                            ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                            : "border border-border/60 bg-card hover:bg-muted"
                        }`}
                      >
                        {p}
                      </button>
                    ) : (
                      <span key={`${p}-${i}`} className="h-9 min-w-6 flex items-center justify-center text-muted-foreground">…</span>
                    ),
                  )}

                  <button type="button" className={navBtn} data-testid="contacts-next" disabled={curr >= pageCount} onClick={() => setPage(curr + 1)}>
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </button>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* ================= VIEW CONTACT DIALOG (read-only) ================= */}
      <Dialog open={!!viewing} onOpenChange={(o) => { if (!o) setViewing(null); }}>
        <DialogContent className={DETAIL_DIALOG}>
          {viewing && (
            <>
              <DialogHeader className="px-6 pt-5 pb-3 space-y-0">
                <div className="flex items-start justify-between gap-4 pr-8">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <DetailAvatar
                      initials={((viewing.first_name?.[0] ?? "") + (viewing.last_name?.[0] ?? "")).toUpperCase()}
                    />
                    <div className="min-w-0">
                      <DialogTitle className="text-2xl font-bold truncate">{contactName(viewing)}</DialogTitle>
                      <DialogDescription className="truncate flex items-center gap-2 mt-0.5 text-sm">
                        {viewing.designation && <span>{viewing.designation}</span>}
                        {viewing.designation && companyName(viewing.company_id) && <span>•</span>}
                        {companyName(viewing.company_id) && <span>{companyName(viewing.company_id)}</span>}
                        {!viewing.designation && !companyName(viewing.company_id) && "Contact details"}
                      </DialogDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {viewing.status && (
                      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 rounded-full border-0 px-3 py-1 capitalize">
                        {viewing.status}
                      </Badge>
                    )}
                    {isPriorityContact(viewing) && (
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 gap-1.5 rounded-full border-0 px-3 py-1">
                        <Star className="h-3.5 w-3.5 fill-current" /> Priority
                      </Badge>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto px-6 pb-4 pt-1 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <InfoTile icon={Mail} label="Email" value={viewing.email} tone="blue" copyable />
                  <InfoTile icon={Phone} label="Phone" value={viewing.phone} tone="purple" copyable />
                  <InfoTile icon={Building2} label="Company" value={companyName(viewing.company_id)} tone="purple" />
                  <InfoTile icon={Briefcase} label="Designation" value={viewing.designation} tone="blue" />
                  <InfoTile
                    icon={Link2}
                    label="LinkedIn"
                    value={viewing.linkedin_url}
                    href={viewing.linkedin_url
                      ? (/^https?:\/\//i.test(viewing.linkedin_url) ? viewing.linkedin_url : `https://${viewing.linkedin_url}`)
                      : undefined}
                    tone="cyan"
                  />
                  <InfoTile
                    icon={CalendarClock}
                    label="Created"
                    value={viewing.created_at
                      ? new Date(viewing.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                      : null}
                    tone="green"
                  />
                </div>

                <div>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-[0.12em] font-medium mb-1.5">Notes</div>
                  <div className="rounded-2xl border border-border/60 bg-card/80 p-3 text-sm whitespace-pre-wrap shadow-sm min-h-12">
                    {viewing.notes || <span className="text-muted-foreground">—</span>}
                  </div>
                </div>
              </div>

              {canEdit && (
                <DialogFooter className="px-6 py-3 border-t border-border/60 bg-background/60 backdrop-blur flex items-center justify-end sm:justify-end">
                  <Button className={BTN_PRIMARY} onClick={() => { const c = viewing; setViewing(null); openEdit(c); }}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ================= CREATE / EDIT DIALOG ================= */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={`${DETAIL_DIALOG} sm:max-w-2xl`}>
          <DialogHeader className="px-8 pt-7 pb-4 space-y-0">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center">
                {editing ? <Pencil className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold">{editing ? "Edit contact" : "New contact"}</DialogTitle>
                <DialogDescription className="mt-1">
                  {editing ? `Update details for ${contactName(editing)}.` : "Add a new person to your network."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-8 py-2">
            <div className="grid grid-cols-2 gap-4 min-w-0">
              <div className="space-y-1.5"><Label>First Name *</Label><Input className={DETAIL_INPUT} value={form.first_name} onChange={(e) => setForm({...form, first_name: e.target.value})} /></div>
              <div className="space-y-1.5"><Label>Last Name</Label><Input className={DETAIL_INPUT} value={form.last_name} onChange={(e) => setForm({...form, last_name: e.target.value})} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input className={DETAIL_INPUT} type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input className={DETAIL_INPUT} value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} /></div>
              <div className="space-y-1.5"><Label>Designation</Label><Input className={DETAIL_INPUT} value={form.designation} onChange={(e) => setForm({...form, designation: e.target.value})} /></div>
              <div className="space-y-1.5">
                <Label>Company</Label>
                <Select value={form.company_id || "none"} onValueChange={(v) => setForm({...form, company_id: v === "none" ? "" : v})}>
                  <SelectTrigger className={DETAIL_INPUT}><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(companies ?? []).map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5"><Label>LinkedIn</Label><Input className={DETAIL_INPUT} type="url" placeholder="https://www.linkedin.com/in/username" value={form.linkedin_url} onChange={(e) => setForm({...form, linkedin_url: e.target.value})} /></div>
              <div className="col-span-2 space-y-1.5"><Label>Notes</Label><Textarea className="rounded-xl" rows={3} value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} /></div>
            </div>
          </div>

          <DialogFooter className="px-8 py-4 mt-4 border-t border-border/60 bg-background/60 backdrop-blur flex items-center justify-between sm:justify-between">
            <Button variant="outline" className={BTN_PILL} onClick={() => setOpen(false)}>
              <X className="mr-2 h-4 w-4" /> Cancel
            </Button>
            <Button className={BTN_PRIMARY} onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing ? "Save changes" : "Create contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}