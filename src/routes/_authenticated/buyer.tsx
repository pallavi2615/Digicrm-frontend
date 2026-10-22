import { defineRoute } from "@/lib/router-compat";
import { useState } from "react";
import { useQuery, useQueryClient } from "@/lib/react-data-client";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Home, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getBuyerPortal, reportBuyerPayment, uploadBuyerDocument,
  type BuyerPayment,
} from "@/lib/buyer.functions";
import { inr } from "@/lib/re-data";

export const Route = defineRoute("/_authenticated/buyer")({
  head: () => ({
    meta: [
      { title: "My Home Booking | DigiCRM AI" },
      { name: "description", content: "Track your property booking, payments and documents." },
    ],
  }),
  component: BuyerPortal,
});

const STEPS = ["Booked", "Documents verified", "Registration", "Handover"];

function BuyerPortal() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["buyer", "portal"],
    queryFn: getBuyerPortal,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["buyer", "portal"] });

  if (isLoading) {
    return <div className="p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center text-sm text-muted-foreground">
        <Home className="mx-auto mb-2 h-8 w-8" />
        {(error as Error).message || "Something went wrong."}
      </div>
    );
  }

  const deals = data?.deals ?? [];
  const payments = data?.payments ?? [];
  const documents = data?.documents ?? [];

  if (!deals.length) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center text-sm text-muted-foreground">
        <Home className="mx-auto mb-2 h-8 w-8" />
        No booking is linked to your email yet. Ask your sales executive to add
        your email to the booking.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <h1 className="text-xl font-semibold">My home booking</h1>

      {deals.map((deal) => {
        const dealPayments = payments.filter((p) => p.deal_id === deal.id);
        const dealDocs = documents.filter((d) => d.deal_id === deal.id);
        const paid = dealPayments.reduce((s, p) => s + Number(p.paid_amount), 0);
        const total = dealPayments.reduce((s, p) => s + Number(p.amount), 0);

        return (
          <div key={deal.id} className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {deal.property_title}
                  {deal.property_unit_no && ` · ${deal.property_tower ?? ""} ${deal.property_unit_no}`}
                </CardTitle>
                <CardDescription>
                  {[deal.property_location, deal.property_city].filter(Boolean).join(", ")}{" "}
                  · Booking value {inr(deal.final_value ?? deal.expected_value)}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {STEPS.map((s, i) => {
                  const done =
                    i === 0 ||
                    (i === 1 && deal.doc_status === "Verified") ||
                    (i === 2 && ["registration", "closed_won"].includes(deal.stage)) ||
                    (i === 3 && deal.stage === "closed_won");
                  return (
                    <Badge key={s} variant={done ? "default" : "outline"}>
                      {i + 1}. {s}
                    </Badge>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Documents</CardTitle>
                <CardDescription>
                  Upload your KYC and agreement documents here. Our team verifies them.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {!dealDocs.length && (
                  <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
                )}
                {dealDocs.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded border p-2 text-sm">
                    <div>
                      <span className="font-medium">{d.doc_type}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{d.file_name}</span>
                    </div>
                    <Badge
                      variant={
                        d.status === "Verified" ? "default"
                        : d.status === "Rejected" ? "destructive"
                        : "outline"
                      }
                    >
                      {d.status}
                    </Badge>
                  </div>
                ))}
                <DocumentUpload dealId={deal.id} onUploaded={refresh} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Payments</CardTitle>
                <CardDescription>
                  Paid {inr(paid)} of {inr(total)}. After paying by bank transfer or cheque,
                  report it here — our team confirms it.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Milestone</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dealPayments.map((p) => (
                      <PaymentRow key={p.id} payment={p} onDone={refresh} />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}

function PaymentRow({ payment, onDone }: { payment: BuyerPayment; onDone: () => void }) {
  const remaining = Number(payment.amount) - Number(payment.paid_amount);
  const [amount, setAmount] = useState(String(remaining));
  const [reference, setReference] = useState("");
  const [open, setOpen] = useState(false);

  const isPaid = Number(payment.paid_amount) >= Number(payment.amount);
  const isOverdue = !isPaid && payment.due_date && payment.due_date < new Date().toISOString().slice(0, 10);

  const submit = async () => {
    try {
      await reportBuyerPayment(payment.id, Number(amount), reference);
      toast.success("Reported — we'll confirm shortly");
      setOpen(false);
      setReference("");
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <TableRow>
      <TableCell>{payment.milestone}</TableCell>
      <TableCell>{payment.due_date ?? "—"}</TableCell>
      <TableCell>{inr(payment.amount)}</TableCell>
      <TableCell>
        {isPaid ? <Badge>Paid</Badge>
          : payment.reported_at ? <Badge variant="secondary">Reported</Badge>
          : <Badge variant={isOverdue ? "destructive" : "outline"}>
              {isOverdue ? "Overdue" : "Due"}
            </Badge>}
      </TableCell>
      <TableCell>
        {!isPaid && !payment.reported_at && (open ? (
          <div className="flex gap-1">
            <Input className="h-8 w-28" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Input className="h-8 w-32" placeholder="UTR / cheque" value={reference} onChange={(e) => setReference(e.target.value)} />
            <Button size="sm" className="h-8" onClick={submit}>Send</Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>I've paid</Button>
        ))}
      </TableCell>
    </TableRow>
  );
}

function DocumentUpload({ dealId, onUploaded }: { dealId: number; onUploaded: () => void }) {
  const [busy, setBusy] = useState(false);
  const [docType, setDocType] = useState("Aadhaar");

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const fakeUrl = `https://storage.example.com/${dealId}/${Date.now()}_${file.name}`;
      await uploadBuyerDocument(dealId, docType, fakeUrl, file.name, file.size);
      toast.success("Uploaded");
      onUploaded();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-4 hover:bg-muted/30">
      <Input className="w-40" value={docType} onChange={(e) => setDocType(e.target.value)} />
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-sm">Choose file</span>}
      <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
    </label>
  );
}