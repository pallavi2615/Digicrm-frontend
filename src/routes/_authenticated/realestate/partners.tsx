/**
 * ChannelHub — channel partners, commissions, and lead assignment rules.
 */

import { defineRoute } from "@/lib/router-compat";
import { useState } from "react";
import { useQuery, useQueryClient } from "@/lib/react-data-client";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  listPartners, createPartner,
  listCommissions, actOnCommission,
  listAssignmentRules, createAssignmentRule, deleteAssignmentRule,
} from "@/lib/realestate.functions";
import { inr, cr } from "@/lib/re-data";

export const Route = defineRoute("/_authenticated/realestate/partners")({
  head: () => ({ meta: [{ title: "ChannelHub Partners | Real Estate CRM" }] }),
  component: PartnersPage,
});

function PartnersPage() {
  const qc = useQueryClient();
  const [p, setP] = useState({
    name: "", company: "", phone: "", email: "",
    city: "", rera_number: "", specialization: "", commission_pct: "2",
  });
  const [r, setR] = useState({
    name: "", city: "", segment: "Residential",
    budget_min: "", budget_max: "", team: "", priority: "10",
  });

  const { data: partners = [] } = useQuery({ queryKey: ["re-partners"], queryFn: listPartners });
  const { data: comms = [] } = useQuery({ queryKey: ["re-commissions"], queryFn: () => listCommissions() });
  const { data: rules = [] } = useQuery({ queryKey: ["re-rules"], queryFn: listAssignmentRules });

  const addPartner = async () => {
    if (!p.name) return toast.error("Partner name is required");
    try {
      await createPartner({ ...p, commission_pct: Number(p.commission_pct) as any });
      toast.success("Partner added");
      setP({ name: "", company: "", phone: "", email: "", city: "", rera_number: "", specialization: "", commission_pct: "2" });
      qc.invalidateQueries({ queryKey: ["re-partners"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const addRule = async () => {
    if (!r.name || !r.team) return toast.error("Rule name and team required");
    try {
      await createAssignmentRule({
        ...r,
        city: r.city || null,
        budget_min: r.budget_min ? Number(r.budget_min) : null,
        budget_max: r.budget_max ? Number(r.budget_max) : null,
        priority: Number(r.priority) || 10,
      });
      toast.success("Rule added");
      setR({ name: "", city: "", segment: "Residential", budget_min: "", budget_max: "", team: "", priority: "10" });
      qc.invalidateQueries({ queryKey: ["re-rules"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const setComm = async (c: any, action: "approve" | "pay" | "reject") => {
    const ref = action === "pay" ? window.prompt("Payment reference") || "" : undefined;
    try {
      await actOnCommission(c.id, action, ref);
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["re-commissions"] });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Channel partners</CardTitle>
          <CardDescription>
            Partner-sourced leads are tagged on the lead form; commission is created on booking.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>RERA</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Commission %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.map((x: any) => (
                <TableRow key={x.id}>
                  <TableCell>
                    <div className="font-medium">{x.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[x.company, x.specialization].filter(Boolean).join(" · ")}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{x.rera_number ?? "—"}</TableCell>
                  <TableCell>{x.city ?? "—"}</TableCell>
                  <TableCell>{x.commission_pct}%</TableCell>
                </TableRow>
              ))}
              {!partners.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No partners yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {(
              ["name", "company", "phone", "email", "city", "rera_number", "specialization", "commission_pct"] as const
            ).map((k) => (
              <Input
                key={k}
                placeholder={k.replace(/_/g, " ")}
                value={(p as any)[k]}
                onChange={(e) => setP({ ...p, [k]: e.target.value })}
              />
            ))}
          </div>
          <Button size="sm" onClick={addPartner}>
            <Plus className="h-3 w-3 mr-1" />Add partner
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Commissions</CardTitle>
          <CardDescription>
            Booking value × commission %, less TDS. Only managers can approve or mark paid.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Booking value</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>TDS</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {comms.map((c: any) => {
                const amount = Number(c.amount);
                const tds = Number(c.tds_pct);
                return (
                  <TableRow key={c.id}>
                    <TableCell>Partner #{c.partner_id}</TableCell>
                    <TableCell>{cr(c.booking_value)}</TableCell>
                    <TableCell>{inr(amount)} <span className="text-xs text-muted-foreground">({c.pct}%)</span></TableCell>
                    <TableCell>{inr(amount * tds / 100)}</TableCell>
                    <TableCell className="font-medium">{inr(amount * (1 - tds / 100))}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "Paid" ? "default" : "outline"}>{c.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {c.status === "Pending approval" && (
                        <Button size="sm" variant="outline" onClick={() => setComm(c, "approve")}>Approve</Button>
                      )}
                      {c.status === "Approved" && (
                        <Button size="sm" onClick={() => setComm(c, "pay")}>Mark paid</Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!comms.length && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No commissions yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Lead assignment rules</CardTitle>
          <CardDescription>
            New leads route to the first matching rule (lowest priority number wins).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules.map((x: any) => (
            <div key={x.id} className="flex flex-wrap items-center gap-2 border rounded-md p-2 text-sm">
              <Badge variant="outline">#{x.priority}</Badge>
              <span className="font-medium">{x.name}</span>
              <span className="text-xs text-muted-foreground">
                {[x.city, x.segment, (x.budget_min || x.budget_max) && `${cr(x.budget_min ?? 0)}–${x.budget_max ? cr(x.budget_max) : "∞"}`]
                  .filter(Boolean).join(" · ")}
              </span>
              <span>→ {x.team}</span>
              <div className="ml-auto flex items-center gap-2">
                <Switch checked={x.active} disabled />
                <Button
                  size="icon" variant="ghost"
                  onClick={async () => {
                    await deleteAssignmentRule(x.id);
                    qc.invalidateQueries({ queryKey: ["re-rules"] });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
            {(
              ["name", "city", "segment", "budget_min", "budget_max", "team", "priority"] as const
            ).map((k) => (
              <Input
                key={k}
                placeholder={k.replace(/_/g, " ")}
                value={(r as any)[k]}
                onChange={(e) => setR({ ...r, [k]: e.target.value })}
              />
            ))}
          </div>
          <Button size="sm" onClick={addRule}>
            <Plus className="h-3 w-3 mr-1" />Add rule
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}