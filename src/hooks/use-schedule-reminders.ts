// hooks/use-schedule-reminders.ts
//
// Shared source of truth for lead-schedule reminders. Used by:
//   - the topbar (bell badge + pop-up alert, mounted on every page)
//   - the Notifications page (reminder cards)
// Read / dismissed state lives in localStorage and is synced between components
// (and browser tabs) through a window event, so marking a reminder read on the
// Notifications page updates the topbar badge immediately.

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@/lib/react-data-client";
import { apiFetch } from "@/lib/api";

export interface LeadSchedule {
  id: number;
  lead_id: number;
  title: string;
  notes?: string | null;
  activity_type?: string | null;
  activity_label?: string | null;
  display_type?: string | null;
  scheduled_at: string;
  reminder_minutes_before?: number | null;
  status?: string | null;
  lead_name?: string | null;
}

export interface Reminder {
  key: string;
  schedule: LeadSchedule;
  startsAt: number; // ms — the date/time the user entered
  remindAt: number; // ms — startsAt minus reminder_minutes_before
}

export const POLL_MS = 30_000;
const REMINDER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // ignore reminders older than 7 days
const ALERT_WINDOW_MS = 2 * 60 * 60 * 1000;         // only pop up for reminders that became due in the last 2h

const READ_KEY = "digicrm.schedule-reminders.read";
const DISMISSED_KEY = "digicrm.schedule-reminders.dismissed";
const TOASTED_KEY = "digicrm.schedule-reminders.toasted";
const CHANGE_EVENT = "digicrm:schedule-reminders-changed";

// Naive (timezone-less) server datetimes are UTC — make that explicit.
export function normalizeIso(s: string): string {
  if (!s || !s.includes("T")) return s;
  return /([zZ]|[+-]\d{2}:?\d{2})$/.test(s) ? s : `${s}Z`;
}

function loadSet(key: string): Set<string> {
  try {
    if (typeof window === "undefined") return new Set();
    return new Set<string>(JSON.parse(window.localStorage.getItem(key) ?? "[]"));
  } catch {
    return new Set();
  }
}

function saveSet(key: string, set: Set<string>) {
  try {
    window.localStorage.setItem(key, JSON.stringify([...set].slice(-500)));
  } catch {
    /* ignore storage errors */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function scheduleLabel(s: LeadSchedule): string {
  return s.display_type || s.activity_label || s.activity_type || "Activity";
}

export function formatStart(ms: number): string {
  return new Date(ms).toLocaleString([], {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function useScheduleReminders() {
  const [readKeys, setReadKeys] = useState<Set<string>>(() => loadSet(READ_KEY));
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => loadSet(DISMISSED_KEY));
  const [now, setNow] = useState(() => Date.now());

  // ticking clock so reminders fire at the right minute even without a refetch
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  // keep every component (and tab) in sync
  useEffect(() => {
    const sync = () => {
      setReadKeys(loadSet(READ_KEY));
      setDismissedKeys(loadSet(DISMISSED_KEY));
    };
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const { data: schedules } = useQuery({
    queryKey: ["notifications", "schedule-reminders"],
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
    queryFn: () =>
      apiFetch<LeadSchedule[]>("/api/v1/lead-schedules").catch(() => [] as LeadSchedule[]),
  });

  // Due reminders: now >= (scheduled time − reminder_minutes_before)
  const reminders = useMemo<Reminder[]>(() => {
    return (Array.isArray(schedules) ? schedules : [])
      .filter((s) => {
        const st = String(s.status ?? "").toLowerCase();
        return !!s.scheduled_at && st !== "completed" && st !== "cancelled";
      })
      .map((s) => {
        const startsAt = new Date(normalizeIso(s.scheduled_at)).getTime();
        const remindAt = startsAt - (s.reminder_minutes_before ?? 0) * 60000;
        return { key: `${s.id}:${s.scheduled_at}`, schedule: s, startsAt, remindAt };
      })
      .filter(
        (r) =>
          Number.isFinite(r.remindAt) &&
          r.remindAt <= now &&
          r.startsAt >= now - REMINDER_WINDOW_MS &&
          !dismissedKeys.has(r.key),
      )
      .sort((a, b) => b.remindAt - a.remindAt);
  }, [schedules, now, dismissedKeys]);

  const unreadReminders = useMemo(
    () => reminders.filter((r) => !readKeys.has(r.key)),
    [reminders, readKeys],
  );
  const readReminders = useMemo(
    () => reminders.filter((r) => readKeys.has(r.key)),
    [reminders, readKeys],
  );

  const markRead = useCallback((key: string) => {
    const s = loadSet(READ_KEY);
    s.add(key);
    saveSet(READ_KEY, s);
  }, []);

  const markUnread = useCallback((key: string) => {
    const s = loadSet(READ_KEY);
    s.delete(key);
    saveSet(READ_KEY, s);
  }, []);

  const dismiss = useCallback((key: string) => {
    const s = loadSet(DISMISSED_KEY);
    s.add(key);
    saveSet(DISMISSED_KEY, s);
  }, []);

  const markAllRead = useCallback(() => {
    const s = loadSet(READ_KEY);
    reminders.forEach((r) => s.add(r.key));
    saveSet(READ_KEY, s);
  }, [reminders]);

  const dismissRead = useCallback(() => {
    const s = loadSet(DISMISSED_KEY);
    readReminders.forEach((r) => s.add(r.key));
    saveSet(DISMISSED_KEY, s);
  }, [readReminders]);

  return {
    now,
    reminders,
    unreadReminders,
    readReminders,
    markRead,
    markUnread,
    dismiss,
    markAllRead,
    dismissRead,
  };
}

/**
 * Pop-up alert (toast + browser notification if the user allowed them) the moment a
 * schedule reminder becomes due. Mount once in the topbar so it works on every page.
 */
export function useScheduleReminderAlerts(onView: () => void) {
  const { unreadReminders, now } = useScheduleReminders();

  useEffect(() => {
    if (unreadReminders.length === 0) return;
    const toasted = loadSet(TOASTED_KEY);
    let shown = 0;
    let changed = false;

    for (const r of unreadReminders) {
      if (toasted.has(r.key)) continue;
      toasted.add(r.key);
      changed = true;
      // Old reminders (e.g. after a long time away) only show in the badge, no pop-up
      if (r.remindAt < now - ALERT_WINDOW_MS || shown >= 3) continue;
      shown++;

      const description = [scheduleLabel(r.schedule), r.schedule.lead_name, formatStart(r.startsAt)]
        .filter(Boolean)
        .join(" · ");

      toast(`Reminder: ${r.schedule.title}`, {
        description,
        duration: 12000,
        action: { label: "View", onClick: onView },
      });

      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification(`Reminder: ${r.schedule.title}`, { body: description });
        }
      } catch {
        /* ignore */
      }
    }

    if (changed) {
      try {
        window.localStorage.setItem(TOASTED_KEY, JSON.stringify([...toasted].slice(-500)));
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadReminders, now]);
}