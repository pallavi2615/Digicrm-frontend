import { RoleGuard, ADMINS } from "@/components/role-guard";
import { defineRoute } from "@/lib/router-compat";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-data-client";
import { useState } from "react";
import { apiFetch, apiUpload, API_URL } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Building2, Plus, Copy, Loader2, ShieldAlert, Mail, Search,
  FileText, Upload, CheckCircle2, XCircle, Trash2, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

// ============================================================
// TYPES (match app/schemas/tenant.py + tenant_document.py)
// ============================================================

type TenantListItem = {
  id: number;
  name: string;
  subdomain: string | null;
  status: string;
  created_at?: string;
  lead_count?: number;
  proposal_count?: number;
  user_count?: number;
};

type IndustryTemplates = Record<string, { label: string; industries: string[] }>;

type CreatePayload = {
  name: string;
  slug: string;
  admin_email: string;
  admin_full_name: string;
  plan: string;
  industry_template: string;
  draft_id?: string; // required by backend — set from the documents step
  tagline?: string;
  primary_color?: string;
  accent_color?: string;
  logo_url?: string;
  custom_domain?: string;
};

type CreateResponse = {
  tenant_id: number;
  tenant_name: string;
  tenant_slug: string;
  admin_user_id: number;
  admin_email: string;
  admin_full_name: string;
  temp_password: string;
  email_sent: boolean;
  email_error: string | null;
  industries_assigned: string[];
};

type ResendResponse = {
  success: boolean;
  email_sent: boolean;
  email_error: string | null;
  temp_password: string;
  admin_email: string;
};

type DocStatus = "pending" | "verified" | "rejected";

type TenantDoc = {
  id: number;
  draft_id?: string | null;
  tenant_id?: number | null;
  document_type: string;
  document_number?: string | null;
  file_name: string;
  file_url: string;
  file_size?: number;
  file_type?: string;
  status: DocStatus;
  rejection_reason?: string | null;
  issued_date?: string | null;
  expiry_date?: string | null;
  created_at?: string;
};

type DraftDocsResponse = { draft_id: string; documents: TenantDoc[] };

// Document types. `value` must match your DocumentType enum values.
// GST + CIN are mandatory on the backend; add optional ones (PAN etc.) here.
const DOC_TYPES: { value: string; label: string; required: boolean }[] = [
  { value: "gst", label: "GST Certificate", required: true },
  { value: "cin", label: "CIN (Certificate of Incorporation)", required: true },
];

// Backend serves /uploads/... — prefix with API origin if frontend is on a different host
const fileHref = (url: string) => (url.startsWith("http") ? url : `${API_URL}${url}`);

// ============================================================
// API HELPERS
// ============================================================

const TENANT_LIST_KEY = ["tenant", "all"];
const draftDocsKey = (draftId: string | null) => ["tenant-documents", "draft", draftId];
const tenantDocsKey = (tenantId: number) => ["tenant-documents", "tenant", tenantId];

const api = {
  list: (search: string, status: string) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status && status !== "all") params.set("status", status);
    params.set("limit", "500");
    return apiFetch<TenantListItem[]>(`/api/v1/tenant/all?${params.toString()}`);
  },
  templates: () => apiFetch<IndustryTemplates>("/api/v1/tenant/templates"),
  create: (payload: CreatePayload) =>
    apiFetch<CreateResponse>("/api/v1/tenant/with-admin", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  resendWelcome: (id: number) =>
    apiFetch<ResendResponse>(`/api/v1/tenant/${id}/resend-welcome`, {
      method: "POST",
    }),

  // ---- tenant-documents ----
    uploadDoc: (args: {
    document_type: string;
    document_number?: string;
    draft_id?: string | null;
    file: File;
  }) => {
    const fd = new FormData();
    fd.append("document_type", args.document_type);
    if (args.document_number) fd.append("document_number", args.document_number);
    if (args.draft_id) fd.append("draft_id", args.draft_id);
    fd.append("file", args.file);
    return apiUpload<TenantDoc>("/api/v1/tenant-documents/upload", fd);
  },
  draftDocs: (draftId: string) =>
    apiFetch<DraftDocsResponse>(`/api/v1/tenant-documents/draft/${draftId}`),
  verifyDoc: (
    id: number,
    body: { status: DocStatus; rejection_reason?: string; document_number?: string },
  ) =>
    apiFetch<TenantDoc>(`/api/v1/tenant-documents/${id}/verify`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteDoc: (id: number) =>
    apiFetch<void>(`/api/v1/tenant-documents/${id}`, { method: "DELETE" }),
  tenantDocs: (tenantId: number) =>
    apiFetch<TenantDoc[]>(`/api/v1/tenant-documents/tenant/${tenantId}`),
};

// ============================================================
// SMALL COMPONENTS
// ============================================================

function CopyField({ value }: { value: string }) {
  return (
    <div className="flex gap-2 items-center">
      <code className="text-[11px] bg-background rounded p-2 flex-1 truncate border">
        {value}
      </code>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          navigator.clipboard.writeText(value);
          toast.success("Copied");
        }}
      >
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}

