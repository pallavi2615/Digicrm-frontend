import { defineRoute } from "@/lib/router-compat";
import { useQuery } from "@/lib/react-data-client";
import { apiFetch } from "@/lib/api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
  Users,
  DollarSign,
  TrendingUp,
  Target,
  Trophy,
  XCircle,
  CheckSquare,
  ArrowUpRight,
  ArrowDownRight,
  GripVertical,
  EyeOff,
  Eye,
  RotateCcw,
  Search,
  Settings2,
  LayoutDashboard,
  BarChart3,
  PieChart as PieChartIcon,
  Filter,
  Activity,
  Workflow,
  Medal,
} from "lucide-react";

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

import { useEffect, useMemo, useState } from "react";

import { useRealtimeTable } from "@/lib/use-realtime-table";
import { NotificationsButton } from "@/components/notifications-button";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";

import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import { GlobalSearch } from "@/components/global-search";
import { Link } from "@/lib/router-compat";
import { toast } from "sonner";

export const Route = defineRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — DigiCRM AI" }],
  }),
  component: Dashboard,
});

/* =========================================================
   TYPES
========================================================= */

type KpiData = {
  totalLeads: number;
  qualified: number;
  openDeals: number;
  won: number;
  lost: number;
  revenue: number;
  pipelineValue: number;
  avgDealSize: number;
  conversionRate: number;
  tasksToday: number;
  upcomingMeetings: number;
};

type RevenueItem = {
  label: string;
  revenue: number;
  deals?: number;
};

type SourceItem = {
  name: string;
  value: number;
};

type FunnelItem = {
  stage: string;
  value: number;
};

type ActivityItem = {
  id: string | number;
  action?: string;
  description?: string;
  entity_type?: string;
  created_at?: string;
  actor_id?: string | number;
};

type PipelineItem = {
  stage: string;
  count: number;
  value: number;
};

type PerformerItem = {
  name: string;
  revenue: number;
  deals?: number;
  source?: string;
  lead_count?: number;
};

type DashboardStatsResponse = {
  total_leads?: number;
  qualified?: number;
  open_deals?: number;
  won?: number;
  lost?: number;
  revenue?: number;
  pipeline_value?: number;
  avg_deal_size?: number;
  conversion_rate?: number;
  tasks_today?: number;
};

/* =========================================================
   API HELPERS
========================================================= */

function numberValue(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function stringValue(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function extractArray<T = any>(response: any): T[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.results)) return response.results;
  if (Array.isArray(response?.items)) return response.items;
  return [];
}

/* =========================================================
   FETCHERS
========================================================= */

async function fetchKpis(): Promise<KpiData> {
  const data = await apiFetch<DashboardStatsResponse>("/api/v1/dashboard/stats");

  return {
    totalLeads: numberValue(data.total_leads),
    qualified: numberValue(data.qualified),
    openDeals: numberValue(data.open_deals),
    won: numberValue(data.won),
    lost: numberValue(data.lost),
    revenue: numberValue(data.revenue),
    pipelineValue: numberValue(data.pipeline_value),
    avgDealSize: numberValue(data.avg_deal_size),
    conversionRate: numberValue(data.conversion_rate),
    tasksToday: numberValue(data.tasks_today),
    // Backend stats endpoint currently doesn't return meetings.
    upcomingMeetings: 0,
  };
}

async function fetchMonthlyRevenue(): Promise<RevenueItem[]> {
  const response = await apiFetch<any>("/api/v1/dashboard/revenue-chart");
  const rows = extractArray<any>(response);

  return rows.map((item, index) => ({
    label: stringValue(
      item.label ?? item.month ?? item.month_name ?? item.period ?? item.name,
      `Month ${index + 1}`
    ),
    revenue: numberValue(
      item.revenue ?? item.amount ?? item.value ?? item.total_revenue
    ),
    deals:
      item.deals !== undefined
        ? numberValue(item.deals)
        : item.deal_count !== undefined
          ? numberValue(item.deal_count)
          : undefined,
  }));
}

