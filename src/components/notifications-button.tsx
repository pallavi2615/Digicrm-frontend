// notifications-button.tsx
import { useState } from "react";
import { useQuery, useQueryClient } from "@/lib/react-data-client";
import { Bell, CalendarClock } from "lucide-react";
import { useNavigate } from "@/lib/router-compat";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { apiFetch } from "@/lib/api";
import {
  formatStart,
  scheduleLabel,
  useScheduleReminders,
} from "@/hooks/use-schedule-reminders";

/* =========================================================
   TYPES
========================================================= */

type NotificationItem = {
  id: string | number;
  title?: string;
  message?: string;
  body?: string;
  read?: boolean;
  is_read?: boolean;
  created_at?: string;
  link?: string;
};

/* =========================================================
   API HELPERS
   NOTE: These endpoints don't exist on the backend yet.
   Paths/response shape below are placeholders — update them
   once the real notifications API is built.
========================================================= */

function extractNotifications(response: any): NotificationItem[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.results)) return response.results;
  if (Array.isArray(response?.notifications)) return response.notifications;
  return [];
}

async function fetchNotifications(): Promise<NotificationItem[]> {
  try {
    const response = await apiFetch<any>("/api/v1/notifications");
    return extractNotifications(response);
  } catch {
    // Backend endpoint isn't live yet — fail quietly so the topbar
    // never breaks because of this.
    return [];
  }
}

async function markAllRead() {
  try {
    await apiFetch("/api/v1/notifications/read-all", {
      method: "POST",
    } as any);
  } catch {
    // API not built yet — safe to ignore, local state still updates.
  }
}

/* =========================================================
   NOTIFICATIONS BUTTON
========================================================= */

export function NotificationsButton() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Lead-schedule reminders (due at scheduled time − reminder minutes)
  const {
    reminders,
    unreadReminders,
    markAllRead: markAllRemindersRead,
  } = useScheduleReminders();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 30000,
  });

  const isUnread = (n: NotificationItem) => !(n.read ?? n.is_read ?? false);
  const unreadCount = notifications.filter(isUnread).length;
  const totalUnread = unreadCount + unreadReminders.length;
  const shownReminders = reminders.slice(0, 5);

  const handleOpenChange = async (next: boolean) => {
    setOpen(next);

    if (next && unreadReminders.length > 0) {
      markAllRemindersRead();
    }

    if (next && unreadCount > 0) {
      // Optimistically mark everything read as soon as the panel opens.
      queryClient.setQueryData<NotificationItem[]>(["notifications"], (old) =>
        (old ?? []).map((n) => ({ ...n, read: true, is_read: true }))
      );

      await markAllRead();
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />

          {totalUnread > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-medium">Notifications</span>

          {totalUnread > 0 && (
            <span className="text-xs text-muted-foreground">
              {totalUnread} new
            </span>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {shownReminders.map((r) => (
            <div
              key={r.key}
              role="button"
              tabIndex={0}
              onClick={() => {
                setOpen(false);
                navigate({ to: "/calendar" });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setOpen(false);
                  navigate({ to: "/calendar" });
                }
              }}
              className="flex cursor-pointer items-start gap-2.5 px-3 py-2.5 border-b text-sm hover:bg-muted/50 transition-colors"
            >
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <CalendarClock className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug truncate">Reminder: {r.schedule.title}</p>
                <p className="text-muted-foreground text-xs truncate">
                  {[scheduleLabel(r.schedule), r.schedule.lead_name, formatStart(r.startsAt)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
          ))}

          {notifications.length === 0 ? (
            shownReminders.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                No notifications yet.
              </div>
            ) : null
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className="px-3 py-2.5 border-b last:border-0 text-sm hover:bg-muted/50 transition-colors"
              >
                {n.title && (
                  <p className="font-medium leading-snug">{n.title}</p>
                )}

                {(n.message ?? n.body) && (
                  <p className="text-muted-foreground line-clamp-2">
                    {n.message ?? n.body}
                  </p>
                )}

                {n.created_at && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}