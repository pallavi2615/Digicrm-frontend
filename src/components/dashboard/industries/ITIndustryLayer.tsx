import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, CheckSquare, Package, IndianRupee, Plus, ArrowRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Link } from "@tanstack/react-router";

type ITDashboardResponse = {
  active_projects?: number;
  delivered?: number;
  open_tickets?: number;
  revenue_booked?: number;
  projects_by_stage?: Array<{ stage: string; count: number }>;
  tickets_by_priority?: Array<{ priority: string; count: number }>;
};

async function fetchITDashboard(): Promise<ITDashboardResponse> {
  return apiFetch<ITDashboardResponse>("/api/v1/dashboard/industry/it");
}

const STAGE_COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#6366f1"];
const PRIORITY_COLORS: Record<string, string> = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#ef4444",
  critical: "#7c3aed",
};

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function ITIndustryLayer() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-industry", "it"],
    queryFn: fetchITDashboard,
  });

  const kpis = [
    {
      label: "Active Projects",
      value: data?.active_projects ?? 0,
      icon: Briefcase,
      accent: "bg-primary/10 text-primary",
      actionLabel: (data?.active_projects ?? 0) === 0 ? "Create first project" : undefined,
      actionUrl: "/it/projects/new",
    },
    {
      label: "Delivered",
      value: data?.delivered ?? 0,
      icon: Package,
      accent: "bg-success/10 text-success",
    },
    {
      label: "Open Tickets",
      value: data?.open_tickets ?? 0,
      icon: CheckSquare,
      accent: "bg-warning/10 text-warning",
      actionLabel: (data?.open_tickets ?? 0) === 0 ? "Raise a ticket" : undefined,
      actionUrl: "/it/tickets/new",
    },
    {
      label: "Revenue Booked",
      value: formatINR(data?.revenue_booked ?? 0),
      icon: IndianRupee,
      accent: "bg-info/10 text-info",
    },
  ];

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="shadow-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    {kpi.label}
                  </p>
                  <p
                    className="text-2xl font-bold mt-1.5"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {isLoading ? "—" : kpi.value}
                  </p>
                  {kpi.actionLabel && (
                    <Link
                      to={kpi.actionUrl}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Plus className="h-3 w-3" />
                      {kpi.actionLabel}
                    </Link>
                  )}
                </div>
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${kpi.accent}`}>
                  <kpi.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Projects by Stage */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Projects by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {isLoading ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : !data?.projects_by_stage?.length ? (
                <EmptyState
                  message="No projects yet"
                  actionLabel="Create your first project"
                  actionUrl="/it/projects/new"
                />
              ) : (
                <ResponsiveContainer>
                  <BarChart data={data.projects_by_stage}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="stage" fontSize={11} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {data.projects_by_stage.map((_, i) => (
                        <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tickets by Priority */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Tickets by Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {isLoading ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : !data?.tickets_by_priority?.length ? (
                <EmptyState
                  message="No tickets raised"
                  actionLabel="Raise a ticket"
                  actionUrl="/it/tickets/new"
                />
              ) : (
                <ResponsiveContainer>
                  <BarChart data={data.tickets_by_priority}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="priority" fontSize={11} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {data.tickets_by_priority.map((item, i) => (
                        <Cell
                          key={i}
                          fill={PRIORITY_COLORS[item.priority?.toLowerCase()] ?? STAGE_COLORS[i % STAGE_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Link to="/it/projects">
          <Button variant="outline" size="sm" className="gap-2">
            View All Projects <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
        <Link to="/it/tickets">
          <Button variant="outline" size="sm" className="gap-2">
            View All Tickets <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
        <Link to="/it/pipeline">
          <Button variant="outline" size="sm" className="gap-2">
            Engagement Pipeline <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function EmptyState({
  message,
  actionLabel,
  actionUrl,
}: {
  message: string;
  actionLabel: string;
  actionUrl: string;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Link to={actionUrl} className="mt-2 text-xs text-primary hover:underline">
        {actionLabel} →
      </Link>
    </div>
  );
}