async function fetchSources(): Promise<SourceItem[]> {
  const response = await apiFetch<any>("/api/v1/dashboard/lead-sources");
  const rows = extractArray<any>(response);

  return rows.map((item) => ({
    name: stringValue(item.name ?? item.source ?? item.label, "Unknown"),
    value: numberValue(item.value ?? item.count ?? item.lead_count ?? item.total),
  }));
}

async function fetchFunnel(): Promise<FunnelItem[]> {
  const response = await apiFetch<any>("/api/v1/dashboard/funnel");

  // Backend returns: { stages: [{ name, label, count }], total_leads, conversion_rate }
  const rows: any[] = Array.isArray(response?.stages)
    ? response.stages
    : extractArray<any>(response);

  return rows.map((item) => ({
    stage: stringValue(item.label ?? item.stage ?? item.name, "Unknown"),
    value: numberValue(item.count ?? item.value ?? item.lead_count ?? item.total),
  }));
}

async function fetchRecentActivities(): Promise<ActivityItem[]> {
  const response = await apiFetch<any>("/api/v1/dashboard/recent-activity");
  const rows = extractArray<any>(response);

  return rows.map((item, index) => ({
    id: item.id ?? index,
    action: item.action,
    description:
      item.description ?? item.message ?? item.activity ?? item.action,
    entity_type: item.entity_type,
    created_at: item.created_at ?? item.timestamp ?? item.date,
    actor_id: item.actor_id,
  }));
}

async function fetchPipeline(): Promise<PipelineItem[]> {
  const response = await apiFetch<any>("/api/v1/dashboard/pipeline");
  const rows = extractArray<any>(response);

  return rows.map((item) => ({
    stage: stringValue(
      item.stage ?? item.pipeline_stage ?? item.name ?? item.label,
      "Unknown"
    ),
    count: numberValue(
      item.count ?? item.proposal_count ?? item.deal_count ?? item.total
    ),
    value: numberValue(
      item.value ?? item.pipeline_value ?? item.amount ?? item.total_value
    ),
  }));
}

async function fetchTopPerformers(): Promise<PerformerItem[]> {
  const response = await apiFetch<any>("/api/v1/dashboard/top-performers");

  let rows: any[] = [];

  if (Array.isArray(response)) {
    rows = response;
  } else if (Array.isArray(response?.top_owners)) {
    rows = response.top_owners;
  } else if (Array.isArray(response?.performers)) {
    rows = response.performers;
  } else if (Array.isArray(response?.top_performers)) {
    rows = response.top_performers;
  } else if (Array.isArray(response?.owners)) {
    rows = response.owners;
  } else {
    rows = extractArray(response);
  }

  return rows.map((item, index) => ({
    name: stringValue(
      item.owner ??
        item.name ??
        item.owner_name ??
        item.user_name ??
        item.full_name ??
        item.source,
      `Performer ${index + 1}`
    ),
    revenue: numberValue(
      item.revenue ?? item.total_revenue ?? item.amount ?? item.value
    ),
    deals:
      item.deals !== undefined
        ? numberValue(item.deals)
        : item.deal_count !== undefined
          ? numberValue(item.deal_count)
          : undefined,
    source: item.source ?? item.source_name,
    lead_count:
      item.lead_count !== undefined
        ? numberValue(item.lead_count)
        : item.leads !== undefined
          ? numberValue(item.leads)
          : item.count !== undefined
            ? numberValue(item.count)
            : undefined,
  }));
}

/* =========================================================
   DESIGN TOKENS (matches Leads / reference UI)
========================================================= */

const CHART_RAW = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f97316", // orange
  "#8b5cf6", // purple
  "#ef4444", // red
];

type Tone = "blue" | "green" | "orange" | "purple" | "red" | "amber" | "cyan";

/**
 * Each tone = soft gradient card + coloured border + icon circle.
 * `solid` icons use a filled circle with a white glyph (like New / Qualified / Lost),
 * soft icons use a tinted circle (like Total / Contacted / Won).
 */
const TONES: Record<
  Tone,
  { card: string; soft: string; solid: string; text: string }
