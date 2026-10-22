import { defineRoute } from "@/lib/router-compat";
import { useQuery, useMutation, useQueryClient } from "@/lib/react-data-client";
import { apiFetch, apiUpload } from "@/lib/api";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, AlertTriangle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export const Route = defineRoute("/_authenticated/agency/desk")({
  head: () => ({ meta: [{ title: "Agency Desk — DigiCRM AI" }] }),
  component: AgencyPage,
});

/* ─── Types matching backend schemas ─────────────────────── */

type StageAvg = {
  stage: string;
  avg_days: number;
  now: number;
  avg_current: number;
};

type StuckDeal = {
  stage: string;
  deal_id: number;
  deal_name: string;
  days_in_stage: number;
  is_stuck: boolean;
};

type AgencyDesk = {
  worst_stage: string | null;
  worst_avg_days: number;
  worst_count_now: number;
  stage_averages: StageAvg[];
  stuck_deals: StuckDeal[];
};

type ClientPortalRow = {
  id: number;
  tenant_id: number;
  deal_id: number | null;
  client_email: string;
  contract_type: string | null;
  title: string | null;
  notes: string | null;
  link: string | null;
  file_path: string | null;
  kind: string;
  status: string;
  created_at: string;
};

type Invoice = {
  id: number;
  tenant_id: number;
  client_id: number | null;
  number: string;
  amount: number;
  currency: string;
  status: string;
  issued_at: string | null;
  due_at: string | null;
  paid_at: string | null;
  notes: string | null;
};

type Tab = "stuck" | "portal" | "invoices";

/* ─── Page ────────────────────────────────────────────────── */

