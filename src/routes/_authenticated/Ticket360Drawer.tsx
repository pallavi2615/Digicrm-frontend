
import { useQuery } from "@/lib/react-data-client";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, X, ExternalLink } from "lucide-react";
import { Link } from "@/lib/router-compat";

type TicketMessage = {
  id: number;
  sender_name: string | null;
  sender_email: string | null;
  message: string;
  is_internal: boolean;
  created_at: string;
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

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close ticket preview"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l bg-background shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b p-4">
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
                <Badge variant="outline">{ticket.status}</Badge>
                <Badge variant="outline">{ticket.priority} priority</Badge>
                <Badge variant="outline">{ticket.urgency} urgency</Badge>
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
