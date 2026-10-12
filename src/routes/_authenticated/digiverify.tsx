import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ShieldCheck, Loader2, FileSearch, CreditCard, Building2, Landmark,
  Fingerprint, Gauge, Wallet, ArrowRight, CheckCircle2, XCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/digiverify")({
  head: () => ({
    meta: [
      { title: "DigiVerify — DigiCRM AI" },
      { name: "description", content: "Run PAN, Aadhaar, GST, bank, OCR and credit bureau checks." },
    ],
  }),
  component: DigiVerifyPage,
});

type CheckKind = "pan" | "aadhaar" | "gstin" | "bank" | "credit_bureau";

type CheckResult = {
  success: boolean;
  check: {
    id: number;
    check_type: string;
    status: string;
    input_masked: string | null;
    result: Record<string, any>;
    error_message: string | null;
    cost: number;
    provider: string | null;
    created_at: string;
    completed_at: string | null;
  };
  wallet_balance_after: number;
  message: string;
};

type CheckRecord = {
  id: number;
  check_type: string;
  status: string;
  input_masked: string | null;
  cost: number;
  provider: string | null;
  created_at: string;
  completed_at: string | null;
};

type WalletBalance = { balance: number; currency: string };

const KINDS: {
  kind: CheckKind;
  label: string;
  icon: any;
  blurb: string;
  price: number;
  placeholder: string;
}[] = [
  {
    kind: "pan",
    label: "PAN",
    icon: CreditCard,
    blurb: "Live PAN report — holder name, status, Aadhaar seeding and category.",
    price: 10,
    placeholder: "ABCDE1234F",
  },
  {
    kind: "aadhaar",
    label: "Aadhaar",
    icon: Fingerprint,
    blurb: "Live UIDAI validation. Only the last four digits are stored.",
    price: 15,
    placeholder: "123456789012",
  },
  {
    kind: "gstin",
    label: "GSTIN",
    icon: Building2,
    blurb: "Live GSTIN advanced verification — legal name, status, addresses and filings.",
    price: 8,
    placeholder: "27ABCDE1234F1Z5",
  },
  {
    kind: "bank",
    label: "Bank account",
    icon: Landmark,
    blurb: "Live account verification plus bank and branch lookup from IFSC.",
    price: 5,
    placeholder: "Account number",
  },
  {
    kind: "credit_bureau",
    label: "Credit bureau",
    icon: Gauge,
    blurb: "Live credit bureau score for the PAN, name and mobile provided.",
    price: 25,
    placeholder: "PAN",
  },
];

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  success: "Verified",
  failed: "Failed",
  error: "Error",
};

function DigiVerifyPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [kind, setKind] = useState<CheckKind>("pan");
  const [value, setValue] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [mobile, setMobile] = useState("");
  const [subject, setSubject] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [last, setLast] = useState<CheckResult | null>(null);

  const active = KINDS.find((k) => k.kind === kind)!;

  // Wallet balance
  const { data: wallet, refetch: refetchWallet } = useQuery({
    queryKey: ["digiverify-wallet"],
    queryFn: () => apiFetch<WalletBalance>("/api/v1/digiverify/wallet"),
  });

  // History
  const { data: history, refetch: refetchHistory } = useQuery({
    queryKey: ["digiverify-history"],
    queryFn: () =>
      apiFetch<{ checks: CheckRecord[]; total: number }>(
        "/api/v1/digiverify/checks?limit=50"
      ),
  });

  // Run check
  const check = useMutation({
    mutationFn: () => {
      let endpoint = "";
      let body: any = {};

      if (kind === "pan") {
        endpoint = "/api/v1/digiverify/pan";
        body = { pan: value.toUpperCase(), name: subject || null };
      } else if (kind === "aadhaar") {
        endpoint = "/api/v1/digiverify/aadhaar";
        body = { aadhaar: value.replace(/\D/g, "") };
      } else if (kind === "gstin") {
        endpoint = "/api/v1/digiverify/gstin";
        body = { gstin: value.toUpperCase() };
      } else if (kind === "bank") {
        endpoint = "/api/v1/digiverify/bank";
        body = { account_number: accountNumber, ifsc: ifsc.toUpperCase() };
      } else if (kind === "credit_bureau") {
        endpoint = "/api/v1/digiverify/credit-bureau";
        body = { pan: value.toUpperCase(), name: subject, mobile };
      }

      return apiFetch<CheckResult>(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (res) => {
      setLast(res);
      if (res.success) toast.success(res.message);
      else if (res.check.status === "failed") toast.warning(res.message);
      else toast.error(res.message);
      refetchWallet();
      refetchHistory();
      qc.invalidateQueries({ queryKey: ["wallet-me"] });
    },
    onError: (e: Error) => {
      if (e.message.toLowerCase().includes("insufficient")) {
        toast.error("Wallet insufficient. Ask your admin to allocate credit.", {
          action: {
            label: "Wallet",
            onClick: () => navigate({ to: "/wallet" }),
          },
        });
      } else {
        toast.error(e.message);
      }
    },
  });

  const insufficient = (wallet?.balance ?? 0) < active.price;

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> DigiVerify
          </div>
          <h1 className="text-2xl font-bold">Identity &amp; financial verification</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Run KYC and financial checks without leaving the CRM. Raw identifiers
            are never stored — only a masked reference, the outcome and the
            structured result, all under your role permissions.
          </p>
        </div>

        {/* Wallet balance card */}
        <Card className="min-w-[220px]">
          <CardContent className="p-4 flex items-center gap-3">
            <Wallet className="h-5 w-5 text-green-600" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Wallet balance</p>
              <p className="text-lg font-semibold">
                ₹{(wallet?.balance ?? 0).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/wallet" })}>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </header>

      {/* Kind selection */}
      <div className="grid gap-3 md:grid-cols-3">
        {KINDS.map((k) => {
          const Icon = k.icon;
          const isActive = k.kind === kind;
          return (
            <button
              key={k.kind}
              type="button"
              onClick={() => {
                setKind(k.kind);
                setLast(null);
                setValue("");
                setIfsc("");
                setMobile("");
                setSubject("");
                setAccountNumber("");
              }}
              className="text-left"
            >
              <Card
                className={
                  isActive
                    ? "border-primary"
                    : "transition-colors hover:border-primary/40"
                }
              >
                <CardContent className="pt-5 space-y-1">
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <Icon className="h-4 w-4" />
                    {k.label}
                  </div>
                  <p className="text-xs text-muted-foreground">{k.blurb}</p>
                  <p className="text-xs text-primary font-medium pt-1">
                    ₹{k.price.toFixed(2)} per check
                  </p>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        {/* Form */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{active.label} check</CardTitle>
            <p className="text-xs text-muted-foreground pt-1">
              Cost: <span className="font-medium text-foreground">₹{active.price.toFixed(2)}</span>
              {" · "}
              Wallet after:{" "}
              <span className="font-medium text-foreground">
                ₹{Math.max(0, (wallet?.balance ?? 0) - active.price).toFixed(2)}
              </span>
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {kind === "pan" && (
              <>
                <div className="space-y-1">
                  <Label>PAN</Label>
                  <Input
                    value={value}
                    onChange={(e) => setValue(e.target.value.toUpperCase())}
                    placeholder={active.placeholder}
                    maxLength={10}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Name on record (optional)</Label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="As per PAN card"
                  />
                </div>
              </>
            )}

            {kind === "aadhaar" && (
              <div className="space-y-1">
                <Label>Aadhaar number</Label>
                <Input
                  value={value}
                  onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
                  placeholder={active.placeholder}
                  maxLength={12}
                />
              </div>
            )}

            {kind === "gstin" && (
              <div className="space-y-1">
                <Label>GSTIN</Label>
                <Input
                  value={value}
                  onChange={(e) => setValue(e.target.value.toUpperCase())}
                  placeholder={active.placeholder}
                  maxLength={15}
                />
              </div>
            )}

            {kind === "bank" && (
              <>
                <div className="space-y-1">
                  <Label>Account number</Label>
                  <Input
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="1234567890123"
                  />
                </div>
                <div className="space-y-1">
                  <Label>IFSC</Label>
                  <Input
                    value={ifsc}
                    onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                    placeholder="HDFC0001234"
                    maxLength={11}
                  />
                </div>
              </>
            )}

            {kind === "credit_bureau" && (
              <>
                <div className="space-y-1">
                  <Label>PAN</Label>
                  <Input
                    value={value}
                    onChange={(e) => setValue(e.target.value.toUpperCase())}
                    maxLength={10}
                    placeholder="ABCDE1234F"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Full name</Label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="As per PAN"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Mobile (10 digits)</Label>
                  <Input
                    value={mobile}
                    onChange={(e) =>
                      setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))
                    }
                    placeholder="9876543210"
                    maxLength={10}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Name and mobile are required for a live bureau pull with the
                    applicant&apos;s consent.
                  </p>
                </div>
              </>
            )}

            <Button
              className="w-full"
              onClick={() => check.mutate()}
              disabled={check.isPending || insufficient}
            >
              {check.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Run {active.label} check (₹{active.price})
            </Button>

            {insufficient && (
              <p className="text-xs text-destructive">
                Insufficient wallet balance. Need ₹{active.price.toFixed(2)}.
                You have ₹{(wallet?.balance ?? 0).toFixed(2)}.
              </p>
            )}

            <p className="text-[11px] text-muted-foreground">{active.blurb}</p>
          </CardContent>
        </Card>

        {/* Result */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Result</CardTitle>
          </CardHeader>
          <CardContent>
            {last ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      last.check.status === "success"
                        ? "default"
                        : last.check.status === "failed"
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {STATUS_LABEL[last.check.status] ?? last.check.status}
                  </Badge>
                  {last.check.provider && (
                    <Badge variant="outline" className="text-[10px]">
                      {last.check.provider}
                    </Badge>
                  )}
                  {last.check.input_masked && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {last.check.input_masked}
                    </span>
                  )}
                  <Badge variant="secondary" className="text-[10px]">
                    ₹{last.check.cost.toFixed(2)}
                  </Badge>
                </div>

                {last.check.error_message && (
                  <p className="text-sm text-destructive">
                    {last.check.error_message}
                  </p>
                )}

                <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(last.check.result, null, 2)}
                </pre>

                <p className="text-xs text-muted-foreground">
                  Wallet after:{" "}
                  <span className="font-medium text-foreground">
                    ₹{last.wallet_balance_after.toFixed(2)}
                  </span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Run a check to see the structured result here.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Verification history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Identifier</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!history?.checks?.length ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No checks yet.
                  </TableCell>
                </TableRow>
              ) : (
                history.checks.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-sm capitalize">
                      {h.check_type.replace("_", " ")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {h.input_masked ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {h.provider ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          h.status === "success"
                            ? "default"
                            : h.status === "failed"
                            ? "secondary"
                            : "destructive"
                        }
                        className="text-[10px]"
                      >
                        {STATUS_LABEL[h.status] ?? h.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      ₹{h.cost.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}