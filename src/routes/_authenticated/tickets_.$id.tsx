import { defineRoute, Link } from "@/lib/router-compat";
import { useQuery, useQueryClient } from "@/lib/react-data-client";
import { apiFetch, apiUpload } from "@/lib/api";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Clock, User, AlertTriangle, Paperclip, FileText, ExternalLink, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { FeatureGate } from "@/components/feature-gate";

export const Route = defineRoute("/_authenticated/tickets_/$id")({
  head: () => ({ meta: [{ title: "Ticket — DigiCRM AI" }, { name: "robots", content: "noindex" }] }),
  component: TicketDetail,
});

type TicketMessage = {
  id: number;
  ticket_id: number;
  sender_id: number | null;
  sender_type: string;
  sender_name: string | null;
  sender_email: string | null;
  message: string;
  is_internal: boolean;
  created_at: string;
};

type TicketAttachment = {
  id: number;
  file_name: string;
  file_url: string;
  file_size: number;
  file_type: string;
  created_at: string;
};

type TicketDetailData = {
  id: number;
  tenant_id: number;
  subject: string;
  description: string | null;
  ticket_number: string;
  requester_name: string | null;
  requester_email: string;
  requester_phone: string | null;
  status: string;
  priority: string;
  urgency: string;
  category: string | null;
  assigned_to: number | null;
  sla_due_at: string | null;
  sla_breached: boolean;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  messages: TicketMessage[];
  attachments: TicketAttachment[];
};

