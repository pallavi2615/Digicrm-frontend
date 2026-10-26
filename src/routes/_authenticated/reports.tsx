import { defineRoute } from "@/lib/router-compat";
import { useQuery, keepPreviousData } from "@/lib/react-data-client";
import { useActiveIndustry } from "@/lib/active-industry";
import { apiFetch } from "@/lib/api"; // <-- adjust path if your api file lives elsewhere
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadialBarChart, RadialBar,
} from "recharts";
import {
  BarChart3, Users, Trophy, IndianRupee, TrendingUp, Percent,
  LineChart as LineChartIcon, PieChart as PieChartIcon, Flag, Building2,
} from "lucide-react";

export const Route = defineRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — DigiCRM AI" }] }),
  component: ReportsPage,
});

// Same hues as the Leads page (blue, violet, emerald, orange, pink, teal)
const COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#f97316",
  "#ec4899",
  "#14b8a6",
];

// Leads & Revenue trend lines — clearly different colours
const LEADS_LINE = "#2563eb";   // blue
const REVENUE_LINE = "#f97316"; // orange

// Priority bars use the exact priority colours from the Leads page
const PRIORITY_FILL: Record<string, string> = {
  low: "#94a3b8",
  medium: "#14b8a6",
  high: "#f97316",
  urgent: "#dc2626",
};

type IconType = React.ComponentType<{ className?: string }>;

// All money in the app is in rupees
const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Compact Indian-style axis label: ₹5k, ₹2.5L, ₹1.2Cr */
const compactINR = (v: number) => {
  const n = Math.abs(v);
  const trim = (x: number) => String(Math.round(x * 10) / 10);
  if (n >= 1e7) return `₹${trim(v / 1e7)}Cr`;
  if (n >= 1e5) return `₹${trim(v / 1e5)}L`;
  if (n >= 1e3) return `₹${trim(v / 1e3)}k`;
  return `₹${v}`;
};

/* ------------------------------------------------------------------ */
/* API response types (match app/schemas/report.py)                    */
/* ------------------------------------------------------------------ */

interface ReportSummary {
  total_leads: number;
  won_deals: number;
  total_revenue: number;
  avg_deal_size: number;
  conversion_rate: number;
}

interface RevenueTrendReport {
  data: { label: string; year: number; month: number; leads: number; revenue: number }[];
  months: number;
  total_leads: number;
  total_revenue: number;
}

interface LeadSourcesReport {
  data: { source: string; count: number; percentage: number }[];
  total: number;
}

interface PriorityDistributionReport {
  data: { priority: string; count: number }[];
  total: number;
}

interface TopIndustriesReport {
  data: { industry: string; count: number }[];
  total: number;
}

const tooltipStyle = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    color: "var(--popover-foreground)",
    boxShadow: "0 10px 30px -10px rgba(15, 23, 42, 0.25)",
    fontSize: 12,
  },
  labelStyle: { color: "var(--popover-foreground)", fontWeight: 600 },
  itemStyle: { color: "var(--popover-foreground)" },
};

const axisTick = { fontSize: 12, fill: "var(--muted-foreground)" };
const gridStroke = "var(--border)";
const legendStyle = { fontSize: 12, color: "var(--foreground)" };

/** Build "?industry_group=..." when an industry is selected. */
function withIndustry(path: string, group: string | null, extra: Record<string, string | number> = {}) {
  const p = new URLSearchParams();
  Object.entries(extra).forEach(([k, v]) => p.set(k, String(v)));
  if (group) p.set("industry_group", group);
  const qs = p.toString();
  return qs ? `${path}?${qs}` : path;
}

