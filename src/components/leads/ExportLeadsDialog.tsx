import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ExportLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportLeadsDialog({ open, onOpenChange }: ExportLeadsDialogProps) {
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [priority, setPriority] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [exporting, setExporting] = useState(false);

  // Quick date presets
  const setDatePreset = (preset: string) => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === "today") {
      setFromDate(fmt(today));
      setToDate(fmt(today));
    } else if (preset === "yesterday") {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      setFromDate(fmt(y));
      setToDate(fmt(y));
    } else if (preset === "last7") {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      setFromDate(fmt(d));
      setToDate(fmt(today));
    } else if (preset === "last30") {
      const d = new Date(today);
      d.setDate(d.getDate() - 30);
      setFromDate(fmt(d));
      setToDate(fmt(today));
    } else if (preset === "thisMonth") {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      setFromDate(fmt(first));
      setToDate(fmt(today));
    } else if (preset === "all") {
      setFromDate("");
      setToDate("");
    }
  };

  const handleExport = async () => {
    // Validate dates
    if (fromDate && toDate && fromDate > toDate) {
      toast.error("Start date cannot be after end date");
      return;
    }

    setExporting(true);

    try {
      const params = new URLSearchParams();
      params.set("format", format);
      if (status !== "all") params.set("status", status);
      if (source !== "all") params.set("source", source);
      if (priority !== "all") params.set("priority", priority);
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);

      const token = localStorage.getItem("access_token");
      const url = `/api/v1/leads/export?${params.toString()}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Export failed");
      }

      // ⭐ Download file
      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = `leads_export.${format}`;

      if (contentDisposition) {
        const match = contentDisposition.match(/filename=([^;]+)/);
        if (match) filename = match[1].trim();
      }

      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast.success(`Exported ${format.toUpperCase()} successfully`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Leads
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Format */}
          <div>
            <Label>Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as any)}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV (Excel compatible)</SelectItem>
                <SelectItem value="json">JSON (Developers)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ⭐ Date Range */}
          <div>
            <Label className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              Date Range
            </Label>

            {/* Quick presets */}
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {[
                { id: "all", label: "All Time" },
                { id: "today", label: "Today" },
                { id: "yesterday", label: "Yesterday" },
                { id: "last7", label: "Last 7 Days" },
                { id: "last30", label: "Last 30 Days" },
                { id: "thisMonth", label: "This Month" },
              ].map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDatePreset(p.id)}
                  className="h-7 text-xs"
                >
                  {p.label}
                </Button>
              ))}
            </div>

            {/* Custom range */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Info */}
            {fromDate || toDate ? (
              <p className="text-xs text-muted-foreground mt-1.5">
                {fromDate && toDate
                  ? `Exporting leads from ${fromDate} to ${toDate}`
                  : fromDate
                  ? `Exporting leads from ${fromDate} onwards`
                  : `Exporting leads until ${toDate}`}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1.5">
                All leads (no date filter)
              </p>
            )}
          </div>

          {/* Additional filters */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="attempt_to_call">Attempt to Call</SelectItem>
                  <SelectItem value="call_again">Call Again</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="proposal_sent">Proposal</SelectItem>
                  <SelectItem value="negotiation">Negotiation</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="campaign">Campaign</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="import">Import</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting}
            className="gap-2"
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}