import { Copy, User } from "lucide-react";
import { toast } from "sonner";

/**
 * Shared building blocks for the "view / 360 / edit" dialogs
 * (Leads + Contacts) so every detail card looks the same.
 */

export type DetailTone =
  | "blue" | "green" | "orange" | "purple" | "red" | "pink" | "cyan" | "amber";

type IconType = React.ComponentType<{ className?: string }>;

const T: Record<DetailTone, { card: string; soft: string }> = {
  blue:   { card: "border-blue-500/20 from-blue-500/15 via-blue-500/[0.05]",       soft: "bg-blue-500/15 text-blue-500" },
  green:  { card: "border-emerald-500/20 from-emerald-500/15 via-emerald-500/[0.05]", soft: "bg-emerald-500/15 text-emerald-500" },
  orange: { card: "border-orange-500/20 from-orange-500/15 via-orange-500/[0.05]", soft: "bg-orange-500/15 text-orange-500" },
  purple: { card: "border-violet-500/20 from-violet-500/15 via-violet-500/[0.05]", soft: "bg-violet-500/15 text-violet-500" },
  red:    { card: "border-red-500/20 from-red-500/15 via-red-500/[0.05]",          soft: "bg-red-500/15 text-red-500" },
  pink:   { card: "border-pink-500/20 from-pink-500/15 via-pink-500/[0.05]",       soft: "bg-pink-500/15 text-pink-500" },
  cyan:   { card: "border-cyan-500/20 from-cyan-500/15 via-cyan-500/[0.05]",       soft: "bg-cyan-500/15 text-cyan-500" },
  amber:  { card: "border-amber-500/20 from-amber-500/15 via-amber-500/[0.05]",    soft: "bg-amber-500/15 text-amber-500" },
};

/* ---------- shared class strings ---------- */

export const DETAIL_DIALOG =
  "sm:max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0 rounded-3xl border-border/60 " +
  "bg-gradient-to-br from-blue-50 via-background to-violet-50 " +
  "dark:from-blue-500/10 dark:via-background dark:to-violet-500/10";

export const PILL_TABS_LIST =
  "grid grid-cols-4 w-full h-auto p-1 rounded-2xl bg-muted/60 border border-border/50";

export const PILL_TAB =
  "rounded-xl py-1.5 gap-2 text-sm font-medium " +
  "data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-500 " +
  "data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-blue-600/30";

export const BTN_PILL = "rounded-full px-5 h-10";

export const BTN_PRIMARY =
  "rounded-full px-6 h-10 text-white bg-gradient-to-r from-blue-600 to-indigo-500 " +
  "shadow-lg shadow-blue-600/30 hover:opacity-90";

export const DETAIL_INPUT = "rounded-xl h-11";

/* ---------- avatar with online dot ---------- */

export function DetailAvatar({ initials }: { initials?: string }) {
  return (
    <div className="relative shrink-0">
      <div className="h-16 w-16 rounded-full bg-linear-to-br from-blue-100 to-violet-100 dark:from-blue-500/25 dark:to-violet-500/25 text-blue-600 dark:text-blue-300 flex items-center justify-center ring-4 ring-background shadow-md">
        {initials ? (
          <span className="text-lg font-bold">{initials}</span>
        ) : (
          <User className="h-8 w-8" />
        )}
      </div>
      <span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-background" />
    </div>
  );
}

/* ---------- gradient stat tile (Value / Schedules / Proposals / Score) ---------- */

export function StatTile({
  icon: Icon, label, value, tone,
}: {
  icon: IconType;
  label: string;
  value: string;
  tone: DetailTone;
}) {
  const t = T[tone];
  return (
    <div className={`rounded-2xl border bg-linear-to-br to-transparent p-3 ${t.card}`}>
      <div className="flex items-center gap-2.5">
        <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center ${t.soft}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium">{label}</p>
          <p className="text-lg font-bold truncate">{value}</p>
        </div>
      </div>
    </div>
  );
}

/* ---------- info tile (Email / Phone / Company ...) ---------- */

export function InfoTile({
  icon: Icon, label, value, tone = "blue", copyable = false, href,
}: {
  icon: IconType;
  label: string;
  value?: string | null;
  tone?: DetailTone;
  copyable?: boolean;
  href?: string;
}) {
  const t = T[tone];
  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 px-3 py-2.5 flex items-center gap-3 shadow-sm">
      <div className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center ${t.soft}`}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-medium">{label}</div>
        <div className="text-sm font-medium mt-0.5 wrap-break-word">
          {value && href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {value}
            </a>
          ) : (
            value || "—"
          )}
        </div>
      </div>

      {copyable && value && (
        <button
          type="button"
          onClick={copy}
          title={`Copy ${label.toLowerCase()}`}
          aria-label={`Copy ${label.toLowerCase()}`}
          className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-blue-500 hover:bg-blue-500/10 transition-colors"
        >
          <Copy className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}