function AgencyPage() {
  const [tab, setTab] = useState<Tab>("stuck");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Agency Desk</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Share work with clients and spot stuck deals.
        </p>
      </div>

      <div className="flex gap-2">
        <TabButton active={tab === "stuck"} onClick={() => setTab("stuck")}>
          Where deals get stuck
        </TabButton>
        <TabButton active={tab === "portal"} onClick={() => setTab("portal")}>
          Client portal
        </TabButton>
        <TabButton active={tab === "invoices"} onClick={() => setTab("invoices")}>
          Invoices
        </TabButton>
      </div>

      {tab === "stuck" && <StuckTab />}
      {tab === "portal" && <ClientPortalTab />}
      {tab === "invoices" && <InvoicesTab />}
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary/50"
      }`}
    >
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════
   TAB 1 — WHERE DEALS GET STUCK
   ═══════════════════════════════════════════════════════════ */

function StuckTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["agency-desk"],
    queryFn: () => apiFetch<AgencyDesk>("/api/v1/agency/desk"),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorBlock message={(error as Error).message} />;

  const desk = data ?? {
    worst_stage: null,
    worst_avg_days: 0,
    worst_count_now: 0,
    stage_averages: [],
    stuck_deals: [],
  };

  return (
    <>
      {desk.worst_stage && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm">
              <span className="font-semibold">
                Biggest bottleneck: {desk.worst_stage}
              </span>{" "}
              — deals spend {desk.worst_avg_days} days here on average (
              {desk.worst_count_now} there now).
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Average days in each stage</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Deals still in a stage count up to today.
          </p>
        </CardHeader>
        <CardContent>
          {desk.stage_averages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No deal stage data yet.
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={desk.stage_averages}
                  margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                >
                  <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="avg_days" radius={[6, 6, 0, 0]}>
                    {desk.stage_averages.map((_, i) => (
                      <Cell
                        key={i}
                        fill={
                          i === 0
                            ? "hsl(var(--destructive))"
                            : "hsl(var(--primary))"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Where deals stall</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            In their stage 7+ days and 1.5× longer than usual.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {desk.stuck_deals.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No stuck deals right now.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stage</TableHead>
                  <TableHead>Deal</TableHead>
                  <TableHead className="text-right">Days in stage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {desk.stuck_deals.map((d, i) => (
                  <TableRow key={`${d.deal_id}-${i}`}>
                    <TableCell className="font-medium">{d.stage}</TableCell>
                    <TableCell>{d.deal_name}</TableCell>
                    <TableCell className="text-right text-destructive font-medium">
                      {d.days_in_stage}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   TAB 2 — CLIENT PORTAL
   ═══════════════════════════════════════════════════════════ */

function ClientPortalTab() {
  const qc = useQueryClient();

  const [clientEmail, setClientEmail] = useState("");
  const [dealId, setDealId] = useState<string>("");
  const [contractType, setContractType] = useState<string>("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const { data: shares = [], isLoading } = useQuery({
    queryKey: ["agency-shares"],
    queryFn: () => apiFetch<ClientPortalRow[]>("/api/v1/agency/shares"),
  });

  const createShare = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("client_email", clientEmail);
      if (dealId) fd.append("deal_id", dealId);
      if (contractType) fd.append("contract_type", contractType);
      if (title) fd.append("title", title);
      if (notes) fd.append("notes", notes);
      if (link) fd.append("link", link);
      if (file) fd.append("file", file);
      return apiUpload<ClientPortalRow>("/api/v1/agency/share", fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agency-shares"] });
      setClientEmail("");
      setDealId("");
      setContractType("");
      setTitle("");
      setNotes("");
      setLink("");
      setFile(null);
    },
  });

  const canSubmit = clientEmail.trim().length > 0 && !createShare.isPending;

  return (
    <div className="grid gap-4 md:grid-cols-[420px_1fr]">
      {/* LEFT — Share form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Share with a client</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            The client signs in with this email and opens the Agency Client
            Portal.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Client deal (optional)</Label>
            <Select value={dealId} onValueChange={setDealId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a deal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Deal #1 — Sample</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Client email</Label>
            <Input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="client@example.com"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Contract to review</Label>
            <Select value={contractType} onValueChange={setContractType}>
              <SelectTrigger>
                <SelectValue placeholder="Choose contract" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nda">NDA</SelectItem>
                <SelectItem value="msa">Master Service Agreement</SelectItem>
                <SelectItem value="sow">Statement of Work</SelectItem>
                <SelectItem value="proposal">Proposal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notes or contract terms</Label>
            <textarea
              className="w-full min-h-22 rounded-md border bg-background px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Link (optional)</Label>
            <Input value={link} onChange={(e) => setLink(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Choose File</Label>
            <Input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <Button
            className="w-full"
            disabled={!canSubmit}
            onClick={() => createShare.mutate()}
          >
            {createShare.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Share
          </Button>

          {createShare.isError && (
            <p className="text-xs text-destructive">
              {(createShare.error as Error).message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* RIGHT — Portal activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Portal activity</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
              Loading…
            </p>
          ) : shares.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing shared yet.</p>
          ) : (
            <ul className="space-y-3">
              {shares.map((s) => (
                <li
                  key={s.id}
                  className="border-b pb-2 last:border-0 last:pb-0 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">
                      {s.title || "(no title)"}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(s.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {s.client_email} · {s.contract_type ?? "—"} · {s.status}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TAB 3 — INVOICES
   ═══════════════════════════════════════════════════════════ */

function InvoicesTab() {
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["agency-invoices"],
    queryFn: () => apiFetch<Invoice[]>("/api/v1/agency/invoices"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Client invoices</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Download a printable PDF. Clients see invoices sent to their email in
          their portal. Create invoices in Payments &amp; Ledger.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">
            <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
            Loading…
          </p>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invoices yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.number}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {inv.client_id ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {inv.currency} {inv.amount.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        inv.status === "paid"
                          ? "text-green-600"
                          : inv.status === "overdue"
                          ? "text-destructive"
                          : ""
                      }
                    >
                      {inv.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {inv.issued_at
                      ? new Date(inv.issued_at).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {inv.due_at
                      ? new Date(inv.due_at).toLocaleDateString()
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

function Loading() {
  return (
    <Card>
      <CardContent className="p-6 text-sm text-muted-foreground">
        <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
        Loading…
      </CardContent>
    </Card>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <Card className="border-destructive/40">
      <CardContent className="p-6 text-sm text-destructive">
        <AlertTriangle className="inline h-4 w-4 mr-2" />
        {message}
      </CardContent>
    </Card>
  );
}