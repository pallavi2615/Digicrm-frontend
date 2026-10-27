import { defineRoute, Link } from "@/lib/router-compat";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-data-client";
import { apiFetch, apiUpload } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Ticket as TicketIcon,
  Plus,
  Search,
  AlertTriangle,
  Loader2,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
  Pencil,
  CalendarClock,
  Star,
  Paperclip,
  FileText,
  ExternalLink,
  X,
  RefreshCw,
  Filter,
  SlidersHorizontal,
  CalendarDays,
  Flag,
  CircleDot,
  CheckCircle2,
  Inbox,
  Hourglass,
  Archive,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Ticket360Drawer } from "@/components/Ticket360Drawer";
import { useAuth } from "@/hooks/use-auth";

export const Route = defineRoute("/_authenticated/tickets")({
  head: () => ({ meta: [{ title: "Tickets — DigiCRM AI" }, { name: "robots", content: "noindex" }] }),
  component: TicketsPage,
});

type Ticket = {
  id: number;
  tenant_id: number;
  subject: string;
  description: string | null;
  ticket_number: string;
  requester_name: string | null;
  requester_email: string;
  requester_phone: string | null;
  requester_id: number | null;
  status: string;
  priority: string;
  urgency: string;
  category: string | null;
  assigned_to: number | null;
  created_by: number | null;
  sla_due_at: string | null;
  sla_breached: boolean;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  tags: string[];
  custom_fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type TicketStats = {
  all: number;
  open: number;
  pending: number;
  resolved: number;
  closed: number;
  sla_breached: number;
};

type TicketsPaginatedResponse = {
  items: Ticket[];
  meta: {
    total_items: number;
    total_pages: number;
    current_page: number;
    page_size: number;
    has_next: boolean;
    has_previous: boolean;
  };
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  resolved: "bg-green-500/10 text-green-500 border-green-500/20",
  closed: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  reopened: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  reassigned: "bg-violet-500/10 text-violet-600 border-violet-500/20",
};
const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-500/10 text-slate-500",
  medium: "bg-blue-500/10 text-blue-500",
  high: "bg-orange-500/10 text-orange-500",
  urgent: "bg-red-500/10 text-red-500",
};
const URGENCY_COLORS: Record<string, string> = {
  low: "bg-slate-500/10 text-slate-500",
  medium: "bg-sky-500/10 text-sky-500",
  high: "bg-amber-500/10 text-amber-500",
  critical: "bg-red-500/10 text-red-500 font-semibold",
};

const navBtn = "h-8 w-8 rounded-lg border border-border/60 bg-card text-sm font-medium flex items-center justify-center transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-card disabled:cursor-not-allowed";

const TICKET_FILTERS_STORAGE_KEY = "digicrm.tickets.filters.v1";

type SavedTicketFilters = {
  status: string;
  priority: string;
  urgency: string;
  search: string;
  dateFrom: string;
  dateTo: string;
  slaBreachedOnly: boolean;
};

const DEFAULT_TICKET_FILTERS: SavedTicketFilters = {
  status: "all", priority: "all", urgency: "all", search: "", dateFrom: "", dateTo: "", slaBreachedOnly: false,
};

function readSavedTicketFilters(): SavedTicketFilters {
  if (typeof window === "undefined") return DEFAULT_TICKET_FILTERS;
  try {
    const saved = window.localStorage.getItem(TICKET_FILTERS_STORAGE_KEY);
    return saved ? { ...DEFAULT_TICKET_FILTERS, ...JSON.parse(saved) } : DEFAULT_TICKET_FILTERS;
  } catch {
    return DEFAULT_TICKET_FILTERS;
  }
}

