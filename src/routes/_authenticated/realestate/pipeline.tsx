/**
 * Pipeline — Kanban board of deals across the 14 pipeline stages.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, IndianRupee, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  listDeals, createDeal, updateDeal, moveDealStage,
  listLeads, listProperties,
} from "@/lib/realestate.functions";
import { useReConfig } from "@/hooks/use-re-config";
import { cr } from "@/lib/re-data";

export const Route = createFileRoute("/_authenticated/realestate/pipeline")({
  head: () => ({ meta: [{ title: "Pipeline | Real Estate CRM" }] }),
  component: PipelinePage,
});

const emptyForm: any = {
  client_id: "", property_id: "", expected_value: "",
  final_value: "", stage: "inquiry", notes: "", next_action_at: "",
};

function PipelinePage() {
  const qc = useQueryClient();
  const cfg = useReConfig();
  const [dragId, setDragId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForm);

  const { data: deals = [], isLoading } = useQuery({ queryKey: ["re-deals"], queryFn: () => listDeals() });
  const { data: leads = [] } = useQuery({ queryKey: ["re-leads"], queryFn: () => listLeads() });
  const { data: units = [] } = useQuery({ queryKey: ["re-properties"], queryFn: () => listProperties() });

  const stages = cfg.data?.deal_stages ?? [];

  const move = async (id: number, stage: string) => {
    try {
      await moveDealStage(id, stage);
      toast.success(`Moved to ${stage.replace(/_/g, " ")}`);
      qc.invalidateQueries({ queryKey: ["re-deals"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const save = async () => {
    if (!form.client_id) return toast.error("Pick a client");
    const body: any = {
      client_id: Number(form.client_id),
      property_id: form.property_id ? Number(form.property_id) : null,
      expected_value: form.expected_value ? Number(form.expected_value) : 0,
      final_value: form.final_value ? Number(form.final_value) : 0,
      stage: form.stage,
      notes: form.notes,
      next_action_at: form.next_action_at || null,
    };
    try {
      if (editing) await updateDeal(editing.id, body);
      else await createDeal(body);
      toast.success(editing ? "Deal updated" : "Deal created");
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["re-deals"] });
    } catch (e: any) { toast.error(e.message); }
  };

  if (isLoading) return <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-6 pb-2">
        <div>
          <h2 className="text-xl font-bold">Deal Pipeline</h2>
          <p className="text-sm text-muted-foreground">Drag cards across stages · click to edit</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />New Deal
        </Button>
      </div>

      <div className="flex-1 overflow-x-auto p-6 pt-2">
        <div className="flex gap-3 min-w-max pb-4">
          {stages.map((stage) => {
            const items = deals.filter((d: any) => d.stage === stage);
            const value = items.reduce((s: number, d: any) => s + Number(d.expected_value || 0), 0);
            return (
              <div key={stage} className="w-72 flex-shrink-0"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dragId && move(dragId, stage)}>
                <Card className="border-t-4 border-t-primary p-3 mb-2">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm capitalize">{stage.replace(/_/g, " ")}</div>
                    <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <IndianRupee className="h-3 w-3" />{cr(value)}
                  </div>
                </Card>
                <div className="space-y-2">
                  {items.map((d: any) => (
                    <Card key={d.id}
                      draggable
                      onDragStart={() => setDragId(d.id)}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => {
                        setEditing(d);
                        setForm({
                          client_id: d.client_id ?? "",
                          property_id: d.property_id ?? "",
                          expected_value: d.expected_value ?? "",
                          final_value: d.final_value ?? "",
                          stage: d.stage,
                          notes: d.notes ?? "",
                          next_action_at: d.next_action_at ? String(d.next_action_at).slice(0, 10) : "",
                        });
                        setOpen(true);
                      }}
                      className="p-3 cursor-pointer hover:shadow-md"
                    >
                      <div className="font-medium text-sm">{d.client_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{d.client_phone}</div>
                      {d.property_title && <div className="text-xs mt-1 truncate">🏠 {d.property_title}</div>}
                      <div className="flex items-center justify-between mt-2">
                        <Badge variant="outline" className="text-[10px]">{d.property_city || "—"}</Badge>
                        <span className="text-xs font-semibold">{cr(d.final_value || d.expected_value)}</span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Deal" : "New Deal"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={String(form.client_id)} onValueChange={(v) => setForm({ ...form, client_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select client *" /></SelectTrigger>
              <SelectContent>
                {leads.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(form.property_id ?? "")} onValueChange={(v) => setForm({ ...form, property_id: v })}>
              <SelectTrigger><SelectValue placeholder="Property (optional)" /></SelectTrigger>
              <SelectContent>
                {units.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Expected value</Label>
                <Input type="number" value={form.expected_value} onChange={(e) => setForm({ ...form, expected_value: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Final value</Label>
                <Input type="number" value={form.final_value} onChange={(e) => setForm({ ...form, final_value: e.target.value })} />
              </div>
            </div>
            <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {stages.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="space-y-1">
              <Label className="text-xs">Next action</Label>
              <Input type="date" value={form.next_action_at} onChange={(e) => setForm({ ...form, next_action_at: e.target.value })} />
            </div>
            <Textarea rows={2} placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Save changes" : "Create Deal"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}