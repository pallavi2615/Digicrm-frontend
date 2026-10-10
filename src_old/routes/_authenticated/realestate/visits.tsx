/**
 * VisitFlow — schedule site visits, check in/out, capture feedback.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, MapPin, LogOut, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import {
  listSiteVisits, createSiteVisit, checkInVisit,
  checkOutVisit, submitVisitFeedback, listLeads, listProperties,
} from "@/lib/realestate.functions";
import { useReConfig } from "@/hooks/use-re-config";
import { waLink } from "@/lib/re-data";

export const Route = createFileRoute("/_authenticated/realestate/visits")({
  head: () => ({ meta: [{ title: "VisitFlow | Real Estate CRM" }] }),
  component: VisitsPage,
});

const emptyForm = { client_id: "", property_id: "", scheduled_at: "", agent_name: "", meeting_point: "" };

function VisitsPage() {
  const qc = useQueryClient();
  const cfg = useReConfig();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>(emptyForm);
  const [fbFor, setFbFor] = useState<any>(null);
  const [fb, setFb] = useState<any>({ interest: "3", notes: "", next_action: "" });

  const { data: visits = [] } = useQuery({ queryKey: ["re-visits"], queryFn: () => listSiteVisits() });
  const { data: leads = [] } = useQuery({ queryKey: ["re-leads"], queryFn: () => listLeads() });
  const { data: units = [] } = useQuery({ queryKey: ["re-properties"], queryFn: () => listProperties() });

  const create = async () => {
    if (!f.client_id || !f.scheduled_at) return toast.error("Choose customer and time");
    try {
      await createSiteVisit({
        ...f,
        client_id: Number(f.client_id),
        property_id: f.property_id ? Number(f.property_id) : null,
        scheduled_at: new Date(f.scheduled_at).toISOString(),
      });
      toast.success("Site visit scheduled");
      setOpen(false);
      setF(emptyForm);
      qc.invalidateQueries({ queryKey: ["re-visits"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const doCheckIn = (v: any) => {
    const save = async (lat?: number, lng?: number) => {
      await checkInVisit(v.id, lat, lng);
      toast.success("Checked in");
      qc.invalidateQueries({ queryKey: ["re-visits"] });
    };
    if (!navigator.geolocation) return save();
    navigator.geolocation.getCurrentPosition(
      (p) => save(p.coords.latitude, p.coords.longitude),
      () => save(),
      { timeout: 8000 }
    );
  };

  const doCheckOut = async (v: any) => {
    await checkOutVisit(v.id);
    qc.invalidateQueries({ queryKey: ["re-visits"] });
  };

  const submitFb = async () => {
    if (!fbFor) return;
    try {
      await submitVisitFeedback(fbFor.id, {
        interest: Number(fb.interest),
        notes: fb.notes,
        next_action: fb.next_action,
      });
      toast.success("Feedback saved");
      setFbFor(null);
      qc.invalidateQueries({ queryKey: ["re-visits"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const remind = (v: any) => {
    const lead = leads.find((l: any) => l.id === v.client_id);
    const when = v.scheduled_at ? new Date(v.scheduled_at).toLocaleString("en-IN") : "";
    window.open(waLink(
      lead?.whatsapp || lead?.phone,
      `Hi ${lead?.full_name?.split(" ")[0] ?? ""}, reminder for your site visit on ${when}.`
    ), "_blank");
  };

  const today = new Date().toDateString();
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {[
          ["Today", visits.filter((v: any) => v.scheduled_at && new Date(v.scheduled_at).toDateString() === today).length],
          ["Scheduled", visits.filter((v: any) => v.status === "Scheduled").length],
          ["Completed", visits.filter((v: any) => v.status === "Completed").length],
          ["No-shows", visits.filter((v: any) => v.status === "No Show").length],
        ].map(([k, v]) => (
          <Card key={k as string}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{k}</div>
              <div className="text-2xl font-bold">{v as number}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex">
        <Button className="ml-auto" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />Schedule visit
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">All visits</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!visits.length && <div className="text-sm text-muted-foreground">No site visits yet</div>}
          {[...visits].reverse().map((v: any) => {
            const lead = leads.find((l: any) => l.id === v.client_id);
            const unit = units.find((u: any) => u.id === v.property_id);
            return (
              <div key={v.id} className="border rounded-md p-3 flex flex-wrap gap-3 items-start">
                <div className="min-w-45">
                  <div className="font-medium">{lead?.full_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{unit?.title ?? "—"}</div>
                </div>
                <div className="text-xs">
                  <div>{v.scheduled_at ? new Date(v.scheduled_at).toLocaleString("en-IN") : "—"}</div>
                  {v.checkin_at && <div className="text-muted-foreground">In {new Date(v.checkin_at).toLocaleTimeString()}</div>}
                  {v.checkout_at && <div className="text-muted-foreground">Out {new Date(v.checkout_at).toLocaleTimeString()}</div>}
                </div>
                <Badge variant="outline">{v.status}</Badge>
                <div className="flex gap-1 ml-auto">
                  <Button size="sm" variant="ghost" onClick={() => remind(v)}>
                    <MessageCircle className="h-3 w-3 mr-1" />Remind
                  </Button>
                  {!v.checkin_at && (
                    <Button size="sm" variant="outline" onClick={() => doCheckIn(v)}>
                      <MapPin className="h-3 w-3 mr-1" />Check in
                    </Button>
                  )}
                  {v.checkin_at && !v.checkout_at && (
                    <Button size="sm" variant="outline" onClick={() => doCheckOut(v)}>
                      <LogOut className="h-3 w-3 mr-1" />Check out
                    </Button>
                  )}
                  <Button size="sm" onClick={() => { setFbFor(v); setFb({ interest: "3", notes: "", next_action: "" }); }}>
                    Feedback
                  </Button>
                </div>
                {v.interest && <Badge variant="outline">Interest {v.interest}/5</Badge>}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule site visit</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={f.client_id} onValueChange={(v) => setF({ ...f, client_id: v })}>
              <SelectTrigger><SelectValue placeholder="Customer" /></SelectTrigger>
              <SelectContent>
                {leads.map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={f.property_id} onValueChange={(v) => setF({ ...f, property_id: v })}>
              <SelectTrigger><SelectValue placeholder="Property / unit" /></SelectTrigger>
              <SelectContent>
                {units.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="space-y-1">
              <Label className="text-xs">Date & time</Label>
              <Input type="datetime-local" value={f.scheduled_at} onChange={(e) => setF({ ...f, scheduled_at: e.target.value })} />
            </div>
            <Input placeholder="Salesperson" value={f.agent_name} onChange={(e) => setF({ ...f, agent_name: e.target.value })} />
            <Input placeholder="Meeting point" value={f.meeting_point} onChange={(e) => setF({ ...f, meeting_point: e.target.value })} />
          </div>
          <DialogFooter><Button onClick={create}>Schedule</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!fbFor} onOpenChange={(o) => !o && setFbFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Visit feedback</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Interest (1-5)</Label>
              <Select value={fb.interest} onValueChange={(v) => setFb({ ...fb, interest: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["1", "2", "3", "4", "5"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Next action</Label>
              <Input value={fb.next_action} onChange={(e) => setFb({ ...fb, next_action: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea rows={3} value={fb.notes} onChange={(e) => setFb({ ...fb, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter><Button onClick={submitFb}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}