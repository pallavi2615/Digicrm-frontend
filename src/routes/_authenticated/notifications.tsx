import { defineRoute, Link } from "@/lib/router-compat";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@/lib/react-data-client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CalendarClock, Check, ChevronLeft, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api"; // <-- adjust path if your api file lives elsewhere
import {
  formatStart,
  normalizeIso,
  scheduleLabel,
  useScheduleReminders,
} from "@/hooks/use-schedule-reminders";

export const Route = defineRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — DigiCRM AI" }] }),
  component: NotificationsPage,
});

/* ------------------------------------------------------------------ */
/* Types (match app/schemas/notification.py — adjust if names differ)  */
/* ------------------------------------------------------------------ */

interface N {
  id: number;
  title: string;
  body?: string | null;
  message?: string | null; // fallback if backend calls it "message"
  link?: string | null;
  type?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

interface NotificationList {
  data: N[];
  total: number;
  unread: number;
  skip: number;
  limit: number;
}

const PAGE_SIZE = 50;
const POLL_MS = 3_000; // check for new backend notifications every 3 seconds

type Tab = "all" | "unread";

function relativeText(startsAt: number, now: number): string {
  const diffMin = Math.round((startsAt - now) / 60000);
  if (diffMin > 0) {
    if (diffMin < 60) return `Starts in ${diffMin} min`;
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return m ? `Starts in ${h}h ${m}m` : `Starts in ${h}h`;
  }
  const ago = Math.abs(diffMin);
  if (ago < 1) return "Starting now";
  if (ago < 60) return `Started ${ago} min ago`;
  const h = Math.floor(ago / 60);
  return h < 24 ? `Started ${h}h ago` : `Overdue by ${Math.floor(h / 24)}d`;
}

function NotificationsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(0);

  // Schedule reminders (shared with the topbar bell badge)
  const {
    now,
    reminders,
    unreadReminders,
    markRead: markReminderRead,
    markUnread: markReminderUnread,
    dismiss: dismissReminder,
    markAllRead: markAllRemindersRead,
    dismissRead: dismissReadReminders,
    readReminders,
  } = useScheduleReminders();

  const changeTab = (t: Tab) => {
    setTab(t);
    setPage(0);
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["notifications", tab, page],
    placeholderData: keepPreviousData,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    queryFn: () => {
      const p = new URLSearchParams({ skip: String(page * PAGE_SIZE), limit: String(PAGE_SIZE) });
      if (tab === "unread") p.set("is_read", "false");
      return apiFetch<NotificationList>(`/api/v1/notifications?${p.toString()}`);
    },
  });

  // Reminders appear on the first page (and only unread ones on the "Unread" tab)
  const shownReminders = page === 0 ? (tab === "unread" ? unreadReminders : reminders) : [];

  const items = data?.data ?? [];
  const total = (data?.total ?? 0) + reminders.length;
  const unread = (data?.unread ?? 0) + unreadReminders.length;
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  // Refresh list + any badge that uses the unread-count endpoint
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
  };

  const markRead = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/v1/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: refresh,
  });

  const markUnread = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/v1/notifications/${id}/unread`, { method: "PATCH" }),
    onSuccess: refresh,
  });

  const markAll = useMutation({
    mutationFn: () => apiFetch("/api/v1/notifications/read-all", { method: "POST" }),
    onSuccess: () => {
      markAllRemindersRead();
      refresh();
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/v1/notifications/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });

  const removeAllRead = useMutation({
    mutationFn: () => apiFetch("/api/v1/notifications/read/all", { method: "DELETE" }),
    onSuccess: () => {
      dismissReadReminders();
      refresh();
    },
  });

  const mutationError =
    (markRead.error || markUnread.error || markAll.error || remove.error || removeAllRead.error) as Error | null;

  const nothingToShow = !isLoading && !error && items.length === 0 && shownReminders.length === 0;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {unread} unread of {total}
          </p>
        </div>
        <div className="flex gap-2">
          {unread > 0 && (
            <Button variant="outline" size="sm" disabled={markAll.isPending} onClick={() => markAll.mutate()}>
              {markAll.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Mark all read
            </Button>
          )}
          {total - unread > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={removeAllRead.isPending}
              onClick={() => removeAllRead.mutate()}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Clear read
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant={tab === "all" ? "default" : "outline"} size="sm" onClick={() => changeTab("all")}>
          All
        </Button>
        <Button variant={tab === "unread" ? "default" : "outline"} size="sm" onClick={() => changeTab("unread")}>
          Unread
        </Button>
      </div>

      {mutationError && <p className="text-sm text-destructive">{mutationError.message}</p>}

      {isLoading && (
        <div className="text-center py-10">
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
        </div>
      )}

      {error && !isLoading && (
        <p className="text-sm text-destructive text-center py-6">
          {error instanceof Error ? error.message : "Failed to load notifications."}
        </p>
      )}

      {nothingToShow && (
        <Card className="shadow-card">
          <CardContent className="text-center py-16">
            <Bell className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {tab === "unread" ? "No unread notifications." : "You're all caught up."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Schedule reminders — raised at (scheduled time − reminder minutes) */}
      {shownReminders.length > 0 && (
        <div className="space-y-2">
          {shownReminders.map((r) => {
            const s = r.schedule;
            const isRead = !unreadReminders.some((u) => u.key === r.key);
            return (
              <Card key={r.key} className={`shadow-sm ${!isRead ? "border-primary/40 bg-primary/2" : ""}`}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      isRead ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"
                    }`}
                  >
                    <CalendarClock className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">Reminder: {s.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {[scheduleLabel(s), s.lead_name, formatStart(r.startsAt)].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {relativeText(r.startsAt, now)} ·{" "}
                      <Link to="/calendar" className="text-primary hover:underline">
                        View in calendar
                      </Link>
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {isRead ? (
                      <Button variant="ghost" size="sm" onClick={() => markReminderUnread(r.key)}>
                        Mark unread
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => markReminderRead(r.key)}>
                        Mark read
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Dismiss reminder"
                      onClick={() => dismissReminder(r.key)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="space-y-2">
        {items.map((n) => {
          const body = n.body ?? n.message ?? null;
          return (
            <Card key={n.id} className={`shadow-sm ${!n.is_read ? "border-primary/40 bg-primary/2" : ""}`}>
              <CardContent className="p-4 flex items-start gap-3">
                <div
                  className={`h-2 w-2 rounded-full mt-2 ${n.is_read ? "bg-muted-foreground/30" : "bg-primary"}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{n.title}</p>
                  {body && <p className="text-sm text-muted-foreground mt-0.5">{body}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(normalizeIso(n.created_at)).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {n.is_read ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={markUnread.isPending}
                      onClick={() => markUnread.mutate(n.id)}
                    >
                      Mark unread
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={markRead.isPending}
                      onClick={() => markRead.mutate(n.id)}
                    >
                      Mark read
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete notification"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(n.id)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {(data?.total ?? 0) > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs text-muted-foreground mr-2">
            Page {page + 1} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}