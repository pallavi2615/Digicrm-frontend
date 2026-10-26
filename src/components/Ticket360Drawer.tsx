
import { useQuery } from "@/lib/react-data-client";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, X, ExternalLink, Clock, AlertTriangle, Paperclip, FileText } from "lucide-react";
import { Link } from "@/lib/router-compat";

type TicketMessage = {
  id: number;
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
  file_size?: number | null;
  file_type?: string | null;
  created_at?: string;
};

type TicketDetails = {
  id: number;
  ticket_number: string;
  subject: string;
  description: string | null;
  requester_name: string | null;
  requester_email: string;
  requester_phone: string | null;
  status: string;
  priority: string;
  urgency: string;
  category: string | null;
  sla_due_at?: string | null;
  sla_breached?: boolean;
  first_response_at?: string | null;
  attachments?: TicketAttachment[];
  created_at: string;
  messages: TicketMessage[];
};

export function Ticket360Drawer({
  ticketId,
  onClose,
}: {
  ticketId: number;
  onClose: () => void;
}) {
  const { data: ticket, isLoading, error } = useQuery({
    queryKey: ["ticket", String(ticketId)],
    queryFn: () =>
      apiFetch<TicketDetails>(`/api/v1/tickets/${ticketId}`),
  });

  const attachmentHref = (url: string) => {
    if (/^https?:\/\//i.test(url)) return url;
    // Keep the same backend base path used by the Tickets page for uploaded files.
    const base =
      (import.meta as any).env?.VITE_API_BASE_URL ||
      "http://192.168.1.79:8000";
    return `${String(base).replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
  };

  const formatFileSize = (bytes?: number | null) => {
    if (bytes == null || !Number.isFinite(bytes)) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const slaIsBreached =
    Boolean(ticket?.sla_breached) ||
    Boolean(
      ticket?.sla_due_at &&
      !ticket?.first_response_at &&
      new Date(ticket.sla_due_at).getTime() < Date.now()
    );

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close ticket preview"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-background shadow-2xl dark:border-slate-700 dark:bg-slate-950">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
          <div>
            <h2 className="font-semibold">Ticket Preview</h2>
            <p className="text-xs text-muted-foreground">
              {ticket ? `#${ticket.ticket_number}` : `Ticket #${ticketId}`}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : error || !ticket ? (
            <p className="py-6 text-sm text-muted-foreground">
              Could not load this ticket. Close the preview and try again.
            </p>
          ) : (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold">{ticket.subject}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Created {new Date(ticket.created_at).toLocaleString()}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="capitalize">{ticket.status.replace(/_/g, " ")}</Badge>
                <Badge variant="outline" className="capitalize">{ticket.priority} priority</Badge>
                <Badge variant="outline" className="capitalize">{ticket.urgency} urgency</Badge>
                {slaIsBreached && (
                  <Badge className="border border-red-500/30 bg-red-500/10 text-red-400">
                    <AlertTriangle className="mr-1 h-3 w-3" /> SLA breached
                  </Badge>
                )}
              </div>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Requester</h3>
                <p className="text-sm">
                  {ticket.requester_name || "Name not provided"}
                </p>
                <a
                  href={`mailto:${ticket.requester_email}`}
                  className="break-all text-sm text-primary hover:underline"
                >
                  {ticket.requester_email}
                </a>
                {ticket.requester_phone && (
                  <p className="text-sm text-muted-foreground">
                    {ticket.requester_phone}
                  </p>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Description</h3>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {ticket.description || "No description provided."}
                </p>
              </section>

              {ticket.category && (
                <section className="space-y-1">
                  <h3 className="text-sm font-semibold">Category</h3>
                  <p className="text-sm">{ticket.category}</p>
                </section>
              )}

              <section className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Clock className="h-4 w-4 text-blue-500" /> SLA
                </h3>
                <div className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Due date</span>
                  <span className="text-right">{ticket.sla_due_at ? new Date(ticket.sla_due_at).toLocaleString() : "—"}</span>
                </div>
                <div className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">First response</span>
                  <span className="text-right">{ticket.first_response_at ? new Date(ticket.first_response_at).toLocaleString() : "—"}</span>
                </div>
                {slaIsBreached && (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-red-400">
                    <AlertTriangle className="h-3.5 w-3.5" /> SLA breached
                  </p>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Paperclip className="h-4 w-4 text-blue-500" /> Attachments ({ticket.attachments?.length ?? 0})
                </h3>
                {!ticket.attachments?.length ? (
                  <p className="text-sm text-muted-foreground">No attachments.</p>
                ) : (
                  <div className="space-y-2">
                    {ticket.attachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <a href={attachmentHref(attachment.file_url)} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium text-primary hover:underline">
                            {attachment.file_name || "Attachment"}
                          </a>
                          <p className="text-xs text-muted-foreground">
                            {[formatFileSize(attachment.file_size), attachment.file_type].filter(Boolean).join(" · ") || "File"}
                          </p>
                        </div>
                        <a href={attachmentHref(attachment.file_url)} target="_blank" rel="noreferrer" aria-label={`Open ${attachment.file_name}`} title="Open attachment" className="rounded-md p-2 hover:bg-muted">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">
                  Conversation ({ticket.messages?.length ?? 0})
                </h3>

                {(ticket.messages ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No replies yet.
                  </p>
                ) : (
                  ticket.messages.map((message) => (
                    <div
                      key={message.id}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-medium">
                          {message.sender_name ||
                            message.sender_email ||
                            "Agent"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(message.created_at).toLocaleString()}
                        </span>
                      </div>
                      {message.is_internal && (
                        <Badge variant="outline">Internal note</Badge>
                      )}
                      <p className="whitespace-pre-wrap text-sm">
                        {message.message}
                      </p>
                    </div>
                  ))
                )}
              </section>
            </div>
          )}
        </div>

        {ticket && (
          <div className="shrink-0 border-t p-4">
            <Button asChild className="w-full">
              <Link
                to="/tickets/$id"
                params={{ id: String(ticket.id) }}
              >
                Open Full Ticket
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}
      </aside>
    </div>
  );
}