const attachmentHref = (url: string) => {
  if (/^https?:\/\//i.test(url)) return url;
  // Keep attachment URLs aligned with the working Tickets page configuration.
  const base = (import.meta as any).env?.VITE_API_BASE_URL || "http://192.168.1.79:8000";
  return `${String(base).replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
};

const formatBytes = (bytes?: number | null) => {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return "File";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

function TicketDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => apiFetch<TicketDetailData>(`/api/v1/tickets/${id}`),
    // Poll instead of a realtime subscription so new replies show up.
    refetchInterval: 15000,
  });

  const [reply, setReply] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [draftStatus, setDraftStatus] = useState("");
  const [draftPriority, setDraftPriority] = useState("");
  const [savingChanges, setSavingChanges] = useState(false);

  useEffect(() => {
    if (ticket) {
      setDraftStatus(ticket.status ?? "open");
      setDraftPriority(ticket.priority ?? "medium");
    }
  }, [ticket?.id, ticket?.status, ticket?.priority]);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);

  const saveChanges = async () => {
    if (!ticket || savingChanges || uploadingAttachments) return;
    setSavingChanges(true);
    try {
      if (draftStatus && draftStatus !== ticket.status) {
        await apiFetch(`/api/v1/tickets/${id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: draftStatus }),
        });
      }
      if (draftPriority && draftPriority !== ticket.priority) {
        await apiFetch(`/api/v1/tickets/${id}`, {
          method: "PUT",
          body: JSON.stringify({ priority: draftPriority }),
        });
      }
      if (reply.trim()) {
        await apiFetch(`/api/v1/tickets/${id}/messages`, {
          method: "POST",
          body: JSON.stringify({ message: reply.trim(), is_internal: !isPublic }),
        });
      }
      await qc.invalidateQueries({ queryKey: ["ticket", id] });
      await qc.invalidateQueries({ queryKey: ["tickets"] });
      toast.success("Ticket changes saved");
      window.location.assign("/tickets");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save ticket changes");
    } finally {
      setSavingChanges(false);
    }
  };

  const uploadAttachments = async (files: FileList | null) => {
    if (!files?.length) return;
    const allowedTypes = new Set([
      "image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/plain", "text/csv",
    ]);
    const valid = Array.from(files).filter((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} exceeds the 10 MB limit`);
        return false;
      }
      if (!allowedTypes.has(file.type)) {
        toast.error(`${file.name} has an unsupported file type`);
        return false;
      }
      return true;
    });
    if (!valid.length) {
      if (attachmentInputRef.current) attachmentInputRef.current.value = "";
      return;
    }
    setUploadingAttachments(true);
    try {
      for (const file of valid) {
        const body = new FormData();
        body.append("file", file);
        await apiUpload<TicketAttachment>(`/api/v1/tickets/${id}/attachments`, body);
      }
      toast.success(valid.length === 1 ? "Attachment uploaded" : `${valid.length} attachments uploaded`);
      await qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload attachment(s)");
    } finally {
      setUploadingAttachments(false);
      if (attachmentInputRef.current) attachmentInputRef.current.value = "";
    }
  };

  const deleteAttachment = async (attachment: TicketAttachment) => {
    if (!window.confirm(`Delete attachment "${attachment.file_name}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/v1/tickets/${id}/attachments/${attachment.id}`, { method: "DELETE" });
      toast.success("Attachment deleted");
      await qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete attachment");
    }
  };

  if (isLoading) return <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;
  if (!ticket) return <div className="p-8 text-center text-muted-foreground">Ticket not found.</div>;

  const replies = ticket.messages ?? [];
  const attachments = ticket.attachments ?? [];
  const slaDueTime = ticket.sla_due_at ? new Date(ticket.sla_due_at).getTime() : Number.NaN;
  const slaBreached = Boolean(ticket.sla_breached) || (!ticket.first_response_at && Number.isFinite(slaDueTime) && slaDueTime < Date.now());

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/tickets"><ArrowLeft className="h-4 w-4 mr-1" /> Back to tickets</Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted-foreground font-mono">#{ticket.ticket_number}</div>
          <Button type="button" onClick={() => void saveChanges()} disabled={savingChanges || uploadingAttachments}>
            {savingChanges ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {savingChanges ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card className="overflow-hidden border-slate-200 bg-gradient-to-br from-white to-slate-50 dark:border-slate-800 dark:from-slate-900/80 dark:to-slate-950/80">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <CardTitle className="text-xl">{ticket.subject}</CardTitle>
                <Badge variant="outline" className={slaBreached ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}>{slaBreached ? "SLA Breached" : "SLA On Track"}</Badge>
              </div>
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span>{ticket.requester_name ?? ticket.requester_email}</span>
                <span>·</span>
                <span>{new Date(ticket.created_at).toLocaleString()}</span>
              </div>
            </CardHeader>
            <CardContent>
              {ticket.description && <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>}
            </CardContent>
          </Card>

          <div className="space-y-3">
            {replies.map((r) => (
              <Card key={r.id} className={r.is_internal ? "bg-amber-500/5 border-amber-500/30" : ""}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
                    <div className="font-medium text-foreground">
                      {r.sender_name ?? r.sender_email ?? "Agent"}
                      {r.is_internal && <Badge variant="outline" className="ml-2 text-[10px]">Internal note</Badge>}
                    </div>
                    <span>{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{r.message}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-sm flex items-center gap-2"><Paperclip className="h-4 w-4 text-blue-500" /> Attachments <Badge variant="secondary">{attachments.length}</Badge></CardTitle>
                <div>
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv"
                    className="hidden"
                    onChange={(event) => void uploadAttachments(event.target.files)}
                  />
                  <Button type="button" size="sm" variant="outline" disabled={uploadingAttachments} onClick={() => attachmentInputRef.current?.click()}>
                    {uploadingAttachments ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    {uploadingAttachments ? "Uploading…" : "Upload files"}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">PDF, images, DOCX, XLSX, TXT, or CSV · up to 10 MB per file</p>
            </CardHeader>
            <CardContent>
              {attachments.length ? (
                <ul className="space-y-2">
                  {attachments.map((attachment) => (
                    <li key={attachment.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/60">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300"><FileText className="h-4 w-4" /></div>
                        <div className="min-w-0">
                          <a href={attachmentHref(attachment.file_url)} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium text-primary hover:underline">{attachment.file_name || "Attachment"}</a>
                          <p className="text-xs text-muted-foreground">{formatBytes(attachment.file_size)}{attachment.created_at ? ` · ${new Date(attachment.created_at).toLocaleDateString()}` : ""}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <a href={attachmentHref(attachment.file_url)} target="_blank" rel="noreferrer" aria-label={`View ${attachment.file_name}`} title="View attachment" className="rounded-lg p-2 text-blue-600 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-500/20"><ExternalLink className="h-4 w-4" /></a>
                        <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${attachment.file_name}`} title="Delete attachment" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => void deleteAttachment(attachment)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-muted-foreground dark:border-slate-700">No attachments have been added to this ticket yet.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Reply</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea rows={6} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type your reply…" />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                  {isPublic ? "Public reply (customer sees this)" : "Internal note (agents only)"}
                </label>
                <span className="text-xs text-muted-foreground">Reply will be sent when you save changes.</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader><CardTitle className="text-sm">Properties</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={draftStatus || ticket.status} onValueChange={setDraftStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Priority</Label>
                <Select value={draftPriority || ticket.priority} onValueChange={setDraftPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> SLA</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Due</span><span>{ticket.sla_due_at ? new Date(ticket.sla_due_at).toLocaleString() : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">First response</span><span>{ticket.first_response_at ? new Date(ticket.first_response_at).toLocaleString() : "—"}</span></div>
              {slaBreached && (
                <div className="mt-2 flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-xs font-medium text-red-600 dark:text-red-300">
                  <AlertTriangle className="h-3 w-3" /> SLA breached
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" /> Requester</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <div>{ticket.requester_name ?? "—"}</div>
              <a href={`mailto:${ticket.requester_email}`} className="text-primary hover:underline">{ticket.requester_email}</a>
              {ticket.requester_phone && <div className="text-xs text-muted-foreground mt-1">{ticket.requester_phone}</div>}
            </CardContent>
          </Card>

          <FeatureGate feature="tickets.macros">
            <Card>
              <CardHeader><CardTitle className="text-sm">Macros</CardTitle></CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Configure one-click macros under Settings → Ticket macros.
              </CardContent>
            </Card>
          </FeatureGate>
        </div>
      </div>

      <div className="flex justify-center border-t border-slate-200 pt-5 dark:border-slate-800">
        <Button type="button" size="lg" className="min-w-44" onClick={() => void saveChanges()} disabled={savingChanges || uploadingAttachments}>
          {savingChanges ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {savingChanges ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}