function slugify(v: string) {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function DocStatusBadge({ status }: { status: DocStatus }) {
  if (status === "verified")
    return <Badge className="bg-green-600 hover:bg-green-600">Verified</Badge>;
  if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="outline">Pending</Badge>;
}

// ============================================================
// ROUTE
// ============================================================

export const Route = defineRoute("/_authenticated/settings-tenants")({
  head: () => ({
    meta: [
      { title: "Tenants — DigiCRM AI" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RoleGuard allow={ADMINS} module="settings-tenants" label="Settings Tenants">
      <SettingsTenants />
    </RoleGuard>
  ),
});

// ============================================================
// MAIN COMPONENT
// ============================================================

function SettingsTenants() {
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes("super_admin");
  const qc = useQueryClient();

  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState<TenantListItem | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: [...TENANT_LIST_KEY, search, status],
    queryFn: () => api.list(search, status),
    enabled: isSuperAdmin,
  });

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <ShieldAlert className="h-10 w-10 text-destructive mx-auto mb-3" />
          <h2 className="font-semibold">Super Admin access required</h2>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Building2 className="h-6 w-6" /> Tenants & White-Labeling
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Multi-tenant workspaces, plans and branded portals.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Tenant
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name or subdomain…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-5 w-5 animate-spin inline" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Leads</TableHead>
                  <TableHead>Proposals</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="font-medium">{t.name}</div>
                      {t.subdomain && (
                        <div className="text-xs text-muted-foreground">
                          /{t.subdomain}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.status === "active" ? "default" : "outline"}>
                        {t.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{t.lead_count ?? "—"}</TableCell>
                    <TableCell className="text-sm">{t.proposal_count ?? "—"}</TableCell>
                    <TableCell className="text-sm">{t.user_count ?? "—"}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setManaging(t)}>
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {tenants.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">
                      <p className="text-sm text-muted-foreground">No tenants found.</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {creating && (
        <CreateTenantDialog
          onClose={() => setCreating(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: TENANT_LIST_KEY })}
        />
      )}
      {managing && (
        <ManageTenantDialog tenant={managing} onClose={() => setManaging(null)} />
      )}
    </div>
  );
}

// ============================================================
// DOCUMENTS STEP (used inside CreateTenantDialog)
// upload → verify/reject → delete   (/tenant-documents/*)
// ============================================================

function DocumentsStep({
  draftId,
  setDraftId,
  docs,
}: {
  draftId: string | null;
  setDraftId: (id: string) => void;
  docs: TenantDoc[];
}) {
  const qc = useQueryClient();
  const refresh = (id: string | null) =>
    qc.invalidateQueries({ queryKey: draftDocsKey(id) });

  const upload = useMutation({
    mutationFn: api.uploadDoc,
    onSuccess: (doc) => {
      const id = doc.draft_id ?? draftId;
      if (id) {
        setDraftId(id);
        refresh(id);
      }
      toast.success("Document uploaded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verify = useMutation({
    mutationFn: (v: Parameters<typeof api.verifyDoc>) => api.verifyDoc(v[0], v[1]),
    onSuccess: (_d, v) => {
      refresh(draftId);
      toast.success(v[1].status === "verified" ? "Document verified" : "Document rejected");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteDoc(id),
    onSuccess: () => {
      refresh(draftId);
      toast.success("Document removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Upload one at a time so two parallel first-uploads can't create two draft_ids
  const busy = upload.isPending || verify.isPending || remove.isPending;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Upload and verify the required documents (JPG, PNG, WebP, PDF or Word, max 10 MB).
        The tenant can only be created once every uploaded document is verified.
      </p>
      {DOC_TYPES.map((def) => {
        const doc = [...docs]
          .filter((d) => d.document_type === def.value)
          .sort((a, b) => b.id - a.id)[0];
        return (
          <DocumentRow
            key={def.value}
            def={def}
            doc={doc}
            busy={busy}
            uploading={upload.isPending && upload.variables?.document_type === def.value}
            onUpload={(file, number) =>
              upload.mutate({
                document_type: def.value,
                document_number: number || undefined,
                draft_id: draftId,
                file,
              })
            }
            onVerify={() => verify.mutate([doc!.id, { status: "verified" }])}
            onReject={(reason) =>
              verify.mutate([doc!.id, { status: "rejected", rejection_reason: reason }])
            }
            onDelete={() => remove.mutate(doc!.id)}
          />
        );
      })}
    </div>
  );
}

function DocumentRow({
  def,
  doc,
  busy,
  uploading,
  onUpload,
  onVerify,
  onReject,
  onDelete,
}: {
  def: { value: string; label: string; required: boolean };
  doc?: TenantDoc;
  busy: boolean;
  uploading: boolean;
  onUpload: (file: File, number: string) => void;
  onVerify: () => void;
  onReject: (reason: string) => void;
  onDelete: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [number, setNumber] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText className="h-4 w-4" />
          {def.label}
          {def.required && <span className="text-destructive">*</span>}
        </div>
        {doc && <DocStatusBadge status={doc.status} />}
      </div>

      {!doc ? (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <div>
            <Label className="text-xs">Document number</Label>
            <Input value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">File</Label>
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button
            size="sm"
            disabled={!file || busy}
            onClick={() => file && onUpload(file, number)}
          >
            {uploading ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Upload className="h-3 w-3 mr-1" />
            )}
            Upload
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <a
              href={fileHref(doc.file_url)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 underline truncate"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{doc.file_name}</span>
            </a>
            {doc.document_number && (
              <span className="text-muted-foreground shrink-0">#{doc.document_number}</span>
            )}
          </div>

          {doc.status === "rejected" && (
            <div className="text-xs text-destructive">
              Rejected{doc.rejection_reason ? `: ${doc.rejection_reason}` : ""}. Delete it and
              upload a corrected file — rejected documents block tenant creation.
            </div>
          )}

          {rejecting && (
            <div className="flex gap-2">
              <Input
                placeholder="Rejection reason (required)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <Button
                size="sm"
                variant="destructive"
                disabled={!reason.trim() || busy}
                onClick={() => {
                  onReject(reason.trim());
                  setRejecting(false);
                  setReason("");
                }}
              >
                Confirm
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRejecting(false)}>
                Cancel
              </Button>
            </div>
          )}

          {!rejecting && (
            <div className="flex gap-2">
              {doc.status !== "verified" && (
                <Button size="sm" variant="outline" disabled={busy} onClick={onVerify}>
                  <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" /> Verify
                </Button>
              )}
              {doc.status !== "rejected" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setRejecting(true)}
                >
                  <XCircle className="h-3 w-3 mr-1 text-destructive" /> Reject
                </Button>
              )}
              <Button size="sm" variant="ghost" disabled={busy} onClick={onDelete}>
                <Trash2 className="h-3 w-3 mr-1" /> Delete
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// CREATE TENANT DIALOG
// Step 1: details  →  Step 2: documents  →  POST /tenant/with-admin
// ============================================================

function CreateTenantDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [form, setForm] = useState<CreatePayload>({
    name: "",
    slug: "",
    admin_email: "",
    admin_full_name: "",
    plan: "starter",
    industry_template: "",
    tagline: "",
    primary_color: "#2563eb",
    accent_color: "#f59e0b",
    logo_url: "",
    custom_domain: "",
  });
  const [result, setResult] = useState<CreateResponse | null>(null);

  const { data: templates } = useQuery({
    queryKey: ["tenant", "templates"],
    queryFn: api.templates,
  });

  const { data: draft } = useQuery({
    queryKey: draftDocsKey(draftId),
    queryFn: () => api.draftDocs(draftId!),
    enabled: !!draftId,
  });
  const docs = draft?.documents ?? [];

  const set = <K extends keyof CreatePayload>(k: K, v: CreatePayload[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {};
      Object.entries(form).forEach(([k, v]) => {
        if (v !== "") payload[k] = v;
      });
      payload.draft_id = draftId;
      return api.create(payload as CreatePayload);
    },
    onSuccess: (res) => {
      toast.success("Tenant created");
      setResult(res);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const detailsValid =
    form.name && form.slug && form.admin_email && form.admin_full_name && form.industry_template;

  // Mirrors backend: every doc verified + all required types present
  const allVerified = docs.length > 0 && docs.every((d) => d.status === "verified");
  const requiredPresent = DOC_TYPES.filter((t) => t.required).every((t) =>
    docs.some((d) => d.document_type === t.value && d.status === "verified"),
  );
  const docsReady = !!draftId && allVerified && requiredPresent;

  // ---- Success screen ----
  if (result) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tenant created: {result.tenant_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <Label className="text-xs">Admin</Label>
              <div>
                {result.admin_full_name} ({result.admin_email})
              </div>
            </div>
            <div>
              <Label className="text-xs">Temporary password (shown once)</Label>
              <CopyField value={result.temp_password} />
            </div>
            <div className="text-xs">
              Industries: {result.industries_assigned.join(", ") || "—"}
            </div>
            {result.email_sent ? (
              <Badge>Welcome email sent</Badge>
            ) : (
              <div className="text-xs text-destructive">
                Email not sent{result.email_error ? `: ${result.email_error}` : ""}. Share the
                password manually.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={onClose}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            New Tenant — {step === 1 ? "Step 1 of 2: Details" : "Step 2 of 2: Documents"}
          </DialogTitle>
        </DialogHeader>

        {/* ---- Step 1: Form ---- */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Company name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => {
                    set("name", e.target.value);
                    set("slug", slugify(e.target.value));
                  }}
                />
              </div>
              <div>
                <Label>Slug / Subdomain *</Label>
                <Input value={form.slug} onChange={(e) => set("slug", slugify(e.target.value))} />
              </div>
              <div>
                <Label>Admin full name *</Label>
                <Input
                  value={form.admin_full_name}
                  onChange={(e) => set("admin_full_name", e.target.value)}
                />
              </div>
              <div>
                <Label>Admin email *</Label>
                <Input
                  type="email"
                  value={form.admin_email}
                  onChange={(e) => set("admin_email", e.target.value)}
                />
              </div>
              <div>
                <Label>Industry template *</Label>
                <Select
                  value={form.industry_template}
                  onValueChange={(v) => set("industry_template", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(templates ?? {}).map(([key, t]) => (
                      <SelectItem key={key} value={key}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Plan</Label>
                <Select value={form.plan} onValueChange={(v) => set("plan", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                Branding (optional)
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Tagline</Label>
                  <Input value={form.tagline} onChange={(e) => set("tagline", e.target.value)} />
                </div>
                <div>
                  <Label>Primary color</Label>
                  <Input
                    type="color"
                    value={form.primary_color}
                    onChange={(e) => set("primary_color", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Accent color</Label>
                  <Input
                    type="color"
                    value={form.accent_color}
                    onChange={(e) => set("accent_color", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Logo URL</Label>
                  <Input value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} />
                </div>
                <div>
                  <Label>Custom domain</Label>
                  <Input
                    placeholder="crm.example.com"
                    value={form.custom_domain}
                    onChange={(e) => set("custom_domain", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---- Step 2: Documents ---- */}
        {step === 2 && (
          <DocumentsStep draftId={draftId} setDraftId={setDraftId} docs={docs} />
        )}

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={() => setStep(2)} disabled={!detailsValid}>
                Next: Documents
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)} disabled={create.isPending}>
                Back
              </Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending || !docsReady}>
                {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Tenant
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// MANAGE TENANT DIALOG
// POST /tenant/{id}/resend-welcome  +  GET /tenant-documents/tenant/{id}
// ============================================================

function ManageTenantDialog({
  tenant,
  onClose,
}: {
  tenant: TenantListItem;
  onClose: () => void;
}) {
  const [resent, setResent] = useState<ResendResponse | null>(null);

  const { data: docs = [], isLoading: docsLoading } = useQuery({
    queryKey: tenantDocsKey(tenant.id),
    queryFn: () => api.tenantDocs(tenant.id),
  });

  const resend = useMutation({
    mutationFn: () => api.resendWelcome(tenant.id),
    onSuccess: (res) => {
      setResent(res);
      toast.success(res.email_sent ? "Welcome email sent" : "Password reset (email failed)");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const docLabel = (t: string) =>
    DOC_TYPES.find((d) => d.value === t)?.label ?? t.toUpperCase();

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage {tenant.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Subdomain</Label>
              <div>{tenant.subdomain ? `/${tenant.subdomain}` : "—"}</div>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <div>
                <Badge variant={tenant.status === "active" ? "default" : "outline"}>
                  {tenant.status}
                </Badge>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
            <div className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
              <FileText className="h-3 w-3" /> Documents
            </div>
            {docsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : docs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No documents on file.</p>
            ) : (
              <ul className="space-y-2">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-medium">{docLabel(d.document_type)}</div>
                      <a
                        href={fileHref(d.file_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="underline truncate block"
                      >
                        {d.file_name}
                      </a>
                      {d.document_number && (
                        <div className="text-muted-foreground">#{d.document_number}</div>
                      )}
                    </div>
                    <DocStatusBadge status={d.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Admin credentials */}
          <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
            <div className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
              <Mail className="h-3 w-3" /> Admin credentials
            </div>
            <p className="text-xs text-muted-foreground">
              Generates a new temporary password for this tenant's admin, forces a password
              change on next login, and re-sends the welcome email.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => resend.mutate()}
              disabled={resend.isPending}
            >
              {resend.isPending && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
              Reset password & resend welcome
            </Button>

            {resent && (
              <div className="space-y-2 pt-2">
                <div className="text-xs">Admin: {resent.admin_email}</div>
                <CopyField value={resent.temp_password} />
                {!resent.email_sent && (
                  <div className="text-xs text-destructive">
                    Email failed{resent.email_error ? `: ${resent.email_error}` : ""}. Share the
                    password manually.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}