> = {
  blue: {
    card: "border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-blue-500/[0.03] to-transparent",
    soft: "bg-blue-500/15 text-blue-500",
    solid: "bg-blue-500 text-white",
    text: "text-blue-500",
  },
  green: {
    card: "border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-emerald-500/[0.03] to-transparent",
    soft: "bg-emerald-500/15 text-emerald-500",
    solid: "bg-emerald-500 text-white",
    text: "text-emerald-500",
  },
  orange: {
    card: "border-orange-500/20 bg-gradient-to-br from-orange-500/10 via-orange-500/[0.03] to-transparent",
    soft: "bg-orange-500/15 text-orange-500",
    solid: "bg-orange-500 text-white",
    text: "text-orange-500",
  },
  purple: {
    card: "border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-violet-500/[0.03] to-transparent",
    soft: "bg-violet-500/15 text-violet-500",
    solid: "bg-violet-500 text-white",
    text: "text-violet-500",
  },
  red: {
    card: "border-red-500/20 bg-gradient-to-br from-red-500/10 via-red-500/[0.03] to-transparent",
    soft: "bg-red-500/15 text-red-500",
    solid: "bg-red-500 text-white",
    text: "text-red-500",
  },
  amber: {
    card: "border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-amber-500/[0.03] to-transparent",
    soft: "bg-amber-500/15 text-amber-500",
    solid: "bg-amber-500 text-white",
    text: "text-amber-500",
  },
  cyan: {
    card: "border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-cyan-500/[0.03] to-transparent",
    soft: "bg-cyan-500/15 text-cyan-500",
    solid: "bg-cyan-500 text-white",
    text: "text-cyan-500",
  },
};

const PANEL = "rounded-2xl border border-border/60 bg-card shadow-sm";

const AVATAR_TONES = [
  "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  "bg-amber-500/15 text-amber-600 dark:text-amber-400",
];

function avatarTone(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

const PIPELINE_TONES: Tone[] = ["blue", "cyan", "purple", "orange", "amber", "green"];

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--popover-foreground)",
  boxShadow: "0 8px 24px -8px rgb(0 0 0 / 0.25)",
};

