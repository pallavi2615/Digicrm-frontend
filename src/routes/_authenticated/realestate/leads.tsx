/**
 * Lead360 — lead management.
 *
 * Lists leads with filters, search, and temperature badges. Supports
 * creating/editing leads and scheduling follow-ups.
 */

import { defineRoute } from "@/lib/router-compat";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@/lib/react-data-client";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Check, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import {
  listLeads, createLead, updateLead, listFollowups,
  createFollowup, completeFollowup,
} from "@/lib/realestate.functions";
import { useReConfig } from "@/hooks/use-re-config";
import { cr, waLink, TEMP_TONE } from "@/lib/re-data";

export const Route = defineRoute("/_authenticated/realestate/leads")({
  head: () => ({ meta: [{ title: "Lead360 | Real Estate CRM" }] }),
  component: LeadsPage,
});

const emptyForm: any = {
  full_name: "", phone: "", alt_phone: "", whatsapp: "", email: "",
  source: "Website", intent: "Buy", segment: "Residential",
  preferred_city: "", preferred_location: "", bhk: "",
  budget_min: "", budget_max: "", requirement: "",
};

function LeadsPage() {
  const qc = useQueryClient();
  const cfg = useReConfig();
  const [q, setQ] = useState("");
  const [temp, setTemp] = useState("all");
  const [src, setSrc] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
  const [sel, setSel] = useState<any>(null);
  const [fu, setFu] = useState({ kind: "Call", due_at: "", notes: "" });

  const { data: leads = [] } = useQuery({ queryKey: ["re-leads"], queryFn: () => listLeads() });
  const { data: followups = [] } = useQuery({ queryKey: ["re-followups"], queryFn: () => listFollowups() });

  const filtered = useMemo(
    () => leads
      .filter((l: any) =>
        (temp === "all" || l.temperature === temp) &&
        (src === "all" || l.source === src) &&
        (!q || [l.full_name, l.phone, l.email, l.preferred_city]
          .join(" ").toLowerCase().includes(q.toLowerCase())))
      .sort((a: any, b: any) => (b.ai_score ?? 0) - (a.ai_score ?? 0)),
    [leads, q, temp, src]
  );

  const dueToday = followups.filter(
    (f: any) => !f.done && f.due_at && new Date(f.due_at) <= new Date()
  );

  const save = async () => {
    if (!form.full_name?.trim()) return toast.error("Name is required");
    const body = {
      ...form,
      bhk: form.bhk ? Number(form.bhk) : null,
      budget_min: form.budget_min ? Number(form.budget_min) : null,
      budget_max: form.budget_max ? Number(form.budget_max) : null,
    };
    try {
      if (form.id) await updateLead(form.id, body);
      else await createLead(body);
      toast.success(form.id ? "Lead updated" : "Lead added");
      setOpen(false);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["re-leads"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const addFollowup = async () => {
    if (!sel || !fu.due_at) return toast.error("Pick a date");
    try {
      await createFollowup({
        client_id: sel.id,
        kind: fu.kind,
        due_at: new Date(fu.due_at).toISOString(),
        notes: fu.notes,
      });
      toast.success("Follow-up scheduled");
      setFu({ kind: "Call", due_at: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["re-followups"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const F = (k: string, label: string, type = "text") => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
    </div>
  );

  const S = (k: string, label: string, opts: string[]) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={form[k] || ""} onValueChange={(v) => setForm({ ...form, [k]: v })}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        {[
          ["Total leads", leads.length],
          ["Hot", leads.filter((l: any) => l.temperature === "Hot").length],
          ["New today", leads.filter((l: any) => new Date(l.created_at).toDateString() === new Date().toDateString()).length],
          ["Uncontacted", leads.filter((l: any) => !l.last_contacted_at && l.status !== "Lost").length],
          ["Follow-ups due", dueToday.length],
        ].map(([k, v]) => (
          <Card key={k as string}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{k}</div>
              <div className="text-2xl font-bold">{v as number}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {dueToday.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Follow-ups due today</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {dueToday.map((f: any) => (
              <div key={f.id} className="flex items-center gap-2 border rounded-md px-2 py-1 text-sm">
                <Badge variant="outline">{f.kind}</Badge>
                <span>Lead #{f.client_id}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(f.due_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <Button
                  size="icon" variant="ghost" className="h-6 w-6"
                  onClick={async () => {
                    await completeFollowup(f.id);
                    qc.invalidateQueries({ queryKey: ["re-followups"] });
                  }}
                >
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Search name, phone, city…"
          value={q} onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <Select value={temp} onValueChange={setTemp}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All temps</SelectItem>
            {(cfg.data?.lead_temperatures ?? []).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={src} onValueChange={setSrc}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {(cfg.data?.lead_sources ?? []).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button className="ml-auto" onClick={() => { setForm(emptyForm); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />New lead
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Requirement</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Temp</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l: any) => (
                <TableRow key={l.id} className="cursor-pointer" onClick={() => setSel(l)}>
                  <TableCell>
                    <div className="font-medium">{l.full_name}</div>
                    <div className="text-xs text-muted-foreground">{l.phone}</div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {[l.intent, l.bhk && `${l.bhk} BHK`, l.preferred_location || l.preferred_city].filter(Boolean).join(" · ")}
                  </TableCell>
                  <TableCell className="text-xs">
                    {l.budget_max ? `${cr(l.budget_min)}–${cr(l.budget_max)}` : "—"}
                  </TableCell>
                  <TableCell className="text-xs">{l.source ?? "—"}</TableCell>
                  <TableCell>
                    {l.temperature && (
                      <Badge variant="outline" className={TEMP_TONE[l.temperature]}>
                        {l.temperature}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => {
                        setForm({ ...emptyForm, ...l });
                        setOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!filtered.length && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No leads yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit lead" : "New lead"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {F("full_name", "Name *")}
            {F("phone", "Mobile")}
            {F("alt_phone", "Alternate mobile")}
            {F("whatsapp", "WhatsApp")}
            {F("email", "Email", "email")}
            {F("preferred_city", "City")}
            {F("preferred_location", "Preferred location")}
            {F("bhk", "BHK", "number")}
            {F("budget_min", "Budget min", "number")}
            {F("budget_max", "Budget max", "number")}
            {S("source", "Source", cfg.data?.lead_sources ?? [])}
            {S("intent", "Intent", cfg.data?.intents ?? [])}
            {S("segment", "Segment", cfg.data?.segments ?? [])}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea
              rows={3}
              value={form.requirement ?? ""}
              onChange={(e) => setForm({ ...form, requirement: e.target.value })}
            />
          </div>
          <DialogFooter><Button onClick={save}>Save lead</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-w-2xl">
          {sel && <>
            <DialogHeader><DialogTitle>{sel.full_name} · Lead 360</DialogTitle></DialogHeader>
            <div className="text-sm grid grid-cols-2 gap-2">
              <div>📞 {sel.phone ?? "—"}</div>
              <div>✉️ {sel.email ?? "—"}</div>
              <div>Budget: {sel.budget_max ? `${cr(sel.budget_min)} – ${cr(sel.budget_max)}` : "—"}</div>
              <div>Source: {sel.source ?? "—"}</div>
            </div>

            <div className="space-y-2 mt-3">
              <div className="font-medium text-sm">Schedule follow-up</div>
              <div className="grid grid-cols-3 gap-2">
                <Select value={fu.kind} onValueChange={(v) => setFu({ ...fu, kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(cfg.data?.followup_kinds ?? []).map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="datetime-local" value={fu.due_at} onChange={(e) => setFu({ ...fu, due_at: e.target.value })} />
                <Button size="sm" onClick={addFollowup}>Schedule</Button>
              </div>
              <Input placeholder="Note (optional)" value={fu.notes} onChange={(e) => setFu({ ...fu, notes: e.target.value })} />
            </div>

            <div className="flex gap-2 mt-3">
              <Button
                variant="outline" size="sm"
                onClick={() => window.open(
                  waLink(sel.whatsapp || sel.phone, `Hi ${sel.full_name.split(" ")[0]}, following up on your property search.`),
                  "_blank"
                )}
              >
                <MessageCircle className="h-3 w-3 mr-1" />WhatsApp
              </Button>
            </div>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}