/**
 * MatchAI — match leads to available inventory.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Check, X, MessageCircle } from "lucide-react";
import { listLeads, listProperties } from "@/lib/realestate.functions";
import { cr, matchScore, waLink, type MatchReq } from "@/lib/re-data";

export const Route = createFileRoute("/_authenticated/realestate/match")({
  head: () => ({ meta: [{ title: "MatchAI | Real Estate CRM" }] }),
  component: MatchPage,
});

const blank: MatchReq = { budget_min: null, budget_max: null, city: "", location: "", bhk: null, size_min: null, possession: "" };

function MatchPage() {
  const [leadId, setLeadId] = useState("");
  const [req, setReq] = useState<MatchReq>(blank);
  const [picked, setPicked] = useState<number[]>([]);

  const { data: leads = [] } = useQuery({ queryKey: ["re-leads"], queryFn: () => listLeads() });
  const { data: units = [] } = useQuery({ queryKey: ["re-properties"], queryFn: () => listProperties() });

  const lead = leads.find((l: any) => String(l.id) === leadId);

  const loadLead = (id: string) => {
    setLeadId(id);
    const l = leads.find((x: any) => String(x.id) === id);
    if (l) {
      setReq({
        budget_min: l.budget_min ? Number(l.budget_min) : null,
        budget_max: l.budget_max ? Number(l.budget_max) : null,
        city: l.preferred_city ?? "",
        location: l.preferred_location ?? "",
        bhk: l.bhk ? Number(l.bhk) : null,
        size_min: null,
        possession: "",
      });
    }
    setPicked([]);
  };

  const results = useMemo(
    () => units
      .filter((u: any) => (u.inventory_status ?? "Available") === "Available")
      .map((u: any) => ({
        u,
        ...matchScore(req, {
          price: Number(u.price),
          city: u.city,
          location: u.location,
          bhk: u.bhk,
          super_area: u.super_area ? Number(u.super_area) : null,
          area_sqft: u.area_sqft ? Number(u.area_sqft) : null,
          construction_status: u.construction_status,
        }),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 30),
    [units, req]
  );

  const share = () => {
    const chosen = results.filter((r: any) => picked.includes(r.u.id));
    const lines = chosen.map((r: any, i: number) =>
      `${i + 1}. ${r.u.title} · ${r.u.bhk ?? "?"} BHK · ${r.u.super_area ?? "?"} sqft · ${cr(r.u.price)}`
    );
    const msg = `Hi${lead ? " " + lead.full_name.split(" ")[0] : ""}, here are properties matching your requirement:\n\n${lines.join("\n\n")}\n\nShall I book a site visit this weekend?`;
    window.open(waLink(lead?.whatsapp || lead?.phone, msg), "_blank");
  };

  const F = (k: keyof MatchReq, label: string, type = "text") => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={(req[k] as any) ?? ""}
        onChange={(e) => setReq({ ...req, [k]: type === "number" ? (e.target.value ? Number(e.target.value) : null) : e.target.value })}
      />
    </div>
  );

  return (
    <div className="p-4 md:p-6 grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card className="h-fit">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Requirement</CardTitle>
          <CardDescription>Pick a lead or type the criteria.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={leadId} onValueChange={loadLead}>
            <SelectTrigger><SelectValue placeholder="Choose a lead (optional)" /></SelectTrigger>
            <SelectContent>
              {leads.map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            {F("budget_min", "Budget min", "number")}
            {F("budget_max", "Budget max", "number")}
            {F("city", "City")}
            {F("location", "Location")}
            {F("bhk", "BHK", "number")}
            {F("size_min", "Min sqft", "number")}
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setReq(blank); setLeadId(""); }}>
            Clear
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="text-sm text-muted-foreground">{results.length} available units ranked by match</div>
          <Button size="sm" onClick={share} disabled={!picked.length} className="ml-auto">
            <MessageCircle className="h-3 w-3 mr-1" />Share {picked.length || ""} on WhatsApp
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {results.map(({ u, score, checks }: any) => (
            <Card key={u.id} className={picked.includes(u.id) ? "ring-2 ring-primary" : ""}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={picked.includes(u.id)}
                    onCheckedChange={(v) => setPicked(v ? [...picked, u.id] : picked.filter((x) => x !== u.id))}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{u.title}</div>
                    <div className="text-xs text-muted-foreground">{[u.city, u.location].filter(Boolean).join(" · ")}</div>
                  </div>
                  <Badge variant={score >= 80 ? "default" : "outline"}>{score}%</Badge>
                </div>
                <div className="text-xs">
                  {[u.bhk && `${u.bhk} BHK`, u.super_area && `${u.super_area} sqft`, u.facing].filter(Boolean).join(" · ")}
                </div>
                <div className="font-semibold">{cr(u.price)}</div>
                <div className="flex flex-wrap gap-1">
                  {checks.map((c: any) => (
                    <Badge key={c.label} variant="outline" className={c.ok ? "text-emerald-600 border-emerald-300" : "text-muted-foreground"}>
                      {c.ok ? <Check className="h-3 w-3 mr-0.5" /> : <X className="h-3 w-3 mr-0.5" />}{c.label}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}