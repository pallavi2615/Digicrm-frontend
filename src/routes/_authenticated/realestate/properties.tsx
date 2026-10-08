/**
 * Listings — simplified CRUD for properties (staff view).
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
  listProperties, createProperty, updateProperty, deleteProperty,
} from "@/lib/realestate.functions";
import { cr } from "@/lib/re-data";

export const Route = createFileRoute("/_authenticated/realestate/properties")({
  component: PropertiesPage,
});

const TYPES = ["Apartment", "Villa", "Row House", "Plot", "Commercial", "Shop", "Office"];
const STATUSES = ["available", "hold", "booked", "sold", "rented", "inactive"];

const empty: any = {
  title: "", property_type: "Apartment", city: "", location: "",
  price: "", bhk: "", area_sqft: "", status: "available", images: [],
};

function PropertiesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["re-properties", q],
    queryFn: () => listProperties({ search: q || undefined }),
  });

  const save = async () => {
    if (!form.title?.trim()) return toast.error("Title is required");
    const body = {
      ...form,
      price: form.price ? Number(form.price) : 0,
      bhk: form.bhk ? Number(form.bhk) : null,
      area_sqft: form.area_sqft ? Number(form.area_sqft) : null,
    };
    try {
      if (edit) await updateProperty(edit.id, body);
      else await createProperty(body);
      toast.success(edit ? "Property updated" : "Property added");
      setOpen(false);
      setEdit(null);
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["re-properties"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const del = async (id: number) => {
    if (!confirm("Delete this property?")) return;
    try {
      await deleteProperty(id);
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["re-properties"] });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Listings</h2>
          <p className="text-sm text-muted-foreground">Inventory across all cities.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Search title/city" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
          <Button onClick={() => { setEdit(null); setForm(empty); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />Add Property
          </Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Config</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : !rows.length ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No properties yet.</TableCell>
              </TableRow>
            ) : (
              rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell><Badge variant="outline">{r.property_type}</Badge></TableCell>
                  <TableCell className="text-sm">{r.city}</TableCell>
                  <TableCell className="text-sm">{r.price ? cr(r.price) : "—"}</TableCell>
                  <TableCell className="text-xs">{r.bhk ? `${r.bhk}BHK` : "—"} · {r.area_sqft || "—"} sqft</TableCell>
                  <TableCell><Badge variant={r.status === "sold" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => { setEdit(r); setForm({ ...empty, ...r }); setOpen(true); }}>
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
          <DialogHeader><DialogTitle>{edit ? "Edit Property" : "New Property"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2 py-2">
            <Input className="md:col-span-2" placeholder="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Select value={form.property_type} onValueChange={(v) => setForm({ ...form, property_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <Input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Input placeholder="Price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <Input placeholder="Area (sqft)" type="number" value={form.area_sqft} onChange={(e) => setForm({ ...form, area_sqft: e.target.value })} />
            <Input placeholder="BHK" type="number" value={form.bhk} onChange={(e) => setForm({ ...form, bhk: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!form.title}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}