/**
 * Clients & Buyers — CRUD for buyer records with KYC status.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  listLeads, createLead, updateLead, deleteLead,
} from "@/lib/realestate.functions";
import { cr } from "@/lib/re-data";

export const Route = createFileRoute("/_authenticated/realestate/clients")({
  component: ClientsPage,
});

const KYC = ["pending", "verified", "rejected"];
const empty = {
  full_name: "", phone: "", email: "",
  budget_min: "", budget_max: "", preferred_city: "",
  preferred_location: "", kyc_status: "pending", requirement: "",
};

function ClientsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["re-leads", q],
    queryFn: () => listLeads({ search: q || undefined }),
  });

  const save = async () => {
    if (!form.full_name?.trim()) return toast.error("Name is required");
    const body = {
      ...form,
      budget_min: form.budget_min ? Number(form.budget_min) : null,
      budget_max: form.budget_max ? Number(form.budget_max) : null,
    };
    try {
      if (edit) await updateLead(edit.id, body);
      else await createLead(body);
      toast.success(edit ? "Client updated" : "Client added");
      setOpen(false);
      setEdit(null);
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["re-leads"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const del = async (id: number) => {
    if (!confirm("Delete this client?")) return;
    try {
      await deleteLead(id);
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["re-leads"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const openEdit = (row: any) => {
    setEdit(row);
    setForm({ ...empty, ...row, budget_min: row.budget_min ?? "", budget_max: row.budget_max ?? "" });
    setOpen(true);
  };

  const kycColor = (s: string) =>
    s === "verified" ? "bg-emerald-100 text-emerald-700"
    : s === "rejected" ? "bg-red-100 text-red-700"
    : "bg-amber-100 text-amber-700";

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Clients & Buyers</h2>
          <p className="text-sm text-muted-foreground">Manage buyers, requirements and KYC.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search name/phone/email"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-64"
          />
          <Button onClick={() => { setEdit(null); setForm(empty); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />Add Client
          </Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Budget</TableHead>
              <TableHead>Preferences</TableHead>
              <TableHead>KYC</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : !rows.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  No clients yet. Add your first buyer.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.full_name}</TableCell>
                  <TableCell className="text-xs">
                    {r.phone}<br />
                    <span className="text-muted-foreground">{r.email}</span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.budget_min ? cr(r.budget_min) : "—"} – {r.budget_max ? cr(r.budget_max) : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.preferred_city || "—"} · {r.preferred_location || "any"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={kycColor(r.kyc_status)}>{r.kyc_status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => del(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit ? "Edit Client" : "New Client"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2 py-2">
            <Input placeholder="Full name *" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Select value={form.kyc_status} onValueChange={(v) => setForm({ ...form, kyc_status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {KYC.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Budget min" type="number" value={form.budget_min} onChange={(e) => setForm({ ...form, budget_min: e.target.value })} />
            <Input placeholder="Budget max" type="number" value={form.budget_max} onChange={(e) => setForm({ ...form, budget_max: e.target.value })} />
            <Input placeholder="Preferred city" value={form.preferred_city} onChange={(e) => setForm({ ...form, preferred_city: e.target.value })} />
            <Input placeholder="Preferred location" value={form.preferred_location} onChange={(e) => setForm({ ...form, preferred_location: e.target.value })} />
            <Textarea className="md:col-span-2" placeholder="Requirements / notes" value={form.requirement} onChange={(e) => setForm({ ...form, requirement: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!form.full_name}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}