/* =========================================================
   FORMATTERS
========================================================= */

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatStage(stage: string) {
  return stage.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

/* =========================================================
   SECTION HEADER (icon tile + title)
========================================================= */

function SectionTitle({
  icon: Icon,
  title,
  tone = "blue",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tone?: Tone;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`h-9 w-9 rounded-xl flex items-center justify-center ${TONES[tone].soft}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <CardTitle className="text-base font-semibold">{title}</CardTitle>
    </div>
  );
}

/* =========================================================
   KPI CARD
========================================================= */

function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
  trend,
  tone = "blue",
  solid = false,
}: {
  title: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { dir: "up" | "down"; value: string };
  tone?: Tone;
  solid?: boolean;
}) {
  const t = TONES[tone];

  return (
    <div
      className={`rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg ${t.card}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`h-12 w-12 shrink-0 rounded-full flex items-center justify-center ${
            solid ? t.solid : t.soft
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
            {title}
          </p>

          <p
            className="text-2xl font-bold mt-0.5 truncate"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {value}
          </p>

          {hint && (
            <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
          )}
        </div>
      </div>

      {trend && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          {trend.dir === "up" ? (
            <ArrowUpRight className="h-3 w-3 text-emerald-500" />
          ) : (
            <ArrowDownRight className="h-3 w-3 text-red-500" />
          )}
          <span className={trend.dir === "up" ? "text-emerald-500" : "text-red-500"}>
            {trend.value}
          </span>
          <span className="text-muted-foreground">vs last month</span>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   KPI WIDGETS
========================================================= */

type KpiSpec = {
  id: string;
  title: string;
  get: (k: KpiData | undefined) => string;
  icon: any;
  tone: Tone;
  solid?: boolean;
  to?: string;
  search?: Record<string, string>;
};

const KPI_WIDGETS: KpiSpec[] = [
  {
    id: "totalLeads",
    title: "Total Leads",
    get: (k) => String(k?.totalLeads ?? 0),
    icon: Users,
    tone: "blue",
    to: "/leads",
  },
  {
    id: "qualified",
    title: "Qualified",
    get: (k) => String(k?.qualified ?? 0),
    icon: Target,
    tone: "purple",
    solid: true,
    to: "/leads",
    search: { status: "qualified" },
  },
  {
    id: "openDeals",
    title: "Open Deals",
    get: (k) => String(k?.openDeals ?? 0),
    icon: TrendingUp,
    tone: "orange",
    to: "/pipeline",
  },
  {
    id: "won",
    title: "Won",
    get: (k) => String(k?.won ?? 0),
    icon: Trophy,
    tone: "green",
    to: "/leads",
    search: { status: "won" },
  },
  {
    id: "lost",
    title: "Lost",
    get: (k) => String(k?.lost ?? 0),
    icon: XCircle,
    tone: "red",
    solid: true,
    to: "/leads",
    search: { status: "lost" },
  },
  {
    id: "revenue",
    title: "Revenue",
    get: (k) => formatCurrency(k?.revenue ?? 0),
    icon: DollarSign,
    tone: "green",
    solid: true,
  },
  {
    id: "pipelineValue",
    title: "Pipeline Value",
    get: (k) => formatCurrency(k?.pipelineValue ?? 0),
    icon: TrendingUp,
    tone: "cyan",
    to: "/pipeline",
  },
  {
    id: "avgDealSize",
    title: "Avg Deal Size",
    get: (k) => formatCurrency(k?.avgDealSize ?? 0),
    icon: DollarSign,
    tone: "amber",
  },
  {
    id: "conversionRate",
    title: "Conversion",
    get: (k) => `${(k?.conversionRate ?? 0).toFixed(1)}%`,
    icon: Target,
    tone: "purple",
  },
  {
    id: "tasksToday",
    title: "Tasks Today",
    get: (k) => String(k?.tasksToday ?? 0),
    icon: CheckSquare,
    tone: "orange",
    solid: true,
    to: "/tasks",
    search: { filter: "today" },
  },
];

/* =========================================================
   SORTABLE KPI
========================================================= */

function SortableKpi({
  spec,
  kpi,
  hidden,
  onHide,
  editing,
}: {
  spec: KpiSpec;
  kpi: KpiData | undefined;
  hidden: boolean;
  onHide: () => void;
  editing: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: spec.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (hidden) return null;

  const card = (
    <KpiCard
      title={spec.title}
      value={spec.get(kpi)}
      icon={spec.icon}
      tone={spec.tone}
      solid={spec.solid}
    />
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${editing ? "ring-2 ring-primary/30 rounded-2xl" : ""}`}
    >
      {editing && (
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          <button
            {...attributes}
            {...listeners}
            className="h-7 w-7 rounded-lg bg-background border shadow-sm flex items-center justify-center cursor-grab active:cursor-grabbing"
            title="Drag to reorder"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={onHide}
            className="h-7 w-7 rounded-lg bg-background border shadow-sm flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground"
            title="Hide widget"
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {spec.to && !editing ? (
        <Link
          to={spec.to}
          search={spec.search as never}
          className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl"
        >
          {card}
        </Link>
      ) : (
        card
      )}
    </div>
  );
}

/* =========================================================
   DASHBOARD LAYOUT PERSISTENCE (localStorage)
========================================================= */

const DASHBOARD_LAYOUT_KEY = "dashboard_layout";

type StoredLayout = {
  order: string[];
  hidden: string[];
};

function loadStoredLayout(): StoredLayout | null {
  try {
    const raw = localStorage.getItem(DASHBOARD_LAYOUT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    return {
      order: Array.isArray(parsed?.order) ? parsed.order : [],
      hidden: Array.isArray(parsed?.hidden) ? parsed.hidden : [],
    };
  } catch (error) {
    console.error("Failed to read dashboard layout:", error);
    return null;
  }
}

function storeLayout(order: string[], hidden: string[]) {
  try {
    localStorage.setItem(DASHBOARD_LAYOUT_KEY, JSON.stringify({ order, hidden }));
  } catch (error) {
    console.error("Failed to save dashboard layout:", error);
  }
}

/* =========================================================
   DASHBOARD
========================================================= */

function Dashboard() {
  const [editing, setEditing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [order, setOrder] = useState<string[]>(KPI_WIDGETS.map((w) => w.id));
  const [hidden, setHidden] = useState<string[]>([]);
  const [signupTenant, setSignupTenant] = useState<any>(null);

  /* ---------------- API QUERIES ---------------- */

  const { data: kpi, isError: kpiError } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchKpis,
  });

  const { data: monthly = [], isLoading: monthlyLoading } = useQuery({
    queryKey: ["dashboard-revenue"],
    queryFn: fetchMonthlyRevenue,
  });

  const { data: sources = [], isLoading: sourcesLoading } = useQuery({
    queryKey: ["dashboard-lead-sources"],
    queryFn: fetchSources,
  });

  const { data: funnel = [], isLoading: funnelLoading } = useQuery({
    queryKey: ["dashboard-funnel"],
    queryFn: fetchFunnel,
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ["dashboard-activities"],
    queryFn: fetchRecentActivities,
  });

  const { data: pipeline = [], isLoading: pipelineLoading } = useQuery({
    queryKey: ["dashboard-pipeline"],
    queryFn: fetchPipeline,
  });

  const { data: performers = [], isLoading: performersLoading } = useQuery({
    queryKey: ["dashboard-top-performers"],
    queryFn: fetchTopPerformers,
  });

  /* ---------------- REALTIME ---------------- */

  useRealtimeTable("leads", [
    ["dashboard-stats"],
    ["dashboard-funnel"],
    ["dashboard-lead-sources"],
    ["dashboard-revenue"],
    ["dashboard-pipeline"],
  ]);

  useRealtimeTable("tasks", [["dashboard-stats"]]);
  useRealtimeTable("meetings", [["dashboard-stats"]]);
  useRealtimeTable("it_tickets", [["dashboard-stats"]]);
  useRealtimeTable("activities", [["dashboard-activities"]]);

  /* ---------------- SIGNUP TENANT ---------------- */

  useEffect(() => {
    const storedTenant = sessionStorage.getItem("signup_tenant");

    if (storedTenant) {
      try {
        setSignupTenant(JSON.parse(storedTenant));
      } catch (error) {
        console.error("Failed to read signup tenant:", error);
      }
    }
  }, []);

  /* ---------------- LOAD SAVED LAYOUT ---------------- */

  useEffect(() => {
    const stored = loadStoredLayout();

    if (!stored) return;

    if (stored.order.length > 0) {
      setOrder(
        stored.order
          .filter((id) => KPI_WIDGETS.some((w) => w.id === id))
          .concat(
            KPI_WIDGETS.map((w) => w.id).filter((id) => !stored.order.includes(id))
          )
      );
    }

    setHidden(stored.hidden);
  }, []);

  const saveLayout = (nextOrder: string[], nextHidden: string[]) => {
    storeLayout(nextOrder, nextHidden);
  };

  /* ---------------- DRAG / DROP ---------------- */

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;

    if (!over || active.id === over.id) return;

    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));

    const next = arrayMove(order, oldIndex, newIndex);

    setOrder(next);
    saveLayout(next, hidden);
  };

  const hideWidget = (id: string) => {
    const next = [...hidden, id];
    setHidden(next);
    saveLayout(order, next);
  };

  const showAll = () => {
    setHidden([]);
    saveLayout(order, []);
  };

  const resetLayout = () => {
    const def = KPI_WIDGETS.map((w) => w.id);
    setOrder(def);
    setHidden([]);
    saveLayout(def, []);
  };

  const orderedSpecs = useMemo(
    () =>
      order
        .map((id) => KPI_WIDGETS.find((w) => w.id === id))
        .filter(Boolean) as KpiSpec[],
    [order]
  );

  /* ---------------- RENDER ---------------- */

  return (
    <div className="space-y-6">
      {/* ================= HEADER ================= */}

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center">
            <LayoutDashboard className="h-6 w-6" />
          </div>

          <div>
            <div className="flex items-center gap-3">
              <h1
                className="text-3xl font-bold leading-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Dashboard
              </h1>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>

            <p className="text-muted-foreground text-sm mt-1">
              Real-time overview of all CRM pipelines and performance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setSearchOpen(true)}
            className="gap-2 rounded-xl"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden md:inline text-[10px] px-1.5 py-0.5 rounded border bg-muted">
              ⌘K
            </kbd>
          </Button>

          <NotificationsButton />

          {editing && hidden.length > 0 && (
            <Button
              variant="outline"
              onClick={showAll}
              className="gap-2 rounded-xl border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
            >
              <Eye className="h-4 w-4" />
              Show all ({hidden.length})
            </Button>
          )}

          {editing && (
            <Button
              variant="outline"
              onClick={resetLayout}
              className="gap-2 rounded-xl border-violet-500/40 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          )}

          <Button
            onClick={() => setEditing(!editing)}
            className="gap-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-600/20"
          >
            <Settings2 className="h-4 w-4" />
            {editing ? "Done" : "Customize"}
          </Button>
        </div>
      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      {/* ================= API ERROR ================= */}

      {kpiError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm text-red-500">
            Failed to load dashboard statistics. Please check your backend/API
            connection.
          </p>
        </div>
      )}

      {/* ================= KPI ROW ================= */}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={order} strategy={horizontalListSortingStrategy}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {orderedSpecs.map((spec) => (
              <SortableKpi
                key={spec.id}
                spec={spec}
                kpi={kpi}
                hidden={hidden.includes(spec.id)}
                onHide={() => hideWidget(spec.id)}
                editing={editing}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* ================= MONTHLY REVENUE + LEAD SOURCES ================= */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className={`lg:col-span-2 ${PANEL}`}>
          <CardHeader>
            <SectionTitle icon={BarChart3} title="Monthly Revenue" tone="blue" />
          </CardHeader>

          <CardContent>
            <div className="h-72">
              {monthlyLoading ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Loading revenue...
                </div>
              ) : (
                <ResponsiveContainer>
                  <AreaChart data={monthly}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_RAW[0]} stopOpacity={0.45} />
                        <stop offset="100%" stopColor={CHART_RAW[0]} stopOpacity={0} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />

                    <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />

                    <YAxis
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `$${v / 1000}k`}
                    />

                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "var(--popover-foreground)" }}
                      itemStyle={{ color: "var(--popover-foreground)" }}
                      formatter={(v: number) => formatCurrency(v)}
                    />

                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke={CHART_RAW[0]}
                      fill="url(#rev)"
                      strokeWidth={2.5}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={PANEL}>
          <CardHeader>
            <SectionTitle icon={PieChartIcon} title="Lead Sources" tone="purple" />
          </CardHeader>

          <CardContent>
            <div className="h-72">
              {sourcesLoading ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Loading sources...
                </div>
              ) : sources.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  No lead source data.
                </div>
              ) : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={sources}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {sources.map((_, i) => (
                        <Cell key={i} fill={CHART_RAW[i % CHART_RAW.length]} />
                      ))}
                    </Pie>

                    <Tooltip
                      contentStyle={tooltipStyle}
                      itemStyle={{ color: "var(--popover-foreground)" }}
                      labelStyle={{ color: "var(--popover-foreground)" }}
                    />

                    <Legend
                      iconType="circle"
                      wrapperStyle={{ fontSize: 12, color: "var(--foreground)" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ================= FUNNEL + RECENT ACTIVITY ================= */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className={`lg:col-span-2 ${PANEL}`}>
          <CardHeader>
            <SectionTitle icon={Filter} title="Sales Funnel" tone="orange" />
          </CardHeader>

          <CardContent>
            <div className="h-72">
              {funnelLoading ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Loading funnel...
                </div>
              ) : (
                <ResponsiveContainer>
                  <BarChart data={funnel}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />

                    <XAxis
                      dataKey="stage"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatStage}
                    />

                    <YAxis fontSize={12} tickLine={false} axisLine={false} />

                    <Tooltip
                      cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                      contentStyle={tooltipStyle}
                    />

                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {funnel.map((_, i) => (
                        <Cell key={i} fill={CHART_RAW[i % CHART_RAW.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={PANEL}>
          <CardHeader>
            <SectionTitle icon={Activity} title="Recent Activity" tone="green" />
          </CardHeader>

          <CardContent>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {activitiesLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Loading activity...
                </p>
              ) : activities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No activity yet.
                </p>
              ) : (
                activities.map((a) => (
                  <div
                    key={a.id}
                    className="flex gap-3 text-sm rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5 hover:bg-muted/60 transition-colors"
                  >
                    <div className="h-2 w-2 rounded-full bg-blue-500 mt-2 shrink-0" />

                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">
                        {a.description || a.action || "Activity"}
                      </p>

                      {a.created_at && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(a.created_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ================= PIPELINE ================= */}

      <Card className={PANEL}>
        <CardHeader className="flex flex-row items-center justify-between">
          <SectionTitle icon={Workflow} title="Pipeline Overview" tone="cyan" />

          <Link to="/pipeline">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-violet-500/40 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10"
            >
              View Pipeline
            </Button>
          </Link>
        </CardHeader>

        <CardContent>
          {pipelineLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Loading pipeline...
            </div>
          ) : pipeline.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No pipeline data available.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {pipeline.map((item, index) => {
                const tone = PIPELINE_TONES[index % PIPELINE_TONES.length];
                return (
                  <div
                    key={`${item.stage}-${index}`}
                    className={`rounded-2xl border p-4 ${TONES[tone].card}`}
                  >
                    <p className="text-[11px] text-muted-foreground uppercase tracking-[0.14em] font-medium">
                      {formatStage(item.stage)}
                    </p>

                    <p className="text-2xl font-bold mt-2">{item.count}</p>

                    <p className={`text-xs mt-1 font-medium ${TONES[tone].text}`}>
                      {formatCurrency(item.value)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================= TOP PERFORMERS ================= */}

      <Card className={PANEL}>
        <CardHeader>
          <SectionTitle icon={Medal} title="Top Performers" tone="amber" />
        </CardHeader>

        <CardContent>
          {performersLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Loading top performers...
            </div>
          ) : performers.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No performer data available.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <div className="min-w-125">
                <div className="grid grid-cols-4 gap-4 px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground bg-muted/40 border-b border-border/60">
                  <span>Performer</span>
                  <span>Revenue</span>
                  <span>Deals</span>
                  <span>Leads</span>
                </div>

                <div className="divide-y divide-border/60">
                  {performers.map((performer, index) => (
                    <div
                      key={`${performer.name}-${index}`}
                      className="grid grid-cols-4 gap-4 px-4 py-3.5 items-center hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${avatarTone(
                            performer.name
                          )}`}
                        >
                          {performer.name.charAt(0).toUpperCase()}
                        </div>

                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {performer.name}
                          </p>

                          {performer.source && (
                            <p className="text-xs text-muted-foreground truncate">
                              {performer.source}
                            </p>
                          )}
                        </div>
                      </div>

                      <p className="text-sm font-semibold">
                        {formatCurrency(performer.revenue)}
                      </p>

                      <p className="text-sm">{performer.deals ?? "—"}</p>

                      <p className="text-sm">{performer.lead_count ?? "—"}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================= SIGNUP SUCCESS MODAL ================= */}

      {signupTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-[90%] max-w-md rounded-2xl border border-border/60 bg-background p-6 shadow-2xl">
            <div className="mb-5">
              <h2 className="text-2xl font-bold">Welcome {signupTenant.name}! 🎉</h2>

              <p className="mt-2 text-sm text-muted-foreground">
                Your CRM account has been created successfully.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Aapka Webhook URL:</label>

              <div className="flex gap-2">
                <input
                  readOnly
                  value={signupTenant.webhook_url}
                  className="flex-1 min-w-0 rounded-xl border bg-muted px-3 py-2 text-sm"
                />

                <Button
                  className="rounded-xl bg-blue-600 text-white hover:bg-blue-500"
                  onClick={() => {
                    navigator.clipboard.writeText(signupTenant.webhook_url);
                    toast.success("Webhook URL copied!");
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                className="rounded-xl bg-blue-600 text-white hover:bg-blue-500"
                onClick={() => {
                  sessionStorage.removeItem("signup_tenant");
                  setSignupTenant(null);
                }}
              >
                Continue to Dashboard
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}