function TicketsPage() {
  const { isAdmin, user } = useAuth();
  const roleValue = String((user as any)?.role ?? (user as any)?.role_name ?? (user as any)?.user_role ?? "").toLowerCase();
  const isManager = !isAdmin && (roleValue.includes("manager") || roleValue.includes("team_lead"));
  const isExecutive = !isAdmin && !isManager;
  const canViewTeam = isAdmin || isManager;
  const [ticketScope, setTicketScope] = useState<"my" | "team">("my");
  const currentUserId = Number((user as any)?.id);
  const [initialFilters] = useState<SavedTicketFilters>(readSavedTicketFilters);
  const [status, setStatus] = useState<string>(initialFilters.status);
  const [priority, setPriority] = useState<string>(initialFilters.priority);
  const [urgency, setUrgency] = useState<string>(initialFilters.urgency);
  const [search, setSearch] = useState(initialFilters.search);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState(initialFilters.dateFrom);
  const [dateTo, setDateTo] = useState(initialFilters.dateTo);
  const [slaBreachedOnly, setSlaBreachedOnly] = useState<boolean>(initialFilters.slaBreachedOnly);
  const [showNew, setShowNew] = useState(false);
  const [view360TicketId, setView360TicketId] = useState<number | null>(null);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [schedulingTicket, setSchedulingTicket] = useState<Ticket | null>(null);
  const [reassignTicket, setReassignTicket] = useState<Ticket | null>(null);
  const [reassignTo, setReassignTo] = useState("");
  const [reopenTicket, setReopenTicket] = useState<Ticket | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [reopenPriority, setReopenPriority] = useState("medium");
  const [reopenAssignedTo, setReopenAssignedTo] = useState("");
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<number>>(new Set());
  const [bulkActionsOpen, setBulkActionsOpen] = useState(false);
  const [selectAllMenuOpen, setSelectAllMenuOpen] = useState(false);
  const [showAllEntries, setShowAllEntries] = useState(false);
  const [allEntriesSelectionPending, setAllEntriesSelectionPending] = useState(false);
  useEffect(() => {
    if (selectedTicketIds.size === 0) setBulkActionsOpen(false);
  }, [selectedTicketIds.size]);
  const [bulkAction, setBulkAction] = useState<string>("status");
  const [bulkActionValue, setBulkActionValue] = useState<string>("open");
  const [bulkSaving, setBulkSaving] = useState(false);
 
  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);


  // Preserve selected filters and search across page refreshes until cleared.
  useEffect(() => {
    try {
      window.localStorage.setItem(TICKET_FILTERS_STORAGE_KEY, JSON.stringify({
        status, priority, urgency, search, dateFrom, dateTo, slaBreachedOnly,
      }));
    } catch {
      // Browser storage may be unavailable; filters still work for this session.
    }
  }, [status, priority, urgency, search, dateFrom, dateTo, slaBreachedOnly]);

  // Fetch all backend pages so My Tickets / My Team Tickets are filtered accurately.
  const { data: ticketsData, isLoading } = useQuery({
    queryKey: ["tickets", "scope-aware-all"],
    queryFn: async (): Promise<TicketsPaginatedResponse & { all_entries_loaded?: boolean }> => {
      const first = await apiFetch<TicketsPaginatedResponse>("/api/v1/tickets?page=1&size=100");
      const allItems = [...(first.items ?? [])];
      for (let currentPage = 2; currentPage <= (first.meta?.total_pages ?? 1); currentPage += 1) {
        const next = await apiFetch<TicketsPaginatedResponse>(`/api/v1/tickets?page=${currentPage}&size=100`);
        allItems.push(...(next.items ?? []));
      }
      return {
        items: allItems,
        meta: {
          total_items: first.meta?.total_items ?? allItems.length,
          total_pages: 1,
          current_page: 1,
          page_size: allItems.length,
          has_next: false,
          has_previous: false,
        },
        all_entries_loaded: true,
      };
    },
    refetchInterval: 30000,
  });

  // Extract items and meta safely
  const tickets = ticketsData?.items ?? [];
  const meta = ticketsData?.meta;

  const { data: stats } = useQuery({
    queryKey: ["tickets", "stats"],
    queryFn: () => apiFetch<TicketStats>("/api/v1/tickets/stats"),
    refetchInterval: 30000,
  });

  const queryClient = useQueryClient();

  const { data: bulkAssignees = [], isLoading: bulkAssigneesLoading } = useQuery({
    queryKey: ["ticket-assignees"],
    queryFn: async () => {
      const res = await apiFetch<any>("/api/v1/users/assignees");
      const list = Array.isArray(res) ? res : res?.data ?? res?.items ?? res?.users ?? [];
      return list as Array<{ id: number | string; full_name?: string | null; name?: string | null; email?: string | null }>;
    },
  });

  const allowedBulkActions = [
    ...(isAdmin ? [{ value: "delete", label: "Delete selected" }] : []),
    ...(!isExecutive ? [{ value: "assign", label: "Assign to" }] : []),
    { value: "status", label: "Change status" },
    { value: "priority", label: "Change priority" },
    { value: "escalate", label: "Escalate selected" },
  ];

  // Only admins are shown the delete action. The backend must also enforce admin permissions.
  const deleteTicket = useMutation({
    mutationFn: (ticket: Ticket) =>
      apiFetch(`/api/v1/tickets/${ticket.id}`, { method: "DELETE" }),
    onSuccess: (_result, ticket) => {
      toast.success(`Ticket #${ticket.ticket_number} deleted`);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["tickets", "stats"] });
      queryClient.invalidateQueries({ queryKey: ["ticket", String(ticket.id)] });
      setSelectedTicketIds((current) => {
        const next = new Set(current);
        next.delete(ticket.id);
        return next;
      });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete ticket"),
  });

  const handleDeleteTicket = (ticket: Ticket) => {
    if (!isAdmin) return;
    const confirmed = window.confirm(
      `Delete ticket #${ticket.ticket_number} — "${ticket.subject}"? This action cannot be undone.`,
    );
    if (confirmed) deleteTicket.mutate(ticket);
  };

  const applyBulkChanges = async () => {
    const ids = Array.from(selectedTicketIds);
    if (!ids.length || bulkSaving) return;
    if (!allowedBulkActions.some((action) => action.value === bulkAction)) {
      toast.error("You do not have permission to perform this bulk action");
      return;
    }
    if (bulkAction === "assign" && !bulkActionValue) {
      toast.error("Choose a user to assign the selected tickets to");
      return;
    }
    if (bulkAction === "delete") {
      if (!isAdmin) {
        toast.error("Only admins can delete tickets");
        return;
      }
      if (!window.confirm(`Delete ${ids.length} selected ticket${ids.length === 1 ? "" : "s"}? This action cannot be undone.`)) return;
    }

    setBulkSaving(true);
    let succeeded = 0;
    const failed: number[] = [];
    try {
      for (const id of ids) {
        try {
          if (bulkAction === "delete") {
            await apiFetch(`/api/v1/tickets/${id}`, { method: "DELETE" });
          } else if (bulkAction === "status") {
            await apiFetch(`/api/v1/tickets/${id}`, { method: "PUT", body: JSON.stringify({ status: bulkActionValue }) });
          } else if (bulkAction === "priority") {
            await apiFetch(`/api/v1/tickets/${id}`, { method: "PUT", body: JSON.stringify({ priority: bulkActionValue }) });
          } else if (bulkAction === "assign") {
            await apiFetch(`/api/v1/tickets/${id}`, { method: "PUT", body: JSON.stringify({ assigned_to: Number(bulkActionValue) }) });
          } else if (bulkAction === "escalate") {
            const current = await apiFetch<Ticket>(`/api/v1/tickets/${id}`);
            await apiFetch(`/api/v1/tickets/${id}`, {
              method: "PUT",
              body: JSON.stringify({
                custom_fields: {
                  ...(current?.custom_fields ?? {}),
                  escalated: true,
                  escalation_requested: true,
                  escalation_requested_at: new Date().toISOString(),
                },
              }),
            });
          }
          succeeded += 1;
        } catch {
          failed.push(id);
        }
      }

      if (succeeded > 0) {
        const label = allowedBulkActions.find((action) => action.value === bulkAction)?.label ?? "Bulk changes";
        toast.success(`${label}: ${succeeded} ticket${succeeded === 1 ? "" : "s"} updated`);
      }
      if (failed.length) toast.error(`Could not update ${failed.length} ticket${failed.length === 1 ? "" : "s"} (ID${failed.length === 1 ? "" : "s"}: ${failed.join(", ")})`);
      if (succeeded > 0) {
        setSelectedTicketIds(new Set());
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["tickets"] }),
          queryClient.invalidateQueries({ queryKey: ["tickets", "stats"] }),
        ]);
      }
    } finally {
      setBulkSaving(false);
    }
  };

  const togglePriorityMarker = useMutation({
    mutationFn: (ticket: Ticket) =>
      apiFetch(`/api/v1/tickets/${ticket.id}`, {
        method: "PUT",
        body: JSON.stringify({
          custom_fields: {
            ...(ticket.custom_fields ?? {}),
            priority_marker: !Boolean(ticket.custom_fields?.priority_marker),
          },
        }),
      }),
    onSuccess: () => {
      toast.success("Ticket priority marker updated");
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Allow status and priority to be updated directly from the table.
  const updateTicketField = useMutation({
    mutationFn: ({ id, field, value }: { id: number; field: "status" | "priority"; value: string }) =>
      apiFetch(`/api/v1/tickets/${id}`, {
        method: "PUT",
        body: JSON.stringify({ [field]: value }),
      }),
    onSuccess: (_result, variables) => {
      toast.success(`Ticket ${variables.field} updated`);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket", String(variables.id)] });
      queryClient.invalidateQueries({ queryKey: ["tickets", "stats"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update ticket"),
  });

  // Local Filters (Search, Status, etc.) on the current page data
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const start = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const end = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;
    const scopeTickets = canViewTeam
      ? tickets.filter((t) => ticketScope === "my" ? Number(t.assigned_to) === currentUserId : Number(t.assigned_to) !== currentUserId)
      : tickets.filter((t) => Number(t.assigned_to) === currentUserId);
    return scopeTickets.filter((t) => {
      if (status !== "all" && t.status !== status) return false;
      if (priority !== "all" && t.priority !== priority) return false;
      if (urgency !== "all" && t.urgency !== urgency) return false;
      if (slaBreachedOnly) {
        const dueAt = t.sla_due_at ? new Date(t.sla_due_at).getTime() : Number.NaN;
        const overdueWithoutResponse = !t.first_response_at && Number.isFinite(dueAt) && dueAt < Date.now();
        if (!t.sla_breached && !overdueWithoutResponse) return false;
      }
      if (start || end) {
        const created = new Date(t.created_at);
        if (start && created < start) return false;
        if (end && created > end) return false;
      }
      if (!q) return true;
      return (
        (t.subject ?? "").toLowerCase().includes(q) ||
        (t.requester_email ?? "").toLowerCase().includes(q) ||
        (t.ticket_number ?? "").toLowerCase().includes(q) ||
        String(t.id).includes(q)
      );
    });
  }, [tickets, canViewTeam, ticketScope, currentUserId, status, priority, urgency, search, dateFrom, dateTo, slaBreachedOnly]);

  const activeFilterCount =
    (status !== "all" ? 1 : 0) +
    (priority !== "all" ? 1 : 0) +
    (urgency !== "all" ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (slaBreachedOnly ? 1 : 0);

  const clearFilters = () => {
    setStatus("all");
    setPriority("all");
    setUrgency("all");
    setDateFrom("");
    setDateTo("");
    setSearch("");
    setSlaBreachedOnly(false);
    setPage(1);
    try {
      window.localStorage.removeItem(TICKET_FILTERS_STORAGE_KEY);
    } catch {
      // Ignore unavailable storage.
    }
  };

  const counts = stats ?? {
    all: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    pending: tickets.filter((t) => t.status === "pending").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    closed: tickets.filter((t) => t.status === "closed").length,
    sla_breached: tickets.filter((t) => t.sla_breached).length,
  };

  const totalPages = meta?.total_pages ?? 1;
  const totalItems = meta?.total_items ?? tickets.length;
  const visibleTicketIds = filtered.map((ticket) => ticket.id);
  useEffect(() => {
    if (!allEntriesSelectionPending || !showAllEntries || !ticketsData?.all_entries_loaded || isLoading) return;
    setSelectedTicketIds(new Set(visibleTicketIds));
    setAllEntriesSelectionPending(false);
    setSelectAllMenuOpen(false);
    toast.success(`Selected ${visibleTicketIds.length} matching ticket${visibleTicketIds.length === 1 ? "" : "s"}`);
  }, [allEntriesSelectionPending, showAllEntries, ticketsData, isLoading, visibleTicketIds]);
  const allVisibleSelected = visibleTicketIds.length > 0 && visibleTicketIds.every((id) => selectedTicketIds.has(id));
  const someVisibleSelected = visibleTicketIds.some((id) => selectedTicketIds.has(id));
  const toggleTicketSelection = (id: number, checked: boolean) => {
    setSelectedTicketIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const toggleAllVisibleTickets = () => {
    setSelectedTicketIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleTicketIds.forEach((id) => next.delete(id));
      else visibleTicketIds.forEach((id) => next.add(id));
      return next;
    });
    setSelectAllMenuOpen(false);
  };

  const chooseAllEntries = () => {
    setSelectAllMenuOpen(false);
    setPage(1);
    setShowAllEntries(true);
    setAllEntriesSelectionPending(true);
  };

  const chooseCurrentPage = () => {
    setShowAllEntries(false);
    setAllEntriesSelectionPending(false);
    toggleAllVisibleTickets();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <TicketIcon className="h-6 w-6" /> Tickets
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Support inbox</p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Ticket
        </Button>
      </div>

      {canViewTeam && (
        <div className="inline-flex rounded-2xl border bg-card p-1.5 shadow-sm dark:border-slate-700">
          {([
            { key: "my", label: "My Tickets" },
            { key: "team", label: "My Team Tickets" },
          ] as const).map(({ key, label }) => {
            const active = ticketScope === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTicketScope(key);
                  setSelectedTicketIds(new Set());
                  setBulkActionsOpen(false);
                  setSelectAllMenuOpen(false);
                  setAllEntriesSelectionPending(false);
                  setShowAllEntries(false);
                  setPage(1);
                }}
                className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${active ? "bg-blue-600 text-white shadow-md" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                {key === "my" ? <User className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                {label}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="All Tickets" value={counts.all} icon={Inbox} tone="blue" onClick={() => setStatus("all")} active={status === "all"} />
        <StatCard label="Open" value={counts.open} icon={CircleDot} tone="teal" onClick={() => setStatus("open")} active={status === "open"} />
        <StatCard label="Pending" value={counts.pending} icon={Hourglass} tone="amber" onClick={() => setStatus("pending")} active={status === "pending"} />
        <StatCard label="Resolved" value={counts.resolved} icon={CheckCircle2} tone="green" onClick={() => setStatus("resolved")} active={status === "resolved"} />
        <StatCard label="Closed" value={counts.closed} icon={Archive} tone="violet" onClick={() => setStatus("closed")} active={status === "closed"} />
        <StatCard
          label="SLA Breached"
          value={counts.sla_breached}
          icon={AlertTriangle}
          tone="danger"
          onClick={() => {
            setStatus("all");
            setSlaBreachedOnly((current) => !current);
            setPage(1);
          }}
          active={slaBreachedOnly}
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative w-full min-w-0 sm:min-w-64 sm:flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search subject, requester, email or ticket ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 rounded-xl border-slate-200 bg-slate-50/60 pl-9 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl border-slate-200 bg-white px-4 font-medium text-slate-800 shadow-sm hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800"
                disabled={selectedTicketIds.size === 0 || bulkSaving}
                onClick={() => setBulkActionsOpen((open) => !open)}
                aria-expanded={bulkActionsOpen}
                aria-controls="ticket-bulk-actions"
                title={selectedTicketIds.size === 0 ? "Select one or more tickets to enable actions" : "Bulk actions for selected tickets"}
              >
                Actions
                {selectedTicketIds.size > 0 && (
                  <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-semibold text-white">
                    {selectedTicketIds.size}
                  </span>
                )}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
              {bulkActionsOpen && selectedTicketIds.size > 0 && (
                <div id="ticket-bulk-actions" className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-950">
                  <div className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-slate-800">
                    {selectedTicketIds.size} ticket{selectedTicketIds.size === 1 ? "" : "s"} selected
                  </div>
                  {allowedBulkActions.map((action) => (
                    <button
                      key={action.value}
                      type="button"
                      onClick={() => {
                        setBulkAction(action.value);
                        setBulkActionValue(action.value === "status" ? "open" : action.value === "priority" ? "medium" : "");
                      }}
                      className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-900 ${bulkAction === action.value ? "bg-slate-50 font-medium dark:bg-slate-900" : ""} ${action.value === "delete" ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-200"}`}
                    >
                      <span>{action.value === "status" ? "Status Change" : action.value === "assign" ? "Assign To" : action.value === "priority" ? "Change Priority" : action.value === "escalate" ? "Escalate selected" : action.label}</span>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </button>
                  ))}
                  {bulkAction === "status" && (
                    <div className="border-t border-slate-100 p-3 dark:border-slate-800">
                      <label className="mb-1 block text-xs font-medium text-slate-500">New status</label>
                      <Select value={bulkActionValue || "open"} onValueChange={setBulkActionValue}>
                        <SelectTrigger className="h-9 rounded-lg"><SelectValue placeholder="Choose status" /></SelectTrigger>
                        <SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="resolved">Resolved</SelectItem><SelectItem value="closed">Closed</SelectItem><SelectItem value="reopened">Reopened</SelectItem><SelectItem value="reassigned">Reassigned</SelectItem></SelectContent>
                      </Select>
                    </div>
                  )}
                  {bulkAction === "priority" && (
                    <div className="border-t border-slate-100 p-3 dark:border-slate-800">
                      <label className="mb-1 block text-xs font-medium text-slate-500">New priority</label>
                      <Select value={bulkActionValue || "medium"} onValueChange={setBulkActionValue}>
                        <SelectTrigger className="h-9 rounded-lg"><SelectValue placeholder="Choose priority" /></SelectTrigger>
                        <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent>
                      </Select>
                    </div>
                  )}
                  {bulkAction === "assign" && (
                    <div className="border-t border-slate-100 p-3 dark:border-slate-800">
                      <label className="mb-1 block text-xs font-medium text-slate-500">Assign to</label>
                      <Select value={bulkActionValue || ""} onValueChange={setBulkActionValue}>
                        <SelectTrigger className="h-9 rounded-lg"><SelectValue placeholder={bulkAssigneesLoading ? "Loading users…" : "Choose user"} /></SelectTrigger>
                        <SelectContent>{bulkAssignees.map((person) => <SelectItem key={String(person.id)} value={String(person.id)}>{person.full_name || person.name || person.email || `User ${person.id}`}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                  {(bulkAction === "escalate" || bulkAction === "delete") && (
                    <p className={`border-t border-slate-100 px-3 py-2 text-xs dark:border-slate-800 ${bulkAction === "delete" ? "text-red-600 dark:text-red-400" : "text-slate-500"}`}>
                      {bulkAction === "delete" ? "This action cannot be undone." : "Flag selected tickets for manager review."}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 p-2 dark:border-slate-800">
                    <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => { setSelectedTicketIds(new Set()); setBulkActionsOpen(false); }}>Clear</Button>
                    <Button type="button" className="h-8 rounded-lg bg-blue-600 px-3 text-white hover:bg-blue-700" onClick={async () => { await applyBulkChanges(); setBulkActionsOpen(false); }} disabled={bulkSaving || (bulkAction === "assign" && (!bulkActionValue || bulkAssigneesLoading))}>
                      {bulkSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Save Changes
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <Button
              className="relative h-10 rounded-xl bg-blue-600 px-4 text-white shadow-sm hover:bg-blue-700 dark:border dark:border-blue-500 dark:bg-slate-900/80 dark:hover:bg-slate-800"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <Filter className="mr-2 h-4 w-4" /> Filter
              <ChevronRight className={`ml-2 h-4 w-4 transition-transform ${filtersOpen ? "rotate-90" : "rotate-0"}`} />
              {activeFilterCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>

          {filtersOpen && (
            <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white shadow-sm dark:border-slate-800 dark:from-slate-900/80 dark:to-slate-950/80">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3.5 sm:px-5 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                    <SlidersHorizontal className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">Filters</div>
                    <div className="text-xs text-muted-foreground">Narrow down tickets by status, priority, urgency and created date</div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800" aria-label="Close filters" onClick={() => setFiltersOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-5 sm:px-5">
                <div className="grid gap-1.5">
                  <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500"><CircleDot className="h-3.5 w-3.5" /> Status</label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="reopened">Reopened</SelectItem>
                      <SelectItem value="reassigned">Reassigned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500"><Flag className="h-3.5 w-3.5" /> Priority</label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"><SelectValue placeholder="Priority" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All priorities</SelectItem><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500"><AlertTriangle className="h-3.5 w-3.5" /> Urgency</label>
                  <Select value={urgency} onValueChange={setUrgency}>
                    <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"><SelectValue placeholder="Urgency" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All urgencies</SelectItem><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="ticket-created-from" className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500"><CalendarDays className="h-3.5 w-3.5" /> Created from</label>
                  <Input id="ticket-created-from" type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} className="h-10 rounded-lg border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100" />
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="ticket-created-to" className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500"><CalendarDays className="h-3.5 w-3.5" /> Created to</label>
                  <Input id="ticket-created-to" type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} className="h-10 rounded-lg border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-200/70 bg-slate-50/60 px-4 py-3 sm:px-5 dark:border-slate-800 dark:bg-slate-900/40">
                <span className="text-xs text-muted-foreground"><span className="font-semibold text-slate-700 dark:text-slate-200">{filtered.length}</span> tickets match on this page</span>
                <Button variant="outline" size="sm" className="h-8 rounded-lg border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800" onClick={clearFilters}><X className="mr-1 h-3.5 w-3.5" /> Clear filters</Button>
              </div>
            </div>
          )}


          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 px-3">
                    <div className="relative inline-flex">
                      <input
                        type="checkbox"
                        aria-label="Select tickets"
                        checked={allVisibleSelected}
                        ref={(element) => { if (element) element.indeterminate = someVisibleSelected && !allVisibleSelected; }}
                        onClick={(event) => { event.preventDefault(); setSelectAllMenuOpen((open) => !open); }}
                        onChange={() => undefined}
                        className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
                      />
                      {selectAllMenuOpen && (
                        <>
                          <button type="button" aria-label="Close select all menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setSelectAllMenuOpen(false)} />
                          <div className="absolute left-0 top-6 z-50 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-950">
                            <button type="button" onClick={chooseCurrentPage} className="w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-900">
                              <span className="block font-medium text-slate-900 dark:text-slate-100">Select entries on this page</span>
                              <span className="mt-0.5 block text-xs text-slate-500">Select only the currently displayed tickets</span>
                            </button>
                            <button type="button" onClick={chooseAllEntries} className="w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-900">
                              <span className="block font-medium text-slate-900 dark:text-slate-100">Select all entries</span>
                              <span className="mt-0.5 block text-xs text-slate-500">Load all tickets into one scrollable table</span>
                            </button>
                            <div className="mt-1 flex justify-end border-t border-slate-100 px-1 pt-2 dark:border-slate-800">
                              <button
                                type="button"
                                onClick={() => {
                                  // Cancel the selection operation and clear every selected ticket.
                                  setSelectAllMenuOpen(false);
                                  setAllEntriesSelectionPending(false);
                                  setSelectedTicketIds(new Set());
                                  setBulkActionsOpen(false);
                                  setShowAllEntries(false);
                                  setPage(1);
                                }}
                                className="inline-flex h-8 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-950"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="w-14 px-3">Id</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>SLA & Due Date</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={9} className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">No tickets yet — try the customer portal or create one.</TableCell></TableRow>
                ) : filtered.map((t) => {
                  const dueDateValue = typeof t.custom_fields?.due_date === "string" ? t.custom_fields.due_date : "";
                  const dueDateLabel = dueDateValue ? new Date(dueDateValue).toLocaleString() : "—";
                  return (
                    <TableRow
                      key={t.id}
                      className={`${selectedTicketIds.has(t.id) ? "bg-primary/5" : ""}`}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ticket ${t.ticket_number}`}
                          checked={selectedTicketIds.has(t.id)}
                          onChange={(e) => toggleTicketSelection(t.id, e.target.checked)}
                          className="h-4 w-4 rounded border-border accent-primary"
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{t.id}</TableCell>
                      <TableCell className="max-w-75 truncate font-medium">{t.subject}</TableCell>
                      <TableCell className="text-sm">
                        <div>{t.requester_name ?? t.requester_email}</div>
                        {t.requester_name && <div className="text-xs text-muted-foreground">{t.requester_email}</div>}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={`Change status for ticket ${t.ticket_number}`}
                              disabled={updateTicketField.isPending && updateTicketField.variables?.id === t.id}
                              className={`inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium capitalize transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-60 ${STATUS_COLORS[t.status] ?? "bg-muted text-foreground border-border"}`}
                            >
                              {t.status}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {["open", "pending", "resolved", "closed"].map((value) => (
                              <DropdownMenuItem key={value} disabled={value === t.status} onSelect={() => updateTicketField.mutate({ id: t.id, field: "status", value })}>
                                <span className={`mr-2 inline-block h-2 w-2 rounded-full ${value === "open" ? "bg-blue-500" : value === "pending" ? "bg-yellow-500" : value === "resolved" ? "bg-green-500" : "bg-gray-500"}`} />
                                <span className="capitalize">{value}</span>
                                {value === t.status && <CheckCircle2 className="ml-2 h-3.5 w-3.5" />}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuItem onSelect={() => { setReassignTicket(t); setReassignTo(t.assigned_to == null ? "" : String(t.assigned_to)); }}>
                              <Users className="mr-2 h-3.5 w-3.5" /> Reassign
                            </DropdownMenuItem>
                            {t.status === "closed" && (
                              <DropdownMenuItem onSelect={() => { setReopenTicket(t); setReopenReason(""); setReopenPriority(t.priority || "medium"); setReopenAssignedTo(t.assigned_to == null ? "unassigned" : String(t.assigned_to)); }}>
                                <RefreshCw className="mr-2 h-3.5 w-3.5" /> Reopen
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={`Change priority for ticket ${t.ticket_number}`}
                              disabled={updateTicketField.isPending && updateTicketField.variables?.id === t.id}
                              className={`inline-flex h-7 items-center rounded-full border border-transparent px-2.5 text-xs font-medium capitalize transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-60 ${PRIORITY_COLORS[t.priority] ?? "bg-muted text-foreground"}`}
                            >
                              {t.priority}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {["low", "medium", "high", "urgent"].map((value) => (
                              <DropdownMenuItem key={value} disabled={value === t.priority} onSelect={() => updateTicketField.mutate({ id: t.id, field: "priority", value })}>
                                <span className={`mr-2 inline-block h-2 w-2 rounded-full ${value === "low" ? "bg-slate-500" : value === "medium" ? "bg-blue-500" : value === "high" ? "bg-orange-500" : "bg-red-500"}`} />
                                <span className="capitalize">{value}</span>
                                {value === t.priority && <CheckCircle2 className="ml-2 h-3.5 w-3.5" />}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <SlaCell dueAt={t.sla_due_at} breached={t.sla_breached} responded={!!t.first_response_at} />
                          <div className="text-xs text-muted-foreground whitespace-nowrap">Due: {dueDateLabel}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {(() => {
                          const assigned = bulkAssignees.find((person) => String(person.id) === String(t.assigned_to));
                          return assigned ? (assigned.full_name || assigned.name || assigned.email || `User ${assigned.id}`) : (t.assigned_to == null ? "Unassigned" : `User ${t.assigned_to}`);
                        })()}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-start gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 dark:hover:bg-blue-500/30 dark:hover:text-blue-200"
                            title="View 360°"
                            aria-label="View 360°"
                            onClick={() => setView360TicketId(t.id)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {isAdmin ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                              title="Edit ticket details (admin)"
                              aria-label="Edit ticket details (admin)"
                              onClick={() => setEditingTicket(t)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                              title="Open ticket details"
                              aria-label="Open ticket details"
                              onClick={() => { window.location.href = `/tickets/${t.id}`; }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100 dark:bg-violet-500/20 dark:text-violet-300 dark:hover:bg-violet-500/30"
                              title="Open ticket detail page"
                              aria-label="Open ticket detail page"
                              onClick={() => { window.location.href = `/tickets/${t.id}`; }}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {isAdmin && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 dark:bg-red-500/20 dark:text-red-300 dark:hover:bg-red-500/30"
                              title="Delete ticket (admin only)"
                              aria-label={`Delete ticket ${t.ticket_number}`}
                              disabled={deleteTicket.isPending && deleteTicket.variables?.id === t.id}
                              onClick={() => handleDeleteTicket(t)}
                            >
                              {deleteTicket.isPending && deleteTicket.variables?.id === t.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Trash2 className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                          {/* <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 dark:hover:bg-indigo-500/30 dark:hover:text-indigo-200"
                            title="Schedule activity"
                            aria-label="Schedule activity"
                            onClick={() => setSchedulingTicket(t)}
                          >
                            <CalendarClock className="h-3.5 w-3.5" />
                          </Button> */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg bg-slate-50 text-slate-600 hover:bg-amber-50 dark:bg-slate-800 dark:hover:bg-slate-700"
                            title="Mark as priority"
                            aria-label="Mark as priority"
                            onClick={() => togglePriorityMarker.mutate(t)}
                            disabled={togglePriorityMarker.isPending}
                          >
                            <Star className={`h-3.5 w-3.5 ${Boolean(t.custom_fields?.priority_marker) ? "fill-amber-400 text-amber-500" : ""}`} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* PAGINATION CONTROLS */}
          {!isLoading && tickets.length > 0 && (
            <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                <span>{showAllEntries ? <>Showing <span className="font-semibold text-foreground">{filtered.length}</span> matching entries in one list</> : (activeFilterCount > 0 || search.trim() ? <>Showing <span className="font-semibold text-foreground">{filtered.length}</span> of <span className="font-semibold text-foreground">{totalItems}</span> tickets</> : <>Showing <span className="font-semibold text-foreground">{filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min((page - 1) * pageSize + filtered.length, totalItems)}</span> of <span className="font-semibold text-foreground">{totalItems}</span> tickets</>)}</span>
                <span className="hidden sm:inline text-border">|</span>
                {!showAllEntries && <div className="flex items-center gap-2">
                  <span>Rows per page</span>
                  <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                    <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{[5, 10, 20, 50].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                  </Select>
                </div>}
                {showAllEntries && <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg" onClick={() => { setShowAllEntries(false); setAllEntriesSelectionPending(false); setPage(1); }}>Return to page</Button>}
              </div>

              {!showAllEntries && <div className="flex items-center gap-1.5">
                <button type="button" className={navBtn} disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></button>
                <span className="text-sm font-medium px-2">Page {page} of {totalPages}</span>
                <button type="button" className={navBtn} disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></button>
              </div>}
            </div>
          )}

        </CardContent>
      </Card>

      {showNew && <NewTicketDialog onClose={() => setShowNew(false)} />}
      <Dialog open={!!reassignTicket} onOpenChange={(open) => { if (!open) setReassignTicket(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Reassign Ticket {reassignTicket ? `#${reassignTicket.ticket_number}` : ""}</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Assign to</Label>
            <Select value={reassignTo || "unassigned"} onValueChange={(value) => setReassignTo(value === "unassigned" ? "" : value)}>
              <SelectTrigger><SelectValue placeholder="Choose a team member" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {bulkAssignees.map((person) => <SelectItem key={String(person.id)} value={String(person.id)}>{person.full_name || person.name || person.email || `User ${person.id}`}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Choose a member from the team list, then save to update the ticket assignment.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignTicket(null)}>Cancel</Button>
            <Button disabled={!reassignTicket || updateTicketField.isPending} onClick={async () => {
              if (!reassignTicket) return;
              try {
                await apiFetch(`/api/v1/tickets/${reassignTicket.id}`, { method: "PUT", body: JSON.stringify({ assigned_to: reassignTo ? Number(reassignTo) : null }) });
                toast.success("Ticket reassigned");
                await queryClient.invalidateQueries({ queryKey: ["tickets"] });
                setReassignTicket(null);
              } catch (error) { toast.error(error instanceof Error ? error.message : "Could not reassign ticket"); }
            }}>Save assignment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!reopenTicket} onOpenChange={(open) => { if (!open) setReopenTicket(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Reopen Ticket {reopenTicket ? `#${reopenTicket.ticket_number}` : ""}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Subject</Label><Input value={reopenTicket?.subject ?? ""} readOnly /></div>
            <div className="space-y-1.5"><Label>Requester Email</Label><Input value={reopenTicket?.requester_email ?? ""} readOnly /></div>
            <div className="space-y-1.5"><Label>Requester Name</Label><Input value={reopenTicket?.requester_name ?? ""} readOnly /></div>
            <div className="space-y-1.5"><Label>Priority</Label><Select value={reopenPriority} onValueChange={setReopenPriority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Assign to</Label><Select value={reopenAssignedTo || "unassigned"} onValueChange={setReopenAssignedTo}><SelectTrigger><SelectValue placeholder={bulkAssigneesLoading ? "Loading users…" : "Select assignee"} /></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{bulkAssignees.map((person) => <SelectItem key={String(person.id)} value={String(person.id)}>{person.full_name || person.name || person.email || `User ${person.id}`}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Reopen Description / Reason <span className="text-destructive">*</span></Label><Textarea rows={5} maxLength={5000} value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} placeholder="Explain why this ticket needs to be reopened and add the latest details…" /></div>
            <p className="text-xs text-muted-foreground">The ticket will be marked Reopened, and this reason will be added to its existing description.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenTicket(null)}>Cancel</Button>
            <Button disabled={!reopenTicket || !reopenReason.trim()} onClick={async () => {
              if (!reopenTicket || !reopenReason.trim()) return;
              try {
                const updatedDescription = `${reopenTicket.description?.trim() ? `${reopenTicket.description.trim()}\n\n` : ""}Reopened on ${new Date().toLocaleString()}:\n${reopenReason.trim()}`;
                await apiFetch(`/api/v1/tickets/${reopenTicket.id}`, { method: "PUT", body: JSON.stringify({ status: "reopened", priority: reopenPriority, assigned_to: reopenAssignedTo && reopenAssignedTo !== "unassigned" ? Number(reopenAssignedTo) : null, description: updatedDescription }) });
                toast.success("Ticket reopened");
                await Promise.all([queryClient.invalidateQueries({ queryKey: ["tickets"] }), queryClient.invalidateQueries({ queryKey: ["tickets", "stats"] })]);
                setReopenTicket(null);
              } catch (error) { toast.error(error instanceof Error ? error.message : "Could not reopen ticket"); }
            }}>Reopen Ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {view360TicketId !== null && (
        <Ticket360Drawer
          ticketId={view360TicketId}
          onClose={() => setView360TicketId(null)}
        />
      )}
      {isAdmin && editingTicket && (
        <EditTicketDialog
          ticket={editingTicket}
          onClose={() => setEditingTicket(null)}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone = "blue", onClick, active }: {
  label: string; value: number; icon: React.ComponentType<{ className?: string }>; tone?: "blue" | "teal" | "amber" | "green" | "violet" | "danger"; onClick?: () => void; active?: boolean;
}) {
  const tones = {
    blue: { border: "border-blue-100 dark:border-blue-500/40", gradient: "dark:from-blue-950 dark:to-slate-950", icon: "bg-blue-100 text-blue-600 dark:bg-blue-500/25 dark:text-blue-300", active: "ring-blue-300 dark:ring-blue-400/60 bg-blue-50/80 dark:bg-blue-950/70" },
    teal: { border: "border-teal-100 dark:border-emerald-500/40", gradient: "dark:from-emerald-950 dark:to-slate-950", icon: "bg-teal-100 text-teal-600 dark:bg-emerald-500 dark:text-white", active: "ring-teal-300 dark:ring-emerald-400/60 bg-teal-50/80 dark:bg-emerald-950/70" },
    amber: { border: "border-amber-100 dark:border-orange-500/40", gradient: "dark:from-orange-950 dark:to-slate-950", icon: "bg-amber-100 text-amber-600 dark:bg-orange-500/30 dark:text-orange-300", active: "ring-amber-300 dark:ring-orange-400/60 bg-amber-50/80 dark:bg-orange-950/70" },
    green: { border: "border-emerald-100 dark:border-emerald-500/40", gradient: "dark:from-emerald-950 dark:to-slate-950", icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-300", active: "ring-emerald-300 dark:ring-emerald-400/60 bg-emerald-50/80 dark:bg-emerald-950/70" },
    violet: { border: "border-violet-100 dark:border-violet-500/40", gradient: "dark:from-violet-950 dark:to-slate-950", icon: "bg-violet-100 text-violet-600 dark:bg-violet-500 dark:text-white", active: "ring-violet-300 dark:ring-violet-400/60 bg-violet-50/80 dark:bg-violet-950/70" },
    danger: { border: "border-rose-100 dark:border-red-500/40", gradient: "dark:from-red-950 dark:to-slate-950", icon: "bg-rose-100 text-rose-600 dark:bg-red-500 dark:text-white", active: "ring-rose-300 dark:ring-red-400/60 bg-rose-50/80 dark:bg-red-950/70" },
  };
  const style = tones[tone];
  return (
    <button type="button" onClick={onClick} className={`group flex min-w-0 items-center gap-3 rounded-2xl border ${style.border} bg-white bg-gradient-to-br from-white to-white ${style.gradient} p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-4 ${active ? `ring-2 ${style.active}` : ""}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${style.icon}`}><Icon className="h-5 w-5" /></span>
      <span className="min-w-0">
        <span className="block truncate text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300 sm:text-xs">{label}</span>
        <span className="mt-0.5 block text-xl font-bold leading-tight text-slate-900 dark:text-white sm:text-2xl">{value}</span>
      </span>
    </button>
  );
}

function SlaCell({ dueAt, breached, responded }: { dueAt: string | null; breached: boolean; responded: boolean }) {
  if (!dueAt) return <span className="text-xs text-muted-foreground">—</span>;
  if (responded) return <span className="text-xs text-green-600">Responded</span>;
  const due = new Date(dueAt).getTime();
  const now = Date.now();
  const mins = Math.round((due - now) / 60000);
  const isBreach = breached || mins < 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${isBreach ? "text-destructive" : "text-muted-foreground"}`}>
      {isBreach ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {isBreach ? `Breached ${Math.abs(mins)}m` : mins > 60 ? `${Math.round(mins / 60)}h` : `${mins}m`}
    </span>
  );
}

function NewTicketDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    subject: "",
    description: "",
    priority: "medium",
    status: "open",
    requester_email: "",
    requester_name: "",
    assigned_to: "",
    due_date: "",
    due_time: "",
    language: "English",
    channel: "email",
    classifications: "",
  });

  const { data: assignees = [], isLoading: assigneesLoading } = useQuery({
    queryKey: ["ticket-assignees"],
    queryFn: async () => {
      const res = await apiFetch<any>("/api/v1/users/assignees");
      const list = Array.isArray(res) ? res : res?.data ?? res?.items ?? res?.users ?? [];
      return list as Array<{ id: number | string; full_name?: string | null; name?: string | null; email?: string | null }>;
    },
  });

  const addFiles = (files: FileList | File[]) => {
    const allowedTypes = new Set([
      "image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain", "text/csv",
    ]);
    const incoming = Array.from(files);
    const valid: File[] = [];
    for (const file of incoming) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} exceeds the 10 MB limit`);
      } else if (!allowedTypes.has(file.type)) {
        toast.error(`${file.name} has an unsupported file type`);
      } else {
        valid.push(file);
      }
    }
    setSelectedFiles((current) => {
      const combined = [...current];
      for (const file of valid) {
        if (!combined.some((existing) => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified)) {
          combined.push(file);
        }
      }
      return combined;
    });
  };

  const create = useMutation({
    mutationFn: async () => {
      const body = new FormData();
      body.append("subject", form.subject.trim());
      body.append("description", form.description.trim());
      body.append("priority", form.priority);
      body.append("requester_email", form.requester_email.trim());
      body.append("requester_name", form.requester_name.trim());
      if (form.assigned_to) body.append("assigned_to", form.assigned_to);
      selectedFiles.forEach((file) => body.append("files", file));

      const created = await apiUpload<Ticket>("/api/v1/tickets", body);

      // Some backend create handlers accept multipart ticket fields but do not persist
      // assigned_to from the multipart payload. Explicitly apply the assignment after
      // creation so the selected assignee is saved against the newly created ticket.
      if (created?.id && form.assigned_to) {
        await apiFetch(`/api/v1/tickets/${created.id}`, {
          method: "PUT",
          body: JSON.stringify({ assigned_to: Number(form.assigned_to) }),
        });
      }

      // These additional form values are stored in the ticket's supported custom_fields
      // field so they can be retained without requiring new database columns.
      const customFields = {
        ...(created?.custom_fields ?? {}),
        due_date: form.due_date ? `${form.due_date}T${form.due_time || "23:59"}` : null,
        language: form.language || null,
        channel: form.channel || null,
        classifications: form.classifications.trim() || null,
      };
      if (created?.id && (form.due_date || form.language || form.channel || form.classifications.trim())) {
        await apiFetch(`/api/v1/tickets/${created.id}`, {
          method: "PUT",
          body: JSON.stringify({ custom_fields: customFields }),
        });
      }
      return created;
    },
    onSuccess: () => {
      toast.success("Ticket created");
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["tickets", "stats"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const currentUserLabel = user?.full_name || user?.email || "Current logged-in user";

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Ticket</DialogTitle></DialogHeader>
        <div className="space-y-5">
          <div>
            <Label htmlFor="ticket-subject">Subject <span className="text-destructive">*</span></Label>
            <Input
              id="ticket-subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              maxLength={500}
              placeholder="Enter ticket subject"
            />
          </div>

          <div>
            <Label htmlFor="ticket-description">Description</Label>
            <Textarea
              id="ticket-description"
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={5000}
              placeholder="Describe the issue or request"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">New tickets are created with Open status.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="requester-email">Requester Email <span className="text-destructive">*</span></Label>
              <Input
                id="requester-email"
                type="email"
                value={form.requester_email}
                onChange={(e) => setForm({ ...form, requester_email: e.target.value })}
                placeholder="customer@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="requester-name">Requester Name</Label>
              <Input
                id="requester-name"
                value={form.requester_name}
                onChange={(e) => setForm({ ...form, requester_name: e.target.value })}
                placeholder="Customer name"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Assigned To</Label>
              <Select value={form.assigned_to || "unassigned"} onValueChange={(v) => setForm({ ...form, assigned_to: v === "unassigned" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder={assigneesLoading ? "Loading users…" : "Select assignee"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {assignees.map((person) => (
                    <SelectItem key={String(person.id)} value={String(person.id)}>
                      {person.full_name || person.name || person.email || `User ${person.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ticket Owner</Label>
              <Input value={currentUserLabel} readOnly aria-readonly="true" className="bg-muted/40" />
              <p className="text-xs text-muted-foreground">The logged-in user will be recorded as the creator.</p>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-semibold">Additional Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ticket-due-date">Due Date</Label>
                <Input id="ticket-due-date" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ticket-due-time">Due Time</Label>
                <Input id="ticket-due-time" type="time" value={form.due_time} onChange={(e) => setForm({ ...form, due_time: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Language</Label>
                <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Hindi">Hindi</SelectItem>
                    <SelectItem value="Spanish">Spanish</SelectItem>
                    <SelectItem value="French">French</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Channel</Label>
                <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="chat">Chat</SelectItem>
                    <SelectItem value="web">Web</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ticket-classifications">Classifications</Label>
                <Input
                  id="ticket-classifications"
                  value={form.classifications}
                  onChange={(e) => setForm({ ...form, classifications: e.target.value })}
                  placeholder="e.g. Billing, Technical Support"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4 space-y-2">
            <Label>Attachment</Label>
            <label
              htmlFor="ticket-attachments"
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files); }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/60 hover:bg-muted/30"}`}
            >
              <input
                id="ticket-attachments"
                type="file"
                multiple
                className="sr-only"
                accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.docx,.xlsx,.txt,.csv"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.currentTarget.value = ""; }}
              />
              <span className="text-sm font-medium">Click to upload or drag and drop</span>
              <span className="mt-1 text-xs text-muted-foreground">Images, PDF, DOCX, XLSX, TXT or CSV · Max 10 MB per file</span>
            </label>
            {selectedFiles.length > 0 && (
              <ul className="space-y-2">
                {selectedFiles.map((file, index) => (
                  <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{file.name} <span className="text-xs text-muted-foreground">({(file.size / (1024 * 1024)).toFixed(2)} MB)</span></span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedFiles((current) => current.filter((_, i) => i !== index))}>Remove</Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>Cancel</Button>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !form.subject.trim() || !form.requester_email.trim()}
          >
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create Ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function splitStoredDueDate(value: unknown): { date: string; time: string } {
  if (typeof value !== "string" || !value) return { date: "", time: "" };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: value.slice(0, 10), time: value.length >= 16 ? value.slice(11, 16) : "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
    time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`,
  };
}

type TicketAttachment = {
  id: number;
  ticket_id: number;
  file_name: string;
  file_url: string;
  file_size?: number | null;
  file_type?: string | null;
  uploaded_by?: number | null;
};

function EditTicketDialog({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [isDraggingAttachment, setIsDraggingAttachment] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(true);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);

  // The backend attachment routes support upload/delete. Load existing files when
  // the list endpoint is available; a missing list endpoint won't block editing.
  useEffect(() => {
    let active = true;
    apiFetch<any>(`/api/v1/tickets/${ticket.id}`)
      .then((response) => {
        if (!active) return;
        setAttachments(Array.isArray(response?.attachments) ? response.attachments as TicketAttachment[] : []);
      })
      .catch(() => {
        toast.error("Could not load ticket attachments");
      })
      .finally(() => { if (active) setAttachmentsLoading(false); });
    return () => { active = false; };
  }, [ticket.id]);

  const addAttachmentFiles = (fileList: FileList | File[]) => {
    const allowedTypes = new Set([
      "image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/plain", "text/csv",
    ]);
    const valid: File[] = [];
    for (const file of Array.from(fileList)) {
      if (file.size > 10 * 1024 * 1024) toast.error(`${file.name} exceeds the 10 MB limit`);
      else if (!allowedTypes.has(file.type)) toast.error(`${file.name} has an unsupported file type`);
      else valid.push(file);
    }
    setPendingAttachments((current) => {
      const next = [...current];
      for (const file of valid) {
        if (!next.some((existing) => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified)) next.push(file);
      }
      return next;
    });
  };

  const uploadAttachments = async () => {
    if (!pendingAttachments.length) return;
    setUploadingAttachments(true);
    const uploaded: TicketAttachment[] = [];
    try {
      for (const file of pendingAttachments) {
        const body = new FormData();
        body.append("file", file);
        const result = await apiUpload<TicketAttachment>(`/api/v1/tickets/${ticket.id}/attachments`, body);
        uploaded.push(result);
      }
      setAttachments((current) => [...current, ...uploaded]);
      setPendingAttachments([]);
      toast.success(uploaded.length === 1 ? "Attachment uploaded" : `${uploaded.length} attachments uploaded`);
      queryClient.invalidateQueries({ queryKey: ["ticket", String(ticket.id)] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload attachment(s)");
      // Keep queued files so the user can retry any that did not upload.
    } finally {
      setUploadingAttachments(false);
    }
  };

  const attachmentHref = (url: string) => {
    if (/^https?:\/\//i.test(url)) return url;
    
    // Fallback to localhost:8000 if VITE_API_BASE_URL is not defined
    const base = (import.meta as any).env?.VITE_API_BASE_URL ||"http://192.168.0.105:8000" || "http://localhost:8000";
    
    return `${String(base).replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
  };

  const deleteAttachment = async (attachment: TicketAttachment) => {
    if (!window.confirm(`Delete attachment "${attachment.file_name}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/v1/tickets/${ticket.id}/attachments/${attachment.id}`, { method: "DELETE" });
      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
      toast.success("Attachment deleted");
      queryClient.invalidateQueries({ queryKey: ["ticket", String(ticket.id)] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete attachment");
    }
  };

  const storedDueDate = splitStoredDueDate(ticket.custom_fields?.due_date);
  const [form, setForm] = useState({
    subject: ticket.subject ?? "",
    description: ticket.description ?? "",
    requester_name: ticket.requester_name ?? "",
    requester_email: ticket.requester_email ?? "",
    requester_phone: ticket.requester_phone ?? "",
    status: ticket.status ?? "open",
    priority: ticket.priority ?? "medium",
    urgency: ticket.urgency ?? "medium",
    category: ticket.category ?? "",
    assigned_to: ticket.assigned_to == null ? "" : String(ticket.assigned_to),
    due_date: storedDueDate.date,
    due_time: storedDueDate.time,
    language: typeof ticket.custom_fields?.language === "string" ? ticket.custom_fields.language : "English",
    channel: typeof ticket.custom_fields?.channel === "string" ? ticket.custom_fields.channel : "email",
    classifications: typeof ticket.custom_fields?.classifications === "string" ? ticket.custom_fields.classifications : "",
  });

  const { data: assignees = [], isLoading: assigneesLoading } = useQuery({
    queryKey: ["ticket-assignees"],
    queryFn: async () => {
      const res = await apiFetch<any>("/api/v1/users/assignees");
      const list = Array.isArray(res) ? res : res?.data ?? res?.items ?? res?.users ?? [];
      return list as Array<{ id: number | string; full_name?: string | null; name?: string | null; email?: string | null }>;
    },
  });

  const update = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/tickets/${ticket.id}`, {
        method: "PUT",
        body: JSON.stringify({
          subject: form.subject.trim(),
          description: form.description.trim() || null,
          requester_name: form.requester_name.trim() || null,
          requester_email: form.requester_email.trim(),
          requester_phone: form.requester_phone.trim() || null,
          status: form.status,
          priority: form.priority,
          urgency: form.urgency,
          category: form.category.trim() || null,
          assigned_to: form.assigned_to.trim() ? Number(form.assigned_to) : null,
          custom_fields: {
            ...(ticket.custom_fields ?? {}),
            due_date: form.due_date ? `${form.due_date}T${form.due_time || "23:59"}` : null,
            language: form.language || null,
            channel: form.channel || null,
            classifications: form.classifications.trim() || null,
          },
        }),
      }),
    onSuccess: () => {
      toast.success("Ticket updated");
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket", String(ticket.id)] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Ticket #{ticket.ticket_number}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Subject</Label>
            <Input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              maxLength={500}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Requester email</Label>
              <Input
                type="email"
                value={form.requester_email}
                onChange={(e) => setForm({ ...form, requester_email: e.target.value })}
              />
            </div>
            <div>
              <Label>Requester name</Label>
              <Input
                value={form.requester_name}
                onChange={(e) => setForm({ ...form, requester_name: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Requester phone</Label>
              <Input
                value={form.requester_phone}
                onChange={(e) => setForm({ ...form, requester_phone: e.target.value })}
              />
            </div>
            <div>
              <Label>Assigned To</Label>
              <Select value={form.assigned_to || "unassigned"} onValueChange={(value) => setForm({ ...form, assigned_to: value === "unassigned" ? "" : value })}>
                <SelectTrigger><SelectValue placeholder={assigneesLoading ? "Loading users…" : "Select assignee"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {assignees.map((person) => (
                    <SelectItem key={String(person.id)} value={String(person.id)}>
                      {person.full_name || person.name || person.email || `User ${person.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
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
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Urgency</Label>
              <Select value={form.urgency} onValueChange={(value) => setForm({ ...form, urgency: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div>
              <Label>Due Time</Label>
              <Input type="time" value={form.due_time} onChange={(e) => setForm({ ...form, due_time: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={5000}
            />
          </div>
          <div className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-semibold">Additional Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Language</Label>
                <Select value={form.language} onValueChange={(value) => setForm({ ...form, language: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Hindi">Hindi</SelectItem>
                    <SelectItem value="Spanish">Spanish</SelectItem>
                    <SelectItem value="French">French</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Channel</Label>
                <Select value={form.channel} onValueChange={(value) => setForm({ ...form, channel: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="chat">Chat</SelectItem>
                    <SelectItem value="web">Web</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Classifications</Label>
                <Input value={form.classifications} onChange={(e) => setForm({ ...form, classifications: e.target.value })} placeholder="e.g. Billing, Technical Support" />
              </div>
            </div>
          </div>
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Paperclip className="h-4 w-4" /> Attachments</h3>
              <span className="text-xs text-muted-foreground">Max 10 MB per file</span>
            </div>
            {attachmentsLoading ? (
              <p className="text-sm text-muted-foreground">Loading attachments…</p>
            ) : attachments.length > 0 ? (
              <ul className="space-y-2">
                {attachments.map((attachment) => (
                  <li key={attachment.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <a href={attachmentHref(attachment.file_url)} target="_blank" rel="noreferrer" className="block truncate font-medium text-primary hover:underline">
                          {attachment.file_name || "Attachment"}
                        </a>
                        <span className="text-xs text-muted-foreground">{typeof attachment.file_size === "number" ? `${(attachment.file_size / (1024 * 1024)).toFixed(2)} MB` : attachment.file_type || "File"}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <a href={attachmentHref(attachment.file_url)} target="_blank" rel="noreferrer" aria-label={`View ${attachment.file_name}`} title="View attachment" className="rounded-md p-2 hover:bg-muted"><ExternalLink className="h-4 w-4" /></a>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${attachment.file_name}`} title="Delete attachment" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => deleteAttachment(attachment)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No existing attachments found.</p>
            )}
            <label
              htmlFor={`edit-ticket-attachments-${ticket.id}`}
              onDragOver={(event) => { event.preventDefault(); setIsDraggingAttachment(true); }}
              onDragLeave={(event) => { event.preventDefault(); setIsDraggingAttachment(false); }}
              onDrop={(event) => { event.preventDefault(); setIsDraggingAttachment(false); addAttachmentFiles(event.dataTransfer.files); }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-5 text-center transition-colors ${isDraggingAttachment ? "border-primary bg-primary/5" : "border-border hover:border-primary/60 hover:bg-muted/30"}`}
            >
              <input
                id={`edit-ticket-attachments-${ticket.id}`}
                type="file"
                multiple
                className="sr-only"
                accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.docx,.xlsx,.txt,.csv"
                onChange={(event) => { if (event.target.files) addAttachmentFiles(event.target.files); event.currentTarget.value = ""; }}
              />
              <Paperclip className="mb-1 h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">Click to add file or drag and drop</span>
              <span className="mt-1 text-xs text-muted-foreground">Images, PDF, DOCX, XLSX, TXT or CSV</span>
            </label>
            {pendingAttachments.length > 0 && (
              <ul className="space-y-2">
                {pendingAttachments.map((file, index) => (
                  <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{file.name} <span className="text-xs text-muted-foreground">({(file.size / (1024 * 1024)).toFixed(2)} MB)</span></span>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setPendingAttachments((current) => current.filter((_, i) => i !== index))} aria-label={`Remove ${file.name} from upload queue`}><X className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ul>
            )}
            {pendingAttachments.length > 0 && (
              <Button type="button" variant="secondary" onClick={uploadAttachments} disabled={uploadingAttachments}>
                {uploadingAttachments && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Upload {pendingAttachments.length} {pendingAttachments.length === 1 ? "attachment" : "attachments"}
              </Button>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => update.mutate()}
            disabled={update.isPending || !form.subject.trim() || !form.requester_email.trim()}
          >
            {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Also link to /tickets/$id — declared here for TS-safe navigation
export const _needed = Link;