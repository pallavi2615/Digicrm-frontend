/**
 * DealFlow & Collections — cost sheet, negotiation, booking, payment
 * schedule, home loan and commission overview.
 */

import { defineRoute } from "@/lib/router-compat";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@/lib/react-data-client";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
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
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Copy, Check, X, Plus, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import {
  listDeals, listPayments, listPartners,
  recordNegotiation, approveNegotiation, bookDeal,
  createPayment, markPaymentPaid,
  listDocuments, createDocument, verifyDocument,
} from "@/lib/realestate.functions";
import { inr, cr, waLink, today } from "@/lib/re-data";

export const Route = defineRoute("/_authenticated/realestate/deals")({
  head: () => ({ meta: [{ title: "DealFlow & Collections | Real Estate CRM" }] }),
  component: DealsPage,
});

const costBlank = {
  base_rate: "", area: "", plc: "0", parking: "0", club: "0",
  maintenance: "0", other: "0", discount: "0",
  gst_pct: "5", stamp_pct: "7", reg_pct: "1",
};

function DealsPage() {
  const qc = useQueryClient();
  const [dealId, setDealId] = useState<number | null>(null);
  const [cost, setCost] = useState<any>(costBlank);
  const [neg, setNeg] = useState({ customer_offer: "", seller_quote: "", final_price: "", note: "" });
  const [pay, setPay] = useState({ milestone: "", amount: "", due_date: "" });
  const [cp, setCp] = useState<string>("");

  const { data: deals = [] } = useQuery({ queryKey: ["re-deals"], queryFn: () => listDeals() });
  const { data: pays = [] } = useQuery({ queryKey: ["re-payments"], queryFn: () => listPayments() });
  const { data: partners = [] } = useQuery({ queryKey: ["re-partners"], queryFn: listPartners });

  const deal = deals.find((d: any) => d.id === dealId);
  const listPrice = Number(deal?.expected_value || 0);
  const pendingApprovals: any[] = [];
  const overdue = pays.filter((p: any) => Number(p.paid_amount) < Number(p.amount) && p.due_date && p.due_date < today());

  const cs = useMemo(() => {
    const n = (k: string) => Number(cost[k]) || 0;
    const base = n("base_rate") * n("area");
    const sub = base + n("plc") + n("parking") + n("club") + n("maintenance") + n("other") - n("discount");
    const gst = (base + n("plc") + n("parking") - n("discount")) * n("gst_pct") / 100;
    const stamp = sub * n("stamp_pct") / 100;
    const reg = sub * n("reg_pct") / 100;
    return { base, sub, gst, stamp, reg, total: sub + gst + stamp + reg };
  }, [cost]);

  const pickDeal = (id: string) => {
    const numericId = Number(id);
    setDealId(numericId);
    const d = deals.find((x: any) => x.id === numericId);
    const area = 0;
    const price = Number(d?.expected_value || 0);
    setCost({ ...costBlank, area: "", base_rate: "" });
    setNeg({ customer_offer: "", seller_quote: price ? String(price) : "", final_price: "", note: "" });
    setCp(d?.channel_partner_id ? String(d.channel_partner_id) : "");
  };

  const copySheet = () => {
    const t = `Cost sheet – ${deal?.property_title ?? ""}
Base: ${inr(cs.base)}
PLC: ${inr(+cost.plc)}
Parking: ${inr(+cost.parking)}
Club: ${inr(+cost.club)}
Maintenance: ${inr(+cost.maintenance)}
Other: ${inr(+cost.other)}
Discount: -${inr(+cost.discount)}
GST (${cost.gst_pct}%): ${inr(cs.gst)}
Stamp duty (${cost.stamp_pct}%): ${inr(cs.stamp)}
Registration (${cost.reg_pct}%): ${inr(cs.reg)}
TOTAL: ${inr(cs.total)}`;
    navigator.clipboard.writeText(t);
    toast.success("Cost sheet copied");
    return t;
  };

  const submitNegotiation = async () => {
    if (!deal || !neg.final_price) return toast.error("Enter the negotiated price");
    try {
      await recordNegotiation(deal.id, {
        list_price: listPrice,
        customer_offer: neg.customer_offer ? Number(neg.customer_offer) : null,
        seller_quote: neg.seller_quote ? Number(neg.seller_quote) : null,
        final_price: Number(neg.final_price),
        note: neg.note,
      });
      toast.success("Offer recorded — awaiting approval");
      setNeg({ ...neg, customer_offer: "", final_price: "", note: "" });
      qc.invalidateQueries({ queryKey: ["re-deals"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const book = async () => {
    if (!deal) return;
    try {
      await bookDeal(deal.id, cp ? Number(cp) : undefined);
      toast.success("Booked");
      qc.invalidateQueries({ queryKey: ["re-deals"] });
      qc.invalidateQueries({ queryKey: ["re-payments"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const addPayment = async () => {
    if (!deal || !pay.milestone || !pay.amount || !pay.due_date)
      return toast.error("Fill milestone, amount and due date");
    try {
      await createPayment({
        deal_id: deal.id,
        milestone: pay.milestone,
        amount: Number(pay.amount),
        due_date: pay.due_date,
      });
      toast.success("Milestone added");
      setPay({ milestone: "", amount: "", due_date: "" });
      qc.invalidateQueries({ queryKey: ["re-payments"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const markPaid = async (p: any) => {
    const ref = window.prompt("Payment reference (UTR / cheque no.)") ?? "";
    try {
      await markPaymentPaid(p.id, ref);
      toast.success("Marked paid");
      qc.invalidateQueries({ queryKey: ["re-payments"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const dealPays = pays.filter((p: any) => p.deal_id === dealId);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {[
          ["Discounts awaiting approval", pendingApprovals.length],
          ["Overdue instalments", overdue.length],
          ["Outstanding", cr(pays.reduce((a: number, p: any) => a + Number(p.amount) - Number(p.paid_amount), 0))],
          ["Collected", cr(pays.reduce((a: number, p: any) => a + Number(p.paid_amount), 0))],
        ].map(([k, v]) => (
          <Card key={k as string}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{k}</div>
              <div className="text-2xl font-bold">{v as any}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-2 items-center">
          <Label>Deal</Label>
          <Select value={dealId ? String(dealId) : ""} onValueChange={pickDeal}>
            <SelectTrigger className="w-96">
              <SelectValue placeholder="Choose a deal to work on" />
            </SelectTrigger>
            <SelectContent>
              {deals.map((d: any) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.client_name ?? "—"} · {d.property_title ?? "—"} ({d.stage})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {deal && <Badge variant="outline">List {cr(listPrice)}</Badge>}
          {deal?.final_value && <Badge>Final {cr(deal.final_value)}</Badge>}
        </CardContent>
      </Card>

      {deal && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cost sheet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["base_rate", "Rate / sq ft"], ["area", "Area sq ft"], ["plc", "PLC"],
                  ["parking", "Parking"], ["club", "Club"], ["maintenance", "Maintenance"],
                  ["other", "Other"], ["discount", "Discount"], ["gst_pct", "GST %"],
                  ["stamp_pct", "Stamp duty %"], ["reg_pct", "Registration %"],
                ].map(([k, l]) => (
                  <div key={k} className="space-y-1">
                    <Label className="text-xs">{l}</Label>
                    <Input
                      type="number"
                      value={cost[k]}
                      onChange={(e) => setCost({ ...cost, [k]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <div className="text-sm space-y-0.5 border-t pt-2">
                <Row label="Base price" value={inr(cs.base)} />
                <Row label="Sub-total" value={inr(cs.sub)} />
                <Row label="GST" value={inr(cs.gst)} />
                <Row label="Stamp duty + registration" value={inr(cs.stamp + cs.reg)} />
                <Row label="All-inclusive" value={inr(cs.total)} bold />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copySheet}>
                  <Copy className="h-3 w-3 mr-1" />Copy
                </Button>
                <Button
                  size="sm" variant="outline"
                  onClick={() =>
                    window.open(
                      waLink(
                        deal.buyer_phone || deal.client_phone,
                        copySheet()
                      ),
                      "_blank"
                    )
                  }
                >
                  <MessageCircle className="h-3 w-3 mr-1" />Send on WhatsApp
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Negotiation & booking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Customer offer</Label>
                  <Input type="number" value={neg.customer_offer} onChange={(e) => setNeg({ ...neg, customer_offer: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Seller quote</Label>
                  <Input type="number" value={neg.seller_quote} onChange={(e) => setNeg({ ...neg, seller_quote: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Final negotiated</Label>
                  <Input type="number" value={neg.final_price} onChange={(e) => setNeg({ ...neg, final_price: e.target.value })} />
                </div>
              </div>
              <Input placeholder="Note" value={neg.note} onChange={(e) => setNeg({ ...neg, note: e.target.value })} />
              <Button size="sm" onClick={submitNegotiation}>Record offer</Button>

              <div className="border-t pt-3 space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Channel partner (for commission)</Label>
                  <Select value={cp || "none"} onValueChange={(v) => setCp(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Direct (no partner)</SelectItem>
                      {partners.map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name} · {p.commission_pct}%
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={book}
                  disabled={["booking", "agreement", "registration", "closed_won"].includes(deal.stage)}
                >
                  Confirm booking
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Payment schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Milestone</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dealPays.map((p: any) => {
                    const paid = Number(p.paid_amount) >= Number(p.amount);
                    const late = !paid && p.due_date && p.due_date < today();
                    return (
                      <TableRow key={p.id}>
                        <TableCell>{p.milestone}</TableCell>
                        <TableCell>{inr(p.amount)}</TableCell>
                        <TableCell>{p.due_date}</TableCell>
                        <TableCell>
                          {paid ? <Badge>Paid {p.paid_on}</Badge>
                            : late ? <Badge variant="destructive">Overdue</Badge>
                            : p.reported_at ? <Badge variant="secondary">Reported</Badge>
                            : <Badge variant="outline">Upcoming</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          {!paid && (
                            <>
                              <Button
                                size="sm" variant="ghost"
                                onClick={() =>
                                  window.open(
                                    waLink(
                                      deal.buyer_phone || deal.client_phone,
                                      `Hi, reminder: ${p.milestone} of ${inr(p.amount)} is due on ${p.due_date}.`
                                    ),
                                    "_blank"
                                  )
                                }
                              >
                                Remind
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => markPaid(p)}>
                                Mark paid
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!dealPays.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No schedule yet — confirm booking or add a milestone
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="flex flex-wrap gap-2">
                <Input className="w-48" placeholder="Milestone" value={pay.milestone} onChange={(e) => setPay({ ...pay, milestone: e.target.value })} />
                <Input className="w-36" type="number" placeholder="Amount" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
                <Input className="w-40" type="date" value={pay.due_date} onChange={(e) => setPay({ ...pay, due_date: e.target.value })} />
                <Button size="sm" onClick={addPayment}>
                  <Plus className="h-3 w-3 mr-1" />Add
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : ""}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}