import { defineRoute } from "@/lib/router-compat";
import { useQuery, useMutation, useQueryClient } from "@/lib/react-data-client";
import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { Wallet as WalletIcon, Loader2, ArrowUpRight, ArrowDownRight, Users, Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = defineRoute("/_authenticated/wallet")({
  head: () => ({ meta: [{ title: "Wallet — DigiCRM AI" }] }),
  component: WalletPage,
});

type Wallet = { id: number; user_id: number; balance: number; allocated: number; spent: number; currency: string };
type WalletSummary = { user_id: number; full_name: string; email: string; role: string; wallet_balance: number; wallet_allocated: number; wallet_spent: number; currency: string; children_allocated: number; children_balance: number };
type Transaction = { id: number; from_user_id: number | null; to_user_id: number; amount: number; transaction_type: string; balance_after: number; reference_type: string | null; reference_id: number | null; notes: string | null; created_at: string };
type PlatformBalance = { balance: number; last_synced_at: string | null };

function WalletPage() {
  const { isAdminOrAbove, isManager, isSuperAdmin } = useAuth();
  const qc = useQueryClient();

  const { data: wallet, isLoading } = useQuery({
    queryKey: ["wallet-me"],
    queryFn: () => apiFetch<Wallet>("/api/v1/wallet/me"),
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["wallet-txns"],
    queryFn: () => apiFetch<Transaction[]>("/api/v1/wallet/me/transactions?limit=50"),
  });

  const { data: team = [] } = useQuery({
    queryKey: ["wallet-team"],
    enabled: isAdminOrAbove || isManager,
    queryFn: () => apiFetch<WalletSummary[]>("/api/v1/wallet/team"),
  });

  const { data: platformBalance } = useQuery({
    queryKey: ["wallet-platform"],
    enabled: isSuperAdmin,
    queryFn: () => apiFetch<PlatformBalance>("/api/v1/wallet/platform-balance"),
  });

  const [allocateOpen, setAllocateOpen] = useState(false);
  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (isLoading) return <div className="p-12 text-center text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Loading wallet…</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><WalletIcon className="h-6 w-6" /> Wallet</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your wallet and allocate credit to your team.</p>
        </div>
        {(isAdminOrAbove || isManager) && (
          <Button onClick={() => setAllocateOpen(true)}>
            <ArrowUpRight className="h-4 w-4 mr-2" /> Allocate
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Available Balance</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-green-600">{fmt(wallet?.balance ?? 0)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Allocated (in)</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{fmt(wallet?.allocated ?? 0)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-orange-600">{fmt(wallet?.spent ?? 0)}</div></CardContent>
        </Card>
      </div>

      {/* Platform balance — SuperAdmin only */}
      {isSuperAdmin && (
        <Card className="border-blue-500/40 bg-blue-500/5">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4" /> BharatEVerify Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Provider Balance</span>
              <span className="text-lg font-bold">{fmt(platformBalance?.balance ?? 0)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Last synced: {platformBalance?.last_synced_at
                ? new Date(platformBalance.last_synced_at).toLocaleString()
                : "Never"}
            </p>
            <p className="text-xs text-muted-foreground italic">
              This is your actual money at BharatEVerify. Top up when low.
            </p>
          </CardContent>
        </Card>
      )}

      {(isAdminOrAbove || isManager) && team.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Team Wallets</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Member</TableHead><TableHead>Role</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Allocated</TableHead>
                <TableHead className="text-right">Spent</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {team.map((m) => (
                  <TableRow key={m.user_id}>
                    <TableCell><div className="font-medium">{m.full_name}</div><div className="text-xs text-muted-foreground">{m.email}</div></TableCell>
                    <TableCell className="capitalize text-sm">{m.role}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(m.wallet_balance)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmt(m.wallet_allocated)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmt(m.wallet_spent)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Transactions</CardTitle></CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Type</TableHead><TableHead>Amount</TableHead>
                <TableHead>Balance After</TableHead><TableHead>Reference</TableHead>
                <TableHead>Date</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {transactions.map((t) => {
                  const isIncoming = ["allocate", "topup", "refund"].includes(t.transaction_type);
                  return (
                    <TableRow key={t.id}>
                      <TableCell><span className={`inline-flex items-center gap-1 text-xs capitalize ${isIncoming ? "text-green-600" : "text-orange-600"}`}>
                        {isIncoming ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                        {t.transaction_type}
                      </span></TableCell>
                      <TableCell className={`font-medium ${isIncoming ? "text-green-600" : "text-orange-600"}`}>
                        {isIncoming ? "+" : "−"}{fmt(t.amount)}
                      </TableCell>
                      <TableCell>{fmt(t.balance_after)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {t.reference_type ?? "—"}{t.notes && <div className="italic">{t.notes}</div>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AllocateDialog
        open={allocateOpen}
        onClose={() => setAllocateOpen(false)}
        team={team}
        maxAmount={wallet?.balance ?? 0}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["wallet-me"] });
          qc.invalidateQueries({ queryKey: ["wallet-txns"] });
          qc.invalidateQueries({ queryKey: ["wallet-team"] });
        }}
      />
    </div>
  );
}

function AllocateDialog({
  open, onClose, team, maxAmount, onSuccess,
}: { open: boolean; onClose: () => void; team: WalletSummary[]; maxAmount: number; onSuccess: () => void }) {
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const allocate = useMutation({
    mutationFn: () => apiFetch("/api/v1/wallet/allocate", {
      method: "POST",
      body: JSON.stringify({ to_user_id: Number(userId), amount: Number(amount), notes: notes || null }),
    }),
    onSuccess: () => {
      toast.success("Wallet allocated successfully");
      onSuccess(); onClose();
      setUserId(""); setAmount(""); setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = userId && Number(amount) > 0 && Number(amount) <= maxAmount;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Allocate wallet</DialogTitle>
          <DialogDescription>Transfer wallet balance to a team member. Available: ₹{maxAmount.toFixed(2)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Recipient</Label>
            <select className="w-full h-10 rounded-md border px-3 text-sm" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Select a team member…</option>
              {team.map((m) => (
                <option key={m.user_id} value={String(m.user_id)}>
                  {m.full_name} ({m.role}) — ₹{m.wallet_balance.toFixed(2)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Amount (₹)</Label>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. PAN check budget" />
          </div>
          {amount && Number(amount) > maxAmount && <p className="text-xs text-destructive">Amount exceeds your wallet balance.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => allocate.mutate()} disabled={!canSubmit || allocate.isPending}>
            {allocate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowUpRight className="mr-2 h-4 w-4" />} Allocate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}