function ReportsPage() {
  // NOTE: the hook returns `activeGroup` (not `group`)
  const { activeGroup: crmGroup, activeName } = useActiveIndustry();

  const common = { placeholderData: keepPreviousData } as const;

  const { data: summary } = useQuery({
    queryKey: ["reports", "summary", crmGroup],
    queryFn: () => apiFetch<ReportSummary>(withIndustry("/api/v1/reports/summary", crmGroup)),
    ...common,
  });

  const { data: trend } = useQuery({
    queryKey: ["reports", "revenue-trend", crmGroup],
    queryFn: () =>
      apiFetch<RevenueTrendReport>(withIndustry("/api/v1/reports/revenue-trend", crmGroup, { months: 12 })),
    ...common,
  });

  const { data: sources } = useQuery({
    queryKey: ["reports", "lead-sources", crmGroup],
    queryFn: () => apiFetch<LeadSourcesReport>(withIndustry("/api/v1/reports/lead-sources", crmGroup)),
    ...common,
  });

  const { data: priority } = useQuery({
    queryKey: ["reports", "priority-distribution", crmGroup],
    queryFn: () =>
      apiFetch<PriorityDistributionReport>(withIndustry("/api/v1/reports/priority-distribution", crmGroup)),
    ...common,
  });

  const { data: industries } = useQuery({
    queryKey: ["reports", "top-industries", crmGroup],
    queryFn: () =>
      apiFetch<TopIndustriesReport>(withIndustry("/api/v1/reports/top-industries", crmGroup, { limit: 6 })),
    ...common,
  });

  // Map API shapes -> chart shapes
  const months = trend?.data ?? [];
  const bySource = (sources?.data ?? []).map((s) => ({ name: s.source, value: s.count }));
  const byPriority = (priority?.data ?? []).map((p) => ({ name: p.priority, value: p.count }));
  const byIndustry = (industries?.data ?? []).map((i) => ({ name: i.industry, value: i.count }));

  const kpis: { label: string; value: string | number; icon: IconType; tone: keyof typeof statTones }[] = [
    { label: "Total Leads", value: summary?.total_leads ?? 0, icon: Users, tone: "blue" },
    { label: "Won Deals", value: summary?.won_deals ?? 0, icon: Trophy, tone: "green" },
    { label: "Revenue", value: inr.format(summary?.total_revenue ?? 0), icon: IndianRupee, tone: "violet" },
    { label: "Avg Deal", value: inr.format(Math.round(summary?.avg_deal_size ?? 0)), icon: TrendingUp, tone: "orange" },
    { label: "Conversion", value: `${(summary?.conversion_rate ?? 0).toFixed(1)}%`, icon: Percent, tone: "teal" },
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ───────── Header ───────── */}
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex h-11 w-11 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm dark:border dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
          <BarChart3 className="h-6 w-6 sm:h-7 sm:w-7" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Reports & Analytics</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {crmGroup ? `${activeName} — insights across this industry only.` : "Insights across your sales performance."}
          </p>
        </div>
      </div>

      {/* ───────── KPI cards ───────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <StatCard key={k.label} label={k.label} value={k.value} icon={k.icon} tone={k.tone} />
        ))}
      </div>

      {/* ───────── Charts ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Leads & Revenue Trend (12 mo)" icon={LineChartIcon} tone="blue" empty={months.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={months} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.6} vertical={false} />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis yAxisId="l" tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis
                yAxisId="r"
                orientation="right"
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => compactINR(Number(v))}
              />
              <Tooltip
                {...tooltipStyle}
                formatter={(value, name) =>
                  name === "revenue"
                    ? [inr.format(Number(value)), "Revenue"]
                    : [value, "Leads"]
                }
              />
              <Legend wrapperStyle={legendStyle} />
              <Line
                yAxisId="l"
                type="monotone"
                dataKey="leads"
                stroke={LEADS_LINE}
                strokeWidth={2.5}
                dot={{ r: 3, strokeWidth: 0, fill: LEADS_LINE }}
                activeDot={{ r: 5 }}
              />
              <Line
                yAxisId="r"
                type="monotone"
                dataKey="revenue"
                stroke={REVENUE_LINE}
                strokeWidth={2.5}
                dot={{ r: 3, strokeWidth: 0, fill: REVENUE_LINE }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Leads by Source" icon={PieChartIcon} tone="violet" empty={bySource.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={bySource}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={92}
                paddingAngle={2}
                stroke="none"
              >
                {bySource.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={legendStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Priority Distribution" icon={Flag} tone="orange" empty={byPriority.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byPriority} layout="vertical" margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.6} horizontal={false} />
              <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={axisTick} tickLine={false} axisLine={false} width={70} />
              <Tooltip {...tooltipStyle} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
              <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={22}>
                {byPriority.map((p, i) => (
                  <Cell key={i} fill={PRIORITY_FILL[p.name?.toLowerCase()] ?? COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top Industries" icon={Building2} tone="teal" empty={byIndustry.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart innerRadius="20%" outerRadius="90%" data={byIndustry}>
              <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "var(--muted)", opacity: 0.5 }}>
                {byIndustry.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </RadialBar>
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={legendStyle} />
            </RadialBarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

// ============ HELPERS (same visual language as the Leads page) ============
const statTones: Record<string, { card: string; icon: string }> = {
  blue: {
    card: "from-blue-50 to-white border-blue-100 dark:from-blue-950 dark:to-slate-950 dark:border-blue-500/40",
    icon: "bg-blue-100 text-blue-600 dark:bg-blue-500/25 dark:text-blue-300",
  },
  green: {
    card: "from-green-50 to-white border-green-100 dark:from-emerald-950 dark:to-slate-950 dark:border-emerald-500/40",
    icon: "bg-green-100 text-green-600 dark:bg-emerald-500/25 dark:text-emerald-300",
  },
  violet: {
    card: "from-violet-50 to-white border-violet-100 dark:from-violet-950 dark:to-slate-950 dark:border-violet-500/40",
    icon: "bg-violet-500 text-white",
  },
  orange: {
    card: "from-orange-50 to-white border-orange-100 dark:from-orange-950 dark:to-slate-950 dark:border-orange-500/40",
    icon: "bg-orange-100 text-orange-600 dark:bg-orange-500/30 dark:text-orange-300",
  },
  teal: {
    card: "from-teal-50 to-white border-teal-100 dark:from-emerald-950 dark:to-slate-950 dark:border-emerald-500/40",
    icon: "bg-teal-500 text-white dark:bg-emerald-500",
  },
};

function StatCard({
  label, value, icon: Icon, tone,
}: {
  label: string;
  value: string | number;
  icon: IconType;
  tone: keyof typeof statTones;
}) {
  const t = statTones[tone];
  return (
    <div className={`flex items-center gap-3 sm:gap-4 rounded-2xl border bg-linear-to-br p-3 sm:p-4 shadow-sm ${t.card}`}>
      <div className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full ${t.icon}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">{label}</div>
        <div className="truncate text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">{value}</div>
      </div>
    </div>
  );
}

const chipTones: Record<string, string> = {
  blue: "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300",
  violet: "bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300",
  orange: "bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300",
  teal: "bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-300",
};

function ChartCard({
  title, icon: Icon, tone, empty, children,
}: {
  title: string;
  icon: IconType;
  tone: keyof typeof chipTones;
  empty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl border-slate-200/70 shadow-sm dark:border-slate-800 dark:bg-[#0b1226]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2.5 text-base">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${chipTones[tone]}`}>
            <Icon className="h-4 w-4" />
          </span>
          <span className="truncate">{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="h-64 sm:h-72">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 text-center dark:border-slate-700">
            <Icon className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No data yet.</p>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}